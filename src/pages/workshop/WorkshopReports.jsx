import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import RowActionsMenu from '../../components/RowActionsMenu';
import '../../styles/RowActionsMenu.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from '../../components/Modal';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { ShimmerTextBlock, ShimmerTable } from '../../components/supplier/Shimmer';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';
import { downloadPosInvoicePdf } from '../../utils/posInvoiceActions';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

/** Map each Reports inner tab id → its `*.view` permission code. */
const REPORTS_TAB_PERMISSION = {
    recent_orders: 'workshop.reports.orders.view',
    daily_sales:   'workshop.reports.daily-sales.view',
    by_technician: 'workshop.reports.by-technician.view',
    by_customer:   'workshop.reports.by-customer.view',
    by_product:    'workshop.reports.by-product.view',
    by_service:    'workshop.reports.by-service.view',
    by_department: 'workshop.reports.by-department.view',
    by_category:   'workshop.reports.by-category.view',
    by_branch:     'workshop.reports.by-branch.view',
    by_cashier:    'workshop.reports.by-cashier.view',
};
import {
    flattenWorkshopStaffRow,
    getWorkshopReportsAnalytics,
    getWorkshopRecentOpenOrderDetails,
    getWorkshopRecentOrderDetails,
    getWorkshopRecentOrderPdf,
    getWorkshopRecentOrders,
    getWorkshopReportsByBranch,
    getWorkshopReportsByBranchDetails,
    getWorkshopReportsByCashier,
    getWorkshopReportsByCashierDetails,
    getWorkshopReportsByCustomer,
    getWorkshopReportsByCustomerDetails,
    getWorkshopReportsByDepartment,
    getWorkshopReportsByDepartmentDetails,
    getWorkshopReportsByCategory,
    getWorkshopReportsByCategoryDetails,
    getWorkshopReportsByProduct,
    getWorkshopReportsByProductDetails,
    getWorkshopReportsByService,
    getWorkshopReportsByServiceDetails,
    getWorkshopReportsByTechnician,
    getWorkshopReportsByTechnicianDetails,
    getWorkshopReportsDailySalesDetails,
    getWorkshopTechnicians,
    runWorkshopRelativeAction,
    unwrapWorkshopStaffList,
    workshopReportsAnalyticsParams,
    workshopStaffListScopeQuery,
} from '../../services/workshopStaffApi';
import { formatPlateLettersFirst } from '../../utils/formatPlate';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/** `sales_orders.source` → short label (POS / workshop reports). */
function formatOrderSourceLabel(source) {
    const s = String(source ?? '')
        .trim()
        .toLowerCase();
    if (s === 'walk_in') return 'Walk-in';
    if (s === 'walk_in_corporate') return 'Corporate walk-in';
    if (s === 'takeaway') return 'Takeaway';
    if (!s) return '—';
    return s
        .split('_')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
        .join(' ');
}

/** `sales_orders.status` → readable title (spaces / underscores). */
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

const mapRecentPdfToInvoice = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const src = raw?.invoice && typeof raw.invoice === 'object' ? raw.invoice : raw;
    const salesOrder = src.salesOrder && typeof src.salesOrder === 'object' ? src.salesOrder : {};
    const customer = salesOrder.customer && typeof salesOrder.customer === 'object' ? salesOrder.customer : {};
    const vehicle = salesOrder.vehicle && typeof salesOrder.vehicle === 'object' ? salesOrder.vehicle : {};
    const jobs = Array.isArray(salesOrder.jobs) ? salesOrder.jobs : (Array.isArray(src.jobs) ? src.jobs : []);
    const payments = Array.isArray(src.payments) ? src.payments : [];
    const departments = Array.isArray(src.departments) ? src.departments : [];
    const splitPayments = Array.isArray(src.splitPayments)
        ? src.splitPayments
        : payments.map((p) => ({ method: p?.method, amount: p?.amount }));
    const paymentMethod =
        src.paymentMethod ||
        payments.map((p) => p?.method).filter(Boolean).join(', ') ||
        splitPayments.map((p) => p?.method).filter(Boolean).join(', ') ||
        'Unpaid';
    return {
        ...src,
        invoiceId: src.invoiceId ?? src.id,
        invoiceNo: src.invoiceNo,
        invoiceDate: src.invoiceDate,
        issuedAt: src.issuedAt || src.dateTime || src.invoiceDate,
        // Surface the nested objects at the root too — `normalizeCashierInvoice`
        // prefers `raw.customer / raw.vehicle / raw.branch / raw.workshop` and
        // falls back to `raw.salesOrder.*`. Pushing both paths so every detail
        // (make / model / year / VIN / taxId) survives regardless of shape.
        customer,
        vehicle,
        branch: src.branch || salesOrder.branch,
        workshop: src.workshop || salesOrder.workshop,
        customerName: src.customerName || customer.name,
        customerMobile: src.phone || src.customerMobile || customer.mobile,
        customerTaxId: src.taxId ?? src.customerTaxId ?? customer.taxId ?? null,
        plateNo: formatPlateLettersFirst(
            src.vehicleNo || src.plateNo || src.plateDisplay || vehicle.plateDisplay || vehicle.plateNo || '',
        ),
        vehicleModel: src.model ?? src.vehicleModel ?? vehicle.model ?? null,
        vehicleYear: src.year ?? src.vehicleYear ?? vehicle.year ?? null,
        vehicleMake: src.make ?? src.vehicleMake ?? vehicle.make ?? null,
        vehicleVin: src.vin ?? src.vehicleVin ?? vehicle.vin ?? vehicle.carNo ?? null,
        odometerReading:
            src.odometerReading ??
            salesOrder.odometerReading ??
            salesOrder.odometer ??
            vehicle.odometer ??
            null,
        nextOilChangeKm:
            src.nextOilChangeKm ?? salesOrder.nextOilChangeKm ?? null,
        branchName: src.branchName || src.branch?.name || salesOrder.branch?.name,
        totalAmount: src.totalAmount ?? src.invoiceTotal,
        paymentMethod,
        maintenanceChecklist: src.maintenanceChecklist,
        // Use API departments when present; otherwise line items live on salesOrder.jobs[].items
        // (do not synthesize departments with empty items — that hides rows in CashierTaxInvoiceView).
        departments,
        jobs,
        salesOrder,
        customerType: src.customerType,
        splitPayments,
    };
};

function pad2(n) {
    return String(n).padStart(2, '0');
}

/** `YYYY-MM-DDTHH:mm` for `<input type="datetime-local" />` (local timezone). */
function toDatetimeLocalValue(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Default: today from local midnight through now (latest window). */
function defaultLocalRangeLatest() {
    const end = new Date();
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    return { start: toDatetimeLocalValue(start), end: toDatetimeLocalValue(end) };
}

/** Full ISO strings for `/workshop-staff/reports-*` (server accepts YYYY-MM-DD or ISO instants). */
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
    const n = String(k || '')
        .toLowerCase()
        .replace(/-/g, '_');
    return n === 'invoicedate' || n === 'invoice_date';
}

function isMoneyDetailColumnKey(k) {
    const n = String(k || '')
        .toLowerCase()
        .replace(/-/g, '_');
    return (
        n === 'totalamount' ||
        n === 'total_amount' ||
        n === 'subtotal' ||
        n === 'vatamount' ||
        n === 'vat_amount' ||
        n === 'discountamount' ||
        n === 'discount_amount' ||
        n === 'departmentlinetotal' ||
        n === 'categorylinetotal' ||
        n === 'invoicetotalamount' ||
        n === 'invoice_amount' ||
        n === 'invoiceamount' ||
        n === 'jobtotal' ||
        n === 'job_total' ||
        n === 'line_total' ||
        n === 'linetotal' ||
        n === 'commission' ||
        n === 'revenue' ||
        n === 'revenue_sar' ||
        n === 'revenuesar'
    );
}

/** Sum numeric money columns for the details modal footer row. */
function sumDetailMoneyColumns(rows, columns) {
    const totals = {};
    for (const k of columns) {
        if (!isMoneyDetailColumnKey(k)) continue;
        const n = String(k || '')
            .toLowerCase()
            .replace(/-/g, '_');
        const dedupeInvoice =
            n === 'invoiceamount' ||
            n === 'invoice_amount' ||
            n === 'invoicetotalamount';
        const seenInvoiceKeys = dedupeInvoice ? new Set() : null;
        totals[k] = rows.reduce((s, row) => {
            if (seenInvoiceKeys) {
                const invKey =
                    row?.invoiceNo ??
                    row?.invoice_no ??
                    row?.invoiceId ??
                    row?.invoice_id;
                if (invKey != null && invKey !== '') {
                    const key = String(invKey);
                    if (seenInvoiceKeys.has(key)) return s;
                    seenInvoiceKeys.add(key);
                }
            }
            return s + toNumber(row?.[k]);
        }, 0);
    }
    return totals;
}

/** Second line under line-item name in report detail modals (unit, discount, VAT, line). */
function formatWorkshopLineItemCardSubtext(item) {
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

/** Recent orders row or details payload: prefer wall-clock issue time, then calendar invoice date. */
function formatInvoiceDateTimeForDisplay(rowOrDetails) {
    const raw =
        rowOrDetails?.issuedAt ??
        rowOrDetails?.issued_at ??
        rowOrDetails?.dateTime ??
        rowOrDetails?.invoiceDate ??
        rowOrDetails?.invoice_date;
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

/** Single ISO instant → local date/time (order modal jobs, placements). */
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

/** API row: `inv:…` for invoiced, `so:…` for completed-but-not-invoiced. */
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

/** Prefer paginated summary rows; when a technician filter is active, never fall back to unfiltered analytics. */
function pickSummaryTabRows(summaryKey, summaryData, reportPayload, technicianFilterActive = false) {
    const fromSummary = summaryData?.[summaryKey];
    if (technicianFilterActive && Array.isArray(fromSummary)) {
        return fromSummary;
    }
    if (Array.isArray(fromSummary) && fromSummary.length > 0) {
        return fromSummary;
    }
    return parseArr(reportPayload?.[summaryKey]);
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

/** Whitespace-split terms; row matches if every term appears somewhere in hay (case-insensitive). */
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
        by_service: '',
        by_department: '',
        by_category: '',
        by_branch: '',
        by_cashier: '',
    };
}

const ORDERS_PAGE_SIZE = 25;
const REPORTS_SUMMARY_PAGE_SIZE = 50;

function createEmptySummaryPages() {
    return {
        by_technician: 1,
        by_customer: 1,
        by_product: 1,
        by_service: 1,
        by_department: 1,
        by_category: 1,
        by_branch: 1,
        by_cashier: 1,
    };
}

function createEmptySummaryTotals() {
    return {
        by_technician: 0,
        by_customer: 0,
        by_product: 0,
        by_service: 0,
        by_department: 0,
        by_category: 0,
        by_branch: 0,
        by_cashier: 0,
    };
}

function extractSummaryTotal(res) {
    const raw = res?.total ?? res?.data?.total ?? res?.count ?? res?.data?.count;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function KpiProofStat({ label, value }) {
    return (
        <div className="ws-kpi-proof-stat">
            <span className="ws-kpi-proof-stat-label">{label}</span>
            <span className="ws-kpi-proof-stat-value">{value}</span>
        </div>
    );
}

function KpiProofSummaryGrid({ items }) {
    return (
        <div className="ws-kpi-proof-summary-grid">
            {items.map((item) => (
                <KpiProofStat key={item.label} label={item.label} value={item.value} />
            ))}
        </div>
    );
}

function KpiProofTable({ headers, rows, emptyMessage }) {
    if (!rows.length) {
        return <p className="ws-kpi-proof-note">{emptyMessage}</p>;
    }
    return (
        <WsTableScroll bodyClassName="ws-kpi-proof-scroll">
            <table className="ws-table ws-kpi-proof-table">
                <thead>
                    <tr>
                        {headers.map((h) => (
                            <th key={h}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                            {row.map((cell, cellIdx) => (
                                <td key={cellIdx}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </WsTableScroll>
    );
}

export default function WorkshopReports({ selectedBranchId = 'all', branches = [] }) {
    const { hasPermission } = useAuth();
    const location = useLocation();
    const orderDeepLinkHandledRef = useRef('');
    /** Which Reports inner tabs is the user allowed to view? */
    const visibleReportTabIds = useMemo(
        () => Object.entries(REPORTS_TAB_PERMISSION)
            .filter(([, code]) => hasPermission(code))
            .map(([id]) => id),
        [hasPermission],
    );

    const initialRange = useMemo(() => defaultLocalRangeLatest(), []);
    // Applied range — what the fetches actually query.
    const [rangeFromLocal, setRangeFromLocal] = useState(initialRange.start);
    const [rangeToLocal, setRangeToLocal] = useState(initialRange.end);
    // Draft range — what the date inputs edit; committed to the applied range
    // only when the user clicks "Apply" (so typing a range doesn't auto-fetch).
    const [draftRangeFrom, setDraftRangeFrom] = useState(initialRange.start);
    const [draftRangeTo, setDraftRangeTo] = useState(initialRange.end);
    const [activeTab, setActiveTab] = useState(() => visibleReportTabIds[0] ?? 'recent_orders');

    // Auto-snap to first visible inner tab if current becomes hidden.
    useEffect(() => {
        if (visibleReportTabIds.length === 0) return;
        if (!visibleReportTabIds.includes(activeTab)) {
            setActiveTab(visibleReportTabIds[0]);
        }
    }, [visibleReportTabIds, activeTab]);
    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;
    const [tabSearch, setTabSearch] = useState(createEmptyTabSearch);
    const [technicianOptions, setTechnicianOptions] = useState([]);
    const [byProductTechnicianId, setByProductTechnicianId] = useState('');
    const [byProductTechnicianFilterText, setByProductTechnicianFilterText] = useState('');
    const [byProductTechnicianLoading, setByProductTechnicianLoading] = useState(false);
    const [byProductTechnicianError, setByProductTechnicianError] = useState('');
    const [byServiceTechnicianId, setByServiceTechnicianId] = useState('');
    const [byServiceTechnicianFilterText, setByServiceTechnicianFilterText] = useState('');
    const [byServiceTechnicianLoading, setByServiceTechnicianLoading] = useState(false);
    const [byServiceTechnicianError, setByServiceTechnicianError] = useState('');
    const [reportData, setReportData] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [ordersPage, setOrdersPage] = useState(1);
    const [ordersTotal, setOrdersTotal] = useState(0);
    const [ordersSearchInput, setOrdersSearchInput] = useState('');
    const [ordersSearchDebounced, setOrdersSearchDebounced] = useState('');
    const [ordersPaymentMethod, setOrdersPaymentMethod] = useState('');
    const [ordersListLoading, setOrdersListLoading] = useState(false);
    const [ordersListError, setOrdersListError] = useState('');
    const [summaryPages, setSummaryPages] = useState(createEmptySummaryPages);
    const [summaryTotals, setSummaryTotals] = useState(createEmptySummaryTotals);
    const [summaryLoading, setSummaryLoading] = useState({
        by_technician: false,
        by_customer: false,
        by_product: false,
        by_service: false,
        by_department: false,
        by_category: false,
        by_branch: false,
        by_cashier: false,
    });
    const [summaryData, setSummaryData] = useState({
        by_technician: [],
        by_customer: [],
        by_product: [],
        by_service: [],
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
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [recentOrderDetails, setRecentOrderDetails] = useState(null);
    const [recentOrderDetailsLoading, setRecentOrderDetailsLoading] = useState(false);
    const [recentOrderDetailsError, setRecentOrderDetailsError] = useState('');
    const [recentOrderActionBusyId, setRecentOrderActionBusyId] = useState('');
    const [invoicePreviewData, setInvoicePreviewData] = useState(null);
    const [kpiProofModalId, setKpiProofModalId] = useState(null);

    /** When set, summary reloads re-fetch the same drill-down row for the new range. */
    const detailAnchorRef = useRef(null);
    const loadDetailsRef = useRef(null);
    const prevBranchIdRef = useRef(null);
    const recentOrderDetailsTargetRef = useRef(null);

    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);

    const fetchRecentOrdersList = useCallback(async () => {
        setOrdersListLoading(true);
        setOrdersListError('');
        try {
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
            const params = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate,
                endDate,
            });
            const limit = ORDERS_PAGE_SIZE;
            const offset = (ordersPage - 1) * limit;
            const q = ordersSearchDebounced.trim();
            const res = await getWorkshopRecentOrders({
                ...params,
                limit,
                offset,
                ...(q ? { search: q } : {}),
                ...(ordersPaymentMethod ? { paymentMethod: ordersPaymentMethod } : {}),
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
    }, [selectedBranchId, rangeFromLocal, rangeToLocal, ordersPage, ordersSearchDebounced, ordersPaymentMethod]);

    const fetchRecentOrdersListRef = useRef(fetchRecentOrdersList);
    fetchRecentOrdersListRef.current = fetchRecentOrdersList;

    const fetchSummaryTabPage = useCallback(
        async (tabId, page = 1) => {
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
            const technicianId =
                tabId === 'by_product'
                    ? byProductTechnicianId
                    : tabId === 'by_service'
                      ? byServiceTechnicianId
                      : '';
            const baseParams = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate,
                endDate,
                ...(technicianId ? { technicianId } : {}),
            });
            const params = {
                ...baseParams,
                limit: REPORTS_SUMMARY_PAGE_SIZE,
                offset: (Math.max(1, Number(page) || 1) - 1) * REPORTS_SUMMARY_PAGE_SIZE,
            };
            let fetcher = null;
            if (tabId === 'by_technician') fetcher = getWorkshopReportsByTechnician;
            else if (tabId === 'by_customer') fetcher = getWorkshopReportsByCustomer;
            else if (tabId === 'by_product') fetcher = getWorkshopReportsByProduct;
            else if (tabId === 'by_service') fetcher = getWorkshopReportsByService;
            else if (tabId === 'by_department') fetcher = getWorkshopReportsByDepartment;
            else if (tabId === 'by_category') fetcher = getWorkshopReportsByCategory;
            else if (tabId === 'by_branch') fetcher = getWorkshopReportsByBranch;
            else if (tabId === 'by_cashier') fetcher = getWorkshopReportsByCashier;
            if (!fetcher) return null;

            setSummaryLoading((prev) => ({ ...prev, [tabId]: true }));
            if (tabId === 'by_product') setByProductTechnicianLoading(true);
            if (tabId === 'by_service') setByServiceTechnicianLoading(true);
            if (tabId === 'by_product' || tabId === 'by_service') {
                const techActive =
                    (tabId === 'by_product' && byProductTechnicianId) ||
                    (tabId === 'by_service' && byServiceTechnicianId);
                if (techActive) {
                    setSummaryData((prev) => ({ ...prev, [tabId]: [] }));
                    setSummaryTotals((prev) => ({ ...prev, [tabId]: 0 }));
                }
            }
            try {
                const res = await fetcher(params);
                const rows = extractSummaryRows(res, tabId);
                const total = extractSummaryTotal(res);
                setSummaryData((prev) => ({ ...prev, [tabId]: rows }));
                setSummaryTotals((prev) => ({ ...prev, [tabId]: total || rows.length }));
                if (tabId === 'by_product') setByProductTechnicianError('');
                if (tabId === 'by_service') setByServiceTechnicianError('');
                return { rows, total: total || rows.length };
            } catch (err) {
                if (tabId === 'by_product') {
                    setByProductTechnicianError(err?.message || 'Failed to load product sales for this technician.');
                }
                if (tabId === 'by_service') {
                    setByServiceTechnicianError(err?.message || 'Failed to load service sales for this technician.');
                }
                throw err;
            } finally {
                if (tabId === 'by_product') setByProductTechnicianLoading(false);
                if (tabId === 'by_service') setByServiceTechnicianLoading(false);
                setSummaryLoading((prev) => ({ ...prev, [tabId]: false }));
            }
        },
        [selectedBranchId, rangeFromLocal, rangeToLocal, byProductTechnicianId, byServiceTechnicianId],
    );

    const loadReports = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        setDetailsError('');
        setOrdersPage(1);
        setSummaryPages(createEmptySummaryPages());
        try {
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
            const params = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate,
                endDate,
            });
            const productParams = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate,
                endDate,
                technicianId: byProductTechnicianId,
            });
            const serviceParams = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate,
                endDate,
                technicianId: byServiceTechnicianId,
            });
            const [
                response,
                techniciansRes,
                byTechnicianRes,
                byCustomerRes,
                byProductRes,
                byServiceRes,
                byDepartmentRes,
                byCategoryRes,
                byBranchRes,
                byCashierRes,
            ] = await Promise.all([
                getWorkshopReportsAnalytics(params),
                getWorkshopTechnicians(workshopStaffListScopeQuery(selectedBranchId)),
                getWorkshopReportsByTechnician({ ...params, limit: REPORTS_SUMMARY_PAGE_SIZE, offset: 0 }),
                getWorkshopReportsByCustomer({ ...params, limit: REPORTS_SUMMARY_PAGE_SIZE, offset: 0 }),
                getWorkshopReportsByProduct({ ...productParams, limit: REPORTS_SUMMARY_PAGE_SIZE, offset: 0 }),
                getWorkshopReportsByService({ ...serviceParams, limit: REPORTS_SUMMARY_PAGE_SIZE, offset: 0 }),
                getWorkshopReportsByDepartment({ ...params, limit: REPORTS_SUMMARY_PAGE_SIZE, offset: 0 }),
                getWorkshopReportsByCategory({ ...params, limit: REPORTS_SUMMARY_PAGE_SIZE, offset: 0 }),
                getWorkshopReportsByBranch({ ...params, limit: REPORTS_SUMMARY_PAGE_SIZE, offset: 0 }),
                getWorkshopReportsByCashier({ ...params, limit: REPORTS_SUMMARY_PAGE_SIZE, offset: 0 }),
            ]);
            if (!response?.success) {
                throw new Error('Invalid reports response.');
            }
            setReportData(response);
            setSummaryData({
                by_technician: extractSummaryRows(byTechnicianRes, 'by_technician'),
                by_customer: extractSummaryRows(byCustomerRes, 'by_customer'),
                by_product: extractSummaryRows(byProductRes, 'by_product'),
                by_service: extractSummaryRows(byServiceRes, 'by_service'),
                by_department: extractSummaryRows(byDepartmentRes, 'by_department'),
                by_category: extractSummaryRows(byCategoryRes, 'by_category'),
                by_branch: extractSummaryRows(byBranchRes, 'by_branch'),
                by_cashier: extractSummaryRows(byCashierRes, 'by_cashier'),
            });
            setSummaryTotals({
                by_technician: extractSummaryTotal(byTechnicianRes) || extractSummaryRows(byTechnicianRes, 'by_technician').length,
                by_customer: extractSummaryTotal(byCustomerRes) || extractSummaryRows(byCustomerRes, 'by_customer').length,
                by_product: extractSummaryTotal(byProductRes) || extractSummaryRows(byProductRes, 'by_product').length,
                by_service: extractSummaryTotal(byServiceRes) || extractSummaryRows(byServiceRes, 'by_service').length,
                by_department: extractSummaryTotal(byDepartmentRes) || extractSummaryRows(byDepartmentRes, 'by_department').length,
                by_category: extractSummaryTotal(byCategoryRes) || extractSummaryRows(byCategoryRes, 'by_category').length,
                by_branch: extractSummaryTotal(byBranchRes) || extractSummaryRows(byBranchRes, 'by_branch').length,
                by_cashier: extractSummaryTotal(byCashierRes) || extractSummaryRows(byCashierRes, 'by_cashier').length,
            });
            const rawTech = unwrapWorkshopStaffList(techniciansRes, 'technician');
            const opts = rawTech
                .map((r) => flattenWorkshopStaffRow(r, 'technician'))
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
                by_service: [],
                by_department: [],
                by_category: [],
                by_branch: [],
                by_cashier: [],
            });
            setSummaryTotals(createEmptySummaryTotals());
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
    }, [selectedBranchId, rangeFromLocal, rangeToLocal, byProductTechnicianId, byServiceTechnicianId]);

    /** True when the draft date range differs from the currently applied one. */
    const rangeDirty =
        draftRangeFrom !== rangeFromLocal || draftRangeTo !== rangeToLocal;

    /**
     * Commit the draft date range to the applied range. Changing the applied
     * range re-runs `loadReports` (and the recent-orders / summary fetches) via
     * their effects. If the range is unchanged, reload directly so the button
     * still works as a manual refresh.
     */
    const applyDateRange = useCallback(() => {
        if (rangeDirty) {
            setRangeFromLocal(draftRangeFrom);
            setRangeToLocal(draftRangeTo);
        } else {
            void loadReports();
        }
    }, [rangeDirty, draftRangeFrom, draftRangeTo, loadReports]);

    useEffect(() => {
        const t = setTimeout(() => {
            setOrdersSearchDebounced(ordersSearchInput.trim());
        }, 380);
        return () => clearTimeout(t);
    }, [ordersSearchInput]);

    useLayoutEffect(() => {
        setOrdersPage(1);
    }, [ordersSearchDebounced, ordersPaymentMethod]);

    useEffect(() => {
        void fetchRecentOrdersList();
    }, [fetchRecentOrdersList, ordersPage, ordersSearchDebounced]);

    const activeSummaryPage = activeTab.startsWith('by_')
        ? (summaryPages[activeTab] ?? 1)
        : 1;

    useEffect(() => {
        if (!activeTab.startsWith('by_')) return;
        void fetchSummaryTabPage(activeTab, activeSummaryPage);
    }, [activeTab, activeSummaryPage, fetchSummaryTabPage, byProductTechnicianId, byServiceTechnicianId]);

    const technicianComboboxOptions = useMemo(
        () =>
            technicianOptions.map((t) => ({
                id: String(t.id),
                label: t.name || 'Technician',
                subtitle: t.phone ? String(t.phone) : '',
            })),
        [technicianOptions],
    );

    const resetByProductTechnicianFilter = useCallback(() => {
        detailAnchorRef.current = null;
        setByProductTechnicianId('');
        setByProductTechnicianFilterText('');
        setSelectedDetailKey('');
        setDetailRows([]);
        setDetailsTitle('');
        setDetailsError('');
        setByProductTechnicianError('');
        setSummaryPages((prev) => ({ ...prev, by_product: 1 }));
    }, []);

    const resetByServiceTechnicianFilter = useCallback(() => {
        detailAnchorRef.current = null;
        setByServiceTechnicianId('');
        setByServiceTechnicianFilterText('');
        setSelectedDetailKey('');
        setDetailRows([]);
        setDetailsTitle('');
        setDetailsError('');
        setByServiceTechnicianError('');
        setSummaryPages((prev) => ({ ...prev, by_service: 1 }));
    }, []);

    useEffect(() => {
        const prev = prevBranchIdRef.current;
        if (prev !== null && prev !== selectedBranchId) {
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
            setByProductTechnicianFilterText('');
            setByProductTechnicianError('');
            setByServiceTechnicianId('');
            setByServiceTechnicianFilterText('');
            setByServiceTechnicianError('');
        }
        prevBranchIdRef.current = selectedBranchId;
    }, [selectedBranchId]);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    const fetchRecentOrderDetails = useCallback(async (target) => {
        const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
        const params = workshopReportsAnalyticsParams(selectedBranchId, {
            startDate,
            endDate,
        });
        const t = String(target ?? '');
        if (t.startsWith('so:')) {
            return await getWorkshopRecentOpenOrderDetails(t.slice(3), params);
        }
        const invId = t.startsWith('inv:') ? t.slice(4) : t;
        return await getWorkshopRecentOrderDetails(invId, params);
    }, [selectedBranchId, rangeFromLocal, rangeToLocal]);

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
        const params = new URLSearchParams(location.search);
        const orderTarget = String(params.get('orderTarget') ?? params.get('order') ?? '').trim();
        if (!orderTarget) return;
        const linkKey = `${location.pathname}?${orderTarget}`;
        if (orderDeepLinkHandledRef.current === linkKey) return;
        orderDeepLinkHandledRef.current = linkKey;
        if (visibleReportTabIds.includes('recent_orders')) {
            setActiveTab('recent_orders');
        }
        recentOrderDetailsTargetRef.current = orderTarget;
        void openRecentOrderDetails(orderTarget);
    }, [location.pathname, location.search, openRecentOrderDetails, visibleReportTabIds]);

    useEffect(() => {
        const id = recentOrderDetailsTargetRef.current;
        if (!id) return;
        void openRecentOrderDetails(id);
    }, [rangeFromLocal, rangeToLocal, selectedBranchId, openRecentOrderDetails]);

    const handleRecentOrderAction = useCallback(async (row, actionType) => {
        if (!row) return;
        const target = recentOrderRowTarget(row);
        if (!target) return;
        const isOpen = target.startsWith('so:');
        setRecentOrderActionBusyId(target);
        try {
            if (isOpen) {
                if (actionType === 'view') {
                    void openRecentOrderDetails(target);
                } else {
                    window.alert('This order does not have an invoice yet.');
                }
                return;
            }
            const invoiceId = target.startsWith('inv:') ? target.slice(4) : target;
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
            const params = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate,
                endDate,
            });
            const res = await getWorkshopRecentOrderPdf(invoiceId, params);
            const invoiceObj = mapRecentPdfToInvoice(res);
            if (!invoiceObj) throw new Error('Invalid invoice response.');
            if (actionType === 'view') {
                setInvoicePreviewData(invoiceObj);
            } else if (actionType === 'download') {
                await downloadPosInvoicePdf(invoiceObj);
            } else if (actionType === 'whatsapp') {
                try {
                    const waRes = await apiFetch(
                        `/workshop-staff/invoices/${encodeURIComponent(String(invoiceId))}/send-whatsapp`,
                        { method: 'POST' },
                    );
                    const to = waRes?.to || waRes?.data?.to;
                    window.alert(
                        to
                            ? `Invoice sent to WhatsApp (${to}).`
                            : 'Invoice sent to WhatsApp.',
                    );
                } catch (waErr) {
                    const msg = String(waErr?.message || '');
                    const bevatelMissing =
                        /BEVATEL_ACCESS_TOKEN|BEVATEL_INBOX_ID|PUBLIC_INVOICE_BASE_URL/i.test(msg);
                    if (!bevatelMissing) throw waErr;
                    const linkRes = await apiFetch(
                        `/workshop-staff/invoices/${encodeURIComponent(String(invoiceId))}/whatsapp-link`,
                    );
                    const waMeUrl = linkRes?.waMeUrl || linkRes?.data?.waMeUrl;
                    if (!waMeUrl) {
                        throw new Error(
                            `${msg}\n\nConfigure BEVATEL_ACCESS_TOKEN, BEVATEL_INBOX_ID, and PUBLIC_INVOICE_BASE_URL on the server for automatic PDF delivery.`,
                        );
                    }
                    window.open(waMeUrl, '_blank', 'noopener,noreferrer');
                    window.alert(
                        'Automatic WhatsApp PDF is not configured on the server. Opened WhatsApp with the invoice link — tap Send to deliver it manually.',
                    );
                }
            }
        } catch (error) {
            window.alert(error?.message || 'Failed to execute action.');
        } finally {
            setRecentOrderActionBusyId('');
        }
    }, [selectedBranchId, rangeFromLocal, rangeToLocal, openRecentOrderDetails]);

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
            const { startDate, endDate } = rangeToApiIso(rangeFromLocal, rangeToLocal);
            const params = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate,
                endDate,
                ...(tabId === 'by_product' && byProductTechnicianId
                    ? { technicianId: byProductTechnicianId }
                    : {}),
                ...(tabId === 'by_service' && byServiceTechnicianId
                    ? { technicianId: byServiceTechnicianId }
                    : {}),
            });
            let fetcher = null;
            let key = '';
            let title = '';
            if (tabId === 'by_technician') {
                fetcher = getWorkshopReportsByTechnicianDetails;
                key = String(row.technician_id ?? row.technicianId ?? row.id ?? '');
                title = `Technician details: ${row.name || 'Technician'}`;
            } else if (tabId === 'by_customer') {
                fetcher = getWorkshopReportsByCustomerDetails;
                key = String(row.customer_id ?? row.customerId ?? '');
                title = `Customer details: ${row.customer_name ?? row.customerName ?? 'Customer'}`;
            } else if (tabId === 'by_product') {
                fetcher = getWorkshopReportsByProductDetails;
                key = String(row.product_id ?? row.productId ?? '');
                title = `Product details: ${row.product_name ?? row.productName ?? row.item_name ?? 'Item'}`;
            } else if (tabId === 'by_service') {
                fetcher = getWorkshopReportsByServiceDetails;
                key = String(row.service_id ?? row.serviceId ?? '');
                title = `Service details: ${row.service_name ?? row.serviceName ?? row.item_name ?? 'Service'}`;
            } else if (tabId === 'by_department') {
                fetcher = getWorkshopReportsByDepartmentDetails;
                key = String(row.department_id ?? row.departmentId ?? '');
                title = `Department details: ${row.department_name ?? row.departmentName ?? 'Department'}`;
            } else if (tabId === 'by_category') {
                fetcher = getWorkshopReportsByCategoryDetails;
                key = String(row.category_id ?? row.categoryId ?? 'uncategorized');
                title = `Category details: ${row.category_name ?? row.categoryName ?? 'Category'}`;
            } else if (tabId === 'by_branch') {
                fetcher = getWorkshopReportsByBranchDetails;
                key = String(row.branch_id ?? row.branchId ?? '');
                title = `Branch details: ${row.branch_name ?? row.branchName ?? 'Branch'}`;
            } else if (tabId === 'by_cashier') {
                fetcher = getWorkshopReportsByCashierDetails;
                key = String(row.cashier_id ?? row.cashierId ?? row.user_id ?? row.userId ?? '');
                title = `Cashier details: ${row.name ?? 'Cashier'}`;
            } else if (tabId === 'daily_sales') {
                fetcher = getWorkshopReportsDailySalesDetails;
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
                if (tabId === 'by_technician') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.jobId;
                            delete next.job_id;
                            delete next.departmentId;
                            delete next.department_id;
                            delete next.branchId;
                            delete next.branch_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.technicianId;
                            delete next.technician_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_customer') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.corporateAccountId;
                            delete next.corporate_account_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_product') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.salesOrderItemId;
                            delete next.sales_order_item_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            delete next.productId;
                            delete next.product_id;
                            delete next.serviceId;
                            delete next.service_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_service') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.salesOrderItemId;
                            delete next.sales_order_item_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            delete next.productId;
                            delete next.product_id;
                            delete next.serviceId;
                            delete next.service_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_department') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.salesOrderItemId;
                            delete next.sales_order_item_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            delete next.productId;
                            delete next.product_id;
                            delete next.serviceId;
                            delete next.service_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_category') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.salesOrderItemId;
                            delete next.sales_order_item_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            delete next.productId;
                            delete next.product_id;
                            delete next.serviceId;
                            delete next.service_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_branch') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_cashier') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'daily_sales') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.invoiceId;
                            delete next.invoice_id;
                            return next;
                        }),
                    );
                } else {
                    setDetailRows(rows);
                }
            } catch (error) {
                setDetailsError(error?.message || 'Failed to load details.');
                setDetailRows([]);
                detailAnchorRef.current = null;
            } finally {
                setDetailsLoading(false);
            }
        },
        [selectedBranchId, rangeFromLocal, rangeToLocal, byProductTechnicianId, byServiceTechnicianId],
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
        const skusSoldInPeriod = toNumber(
            r.skus_sold_in_period ?? inv.skusSoldInPeriod ?? 0,
        );
        const skusNotSoldInPeriod = toNumber(
            r.skus_not_sold_in_period ?? inv.skusNotSoldInPeriod ?? 0,
        );

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

        const kpiProof = r.kpi_proof ?? r.kpiProof ?? null;

        return {
            completedOrdersCount: toNumber(r.completed_orders_count),
            totalRevenue,
            revenueChangePercent,
            stockValueCost,
            potentialProfit,
            activeSkus,
            skusSoldInPeriod,
            skusNotSoldInPeriod,
            dailyRevenue,
            byTechnician,
            byCustomer: pickSummaryTabRows('by_customer', summaryData, r),
            byProduct: pickSummaryTabRows('by_product', summaryData, r, Boolean(byProductTechnicianId)),
            byService: pickSummaryTabRows('by_service', summaryData, r, Boolean(byServiceTechnicianId)),
            byDepartment: pickSummaryTabRows('by_department', summaryData, r),
            byCategory: pickSummaryTabRows('by_category', summaryData, r),
            byBranch: pickSummaryTabRows('by_branch', summaryData, r),
            byCashier: pickSummaryTabRows('by_cashier', summaryData, r),
            period: r.period ?? null,
            previousPeriod: r.previous_period ?? null,
            definitions: r.definitions && typeof r.definitions === 'object' ? r.definitions : {},
            kpiProof,
        };
    }, [reportData, summaryData, byProductTechnicianId, byServiceTechnicianId]);

    const kpis = useMemo(() => {
        if (!norm) {
            return [
                { id: 'revenue', label: 'Total Revenue', value: formatCurrency(0), color: 'text-green' },
                { id: 'revenue_change', label: 'Revenue Change', value: '0.0%', sub: 'vs previous period', color: 'text-blue' },
                {
                    id: 'stock_value',
                    label: 'Stock Value (Cost)',
                    value: formatCurrency(0),
                    sub: 'All on-hand stock · not period sales',
                    color: 'text-orange',
                },
                {
                    id: 'potential_profit',
                    label: 'Potential Profit',
                    value: formatCurrency(0),
                    sub: '0 SKUs on hand',
                    color: 'text-purple',
                },
            ];
        }
        const sign = norm.revenueChangePercent > 0 ? '+' : '';
        return [
            { id: 'revenue', label: 'Total Revenue', value: formatCurrency(norm.totalRevenue), color: 'text-green' },
            {
                id: 'revenue_change',
                label: 'Revenue Change',
                value: `${sign}${norm.revenueChangePercent.toFixed(1)}%`,
                sub: 'vs previous period',
                color: 'text-blue',
            },
            {
                id: 'stock_value',
                label: 'Stock Value (Cost)',
                value: formatCurrency(norm.stockValueCost),
                sub: `All on-hand · ${norm.activeSkus} SKUs (${norm.skusNotSoldInPeriod} unsold in period)`,
                color: 'text-orange',
            },
            {
                id: 'potential_profit',
                label: 'Potential Profit',
                value: formatCurrency(norm.potentialProfit),
                sub: `${norm.activeSkus} SKUs on hand · ${norm.skusSoldInPeriod} sold in period`,
                color: 'text-purple',
            },
        ];
    }, [norm]);

    const kpiProofModalTitle = useMemo(() => {
        const k = kpis.find((x) => x.id === kpiProofModalId);
        return k ? `${k.label} — calculation` : 'KPI calculation';
    }, [kpis, kpiProofModalId]);

    const renderKpiProofBody = () => {
        const proof = norm?.kpiProof;
        if (!proof || !kpiProofModalId) {
            return (
                <p className="ws-kpi-proof-methodology">
                    Refresh reports to load calculation breakdown (requires an updated backend).
                </p>
            );
        }
        const scopeLine = `Scope: ${branchLabel}${periodLine ? ` · ${periodLine}` : ''}`;

        if (kpiProofModalId === 'revenue') {
            const rev = proof.revenue ?? {};
            const invoices = parseArr(rev.invoices);
            return (
                <>
                    <p className="ws-kpi-proof-methodology">{rev.formula}</p>
                    <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                    <KpiProofSummaryGrid
                        items={[
                            { label: 'Invoices in period', value: String(rev.invoice_count ?? 0) },
                            { label: 'Reported total', value: formatCurrency(rev.total) },
                            { label: 'Sum of lines below', value: formatCurrency(rev.line_sum_check) },
                        ]}
                    />
                    {rev.invoices_truncated ? (
                        <p className="ws-kpi-proof-note">
                            Showing first {invoices.length} of {rev.invoices_total_count} invoices.
                        </p>
                    ) : null}
                    <KpiProofTable
                        headers={['Invoice', 'Date', 'Amount (SAR)']}
                        rows={invoices.map((inv) => [
                            inv.invoice_no ?? inv.invoiceNo ?? '—',
                            inv.issued_at
                                ? formatReportInstant(inv.issued_at)
                                : inv.invoice_date ?? inv.invoiceDate ?? '—',
                            formatCurrency(inv.amount),
                        ])}
                        emptyMessage="No invoices in this period."
                    />
                </>
            );
        }

        if (kpiProofModalId === 'revenue_change') {
            const ch = proof.revenue_change ?? {};
            const cur = ch.current_period ?? {};
            const prev = ch.previous_period ?? {};
            return (
                <>
                    <p className="ws-kpi-proof-methodology">{ch.formula}</p>
                    <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                    <KpiProofTable
                        headers={['', 'Period', 'Total revenue (SAR)']}
                        rows={[
                            [
                                'Current',
                                `${cur.start_date ?? '—'} → ${cur.end_date ?? '—'}`,
                                formatCurrency(ch.current_period_total),
                            ],
                            [
                                'Previous',
                                `${prev.start_date ?? '—'} → ${prev.end_date ?? '—'}`,
                                formatCurrency(ch.previous_period_total),
                            ],
                            [
                                'Change',
                                '—',
                                `${ch.change_percent > 0 ? '+' : ''}${Number(ch.change_percent ?? 0).toFixed(1)}%`,
                            ],
                        ]}
                    />
                </>
            );
        }

        if (kpiProofModalId === 'stock_value' || kpiProofModalId === 'potential_profit') {
            const inv = proof.inventory_valuation ?? proof.inventoryValuation ?? {};
            const lines = parseArr(inv.lines);
            const showProfit = kpiProofModalId === 'potential_profit';
            const skusOnHand = inv.active_skus ?? 0;
            const skusSold = inv.skus_sold_in_period ?? 0;
            const skusUnsold = inv.skus_not_sold_in_period ?? 0;
            return (
                <>
                    <p className="ws-kpi-proof-note" style={{ marginBottom: 8 }}>
                        <strong>Not period sales.</strong> This is estimated inventory on hand at
                        period end for all active branch products with qty &gt; 0—including SKUs
                        with no invoice lines in the selected range.
                    </p>
                    <p className="ws-kpi-proof-methodology">{inv.methodology}</p>
                    <p className="ws-kpi-proof-methodology">
                        {inv.unwind_formula}
                        <br />
                        {showProfit ? inv.potential_profit_formula : inv.stock_value_formula}
                    </p>
                    <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                    <p className="ws-kpi-proof-methodology">
                        Period end (est.): <strong>{inv.period_end_date ?? '—'}</strong>
                    </p>
                    <KpiProofSummaryGrid
                        items={[
                            { label: 'SKUs on hand', value: String(skusOnHand) },
                            { label: 'Sold in period', value: String(skusSold) },
                            { label: 'On hand, not sold in period', value: String(skusUnsold) },
                            {
                                label: 'Stock value total',
                                value: formatCurrency(inv.stock_value_total),
                            },
                            {
                                label: 'Potential profit total',
                                value: formatCurrency(inv.potential_profit_total),
                            },
                        ]}
                    />
                    <KpiProofTable
                        headers={[
                            'SKU',
                            'Product',
                            'Branch',
                            'Sold in period',
                            'On hand now',
                            'Unwind after period',
                            'Qty @ period end',
                            'Cost',
                            'Sale',
                            'Stock value',
                            'Line profit',
                        ]}
                        rows={lines.map((row) => [
                            row.sku ?? '—',
                            row.product_name ?? '—',
                            row.branch_name ?? '—',
                            row.sold_in_period ? 'Yes' : 'No',
                            row.qty_on_hand_now,
                            row.unwind_after_period_end,
                            row.qty_at_period_end,
                            formatCurrency(row.purchase_price),
                            formatCurrency(row.sale_price),
                            formatCurrency(row.stock_value),
                            formatCurrency(row.line_potential_profit),
                        ])}
                        emptyMessage="No catalog products with on-hand qty at period end."
                    />
                </>
            );
        }

        return <p className="ws-kpi-proof-methodology">No breakdown available for this KPI.</p>;
    };

    const completedOrdersDisplay = norm?.completedOrdersCount ?? 0;

    const tabs = [
        { id: 'recent_orders', label: 'Orders' },
        { id: 'daily_sales', label: 'Daily Sales' },
        { id: 'by_technician', label: 'By Technician' },
        { id: 'by_customer', label: 'By Customer' },
        { id: 'by_product', label: 'By Product' },
        { id: 'by_service', label: 'By Service' },
        { id: 'by_department', label: 'By Department' },
        { id: 'by_category', label: 'By Category' },
        { id: 'by_branch', label: 'By Branch' },
        { id: 'by_cashier', label: 'By Cashier' },
    ].filter((t) => visibleReportTabIds.includes(t.id));

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
                : formatPlateLettersFirst(row.plate_no ?? row.plateNo ?? '');
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
        const rows = (norm?.byProduct ?? []).filter((row) => {
            const itemType = String(row.item_type ?? row.itemType ?? 'product').toLowerCase();
            const productKey = String(row.product_id ?? row.productId ?? '');
            return itemType !== 'service' && !productKey.startsWith('s:');
        });
        const q = tabSearch.by_product;
        return rows.filter((row) =>
            rowMatchesTabQuery(
                [
                    row.product_name,
                    row.productName,
                    row.item_name,
                    row.product_id,
                    row.productId,
                    row.qty_sold,
                    row.qtySold,
                    row.revenue_sar,
                    row.revenueSar,
                ],
                q,
            ),
        );
    }, [norm, tabSearch.by_product]);

    const filteredByService = useMemo(() => {
        const rows = (norm?.byService ?? []).filter((row) => {
            const itemType = String(row.item_type ?? row.itemType ?? 'service').toLowerCase();
            const serviceKey = String(row.service_id ?? row.serviceId ?? '');
            return itemType !== 'product' && !serviceKey.startsWith('p:');
        });
        const q = tabSearch.by_service;
        return rows.filter((row) =>
            rowMatchesTabQuery(
                [
                    row.service_name,
                    row.serviceName,
                    row.item_name,
                    row.service_id,
                    row.serviceId,
                    row.qty_sold,
                    row.qtySold,
                    row.revenue_sar,
                    row.revenueSar,
                ],
                q,
            ),
        );
    }, [norm, tabSearch.by_service]);

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
    const renderSummaryPagination = (tabId, visibleCount) => {
        const total = summaryTotals[tabId] ?? 0;
        if (total <= REPORTS_SUMMARY_PAGE_SIZE) return null;
        const page = summaryPages[tabId] ?? 1;
        const totalPages = Math.max(1, Math.ceil(total / REPORTS_SUMMARY_PAGE_SIZE));
        const rangeFrom = total === 0 ? 0 : (page - 1) * REPORTS_SUMMARY_PAGE_SIZE + 1;
        const rangeTo = Math.min((page - 1) * REPORTS_SUMMARY_PAGE_SIZE + visibleCount, total);
        return (
            <div className="ws-report-pagination">
                <p className="ws-report-pagination__info">
                    Showing <strong>{rangeFrom}</strong>–<strong>{rangeTo}</strong> of <strong>{total}</strong>
                    {summaryLoading[tabId] ? <span> · Loading…</span> : null}
                </p>
                <nav className="ws-report-pagination__nav" aria-label={`${humanizeKey(tabId)} pages`}>
                    <button
                        type="button"
                        className="ws-report-pagination__edge"
                        disabled={page <= 1 || summaryLoading[tabId]}
                        onClick={() =>
                            setSummaryPages((prev) => ({ ...prev, [tabId]: Math.max(1, page - 1) }))
                        }
                    >
                        Previous
                    </button>
                    <div className="ws-report-pagination__pages" role="group" aria-label="Page numbers">
                        {(() => {
                            const maxBtn = 7;
                            let start = Math.max(1, page - Math.floor(maxBtn / 2));
                            let end = Math.min(totalPages, start + maxBtn - 1);
                            start = Math.max(1, end - maxBtn + 1);
                            const nums = [];
                            for (let n = start; n <= end; n += 1) nums.push(n);
                            return nums.map((n) => (
                                <button
                                    key={`${tabId}-${n}`}
                                    type="button"
                                    className={`ws-report-pagination__page${n === page ? ' ws-report-pagination__page--active' : ''}`}
                                    aria-current={n === page ? 'page' : undefined}
                                    disabled={summaryLoading[tabId]}
                                    onClick={() => setSummaryPages((prev) => ({ ...prev, [tabId]: n }))}
                                >
                                    {n}
                                </button>
                            ));
                        })()}
                    </div>
                    <button
                        type="button"
                        className="ws-report-pagination__edge"
                        disabled={page >= totalPages || summaryLoading[tabId]}
                        onClick={() =>
                            setSummaryPages((prev) => ({ ...prev, [tabId]: Math.min(totalPages, page + 1) }))
                        }
                    >
                        Next
                    </button>
                </nav>
            </div>
        );
    };

    return (
        <div className="ws-reports-page">
            <div className="ws-reports-header">
                <div>
                    <h2 className="ws-page-title">Reports & Analytics</h2>
                    <p className="ws-page-sub">
                        Scope · <strong>{branchLabel}</strong>
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
                <div className="ws-filter-group">
                    <div className="ws-date-input-group">
                        <input
                            type="datetime-local"
                            value={draftRangeFrom}
                            onChange={(e) => setDraftRangeFrom(e.target.value)}
                            step={60}
                            aria-label="From date and time"
                        />
                        <span className="ws-text-dim">to</span>
                        <input
                            type="datetime-local"
                            value={draftRangeTo}
                            onChange={(e) => setDraftRangeTo(e.target.value)}
                            step={60}
                            aria-label="To date and time"
                        />
                    </div>
                    <button
                        type="button"
                        className="ws-btn-refresh"
                        onClick={applyDateRange}
                        disabled={isLoading}
                    >
                        <RefreshCw size={14} />{' '}
                        {isLoading ? 'Loading...' : rangeDirty ? 'Apply' : 'Refresh'}
                    </button>
                </div>
                <div className="ws-order-count">
                    <span>{completedOrdersDisplay} completed orders</span>
                </div>
            </div>
            {loadError && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {loadError}
                </div>
            )}

            <div className="ws-reports-kpi-grid">
                {kpis.map((k) => (
                    <button
                        key={k.id}
                        type="button"
                        className="ws-kpi-card ws-kpi-card--clickable"
                        onClick={() => setKpiProofModalId(k.id)}
                        aria-label={`${k.label}: view calculation breakdown`}
                    >
                        <p className="ws-kpi-label">{k.label}</p>
                        <h3 className={`ws-kpi-value ${k.color}`}>{k.value}</h3>
                        {k.sub && <p className="ws-kpi-sub">{k.sub}</p>}
                        <p className="ws-kpi-proof-hint">Click for breakdown</p>
                    </button>
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
                        </div>
                        <div className="ws-chart-container">
                            <h4 className="ws-chart-title">Daily Revenue</h4>
                            <div className="ws-chart-canvas">
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
                                            dataKey="day"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 12, fill: '#6B7280' }}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                        <Tooltip
                                            cursor={{ fill: '#F9FAFB' }}
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: 'none',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                            }}
                                        />
                                        <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} style={{ cursor: 'pointer' }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="ws-report-table-wrapper">
                            <WsTableScroll>
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
                                        filteredDailyRevenue.map((d, i) => (
                                            <tr
                                                key={`${d.date}-${i}`}
                                                onClick={() => loadDetails('daily_sales', d)}
                                                style={{
                                                    cursor: 'pointer',
                                                    background:
                                                        selectedDetailKey === `daily_sales:${d.date}`
                                                            ? '#F8FAFC'
                                                            : undefined,
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
                            </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_technician', filteredByTechnician.length)}
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
                        </div>
                        <div className="ws-chart-container">
                            <h4 className="ws-chart-title">Revenue by Technician</h4>
                            <div className="ws-chart-canvas">
                                <ResponsiveContainer>
                                    <BarChart
                                        data={filteredByTechnician}
                                        layout="vertical"
                                        margin={{ left: 40, right: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#6B7280' }}
                                            width={120}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#F9FAFB' }}
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: 'none',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                            }}
                                        />
                                        <Bar dataKey="revenue" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="ws-report-table-wrapper">
                            <WsTableScroll>
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
                                        filteredByTechnician.map((t) => (
                                            <tr
                                                key={t.id || t.name}
                                                onClick={() => loadDetails('by_technician', t)}
                                                style={{ cursor: 'pointer', background: selectedDetailKey === `by_technician:${t.id}` ? '#F8FAFC' : undefined }}
                                            >
                                                <td>
                                                    <strong>{t.name}</strong>
                                                </td>
                                                <td>{t.completedJobs}</td>
                                                <td className="ws-font-bold">SAR {t.revenue.toLocaleString()}</td>
                                                <td className="ws-font-bold">SAR {t.commission.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            </WsTableScroll>
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
                        </div>
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
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
                                    filteredByCustomer.map((row, i) => (
                                        <tr
                                            key={row.customer_id ?? row.customerId ?? i}
                                            onClick={() => loadDetails('by_customer', row)}
                                            style={{ cursor: 'pointer', background: selectedDetailKey === `by_customer:${String(row.customer_id ?? row.customerId ?? '')}` ? '#F8FAFC' : undefined }}
                                        >
                                            <td>
                                                <strong>
                                                    {row.customer_mobile ??
                                                        row.customerMobile ??
                                                        row.phone ??
                                                        row.mobile ??
                                                        '—'}
                                                </strong>
                                            </td>
                                            <td>
                                                {Array.isArray(row.plate_numbers ?? row.plateNumbers) &&
                                                (row.plate_numbers ?? row.plateNumbers).length > 0
                                                    ? (row.plate_numbers ?? row.plateNumbers).join(', ')
                                                    : formatPlateLettersFirst(row.plate_no ?? row.plateNo ?? '') || '—'}
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
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_customer', filteredByCustomer.length)}
                    </>
                )}

                {activeTab === 'by_product' && (
                    <>
                        <div className="ws-report-tab-toolbar ws-report-tab-toolbar--split">
                            <div className="ws-report-tab-toolbar-left">
                                <div className="ws-report-tab-field ws-report-tab-field--technician">
                                    <label className="ws-report-tab-field-label" htmlFor="ws-by-product-technician">
                                        Technician
                                    </label>
                                    <SearchableEntityCombobox
                                        id="ws-by-product-technician"
                                        className="ws-report-tab-combobox"
                                        options={technicianComboboxOptions}
                                        value={byProductTechnicianId}
                                        displayText={byProductTechnicianFilterText}
                                        entityLabel="technician"
                                        placeholder="All technicians — search…"
                                        emptyHint="No technicians match — clear to show all"
                                        disabled={isLoading || byProductTechnicianLoading}
                                        onDisplayTextChange={(text) => {
                                            setByProductTechnicianFilterText(text);
                                            if (!text.trim()) {
                                                resetByProductTechnicianFilter();
                                            }
                                        }}
                                        onSelect={(opt) => {
                                            detailAnchorRef.current = null;
                                            setByProductTechnicianId(String(opt.id));
                                            setByProductTechnicianFilterText(opt.label || '');
                                            setSelectedDetailKey('');
                                            setDetailRows([]);
                                            setDetailsTitle('');
                                            setDetailsError('');
                                            setByProductTechnicianError('');
                                            setSummaryPages((prev) => ({ ...prev, by_product: 1 }));
                                        }}
                                    />
                                </div>
                                {byProductTechnicianLoading && (
                                    <span className="ws-text-dim ws-report-tab-inline-hint">Updating…</span>
                                )}
                            </div>
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder="Search product, qty, revenue…"
                                value={tabSearch.by_product}
                                onChange={(e) => setTabSearch((p) => ({ ...p, by_product: e.target.value }))}
                                aria-label="Search by product"
                            />
                        </div>
                        {byProductTechnicianError && (
                            <p className="ws-report-tab-inline-error" role="alert">
                                {byProductTechnicianError}
                            </p>
                        )}
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>PRODUCT</th>
                                    <th>QTY</th>
                                    <th>REVENUE (SAR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(norm?.byProduct ?? []).length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            No product breakdown for this scope.
                                        </td>
                                    </tr>
                                ) : filteredByProduct.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            No rows match your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredByProduct.map((row, i) => (
                                        <tr
                                            key={row.product_id ?? row.productId ?? i}
                                            onClick={() => {
                                                if (!byProductTechnicianLoading) loadDetails('by_product', row);
                                            }}
                                            style={{
                                                cursor: byProductTechnicianLoading ? 'wait' : 'pointer',
                                                opacity: byProductTechnicianLoading ? 0.65 : undefined,
                                                background:
                                                    selectedDetailKey === `by_product:${String(row.product_id ?? row.productId ?? '')}`
                                                        ? '#F8FAFC'
                                                        : undefined,
                                            }}
                                        >
                                            <td>
                                                <strong>{row.product_name ?? row.productName ?? row.product_id ?? row.productId ?? '—'}</strong>
                                            </td>
                                            <td>{toNumber(row.qty_sold ?? row.qtySold)}</td>
                                            <td className="ws-font-bold">
                                                SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_product', filteredByProduct.length)}
                    </>
                )}

                {activeTab === 'by_service' && (
                    <>
                        <div className="ws-report-tab-toolbar ws-report-tab-toolbar--split">
                            <div className="ws-report-tab-toolbar-left">
                                <div className="ws-report-tab-field ws-report-tab-field--technician">
                                    <label className="ws-report-tab-field-label" htmlFor="ws-by-service-technician">
                                        Technician
                                    </label>
                                    <SearchableEntityCombobox
                                        id="ws-by-service-technician"
                                        className="ws-report-tab-combobox"
                                        options={technicianComboboxOptions}
                                        value={byServiceTechnicianId}
                                        displayText={byServiceTechnicianFilterText}
                                        entityLabel="technician"
                                        placeholder="All technicians — search…"
                                        emptyHint="No technicians match — clear to show all"
                                        disabled={isLoading || byServiceTechnicianLoading}
                                        onDisplayTextChange={(text) => {
                                            setByServiceTechnicianFilterText(text);
                                            if (!text.trim()) {
                                                resetByServiceTechnicianFilter();
                                            }
                                        }}
                                        onSelect={(opt) => {
                                            detailAnchorRef.current = null;
                                            setByServiceTechnicianId(String(opt.id));
                                            setByServiceTechnicianFilterText(opt.label || '');
                                            setSelectedDetailKey('');
                                            setDetailRows([]);
                                            setDetailsTitle('');
                                            setDetailsError('');
                                            setByServiceTechnicianError('');
                                            setSummaryPages((prev) => ({ ...prev, by_service: 1 }));
                                        }}
                                    />
                                </div>
                                {byServiceTechnicianLoading && (
                                    <span className="ws-text-dim ws-report-tab-inline-hint">Updating…</span>
                                )}
                            </div>
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder="Search service, qty, revenue…"
                                value={tabSearch.by_service}
                                onChange={(e) => setTabSearch((p) => ({ ...p, by_service: e.target.value }))}
                                aria-label="Search by service"
                            />
                        </div>
                        {byServiceTechnicianError && (
                            <p className="ws-report-tab-inline-error" role="alert">
                                {byServiceTechnicianError}
                            </p>
                        )}
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>SERVICE</th>
                                    <th>QTY</th>
                                    <th>REVENUE (SAR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(norm?.byService ?? []).length === 0 && !byServiceTechnicianId ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            No service breakdown for this scope.
                                        </td>
                                    </tr>
                                ) : filteredByService.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            {byServiceTechnicianId
                                                ? 'No service sales for this technician in the selected range.'
                                                : 'No rows match your search.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredByService.map((row, i) => (
                                        <tr
                                            key={row.service_id ?? row.serviceId ?? i}
                                            onClick={() => {
                                                if (!byServiceTechnicianLoading) loadDetails('by_service', row);
                                            }}
                                            style={{
                                                cursor: byServiceTechnicianLoading ? 'wait' : 'pointer',
                                                opacity: byServiceTechnicianLoading ? 0.65 : undefined,
                                                background:
                                                    selectedDetailKey === `by_service:${String(row.service_id ?? row.serviceId ?? '')}`
                                                        ? '#F8FAFC'
                                                        : undefined,
                                            }}
                                        >
                                            <td>
                                                <strong>{row.service_name ?? row.serviceName ?? row.service_id ?? row.serviceId ?? '—'}</strong>
                                            </td>
                                            <td>{toNumber(row.qty_sold ?? row.qtySold)}</td>
                                            <td className="ws-font-bold">
                                                SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_service', filteredByService.length)}
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
                        </div>
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
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
                                    filteredByDepartment.map((row, i) => (
                                        <tr
                                            key={row.department_id ?? row.departmentId ?? i}
                                            onClick={() => loadDetails('by_department', row)}
                                            style={{ cursor: 'pointer', background: selectedDetailKey === `by_department:${String(row.department_id ?? row.departmentId ?? '')}` ? '#F8FAFC' : undefined }}
                                        >
                                            <td>
                                                <strong>{row.department_name ?? row.departmentName ?? '—'}</strong>
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
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_department', filteredByDepartment.length)}
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
                        </div>
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
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
                                    filteredByCategory.map((row, i) => {
                                        const rowKey = String(row.category_id ?? row.categoryId ?? i);
                                        return (
                                            <tr
                                                key={rowKey}
                                                onClick={() => loadDetails('by_category', row)}
                                                style={{
                                                    cursor: 'pointer',
                                                    background:
                                                        selectedDetailKey === `by_category:${rowKey}`
                                                            ? '#F8FAFC'
                                                            : undefined,
                                                }}
                                            >
                                                <td>
                                                    <strong>{row.category_name ?? row.categoryName ?? '—'}</strong>
                                                </td>
                                                <td>{toNumber(row.qty_sold ?? row.qtySold)}</td>
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
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_category', filteredByCategory.length)}
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
                        </div>
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
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
                                            No branch breakdown (try “All branches”).
                                        </td>
                                    </tr>
                                ) : filteredByBranch.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            No rows match your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredByBranch.map((row, i) => (
                                        <tr
                                            key={row.branch_id ?? row.branchId ?? i}
                                            onClick={() => loadDetails('by_branch', row)}
                                            style={{ cursor: 'pointer', background: selectedDetailKey === `by_branch:${String(row.branch_id ?? row.branchId ?? '')}` ? '#F8FAFC' : undefined }}
                                        >
                                            <td>
                                                <strong>{row.branch_name ?? row.branchName ?? '—'}</strong>
                                            </td>
                                            <td>{toNumber(row.completed_orders ?? row.completedOrders)}</td>
                                            <td className="ws-font-bold">
                                                SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_branch', filteredByBranch.length)}
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
                        </div>
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
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
                                    filteredByCashier.map((row, i) => {
                                        const rowKey = String(
                                            row.cashier_id ?? row.cashierId ?? row.user_id ?? row.userId ?? i,
                                        );
                                        return (
                                            <tr
                                                key={rowKey}
                                                onClick={() => loadDetails('by_cashier', row)}
                                                style={{
                                                    cursor: 'pointer',
                                                    background:
                                                        selectedDetailKey === `by_cashier:${rowKey}` ? '#F8FAFC' : undefined,
                                                }}
                                            >
                                                <td>
                                                    <strong>{row.name ?? '—'}</strong>
                                                </td>
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
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_cashier', filteredByCashier.length)}
                    </>
                )}

                {activeTab === 'recent_orders' && (
                    <>
                        <div className="ws-report-tab-toolbar ws-report-orders-toolbar">
                            <select
                                value={ordersPaymentMethod}
                                onChange={(e) => setOrdersPaymentMethod(e.target.value)}
                                className="ws-report-tab-select"
                                aria-label="Filter by payment method"
                            >
                                <option value="">All payment methods</option>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="bank">Bank Transfer</option>
                                <option value="wallet">Wallet</option>
                                <option value="corporate_credit">Corporate Credit</option>
                                <option value="monthly_billing">Monthly Billing</option>
                                <option value="pay_monthly">Pay Monthly</option>
                                <option value="unpaid">Unpaid</option>
                            </select>
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder="Search invoice no., order id, customer, plate, phone…"
                                value={ordersSearchInput}
                                onChange={(e) => setOrdersSearchInput(e.target.value)}
                                aria-label="Search orders"
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
                        <div className="ws-report-table-wrapper ws-report-table-wrapper--actions">
                            <WsTableScroll>
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
                                    <th style={{ width: 56 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {ordersListLoading && recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            Loading orders…
                                        </td>
                                    </tr>
                                ) : ordersTotal === 0 && !ordersListLoading ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            {ordersSearchDebounced
                                                ? 'No orders match your search in this date range.'
                                                : 'No orders in this scope.'}
                                        </td>
                                    </tr>
                                ) : (
                                    recentOrders.map((row, i) => {
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
                                            <td>
                                                <div>{row.customerName ?? '—'}</div>
                                                {row.customerMobile || row.phone ? (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                        {row.customerMobile ?? row.phone}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td>{row.plateNo ? formatPlateLettersFirst(row.plateNo) : '—'}</td>
                                            <td className="ws-font-bold">SAR {toNumber(row.invoiceTotal).toLocaleString()}</td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <RowActionsMenu
                                                    disabled={recentOrderActionBusyId === rk}
                                                    ariaLabel={isOpen ? 'Order actions' : 'Invoice actions'}
                                                    items={[
                                                        {
                                                            label: isOpen ? 'View order' : 'View Invoice',
                                                            onClick: () => handleRecentOrderAction(row, 'view'),
                                                        },
                                                        ...(!isOpen
                                                            ? [
                                                                  {
                                                                      label: 'Download PDF',
                                                                      onClick: () => handleRecentOrderAction(row, 'download'),
                                                                  },
                                                                  {
                                                                      label: 'Send Invoice to WhatsApp (PDF)',
                                                                      onClick: () => handleRecentOrderAction(row, 'whatsapp'),
                                                                  },
                                                              ]
                                                            : []),
                                                    ]}
                                                />
                                            </td>
                                        </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
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

            {kpiProofModalId && (
                <Modal
                    title={kpiProofModalTitle}
                    contentClassName="ws-modal-kpi-proof"
                    onClose={() => setKpiProofModalId(null)}
                    width="min(960px, 96vw)"
                >
                    {renderKpiProofBody()}
                </Modal>
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
                                <WsTableScroll>
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
                                        <tr><th>VEHICLE NO</th><td>{recentOrderDetails.vehicleNo ? formatPlateLettersFirst(recentOrderDetails.vehicleNo) : '—'}</td></tr>
                                        <tr><th>DEPARTMENTS</th><td>{(recentOrderDetails.departments ?? []).map((d) => d?.name).filter(Boolean).join(', ') || '—'}</td></tr>
                                        <tr><th>TECHNICIANS</th><td>{(recentOrderDetails.technicians ?? []).map((t) => t?.name).filter(Boolean).join(', ') || '—'}</td></tr>
                                        <tr className="ws-order-details-total-row">
                                            <th>TOTAL AMOUNT</th>
                                            <td className="ws-font-bold">
                                                SAR {toNumber(recentOrderDetails.totalAmount).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </td>
                                        </tr>
                                        <tr><th>PAYMENT METHOD</th><td>{recentOrderDetails.paymentMethod ?? '—'}</td></tr>
                                        <tr><th>CUSTOMER TYPE</th><td>{recentOrderDetails.customerType ?? '—'}</td></tr>
                                    </tbody>
                                </table>
                                </WsTableScroll>
                            </div>
                            {Array.isArray(recentOrderDetails.jobsDetail) && recentOrderDetails.jobsDetail.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Jobs</p>
                                    <WsTableScroll bodyClassName="ws-order-details-table-scroll">
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
                                                    <th>Technicians</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentOrderDetails.jobsDetail.map((job) => (
                                                    <tr key={job.jobId}>
                                                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{job.jobId ?? '—'}</td>
                                                        <td>{job.departmentName ?? '—'}</td>
                                                        <td>{formatOrderStatusLabel(job.status)}</td>
                                                        <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                                            {formatReportInstant(job.createdAt)}
                                                        </td>
                                                        <td style={{ fontSize: '0.8125rem' }}>{formatJobCompletedDisplay(job)}</td>
                                                        <td>{formatDiscountCell(job.totalDiscountType, job.totalDiscountValue)}</td>
                                                        <td>SAR {toNumber(job.promoDiscountAmount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.amountBeforeDiscount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.amountAfterDiscount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.vatAmount).toLocaleString()}</td>
                                                        <td className="ws-font-bold">SAR {toNumber(job.totalAmount).toLocaleString()}</td>
                                                        <td style={{ fontSize: '0.8125rem', minWidth: 160 }}>
                                                            {(job.assignments ?? []).length === 0 ? (
                                                                '—'
                                                            ) : (
                                                                (job.assignments ?? []).map((a, idx) => (
                                                                    <div
                                                                        key={`${job.jobId}-${idx}`}
                                                                        style={{
                                                                            marginBottom:
                                                                                idx < (job.assignments ?? []).length - 1 ? 8 : 0,
                                                                        }}
                                                                    >
                                                                        <div>
                                                                            {[a.technicianName || '—', a.assignmentType, formatOrderStatusLabel(a.assignmentStatus)]
                                                                                .filter(Boolean)
                                                                                .join(' · ')}
                                                                        </div>
                                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                                            {a.respondedAt
                                                                                ? `Responded ${formatReportInstant(a.respondedAt)}`
                                                                                : `Assigned ${formatReportInstant(a.assignedAt)}`}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </WsTableScroll>
                                </div>
                            ) : null}
                            {Array.isArray(recentOrderDetails.lineItems) && recentOrderDetails.lineItems.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Line items</p>
                                    <WsTableScroll bodyClassName="ws-order-details-table-scroll">
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
                                                        <td style={{ fontSize: '0.8125rem' }}>
                                                            {toNumber(row.vatPercent)}% · {String(row.vatMode ?? '—')}
                                                        </td>
                                                        <td className="ws-font-bold">{toNumber(row.lineTotal).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </WsTableScroll>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </Modal>
            )}

            <InvoiceDetailsModal
                invoice={invoicePreviewData}
                isOpen={!!invoicePreviewData}
                footerVariant="corporate"
                onClose={() => {
                    setInvoicePreviewData(null);
                }}
            />
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
                                    'jobId',
                                    'job_id',
                                    'departmentId',
                                    'department_id',
                                    'branchId',
                                    'branch_id',
                                    'customerId',
                                    'customer_id',
                                    'issuedAt',
                                    'issued_at',
                                ]);
                                const columns = Object.keys(detailRows[0] || {}).filter((k) => !hiddenCols.has(k));
                                const moneyTotals = sumDetailMoneyColumns(detailRows, columns);
                                const hasMoneyTotals = Object.keys(moneyTotals).length > 0;
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
                                                                                    const sub = formatWorkshopLineItemCardSubtext(item);
                                                                                    return (
                                                                                        <>
                                                                                            <div style={{ fontSize: 11, color: '#6B7280' }}>
                                                                                                {sub.line1}
                                                                                            </div>
                                                                                            <div style={{ fontSize: 11, color: '#6B7280' }}>
                                                                                                {sub.line2}
                                                                                            </div>
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
                                        {hasMoneyTotals ? (
                                            <tfoot>
                                                <tr
                                                    style={{
                                                        fontWeight: 700,
                                                        background: '#F1F5F9',
                                                        borderTop: '2px solid #E2E8F0',
                                                    }}
                                                >
                                                    {columns.map((k, colIdx) => (
                                                        <td key={k} style={{ padding: '10px' }}>
                                                            {colIdx === 0
                                                                ? 'Total'
                                                                : isMoneyDetailColumnKey(k)
                                                                  ? formatCurrency(moneyTotals[k])
                                                                  : ''}
                                                        </td>
                                                    ))}
                                                </tr>
                                            </tfoot>
                                        ) : null}
                                    </table>
                                </div>
                            </>
                                );
                            })()}
                        </div>
                    )}
                </Modal>
            )}
            {norm?.definitions && typeof norm.definitions === 'object' && Object.keys(norm.definitions).length > 0 ? (
                <details className="ws-section" style={{ marginTop: 20 }}>
                    <summary className="ws-text-dim" style={{ cursor: 'pointer', fontWeight: 600 }}>
                        Metric definitions (from API)
                    </summary>
                    <div
                        className="ws-kpi-proof-methodology"
                        style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}
                    >
                        {Object.entries(norm.definitions).map(([key, text]) => (
                            <p key={key} style={{ margin: 0 }}>
                                <strong>{key.replace(/_/g, ' ')}:</strong> {String(text ?? '')}
                            </p>
                        ))}
                    </div>
                </details>
            ) : null}
        </div>
    );
}
