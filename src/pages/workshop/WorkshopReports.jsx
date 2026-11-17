import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import { isInactiveRecord } from '../../utils/inactiveRecords';
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
    unwrapWorkshopStaffList,
    workshopReportsAnalyticsParams,
    workshopStaffListScopeQuery,
} from '../../services/workshopStaffApi';
import { formatPlateLettersFirst } from '../../utils/formatPlate';
import { wrColT, wrT } from '../../utils/workshopReportsI18n';
import { formatTransferDate, transferPlaceLabel } from '../../utils/staffTransfer';
import {
    INV_COST_BASIS_LATEST,
    INV_COST_BASIS_WEIGHTED,
    parseInventoryCostBasisParam,
} from '../../utils/workshopInventoryI18n';
import {
    formatReportsKpiAmount,
    mapReportsAnalyticsKpis,
} from './reportsKpiMapper';
import { buildProofHref } from '../../components/accounting/reports/reportProofLinks';
import {
    applyReportsDraft,
    appliedReportsRequestKey,
    cancelReportsDraft,
    createReportsScope,
    defaultReportsTodayScope,
    fullDayEndExclusiveLocal,
    fullDayStartLocal,
    isAuthorizedReportsBranch,
    parseReportsScopeFromSearchParams,
    reportsScopeToApiParams,
    reportsScopeToSharedDatetime,
    resetReportsScope,
    scopesEqual,
    writeReportsScopeToSearchParams,
} from './reportsAnalyticsScope';
import {
    STOCK_PROOF_PAGE_SIZE,
    buildReportsKpiCardModels,
    pageRowsAreNotFullProof,
    paginateRows,
    stockProofSections,
    stockTableShouldBeInline,
} from './reportsKpiCards';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/** `sales_orders.source` → short label (POS / workshop reports). */
function formatOrderSourceLabel(source, t) {
    const s = String(source ?? '')
        .trim()
        .toLowerCase();
    if (s === 'walk_in') return t('source.walkIn');
    if (s === 'walk_in_corporate') return t('source.walkInCorporate');
    if (s === 'takeaway') return t('source.takeaway');
    if (!s) return t('emdash');
    return s
        .split('_')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
        .join(' ');
}

/** `sales_orders.status` → readable title (spaces / underscores). */
function formatOrderStatusLabel(status, t) {
    if (status == null || String(status).trim() === '') return t('emdash');
    const raw = String(status).trim();
    const key = `status.${raw.toLowerCase().replace(/-/g, '_')}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return raw
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDiscountCell(discountType, discountValue, t) {
    const dtype = String(discountType ?? '').toLowerCase();
    const v = toNumber(discountValue);
    if (!v) return t('emdash');
    if (dtype === 'percent' || dtype === 'percentage') return `${v}%`;
    return t('money.sar', { amount: v.toLocaleString() });
}

const formatCurrency = (value, t) => t('money.sar', { amount: toNumber(value).toLocaleString() });

const mapRecentPdfToInvoice = (raw, t) => {
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
        (t ? t('pay.unpaid') : 'Unpaid');
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
        zatca: src.zatca || null,
    };
};

import {
    toRiyadhDatetimeLocalValue,
    reportsRangeQueryParams,
    riyadhPlRangeToLedgerCalendarDates,
} from '../../utils/riyadhBusinessRange';
import { saveWorkshopAdminDatetimeRange } from './workshopAdminDatetimeRange';
import SelectCombo from '../../components/SelectCombo';
import WsTablePagination from '../../components/workshop/WsTablePagination';
import { TABLE_PAGE_SIZES, usePagedRows } from '../../hooks/usePagedRows';

/** `YYYY-MM-DDTHH:mm` for `<input type="datetime-local" />` — Asia/Riyadh wall clock. */
function toDatetimeLocalValue(d) {
    return toRiyadhDatetimeLocalValue(d);
}

/** Reports shared window: calendar YMD or precise Riyadh ISO. Equal midnights rejected. */
function rangeToApiIso(rangeFromLocal, rangeToLocal, t, rangeKind = 'precise') {
    try {
        return reportsRangeQueryParams(rangeFromLocal, rangeToLocal, rangeKind);
    } catch (err) {
        const key = err?.code === 'REPORT_RANGE_INVALID' ? 'err.equalMidnight' : 'err.invalidRange';
        throw new Error(
            t
                ? t(key)
                : err?.message || 'Invalid date/time range.',
        );
    }
}

function reportsScopeErrorMessage(code, t) {
    if (code === 'equalMidnight') return t('err.equalMidnight');
    if (code === 'startAfterEnd') return t('err.startAfterEnd');
    return t('err.invalidRange');
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
function formatWorkshopLineItemCardSubtext(item, t) {
    const qty = item.qty ?? item.quantity;
    const unit = toNumber(item.unitPrice ?? item.unit_price);
    const dType = String(item.discountType ?? item.discount_type ?? '').toLowerCase();
    const dVal = toNumber(item.discountValue ?? item.discount_value);
    const vatPct = toNumber(item.vatPercent ?? item.vat_percent);
    const vatMode = String(item.vatMode ?? item.vat_mode ?? '').trim();
    const line = toNumber(item.lineTotal ?? item.line_total);
    const em = t('emdash');
    const disc =
        dVal > 0
            ? dType === 'percent' || dType === 'percentage'
                ? t('line.discountPct', { pct: dVal })
                : t('line.discountSar', { amount: dVal.toLocaleString() })
            : t('line.discountNone');
    const line1 = t('line.line1', {
        type: item.itemType ?? item.item_type ?? t('line.itemFallback'),
        qty: qty ?? em,
        unit: unit.toLocaleString(),
    });
    const line2 = t('line.line2', {
        disc,
        vat: Number.isFinite(vatPct) && vatPct > 0 ? `${vatPct}%` : em,
        vatMode: vatMode ? ` (${vatMode})` : '',
        line: line.toLocaleString(),
    });
    return { line1, line2 };
}

/** Recent orders row or details payload: prefer wall-clock issue time, then calendar invoice date. */
function formatInvoiceDateTimeForDisplay(rowOrDetails, t) {
    const raw =
        rowOrDetails?.issuedAt ??
        rowOrDetails?.issued_at ??
        rowOrDetails?.dateTime ??
        rowOrDetails?.invoiceDate ??
        rowOrDetails?.invoice_date;
    if (raw == null || raw === '') return t ? t('emdash') : '—';
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
function formatReportInstant(iso, t) {
    if (iso == null || iso === '') return t ? t('emdash') : '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t ? t('emdash') : '—';
    return d.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatJobCompletedDisplay(job, t) {
    if (!job) return t('emdash');
    if (job.completedAt) return formatReportInstant(job.completedAt, t);
    const st = String(job.status ?? '').toLowerCase();
    if (st === 'edited') return t('status.reopenedEdit');
    return t('emdash');
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

const REPORTS_SUMMARY_PAGE_SIZE = 50;

/**
 * Product/service filters must include anyone with sales in the period — not only the
 * current-branch roster — so transferred technicians match the By technician tab.
 */
function mergeTechnicianPickerOptions(rosterRows, reportRows, t) {
    const byId = new Map();
    for (const techRow of rosterRows) {
        const id = String(techRow?.id ?? techRow?.employeeId ?? '');
        if (!id) continue;
        byId.set(id, {
            id,
            name: String(techRow?.name ?? '').trim() || t('fallback.technician'),
            inactive: isInactiveRecord(techRow),
            phone: techRow?.phone ? String(techRow.phone) : '',
            transfer: null,
        });
    }
    for (const row of reportRows) {
        const id = String(row?.technician_id ?? row?.technicianId ?? row?.id ?? '');
        if (!id) continue;
        const name = String(row?.name ?? '').trim() || t('fallback.technician');
        const transfer = row?.transfer ?? null;
        const existing = byId.get(id);
        if (existing) {
            if (!existing.name || existing.name === t('fallback.technician')) {
                existing.name = name;
            }
            if (!existing.transfer && transfer) existing.transfer = transfer;
            continue;
        }
        byId.set(id, {
            id,
            name,
            inactive: false,
            phone: '',
            transfer,
        });
    }
    return [...byId.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

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

export default function WorkshopReports({ selectedBranchId = 'all', branches = [], locale: localeProp }) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wrT(locale, key, vars), [locale]);
    const { hasPermission } = useAuth();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const costBasis = parseInventoryCostBasisParam(searchParams.get('costBasis'));
    const setCostBasis = useCallback((next) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('costBasis', parseInventoryCostBasisParam(next));
        setSearchParams(nextParams, { replace: true });
    }, [searchParams, setSearchParams]);
    const orderDeepLinkHandledRef = useRef('');
    /** Which Reports inner tabs is the user allowed to view? */
    const visibleReportTabIds = useMemo(
        () => Object.entries(REPORTS_TAB_PERMISSION)
            .filter(([, code]) => hasPermission(code))
            .map(([id]) => id),
        [hasPermission],
    );

    const initialScope = useMemo(
        () => parseReportsScopeFromSearchParams(searchParams) || defaultReportsTodayScope(),
        // URL is read once on mount; later edits go through Apply.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const [appliedScope, setAppliedScope] = useState(initialScope);
    const [draftScope, setDraftScope] = useState(initialScope);
    const rangeKind = appliedScope.rangeKind === 'precise' ? 'precise' : 'calendar';
    const rangeFromLocal = appliedScope.timeMode === 'custom_time'
        ? appliedScope.fromLocal
        : appliedScope.dateFrom;
    const rangeToLocal = appliedScope.timeMode === 'custom_time'
        ? appliedScope.toLocal
        : appliedScope.dateTo;
    const [rangeFormError, setRangeFormError] = useState('');
    const [stockProofPage, setStockProofPage] = useState(1);
    const kpiProofTriggerRef = useRef(null);
    const reportsLoadGenRef = useRef(0);
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
    const [ordersPageSize, setOrdersPageSize] = useState(TABLE_PAGE_SIZES[0]);
    const [ordersTotal, setOrdersTotal] = useState(0);
    const [ordersSearchInput, setOrdersSearchInput] = useState('');
    const [ordersSearchDebounced, setOrdersSearchDebounced] = useState('');
    const [ordersPaymentMethod, setOrdersPaymentMethod] = useState('');
    const [ordersListLoading, setOrdersListLoading] = useState(false);
    const [ordersListError, setOrdersListError] = useState('');
    const [summaryPages, setSummaryPages] = useState(createEmptySummaryPages);
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
        if (!selectedBranchId || selectedBranchId === 'all') return t('branch.all');
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || t('branch.fallback');
    }, [branches, selectedBranchId, t]);

    const fetchRecentOrdersList = useCallback(async () => {
        setOrdersListLoading(true);
        setOrdersListError('');
        try {
            const rangeParams = rangeToApiIso(rangeFromLocal, rangeToLocal, t, rangeKind);
            const params = workshopReportsAnalyticsParams(selectedBranchId, rangeParams);
            const limit = ordersPageSize;
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
            setOrdersListError(e?.message || t('err.loadOrders'));
        } finally {
            setOrdersListLoading(false);
        }
    }, [selectedBranchId, rangeFromLocal, rangeToLocal, rangeKind, ordersPage, ordersPageSize, ordersSearchDebounced, ordersPaymentMethod, t]);

    const fetchRecentOrdersListRef = useRef(fetchRecentOrdersList);
    fetchRecentOrdersListRef.current = fetchRecentOrdersList;

    const fetchSummaryTabPage = useCallback(
        async (tabId, page = 1) => {
            const rangeParams = rangeToApiIso(rangeFromLocal, rangeToLocal, t, rangeKind);
            const technicianId =
                tabId === 'by_product'
                    ? byProductTechnicianId
                    : tabId === 'by_service'
                      ? byServiceTechnicianId
                      : '';
            const baseParams = workshopReportsAnalyticsParams(selectedBranchId, {
                ...rangeParams,
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
                }
            }
            try {
                const res = await fetcher(params);
                const rows = extractSummaryRows(res, tabId);
                setSummaryData((prev) => ({ ...prev, [tabId]: rows }));
                if (tabId === 'by_product') setByProductTechnicianError('');
                if (tabId === 'by_service') setByServiceTechnicianError('');
                return { rows };
            } catch (err) {
                if (tabId === 'by_product') {
                    setByProductTechnicianError(err?.message || t('err.loadProductTech'));
                }
                if (tabId === 'by_service') {
                    setByServiceTechnicianError(err?.message || t('err.loadServiceTech'));
                }
                throw err;
            } finally {
                if (tabId === 'by_product') setByProductTechnicianLoading(false);
                if (tabId === 'by_service') setByServiceTechnicianLoading(false);
                setSummaryLoading((prev) => ({ ...prev, [tabId]: false }));
            }
        },
        [selectedBranchId, rangeFromLocal, rangeToLocal, rangeKind, byProductTechnicianId, byServiceTechnicianId, t],
    );

    const loadReports = useCallback(async (signal) => {
        const gen = ++reportsLoadGenRef.current;
        setIsLoading(true);
        setLoadError('');
        setDetailsError('');
        setReportData(null);
        setKpiProofModalId(null);
        setOrdersPage(1);
        setSummaryPages(createEmptySummaryPages());
        if (!isAuthorizedReportsBranch(selectedBranchId, branches)) {
            setLoadError(t('kpi.unauthorized'));
            setIsLoading(false);
            return;
        }
        try {
            const rangeParams = reportsScopeToApiParams(appliedScope);
            const params = {
                ...workshopReportsAnalyticsParams(selectedBranchId, rangeParams),
                costBasis,
            };
            const [response, techniciansRes] = await Promise.all([
                getWorkshopReportsAnalytics(params, signal ? { signal } : {}),
                getWorkshopTechnicians(workshopStaffListScopeQuery(selectedBranchId)),
            ]);
            if (signal?.aborted || gen !== reportsLoadGenRef.current) return;
            if (!response?.success) {
                throw new Error(t('err.invalidReports'));
            }
            setReportData(response);
            setSummaryData({
                by_technician: extractSummaryRows(response, 'by_technician'),
                by_customer: extractSummaryRows(response, 'by_customer'),
                by_product: extractSummaryRows(response, 'by_product'),
                by_service: extractSummaryRows(response, 'by_service'),
                by_department: extractSummaryRows(response, 'by_department'),
                by_category: extractSummaryRows(response, 'by_category'),
                by_branch: extractSummaryRows(response, 'by_branch'),
                by_cashier: extractSummaryRows(response, 'by_cashier'),
            });
            const rawTech = unwrapWorkshopStaffList(techniciansRes, 'technician');
            const roster = rawTech
                .map((r) => flattenWorkshopStaffRow(r, 'technician'))
                .filter((techRow) => String(techRow?.id ?? techRow?.employeeId ?? ''));
            const reportTechs = extractSummaryRows(response, 'by_technician');
            setTechnicianOptions(mergeTechnicianPickerOptions(roster, reportTechs, t));
        } catch (error) {
            if (signal?.aborted || gen !== reportsLoadGenRef.current) return;
            if (error?.name === 'AbortError') return;
            setLoadError(error.message || t('err.loadAnalytics'));
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
            setRecentOrders([]);
            setOrdersTotal(0);
            setOrdersListError('');
            setTechnicianOptions([]);
            detailAnchorRef.current = null;
            setDetailRows([]);
            setSelectedDetailKey('');
            setDetailsTitle('');
        } finally {
            if (signal?.aborted || gen !== reportsLoadGenRef.current) return;
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
    }, [selectedBranchId, branches, appliedScope, byProductTechnicianId, byServiceTechnicianId, costBasis, t]);

    const rangeDirty = !scopesEqual(draftScope, appliedScope);

    const commitAppliedScope = useCallback((next) => {
        setAppliedScope(next);
        setDraftScope(next);
        setRangeFormError('');
        setKpiProofModalId(null);
        setStockProofPage(1);
        saveWorkshopAdminDatetimeRange(reportsScopeToSharedDatetime(next));
        setSearchParams(writeReportsScopeToSearchParams(searchParams, next), { replace: true });
    }, [searchParams, setSearchParams]);

    const applyDateRange = useCallback(() => {
        const result = applyReportsDraft(draftScope);
        if (!result.ok) {
            setRangeFormError(reportsScopeErrorMessage(result.code, t));
            return;
        }
        commitAppliedScope(result.applied);
    }, [draftScope, commitAppliedScope, t]);

    const cancelDateRange = useCallback(() => {
        setDraftScope(cancelReportsDraft(appliedScope));
        setRangeFormError('');
    }, [appliedScope]);

    const resetDateRange = useCallback(() => {
        commitAppliedScope(resetReportsScope());
    }, [commitAppliedScope]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setOrdersSearchDebounced(ordersSearchInput.trim());
        }, 380);
        return () => clearTimeout(timer);
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
        const techFilter =
            (activeTab === 'by_product' && byProductTechnicianId) ||
            (activeTab === 'by_service' && byServiceTechnicianId);
        if (activeSummaryPage === 1 && !techFilter) {
            return;
        }
        void fetchSummaryTabPage(activeTab, activeSummaryPage);
    }, [activeTab, activeSummaryPage, fetchSummaryTabPage, byProductTechnicianId, byServiceTechnicianId]);

    const technicianComboboxOptions = useMemo(
        () =>
            technicianOptions.map((techOpt) => {
                const transferSubtitle = techOpt.transfer
                    ? t('transfer.tag', {
                          from: techOpt.transfer.from_branch_name || t('fallback.unknown'),
                          date: formatTransferDate(techOpt.transfer.date, locale),
                      })
                    : '';
                return {
                    id: String(techOpt.id),
                    label: techOpt.name || t('fallback.technician'),
                    subtitle: techOpt.phone ? String(techOpt.phone) : transferSubtitle,
                    searchText: [techOpt.name, techOpt.phone, transferSubtitle]
                        .filter(Boolean)
                        .join(' '),
                    ...(techOpt.inactive ? { inactive: true } : {}),
                };
            }),
        [technicianOptions, t, locale],
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
        if (parseReportsScopeFromSearchParams(searchParams)) return;
        setSearchParams(writeReportsScopeToSearchParams(searchParams, appliedScope), { replace: true });
        // Seed URL once when the reports page has no scope params.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
        void loadReports(ac?.signal);
        return () => {
            try { ac?.abort(); } catch { /* ignore */ }
        };
    }, [loadReports]);

    const fetchRecentOrderDetails = useCallback(async (target) => {
        const rangeParams = rangeToApiIso(rangeFromLocal, rangeToLocal, t, rangeKind);
        const params = workshopReportsAnalyticsParams(selectedBranchId, rangeParams);
        const targetKey = String(target ?? '');
        if (targetKey.startsWith('so:')) {
            return await getWorkshopRecentOpenOrderDetails(targetKey.slice(3), params);
        }
        const invId = targetKey.startsWith('inv:') ? targetKey.slice(4) : targetKey;
        return await getWorkshopRecentOrderDetails(invId, params);
    }, [selectedBranchId, rangeFromLocal, rangeToLocal, rangeKind, t]);

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
        // Open before any await so the browser still treats this as the click
        // and allows the WhatsApp tab. Download then points that tab at the chat.
        const waTab = actionType === 'download' ? window.open('', '_blank') : null;
        try {
            if (isOpen) {
                if (waTab) waTab.close();
                if (actionType === 'view') {
                    void openRecentOrderDetails(target);
                } else {
                    window.alert(t('orders.noInvoiceYet'));
                }
                return;
            }
            const invoiceId = target.startsWith('inv:') ? target.slice(4) : target;
            const rangeParams = rangeToApiIso(rangeFromLocal, rangeToLocal, t, rangeKind);
            const params = workshopReportsAnalyticsParams(selectedBranchId, rangeParams);
            const res = await getWorkshopRecentOrderPdf(invoiceId, params);
            const invoiceObj = mapRecentPdfToInvoice(res, t);
            if (!invoiceObj) throw new Error(t('err.invalidInvoice'));
            if (actionType === 'view') {
                setInvoicePreviewData(invoiceObj);
            } else if (actionType === 'download') {
                await downloadPosInvoicePdf(invoiceObj);
                try {
                    const linkRes = await apiFetch(
                        `/workshop-staff/invoices/${encodeURIComponent(String(invoiceId))}/whatsapp-link`,
                    );
                    const waMeUrl = linkRes?.waMeUrl || linkRes?.data?.waMeUrl;
                    if (!waMeUrl) {
                        if (waTab) waTab.close();
                        window.alert(t('orders.whatsappNoPhone'));
                    } else {
                        if (waTab) waTab.location.href = waMeUrl;
                        else window.open(waMeUrl, '_blank', 'noopener,noreferrer');
                        window.alert(
                            linkRes?.pdfUrl
                                ? t('orders.whatsappOpenedPdf')
                                : t('orders.whatsappOpened'),
                        );
                    }
                } catch (waErr) {
                    if (waTab) waTab.close();
                    window.alert(waErr?.message || t('orders.whatsappNoPhone'));
                }
            } else if (actionType === 'whatsapp') {
                try {
                    const waRes = await apiFetch(
                        `/workshop-staff/invoices/${encodeURIComponent(String(invoiceId))}/send-whatsapp`,
                        { method: 'POST' },
                    );
                    const to = waRes?.to || waRes?.data?.to;
                    window.alert(
                        to
                            ? t('orders.whatsappSentTo', { to })
                            : t('orders.whatsappSent'),
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
                        throw new Error(t('orders.whatsappConfig', { msg }));
                    }
                    window.open(waMeUrl, '_blank', 'noopener,noreferrer');
                    window.alert(t('orders.whatsappManual'));
                }
            }
        } catch (error) {
            if (waTab && !waTab.closed) {
                try { waTab.close(); } catch { /* tab already left this page */ }
            }
            window.alert(error?.message || t('err.actionFailed'));
        } finally {
            setRecentOrderActionBusyId('');
        }
    }, [selectedBranchId, rangeFromLocal, rangeToLocal, rangeKind, openRecentOrderDetails, t]);

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
            const rangeParams = rangeToApiIso(rangeFromLocal, rangeToLocal, t, rangeKind);
            const params = workshopReportsAnalyticsParams(selectedBranchId, {
                ...rangeParams,
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
                title = t('details.title.technician', { name: row.name || t('details.techFallback') });
            } else if (tabId === 'by_customer') {
                fetcher = getWorkshopReportsByCustomerDetails;
                key = String(row.customer_id ?? row.customerId ?? '');
                title = t('details.title.customer', { name: row.customer_name ?? row.customerName ?? t('details.customerFallback') });
            } else if (tabId === 'by_product') {
                fetcher = getWorkshopReportsByProductDetails;
                key = String(row.product_id ?? row.productId ?? '');
                title = t('details.title.product', { name: row.product_name ?? row.productName ?? row.item_name ?? t('details.productFallback') });
            } else if (tabId === 'by_service') {
                fetcher = getWorkshopReportsByServiceDetails;
                key = String(row.service_id ?? row.serviceId ?? '');
                title = t('details.title.service', { name: row.service_name ?? row.serviceName ?? row.item_name ?? t('details.serviceFallback') });
            } else if (tabId === 'by_department') {
                fetcher = getWorkshopReportsByDepartmentDetails;
                key = String(row.department_id ?? row.departmentId ?? '');
                title = t('details.title.department', { name: row.department_name ?? row.departmentName ?? t('details.departmentFallback') });
            } else if (tabId === 'by_category') {
                fetcher = getWorkshopReportsByCategoryDetails;
                key = String(row.category_id ?? row.categoryId ?? 'uncategorized');
                title = t('details.title.category', { name: row.category_name ?? row.categoryName ?? t('details.categoryFallback') });
            } else if (tabId === 'by_branch') {
                fetcher = getWorkshopReportsByBranchDetails;
                key = String(row.branch_id ?? row.branchId ?? '');
                title = t('details.title.branch', { name: row.branch_name ?? row.branchName ?? t('details.branchFallback') });
            } else if (tabId === 'by_cashier') {
                fetcher = getWorkshopReportsByCashierDetails;
                key = String(row.cashier_id ?? row.cashierId ?? row.user_id ?? row.userId ?? '');
                title = t('details.title.cashier', { name: row.name ?? t('details.cashierFallback') });
            } else if (tabId === 'daily_sales') {
                fetcher = getWorkshopReportsDailySalesDetails;
                key = String(row.date ?? '').trim();
                title = t('details.title.dailySales', { label: `${row.day ? t('details.title.dailySalesDay', { day: row.day }) : ''}${key}` });
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
                setDetailsError(error?.message || t('err.loadDetails'));
                setDetailRows([]);
                detailAnchorRef.current = null;
            } finally {
                setDetailsLoading(false);
            }
        },
        [selectedBranchId, rangeFromLocal, rangeToLocal, rangeKind, byProductTechnicianId, byServiceTechnicianId, t],
    );

    loadDetailsRef.current = loadDetails;

    const norm = useMemo(() => {
        if (!reportData || typeof reportData !== 'object') return null;
        const r = reportData;
        const fo = r.financialOverview ?? {};
        const inv = r.inventoryValuation ?? {};

        const mapped = mapReportsAnalyticsKpis(r);
        const totalRevenue = mapped.netRevenueExVat ?? toNumber(r.total_revenue ?? fo.totalRevenue);
        const revenueChangePercent = mapped.netRevenueChangePercent ?? toNumber(r.revenue_change_percent ?? fo.revenueChangePercent);
        const stockValueCost = mapped.inventoryValueExVat ?? toNumber(r.stock_value_cost ?? inv.stockValueCost);
        const potentialProfit = mapped.potentialProfitExVat ?? toNumber(r.potential_profit ?? inv.potentialProfit);
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
            name: e.name || t('fallback.unknown'),
            completedJobs: toNumber(e.completed_jobs ?? e.totalJobs ?? e.orders),
            commission: toNumber(e.commission_sar ?? e.commission),
            revenue: toNumber(e.revenue_sar ?? e.revenue),
            transfer: e.transfer ?? null,
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
    }, [reportData, summaryData, byProductTechnicianId, byServiceTechnicianId, t]);

    const mappedKpis = useMemo(() => mapReportsAnalyticsKpis(reportData), [reportData]);

    const moneyOrDash = useCallback((amount) => {
        const formatted = formatReportsKpiAmount(amount);
        return formatted != null ? t('money.sar', { amount: formatted }) : t('emdash');
    }, [t]);

    const reportsRequestKey = appliedReportsRequestKey({
        branchId: selectedBranchId,
        scope: appliedScope,
        costBasis,
        generation: reportsLoadGenRef.current,
    });

    const gpProofHref = useMemo(() => {
        const m = mappedKpis;
        const gp = m.grossProfitGl;
        const attr = m.grossProfitAttributable;
        const gpUnavailable = gp?.status === 'unavailable' && !attr;
        const gpIncomplete = attr && attr.certified === false;
        const gpOperational = attr?.coveredGrossProfit;
        const gpPending = gpIncomplete
            ? gpOperational == null
            : gp == null || gp.grossProfit == null || gpUnavailable;
        if (gpPending || gpUnavailable || gpIncomplete || rangeKind !== 'calendar') return null;
        const ymd = riyadhPlRangeToLedgerCalendarDates(rangeFromLocal, rangeToLocal);
        return buildProofHref({
            report: 'pl',
            key: 'pl.grossProfit',
            filters: {
                dateFrom: m.kpiWindow?.startDate || ymd.dateFrom,
                dateTo: m.kpiWindow?.endDate || ymd.dateTo,
                branchId: !selectedBranchId || selectedBranchId === 'all' ? '' : String(selectedBranchId),
            },
            backHref: `${location.pathname}${location.search}`,
        });
    }, [mappedKpis, rangeKind, rangeFromLocal, rangeToLocal, selectedBranchId, location.pathname, location.search]);

    const kpiLoadState = !isAuthorizedReportsBranch(selectedBranchId, branches)
        ? 'unauthorized'
        : loadError
            ? 'error'
            : isLoading
                ? 'loading'
                : 'ready';

    const kpis = useMemo(() => buildReportsKpiCardModels({
        mapped: reportData ? mappedKpis : mappedKpis,
        t,
        branchLabel,
        appliedScope,
        proofHref: gpProofHref,
        loadState: kpiLoadState,
    }), [mappedKpis, t, branchLabel, appliedScope, gpProofHref, kpiLoadState, reportData]);

    const kpiProofModalTitle = useMemo(() => {
        const k = kpis.find((x) => x.id === kpiProofModalId);
        return k ? t('kpi.calcTitle', { label: k.title || k.label }) : t('kpi.calcFallback');
    }, [kpis, kpiProofModalId, t]);

    const renderKpiProofBody = () => {
        const proof = norm?.kpiProof;
        const scopeLine = t('kpi.scope', { scope: `${branchLabel}${periodLine ? ` · ${periodLine}` : ''}` });
        if (!kpiProofModalId) {
            return (
                <p className="ws-kpi-proof-methodology">
                    {t('kpi.refreshHint')}
                </p>
            );
        }
        if (!proof && kpiProofModalId !== 'gross_profit' && kpiProofModalId !== 'stock_value' && kpiProofModalId !== 'profit_in_stock') {
            return (
                <p className="ws-kpi-proof-methodology">
                    {t('kpi.refreshHint')}
                </p>
            );
        }

        if (kpiProofModalId === 'revenue') {
            const rev = proof.revenue ?? {};
            const invoices = parseArr(rev.invoices);
            return (
                <>
                    <p className="ws-kpi-proof-methodology">{rev.formula}</p>
                    <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                    <KpiProofSummaryGrid
                        items={[
                            { label: t('kpi.invoicesInPeriod'), value: String(rev.invoice_count ?? 0) },
                            { label: t('kpi.reportedTotal'), value: formatCurrency(rev.total, t) },
                            { label: t('kpi.sumOfLines'), value: formatCurrency(rev.line_sum_check, t) },
                        ]}
                    />
                    {rev.invoices_truncated ? (
                        <p className="ws-kpi-proof-note">
                            {t('kpi.showingInvoices', { shown: invoices.length, total: rev.invoices_total_count })}
                        </p>
                    ) : null}
                    <KpiProofTable
                        headers={[t('kpi.th.invoice'), t('kpi.th.date'), t('kpi.th.amountSar')]}
                        rows={invoices.map((inv) => [
                            inv.invoice_no ?? inv.invoiceNo ?? '—',
                            inv.issued_at
                                ? formatReportInstant(inv.issued_at, t)
                                : inv.invoice_date ?? inv.invoiceDate ?? '—',
                            formatCurrency(inv.amount, t),
                        ])}
                        emptyMessage={t('kpi.emptyInvoices')}
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
                        headers={[t('kpi.th.blank'), t('kpi.th.period'), t('kpi.th.totalRevenueSar')]}
                        rows={[
                            [
                                t('kpi.row.current'),
                                `${cur.start_date ?? '—'} → ${cur.end_date ?? '—'}`,
                                formatCurrency(ch.current_period_total, t),
                            ],
                            [
                                t('kpi.row.previous'),
                                `${prev.start_date ?? '—'} → ${prev.end_date ?? '—'}`,
                                formatCurrency(ch.previous_period_total, t),
                            ],
                            [
                                t('kpi.row.change'),
                                '—',
                                `${ch.change_percent > 0 ? '+' : ''}${Number(ch.change_percent ?? 0).toFixed(1)}%`,
                            ],
                        ]}
                    />
                </>
            );
        }

        if (kpiProofModalId === 'stock_value' || kpiProofModalId === 'profit_in_stock') {
            const inv = proof?.inventory_valuation ?? proof?.inventoryValuation ?? {};
            const lines = parseArr(inv.lines);
            const showProfit = kpiProofModalId === 'profit_in_stock';
            const stockSections = stockProofSections(mappedKpis, t);
            const paged = paginateRows(
                showProfit ? lines : (lines.length ? lines : stockSections.lines),
                stockProofPage,
                STOCK_PROOF_PAGE_SIZE,
            );
            const skusOnHand = inv.active_skus ?? 0;
            const skusSold = inv.skus_sold_in_period ?? 0;
            const skusUnsold = inv.skus_not_sold_in_period ?? 0;
            return (
                <>
                    <p className="ws-kpi-proof-note" style={{ marginBottom: 8 }}>
                        <strong>{t('kpi.notPeriodSales')}</strong> {t('kpi.notPeriodSalesBody')}
                    </p>
                    <p className="ws-kpi-proof-methodology">{inv.methodology}</p>
                    <p className="ws-kpi-proof-methodology">
                        {inv.unwind_formula}
                        <br />
                        {showProfit ? inv.potential_profit_formula : inv.stock_value_formula}
                    </p>
                    <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                    <p className="ws-kpi-proof-methodology">
                        {t('kpi.periodEndEst')} <strong>{inv.period_end_date ?? t('emdash')}</strong>
                    </p>
                    {inv.coverage_complete === false || inv.unsupported_rows ? (
                        <p className="ws-kpi-proof-note" role="status">
                            {t('kpi.coverageIncomplete', { count: inv.unsupported_rows ?? 0 })}
                        </p>
                    ) : null}
                    {kpiProofModalId === 'stock_value' && stockSections.recon ? (
                        <details className="ws-kpi-advanced">
                            <summary>{t('kpi.proofAdvanced')}</summary>
                            <p className="ws-kpi-proof-note">{stockSections.recon.notValuation}</p>
                            <KpiProofSummaryGrid
                                items={[
                                    { label: t('stock.positive'), value: moneyOrDash(stockSections.summary.positive) },
                                    { label: t('stock.negative', { rows: stockSections.summary.negativeRows ?? t('emdash') }), value: moneyOrDash(stockSections.summary.negative) },
                                    { label: t('stock.value'), value: moneyOrDash(stockSections.summary.net) },
                                    { label: t('kpi.glInventoryCheck'), value: moneyOrDash(stockSections.recon.gl) },
                                    { label: t('stock.diff'), value: moneyOrDash(stockSections.recon.difference) },
                                ]}
                            />
                            {stockSections.recon.differs ? (
                                <p className="ws-kpi-warn" role="status">{t('kpi.ledgerDiffers')}</p>
                            ) : null}
                        </details>
                    ) : null}
                    {pageRowsAreNotFullProof(paged) ? (
                        <p className="ws-kpi-proof-note">{t('kpi.proofPageNote')}</p>
                    ) : null}
                    <KpiProofSummaryGrid
                        items={[
                            { label: t('kpi.skusOnHand'), value: String(skusOnHand) },
                            { label: t('kpi.soldInPeriod'), value: String(skusSold) },
                            { label: t('kpi.onHandNotSold'), value: String(skusUnsold) },
                            {
                                label: t('kpi.stockValueTotal'),
                                value: formatCurrency(inv.stock_value_total, t),
                            },
                            {
                                label: t('kpi.profitInStockTotal'),
                                value: formatCurrency(inv.potential_profit_ex_vat ?? inv.potential_profit_total, t),
                            },
                        ]}
                    />
                    <KpiProofTable
                        headers={[
                            t('kpi.th.sku'),
                            t('kpi.th.product'),
                            t('kpi.th.branch'),
                            t('kpi.th.soldInPeriod'),
                            t('kpi.th.onHandNow'),
                            t('kpi.th.unwindAfter'),
                            t('kpi.th.qtyAtEnd'),
                            t('kpi.th.cost'),
                            t('kpi.th.sale'),
                            t('kpi.th.stockValue'),
                            t('kpi.th.lineProfit'),
                            t('kpi.th.coverage'),
                        ]}
                        rows={paged.rows.map((row) => [
                            row.sku ?? '—',
                            row.product_name ?? '—',
                            row.branch_name ?? '—',
                            row.sold_in_period ? t('yes') : t('no'),
                            row.qty_on_hand_now,
                            row.unwind_after_period_end,
                            row.qty_at_period_end,
                            row.eligible === false ? t('emdash') : formatCurrency(row.purchase_price, t),
                            formatCurrency(row.sale_price_ex_vat ?? row.sale_price, t),
                            row.eligible === false ? t('emdash') : formatCurrency(row.stock_value, t),
                            row.eligible === false ? t('emdash') : formatCurrency(row.line_potential_profit, t),
                            row.eligible === false ? (row.coverage_reason || t('kpi.unsupported')) : t('kpi.supported'),
                        ])}
                        emptyMessage={t('kpi.emptyCatalog')}
                    />
                    {paged.pages > 1 ? (
                        <div className="ws-kpi-proof-pager">
                            <button
                                type="button"
                                className="ws-btn-refresh"
                                disabled={paged.page <= 1}
                                onClick={() => setStockProofPage((p) => Math.max(1, p - 1))}
                            >
                                {t('btn.previous')}
                            </button>
                            <span>{paged.page} / {paged.pages}</span>
                            <button
                                type="button"
                                className="ws-btn-refresh"
                                disabled={paged.page >= paged.pages}
                                onClick={() => setStockProofPage((p) => Math.min(paged.pages, p + 1))}
                            >
                                {t('btn.next')}
                            </button>
                        </div>
                    ) : null}
                </>
            );
        }

        if (kpiProofModalId === 'gross_profit') {
            const attr = mappedKpis.grossProfitAttributable;
            const gp = mappedKpis.grossProfitGl;
            return (
                <>
                    <p className="ws-kpi-proof-methodology">{t('kpi.contributionWhy')}</p>
                    <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                    {attr ? (
                        <KpiProofSummaryGrid
                            items={[
                                { label: t('kpi.invoicesInPeriod'), value: String(attr.invoiceCount ?? t('emdash')) },
                                { label: t('kpi.gpIncomplete'), value: attr.certified === false ? t('yes') : t('no') },
                                { label: t('kpi.grossProfitCovered'), value: moneyOrDash(attr.coveredGrossProfit) },
                            ]}
                        />
                    ) : gp ? (
                        <KpiProofSummaryGrid
                            items={[
                                { label: t('kpi.grossProfitPl'), value: moneyOrDash(gp.grossProfit) },
                                { label: t('kpi.exVat'), value: moneyOrDash(gp.revenueExVat) },
                            ]}
                        />
                    ) : (
                        <p className="ws-kpi-proof-note">{t('kpi.noBreakdown')}</p>
                    )}
                    {gpProofHref ? (
                        <p className="ws-kpi-proof-note">
                            <a href={gpProofHref}>{t('kpi.gpProof')}</a>
                        </p>
                    ) : null}
                </>
            );
        }

        return <p className="ws-kpi-proof-methodology">{t('kpi.noBreakdown')}</p>;
    };

    const completedOrdersDisplay = norm?.completedOrdersCount ?? 0;

    const tabs = [
        { id: 'recent_orders', label: t('tab.recent_orders') },
        { id: 'daily_sales', label: t('tab.daily_sales') },
        { id: 'by_technician', label: t('tab.by_technician') },
        { id: 'by_customer', label: t('tab.by_customer') },
        { id: 'by_product', label: t('tab.by_product') },
        { id: 'by_service', label: t('tab.by_service') },
        { id: 'by_department', label: t('tab.by_department') },
        { id: 'by_category', label: t('tab.by_category') },
        { id: 'by_branch', label: t('tab.by_branch') },
        { id: 'by_cashier', label: t('tab.by_cashier') },
    ].filter((tab) => visibleReportTabIds.includes(tab.id));

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
        return rows.filter((tech) =>
            rowMatchesTabQuery([tech.name, tech.id, tech.completedJobs, tech.revenue, tech.commission], q),
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

    const ordersTotalPages = Math.max(1, Math.ceil(ordersTotal / ordersPageSize));
    const summaryResetKey = `${selectedBranchId}|${rangeFromLocal}|${rangeToLocal}`;
    const dailyPaging = usePagedRows(filteredDailyRevenue, { resetKey: `${summaryResetKey}|${tabSearch.daily_sales}` });
    const summaryPaging = {
        by_technician: usePagedRows(filteredByTechnician, { resetKey: `${summaryResetKey}|${tabSearch.by_technician}` }),
        by_customer: usePagedRows(filteredByCustomer, { resetKey: `${summaryResetKey}|${tabSearch.by_customer}` }),
        by_product: usePagedRows(filteredByProduct, {
            resetKey: `${summaryResetKey}|${tabSearch.by_product}|${byProductTechnicianId}`,
        }),
        by_service: usePagedRows(filteredByService, {
            resetKey: `${summaryResetKey}|${tabSearch.by_service}|${byServiceTechnicianId}`,
        }),
        by_department: usePagedRows(filteredByDepartment, { resetKey: `${summaryResetKey}|${tabSearch.by_department}` }),
        by_category: usePagedRows(filteredByCategory, { resetKey: `${summaryResetKey}|${tabSearch.by_category}` }),
        by_branch: usePagedRows(filteredByBranch, { resetKey: `${summaryResetKey}|${tabSearch.by_branch}` }),
        by_cashier: usePagedRows(filteredByCashier, { resetKey: `${summaryResetKey}|${tabSearch.by_cashier}` }),
    };
    const renderSummaryPagination = (tabId) =>
        summaryLoading[tabId] ? null : <WsTablePagination {...summaryPaging[tabId].pagerProps} />;

    return (
        <div className="ws-reports-page">
            <div className="ws-reports-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <div className="ws-reports-header-meta">
                        <p className="ws-page-sub">
                            {t('page.scope')} <strong>{branchLabel}</strong>
                        </p>
                        {periodLine ? (
                            <p className="ws-text-dim ws-reports-period">{periodLine}</p>
                        ) : null}
                        <p className="ws-order-count">
                            {t('page.completedOrders', { count: isLoading ? t('emdash') : completedOrdersDisplay })}
                        </p>
                    </div>
                </div>
                <div className="ws-online-badge">
                    <div className="ws-online-dot" /> {t('page.online')}
                </div>
            </div>

            <div
                className="ws-reports-filters ws-reports-filter-bar"
                data-time-mode={draftScope.timeMode}
            >
                <div className="ws-reports-toolbar-row ws-reports-toolbar-row--primary">
                    <div className="ws-reports-presets" role="group" aria-label={t('page.title')}>
                        {['today', 'yesterday', 'last_7', 'mtd', 'custom'].map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                className={`ws-reports-preset${draftScope.preset === preset ? ' is-active' : ''}`}
                                onClick={() => {
                                    setRangeFormError('');
                                    if (preset === 'custom') {
                                        setDraftScope((prev) => createReportsScope({
                                            ...prev,
                                            preset: 'custom',
                                            timeMode: prev.timeMode,
                                            dateFrom: prev.dateFrom,
                                            dateTo: prev.dateTo,
                                            fromLocal: prev.fromLocal,
                                            toLocal: prev.toLocal,
                                        }));
                                        return;
                                    }
                                    setDraftScope(createReportsScope({
                                        preset,
                                        timeMode: 'full_day',
                                    }));
                                }}
                            >
                                {t(`filter.preset.${preset}`)}
                            </button>
                        ))}
                    </div>
                    <fieldset className="ws-reports-time-mode">
                        <legend className="ws-reports-time-mode__legend">{t('filter.time.legend')}</legend>
                        <label className="ws-reports-radio">
                            <input
                                type="radio"
                                name="reports-time-mode"
                                className="ws-reports-radio__input"
                                checked={draftScope.timeMode === 'full_day'}
                                onChange={() => {
                                    setRangeFormError('');
                                    setDraftScope((prev) => createReportsScope({
                                        timeMode: 'full_day',
                                        dateFrom: prev.dateFrom,
                                        dateTo: prev.dateTo,
                                        preset: 'custom',
                                    }));
                                }}
                            />
                            <span className="ws-reports-radio__text">{t('filter.time.fullDay')}</span>
                        </label>
                        <label className="ws-reports-radio">
                            <input
                                type="radio"
                                name="reports-time-mode"
                                className="ws-reports-radio__input"
                                checked={draftScope.timeMode === 'custom_time'}
                                onChange={() => {
                                    setRangeFormError('');
                                    setDraftScope((prev) => createReportsScope({
                                        timeMode: 'custom_time',
                                        fromLocal: fullDayStartLocal(prev.dateFrom),
                                        toLocal: fullDayEndExclusiveLocal(prev.dateTo),
                                    }));
                                }}
                            />
                            <span className="ws-reports-radio__text">{t('filter.time.customTime')}</span>
                        </label>
                        <p className="ws-reports-tz" title={t('hint.riyadhDatetime')}>{t('filter.timezone')}</p>
                    </fieldset>
                </div>
                <div className="ws-reports-toolbar-row ws-reports-toolbar-row--dates">
                    {draftScope.timeMode === 'full_day' ? (
                        <>
                            <label className="ws-reports-field">
                                <span className="ws-reports-field__label">{t('filter.label.startDate')}</span>
                                <input
                                    type="date"
                                    className="ws-reports-field__control"
                                    value={draftScope.dateFrom}
                                    onChange={(e) => {
                                        const dateFrom = e.target.value;
                                        setDraftScope((prev) => createReportsScope({
                                            timeMode: 'full_day',
                                            dateFrom,
                                            dateTo: prev.dateTo,
                                            preset: 'custom',
                                        }));
                                    }}
                                    aria-label={t('filter.label.startDate')}
                                />
                            </label>
                            <label className="ws-reports-field">
                                <span className="ws-reports-field__label">{t('filter.label.endDate')}</span>
                                <input
                                    type="date"
                                    className="ws-reports-field__control"
                                    value={draftScope.dateTo}
                                    onChange={(e) => {
                                        const dateTo = e.target.value;
                                        setDraftScope((prev) => createReportsScope({
                                            timeMode: 'full_day',
                                            dateFrom: prev.dateFrom,
                                            dateTo,
                                            preset: 'custom',
                                        }));
                                    }}
                                    aria-label={t('filter.label.endDate')}
                                />
                            </label>
                        </>
                    ) : (
                        <>
                            <label className="ws-reports-field ws-reports-field--time">
                                <span className="ws-reports-field__label">{t('filter.label.startTime')}</span>
                                <input
                                    type="datetime-local"
                                    className="ws-reports-field__control"
                                    value={draftScope.fromLocal}
                                    onChange={(e) => {
                                        setDraftScope((prev) => createReportsScope({
                                            timeMode: 'custom_time',
                                            fromLocal: e.target.value,
                                            toLocal: prev.toLocal,
                                        }));
                                    }}
                                    step={60}
                                    aria-label={t('filter.label.startTime')}
                                    title="Asia/Riyadh"
                                />
                            </label>
                            <label className="ws-reports-field ws-reports-field--time">
                                <span className="ws-reports-field__label">{t('filter.label.endTime')}</span>
                                <input
                                    type="datetime-local"
                                    className="ws-reports-field__control"
                                    value={draftScope.toLocal}
                                    onChange={(e) => {
                                        setDraftScope((prev) => createReportsScope({
                                            timeMode: 'custom_time',
                                            fromLocal: prev.fromLocal,
                                            toLocal: e.target.value,
                                        }));
                                    }}
                                    step={60}
                                    aria-label={t('filter.label.endTime')}
                                    title="Asia/Riyadh"
                                />
                            </label>
                        </>
                    )}
                    <label className="ws-reports-field ws-reports-field--cost">
                        <span className="ws-reports-field__label">{t('costBasis.label')}</span>
                        <select
                            className="ws-reports-field__control"
                            value={costBasis}
                            onChange={(e) => setCostBasis(e.target.value)}
                            aria-label={t('costBasis.aria')}
                        >
                            <option value={INV_COST_BASIS_LATEST}>{t('costBasis.latest')}</option>
                            <option value={INV_COST_BASIS_WEIGHTED}>{t('costBasis.weighted')}</option>
                        </select>
                    </label>
                    <div className="ws-reports-filter-actions">
                        <button type="button" className="ws-reports-action ws-reports-action--primary" onClick={applyDateRange} disabled={isLoading || !rangeDirty}>
                            {isLoading ? t('btn.loading') : t('btn.apply')}
                        </button>
                        <button type="button" className="ws-reports-action ws-reports-action--secondary" onClick={cancelDateRange} disabled={!rangeDirty}>
                            {t('btn.cancel')}
                        </button>
                        <button type="button" className="ws-reports-action ws-reports-action--secondary" onClick={resetDateRange}>
                            {t('btn.reset')}
                        </button>
                    </div>
                </div>
                {rangeFormError ? (
                    <p role="alert" className="ws-reports-range-error">
                        {rangeFormError}{' '}
                        {draftScope.timeMode === 'custom_time' ? (
                            <button
                                type="button"
                                className="ws-reports-action ws-reports-action--secondary"
                                onClick={() => {
                                    setDraftScope((prev) => createReportsScope({
                                        timeMode: 'full_day',
                                        dateFrom: prev.dateFrom,
                                        dateTo: prev.dateTo,
                                        preset: 'custom',
                                    }));
                                    setRangeFormError('');
                                }}
                            >
                                {t('range.useWholeDays')}
                            </button>
                        ) : null}
                    </p>
                ) : null}
            </div>
            {loadError && (
                <div className="ws-section" role="alert" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {loadError}
                    <button type="button" className="ws-btn-refresh" style={{ marginInlineStart: 12 }} onClick={() => loadReports()}>
                        {t('btn.retry')}
                    </button>
                </div>
            )}

            {mappedKpis.missing.length && reportData ? (
                <div
                    role="status"
                    className="ws-text-dim"
                    style={{ marginBottom: 12, fontSize: 13 }}
                    title={mappedKpis.missing.join(', ')}
                >
                    {t('kpi.needsBackendQuiet')}
                </div>
            ) : null}

            <div className="ws-reports-kpi-grid" data-request-key={reportsRequestKey}>
                {kpis.map((k) => {
                    const aria = t('label.kpiBreakdown', { label: k.title });
                    return (
                        <article
                            key={k.id}
                            className={`ws-kpi-card ws-kpi-card--overview${k.pending ? ' is-pending' : ''}${k.unavailable ? ' is-unavailable' : ''}`}
                            aria-label={k.title}
                        >
                            <p className="ws-kpi-label">
                                {k.title}
                                {k.badge ? (
                                    <span className={`ws-kpi-badge ws-kpi-badge--${k.badgeTone || 'info'}`}>{k.badge}</span>
                                ) : null}
                            </p>
                            <h3 className={`ws-kpi-value ${k.pending || k.unavailable ? 'ws-kpi-value--pending' : k.color}`}>
                                <span className="ws-kpi-amount" dir="ltr">{k.amount}</span>
                            </h3>
                            {k.basis ? <p className="ws-kpi-basis">{k.basis}</p> : null}
                            {k.scopeLine ? <p className="ws-kpi-scope">{k.scopeLine}</p> : null}
                            {k.secondary ? <p className="ws-kpi-secondary">{k.secondary}</p> : null}
                            {k.warnings.map((w) => (
                                <p key={w} className="ws-kpi-warn" role="status">{w}</p>
                            ))}
                            {k.whyLines.length ? (
                                <details className="ws-kpi-why">
                                    <summary>{k.whyTitle || t('kpi.why')}</summary>
                                    {k.whyLines.map((line) => (
                                        <p key={line}>{line}</p>
                                    ))}
                                </details>
                            ) : null}
                            {k.action === 'modal' ? (
                                <button
                                    type="button"
                                    className="ws-kpi-details-btn"
                                    onClick={(e) => {
                                        kpiProofTriggerRef.current = e.currentTarget;
                                        setStockProofPage(1);
                                        setKpiProofModalId(k.id);
                                    }}
                                    aria-label={aria}
                                >
                                    {k.detailsLabel || t('kpi.detailsProof')}
                                </button>
                            ) : null}
                        </article>
                    );
                })}
            </div>
            {reportData && !isLoading ? (
                <p className="ws-reports-kpi-meta">
                    {t('kpi.ordersAvgTicket', {
                        orders: mappedKpis.completedOrdersCount != null
                            ? mappedKpis.completedOrdersCount
                            : t('emdash'),
                        ticket: mappedKpis.avgTicketEx != null
                            ? formatReportsKpiAmount(mappedKpis.avgTicketEx)
                            : t('emdash'),
                    })}
                </p>
            ) : null}
            {stockTableShouldBeInline() ? null : (
                <p className="ws-kpi-vat-note">{t('reports.vatNote')}</p>
            )}

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
                                placeholder={t('ph.searchDaily')}
                                value={tabSearch.daily_sales}
                                onChange={(e) => setTabSearch((p) => ({ ...p, daily_sales: e.target.value }))}
                                aria-label={t('label.searchDailySales')}
                            />
                        </div>
                        <div className="ws-chart-container">
                            <h4 className="ws-chart-title">{t('chart.dailyRevenue')}</h4>
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
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: 'none',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                            }}
                                            labelFormatter={(date, payload) => {
                                                const row = payload?.[0]?.payload;
                                                const day = row?.day ? `${row.day} · ` : '';
                                                return `${day}${date ?? ''}`;
                                            }}
                                            formatter={(value) => [
                                                t('money.sar', { amount: toNumber(value).toLocaleString() }),
                                                t('chart.revenue'),
                                            ]}
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
                                        <th>{t('th.day')}</th>
                                        <th>{t('th.date')}</th>
                                        <th>{t('th.revenueSar')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(norm?.dailyRevenue ?? []).length === 0 ? (
                                        <tr>
                                            <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                {t('empty.dailyRevenue')}
                                            </td>
                                        </tr>
                                    ) : filteredDailyRevenue.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                {t('empty.noSearchRows')}
                                            </td>
                                        </tr>
                                    ) : (
                                        dailyPaging.pagedRows.map((d, i) => (
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
                                                <td className="ws-font-bold">{t('money.sar', { amount: d.amount.toLocaleString() })}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            </WsTableScroll>
                        </div>
                        {!isLoading ? <WsTablePagination {...dailyPaging.pagerProps} /> : null}
                    </div>
                )}

                {activeTab === 'by_technician' && (
                    <div className="ws-report-view">
                        <div className="ws-report-tab-toolbar">
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder={t('ph.searchTechnician')}
                                value={tabSearch.by_technician}
                                onChange={(e) => setTabSearch((p) => ({ ...p, by_technician: e.target.value }))}
                                aria-label={t('label.searchByTechnician')}
                            />
                        </div>
                        <div className="ws-chart-container">
                            <h4 className="ws-chart-title">{t('chart.revenueByTechnician')}</h4>
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
                                            formatter={(value) => [
                                                t('money.sar', { amount: toNumber(value).toLocaleString() }),
                                                t('chart.revenue'),
                                            ]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="ws-report-table-wrapper">
                            <WsTableScroll>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>{t('th.technician')}</th>
                                        <th>{t('th.completedJobs')}</th>
                                        <th>{t('th.revenueSar')}</th>
                                        <th>{t('th.commissionSar')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(norm?.byTechnician ?? []).length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                {t('empty.technicianPerf')}
                                            </td>
                                        </tr>
                                    ) : filteredByTechnician.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                {t('empty.noSearchRows')}
                                            </td>
                                        </tr>
                                    ) : (
                                        summaryPaging.by_technician.pagedRows.map((tech) => (
                                            <tr
                                                key={tech.id || tech.name}
                                                onClick={() => loadDetails('by_technician', tech)}
                                                style={{ cursor: 'pointer', background: selectedDetailKey === `by_technician:${tech.id}` ? '#F8FAFC' : undefined }}
                                            >
                                                <td>
                                                    <strong>{tech.name}</strong>
                                                    {tech.transfer ? (
                                                        <div>
                                                            <span
                                                                className="ws-badge ws-badge--yellow"
                                                                style={{ marginTop: 4, fontSize: '0.6875rem' }}
                                                                title={t('transfer.tagTitle', {
                                                                    to: transferPlaceLabel(tech.transfer, 'to') || t('fallback.unknown'),
                                                                })}
                                                            >
                                                                {t('transfer.tag', {
                                                                    from: tech.transfer.from_branch_name || t('fallback.unknown'),
                                                                    date: formatTransferDate(tech.transfer.date, locale),
                                                                })}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td>{tech.completedJobs}</td>
                                                <td className="ws-font-bold">{t('money.sar', { amount: tech.revenue.toLocaleString() })}</td>
                                                <td className="ws-font-bold">{t('money.sar', { amount: tech.commission.toLocaleString() })}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_technician')}
                    </div>
                )}

                {activeTab === 'by_customer' && (
                    <>
                        <div className="ws-report-tab-toolbar">
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder={t('ph.searchCustomer')}
                                value={tabSearch.by_customer}
                                onChange={(e) => setTabSearch((p) => ({ ...p, by_customer: e.target.value }))}
                                aria-label={t('label.searchByCustomer')}
                            />
                        </div>
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>{t('th.phoneNumber')}</th>
                                    <th>{t('th.plateNumber')}</th>
                                    <th>{t('th.orders')}</th>
                                    <th>{t('th.revenueSar')}</th>
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
                                            {t('empty.noSearchRows')}
                                        </td>
                                    </tr>
                                ) : (
                                    summaryPaging.by_customer.pagedRows.map((row, i) => (
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
                                                    : formatPlateLettersFirst(row.plate_no ?? row.plateNo ?? '') || t('emdash')}
                                            </td>
                                            <td>{toNumber(row.orders_count ?? row.ordersCount)}</td>
                                            <td className="ws-font-bold">
                                                {t('money.sar', { amount: toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString() })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_customer')}
                    </>
                )}

                {activeTab === 'by_product' && (
                    <>
                        <div className="ws-report-tab-toolbar ws-report-tab-toolbar--split">
                            <div className="ws-report-tab-toolbar-left">
                                <div className="ws-report-tab-field ws-report-tab-field--technician">
                                    <label className="ws-report-tab-field-label" htmlFor="ws-by-product-technician">
                                        {t('label.technician')}
                                    </label>
                                    <SearchableEntityCombobox
                                        id="ws-by-product-technician"
                                        className="ws-report-tab-combobox"
                                        options={technicianComboboxOptions}
                                        inactiveSelectable
                                        value={byProductTechnicianId}
                                        displayText={byProductTechnicianFilterText}
                                        entityLabel={t('entity.technician')}
                                        placeholder={t('ph.allTechnicians')}
                                        emptyHint={t('ph.techEmpty')}
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
                                    <span className="ws-text-dim ws-report-tab-inline-hint">{t('btn.updating')}</span>
                                )}
                            </div>
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder={t('ph.searchProduct')}
                                value={tabSearch.by_product}
                                onChange={(e) => setTabSearch((p) => ({ ...p, by_product: e.target.value }))}
                                aria-label={t('label.searchByProduct')}
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
                                    <th>{t('th.product')}</th>
                                    <th>{t('th.qty')}</th>
                                    <th>{t('th.totalAmountSar')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(norm?.byProduct ?? []).length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            {t('empty.product')}
                                        </td>
                                    </tr>
                                ) : filteredByProduct.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            {t('empty.noSearchRows')}
                                        </td>
                                    </tr>
                                ) : (
                                    summaryPaging.by_product.pagedRows.map((row, i) => (
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
                                                {t('money.sar', { amount: toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString() })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_product')}
                    </>
                )}

                {activeTab === 'by_service' && (
                    <>
                        <div className="ws-report-tab-toolbar ws-report-tab-toolbar--split">
                            <div className="ws-report-tab-toolbar-left">
                                <div className="ws-report-tab-field ws-report-tab-field--technician">
                                    <label className="ws-report-tab-field-label" htmlFor="ws-by-service-technician">
                                        {t('label.technician')}
                                    </label>
                                    <SearchableEntityCombobox
                                        id="ws-by-service-technician"
                                        className="ws-report-tab-combobox"
                                        options={technicianComboboxOptions}
                                        inactiveSelectable
                                        value={byServiceTechnicianId}
                                        displayText={byServiceTechnicianFilterText}
                                        entityLabel={t('entity.technician')}
                                        placeholder={t('ph.allTechnicians')}
                                        emptyHint={t('ph.techEmpty')}
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
                                    <span className="ws-text-dim ws-report-tab-inline-hint">{t('btn.updating')}</span>
                                )}
                            </div>
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder={t('ph.searchService')}
                                value={tabSearch.by_service}
                                onChange={(e) => setTabSearch((p) => ({ ...p, by_service: e.target.value }))}
                                aria-label={t('label.searchByService')}
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
                                    <th>{t('th.service')}</th>
                                    <th>{t('th.qty')}</th>
                                    <th>{t('th.totalAmountSar')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(norm?.byService ?? []).length === 0 && !byServiceTechnicianId ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            {t('empty.service')}
                                        </td>
                                    </tr>
                                ) : filteredByService.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            {byServiceTechnicianId
                                                ? t('empty.serviceTech')
                                                : t('empty.noSearchRows')}
                                        </td>
                                    </tr>
                                ) : (
                                    summaryPaging.by_service.pagedRows.map((row, i) => (
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
                                                {t('money.sar', { amount: toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString() })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_service')}
                    </>
                )}

                {activeTab === 'by_department' && (
                    <>
                        <div className="ws-report-tab-toolbar">
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder={t('ph.searchDepartment')}
                                value={tabSearch.by_department}
                                onChange={(e) => setTabSearch((p) => ({ ...p, by_department: e.target.value }))}
                                aria-label={t('label.searchByDepartment')}
                            />
                        </div>
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>{t('th.department')}</th>
                                    <th>{t('th.orders')}</th>
                                    <th>{t('th.totalAmountSar')}</th>
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
                                            {t('empty.noSearchRows')}
                                        </td>
                                    </tr>
                                ) : (
                                    summaryPaging.by_department.pagedRows.map((row, i) => (
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
                                                {t('money.sar', { amount: toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString() })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_department')}
                    </>
                )}

                {activeTab === 'by_category' && (
                    <>
                        <div className="ws-report-tab-toolbar">
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder={t('ph.searchCategory')}
                                value={tabSearch.by_category}
                                onChange={(e) => setTabSearch((p) => ({ ...p, by_category: e.target.value }))}
                                aria-label={t('label.searchByCategory')}
                            />
                        </div>
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>{t('th.category')}</th>
                                    <th>{t('th.qtySold')}</th>
                                    <th>{t('th.orders')}</th>
                                    <th>{t('th.totalAmountSar')}</th>
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
                                            {t('empty.noSearchRows')}
                                        </td>
                                    </tr>
                                ) : (
                                    summaryPaging.by_category.pagedRows.map((row, i) => {
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
                                                    {t('money.sar', { amount: toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString() })}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_category')}
                    </>
                )}

                {activeTab === 'by_branch' && (
                    <>
                        <div className="ws-report-tab-toolbar">
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder={t('ph.searchBranch')}
                                value={tabSearch.by_branch}
                                onChange={(e) => setTabSearch((p) => ({ ...p, by_branch: e.target.value }))}
                                aria-label={t('label.searchByBranch')}
                            />
                        </div>
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>{t('th.branch')}</th>
                                    <th>{t('th.completedOrders')}</th>
                                    <th>{t('th.revenueSar')}</th>
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
                                            {t('empty.noSearchRows')}
                                        </td>
                                    </tr>
                                ) : (
                                    summaryPaging.by_branch.pagedRows.map((row, i) => (
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
                                                {t('money.sar', { amount: toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString() })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_branch')}
                    </>
                )}

                {activeTab === 'by_cashier' && (
                    <>
                        <div className="ws-report-tab-toolbar">
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder={t('ph.searchCashier')}
                                value={tabSearch.by_cashier}
                                onChange={(e) => setTabSearch((p) => ({ ...p, by_cashier: e.target.value }))}
                                aria-label={t('label.searchByCashier')}
                            />
                        </div>
                        <div className="ws-report-table-wrapper">
                        <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>{t('th.cashier')}</th>
                                    <th>{t('th.totalOrders')}</th>
                                    <th>{t('th.totalRevenueSar')}</th>
                                    <th>{t('th.commissionSar')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(norm?.byCashier ?? []).length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            {t('empty.cashier')}
                                        </td>
                                    </tr>
                                ) : filteredByCashier.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            {t('empty.noSearchRows')}
                                        </td>
                                    </tr>
                                ) : (
                                    summaryPaging.by_cashier.pagedRows.map((row, i) => {
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
                                                    {t('money.sar', { amount: toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString() })}
                                                </td>
                                                <td className="ws-font-bold">
                                                    {t('money.sar', {
                                                        amount: toNumber(
                                                            row.commission_sar ?? row.commissionSar,
                                                        ).toLocaleString(),
                                                    })}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        </div>
                        {renderSummaryPagination('by_cashier')}
                    </>
                )}

                {activeTab === 'recent_orders' && (
                    <>
                        <div className="ws-report-tab-toolbar ws-report-orders-toolbar">
                            <SelectCombo size="sm"
                                value={ordersPaymentMethod}
                                onChange={(e) => setOrdersPaymentMethod(e.target.value)}
                                className="ws-report-tab-select"
                                aria-label={t('label.filterPayment')}
                            >
                                <option value="">{t('pay.all')}</option>
                                <option value="cash">{t('pay.cash')}</option>
                                <option value="card">{t('pay.card')}</option>
                                <option value="bank">{t('pay.bankTransfer')}</option>
                                <option value="wallet">{t('pay.wallet')}</option>
                                <option value="corporate_credit">{t('pay.corporateCredit')}</option>
                                <option value="monthly_billing">{t('pay.monthlyBilling')}</option>
                                <option value="pay_monthly">{t('pay.payMonthly')}</option>
                                <option value="unpaid">{t('pay.unpaid')}</option>
                            </SelectCombo>
                            <input
                                type="search"
                                className="ws-report-tab-search"
                                placeholder={t('ph.searchOrders')}
                                value={ordersSearchInput}
                                onChange={(e) => setOrdersSearchInput(e.target.value)}
                                aria-label={t('label.searchOrders')}
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
                                    <th>{t('th.invoiceOrder')}</th>
                                    <th>{t('th.type')}</th>
                                    <th>{t('th.status')}</th>
                                    <th>{t('th.dateTime')}</th>
                                    <th>{t('th.customerName')}</th>
                                    <th>{t('th.plateNo')}</th>
                                    <th>
                                        {ordersPaymentMethod
                                            ? t('th.amountFiltered', {
                                                  method: ({
                                                      cash: t('pay.cash'),
                                                      card: t('pay.card'),
                                                      bank: t('pay.bank'),
                                                      wallet: t('pay.wallet'),
                                                      corporate_credit: t('pay.corporate'),
                                                      monthly_billing: t('pay.monthly'),
                                                      pay_monthly: t('pay.payMonthly'),
                                                      unpaid: t('pay.unpaid'),
                                                  })[ordersPaymentMethod] || ordersPaymentMethod,
                                              })
                                            : t('th.totalSar')}
                                    </th>
                                    <th style={{ width: 56 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {ordersListLoading && recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            {t('empty.ordersLoading')}
                                        </td>
                                    </tr>
                                ) : ordersTotal === 0 && !ordersListLoading ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            {ordersSearchDebounced
                                                ? t('empty.ordersSearch')
                                                : t('empty.ordersNone')}
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
                                                    {isOpen ? t('orders.pendingInvoice') : (row.invoiceNo ?? t('emdash'))}
                                                </strong>
                                                {isOpen && row.salesOrderId != null ? (
                                                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                                        {t('orders.orderHash', { id: row.salesOrderId })}
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td style={{ fontSize: '0.8125rem' }}>{formatOrderSourceLabel(row.orderSource, t)}</td>
                                            <td style={{ fontSize: '0.8125rem' }}>{formatOrderStatusLabel(row.orderStatus, t)}</td>
                                            <td>{formatInvoiceDateTimeForDisplay(row, t)}</td>
                                            <td>
                                                <div>{row.customerName ?? '—'}</div>
                                                {row.customerMobile || row.phone ? (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                        {row.customerMobile ?? row.phone}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td>{row.plateNo ? formatPlateLettersFirst(row.plateNo) : '—'}</td>
                                            <td className="ws-font-bold">{t('money.sar', { amount: toNumber(row.invoiceTotal).toLocaleString() })}</td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <RowActionsMenu
                                                    disabled={recentOrderActionBusyId === rk}
                                                    ariaLabel={isOpen ? t('orders.actions') : t('orders.invoiceActions')}
                                                    items={[
                                                        {
                                                            label: isOpen ? t('orders.viewOrder') : t('orders.viewInvoice'),
                                                            onClick: () => handleRecentOrderAction(row, 'view'),
                                                        },
                                                        ...(!isOpen
                                                            ? [
                                                                  {
                                                                      label: t('orders.downloadPdf'),
                                                                      onClick: () => handleRecentOrderAction(row, 'download'),
                                                                  },
                                                                  {
                                                                      label: t('orders.sendWhatsapp'),
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
                        {!ordersListLoading ? (
                            <WsTablePagination
                                page={Math.min(ordersPage, ordersTotalPages)}
                                pageCount={ordersTotalPages}
                                pageSize={ordersPageSize}
                                total={ordersTotal}
                                onPageChange={setOrdersPage}
                                onPageSizeChange={(n) => {
                                    setOrdersPageSize(n);
                                    setOrdersPage(1);
                                }}
                            />
                        ) : null}
                    </>
                )}
            </div>

            {kpiProofModalId && (
                <Modal
                    title={kpiProofModalTitle}
                    contentClassName="ws-modal-kpi-proof"
                    onClose={() => {
                        setKpiProofModalId(null);
                        queueMicrotask(() => {
                            try { kpiProofTriggerRef.current?.focus?.(); } catch { /* ignore */ }
                        });
                    }}
                    width="min(960px, 96vw)"
                >
                    {renderKpiProofBody()}
                </Modal>
            )}

            {(recentOrderDetailsLoading || recentOrderDetailsError || recentOrderDetails) && (
                <Modal
                    title={
                        recentOrderDetails?.listingKind === 'open' || !recentOrderDetails?.invoiceNo
                            ? recentOrderDetails?.salesOrderId
                                ? t('orders.modalTitlePending', { id: recentOrderDetails.salesOrderId })
                                : t('orders.modalTitleDetails')
                            : t('orders.modalTitleInvoice', { no: recentOrderDetails.invoiceNo })
                    }
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
                                            <th>{t('th.orderType')}</th>
                                            <td>{formatOrderSourceLabel(recentOrderDetails.orderSource, t)}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('th.orderStatus')}</th>
                                            <td>{formatOrderStatusLabel(recentOrderDetails.orderStatus, t)}</td>
                                        </tr>
                                        {recentOrderDetails.invoiceNo ? (
                                            <tr>
                                                <th>{t('th.invoiceNo')}</th>
                                                <td>{recentOrderDetails.invoiceNo}</td>
                                            </tr>
                                        ) : null}
                                        {recentOrderDetails.orderPlacedAt ? (
                                            <tr>
                                                <th>{t('th.orderPlaced')}</th>
                                                <td>{formatReportInstant(recentOrderDetails.orderPlacedAt, t)}</td>
                                            </tr>
                                        ) : null}
                                        {(recentOrderDetails.listingKind === 'invoice' || recentOrderDetails.invoiceNo) ? (
                                            <tr>
                                                <th>{t('th.invoiceDateTime')}</th>
                                                <td>{formatInvoiceDateTimeForDisplay(recentOrderDetails, t)}</td>
                                            </tr>
                                        ) : null}
                                        <tr><th>{t('th.customerName')}</th><td>{recentOrderDetails.customerName ?? '—'}</td></tr>
                                        <tr><th>{t('th.phone')}</th><td>{recentOrderDetails.phone ?? '—'}</td></tr>
                                        <tr><th>{t('th.vehicleNo')}</th><td>{recentOrderDetails.vehicleNo ? formatPlateLettersFirst(recentOrderDetails.vehicleNo) : '—'}</td></tr>
                                        <tr><th>{t('th.departments')}</th><td>{(recentOrderDetails.departments ?? []).map((d) => d?.name).filter(Boolean).join(', ') || t('emdash')}</td></tr>
                                        <tr><th>{t('th.technicians')}</th><td>{(recentOrderDetails.technicians ?? []).map((tech) => tech?.name).filter(Boolean).join(', ') || t('emdash')}</td></tr>
                                        <tr className="ws-order-details-total-row">
                                            <th>{t('th.totalAmount')}</th>
                                            <td className="ws-font-bold">
                                                {t('money.sar', { amount: toNumber(recentOrderDetails.totalAmount).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                }) })}
                                            </td>
                                        </tr>
                                        <tr><th>{t('th.paymentMethod')}</th><td>{recentOrderDetails.paymentMethod ?? '—'}</td></tr>
                                        <tr><th>{t('th.customerType')}</th><td>{recentOrderDetails.customerType ?? '—'}</td></tr>
                                    </tbody>
                                </table>
                                </WsTableScroll>
                            </div>
                            {Array.isArray(recentOrderDetails.jobsDetail) && recentOrderDetails.jobsDetail.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('orders.jobs')}</p>
                                    <WsTableScroll bodyClassName="ws-order-details-table-scroll">
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('th.jobNo')}</th>
                                                    <th>{t('th.departmentShort')}</th>
                                                    <th>{t('th.jobStatus')}</th>
                                                    <th>{t('th.opened')}</th>
                                                    <th>{t('th.completed')}</th>
                                                    <th>{t('th.jobDiscount')}</th>
                                                    <th>{t('th.promo')}</th>
                                                    <th>{t('th.beforeDisc')}</th>
                                                    <th>{t('th.afterDisc')}</th>
                                                    <th>{t('th.vat')}</th>
                                                    <th>{t('th.jobTotal')}</th>
                                                    <th>{t('th.techniciansTitle')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentOrderDetails.jobsDetail.map((job) => (
                                                    <tr key={job.jobId}>
                                                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{job.jobId ?? '—'}</td>
                                                        <td>{job.departmentName ?? '—'}</td>
                                                        <td>{formatOrderStatusLabel(job.status, t)}</td>
                                                        <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                                            {formatReportInstant(job.createdAt, t)}
                                                        </td>
                                                        <td style={{ fontSize: '0.8125rem' }}>{formatJobCompletedDisplay(job, t)}</td>
                                                        <td>{formatDiscountCell(job.totalDiscountType, job.totalDiscountValue, t)}</td>
                                                        <td>{t('money.sar', { amount: toNumber(job.promoDiscountAmount).toLocaleString() })}</td>
                                                        <td>{t('money.sar', { amount: toNumber(job.amountBeforeDiscount).toLocaleString() })}</td>
                                                        <td>{t('money.sar', { amount: toNumber(job.amountAfterDiscount).toLocaleString() })}</td>
                                                        <td>{t('money.sar', { amount: toNumber(job.vatAmount).toLocaleString() })}</td>
                                                        <td className="ws-font-bold">{t('money.sar', { amount: toNumber(job.totalAmount).toLocaleString() })}</td>
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
                                                                            {[a.technicianName || t('emdash'), a.assignmentType, formatOrderStatusLabel(a.assignmentStatus, t)]
                                                                                .filter(Boolean)
                                                                                .join(' · ')}
                                                                        </div>
                                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                                            {a.respondedAt
                                                                                ? t('orders.responded', { when: formatReportInstant(a.respondedAt, t) })
                                                                                : t('orders.assigned', { when: formatReportInstant(a.assignedAt, t) })}
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
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('orders.lineItems')}</p>
                                    <WsTableScroll bodyClassName="ws-order-details-table-scroll">
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('th.jobNo')}</th>
                                                    <th>{t('th.dept')}</th>
                                                    <th>{t('th.item')}</th>
                                                    <th>{t('th.typeTitle')}</th>
                                                    <th>{t('th.qtyTitle')}</th>
                                                    <th>{t('th.unitSar')}</th>
                                                    <th>{t('th.discount')}</th>
                                                    <th>{t('th.vat')}</th>
                                                    <th>{t('th.lineSar')}</th>
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
                                                        <td>{formatDiscountCell(row.discountType, row.discountValue, t)}</td>
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
                    title={detailsTitle || t('details.fallback')}
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
                                                            ? t('th.dateTimeTitle')
                                                            : isMoneyDetailColumnKey(k)
                                                              ? t('th.moneySar', { label: wrColT(locale, k) })
                                                              : wrColT(locale, k)}
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
                                                                                    {item.itemName ?? item.name ?? t('details.itemN', { n: idx + 1 })}
                                                                                </div>
                                                                                {(() => {
                                                                                    const sub = formatWorkshopLineItemCardSubtext(item, t);
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
                                                                formatCurrency(val, t)
                                                            ) : isInvoiceDateDetailColumnKey(k) ? (
                                                                formatInvoiceDateTimeForDisplay(row, t)
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
                                                                ? t('details.total')
                                                                : isMoneyDetailColumnKey(k)
                                                                  ? formatCurrency(moneyTotals[k], t)
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
                        {t('defs.title')}
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
