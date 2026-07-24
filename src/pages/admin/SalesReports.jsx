import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from '../../components/Modal';
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
import '../workshop/Workshop.css';

const EXPORT_LIMIT = 5000;

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

function formatOrderSourceLabel(source) {
    const s = String(source ?? '').trim().toLowerCase();
    if (s === 'walk_in') return 'Walk-in';
    if (s === 'walk_in_corporate') return 'Corporate walk-in';
    if (s === 'takeaway') return 'Takeaway';
    if (!s) return '—';
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

function rangeToApiIso(rangeFromLocal, rangeToLocal) {
    const s = new Date(rangeFromLocal);
    const e = new Date(rangeToLocal);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
        throw new Error('Invalid date/time range.');
    }
    if (s.getTime() > e.getTime()) {
        throw new Error('Start must be on or before end.');
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

function formatLineItemSubtext(item) {
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
                ? `Discount ${dVal}%`
                : `Discount SAR ${dVal.toLocaleString()}`
            : 'Discount —';
    const line1 = `${item.itemType ?? item.item_type ?? 'item'} · Qty ${qty ?? '—'} · Unit SAR ${unit.toLocaleString()}`;
    const line2 = `${disc} · VAT ${Number.isFinite(vatPct) && vatPct > 0 ? `${vatPct}%` : '—'}${vatMode ? ` (${vatMode})` : ''} · Line SAR ${line.toLocaleString()}`;
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
function buildRecentOrdersExportRows(rows) {
    const headers = ['Invoice No', 'Order #', 'Type', 'Status', 'Date / Time', 'Customer', 'Plate No', 'Total (SAR)'];
    const out = (rows || []).map((row) => [
        row.invoiceNo ?? (row.salesOrderId != null ? 'Pending invoice' : '—'),
        row.salesOrderId ?? '—',
        formatOrderSourceLabel(row.orderSource),
        formatOrderStatusLabel(row.orderStatus),
        formatInvoiceDateTimeForDisplay(row),
        row.customerName ?? '—',
        row.plateNo ?? '—',
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

function formatJobCompletedDisplay(job) {
    if (!job) return '—';
    if (job.completedAt) return formatReportInstant(job.completedAt);
    const st = String(job.status ?? '').toLowerCase();
    if (st === 'edited') return '— (reopened for edit)';
    return '—';
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

function TabSortSelect({ value, onChange, ariaLabel = 'Sort by amount' }) {
    return (
        <select
            className="ws-report-tab-search"
            style={{ maxWidth: 170, minWidth: 140 }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={ariaLabel}
        >
            <option value="default">Sort: Default</option>
            <option value="asc">Low → High</option>
            <option value="desc">High → Low</option>
        </select>
    );
}

const ORDERS_PAGE_SIZE = 25;

export default function SalesReports({ portal = 'admin' }) {
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
                        list.map((w) => ({ id: String(w.id), name: String(w.name || '').trim() || 'Workshop' })),
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
                        list.map((b) => ({ id: String(b.id), name: String(b.name || '').trim() || 'Branch' })),
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
        if (!hasWorkshop) return 'Select workshop';
        return workshopOptions.find((w) => w.id === String(selectedWorkshopId))?.name || 'Workshop';
    }, [hasWorkshop, selectedWorkshopId, workshopOptions]);

    const branchLabel = useMemo(() => {
        if (!hasWorkshop) return '—';
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branchOptions.find((b) => b.id === String(selectedBranchId))?.name || 'Branch';
    }, [hasWorkshop, selectedBranchId, branchOptions]);

    const fetchRecentOrdersList = useCallback(async () => {
        if (!hasWorkshop) return;
        setOrdersListLoading(true);
        setOrdersListError('');
        try {
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
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
            setOrdersListError(e?.message || 'Could not load orders for this range.');
        } finally {
            setOrdersListLoading(false);
        }
    }, [hasWorkshop, selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal, ordersPage, ordersSearchDebounced]);

    const fetchRecentOrdersListRef = useRef(fetchRecentOrdersList);
    fetchRecentOrdersListRef.current = fetchRecentOrdersList;

    // Export the FULL recent-orders list for the current scope + date range.
    const runOrdersExport = useCallback(async (kind) => {
        if (!hasWorkshop) {
            setOrdersListError('Select a workshop first to export its orders.');
            return;
        }
        setExporting(true);
        setOrdersListError('');
        try {
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
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
            const { headers, rows } = buildRecentOrdersExportRows(list);
            const subtitle = `${rows.length} order(s) · ${rangeFromLocal || '…'} → ${rangeToLocal || '…'}`;
            if (kind === 'pdf') {
                exportRowsToPdf({ title: 'Sales Reports — Orders', subtitle, headers, rows, filenameBase: 'sales-reports-orders' });
            } else {
                exportRowsToExcel({ sheetName: 'Orders', headers, rows, filenameBase: 'sales-reports-orders' });
            }
        } catch (e) {
            setOrdersListError(e?.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    }, [hasWorkshop, selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal, ordersSearchDebounced]);

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
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
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
                throw new Error('Invalid reports response.');
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
                .map((t) => ({
                    id: String(t?.id ?? t?.employeeId ?? ''),
                    name: String(t?.name ?? '').trim() || 'Technician',
                }))
                .filter((t) => t.id);
            opts.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            setTechnicianOptions(opts);
        } catch (error) {
            setLoadError(error.message || 'Failed to load reports analytics.');
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
    }, [hasWorkshop, selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal]);

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
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
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
                setByProductTechnicianError(err?.message || 'Failed to load product sales for this technician.');
            } finally {
                setByProductTechnicianLoading(false);
            }
        },
        [refetchByProductForTechnician],
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
        const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
        const params = adminSalesReportsParams(selectedWorkshopId, selectedBranchId, {
            startDate,
            endDate,
        });
        const t = String(target ?? '');
        if (t.startsWith('so:')) {
            return await getAdminSalesRecentOpenOrderDetails(t.slice(3), params);
        }
        const invId = t.startsWith('inv:') ? t.slice(4) : t;
        return await getAdminSalesRecentOrderDetails(invId, params);
    }, [selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal]);

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
            setRecentOrderDetailsError(error?.message || 'Failed to load order details.');
            setRecentOrderDetails(null);
        } finally {
            setRecentOrderDetailsLoading(false);
        }
    }, [fetchRecentOrderDetails]);

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
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
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
                title = `Technician details: ${row.name || 'Technician'}`;
            } else if (tabId === 'by_customer') {
                fetcher = getAdminSalesByCustomerDetails;
                key = String(row.customer_id ?? row.customerId ?? '');
                title = `Customer details: ${row.customer_name ?? row.customerName ?? 'Customer'}`;
            } else if (tabId === 'by_product') {
                fetcher = getAdminSalesByProductDetails;
                key = String(row.product_id ?? row.productId ?? '');
                title = `Product details: ${row.product_name ?? row.productName ?? row.item_name ?? 'Item'}`;
            } else if (tabId === 'by_department') {
                fetcher = getAdminSalesByDepartmentDetails;
                key = String(row.department_id ?? row.departmentId ?? '');
                title = `Department details: ${row.department_name ?? row.departmentName ?? 'Department'}`;
            } else if (tabId === 'by_category') {
                fetcher = getAdminSalesByCategoryDetails;
                key = String(row.category_id ?? row.categoryId ?? '');
                title = `Category details: ${row.category_name ?? row.categoryName ?? 'Category'}`;
            } else if (tabId === 'by_branch') {
                fetcher = getAdminSalesByBranchDetails;
                key = String(row.branch_id ?? row.branchId ?? '');
                title = `Branch details: ${row.branch_name ?? row.branchName ?? 'Branch'}`;
            } else if (tabId === 'by_cashier') {
                fetcher = getAdminSalesByCashierDetails;
                key = String(row.cashier_id ?? row.cashierId ?? row.user_id ?? row.userId ?? '');
                title = `Cashier details: ${row.name ?? 'Cashier'}`;
            } else if (tabId === 'daily_sales') {
                fetcher = getAdminSalesDailyDetails;
                key = String(row.date ?? '').trim();
                title = `Daily sales · ${row.day ? `${row.day} · ` : ''}${key}`;
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
                setDetailsError(error?.message || 'Failed to load details.');
                setDetailRows([]);
                detailAnchorRef.current = null;
            } finally {
                setDetailsLoading(false);
            }
        },
        [hasWorkshop, selectedWorkshopId, selectedBranchId, rangeFromLocal, rangeToLocal, byProductTechnicianId],
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
            name: e.name || 'Unknown',
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
    }, [reportData, summaryData]);

    const kpis = useMemo(() => {
        if (!norm) {
            return [
                { label: 'Total Revenue', value: formatCurrency(0), color: 'text-green' },
                { label: 'Revenue Change', value: '0.0%', sub: 'vs previous period', color: 'text-blue' },
                { label: 'Stock Value (Cost)', value: formatCurrency(0), sub: 'At period end (est.)', color: 'text-orange' },
                { label: 'Potential Profit', value: formatCurrency(0), sub: '0 SKUs with stock', color: 'text-purple' },
            ];
        }
        const sign = norm.revenueChangePercent > 0 ? '+' : '';
        return [
            { label: 'Total Revenue', value: formatCurrency(norm.totalRevenue), color: 'text-green' },
            {
                label: 'Revenue Change',
                value: `${sign}${norm.revenueChangePercent.toFixed(1)}%`,
                sub: 'vs previous period',
                color: 'text-blue',
            },
            { label: 'Stock Value (Cost)', value: formatCurrency(norm.stockValueCost), sub: 'At period end (est.)', color: 'text-orange' },
            {
                label: 'Potential Profit',
                value: formatCurrency(norm.potentialProfit),
                sub: `${norm.activeSkus} SKUs with stock`,
                color: 'text-purple',
            },
        ];
    }, [norm]);

    const completedOrdersDisplay = norm?.completedOrdersCount ?? 0;

    const tabs = [
        { id: 'recent_orders', label: 'Orders' },
        { id: 'daily_sales', label: 'Daily Sales' },
        { id: 'by_technician', label: 'By Technician' },
        { id: 'by_customer', label: 'By Customer' },
        { id: 'by_product', label: 'By Product' },
        { id: 'by_department', label: 'By Department' },
        { id: 'by_category', label: 'By Categories' },
        { id: 'by_branch', label: 'By Branch' },
        { id: 'by_cashier', label: 'By Cashier' },
    ];

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
                ? ` · Previous: ${prevStart} → ${prevEnd}`
                : '';
        return `Period: ${curStart} → ${curEnd}${prev}`;
    }, [norm]);

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

    return (
        <div className="ws-reports-page">
            <div className="ws-reports-header">
                <div>
                    <h2 className="ws-page-title">Sales Reports</h2>
                    <p className="ws-page-sub">
                        Workshop · <strong>{workshopLabel}</strong> · Scope · <strong>{branchLabel}</strong>
                    </p>
                    {periodLine && (
                        <p className="ws-text-dim" style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
                            {periodLine}
                        </p>
                    )}
                </div>
                <div className="ws-online-badge">
                    <div className="ws-online-dot" /> Online
                </div>
            </div>

            <div className="ws-reports-filters">
                <div className="ws-filter-group" style={{ flexWrap: 'wrap' }}>
                    <select
                        className="ws-report-tab-select"
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                        disabled={workshopOptionsLoading}
                        aria-label="Select workshop"
                    >
                        <option value="">
                            {workshopOptionsLoading ? 'Loading workshops…' : 'Select workshop'}
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
                        aria-label="Select branch"
                    >
                        <option value="all">{hasWorkshop ? 'All branches' : 'Select workshop first'}</option>
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
                            aria-label="From date and time"
                            disabled={!hasWorkshop}
                        />
                        <span className="ws-text-dim">to</span>
                        <input
                            type="datetime-local"
                            value={rangeToLocal}
                            onChange={(e) => setRangeToLocal(e.target.value)}
                            step={60}
                            aria-label="To date and time"
                            disabled={!hasWorkshop}
                        />
                    </div>
                    <button
                        type="button"
                        className="ws-btn-refresh"
                        onClick={loadReports}
                        disabled={isLoading || !hasWorkshop}
                    >
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
                <div className="ws-order-count">
                    <span>{completedOrdersDisplay} completed orders</span>
                </div>
            </div>

            {!hasWorkshop ? (
                <div className="ws-section" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Select a workshop above to view sales reports.
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
                                {tab.label}
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
                                        placeholder="Search day, date, amount…"
                                        value={tabSearch.daily_sales}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, daily_sales: e.target.value }))}
                                        aria-label="Search daily sales"
                                    />
                                    <TabSortSelect value={tabSort.daily_sales} onChange={setSortFor('daily_sales')} ariaLabel="Sort daily revenue" />
                                </div>
                                <div className="ws-chart-container">
                                    <h4 className="ws-chart-title">Daily Revenue</h4>
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
                                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} style={{ cursor: 'pointer' }} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>DAY</th>
                                                <th>DATE</th>
                                                <th>REVENUE (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.dailyRevenue ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No daily revenue data
                                                    </td>
                                                </tr>
                                            ) : filteredDailyRevenue.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No rows match your search.
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
                                        placeholder="Search technician, jobs, revenue…"
                                        value={tabSearch.by_technician}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_technician: e.target.value }))}
                                        aria-label="Search by technician"
                                    />
                                    <TabSortSelect value={tabSort.by_technician} onChange={setSortFor('by_technician')} ariaLabel="Sort technicians by revenue" />
                                </div>
                                <div className="ws-chart-container">
                                    <h4 className="ws-chart-title">Revenue by Technician</h4>
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
                                                <th>TECHNICIAN</th>
                                                <th>COMPLETED JOBS</th>
                                                <th>REVENUE (SAR)</th>
                                                <th>COMMISSION (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byTechnician ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No technician performance data
                                                    </td>
                                                </tr>
                                            ) : filteredByTechnician.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No rows match your search.
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
                                        placeholder="Search phone, plate, orders, revenue…"
                                        value={tabSearch.by_customer}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_customer: e.target.value }))}
                                        aria-label="Search by customer"
                                    />
                                    <TabSortSelect value={tabSort.by_customer} onChange={setSortFor('by_customer')} ariaLabel="Sort customers by revenue" />
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>PHONE NUMBER</th>
                                                <th>PLATE NUMBER</th>
                                                <th>ORDERS</th>
                                                <th>REVENUE (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byCustomer ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No customer breakdown for this scope.
                                                    </td>
                                                </tr>
                                            ) : filteredByCustomer.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No rows match your search.
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
                                            Technician
                                        </label>
                                        <select
                                            id="admin-by-product-tech"
                                            className="ws-report-tab-select"
                                            value={byProductTechnicianId}
                                            onChange={handleByProductTechnicianChange}
                                            disabled={isLoading || byProductTechnicianLoading}
                                            aria-label="Filter product sales by technician"
                                        >
                                            <option value="">All technicians</option>
                                            {technicianOptions.map((t) => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                        {byProductTechnicianLoading && (
                                            <span className="ws-text-dim ws-report-tab-inline-hint">Updating…</span>
                                        )}
                                    </div>
                                    <input
                                        type="search"
                                        className="ws-report-tab-search"
                                        placeholder="Search product, type, qty, revenue…"
                                        value={tabSearch.by_product}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_product: e.target.value }))}
                                        aria-label="Search by product"
                                    />
                                    <TabSortSelect value={tabSort.by_product} onChange={setSortFor('by_product')} ariaLabel="Sort products by revenue" />
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
                                                <th>PRODUCT / SERVICE</th>
                                                <th>TYPE</th>
                                                <th>QTY</th>
                                                <th>REVENUE (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byProduct ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No product breakdown for this scope.
                                                    </td>
                                                </tr>
                                            ) : filteredByProduct.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No rows match your search.
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
                                        placeholder="Search department, orders, revenue…"
                                        value={tabSearch.by_department}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_department: e.target.value }))}
                                        aria-label="Search by department"
                                    />
                                    <TabSortSelect value={tabSort.by_department} onChange={setSortFor('by_department')} ariaLabel="Sort departments by revenue" />
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>DEPARTMENT</th>
                                                <th>ORDERS</th>
                                                <th>REVENUE (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byDepartment ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No department breakdown for this scope.
                                                    </td>
                                                </tr>
                                            ) : filteredByDepartment.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No rows match your search.
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
                                        placeholder="Search category, qty, orders, revenue…"
                                        value={tabSearch.by_category}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_category: e.target.value }))}
                                        aria-label="Search by category"
                                    />
                                    <TabSortSelect value={tabSort.by_category} onChange={setSortFor('by_category')} ariaLabel="Sort categories by revenue" />
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>CATEGORY</th>
                                                <th>QTY SOLD</th>
                                                <th>ORDERS</th>
                                                <th>REVENUE (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byCategory ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No category breakdown for this scope.
                                                    </td>
                                                </tr>
                                            ) : filteredByCategory.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No rows match your search.
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
                                        placeholder="Search branch, orders, revenue…"
                                        value={tabSearch.by_branch}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_branch: e.target.value }))}
                                        aria-label="Search by branch"
                                    />
                                    <TabSortSelect value={tabSort.by_branch} onChange={setSortFor('by_branch')} ariaLabel="Sort branches by revenue" />
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>BRANCH</th>
                                                <th>COMPLETED ORDERS</th>
                                                <th>REVENUE (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byBranch ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No branch breakdown (select “All branches” for cross-branch).
                                                    </td>
                                                </tr>
                                            ) : filteredByBranch.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No rows match your search.
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
                                        placeholder="Search cashier, orders, revenue…"
                                        value={tabSearch.by_cashier}
                                        onChange={(e) => setTabSearch((p) => ({ ...p, by_cashier: e.target.value }))}
                                        aria-label="Search by cashier"
                                    />
                                    <TabSortSelect value={tabSort.by_cashier} onChange={setSortFor('by_cashier')} ariaLabel="Sort cashiers by revenue" />
                                </div>
                                <div className="ws-report-table-wrapper">
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>CASHIER</th>
                                                <th>TOTAL ORDERS</th>
                                                <th>TOTAL REVENUE (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(norm?.byCashier ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No cashier sales in this scope.
                                                    </td>
                                                </tr>
                                            ) : filteredByCashier.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        No rows match your search.
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
                                        placeholder="Search invoice no., order id, customer, plate…"
                                        value={ordersSearchInput}
                                        onChange={(e) => setOrdersSearchInput(e.target.value)}
                                        aria-label="Search orders"
                                    />
                                    <TabSortSelect value={tabSort.recent_orders} onChange={setSortFor('recent_orders')} ariaLabel="Sort orders by total" />
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
                                                <th>INVOICE / ORDER</th>
                                                <th>TYPE</th>
                                                <th>STATUS</th>
                                                <th>DATE / TIME</th>
                                                <th>CUSTOMER NAME</th>
                                                <th>PLATE NO</th>
                                                <th>TOTAL (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ordersListLoading && recentOrders.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        Loading orders…
                                                    </td>
                                                </tr>
                                            ) : ordersTotal === 0 && !ordersListLoading ? (
                                                <tr>
                                                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                        {ordersSearchDebounced
                                                            ? 'No orders match your search in this date range.'
                                                            : 'No orders in this scope.'}
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
                                                                    {isOpen ? 'Pending invoice' : (row.invoiceNo ?? '—')}
                                                                </strong>
                                                                {isOpen && row.salesOrderId != null ? (
                                                                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                                                        Order #{row.salesOrderId}
                                                                    </span>
                                                                ) : null}
                                                            </td>
                                                            <td style={{ fontSize: '0.8125rem' }}>{formatOrderSourceLabel(row.orderSource)}</td>
                                                            <td style={{ fontSize: '0.8125rem' }}>{formatOrderStatusLabel(row.orderStatus)}</td>
                                                            <td>{formatInvoiceDateTimeForDisplay(row)}</td>
                                                            <td>{row.customerName ?? '—'}</td>
                                                            <td>{row.plateNo ?? '—'}</td>
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
                                            Showing <strong>{ordersRangeFrom}</strong>–<strong>{ordersRangeTo}</strong> of{' '}
                                            <strong>{ordersTotal}</strong>
                                            {ordersListLoading ? <span> · Loading…</span> : null}
                                        </p>
                                        <nav className="ws-report-pagination__nav" aria-label="Orders list pages">
                                            <button
                                                type="button"
                                                className="ws-report-pagination__edge"
                                                disabled={ordersPage <= 1 || ordersListLoading}
                                                onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                                            >
                                                Previous
                                            </button>
                                            <div className="ws-report-pagination__pages" role="group" aria-label="Page numbers">
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
                                                Next
                                            </button>
                                        </nav>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            {(recentOrderDetailsLoading || recentOrderDetailsError || recentOrderDetails) && (
                <Modal
                    title={`Order ${
                        recentOrderDetails?.listingKind === 'open' || !recentOrderDetails?.invoiceNo
                            ? recentOrderDetails?.salesOrderId
                                ? `(pending invoice · #${recentOrderDetails.salesOrderId})`
                                : 'Details'
                            : `- ${recentOrderDetails.invoiceNo}`
                    }`}
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
                                            <th>ORDER TYPE</th>
                                            <td>{formatOrderSourceLabel(recentOrderDetails.orderSource)}</td>
                                        </tr>
                                        <tr>
                                            <th>ORDER STATUS</th>
                                            <td>{formatOrderStatusLabel(recentOrderDetails.orderStatus)}</td>
                                        </tr>
                                        {recentOrderDetails.invoiceNo ? (
                                            <tr>
                                                <th>INVOICE NO</th>
                                                <td>{recentOrderDetails.invoiceNo}</td>
                                            </tr>
                                        ) : null}
                                        {recentOrderDetails.orderPlacedAt ? (
                                            <tr>
                                                <th>ORDER PLACED</th>
                                                <td>{formatReportInstant(recentOrderDetails.orderPlacedAt)}</td>
                                            </tr>
                                        ) : null}
                                        {(recentOrderDetails.listingKind === 'invoice' || recentOrderDetails.invoiceNo) ? (
                                            <tr>
                                                <th>INVOICE DATE &amp; TIME</th>
                                                <td>{formatInvoiceDateTimeForDisplay(recentOrderDetails)}</td>
                                            </tr>
                                        ) : null}
                                        <tr><th>CUSTOMER NAME</th><td>{recentOrderDetails.customerName ?? '—'}</td></tr>
                                        <tr><th>PHONE</th><td>{recentOrderDetails.phone ?? '—'}</td></tr>
                                        <tr><th>VEHICLE NO</th><td>{recentOrderDetails.vehicleNo ?? '—'}</td></tr>
                                        <tr><th>DEPARTMENTS</th><td>{(recentOrderDetails.departments ?? []).map((d) => d?.name).filter(Boolean).join(', ') || '—'}</td></tr>
                                        <tr><th>TECHNICIANS</th><td>{(recentOrderDetails.technicians ?? []).map((t) => t?.name).filter(Boolean).join(', ') || '—'}</td></tr>
                                        <tr><th>TOTAL AMOUNT</th><td>SAR {toNumber(recentOrderDetails.totalAmount).toLocaleString()}</td></tr>
                                        <tr><th>PAYMENT METHOD</th><td>{recentOrderDetails.paymentMethod ?? '—'}</td></tr>
                                        <tr><th>CUSTOMER TYPE</th><td>{recentOrderDetails.customerType ?? '—'}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            {recentOrderDetails.orderDiscount ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Order discount &amp; promo</p>
                                    <table className="ws-table">
                                        <tbody>
                                            <tr>
                                                <th>Order-level discount</th>
                                                <td>{formatDiscountCell(recentOrderDetails.orderDiscount.totalDiscountType, recentOrderDetails.orderDiscount.totalDiscountValue)}</td>
                                            </tr>
                                            <tr>
                                                <th>Promo discount (order)</th>
                                                <td>SAR {toNumber(recentOrderDetails.orderDiscount.promoDiscountAmount).toLocaleString()}</td>
                                            </tr>
                                            <tr>
                                                <th>Promo code</th>
                                                <td>{recentOrderDetails.orderDiscount.promoCode ?? '—'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                            {Array.isArray(recentOrderDetails.jobsDetail) && recentOrderDetails.jobsDetail.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Jobs</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>Job #</th>
                                                    <th>Department</th>
                                                    <th>Job status</th>
                                                    <th>Opened</th>
                                                    <th>Completed</th>
                                                    <th>Job discount</th>
                                                    <th>Promo</th>
                                                    <th>Before disc.</th>
                                                    <th>After disc.</th>
                                                    <th>VAT</th>
                                                    <th>Job total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentOrderDetails.jobsDetail.map((job) => (
                                                    <tr key={job.jobId}>
                                                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{job.jobId ?? '—'}</td>
                                                        <td>{job.departmentName ?? '—'}</td>
                                                        <td>{formatOrderStatusLabel(job.status)}</td>
                                                        <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatReportInstant(job.createdAt)}</td>
                                                        <td style={{ fontSize: '0.8125rem' }}>{formatJobCompletedDisplay(job)}</td>
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
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Line items</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>Job #</th>
                                                    <th>Dept</th>
                                                    <th>Item</th>
                                                    <th>Type</th>
                                                    <th>Qty</th>
                                                    <th>Unit (SAR)</th>
                                                    <th>Discount</th>
                                                    <th>VAT</th>
                                                    <th>Line (SAR)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentOrderDetails.lineItems.map((row) => (
                                                    <tr key={row.salesOrderItemId}>
                                                        <td>{row.jobId ?? '—'}</td>
                                                        <td>{row.departmentName ?? '—'}</td>
                                                        <td>{row.name ?? '—'}</td>
                                                        <td>{row.itemType ?? '—'}</td>
                                                        <td>{row.qty}</td>
                                                        <td>{toNumber(row.unitPrice).toLocaleString()}</td>
                                                        <td>{formatDiscountCell(row.discountType, row.discountValue)}</td>
                                                        <td style={{ fontSize: '0.8125rem' }}>{toNumber(row.vatPercent)}% · {String(row.vatMode ?? '—')}</td>
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

            {(detailsLoading || detailsError || detailRows.length > 0) && (
                <Modal
                    title={detailsTitle || 'Details'}
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
                                                                    ? 'DATE / TIME'
                                                                    : isMoneyDetailColumnKey(k)
                                                                      ? `${humanizeKey(k)} (SAR)`
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
                                                                                                {item.itemName ?? item.name ?? `Item ${idx + 1}`}
                                                                                            </div>
                                                                                            {(() => {
                                                                                                const sub = formatLineItemSubtext(item);
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
                                                                            '—'
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
