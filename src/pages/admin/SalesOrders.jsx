import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, ShoppingCart, Search, CheckCircle2, XCircle, Clock } from 'lucide-react';
import '../../styles/ui.css';
import Modal from '../../components/Modal';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import { BUSINESS_TIMEZONE, riyadhBoundToApiIso } from '../../utils/riyadhBusinessRange';
import {
    getBranches as adminGetBranches,
    getSalesOrder as adminGetSalesOrder,
    getSalesOrders as adminGetSalesOrders,
    getWorkshopOptions as adminGetWorkshopOptions,
} from '../../services/superAdminApi';
import * as marketingLookupApi from '../../services/marketingSalesLookupApi';
import { ExportMenu } from '../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../utils/tableExport';
import { soT, SO_STATUS_OPTION_KEYS, SO_STATUS_LABEL_KEYS } from '../../utils/salesOrdersI18n';

const EXPORT_LIMIT = 5000;

/** Build {headers, rows} mirroring the on-screen table — used for PDF/Excel export. */
function buildSalesOrderExportRows(orders, fmtDateTime, t) {
    const headers = [
        t('exp.invNo'),
        t('exp.order'),
        t('exp.datetime'),
        t('exp.workshop'),
        t('exp.branch'),
        t('exp.customer'),
        t('exp.mobile'),
        t('exp.vehicle'),
        t('exp.techs'),
        t('exp.total'),
        t('exp.status'),
    ];
    const rows = (orders || []).map((order) => [
        order.invoiceNo ?? t('pendingInvoice'),
        order.id,
        fmtDateTime(order),
        order.workshopName ?? '—',
        order.branchName ?? '—',
        order.customerName ?? t('walkIn'),
        order.customerMobile ?? '—',
        order.plateNo ?? '—',
        order.technicianNames ?? '—',
        order.totalAmount != null ? Number(Number(order.totalAmount).toFixed(2)) : '',
        formatStatusLabel(order.status, t),
    ]);
    return { headers, rows };
}

const STATUS_VARIANT = {
    completed: { tone: 'ok', icon: CheckCircle2 },
    invoiced: { tone: 'ok', icon: CheckCircle2 },
    cancelled: { tone: 'dang', icon: XCircle },
    rejected: { tone: 'dang', icon: XCircle },
    pending: { tone: 'warn', icon: Clock },
    draft: { tone: 'warn', icon: Clock },
    in_progress: { tone: 'warn', icon: Clock },
};

const STATUS_OPTION_VALUES = ['', 'draft', 'pending', 'in_progress', 'completed', 'invoiced', 'cancelled'];

function formatStatusLabel(status, t) {
    if (status == null || String(status).trim() === '') return '—';
    const key = String(status).trim().toLowerCase();
    const labelKey = SO_STATUS_LABEL_KEYS[key];
    if (labelKey && t) return t(labelKey);
    return String(status)
        .trim()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status, t }) {
    const key = String(status ?? '').trim().toLowerCase();
    const cfg = STATUS_VARIANT[key] ?? STATUS_VARIANT.pending;
    const Icon = cfg.icon;
    return (
        <span className={`ui-pill ui-pill--icon ui-pill--${cfg.tone}`}>
            <Icon size={12} />
            {formatStatusLabel(status, t)}
        </span>
    );
}

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * The API sends UTC instants, so this renders them in the business timezone.
 * Without it the same invoice reads 10:30 for a cashier in Riyadh and 07:30
 * for a head-office laptop left on UTC.
 */
function formatDateTime(raw) {
    if (raw == null || raw === '') return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString(undefined, {
        timeZone: BUSINESS_TIMEZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatInvoiceDateTime(order) {
    return formatDateTime(order?.issuedAt ?? order?.invoiceDate ?? order?.createdAt);
}

function formatDiscountCell(discountType, discountValue, t) {
    const dtype = String(discountType ?? '').toLowerCase();
    const v = toNumber(discountValue);
    if (!v) return '—';
    if (dtype === 'percent' || dtype === 'percentage') return `${v}%`;
    return t('money.sar', { amount: v.toLocaleString() });
}

const sar = (t, v) => t('money.sar', { amount: toNumber(v).toLocaleString() });

/**
 * A `datetime-local` bound as the UTC instant the API wants, reading the typed
 * wall clock as Asia/Riyadh. It is computed while rendering, so a value the
 * helper rejects must drop the bound rather than throw the screen away.
 */
function isoBound(raw, edge) {
    try {
        return riyadhBoundToApiIso(raw, edge) || undefined;
    } catch {
        return undefined;
    }
}

/** A labelled block of rows inside the details view. */
function DetailTable({ title, children }) {
    return (
        <section className="ui-panel">
            {title ? (
                <div className="ui-panel-head">
                    <span className="ui-panel-title">{title}</span>
                </div>
            ) : null}
            <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
                <table className="ui-table">{children}</table>
            </div>
        </section>
    );
}

/**
 * The order details body.
 *
 * It renders in two frames — a full-screen panel in the admin portal and a
 * modal in the marketing portal — so it lives here once. Both frames used to
 * hold their own copy of these 200 lines, which is how they drifted.
 */
function OrderDetailsBody({ data, loading, error, t }) {
    if (loading) {
        return (
            <div className="ui-stack-sm" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={`sk-${i}`} className="ui-sk-row">
                        <div className="ui-sk ui-sk--text ui-sk--w90" />
                    </div>
                ))}
            </div>
        );
    }
    if (error) {
        return (
            <div className="ui-banner ui-banner--dang">
                <AlertTriangle size={14} />
                <span>{error}</span>
            </div>
        );
    }
    if (!data) return null;

    const inv = data.invoice;
    const disc = data.orderDiscount;
    const showDiscount = disc
        && (toNumber(disc.totalDiscountValue) > 0
            || toNumber(disc.promoDiscountAmount) > 0
            || disc.promoCode);

    return (
        <div className="ui-stack">
            <DetailTable>
                <tbody>
                    <tr><th>{t('d.orderStatus')}</th><td>{formatStatusLabel(data.status, t)}</td></tr>
                    <tr><th>{t('d.source')}</th><td>{formatStatusLabel(data.source, t)}</td></tr>
                    <tr><th>{t('d.workshop')}</th><td>{data.workshopName ?? '—'}</td></tr>
                    <tr><th>{t('d.branch')}</th><td>{data.branchName ?? '—'}</td></tr>
                    <tr><th>{t('d.placed')}</th><td>{formatDateTime(data.createdAt)}</td></tr>
                    {inv ? (
                        <>
                            <tr><th>{t('d.invoiceNo')}</th><td>{inv.invoiceNo ?? '—'}</td></tr>
                            <tr>
                                <th>{t('d.datetime')}</th>
                                <td>{formatDateTime(inv.issuedAt ?? inv.invoiceDate)}</td>
                            </tr>
                            <tr><th>{t('d.payStatus')}</th><td>{formatStatusLabel(inv.paymentStatus, t)}</td></tr>
                        </>
                    ) : null}
                    <tr><th>{t('d.customer')}</th><td>{data.customer?.name ?? '—'}</td></tr>
                    <tr><th>{t('d.phone')}</th><td>{data.customer?.mobile ?? '—'}</td></tr>
                    <tr>
                        <th>{t('d.vehicle')}</th>
                        <td>
                            {data.vehicle?.plateNo ?? '—'}
                            {data.vehicle
                            && (data.vehicle.make || data.vehicle.model || data.vehicle.year)
                                ? ` · ${[data.vehicle.year, data.vehicle.make, data.vehicle.model]
                                    .filter(Boolean)
                                    .join(' ')}`
                                : ''}
                        </td>
                    </tr>
                    {inv ? (
                        <tr>
                            <th>{t('d.total')}</th>
                            <td className="ui-strong">{sar(t, inv.totalAmount)}</td>
                        </tr>
                    ) : null}
                </tbody>
            </DetailTable>

            {showDiscount ? (
                <DetailTable title={t('d.promoTitle')}>
                    <tbody>
                        <tr>
                            <th>{t('d.orderDisc')}</th>
                            <td>
                                {formatDiscountCell(disc.totalDiscountType, disc.totalDiscountValue, t)}
                            </td>
                        </tr>
                        <tr>
                            <th>{t('d.promoDisc')}</th>
                            <td>{sar(t, disc.promoDiscountAmount)}</td>
                        </tr>
                        <tr>
                            <th>{t('d.promoCode')}</th>
                            <td>{disc.promoCode ?? '—'}</td>
                        </tr>
                    </tbody>
                </DetailTable>
            ) : null}

            {Array.isArray(data.jobs) && data.jobs.length > 0 ? (
                <DetailTable title={t('d.jobs')}>
                    <thead>
                        <tr>
                            <th>{t('d.jobNo')}</th>
                            <th>{t('d.dept')}</th>
                            <th>{t('d.status')}</th>
                            <th>{t('d.opened')}</th>
                            <th>{t('d.completed')}</th>
                            <th>{t('d.beforeDisc')}</th>
                            <th>{t('d.afterDisc')}</th>
                            <th>{t('d.vat')}</th>
                            <th>{t('d.jobTotal')}</th>
                            <th>{t('d.techs')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.jobs.map((job) => (
                            <tr key={job.id}>
                                <td className="ui-num">{job.id}</td>
                                <td>{job.departmentName ?? '—'}</td>
                                <td>{formatStatusLabel(job.status, t)}</td>
                                <td className="ui-nowrap">{formatDateTime(job.createdAt)}</td>
                                <td className="ui-nowrap">{job.completedAt ? formatDateTime(job.completedAt) : '—'}</td>
                                <td className="ui-num">{sar(t, job.amountBeforeDiscount)}</td>
                                <td className="ui-num">{sar(t, job.amountAfterDiscount)}</td>
                                <td className="ui-num">{sar(t, job.vatAmount)}</td>
                                <td className="ui-num ui-strong">{sar(t, job.totalAmount)}</td>
                                <td>
                                    {(job.assignments ?? [])
                                        .map((a) => a.technicianName)
                                        .filter(Boolean)
                                        .join(', ') || '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </DetailTable>
            ) : null}

            {Array.isArray(data.lineItems) && data.lineItems.length > 0 ? (
                <DetailTable title={t('d.lines')}>
                    <thead>
                        <tr>
                            <th>{t('d.jobNo')}</th>
                            <th>{t('d.deptShort')}</th>
                            <th>{t('d.item')}</th>
                            <th>{t('d.type')}</th>
                            <th>{t('d.qty')}</th>
                            <th>{t('d.unit')}</th>
                            <th>{t('d.discount')}</th>
                            <th>{t('d.vat')}</th>
                            <th>{t('d.lineTotal')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.lineItems.map((row) => (
                            <tr key={row.id}>
                                <td>{row.jobId ?? '—'}</td>
                                <td>{row.departmentName ?? '—'}</td>
                                <td>{row.itemName ?? '—'}</td>
                                <td>{row.itemType ?? '—'}</td>
                                <td className="ui-num">{row.qty}</td>
                                <td className="ui-num">{toNumber(row.unitPrice).toLocaleString()}</td>
                                <td>{formatDiscountCell(row.discountType, row.discountValue, t)}</td>
                                <td className="ui-nowrap">
                                    {toNumber(row.vatPercent)}% · {String(row.vatMode ?? '—')}
                                </td>
                                <td className="ui-num ui-strong">{toNumber(row.lineTotal).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </DetailTable>
            ) : null}

            {inv && Array.isArray(inv.payments) && inv.payments.length > 0 ? (
                <DetailTable title={t('d.payments')}>
                    <thead>
                        <tr>
                            <th>{t('d.method')}</th>
                            <th>{t('d.amount')}</th>
                            <th>{t('d.paidAt')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inv.payments.map((p) => (
                            <tr key={p.id}>
                                <td>{p.method ?? '—'}</td>
                                <td className="ui-num ui-strong">{toNumber(p.amount).toLocaleString()}</td>
                                <td className="ui-nowrap">{formatDateTime(p.paidAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </DetailTable>
            ) : null}
        </div>
    );
}

export default function SalesOrders({ portal = 'admin' }) {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        (portal === 'marketing' && typeof localStorage !== 'undefined'
            ? localStorage.getItem('marketing-locale')
            : null) ||
        'en';
    const t = useCallback((key, vars) => soT(locale, key, vars), [locale]);

    // The marketing portal reads the same screens through its own endpoints.
    // Memoised on `portal` so the loaders below can depend on it honestly:
    // picked inline, these four were new values on every render.
    const api = useMemo(
        () => (portal === 'marketing'
            ? {
                getWorkshopOptions: marketingLookupApi.getWorkshopOptions,
                getBranches: marketingLookupApi.getBranches,
                getSalesOrders: marketingLookupApi.getSalesOrders,
                getSalesOrder: marketingLookupApi.getSalesOrder,
            }
            : {
                getWorkshopOptions: adminGetWorkshopOptions,
                getBranches: adminGetBranches,
                getSalesOrders: adminGetSalesOrders,
                getSalesOrder: adminGetSalesOrder,
            }),
        [portal],
    );
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [workshopOptionsLoading, setWorkshopOptionsLoading] = useState(true);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');

    const [branchOptions, setBranchOptions] = useState([]);
    const [branchOptionsLoading, setBranchOptionsLoading] = useState(false);
    const [selectedBranchId, setSelectedBranchId] = useState('');

    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');

    const [orders, setOrders] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [detailId, setDetailId] = useState('');
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [exporting, setExporting] = useState(false);

    // Every filter is part of the reset key, so changing one goes back to the
    // first page during the same render rather than in a follow-up effect.
    const resetKey = [
        selectedWorkshopId, selectedBranchId, statusFilter, dateFrom, dateTo, searchDebounced,
    ].join('|');
    const { page, pageSize, pagerFor } = useServerPaging({ resetKey });

    // Load workshops once.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setWorkshopOptionsLoading(true);
            try {
                const res = await api.getWorkshopOptions();
                const list = Array.isArray(res?.workshops)
                    ? res.workshops
                    : Array.isArray(res?.data?.workshops)
                      ? res.data.workshops
                      : [];
                if (!cancelled) {
                    setWorkshopOptions(
                        list.map((w) => ({
                            id: String(w.id),
                            name: String(w.name || '').trim() || soT(locale, 'fallback.workshop'),
                        })),
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
    }, [api, locale]);

    // Load branches when workshop changes.
    useEffect(() => {
        if (!selectedWorkshopId) {
            setBranchOptions([]);
            setSelectedBranchId('');
            return;
        }
        let cancelled = false;
        (async () => {
            setBranchOptionsLoading(true);
            try {
                const res = await api.getBranches({ workshopId: selectedWorkshopId });
                const list = Array.isArray(res?.branches)
                    ? res.branches
                    : Array.isArray(res?.data?.branches)
                      ? res.data.branches
                      : [];
                if (!cancelled) {
                    setBranchOptions(
                        list.map((b) => ({
                            id: String(b.id),
                            name: String(b.name || '').trim() || soT(locale, 'fallback.branch'),
                        })),
                    );
                    setSelectedBranchId('');
                }
            } catch {
                if (!cancelled) {
                    setBranchOptions([]);
                    setSelectedBranchId('');
                }
            } finally {
                if (!cancelled) setBranchOptionsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [api, selectedWorkshopId, locale]);

    // Debounce search.
    useEffect(() => {
        const timer = setTimeout(() => setSearchDebounced(searchInput.trim()), 380);
        return () => clearTimeout(timer);
    }, [searchInput]);

    /**
     * The two date inputs are `datetime-local`, i.e. a wall clock with no zone.
     * They are read as Asia/Riyadh — the business timezone the figures are
     * reported in — not as whatever zone the viewer's laptop is set to.
     */
    const listQuery = useMemo(() => ({
        workshopId: selectedWorkshopId || undefined,
        branchId: selectedBranchId || undefined,
        status: statusFilter || undefined,
        search: searchDebounced || undefined,
        startDate: isoBound(dateFrom, 'start'),
        endDate: isoBound(dateTo, 'end'),
    }), [selectedWorkshopId, selectedBranchId, statusFilter, searchDebounced, dateFrom, dateTo]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await api.getSalesOrders({
                ...listQuery,
                limit: String(pageSize),
                offset: String((page - 1) * pageSize),
            });
            const rows = Array.isArray(res?.salesOrders)
                ? res.salesOrders
                : Array.isArray(res?.data?.salesOrders)
                  ? res.data.salesOrders
                  : [];
            setOrders(rows);
            const tot = res?.total ?? res?.data?.total;
            setTotal(
                typeof tot === 'number' && Number.isFinite(tot)
                    ? tot
                    : Number.parseInt(String(tot ?? ''), 10) || rows.length,
            );
        } catch (e) {
            setOrders([]);
            setTotal(0);
            setLoadError(e?.message || t('errLoad'));
        } finally {
            setLoading(false);
        }
    }, [api, listQuery, page, pageSize, t]);

    useEffect(() => {
        void fetchOrders();
    }, [fetchOrders]);

    // Export the FULL filtered set (one bounded re-fetch with the active filters).
    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setLoadError('');
        try {
            const res = await api.getSalesOrders({
                ...listQuery,
                limit: String(EXPORT_LIMIT),
                offset: '0',
            });
            const list = Array.isArray(res?.salesOrders) ? res.salesOrders
                : Array.isArray(res?.data?.salesOrders) ? res.data.salesOrders : [];
            const { headers, rows } = buildSalesOrderExportRows(list, formatInvoiceDateTime, t);
            const subtitle = t('export.subtitle', { n: rows.length })
                + (dateFrom || dateTo ? ` · ${dateFrom || '…'} → ${dateTo || '…'}` : '')
                + (statusFilter ? ` · ${t('export.status', { status: formatStatusLabel(statusFilter, t) })}` : '');
            const title = t('exportTitle');
            if (kind === 'pdf') {
                exportRowsToPdf({ title, subtitle, headers, rows, filenameBase: 'sales-orders' });
            } else {
                exportRowsToExcel({ sheetName: title, headers, rows, filenameBase: 'sales-orders' });
            }
        } catch (e) {
            setLoadError(e?.message || t('errExport'));
        } finally {
            setExporting(false);
        }
    }, [api, listQuery, dateFrom, dateTo, statusFilter, t]);

    const openDetails = useCallback(async (orderId) => {
        if (!orderId) return;
        setDetailId(String(orderId));
        setDetailLoading(true);
        setDetailError('');
        setDetailData(null);
        try {
            const res = await api.getSalesOrder(orderId);
            const payload =
                res && typeof res === 'object' && res.data && typeof res.data === 'object'
                    ? res.data
                    : res;
            setDetailData(payload && typeof payload === 'object' ? payload : null);
        } catch (e) {
            setDetailError(e?.message || t('errDetail'));
        } finally {
            setDetailLoading(false);
        }
    }, [api, t]);

    const closeDetails = () => {
        setDetailId('');
        setDetailData(null);
        setDetailError('');
        setDetailLoading(false);
    };

    // KPIs computed from current page (lightweight; full-period KPIs live in
    // Sales Reports). The labels say "this page" for exactly that reason.
    const kpis = useMemo(() => {
        const invoicedRevenue = orders.reduce(
            (acc, o) => acc + (o.invoiceNo ? toNumber(o.totalAmount) : 0),
            0,
        );
        const invoicedCount = orders.filter((o) => o.invoiceNo).length;
        const pendingCount = orders.filter(
            (o) => !o.invoiceNo && !['cancelled', 'rejected'].includes(String(o.status ?? '').toLowerCase()),
        ).length;
        const cancelledCount = orders.filter((o) =>
            ['cancelled', 'rejected'].includes(String(o.status ?? '').toLowerCase()),
        ).length;
        const money = (n) => t('money.sar', {
            amount: n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
        });
        return [
            { key: 'total', label: t('kpi.total'), value: total.toLocaleString() },
            { key: 'invoiced', label: t('kpi.invoiced'), value: invoicedCount.toLocaleString() },
            { key: 'pending', label: t('kpi.pending'), value: pendingCount.toLocaleString() },
            { key: 'cancelled', label: t('kpi.cancelled'), value: cancelledCount.toLocaleString() },
            { key: 'revenue', label: t('kpi.revenue'), value: money(invoicedRevenue), tone: 'info' },
        ];
    }, [orders, total, t]);

    const detailTitle = detailData?.invoice?.invoiceNo
        ? t('detail.titleNo', { no: detailData.invoice.invoiceNo })
        : detailData?.id
          ? t('detail.titleId', { id: detailData.id })
          : t('detail.title');

    const details = (
        <OrderDetailsBody
            data={detailData}
            loading={detailLoading}
            error={detailError}
            t={t}
        />
    );

    if (portal === 'admin' && detailId) {
        return (
            <AdminModalAsScreen title={detailTitle} onClose={closeDetails} wide>
                {details}
            </AdminModalAsScreen>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-row">
                <div className="ui-head">
                    <h1>
                        <ShoppingCart size={18} /> {t('title')}
                    </h1>
                    <p>{t('sub')}</p>
                </div>
                <div className="ui-toolbar-end">
                    <span className="ui-pill ui-pill--neutral">{t('count', { n: total.toLocaleString() })}</span>
                    <ExportMenu
                        onPdf={() => runExport('pdf')}
                        onExcel={() => runExport('excel')}
                        busy={exporting}
                        disabled={loading}
                        locale={locale}
                    />
                </div>
            </div>

            <div className="ui-kpis">
                {kpis.map((k) => (
                    <div key={k.key} className={`ui-metric${k.tone ? ` ui-metric--${k.tone}` : ''}`}>
                        <div className="ui-metric-label">{k.label}</div>
                        <div className="ui-metric-value">{k.value}</div>
                    </div>
                ))}
            </div>

            <div className="ui-row ui-row--fields">
                <div className="ui-field ui-field--grow">
                    <label htmlFor="so-search">{t('filter.search')}</label>
                    <div className="ui-search">
                        <Search size={15} />
                        <input
                            id="so-search"
                            type="text"
                            className="ui-input"
                            placeholder={t('search')}
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>
                </div>
                <div className="ui-field">
                    <label htmlFor="so-workshop">{t('filter.workshop')}</label>
                    <select
                        id="so-workshop"
                        className="ui-select"
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                        disabled={workshopOptionsLoading}
                    >
                        <option value="">{workshopOptionsLoading ? t('loadingWorkshops') : t('allWorkshops')}</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="so-branch">{t('filter.branch')}</label>
                    <select
                        id="so-branch"
                        className="ui-select"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId || branchOptionsLoading}
                    >
                        <option value="">
                            {selectedWorkshopId ? t('allBranches') : t('selectWorkshopFirst')}
                        </option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="so-status">{t('filter.status')}</label>
                    <select
                        id="so-status"
                        className="ui-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        {STATUS_OPTION_VALUES.map((value) => (
                            <option key={value || 'all'} value={value}>
                                {t(SO_STATUS_OPTION_KEYS[value] || 'status.all')}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="so-from">{t('date.from')}</label>
                    <input
                        id="so-from"
                        type="datetime-local"
                        className="ui-input"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        step={60}
                    />
                </div>
                <div className="ui-field">
                    <label htmlFor="so-to">{t('date.to')}</label>
                    <input
                        id="so-to"
                        type="datetime-local"
                        className="ui-input"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        step={60}
                    />
                </div>
            </div>

            {loadError ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertTriangle size={14} />
                    <span>{loadError}</span>
                </div>
            ) : null}

            <div className="ui-table-wrap ui-table-wrap--scroll">
                <table className="ui-table ui-table--pick">
                    <thead>
                        <tr>
                            <th>{t('th.invoiceOrder')}</th>
                            <th>{t('th.datetime')}</th>
                            <th>{t('th.workshop')}</th>
                            <th>{t('th.branch')}</th>
                            <th>{t('th.customer')}</th>
                            <th>{t('th.vehicle')}</th>
                            <th>{t('th.techs')}</th>
                            <th>{t('th.total')}</th>
                            <th>{t('th.status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && orders.length === 0 ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={`sk-${i}`} className="ui-sk-row">
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                    <td><div className="ui-sk ui-sk--pill" /></td>
                                </tr>
                            ))
                        ) : orders.length === 0 ? (
                            <tr>
                                <td colSpan={9}>
                                    <div className="ui-empty">
                                        <div className="ui-empty-icon"><ShoppingCart size={18} /></div>
                                        <div className="ui-empty-title">{t('empty')}</div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order.id} onClick={() => openDetails(order.id)}>
                                    <td data-label={t('th.invoiceOrder')}>
                                        <div className="ui-strong">
                                            {order.invoiceNo ?? t('pendingInvoice')}
                                        </div>
                                        <div className="ui-meta">{t('orderNo', { id: order.id })}</div>
                                    </td>
                                    <td data-label={t('th.datetime')} className="ui-nowrap">
                                        {formatInvoiceDateTime(order)}
                                    </td>
                                    <td data-label={t('th.workshop')}>{order.workshopName ?? '—'}</td>
                                    <td data-label={t('th.branch')}>{order.branchName ?? '—'}</td>
                                    <td data-label={t('th.customer')}>
                                        <div className="ui-strong">{order.customerName ?? t('walkIn')}</div>
                                        <div className="ui-meta">{order.customerMobile ?? '—'}</div>
                                    </td>
                                    <td data-label={t('th.vehicle')}>{order.plateNo ?? '—'}</td>
                                    <td data-label={t('th.techs')}>{order.technicianNames ?? '—'}</td>
                                    <td data-label={t('th.total')} className="ui-num ui-strong">
                                        {order.totalAmount != null
                                            ? toNumber(order.totalAmount).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })
                                            : '—'}
                                    </td>
                                    <td data-label={t('th.status')}>
                                        <StatusBadge status={order.status} t={t} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                <UiPager {...pagerFor(total)} />
            </div>

            {portal !== 'admin' && detailId && (
                <Modal
                    title={detailTitle}
                    onClose={closeDetails}
                    width="min(1100px, 98vw)"
                    contentClassName="ui-tokens"
                >
                    {details}
                </Modal>
            )}
        </div>
    );
}
