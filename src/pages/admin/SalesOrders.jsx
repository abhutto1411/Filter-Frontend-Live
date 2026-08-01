import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShoppingCart, Search, CheckCircle2, XCircle, Clock, Loader } from 'lucide-react';
import '../../styles/admin/SalesOrders.css';
import '../workshop/Workshop.css';
import Modal from '../../components/Modal';
import { ShimmerTextBlock } from '../../components/supplier/Shimmer';
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

const PAGE_SIZE = 25;
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
    completed: { class: 'so-status-completed', icon: CheckCircle2 },
    invoiced: { class: 'so-status-completed', icon: CheckCircle2 },
    cancelled: { class: 'so-status-cancelled', icon: XCircle },
    rejected: { class: 'so-status-cancelled', icon: XCircle },
    pending: { class: 'so-status-pending', icon: Clock },
    draft: { class: 'so-status-pending', icon: Clock },
    in_progress: { class: 'so-status-pending', icon: Clock },
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
    const cfg = STATUS_VARIANT[key];
    const Icon = cfg?.icon ?? Clock;
    return (
        <span className={`so-status-badge ${cfg?.class ?? 'so-status-pending'}`}>
            <Icon size={12} />
            {formatStatusLabel(status, t)}
        </span>
    );
}

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

function formatDateTime(raw) {
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

function formatInvoiceDateTime(order) {
    return formatDateTime(order?.issuedAt ?? order?.invoiceDate ?? order?.createdAt);
}

/** `datetime-local` (local wall-clock, no TZ) → full ISO instant the backend accepts. */
function localDateTimeToIso(localValue) {
    if (!localValue) return '';
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
}

function formatDiscountCell(discountType, discountValue, t) {
    const dtype = String(discountType ?? '').toLowerCase();
    const v = toNumber(discountValue);
    if (!v) return '—';
    if (dtype === 'percent' || dtype === 'percentage') return `${v}%`;
    return t('money.sar', { amount: v.toLocaleString() });
}

export default function SalesOrders({ portal = 'admin' }) {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => soT(locale, key, vars), [locale]);

    const getWorkshopOptions = portal === 'marketing'
        ? marketingLookupApi.getWorkshopOptions
        : adminGetWorkshopOptions;
    const getBranches = portal === 'marketing'
        ? marketingLookupApi.getBranches
        : adminGetBranches;
    const getSalesOrders = portal === 'marketing'
        ? marketingLookupApi.getSalesOrders
        : adminGetSalesOrders;
    const getSalesOrder = portal === 'marketing'
        ? marketingLookupApi.getSalesOrder
        : adminGetSalesOrder;
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
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [detailId, setDetailId] = useState('');
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [exporting, setExporting] = useState(false);

    // Load workshops once.
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
    }, [locale]);

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
                const res = await getBranches({ workshopId: selectedWorkshopId });
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
    }, [selectedWorkshopId, locale]);

    // Debounce search.
    useEffect(() => {
        const timer = setTimeout(() => setSearchDebounced(searchInput.trim()), 380);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Reset to page 1 whenever filters change.
    useEffect(() => {
        setPage(1);
    }, [selectedWorkshopId, selectedBranchId, statusFilter, dateFrom, dateTo, searchDebounced]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await getSalesOrders({
                workshopId: selectedWorkshopId || undefined,
                branchId: selectedBranchId || undefined,
                status: statusFilter || undefined,
                search: searchDebounced || undefined,
                startDate: localDateTimeToIso(dateFrom) || undefined,
                endDate: localDateTimeToIso(dateTo) || undefined,
                limit: String(PAGE_SIZE),
                offset: String((page - 1) * PAGE_SIZE),
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
    }, [selectedWorkshopId, selectedBranchId, statusFilter, searchDebounced, dateFrom, dateTo, page, t]);

    useEffect(() => {
        void fetchOrders();
    }, [fetchOrders]);

    // Export the FULL filtered set (one bounded re-fetch with the active filters).
    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setLoadError('');
        try {
            const res = await getSalesOrders({
                workshopId: selectedWorkshopId || undefined,
                branchId: selectedBranchId || undefined,
                status: statusFilter || undefined,
                search: searchDebounced || undefined,
                startDate: localDateTimeToIso(dateFrom) || undefined,
                endDate: localDateTimeToIso(dateTo) || undefined,
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
    }, [selectedWorkshopId, selectedBranchId, statusFilter, searchDebounced, dateFrom, dateTo, t]);

    const openDetails = useCallback(async (orderId) => {
        if (!orderId) return;
        setDetailId(String(orderId));
        setDetailLoading(true);
        setDetailError('');
        setDetailData(null);
        try {
            const res = await getSalesOrder(orderId);
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
    }, [t]);

    const closeDetails = () => {
        setDetailId('');
        setDetailData(null);
        setDetailError('');
        setDetailLoading(false);
    };

    // KPIs computed from current page (lightweight; full-period KPIs live in Sales Reports).
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
            {
                key: 'revenue',
                label: t('kpi.revenue'),
                value: money(invoicedRevenue),
                className: 'revenue',
            },
        ];
    }, [orders, total, t]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const rangeTo = Math.min(page * PAGE_SIZE, total);

    const detailTitle = detailData?.invoice?.invoiceNo
        ? t('detail.titleNo', { no: detailData.invoice.invoiceNo })
        : detailData?.id
          ? t('detail.titleId', { id: detailData.id })
          : t('detail.title');

    return (
        <div className="so-container">
            <header className="so-header">
                <div>
                    <h2 className="so-title">
                        <ShoppingCart size={20} color="#F59E0B" /> {t('title')}
                    </h2>
                    <p className="so-sub">{t('sub')}</p>
                </div>
                <div style={{ display: 'inline-flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExportMenu
                        onPdf={() => runExport('pdf')}
                        onExcel={() => runExport('excel')}
                        busy={exporting}
                        disabled={loading}
                        locale={locale}
                    />
                    <div className="so-order-count-badge">{t('count', { n: total.toLocaleString() })}</div>
                </div>
            </header>

            <div className="so-kpi-grid">
                {kpis.map((k) => (
                    <div key={k.key} className="so-kpi-card">
                        <p className="so-kpi-label">{k.label}</p>
                        <h3 className={`so-kpi-value ${k.className || ''}`}>{k.value}</h3>
                    </div>
                ))}
            </div>

            <div className="so-filter-bar">
                <div className="so-search-wrapper">
                    <Search className="so-search-icon" size={16} />
                    <input
                        type="text"
                        className="so-search-input"
                        placeholder={t('search')}
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                <select
                    className="so-select"
                    value={selectedWorkshopId}
                    onChange={(e) => setSelectedWorkshopId(e.target.value)}
                    disabled={workshopOptionsLoading}
                    aria-label={t('filter.workshop')}
                >
                    <option value="">{workshopOptionsLoading ? t('loadingWorkshops') : t('allWorkshops')}</option>
                    {workshopOptions.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={!selectedWorkshopId || branchOptionsLoading}
                    aria-label={t('filter.branch')}
                >
                    <option value="">
                        {selectedWorkshopId ? t('allBranches') : t('selectWorkshopFirst')}
                    </option>
                    {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label={t('filter.status')}
                >
                    {STATUS_OPTION_VALUES.map((value) => (
                        <option key={value || 'all'} value={value}>
                            {t(SO_STATUS_OPTION_KEYS[value] || 'status.all')}
                        </option>
                    ))}
                </select>
                <div className="so-date-group">
                    <input
                        type="datetime-local"
                        className="so-date-input"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        step={60}
                        aria-label={t('date.from')}
                    />
                    <input
                        type="datetime-local"
                        className="so-date-input"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        step={60}
                        aria-label={t('date.to')}
                    />
                </div>
            </div>

            {loadError ? (
                <div
                    role="alert"
                    style={{
                        margin: '12px 0',
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: '#FEF2F2',
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                    }}
                >
                    {loadError}
                </div>
            ) : null}

            <div className="so-table-wrapper">
                <table className="so-table">
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
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: 24 }}>
                                    <Loader size={18} className="spin" /> {t('loading')}
                                </td>
                            </tr>
                        ) : orders.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>
                                    {t('empty')}
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr
                                    key={order.id}
                                    onClick={() => openDetails(order.id)}
                                    style={{ cursor: 'pointer', opacity: loading ? 0.55 : undefined }}
                                >
                                    <td>
                                        <div className="so-customer-info">
                                            <strong className="so-inv-link">
                                                {order.invoiceNo ?? t('pendingInvoice')}
                                            </strong>
                                            <span className="so-customer-mobile">{t('orderNo', { id: order.id })}</span>
                                        </div>
                                    </td>
                                    <td>{formatInvoiceDateTime(order)}</td>
                                    <td className="so-text-dim">{order.workshopName ?? '—'}</td>
                                    <td className="so-text-dim">{order.branchName ?? '—'}</td>
                                    <td>
                                        <div className="so-customer-info">
                                            <strong>{order.customerName ?? t('walkIn')}</strong>
                                            <span className="so-customer-mobile">{order.customerMobile ?? '—'}</span>
                                        </div>
                                    </td>
                                    <td>{order.plateNo ?? '—'}</td>
                                    <td style={{ fontSize: '0.8125rem' }}>{order.technicianNames ?? '—'}</td>
                                    <td style={{ fontWeight: 600 }}>
                                        {order.totalAmount != null
                                            ? toNumber(order.totalAmount).toLocaleString(undefined, {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2,
                                              })
                                            : '—'}
                                    </td>
                                    <td>
                                        <StatusBadge status={order.status} t={t} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {total > 0 && (
                <div className="ws-report-pagination" style={{ marginTop: 12 }}>
                    <p className="ws-report-pagination__info">
                        {t('showing', {
                            from: rangeFrom,
                            to: rangeTo,
                            total: total.toLocaleString(),
                        })}
                        {loading ? <span> · {t('loading')}</span> : null}
                    </p>
                    <nav className="ws-report-pagination__nav" aria-label={t('pageAria')}>
                        <button
                            type="button"
                            className="ws-report-pagination__edge"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            {t('prev')}
                        </button>
                        <div className="ws-report-pagination__pages" role="group" aria-label={t('pageNums')}>
                            {(() => {
                                const totalP = totalPages;
                                const cur = page;
                                const maxBtn = 7;
                                let start = Math.max(1, cur - Math.floor(maxBtn / 2));
                                const end = Math.min(totalP, start + maxBtn - 1);
                                start = Math.max(1, end - maxBtn + 1);
                                const nums = [];
                                for (let n = start; n <= end; n += 1) nums.push(n);
                                return nums.map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        className={`ws-report-pagination__page${n === cur ? ' ws-report-pagination__page--active' : ''}`}
                                        aria-current={n === cur ? 'page' : undefined}
                                        disabled={loading}
                                        onClick={() => setPage(n)}
                                    >
                                        {n}
                                    </button>
                                ));
                            })()}
                        </div>
                        <button
                            type="button"
                            className="ws-report-pagination__edge"
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            {t('next')}
                        </button>
                    </nav>
                </div>
            )}

            {detailId && (
                <Modal
                    title={detailTitle}
                    onClose={closeDetails}
                    width="min(1100px, 98vw)"
                    contentClassName="ws-modal-order-details"
                >
                    {detailLoading ? (
                        <ShimmerTextBlock lines={6} />
                    ) : detailError ? (
                        <div style={{ color: '#B91C1C' }}>{detailError}</div>
                    ) : detailData ? (
                        <div className="ws-order-details-modal-body">
                            <div className="ws-report-table-wrapper">
                                <table className="ws-table">
                                    <tbody>
                                        <tr><th>{t('d.orderStatus')}</th><td>{formatStatusLabel(detailData.status, t)}</td></tr>
                                        <tr><th>{t('d.source')}</th><td>{formatStatusLabel(detailData.source, t)}</td></tr>
                                        <tr><th>{t('d.workshop')}</th><td>{detailData.workshopName ?? '—'}</td></tr>
                                        <tr><th>{t('d.branch')}</th><td>{detailData.branchName ?? '—'}</td></tr>
                                        <tr><th>{t('d.placed')}</th><td>{formatDateTime(detailData.createdAt)}</td></tr>
                                        {detailData.invoice ? (
                                            <>
                                                <tr><th>{t('d.invoiceNo')}</th><td>{detailData.invoice.invoiceNo ?? '—'}</td></tr>
                                                <tr>
                                                    <th>{t('d.datetime')}</th>
                                                    <td>
                                                        {formatDateTime(
                                                            detailData.invoice.issuedAt ?? detailData.invoice.invoiceDate,
                                                        )}
                                                    </td>
                                                </tr>
                                                <tr><th>{t('d.payStatus')}</th><td>{formatStatusLabel(detailData.invoice.paymentStatus, t)}</td></tr>
                                            </>
                                        ) : null}
                                        <tr><th>{t('d.customer')}</th><td>{detailData.customer?.name ?? '—'}</td></tr>
                                        <tr><th>{t('d.phone')}</th><td>{detailData.customer?.mobile ?? '—'}</td></tr>
                                        <tr>
                                            <th>{t('d.vehicle')}</th>
                                            <td>
                                                {detailData.vehicle?.plateNo ?? '—'}
                                                {detailData.vehicle &&
                                                (detailData.vehicle.make || detailData.vehicle.model || detailData.vehicle.year)
                                                    ? ` · ${[detailData.vehicle.year, detailData.vehicle.make, detailData.vehicle.model]
                                                          .filter(Boolean)
                                                          .join(' ')}`
                                                    : ''}
                                            </td>
                                        </tr>
                                        {detailData.invoice ? (
                                            <tr>
                                                <th>{t('d.total')}</th>
                                                <td>{t('money.sar', { amount: toNumber(detailData.invoice.totalAmount).toLocaleString() })}</td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </div>

                            {detailData.orderDiscount &&
                            (toNumber(detailData.orderDiscount.totalDiscountValue) > 0 ||
                                toNumber(detailData.orderDiscount.promoDiscountAmount) > 0 ||
                                detailData.orderDiscount.promoCode) ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>
                                        {t('d.promoTitle')}
                                    </p>
                                    <table className="ws-table">
                                        <tbody>
                                            <tr>
                                                <th>{t('d.orderDisc')}</th>
                                                <td>
                                                    {formatDiscountCell(
                                                        detailData.orderDiscount.totalDiscountType,
                                                        detailData.orderDiscount.totalDiscountValue,
                                                        t,
                                                    )}
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>{t('d.promoDisc')}</th>
                                                <td>
                                                    {t('money.sar', {
                                                        amount: toNumber(detailData.orderDiscount.promoDiscountAmount).toLocaleString(),
                                                    })}
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>{t('d.promoCode')}</th>
                                                <td>{detailData.orderDiscount.promoCode ?? '—'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}

                            {Array.isArray(detailData.jobs) && detailData.jobs.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('d.jobs')}</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
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
                                                {detailData.jobs.map((job) => (
                                                    <tr key={job.id}>
                                                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{job.id}</td>
                                                        <td>{job.departmentName ?? '—'}</td>
                                                        <td>{formatStatusLabel(job.status, t)}</td>
                                                        <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                                            {formatDateTime(job.createdAt)}
                                                        </td>
                                                        <td style={{ fontSize: '0.8125rem' }}>
                                                            {job.completedAt ? formatDateTime(job.completedAt) : '—'}
                                                        </td>
                                                        <td>{t('money.sar', { amount: toNumber(job.amountBeforeDiscount).toLocaleString() })}</td>
                                                        <td>{t('money.sar', { amount: toNumber(job.amountAfterDiscount).toLocaleString() })}</td>
                                                        <td>{t('money.sar', { amount: toNumber(job.vatAmount).toLocaleString() })}</td>
                                                        <td className="ws-font-bold">
                                                            {t('money.sar', { amount: toNumber(job.totalAmount).toLocaleString() })}
                                                        </td>
                                                        <td style={{ fontSize: '0.8125rem', minWidth: 160 }}>
                                                            {(job.assignments ?? []).length === 0
                                                                ? '—'
                                                                : (job.assignments ?? [])
                                                                      .map((a) => a.technicianName)
                                                                      .filter(Boolean)
                                                                      .join(', ') || '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}

                            {Array.isArray(detailData.lineItems) && detailData.lineItems.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('d.lines')}</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
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
                                                {detailData.lineItems.map((row) => (
                                                    <tr key={row.id}>
                                                        <td>{row.jobId ?? '—'}</td>
                                                        <td>{row.departmentName ?? '—'}</td>
                                                        <td>{row.itemName ?? '—'}</td>
                                                        <td>{row.itemType ?? '—'}</td>
                                                        <td>{row.qty}</td>
                                                        <td>{toNumber(row.unitPrice).toLocaleString()}</td>
                                                        <td>{formatDiscountCell(row.discountType, row.discountValue, t)}</td>
                                                        <td style={{ fontSize: '0.8125rem' }}>
                                                            {toNumber(row.vatPercent)}% · {String(row.vatMode ?? '—')}
                                                        </td>
                                                        <td className="ws-font-bold">
                                                            {toNumber(row.lineTotal).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}

                            {detailData.invoice && Array.isArray(detailData.invoice.payments) && detailData.invoice.payments.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('d.payments')}</p>
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('d.method')}</th>
                                                <th>{t('d.amount')}</th>
                                                <th>{t('d.paidAt')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailData.invoice.payments.map((p) => (
                                                <tr key={p.id}>
                                                    <td>{p.method ?? '—'}</td>
                                                    <td className="ws-font-bold">
                                                        {toNumber(p.amount).toLocaleString()}
                                                    </td>
                                                    <td>{formatDateTime(p.paidAt)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </Modal>
            )}
        </div>
    );
}
