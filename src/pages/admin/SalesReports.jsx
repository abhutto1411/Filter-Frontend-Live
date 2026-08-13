import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from '../../components/Modal';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import { ShimmerTextBlock, ShimmerTable } from '../../components/supplier/Shimmer';
import {
    adminSalesReportsParams,
} from '../../services/adminSalesReportsApi';
import * as adminReportsApi from '../../services/adminSalesReportsApi';
import * as marketingReportsApi from '../../services/marketingSalesReportsApi';
import {
    getBranches as adminGetBranches,
    getTechnicians as adminGetTechnicians,
    getWorkshopOptions as adminGetWorkshopOptions,
} from '../../services/superAdminApi';
import * as marketingLookupApi from '../../services/marketingSalesLookupApi';
import { ExportMenu } from '../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../utils/tableExport';
import { srT } from '../../utils/salesReportsI18n';
import '../workshop/Workshop.css';

const EXPORT_LIMIT = 5000;

const REPORT_TABS = [
    { id: 'recent_orders', labelKey: 'tab.orders' },
    { id: 'daily_sales', labelKey: 'tab.dailySales' },
    { id: 'by_technician', labelKey: 'tab.byTechnician' },
    { id: 'by_customer', labelKey: 'tab.byCustomer' },
    { id: 'by_product', labelKey: 'tab.byProduct' },
    { id: 'by_department', labelKey: 'tab.byDepartment' },
    { id: 'by_category', labelKey: 'tab.byCategories' },
    { id: 'by_branch', labelKey: 'tab.byBranch' },
    { id: 'by_cashier', labelKey: 'tab.byCashier' },
];

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

function formatOrderSourceLabel(source, t) {
    const s = String(source ?? '').trim().toLowerCase();
    if (s === 'walk_in') return t('src.walkIn');
    if (s === 'walk_in_corporate') return t('src.walkInCorporate');
    if (s === 'takeaway') return t('src.takeaway');
    if (!s) return t('common.emDash');
    return s
        .split('_')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
        .join(' ');
}

function formatOrderStatusLabel(status) {
    if (status == null || String(status).trim() === '') return '—';
    return String(status)
        .trim()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDiscountCell(discountType, discountValue) {
    const t = String(discountType ?? '').toLowerCase();
    const v = toNumber(discountValue);
    if (!v) return '—';
    if (t === 'percent' || t === 'percentage') return `${v}%`;
    return `SAR ${v.toLocaleString()}`;
}

const formatCurrency = (value) => `SAR ${toNumber(value).toLocaleString()}`;

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toDatetimeLocalValue(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function defaultLocalRangeLatest() {
    const end = new Date();
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    return { start: toDatetimeLocalValue(start), end: toDatetimeLocalValue(end) };
}

function rangeToApiIso(rangeFromLocal, rangeToLocal, t) {
    const s = new Date(rangeFromLocal);
    const e = new Date(rangeToLocal);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
        throw new Error(t ? t('err.invalidRange') : 'Invalid date/time range.');
    }
    if (s.getTime() > e.getTime()) {
        throw new Error(t ? t('err.startBeforeEnd') : 'Start must be on or before end.');
    }
    return { startDate: s.toISOString(), endDate: e.toISOString() };
}

function isInvoiceDateDetailColumnKey(k) {
    const n = String(k || '').toLowerCase().replace(/-/g, '_');
    return n === 'invoicedate' || n === 'invoice_date';
}

function isMoneyDetailColumnKey(k) {
    const n = String(k || '').toLowerCase().replace(/-/g, '_');
    return (
        n === 'totalamount' ||
        n === 'total_amount' ||
        n === 'subtotal' ||
        n === 'vatamount' ||
        n === 'vat_amount' ||
        n === 'discountamount' ||
        n === 'discount_amount' ||
        n === 'departmentlinetotal' ||
        n === 'invoicetotalamount' ||
        n === 'invoice_amount' ||
        n === 'line_total' ||
        n === 'linetotal' ||
        n === 'commission' ||
        n === 'revenue' ||
        n === 'revenue_sar' ||
        n === 'revenuesar'
    );
}

function formatLineItemSubtext(item, t) {
    const qty = item.qty ?? item.quantity;
    const unit = toNumber(item.unitPrice ?? item.unit_price);
    const dType = String(item.discountType ?? item.discount_type ?? '').toLowerCase();
    const dVal = toNumber(item.discountValue ?? item.discount_value);
    const vatPct = toNumber(item.vatPercent ?? item.vat_percent);
    const vatMode = String(item.vatMode ?? item.vat_mode ?? '').trim();
    const line = toNumber(item.lineTotal ?? item.line_total);
    const disc =
        dVal > 0
            ? dType === 'percent' || dType === 'percentage'
                ? t('detail.line.discPct', { v: dVal })
                : t('detail.line.discSar', { v: dVal.toLocaleString() })
            : t('detail.line.discNone');
    const line1 = t('detail.line.qtyUnit', {
        type: item.itemType ?? item.item_type ?? t('detail.itemTypeDefault'),
        qty: qty ?? t('common.emDash'),
        unit: unit.toLocaleString(),
    });
    const vat = Number.isFinite(vatPct) && vatPct > 0 ? `${vatPct}%` : t('common.emDash');
    const mode = vatMode ? ` (${vatMode})` : '';
    const line2 = t('detail.line.vatLine', { disc, vat, mode, line: line.toLocaleString() });
    return { line1, line2 };
}

function formatInvoiceDateTimeForDisplay(row) {
    const raw =
        row?.issuedAt ??
        row?.issued_at ??
        row?.dateTime ??
        row?.invoiceDate ??
        row?.invoice_date;
    if (raw == null || raw === '') return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Build {headers, rows} for the Recent Orders list — used for PDF/Excel export. */
function buildRecentOrdersExportRows(rows, t) {
    const headers = [
        t('export.h.invoice'),
        t('export.h.order'),
        t('export.h.type'),
        t('export.h.status'),
        t('export.h.datetime'),
        t('export.h.customer'),
        t('export.h.plate'),
        t('export.h.total'),
    ];
    const dash = t('common.emDash');
    const out = (rows || []).map((row) => [
        row.invoiceNo ?? (row.salesOrderId != null ? t('orders.pendingInvoice') : dash),
        row.salesOrderId ?? dash,
        formatOrderSourceLabel(row.orderSource, t),
        formatOrderStatusLabel(row.orderStatus),
        formatInvoiceDateTimeForDisplay(row),
        row.customerName ?? dash,
        row.plateNo ?? dash,
        Number(toNumber(row.invoiceTotal).toFixed(2)),
    ]);
    return { headers, rows: out };
}

function formatReportInstant(iso) {
    if (iso == null || iso === '') return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatJobCompletedDisplay(job, t) {
    if (!job) return t('common.emDash');
    if (job.completedAt) return formatReportInstant(job.completedAt);
    const st = String(job.status ?? '').toLowerCase();
    if (st === 'edited') return t('modal.reopened');
    return t('common.emDash');
}

function recentOrderRowTarget(row) {
    if (!row || typeof row !== 'object') return '';
    if (row.listingKind === 'open' || row.invoiceId == null || row.invoiceId === '') {
        return row.salesOrderId != null && String(row.salesOrderId) !== ''
            ? `so:${row.salesOrderId}`
            : '';
    }
    return `inv:${row.invoiceId}`;
}

function parseArr(v) {
    if (Array.isArray(v)) return v;
    return [];
}

function extractSummaryRows(res, key) {
    const direct = parseArr(res?.[key]);
    if (direct.length) return direct;
    const nested = parseArr(res?.data?.[key]);
    if (nested.length) return nested;
    const rows = parseArr(res?.rows);
    if (rows.length) return rows;
    const dataRows = parseArr(res?.data?.rows);
    if (dataRows.length) return dataRows;
    return [];
}

function humanizeKey(key) {
    return String(key || '')
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (m) => m.toUpperCase());
}

function tabQueryTokens(query) {
    return String(query ?? '')
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);
}

function rowMatchesTabQuery(parts, query) {
    const tokens = tabQueryTokens(query);
    if (tokens.length === 0) return true;
    const hay = parts.map((x) => String(x ?? '').toLowerCase()).join(' ');
    return tokens.every((t) => hay.includes(t));
}

function createEmptyTabSearch() {
    return {
        daily_sales: '',
        by_technician: '',
        by_customer: '',
        by_product: '',
        by_department: '',
        by_category: '',
        by_branch: '',
        by_cashier: '',
    };
}

/** Per-tab amount sort: 'default' keeps server/order order; 'asc'/'desc' sort by primary number. */
function createDefaultTabSort() {
    return {
        recent_orders: 'default',
        daily_sales: 'default',
        by_technician: 'default',
        by_customer: 'default',
        by_product: 'default',
        by_department: 'default',
        by_category: 'default',
        by_branch: 'default',
        by_cashier: 'default',
    };
}

function applyTabSort(rows, mode, getter) {
    if (!Array.isArray(rows) || mode === 'default' || rows.length < 2) return rows;
    const sign = mode === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        const av = Number(getter(a));
        const bv = Number(getter(b));
        const an = Number.isFinite(av) ? av : 0;
        const bn = Number.isFinite(bv) ? bv : 0;
        return (an - bn) * sign;
    });
}

function TabSortSelect({ value, onChange, ariaLabel, t }) {
    return (
        <select
            className="ws-report-tab-search"
            style={{ maxWidth: 170, minWidth: 140 }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={ariaLabel || t('sort.aria')}
        >
            <option value="default">{t('sort.default')}</option>
            <option value="asc">{t('sort.asc')}</option>
            <option value="desc">{t('sort.desc')}</option>
        </select>
    );
}

const ORDERS_PAGE_SIZE = 25;

export default function SalesReports({ portal = 'admin' }) {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        (portal === 'marketing' && typeof localStorage !== 'undefined'
            ? localStorage.getItem('marketing-locale')
            : null) ||
        'en';
    const t = useCallback((key, vars) => srT(locale, key, vars), [locale]);

    const reportsApi = portal === 'marketing' ? marketingReportsApi : adminReportsApi;
    const getWorkshopOptions = portal === 'marketing'
        ? marketingLookupApi.getWorkshopOptions
        : adminGetWorkshopOptions;
    const getBranches = portal === 'marketing'
        ? marketingLookupApi.getBranches
        : adminGetBranches;
    const getTechnicians = portal === 'marketing'
        ? marketingLookupApi.getTechnicians
        : adminGetTechnicians;

    const {
        getAdminSalesAnalytics,
        getAdminSalesByBranch,
        getAdminSalesByBranchDetails,
        getAdminSalesByCashier,
        getAdminSalesByCashierDetails,
        getAdminSalesByCustomer,
        getAdminSalesByCustomerDetails,
        getAdminSalesByCategory,
        getAdminSalesByCategoryDetails,
        getAdminSalesByDepartment,
        getAdminSalesByDepartmentDetails,
        getAdminSalesByProduct,
        getAdminSalesByProductDetails,
        getAdminSalesByTechnician,
        getAdminSalesByTechnicianDetails,
        getAdminSalesDailyDetails,
        getAdminSalesRecentOpenOrderDetails,
        getAdminSalesRecentOrderDetails,
        getAdminSalesRecentOrders,
    } = reportsApi;

    const initialRange = useMemo(() => defaultLocalRangeLatest(), []);
    const [rangeFromLocal, setRangeFromLocal] = useState(initialRange.start);
    const [rangeToLocal, setRangeToLocal] = useState(initialRange.end);

    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [workshopOptionsLoading, setWorkshopOptionsLoading] = useState(true);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');

    const [branchOptions, setBranchOptions] = useState([]);
    const [branchOptionsLoading, setBranchOptionsLoading] = useState(false);
    const [selectedBranchId, setSelectedBranchId] = useState('all');

    const [activeTab, setActiveTab] = useState('recent_orders');
    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;
    const [tabSearch, setTabSearch] = useState(createEmptyTabSearch);
    const [tabSort, setTabSort] = useState(createDefaultTabSort);
    const setSortFor = useCallback(
        (tabId) => (next) => setTabSort((p) => ({ ...p, [tabId]: next })),
        [],
    );

    const [technicianOptions, setTechnicianOptions] = useState([]);
    const [byProductTechnicianId, setByProductTechnicianId] = useState('');
    const [byProductTechnicianLoading, setByProductTechnicianLoading] = useState(false);
    const [byProductTechnicianError, setByProductTechnicianError] = useState('');

    const [reportData, setReportData] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [ordersPage, setOrdersPage] = useState(1);
    const [ordersTotal, setOrdersTotal] = useState(0);
    const [ordersSearchInput, setOrdersSearchInput] = useState('');
    const [ordersSearchDebounced, setOrdersSearchDebounced] = useState('');
    const [ordersListLoading, setOrdersListLoading] = useState(false);
    const [ordersListError, setOrdersListError] = useState('');
    const [exporting, setExporting] = useState(false);

    const [summaryData, setSummaryData] = useState({
        by_technician: [],
        by_customer: [],
        by_product: [],
        by_department: [],
        by_category: [],
        by_branch: [],
        by_cashier: [],
    });

    const [detailRows, setDetailRows] = useState([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');
    const [detailsTitle, setDetailsTitle] = useState('');
    const [selectedDetailKey, setSelectedDetailKey] = useState('');
    const [detailTableWidth, setDetailTableWidth] = useState(0);
    const topScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);
    const scrollSyncLockRef = useRef(false);

    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    const [recentOrderDetails, setRecentOrderDetails] = useState(null);
    const [recentOrderDetailsLoading, setRecentOrderDetailsLoading] = useState(false);
    const [recentOrderDetailsError, setRecentOrderDetailsError] = useState('');

    const detailAnchorRef = useRef(null);
    const loadDetailsRef = useRef(null);
    const prevScopeRef = useRef('');
    const recentOrderDetailsTargetRef = useRef(null);

    const hasWorkshop = selectedWorkshopId !== '' && selectedWorkshopId != null;

    // Load workshops once on mount.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setWorkshopOptionsLoading(true);
            try {
                const res = await getWorkshopOptions();
                const list = Array.isArray(res?.workshops)
                    ? res.workshops
                    : Array.isArray(res?.data?.workshops)
                      ? res.data.workshops
                      : [];
                if (!cancelled) {
                    setWorkshopOptions(
                        list.map((w) => ({ id: String(w.id), name: String(w.name || '').trim() || t('filter.workshopFallback') })),
                    );
                }
            } catch {
                if (!cancelled) setWorkshopOptions([]);
            } finally {
                if (!cancelled) setWorkshopOptionsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Load branches when workshop changes.
    useEffect(() => {
        if (!hasWorkshop) {
            setBranchOptions([]);
            setSelectedBranchId('all');
            return;
        }
        let cancelled = false;
        (async () => {
            setBranchOptionsLoading(true);
            try {
                const res = await getBranches({ workshopId: selectedWorkshopId });
                const list = Array.isArray(res?.branches)
                    ? res.branches
                    : Array.isArray(res?.data?.branches)
                      ? res.data.branches
                      : [];
                if (!cancelled) {
                    setBranchOptions(
                        list.map((b) => ({ id: String(b.id), name: String(b.name || '').trim() || t('filter.branchFallback') })),
                    );
                    setSelectedBranchId('all');
                }
            } catch {
                if (!cancelled) {
                    setBranchOptions([]);
                    setSelectedBranchId('all');
                }
            } finally {
                if (!cancelled) setBranchOptionsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hasWorkshop, selectedWorkshopId]);

    const workshopLabel = useMemo(() => {
        if (!hasWorkshop) return t('filter.selectWorkshop');
        return workshopOptions.find((w) => w.id === String(selectedWorkshopId))?.name || t('filter.workshopFallback');
    }, [hasWorkshop, selectedWorkshopId, workshopOptions, t]);

    const branchLabel = useMemo(() => {
        if (!hasWorkshop) return t('common.emDash');
        if (!selectedBranchId || selectedBranchId === 'all') return t('filter.allBranches');
        return branchOptions.find((b) => b.id === String(selectedBranchId))?.name || t('filter.branchFallback');
    }, [hasWorkshop, selectedBranchId, branchOptions, t]);

    const fetchRecentOrdersList = useCallback(async () => {
        if (!hasWorkshop) return;
        setOrdersListLoading(true);
        setOrdersListError('');
        try {
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal, t);
            const params = adminSalesReportsParams(selectedWorkshopId, selectedBranchId, {
                startDate,
                endDate,
            });
            const limit = ORDERS_PAGE_SIZE;
            const offset = (ordersPage - 1) * limit;
            const q = ordersSearchDebounced.trim();
            const res = await getAdminSalesRecentOrders({
                ...params,
                limit,
                offset,
                ...(q ? { search: q } : {}),
            });
            const rowsRaw = Array.isArray(res?.rows)
                ? res.rows
                : Array.isArray(res?.data?.rows)
                  ? res.data.rows
                  : [];
            setRecentOrders(rowsRaw);
            const tot = res?.total ?? res?.data?.total;
            setOrdersTotal(
                typeof tot === 'number' && Number.isFinite(tot)
                    ? tot
                    : Number.parseInt(String(tot ?? ''), 10) || 0,
            );
        } catch (e) {
            setRecentOrders([]);
            setOrdersTotal(0);
            setOrdersListError(e?.message || t('err.loadOrders'));
        } finally {
            setOrdersListLoading(false);
        }
    }, [hasWorkshop, selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal, ordersPage, ordersSearchDebounced, t]);

    const fetchRecentOrdersListRef = useRef(fetchRecentOrdersList);
    fetchRecentOrdersListRef.current = fetchRecentOrdersList;

    // Export the FULL recent-orders list for the current scope + date range.
    const runOrdersExport = useCallback(async (kind) => {
        if (!hasWorkshop) {
            setOrdersListError(t('err.selectWorkshopExport'));
            return;
        }
        setExporting(true);
        setOrdersListError('');
        try {
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal, t);
            const params = adminSalesReportsParams(selectedWorkshopId, selectedBranchId, { startDate, endDate });
            const q = ordersSearchDebounced.trim();
            const res = await getAdminSalesRecentOrders({
                ...params,
                limit: EXPORT_LIMIT,
                offset: 0,
                ...(q ? { search: q } : {}),
            });
            const list = Array.isArray(res?.rows) ? res.rows
                : Array.isArray(res?.data?.rows) ? res.data.rows : [];
            const { headers, rows } = buildRecentOrdersExportRows(list, t);
            const subtitle = t('export.subtitle', {
                n: rows.length,
                from: rangeFromLocal || '…',
                to: rangeToLocal || '…',
            });
            if (kind === 'pdf') {
                exportRowsToPdf({ title: t('export.title'), subtitle, headers, rows, filenameBase: 'sales-reports-orders' });
            } else {
                exportRowsToExcel({ sheetName: t('export.sheet'), headers, rows, filenameBase: 'sales-reports-orders' });
            }
        } catch (e) {
            setOrdersListError(e?.message || t('err.exportFailed'));
        } finally {
            setExporting(false);
        }
    }, [hasWorkshop, selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal, ordersSearchDebounced, t]);

    const loadReports = useCallback(async () => {
        if (!hasWorkshop) {
            setReportData(null);
            setSummaryData({
                by_technician: [],
                by_customer: [],
                by_product: [],
                by_department: [],
                by_category: [],
                by_branch: [],
                by_cashier: [],
            });
            setRecentOrders([]);
            setOrdersTotal(0);
            setTechnicianOptions([]);
            return;
        }
        setIsLoading(true);
        setLoadError('');
        setDetailsError('');
        setOrdersPage(1);
        try {
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal, t);
            const params = adminSalesReportsParams(selectedWorkshopId, selectedBranchId, {
                startDate,
                endDate,
            });
            const techQuery = {
                workshopId: String(selectedWorkshopId),
                ...(selectedBranchId && selectedBranchId !== 'all'
                    ? { branchId: String(selectedBranchId) }
                    : {}),
            };
            const [
                response,
                byTechnicianRes,
                byCustomerRes,
                byProductRes,
                byDepartmentRes,
                byCategoryRes,
                byBranchRes,
                byCashierRes,
                techniciansRes,
            ] = await Promise.all([
                getAdminSalesAnalytics(params),
                getAdminSalesByTechnician(params),
                getAdminSalesByCustomer(params),
                getAdminSalesByProduct(params),
                getAdminSalesByDepartment(params),
                getAdminSalesByCategory(params),
                getAdminSalesByBranch(params),
                getAdminSalesByCashier(params),
                getTechnicians(techQuery).catch(() => null),
            ]);
            if (!response?.success) {
                throw new Error(t('err.invalidReports'));
            }
            setReportData(response);
            setSummaryData({
                by_technician: extractSummaryRows(byTechnicianRes, 'by_technician'),
                by_customer: extractSummaryRows(byCustomerRes, 'by_customer'),
                by_product: extractSummaryRows(byProductRes, 'by_product'),
                by_department: extractSummaryRows(byDepartmentRes, 'by_department'),
                by_category: extractSummaryRows(byCategoryRes, 'by_category'),
                by_branch: extractSummaryRows(byBranchRes, 'by_branch'),
                by_cashier: extractSummaryRows(byCashierRes, 'by_cashier'),
            });
            const techList = Array.isArray(techniciansRes?.technicians)
                ? techniciansRes.technicians
                : Array.isArray(techniciansRes?.data?.technicians)
                  ? techniciansRes.data.technicians
                  : Array.isArray(techniciansRes?.data)
                    ? techniciansRes.data
                    : Array.isArray(techniciansRes)
                      ? techniciansRes
                      : [];
            const opts = techList
                .map((tech) => ({
                    id: String(tech?.id ?? tech?.employeeId ?? ''),
                    name: String(tech?.name ?? '').trim() || t('detail.fallback.technician'),
                }))
                .filter((tech) => tech.id);
            opts.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            setTechnicianOptions(opts);
        } catch (error) {
            setLoadError(error.message || t('err.loadAnalytics'));
            setReportData(null);
            setSummaryData({
                by_technician: [],
                by_customer: [],
                by_product: [],
                by_department: [],
                by_category: [],
                by_branch: [],
                by_cashier: [],
            });
            setRecentOrders([]);
            setOrdersTotal(0);
            setOrdersListError('');
            setTechnicianOptions([]);
            detailAnchorRef.current = null;
            setDetailRows([]);
            setSelectedDetailKey('');
            setDetailsTitle('');
        } finally {
            setIsLoading(false);
            queueMicrotask(() => {
                void fetchRecentOrdersListRef.current();
            });
            const anchor = detailAnchorRef.current;
            if (anchor && anchor.tabId === activeTabRef.current) {
                queueMicrotask(() => {
                    const fn = loadDetailsRef.current;
                    if (fn) fn(anchor.tabId, anchor.row);
                });
            }
        }
    }, [hasWorkshop, selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal, t]);

    useEffect(() => {
        const t = setTimeout(() => {
            setOrdersSearchDebounced(ordersSearchInput.trim());
        }, 380);
        return () => clearTimeout(t);
    }, [ordersSearchInput]);

    useLayoutEffect(() => {
        setOrdersPage(1);
    }, [ordersSearchDebounced]);

    useEffect(() => {
        if (!hasWorkshop) return;
        void fetchRecentOrdersList();
    }, [hasWorkshop, fetchRecentOrdersList, ordersPage, ordersSearchDebounced]);

    const refetchByProductForTechnician = useCallback(
        async (technicianId) => {
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal, t);
            const params = adminSalesReportsParams(selectedWorkshopId, selectedBranchId, {
                startDate,
                endDate,
                ...(technicianId ? { technicianId } : {}),
            });
            const byProductRes = await getAdminSalesByProduct(params);
            setSummaryData((prev) => ({
                ...prev,
                by_product: extractSummaryRows(byProductRes, 'by_product'),
            }));
        },
        [selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal],
    );

    const handleByProductTechnicianChange = useCallback(
        async (e) => {
            const id = e.target.value;
            detailAnchorRef.current = null;
            setByProductTechnicianId(id);
            setSelectedDetailKey('');
            setDetailRows([]);
            setDetailsTitle('');
            setDetailsError('');
            setByProductTechnicianError('');
            setByProductTechnicianLoading(true);
            try {
                await refetchByProductForTechnician(id);
            } catch (err) {
                setByProductTechnicianError(err?.message || t('err.loadProductTech'));
            } finally {
                setByProductTechnicianLoading(false);
            }
        },
        [refetchByProductForTechnician, t],
    );

    // Reset drill-down when scope changes.
    useEffect(() => {
        const scopeKey = `${selectedWorkshopId}|${selectedBranchId}`;
        const prev = prevScopeRef.current;
        if (prev !== '' && prev !== scopeKey) {
            detailAnchorRef.current = null;
            recentOrderDetailsTargetRef.current = null;
            setRecentOrderDetails(null);
            setRecentOrderDetailsError('');
            setRecentOrderDetailsLoading(false);
            setDetailRows([]);
            setSelectedDetailKey('');
            setDetailsTitle('');
            setDetailsError('');
            setByProductTechnicianId('');
            setByProductTechnicianError('');
        }
        prevScopeRef.current = scopeKey;
    }, [selectedWorkshopId, selectedBranchId]);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    const fetchRecentOrderDetails = useCallback(async (target) => {
        const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal, t);
        const params = adminSalesReportsParams(selectedWorkshopId, selectedBranchId, {
            startDate,
            endDate,
        });
        const targetKey = String(target ?? '');
        if (targetKey.startsWith('so:')) {
            return await getAdminSalesRecentOpenOrderDetails(targetKey.slice(3), params);
        }
        const invId = targetKey.startsWith('inv:') ? targetKey.slice(4) : targetKey;
        return await getAdminSalesRecentOrderDetails(invId, params);
    }, [selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal, t]);

    const openRecentOrderDetails = useCallback(async (target) => {
        if (!target) return;
        recentOrderDetailsTargetRef.current = target;
        setRecentOrderDetailsLoading(true);
        setRecentOrderDetailsError('');
        try {
            const res = await fetchRecentOrderDetails(target);
            const payload =
                res && typeof res === 'object' && res.data && typeof res.data === 'object'
                    ? res.data
                    : res;
            setRecentOrderDetails(payload && typeof payload === 'object' ? payload : null);
        } catch (error) {
            setRecentOrderDetailsError(error?.message || t('err.loadOrderDetails'));
            setRecentOrderDetails(null);
        } finally {
            setRecentOrderDetailsLoading(false);
        }
    }, [fetchRecentOrderDetails, t]);

    useEffect(() => {
        const id = recentOrderDetailsTargetRef.current;
        if (!id) return;
        void openRecentOrderDetails(id);
    }, [rangeFromLocal, rangeToLocal, selectedWorkshopId, selectedBranchId, openRecentOrderDetails]);

    useEffect(() => {
        detailAnchorRef.current = null;
        setDetailRows([]);
        setDetailsError('');
        setDetailsTitle('');
        setSelectedDetailKey('');
    }, [activeTab]);

    useEffect(() => {
        if (detailsLoading || detailsError || detailRows.length === 0) return;
        const updateWidth = () => {
            const el = bottomScrollRef.current;
            if (!el) return;
            setDetailTableWidth(el.scrollWidth || 0);
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [detailRows, detailsLoading, detailsError]);

    const handleTopScroll = () => {
        if (scrollSyncLockRef.current) return;
        const top = topScrollRef.current;
        const bottom = bottomScrollRef.current;
        if (!top || !bottom) return;
        scrollSyncLockRef.current = true;
        bottom.scrollLeft = top.scrollLeft;
        scrollSyncLockRef.current = false;
    };

    const handleBottomScroll = () => {
        if (scrollSyncLockRef.current) return;
        const top = topScrollRef.current;
        const bottom = bottomScrollRef.current;
        if (!top || !bottom) return;
        scrollSyncLockRef.current = true;
        top.scrollLeft = bottom.scrollLeft;
        scrollSyncLockRef.current = false;
    };

    const loadDetails = useCallback(
        async (tabId, row) => {
            if (!hasWorkshop) return;
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal, t);
            const params = adminSalesReportsParams(selectedWorkshopId, selectedBranchId, {
                startDate,
                endDate,
                ...(tabId === 'by_product' && byProductTechnicianId
                    ? { technicianId: byProductTechnicianId }
                    : {}),
            });
            let fetcher = null;
            let key = '';
            let title = '';
            if (tabId === 'by_technician') {
                fetcher = getAdminSalesByTechnicianDetails;
                key = String(row.technician_id ?? row.technicianId ?? row.id ?? '');
                title = t('detail.technician', { name: row.name || t('detail.fallback.technician') });
            } else if (tabId === 'by_customer') {
                fetcher = getAdminSalesByCustomerDetails;
                key = String(row.customer_id ?? row.customerId ?? '');
                title = t('detail.customer', {
                    name: row.customer_name ?? row.customerName ?? t('detail.fallback.customer'),
                });
            } else if (tabId === 'by_product') {
                fetcher = getAdminSalesByProductDetails;
                key = String(row.product_id ?? row.productId ?? '');
                title = t('detail.product', {
                    name: row.product_name ?? row.productName ?? row.item_name ?? t('detail.fallback.item'),
                });
            } else if (tabId === 'by_department') {
                fetcher = getAdminSalesByDepartmentDetails;
                key = String(row.department_id ?? row.departmentId ?? '');
                title = t('detail.department', {
                    name: row.department_name ?? row.departmentName ?? t('detail.fallback.department'),
                });
            } else if (tabId === 'by_category') {
                fetcher = getAdminSalesByCategoryDetails;
                key = String(row.category_id ?? row.categoryId ?? '');
                title = t('detail.category', {
                    name: row.category_name ?? row.categoryName ?? t('detail.fallback.category'),
                });
            } else if (tabId === 'by_branch') {
                fetcher = getAdminSalesByBranchDetails;
                key = String(row.branch_id ?? row.branchId ?? '');
                title = t('detail.branch', {
                    name: row.branch_name ?? row.branchName ?? t('detail.fallback.branch'),
                });
            } else if (tabId === 'by_cashier') {
                fetcher = getAdminSalesByCashierDetails;
                key = String(row.cashier_id ?? row.cashierId ?? row.user_id ?? row.userId ?? '');
                title = t('detail.cashier', { name: row.name ?? t('detail.fallback.cashier') });
            } else if (tabId === 'daily_sales') {
                fetcher = getAdminSalesDailyDetails;
                key = String(row.date ?? '').trim();
                title = t('detail.daily', {
                    day: `${row.day ? `${row.day} · ` : ''}${key}`,
                });
            }
            if (!fetcher || !key) {
                detailAnchorRef.current = null;
                return;
            }

            detailAnchorRef.current = { tabId, row };
            setSelectedDetailKey(`${tabId}:${key || 'all'}`);
            setDetailsLoading(true);
            setDetailsError('');
            setDetailsTitle(title);
            try {
                const res = await fetcher(key, params);
                const rows = parseArr(res?.rows);
                const stripIds = (r) => {
                    const next = { ...(r || {}) };
                    delete next.jobId;
                    delete next.job_id;
                    delete next.departmentId;
                    delete next.department_id;
                    delete next.branchId;
                    delete next.branch_id;
                    delete next.customerId;
                    delete next.customer_id;
                    delete next.corporateAccountId;
                    delete next.corporate_account_id;
                    delete next.salesOrderId;
                    delete next.sales_order_id;
                    delete next.invoiceId;
                    delete next.invoice_id;
                    delete next.technicianId;
                    delete next.technician_id;
                    delete next.vehicleId;
                    delete next.vehicle_id;
                    delete next.productId;
                    delete next.product_id;
                    delete next.serviceId;
                    delete next.service_id;
                    delete next.salesOrderItemId;
                    delete next.sales_order_item_id;
                    return next;
                };
                setDetailRows(rows.map(stripIds));
            } catch (error) {
                setDetailsError(error?.message || t('err.loadDetails'));
                setDetailRows([]);
                detailAnchorRef.current = null;
            } finally {
                setDetailsLoading(false);
            }
        },
        [hasWorkshop, selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal, byProductTechnicianId, t],
    );

    loadDetailsRef.current = loadDetails;

    const norm = useMemo(() => {
        if (!reportData || typeof reportData !== 'object') return null;
        const r = reportData;
        const fo = r.financialOverview ?? {};
        const inv = r.inventoryValuation ?? {};

        const totalRevenue = toNumber(r.total_revenue ?? fo.totalRevenue);
        const revenueChangePercent = toNumber(r.revenue_change_percent ?? fo.revenueChangePercent);
        const stockValueCost = toNumber(r.stock_value_cost ?? inv.stockValueCost);
        const potentialProfit = toNumber(r.potential_profit ?? inv.potentialProfit);
        const activeSkus = toNumber(r.active_skus ?? inv.activeSkus);

        const dailyRaw = parseArr(r.daily_revenue).length ? r.daily_revenue : fo.dailyRevenue;
        const dailyRevenue = parseArr(dailyRaw).map((e) => ({
            day: e.day_label ?? e.day ?? '',
            date: e.date ?? '',
            amount: toNumber(e.revenue ?? e.amount),
        }));

        const techRaw = parseArr(summaryData.by_technician).length
            ? summaryData.by_technician
            : parseArr(r.by_technician).length
              ? r.by_technician
              : r.operationalPerformance;
        const byTechnician = parseArr(techRaw).map((e) => ({
            id: String(e.technician_id ?? e.employeeId ?? e.id ?? ''),
            name: e.name || t('detail.fallback.unknown'),
            completedJobs: toNumber(e.completed_jobs ?? e.totalJobs ?? e.orders),
            commission: toNumber(e.commission_sar ?? e.commission),
            revenue: toNumber(e.revenue_sar ?? e.revenue),
        }));

        return {
            completedOrdersCount: toNumber(r.completed_orders_count),
            totalRevenue,
            revenueChangePercent,
            stockValueCost,
            potentialProfit,
            activeSkus,
            dailyRevenue,
            byTechnician,
            byCustomer: parseArr(summaryData.by_customer).length ? summaryData.by_customer : parseArr(r.by_customer),
            byProduct: parseArr(summaryData.by_product).length ? summaryData.by_product : parseArr(r.by_product),
            byDepartment: parseArr(summaryData.by_department).length ? summaryData.by_department : parseArr(r.by_department),
            byCategory: parseArr(summaryData.by_category).length ? summaryData.by_category : parseArr(r.by_category),
            byBranch: parseArr(summaryData.by_branch).length ? summaryData.by_branch : parseArr(r.by_branch),
            byCashier: parseArr(summaryData.by_cashier).length ? summaryData.by_cashier : parseArr(r.by_cashier),
            period: r.period ?? null,
            previousPeriod: r.previous_period ?? null,
            definitions: typeof r.definitions === 'string' ? r.definitions : '',
        };
    }, [reportData, summaryData, t]);

    const kpis = useMemo(() => {
        if (!norm) {
            return [
                { label: t('kpi.totalRevenue'), value: formatCurrency(0), color: 'text-green' },
                { label: t('kpi.revenueChange'), value: '0.0%', sub: t('kpi.vsPrevious'), color: 'text-blue' },
                { label: t('kpi.stockValue'), value: formatCurrency(0), sub: t('kpi.stockSub'), color: 'text-orange' },
                { label: t('kpi.potentialProfit'), value: formatCurrency(0), sub: t('kpi.skusWithStock', { n: 0 }), color: 'text-purple' },
            ];
        }
        const sign = norm.revenueChangePercent > 0 ? '+' : '';
        return [
            { label: t('kpi.totalRevenue'), value: formatCurrency(norm.totalRevenue), color: 'text-green' },
            {
                label: t('kpi.revenueChange'),
                value: `${sign}${norm.revenueChangePercent.toFixed(1)}%`,
                sub: t('kpi.vsPrevious'),
                color: 'text-blue',
            },
            { label: t('kpi.stockValue'), value: formatCurrency(norm.stockValueCost), sub: t('kpi.stockSub'), color: 'text-orange' },
            {
                label: t('kpi.potentialProfit'),
                value: formatCurrency(norm.potentialProfit),
                sub: t('kpi.skusWithStock', { n: norm.activeSkus }),
                color: 'text-purple',
            },
        ];
    }, [norm, t]);

    const completedOrdersDisplay = norm?.completedOrdersCount ?? 0;

    const tabs = REPORT_TABS;

    const periodLine = useMemo(() => {
        if (!norm?.period?.start_date && !norm?.period?.startDate) return null;
        const p = norm.period;
        const curStart = p.start_date ?? p.startDate;
        const curEnd = p.end_date ?? p.endDate;
        const pp = norm.previousPeriod;
        const prevStart = pp?.start_date ?? pp?.startDate;
        const prevEnd = pp?.end_date ?? pp?.endDate;
        if (!curStart || !curEnd) return null;
        const prev =
            prevStart && prevEnd
                ? t('page.periodPrev', { start: prevStart, end: prevEnd })
                : '';
        return `${t('page.period', { start: curStart, end: curEnd })}${prev}`;
    }, [norm, t]);

    const filteredDailyRevenue = useMemo(() => {
        const rows = norm?.dailyRevenue ?? [];
        const q = tabSearch.daily_sales;
        return rows.filter((d) => rowMatchesTabQuery([d.day, d.date, d.amount], q));
    }, [norm, tabSearch.daily_sales]);

    const filteredByTechnician = useMemo(() => {
        const rows = norm?.byTechnician ?? [];
        const q = tabSearch.by_technician;
        return rows.filter((t) =>
            rowMatchesTabQuery([t.name, t.id, t.completedJobs, t.revenue, t.commission], q),
        );
    }, [norm, tabSearch.by_technician]);

    const filteredByCustomer = useMemo(() => {
        const rows = norm?.byCustomer ?? [];
        const q = tabSearch.by_customer;
        return rows.filter((row) => {
            const plates = Array.isArray(row.plate_numbers ?? row.plateNumbers)
                ? (row.plate_numbers ?? row.plateNumbers).join(' ')
                : row.plate_no ?? row.plateNo ?? '';
            return rowMatchesTabQuery(
                [
                    row.customer_mobile,
                    row.customerMobile,
                    row.phone,
                    row.mobile,
                    row.customer_name,
                    row.customerName,
                    plates,
                    row.orders_count,
                    row.ordersCount,
                    row.revenue_sar,
                    row.revenueSar,
                ],
                q,
            );
        });
    }, [norm, tabSearch.by_customer]);

    const filteredByProduct = useMemo(() => {
        const rows = norm?.byProduct ?? [];
        const q = tabSearch.by_product;
        return rows.filter((row) =>
            rowMatchesTabQuery(
                [
                    row.product_name,
                    row.productName,
                    row.item_name,
                    row.product_id,
                    row.productId,
                    row.item_type,
                    row.itemType,
                    row.qty_sold,
                    row.qtySold,
                    row.revenue_sar,
                    row.revenueSar,
                ],
                q,
            ),
        );
    }, [norm, tabSearch.by_product]);

    const filteredByDepartment = useMemo(() => {
        const rows = norm?.byDepartment ?? [];
        const q = tabSearch.by_department;
        return rows.filter((row) =>
            rowMatchesTabQuery(
                [
                    row.department_name,
                    row.departmentName,
                    row.department_id,
                    row.departmentId,
                    row.orders_count,
                    row.ordersCount,
                    row.revenue_sar,
                    row.revenueSar,
                ],
                q,
            ),
        );
    }, [norm, tabSearch.by_department]);

    const filteredByCategory = useMemo(() => {
        const rows = norm?.byCategory ?? [];
        const q = tabSearch.by_category;
        return rows.filter((row) =>
            rowMatchesTabQuery(
                [
                    row.category_name,
                    row.categoryName,
                    row.category_id,
                    row.categoryId,
                    row.qty_sold,
                    row.qtySold,
                    row.orders_count,
                    row.ordersCount,
                    row.revenue_sar,
                    row.revenueSar,
                ],
                q,
            ),
        );
    }, [norm, tabSearch.by_category]);

    const filteredByBranch = useMemo(() => {
        const rows = norm?.byBranch ?? [];
        const q = tabSearch.by_branch;
        return rows.filter((row) =>
            rowMatchesTabQuery(
                [
                    row.branch_name,
                    row.branchName,
                    row.branch_id,
                    row.branchId,
                    row.completed_orders,
                    row.completedOrders,
                    row.revenue_sar,
                    row.revenueSar,
                ],
                q,
            ),
        );
    }, [norm, tabSearch.by_branch]);

    const filteredByCashier = useMemo(() => {
        const rows = norm?.byCashier ?? [];
        const q = tabSearch.by_cashier;
        return rows.filter((row) =>
            rowMatchesTabQuery(
                [
                    row.name,
                    row.cashier_id,
                    row.cashierId,
                    row.user_id,
                    row.userId,
                    row.orders_count,
                    row.ordersCount,
                    row.revenue_sar,
                    row.revenueSar,
                ],
                q,
            ),
        );
    }, [norm, tabSearch.by_cashier]);

    const ordersTotalPages = Math.max(1, Math.ceil(ordersTotal / ORDERS_PAGE_SIZE));
    const ordersRangeFrom =
        ordersTotal === 0 ? 0 : (ordersPage - 1) * ORDERS_PAGE_SIZE + 1;
    const ordersRangeTo = Math.min(ordersPage * ORDERS_PAGE_SIZE, ordersTotal);

    if (portal === 'admin' && (recentOrderDetailsLoading || recentOrderDetailsError || recentOrderDetails)) {
        return (
            <AdminModalAsScreen
                title={t('modal.orderTitle', {
                    suffix:
                        recentOrderDetails?.listingKind === 'open' || !recentOrderDetails?.invoiceNo
                            ? recentOrderDetails?.salesOrderId
                                ? t('modal.pendingSuffix', { id: recentOrderDetails.salesOrderId })
                                : t('common.details')
                            : t('modal.invoiceSuffix', { no: recentOrderDetails.invoiceNo }),
                })}
                onClose={() => {
                    recentOrderDetailsTargetRef.current = null;
                    setRecentOrderDetails(null);
                    setRecentOrderDetailsError('');
                    setRecentOrderDetailsLoading(false);
                }}
                wide
            >

                    {recentOrderDetailsLoading ? (
                        <ShimmerTextBlock lines={6} />
                    ) : recentOrderDetailsError ? (
                        <div style={{ color: '#B91C1C' }}>{recentOrderDetailsError}</div>
                    ) : recentOrderDetails ? (
                        <div className="ws-order-details-modal-body">
                            <div className="ws-report-table-wrapper">
                                <table className="ws-table">
                                    <tbody>
                                        <tr>
                                            <th>{t('modal.orderType')}</th>
                                            <td>{formatOrderSourceLabel(recentOrderDetails.orderSource, t)}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('modal.orderStatus')}</th>
                                            <td>{formatOrderStatusLabel(recentOrderDetails.orderStatus)}</td>
                                        </tr>
                                        {recentOrderDetails.invoiceNo ? (
                                            <tr>
                                                <th>{t('modal.invoiceNo')}</th>
                                                <td>{recentOrderDetails.invoiceNo}</td>
                                            </tr>
                                        ) : null}
                                        {recentOrderDetails.orderPlacedAt ? (
                                            <tr>
                                                <th>{t('modal.orderPlaced')}</th>
                                                <td>{formatReportInstant(recentOrderDetails.orderPlacedAt)}</td>
                                            </tr>
                                        ) : null}
                                        {(recentOrderDetails.listingKind === 'invoice' || recentOrderDetails.invoiceNo) ? (
                                            <tr>
                                                <th>{t('modal.invoiceDateTime')}</th>
                                                <td>{formatInvoiceDateTimeForDisplay(recentOrderDetails)}</td>
                                            </tr>
                                        ) : null}
                                        <tr><th>{t('modal.customerName')}</th><td>{recentOrderDetails.customerName ?? t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.phone')}</th><td>{recentOrderDetails.phone ?? t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.vehicleNo')}</th><td>{recentOrderDetails.vehicleNo ?? t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.departments')}</th><td>{(recentOrderDetails.departments ?? []).map((d) => d?.name).filter(Boolean).join(', ') || t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.technicians')}</th><td>{(recentOrderDetails.technicians ?? []).map((tech) => tech?.name).filter(Boolean).join(', ') || t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.totalAmount')}</th><td>SAR {toNumber(recentOrderDetails.totalAmount).toLocaleString()}</td></tr>
                                        <tr><th>{t('modal.paymentMethod')}</th><td>{recentOrderDetails.paymentMethod ?? t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.customerType')}</th><td>{recentOrderDetails.customerType ?? t('common.emDash')}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            {recentOrderDetails.orderDiscount ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('modal.orderDiscPromo')}</p>
                                    <table className="ws-table">
                                        <tbody>
                                            <tr>
                                                <th>{t('modal.orderLevelDisc')}</th>
                                                <td>{formatDiscountCell(recentOrderDetails.orderDiscount.totalDiscountType, recentOrderDetails.orderDiscount.totalDiscountValue)}</td>
                                            </tr>
                                            <tr>
                                                <th>{t('modal.promoDisc')}</th>
                                                <td>SAR {toNumber(recentOrderDetails.orderDiscount.promoDiscountAmount).toLocaleString()}</td>
                                            </tr>
                                            <tr>
                                                <th>{t('modal.promoCode')}</th>
                                                <td>{recentOrderDetails.orderDiscount.promoCode ?? t('common.emDash')}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                            {Array.isArray(recentOrderDetails.jobsDetail) && recentOrderDetails.jobsDetail.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('modal.jobs')}</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('modal.jobNo')}</th>
                                                    <th>{t('modal.department')}</th>
                                                    <th>{t('modal.jobStatus')}</th>
                                                    <th>{t('modal.opened')}</th>
                                                    <th>{t('modal.completed')}</th>
                                                    <th>{t('modal.jobDiscount')}</th>
                                                    <th>{t('modal.promo')}</th>
                                                    <th>{t('modal.beforeDisc')}</th>
                                                    <th>{t('modal.afterDisc')}</th>
                                                    <th>{t('modal.vat')}</th>
                                                    <th>{t('modal.jobTotal')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentOrderDetails.jobsDetail.map((job) => (
                                                    <tr key={job.jobId}>
                                                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{job.jobId ?? t('common.emDash')}</td>
                                                        <td>{job.departmentName ?? t('common.emDash')}</td>
                                                        <td>{formatOrderStatusLabel(job.status)}</td>
                                                        <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatReportInstant(job.createdAt)}</td>
                                                        <td style={{ fontSize: '0.8125rem' }}>{formatJobCompletedDisplay(job, t)}</td>
                                                        <td>{formatDiscountCell(job.totalDiscountType, job.totalDiscountValue)}</td>
                                                        <td>SAR {toNumber(job.promoDiscountAmount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.amountBeforeDiscount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.amountAfterDiscount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.vatAmount).toLocaleString()}</td>
                                                        <td className="ws-font-bold">SAR {toNumber(job.totalAmount).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                            {Array.isArray(recentOrderDetails.lineItems) && recentOrderDetails.lineItems.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('modal.lineItems')}</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('modal.jobNo')}</th>
                                                    <th>{t('modal.dept')}</th>
                                                    <th>{t('modal.item')}</th>
                                                    <th>{t('modal.type')}</th>
                                                    <th>{t('modal.qty')}</th>
                                                    <th>{t('modal.unitSar')}</th>
                                                    <th>{t('modal.discount')}</th>
                                                    <th>{t('modal.vat')}</th>
                                                    <th>{t('modal.lineSar')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentOrderDetails.lineItems.map((row) => (
                                                    <tr key={row.salesOrderItemId}>
                                                        <td>{row.jobId ?? t('common.emDash')}</td>
                                                        <td>{row.departmentName ?? t('common.emDash')}</td>
                                                        <td>{row.name ?? t('common.emDash')}</td>
                                                        <td>{row.itemType ?? t('common.emDash')}</td>
                                                        <td>{row.qty}</td>
                                                        <td>{toNumber(row.unitPrice).toLocaleString()}</td>
                                                        <td>{formatDiscountCell(row.discountType, row.discountValue)}</td>
                                                        <td style={{ fontSize: '0.8125rem' }}>{toNumber(row.vatPercent)}% · {String(row.vatMode ?? t('common.emDash'))}</td>
                                                        <td className="ws-font-bold">{toNumber(row.lineTotal).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
            </AdminModalAsScreen>
        );
    }

    if (portal === 'admin' && (detailsLoading || detailsError || detailRows.length > 0)) {
        return (
            <AdminModalAsScreen
                title={detailsTitle || t('common.details')}
                onClose={() => {
                    detailAnchorRef.current = null;
                    setDetailRows([]);
                    setDetailsError('');
                    setDetailsTitle('');
                    setSelectedDetailKey('');
                }}
                wide
            >

                    {detailsLoading ? (
                        <ShimmerTable rows={8} columns={6} />
                    ) : detailsError ? (
                        <div style={{ padding: 8, color: '#B91C1C' }}>{detailsError}</div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12, maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' }}>
                            {(() => {
                                const hiddenCols = new Set([
                                    'jobId', 'job_id',
                                    'departmentId', 'department_id',
                                    'branchId', 'branch_id',
                                    'customerId', 'customer_id',
                                    'issuedAt', 'issued_at',
                                ]);
                                const columns = Object.keys(detailRows[0] || {}).filter((k) => !hiddenCols.has(k));
                                return (
                                    <>
                                        <div
                                            className="ws-report-table-wrapper"
                                            ref={topScrollRef}
                                            onScroll={handleTopScroll}
                                            style={{ overflowX: 'auto', overflowY: 'hidden' }}
                                        >
                                            <div style={{ width: detailTableWidth, height: 1 }} />
                                        </div>
                                        <div
                                            className="ws-report-table-wrapper"
                                            ref={bottomScrollRef}
                                            onScroll={handleBottomScroll}
                                            style={{ overflowX: 'auto', overflowY: 'hidden' }}
                                        >
                                            <table className="ws-table" style={{ minWidth: 'max-content', width: '100%' }}>
                                                <thead>
                                                    <tr>
                                                        {columns.map((k) => (
                                                            <th key={k} style={{ padding: '8px 10px' }}>
                                                                {isInvoiceDateDetailColumnKey(k)
                                                                    ? t('detail.col.dateTime')
                                                                    : isMoneyDetailColumnKey(k)
                                                                      ? t('detail.col.sarSuffix', { label: humanizeKey(k) })
                                                                      : humanizeKey(k)}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detailRows.map((row, i) => (
                                                        <tr key={i}>
                                                            {columns.map((k) => {
                                                                const val = row?.[k];
                                                                return (
                                                                    <td key={k} style={{ padding: '10px' }}>
                                                                        {Array.isArray(val) ? (
                                                                            val.length === 0 ? (
                                                                                '[]'
                                                                            ) : val.every((item) => item && typeof item === 'object') ? (
                                                                                <div style={{ display: 'grid', gap: 6, minWidth: 220 }}>
                                                                                    {val.map((item, idx) => (
                                                                                        <div
                                                                                            key={item.salesOrderItemId ?? idx}
                                                                                            style={{
                                                                                                padding: '6px 8px',
                                                                                                border: '1px solid #E5E7EB',
                                                                                                borderRadius: 8,
                                                                                                background: '#F8FAFC',
                                                                                            }}
                                                                                        >
                                                                                            <div style={{ fontWeight: 700, fontSize: 12 }}>
                                                                                                {item.itemName ?? item.name ?? t('detail.itemN', { n: idx + 1 })}
                                                                                            </div>
                                                                                            {(() => {
                                                                                                const sub = formatLineItemSubtext(item, t);
                                                                                                return (
                                                                                                    <>
                                                                                                        <div style={{ fontSize: 11, color: '#6B7280' }}>{sub.line1}</div>
                                                                                                        <div style={{ fontSize: 11, color: '#6B7280' }}>{sub.line2}</div>
                                                                                                    </>
                                                                                                );
                                                                                            })()}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                val.join(', ')
                                                                            )
                                                                        ) : isMoneyDetailColumnKey(k) ? (
                                                                            formatCurrency(val)
                                                                        ) : isInvoiceDateDetailColumnKey(k) ? (
                                                                            formatInvoiceDateTimeForDisplay(row)
                                                                        ) : val == null || val === '' ? (
                                                                            t('common.emDash')
                                                                        ) : (
                                                                            String(val)
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
            </AdminModalAsScreen>
        );
    }

    return (
        <div className="ws-reports-page">
            <div className="ws-reports-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">
                        {t('page.subWorkshop')} · <strong>{workshopLabel}</strong> · {t('page.subScope')} · <strong>{branchLabel}</strong>
                    </p>
                    {periodLine && (
                        <p className="ws-text-dim" style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
                            {periodLine}
                        </p>
                    )}
                </div>
                <div className="ws-online-badge">
                    <div className="ws-online-dot" /> {t('page.online')}
                </div>
            </div>

            <div className="ws-reports-filters">
                <div className="ws-filter-group" style={{ flexWrap: 'wrap' }}>
                    <select
                        className="ws-report-tab-select"
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                        disabled={workshopOptionsLoading}
                        aria-label={t('filter.selectWorkshop')}
                    >
                        <option value="">
                            {workshopOptionsLoading ? t('filter.loadingWorkshops') : t('filter.selectWorkshop')}
                        </option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <select
                        className="ws-report-tab-select"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!hasWorkshop || branchOptionsLoading}
                        aria-label={t('filter.selectBranch')}
                    >
                        <option value="all">{hasWorkshop ? t('filter.allBranches') : t('filter.selectWorkshopFirst')}</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                    <div className="ws-date-input-group">
                        <input
                            type="datetime-local"
                            value={rangeFromLocal}
                            onChange={(e) => setRangeFromLocal(e.target.value)}
                            step={60}
                            aria-label={t('filter.from')}
                            disabled={!hasWorkshop}
                        />
                        <span className="ws-text-dim">{t('filter.toWord')}</span>
                        <input
                            type="datetime-local"
                            value={rangeToLocal}
                            onChange={(e) => setRangeToLocal(e.target.value)}
                            step={60}
                            aria-label={t('filter.to')}
                            disabled={!hasWorkshop}
                        />
                    </div>
                    <button
                        type="button"
                        className="ws-btn-refresh"
                        onClick={loadReports}
                        disabled={isLoading || !hasWorkshop}
                    >
                        <RefreshCw size={14} /> {isLoading ? t('filter.refreshing') : t('filter.refresh')}
                    </button>
                </div>
                <div className="ws-order-count">
                    <span>{t('filter.completedOrders', { n: completedOrdersDisplay })}</span>
                </div>
            </div>

            {!hasWorkshop ? (
                <div className="ws-section" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    {t('page.selectWorkshopPrompt')}
                </div>
            ) : null}

            {loadError && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {loadError}
                </div>
            )}

            {hasWorkshop && (
                <>
                    <div className="ws-reports-kpi-grid">
                        {kpis.map((k) => (
                            <div key={k.label} className="ws-kpi-card">
                                <p className="ws-kpi-label">{k.label}</p>
                                <h3 className={`ws-kpi-value ${k.color}`}>{k.value}</h3>
                                {k.sub && <p className="ws-kpi-sub">{k.sub}</p>}
                            </div>
                        ))}
                    </div>

                    <div className="ws-reports-tabs">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                className={`ws-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {t(tab.labelKey)}
                            </button>
                        ))}
                    </div>

                    <div className="ws-tab-content">
                        {activeTab === 'daily_sales' && (
                            <div className="ws-report-view">
                                <div className="ws-report-tab-toolbar">
                                    <input
                                        type="search"
                                        className="ws-report-tab-search"
                                        placeholder={t('search.daily')}
                                        value={tabSearch.daily_sales}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, daily_sales: e.target.value }))}
                                        aria-label={t('search.aria.daily')}
                                    />
                                    <TabSortSelect value={tabSort.daily_sales} onChange={setSortFor('daily_sales')} ariaLabel={t('sort.daily')} t={t} />
                                </div>
                                <div className="ws-chart-container">
                                    <h4 className="ws-chart-title">{t('chart.dailyRevenue')}</h4>
                                    <div style={{ width: '100%', height: 300 }}>
                                        <ResponsiveContainer>
                                            <BarChart
                                                data={filteredDailyRevenue}
                                                onClick={(chartState) => {
                                                    const p = chartState?.activePayload?.[0]?.payload;
                                                    if (p?.date) loadDetails('daily_sales', p);
                                                }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                                <XAxis
                                                    dataKey="date"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 11, fill: '#6B7280' }}
                                                    tickFormatter={(date, index) => {
                                                        const row = filteredDailyRevenue[index];
                                                        return row?.day || String(date).slice(5);
                                                    }}
                                                />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                <Tooltip
                                                    cursor={{ fill: '#F9FAFB' }}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                    labelFormatter={(date, payload) => {
                                                        const row = payload?.[0]?.payload;
                                                        const day = row?.day ? `${row.day} · ` : '';
                                                        return `${day}${date ?? ''}`;
                                                    }}
                                                    formatter={(value) => [
                                                        `SAR ${toNumber(value).toLocaleString()}`,
                                                        t('th.revenue'),
                                                    ]}
                                                />
                                                <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} style={{ cursor: 'pointer' }} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('th.day')}</th>
                                                <th>{t('th.date')}</th>
                                                <th>{t('th.revenue')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.dailyRevenue ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.daily')}
                                                    </td>
                                                </tr>
                                            ) : filteredDailyRevenue.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.noMatch')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                applyTabSort(filteredDailyRevenue, tabSort.daily_sales, (d) => d.amount).map((d, i) => (
                                                    <tr
                                                        key={`${d.date}-${i}`}
                                                        onClick={() => loadDetails('daily_sales', d)}
                                                        style={{
                                                            cursor: 'pointer',
                                                            background: selectedDetailKey === `daily_sales:${d.date}` ? '#F8FAFC' : undefined,
                                                        }}
                                                    >
                                                        <td>{d.day}</td>
                                                        <td>{d.date}</td>
                                                        <td className="ws-font-bold">SAR {d.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'by_technician' && (
                            <div className="ws-report-view">
                                <div className="ws-report-tab-toolbar">
                                    <input
                                        type="search"
                                        className="ws-report-tab-search"
                                        placeholder={t('search.technician')}
                                        value={tabSearch.by_technician}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_technician: e.target.value }))}
                                        aria-label={t('search.aria.technician')}
                                    />
                                    <TabSortSelect value={tabSort.by_technician} onChange={setSortFor('by_technician')} ariaLabel={t('sort.technician')} t={t} />
                                </div>
                                <div className="ws-chart-container">
                                    <h4 className="ws-chart-title">{t('chart.byTechnician')}</h4>
                                    <div style={{ width: '100%', height: 300 }}>
                                        <ResponsiveContainer>
                                            <BarChart data={filteredByTechnician} layout="vertical" margin={{ left: 40, right: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} width={120} />
                                                <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                <Bar dataKey="revenue" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={24} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('th.technician')}</th>
                                                <th>{t('th.completedJobs')}</th>
                                                <th>{t('th.revenue')}</th>
                                                <th>{t('th.commission')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byTechnician ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.technician')}
                                                    </td>
                                                </tr>
                                            ) : filteredByTechnician.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.noMatch')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                applyTabSort(filteredByTechnician, tabSort.by_technician, (t) => t.revenue).map((t) => (
                                                    <tr
                                                        key={t.id || t.name}
                                                        onClick={() => loadDetails('by_technician', t)}
                                                        style={{ cursor: 'pointer', background: selectedDetailKey === `by_technician:${t.id}` ? '#F8FAFC' : undefined }}
                                                    >
                                                        <td><strong>{t.name}</strong></td>
                                                        <td>{t.completedJobs}</td>
                                                        <td className="ws-font-bold">SAR {t.revenue.toLocaleString()}</td>
                                                        <td className="ws-font-bold">SAR {t.commission.toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'by_customer' && (
                            <>
                                <div className="ws-report-tab-toolbar">
                                    <input
                                        type="search"
                                        className="ws-report-tab-search"
                                        placeholder={t('search.customer')}
                                        value={tabSearch.by_customer}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_customer: e.target.value }))}
                                        aria-label={t('search.aria.customer')}
                                    />
                                    <TabSortSelect value={tabSort.by_customer} onChange={setSortFor('by_customer')} ariaLabel={t('sort.customer')} t={t} />
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('th.phone')}</th>
                                                <th>{t('th.plate')}</th>
                                                <th>{t('th.orders')}</th>
                                                <th>{t('th.revenue')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byCustomer ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.customer')}
                                                    </td>
                                                </tr>
                                            ) : filteredByCustomer.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.noMatch')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                applyTabSort(filteredByCustomer, tabSort.by_customer, (r) => r.revenue_sar ?? r.revenueSar).map((row, i) => (
                                                    <tr
                                                        key={row.customer_id ?? row.customerId ?? i}
                                                        onClick={() => loadDetails('by_customer', row)}
                                                        style={{ cursor: 'pointer', background: selectedDetailKey === `by_customer:${String(row.customer_id ?? row.customerId ?? '')}` ? '#F8FAFC' : undefined }}
                                                    >
                                                        <td>
                                                            <strong>
                                                                {row.customer_mobile ?? row.customerMobile ?? row.phone ?? row.mobile ?? '—'}
                                                            </strong>
                                                        </td>
                                                        <td>
                                                            {Array.isArray(row.plate_numbers ?? row.plateNumbers) && (row.plate_numbers ?? row.plateNumbers).length > 0
                                                                ? (row.plate_numbers ?? row.plateNumbers).join(', ')
                                                                : row.plate_no ?? row.plateNo ?? '—'}
                                                        </td>
                                                        <td>{toNumber(row.orders_count ?? row.ordersCount)}</td>
                                                        <td className="ws-font-bold">
                                                            SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {activeTab === 'by_product' && (
                            <>
                                <div className="ws-report-tab-toolbar ws-report-tab-toolbar--split">
                                    <div className="ws-report-tab-toolbar-left">
                                        <label className="ws-report-tab-field-label" htmlFor="admin-by-product-tech">
                                            {t('product.techLabel')}
                                        </label>
                                        <select
                                            id="admin-by-product-tech"
                                            className="ws-report-tab-select"
                                            value={byProductTechnicianId}
                                            onChange={handleByProductTechnicianChange}
                                            disabled={isLoading || byProductTechnicianLoading}
                                            aria-label={t('product.techAria')}
                                        >
                                            <option value="">{t('product.allTechs')}</option>
                                            {technicianOptions.map((techOpt) => (
                                                <option key={techOpt.id} value={techOpt.id}>{techOpt.name}</option>
                                            ))}
                                        </select>
                                        {byProductTechnicianLoading && (
                                            <span className="ws-text-dim ws-report-tab-inline-hint">{t('common.updating')}</span>
                                        )}
                                    </div>
                                    <input
                                        type="search"
                                        className="ws-report-tab-search"
                                        placeholder={t('search.product')}
                                        value={tabSearch.by_product}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_product: e.target.value }))}
                                        aria-label={t('search.aria.product')}
                                    />
                                    <TabSortSelect value={tabSort.by_product} onChange={setSortFor('by_product')} ariaLabel={t('sort.product')} t={t} />
                                </div>
                                {byProductTechnicianError && (
                                    <p className="ws-report-tab-inline-error" role="alert">
                                        {byProductTechnicianError}
                                    </p>
                                )}
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('th.product')}</th>
                                                <th>{t('th.type')}</th>
                                                <th>{t('th.qty')}</th>
                                                <th>{t('th.revenue')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byProduct ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.product')}
                                                    </td>
                                                </tr>
                                            ) : filteredByProduct.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.noMatch')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                applyTabSort(filteredByProduct, tabSort.by_product, (r) => r.revenue_sar ?? r.revenueSar).map((row, i) => (
                                                    <tr
                                                        key={row.product_id ?? row.productId ?? i}
                                                        onClick={() => {
                                                            if (!byProductTechnicianLoading) loadDetails('by_product', row);
                                                        }}
                                                        style={{
                                                            cursor: byProductTechnicianLoading ? 'wait' : 'pointer',
                                                            opacity: byProductTechnicianLoading ? 0.65 : undefined,
                                                            background: selectedDetailKey === `by_product:${String(row.product_id ?? row.productId ?? '')}` ? '#F8FAFC' : undefined,
                                                        }}
                                                    >
                                                        <td>
                                                            <strong>{row.product_name ?? row.productName ?? row.product_id ?? row.productId ?? '—'}</strong>
                                                        </td>
                                                        <td>{row.item_type ?? row.itemType ?? '—'}</td>
                                                        <td>{toNumber(row.qty_sold ?? row.qtySold)}</td>
                                                        <td className="ws-font-bold">
                                                            SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {activeTab === 'by_department' && (
                            <>
                                <div className="ws-report-tab-toolbar">
                                    <input
                                        type="search"
                                        className="ws-report-tab-search"
                                        placeholder={t('search.department')}
                                        value={tabSearch.by_department}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_department: e.target.value }))}
                                        aria-label={t('search.aria.department')}
                                    />
                                    <TabSortSelect value={tabSort.by_department} onChange={setSortFor('by_department')} ariaLabel={t('sort.department')} t={t} />
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('th.department')}</th>
                                                <th>{t('th.orders')}</th>
                                                <th>{t('th.revenue')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byDepartment ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.department')}
                                                    </td>
                                                </tr>
                                            ) : filteredByDepartment.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.noMatch')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                applyTabSort(filteredByDepartment, tabSort.by_department, (r) => r.revenue_sar ?? r.revenueSar).map((row, i) => (
                                                    <tr
                                                        key={row.department_id ?? row.departmentId ?? i}
                                                        onClick={() => loadDetails('by_department', row)}
                                                        style={{ cursor: 'pointer', background: selectedDetailKey === `by_department:${String(row.department_id ?? row.departmentId ?? '')}` ? '#F8FAFC' : undefined }}
                                                    >
                                                        <td><strong>{row.department_name ?? row.departmentName ?? '—'}</strong></td>
                                                        <td>{toNumber(row.orders_count ?? row.ordersCount)}</td>
                                                        <td className="ws-font-bold">
                                                            SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {activeTab === 'by_category' && (
                            <>
                                <div className="ws-report-tab-toolbar">
                                    <input
                                        type="search"
                                        className="ws-report-tab-search"
                                        placeholder={t('search.category')}
                                        value={tabSearch.by_category}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_category: e.target.value }))}
                                        aria-label={t('search.aria.category')}
                                    />
                                    <TabSortSelect value={tabSort.by_category} onChange={setSortFor('by_category')} ariaLabel={t('sort.category')} t={t} />
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('th.category')}</th>
                                                <th>{t('th.qtySold')}</th>
                                                <th>{t('th.orders')}</th>
                                                <th>{t('th.revenue')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byCategory ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.category')}
                                                    </td>
                                                </tr>
                                            ) : filteredByCategory.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.noMatch')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                applyTabSort(filteredByCategory, tabSort.by_category, (r) => r.revenue_sar ?? r.revenueSar).map((row, i) => (
                                                    <tr
                                                        key={row.category_id ?? row.categoryId ?? i}
                                                        onClick={() => loadDetails('by_category', row)}
                                                        style={{ cursor: 'pointer', background: selectedDetailKey === `by_category:${String(row.category_id ?? row.categoryId ?? '')}` ? '#F8FAFC' : undefined }}
                                                    >
                                                        <td><strong>{row.category_name ?? row.categoryName ?? '—'}</strong></td>
                                                        <td>{toNumber(row.qty_sold ?? row.qtySold)}</td>
                                                        <td>{toNumber(row.orders_count ?? row.ordersCount)}</td>
                                                        <td className="ws-font-bold">
                                                            SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {activeTab === 'by_branch' && (
                            <>
                                <div className="ws-report-tab-toolbar">
                                    <input
                                        type="search"
                                        className="ws-report-tab-search"
                                        placeholder={t('search.branch')}
                                        value={tabSearch.by_branch}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_branch: e.target.value }))}
                                        aria-label={t('search.aria.branch')}
                                    />
                                    <TabSortSelect value={tabSort.by_branch} onChange={setSortFor('by_branch')} ariaLabel={t('sort.branch')} t={t} />
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('th.branch')}</th>
                                                <th>{t('th.completedOrders')}</th>
                                                <th>{t('th.revenue')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byBranch ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.branch')}
                                                    </td>
                                                </tr>
                                            ) : filteredByBranch.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.noMatch')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                applyTabSort(filteredByBranch, tabSort.by_branch, (r) => r.revenue_sar ?? r.revenueSar).map((row, i) => (
                                                    <tr
                                                        key={row.branch_id ?? row.branchId ?? i}
                                                        onClick={() => loadDetails('by_branch', row)}
                                                        style={{ cursor: 'pointer', background: selectedDetailKey === `by_branch:${String(row.branch_id ?? row.branchId ?? '')}` ? '#F8FAFC' : undefined }}
                                                    >
                                                        <td><strong>{row.branch_name ?? row.branchName ?? '—'}</strong></td>
                                                        <td>{toNumber(row.completed_orders ?? row.completedOrders)}</td>
                                                        <td className="ws-font-bold">
                                                            SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {activeTab === 'by_cashier' && (
                            <>
                                <div className="ws-report-tab-toolbar">
                                    <input
                                        type="search"
                                        className="ws-report-tab-search"
                                        placeholder={t('search.cashier')}
                                        value={tabSearch.by_cashier}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_cashier: e.target.value }))}
                                        aria-label={t('search.aria.cashier')}
                                    />
                                    <TabSortSelect value={tabSort.by_cashier} onChange={setSortFor('by_cashier')} ariaLabel={t('sort.cashier')} t={t} />
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('th.cashier')}</th>
                                                <th>{t('th.totalOrders')}</th>
                                                <th>{t('th.totalRevenue')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byCashier ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.cashier')}
                                                    </td>
                                                </tr>
                                            ) : filteredByCashier.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.noMatch')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                applyTabSort(filteredByCashier, tabSort.by_cashier, (r) => r.revenue_sar ?? r.revenueSar).map((row, i) => {
                                                    const rowKey = String(
                                                        row.cashier_id ?? row.cashierId ?? row.user_id ?? row.userId ?? i,
                                                    );
                                                    return (
                                                        <tr
                                                            key={rowKey}
                                                            onClick={() => loadDetails('by_cashier', row)}
                                                            style={{
                                                                cursor: 'pointer',
                                                                background: selectedDetailKey === `by_cashier:${rowKey}` ? '#F8FAFC' : undefined,
                                                            }}
                                                        >
                                                            <td><strong>{row.name ?? '—'}</strong></td>
                                                            <td>{toNumber(row.orders_count ?? row.ordersCount)}</td>
                                                            <td className="ws-font-bold">
                                                                SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {activeTab === 'recent_orders' && (
                            <>
                                <div className="ws-report-tab-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <input
                                        type="search"
                                        className="ws-report-tab-search"
                                        placeholder={t('search.orders')}
                                        value={ordersSearchInput}
                                        onChange={(e) => setOrdersSearchInput(e.target.value)}
                                        aria-label={t('search.aria.orders')}
                                    />
                                    <TabSortSelect value={tabSort.recent_orders} onChange={setSortFor('recent_orders')} ariaLabel={t('sort.orders')} t={t} />
                                    <ExportMenu
                                        onPdf={() => runOrdersExport('pdf')}
                                        onExcel={() => runOrdersExport('excel')}
                                        busy={exporting}
                                        disabled={ordersListLoading || !hasWorkshop}
                                    />
                                </div>
                                {ordersListError ? (
                                    <div
                                        role="alert"
                                        style={{
                                            marginBottom: 12,
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            background: '#FEF2F2',
                                            color: '#B91C1C',
                                            fontSize: '0.875rem',
                                        }}
                                    >
                                        {ordersListError}
                                    </div>
                                ) : null}
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('th.invoiceOrder')}</th>
                                                <th>{t('th.orderType')}</th>
                                                <th>{t('th.status')}</th>
                                                <th>{t('th.dateTime')}</th>
                                                <th>{t('th.customerName')}</th>
                                                <th>{t('th.plateNo')}</th>
                                                <th>{t('th.totalSar')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ordersListLoading && recentOrders.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {t('empty.loadingOrders')}
                                                    </td>
                                                </tr>
                                            ) : ordersTotal === 0 && !ordersListLoading ? (
                                                <tr>
                                                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {ordersSearchDebounced
                                                            ? t('empty.ordersSearch')
                                                            : t('empty.orders')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                applyTabSort(recentOrders, tabSort.recent_orders, (r) => r.invoiceTotal).map((row, i) => {
                                                    const rk = recentOrderRowTarget(row) || `row-${i}`;
                                                    const isOpen = rk.startsWith('so:');
                                                    return (
                                                        <tr
                                                            key={rk}
                                                            onClick={() => openRecentOrderDetails(rk)}
                                                            style={{ cursor: 'pointer', opacity: ordersListLoading ? 0.55 : undefined }}
                                                        >
                                                            <td>
                                                                <strong>
                                                                    {isOpen ? t('orders.pendingInvoice') : (row.invoiceNo ?? t('common.emDash'))}
                                                                </strong>
                                                                {isOpen && row.salesOrderId != null ? (
                                                                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                                                        {t('orders.orderNo', { id: row.salesOrderId })}
                                                                    </span>
                                                                ) : null}
                                                            </td>
                                                            <td style={{ fontSize: '0.8125rem' }}>{formatOrderSourceLabel(row.orderSource, t)}</td>
                                                            <td style={{ fontSize: '0.8125rem' }}>{formatOrderStatusLabel(row.orderStatus)}</td>
                                                            <td>{formatInvoiceDateTimeForDisplay(row)}</td>
                                                            <td>{row.customerName ?? t('common.emDash')}</td>
                                                            <td>{row.plateNo ?? t('common.emDash')}</td>
                                                            <td className="ws-font-bold">SAR {toNumber(row.invoiceTotal).toLocaleString()}</td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {ordersTotal > 0 && (
                                    <div className="ws-report-pagination">
                                        <p className="ws-report-pagination__info">
                                            {t('orders.showing', {
                                                from: ordersRangeFrom,
                                                to: ordersRangeTo,
                                                total: ordersTotal,
                                            })}
                                            {ordersListLoading ? <span> · {t('common.loading')}</span> : null}
                                        </p>
                                        <nav className="ws-report-pagination__nav" aria-label={t('orders.pagesAria')}>
                                            <button
                                                type="button"
                                                className="ws-report-pagination__edge"
                                                disabled={ordersPage <= 1 || ordersListLoading}
                                                onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                                            >
                                                {t('orders.prev')}
                                            </button>
                                            <div className="ws-report-pagination__pages" role="group" aria-label={t('orders.pageNumsAria')}>
                                                {(() => {
                                                    const totalP = ordersTotalPages;
                                                    const cur = ordersPage;
                                                    const maxBtn = 7;
                                                    let start = Math.max(1, cur - Math.floor(maxBtn / 2));
                                                    let end = Math.min(totalP, start + maxBtn - 1);
                                                    start = Math.max(1, end - maxBtn + 1);
                                                    const nums = [];
                                                    for (let n = start; n <= end; n += 1) nums.push(n);
                                                    return nums.map((n) => (
                                                        <button
                                                            key={n}
                                                            type="button"
                                                            className={`ws-report-pagination__page${n === cur ? ' ws-report-pagination__page--active' : ''}`}
                                                            aria-current={n === cur ? 'page' : undefined}
                                                            disabled={ordersListLoading}
                                                            onClick={() => setOrdersPage(n)}
                                                        >
                                                            {n}
                                                        </button>
                                                    ));
                                                })()}
                                            </div>
                                            <button
                                                type="button"
                                                className="ws-report-pagination__edge"
                                                disabled={ordersPage >= ordersTotalPages || ordersListLoading}
                                                onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}
                                            >
                                                {t('orders.next')}
                                            </button>
                                        </nav>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            

            
            )}

            {portal !== 'admin' && (recentOrderDetailsLoading || recentOrderDetailsError || recentOrderDetails) && (
                <Modal
                    title={t('modal.orderTitle', {
                        suffix:
                            recentOrderDetails?.listingKind === 'open' || !recentOrderDetails?.invoiceNo
                                ? recentOrderDetails?.salesOrderId
                                    ? t('modal.pendingSuffix', { id: recentOrderDetails.salesOrderId })
                                    : t('common.details')
                                : t('modal.invoiceSuffix', { no: recentOrderDetails.invoiceNo }),
                    })}
                    contentClassName="ws-modal-order-details"
                    onClose={() => {
                        recentOrderDetailsTargetRef.current = null;
                        setRecentOrderDetails(null);
                        setRecentOrderDetailsError('');
                        setRecentOrderDetailsLoading(false);
                    }}
                    width="min(1100px, 98vw)"
                >
                    {recentOrderDetailsLoading ? (
                        <ShimmerTextBlock lines={6} />
                    ) : recentOrderDetailsError ? (
                        <div style={{ color: '#B91C1C' }}>{recentOrderDetailsError}</div>
                    ) : recentOrderDetails ? (
                        <div className="ws-order-details-modal-body">
                            <div className="ws-report-table-wrapper">
                                <table className="ws-table">
                                    <tbody>
                                        <tr>
                                            <th>{t('modal.orderType')}</th>
                                            <td>{formatOrderSourceLabel(recentOrderDetails.orderSource, t)}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('modal.orderStatus')}</th>
                                            <td>{formatOrderStatusLabel(recentOrderDetails.orderStatus)}</td>
                                        </tr>
                                        {recentOrderDetails.invoiceNo ? (
                                            <tr>
                                                <th>{t('modal.invoiceNo')}</th>
                                                <td>{recentOrderDetails.invoiceNo}</td>
                                            </tr>
                                        ) : null}
                                        {recentOrderDetails.orderPlacedAt ? (
                                            <tr>
                                                <th>{t('modal.orderPlaced')}</th>
                                                <td>{formatReportInstant(recentOrderDetails.orderPlacedAt)}</td>
                                            </tr>
                                        ) : null}
                                        {(recentOrderDetails.listingKind === 'invoice' || recentOrderDetails.invoiceNo) ? (
                                            <tr>
                                                <th>{t('modal.invoiceDateTime')}</th>
                                                <td>{formatInvoiceDateTimeForDisplay(recentOrderDetails)}</td>
                                            </tr>
                                        ) : null}
                                        <tr><th>{t('modal.customerName')}</th><td>{recentOrderDetails.customerName ?? t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.phone')}</th><td>{recentOrderDetails.phone ?? t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.vehicleNo')}</th><td>{recentOrderDetails.vehicleNo ?? t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.departments')}</th><td>{(recentOrderDetails.departments ?? []).map((d) => d?.name).filter(Boolean).join(', ') || t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.technicians')}</th><td>{(recentOrderDetails.technicians ?? []).map((tech) => tech?.name).filter(Boolean).join(', ') || t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.totalAmount')}</th><td>SAR {toNumber(recentOrderDetails.totalAmount).toLocaleString()}</td></tr>
                                        <tr><th>{t('modal.paymentMethod')}</th><td>{recentOrderDetails.paymentMethod ?? t('common.emDash')}</td></tr>
                                        <tr><th>{t('modal.customerType')}</th><td>{recentOrderDetails.customerType ?? t('common.emDash')}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            {recentOrderDetails.orderDiscount ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('modal.orderDiscPromo')}</p>
                                    <table className="ws-table">
                                        <tbody>
                                            <tr>
                                                <th>{t('modal.orderLevelDisc')}</th>
                                                <td>{formatDiscountCell(recentOrderDetails.orderDiscount.totalDiscountType, recentOrderDetails.orderDiscount.totalDiscountValue)}</td>
                                            </tr>
                                            <tr>
                                                <th>{t('modal.promoDisc')}</th>
                                                <td>SAR {toNumber(recentOrderDetails.orderDiscount.promoDiscountAmount).toLocaleString()}</td>
                                            </tr>
                                            <tr>
                                                <th>{t('modal.promoCode')}</th>
                                                <td>{recentOrderDetails.orderDiscount.promoCode ?? t('common.emDash')}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                            {Array.isArray(recentOrderDetails.jobsDetail) && recentOrderDetails.jobsDetail.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('modal.jobs')}</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('modal.jobNo')}</th>
                                                    <th>{t('modal.department')}</th>
                                                    <th>{t('modal.jobStatus')}</th>
                                                    <th>{t('modal.opened')}</th>
                                                    <th>{t('modal.completed')}</th>
                                                    <th>{t('modal.jobDiscount')}</th>
                                                    <th>{t('modal.promo')}</th>
                                                    <th>{t('modal.beforeDisc')}</th>
                                                    <th>{t('modal.afterDisc')}</th>
                                                    <th>{t('modal.vat')}</th>
                                                    <th>{t('modal.jobTotal')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentOrderDetails.jobsDetail.map((job) => (
                                                    <tr key={job.jobId}>
                                                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{job.jobId ?? t('common.emDash')}</td>
                                                        <td>{job.departmentName ?? t('common.emDash')}</td>
                                                        <td>{formatOrderStatusLabel(job.status)}</td>
                                                        <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatReportInstant(job.createdAt)}</td>
                                                        <td style={{ fontSize: '0.8125rem' }}>{formatJobCompletedDisplay(job, t)}</td>
                                                        <td>{formatDiscountCell(job.totalDiscountType, job.totalDiscountValue)}</td>
                                                        <td>SAR {toNumber(job.promoDiscountAmount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.amountBeforeDiscount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.amountAfterDiscount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.vatAmount).toLocaleString()}</td>
                                                        <td className="ws-font-bold">SAR {toNumber(job.totalAmount).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                            {Array.isArray(recentOrderDetails.lineItems) && recentOrderDetails.lineItems.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('modal.lineItems')}</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('modal.jobNo')}</th>
                                                    <th>{t('modal.dept')}</th>
                                                    <th>{t('modal.item')}</th>
                                                    <th>{t('modal.type')}</th>
                                                    <th>{t('modal.qty')}</th>
                                                    <th>{t('modal.unitSar')}</th>
                                                    <th>{t('modal.discount')}</th>
                                                    <th>{t('modal.vat')}</th>
                                                    <th>{t('modal.lineSar')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentOrderDetails.lineItems.map((row) => (
                                                    <tr key={row.salesOrderItemId}>
                                                        <td>{row.jobId ?? t('common.emDash')}</td>
                                                        <td>{row.departmentName ?? t('common.emDash')}</td>
                                                        <td>{row.name ?? t('common.emDash')}</td>
                                                        <td>{row.itemType ?? t('common.emDash')}</td>
                                                        <td>{row.qty}</td>
                                                        <td>{toNumber(row.unitPrice).toLocaleString()}</td>
                                                        <td>{formatDiscountCell(row.discountType, row.discountValue)}</td>
                                                        <td style={{ fontSize: '0.8125rem' }}>{toNumber(row.vatPercent)}% · {String(row.vatMode ?? t('common.emDash'))}</td>
                                                        <td className="ws-font-bold">{toNumber(row.lineTotal).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </Modal>
            )}

            {portal !== 'admin' && (detailsLoading || detailsError || detailRows.length > 0) && (
                <Modal
                    title={detailsTitle || t('common.details')}
                    onClose={() => {
                        detailAnchorRef.current = null;
                        setDetailRows([]);
                        setDetailsError('');
                        setDetailsTitle('');
                        setSelectedDetailKey('');
                    }}
                    width="min(1620px, 98vw)"
                >
                    {detailsLoading ? (
                        <ShimmerTable rows={8} columns={6} />
                    ) : detailsError ? (
                        <div style={{ padding: 8, color: '#B91C1C' }}>{detailsError}</div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12, maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' }}>
                            {(() => {
                                const hiddenCols = new Set([
                                    'jobId', 'job_id',
                                    'departmentId', 'department_id',
                                    'branchId', 'branch_id',
                                    'customerId', 'customer_id',
                                    'issuedAt', 'issued_at',
                                ]);
                                const columns = Object.keys(detailRows[0] || {}).filter((k) => !hiddenCols.has(k));
                                return (
                                    <>
                                        <div
                                            className="ws-report-table-wrapper"
                                            ref={topScrollRef}
                                            onScroll={handleTopScroll}
                                            style={{ overflowX: 'auto', overflowY: 'hidden' }}
                                        >
                                            <div style={{ width: detailTableWidth, height: 1 }} />
                                        </div>
                                        <div
                                            className="ws-report-table-wrapper"
                                            ref={bottomScrollRef}
                                            onScroll={handleBottomScroll}
                                            style={{ overflowX: 'auto', overflowY: 'hidden' }}
                                        >
                                            <table className="ws-table" style={{ minWidth: 'max-content', width: '100%' }}>
                                                <thead>
                                                    <tr>
                                                        {columns.map((k) => (
                                                            <th key={k} style={{ padding: '8px 10px' }}>
                                                                {isInvoiceDateDetailColumnKey(k)
                                                                    ? t('detail.col.dateTime')
                                                                    : isMoneyDetailColumnKey(k)
                                                                      ? t('detail.col.sarSuffix', { label: humanizeKey(k) })
                                                                      : humanizeKey(k)}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detailRows.map((row, i) => (
                                                        <tr key={i}>
                                                            {columns.map((k) => {
                                                                const val = row?.[k];
                                                                return (
                                                                    <td key={k} style={{ padding: '10px' }}>
                                                                        {Array.isArray(val) ? (
                                                                            val.length === 0 ? (
                                                                                '[]'
                                                                            ) : val.every((item) => item && typeof item === 'object') ? (
                                                                                <div style={{ display: 'grid', gap: 6, minWidth: 220 }}>
                                                                                    {val.map((item, idx) => (
                                                                                        <div
                                                                                            key={item.salesOrderItemId ?? idx}
                                                                                            style={{
                                                                                                padding: '6px 8px',
                                                                                                border: '1px solid #E5E7EB',
                                                                                                borderRadius: 8,
                                                                                                background: '#F8FAFC',
                                                                                            }}
                                                                                        >
                                                                                            <div style={{ fontWeight: 700, fontSize: 12 }}>
                                                                                                {item.itemName ?? item.name ?? t('detail.itemN', { n: idx + 1 })}
                                                                                            </div>
                                                                                            {(() => {
                                                                                                const sub = formatLineItemSubtext(item, t);
                                                                                                return (
                                                                                                    <>
                                                                                                        <div style={{ fontSize: 11, color: '#6B7280' }}>{sub.line1}</div>
                                                                                                        <div style={{ fontSize: 11, color: '#6B7280' }}>{sub.line2}</div>
                                                                                                    </>
                                                                                                );
                                                                                            })()}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                val.join(', ')
                                                                            )
                                                                        ) : isMoneyDetailColumnKey(k) ? (
                                                                            formatCurrency(val)
                                                                        ) : isInvoiceDateDetailColumnKey(k) ? (
                                                                            formatInvoiceDateTimeForDisplay(row)
                                                                        ) : val == null || val === '' ? (
                                                                            t('common.emDash')
                                                                        ) : (
                                                                            String(val)
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}
