import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Truck, Search } from 'lucide-react';
import '../../styles/ui.css';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import { BUSINESS_TIMEZONE, riyadhBoundToApiIso } from '../../utils/riyadhBusinessRange';
import {
    getBranches,
    getSupplierOptions,
    getSupplierInvoice,
    getLocalSupplierInvoice,
    getSupplierInvoices,
    getWorkshopOptions,
} from '../../services/superAdminApi';
import { ExportMenu } from '../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../utils/tableExport';
import {
    swsT,
    formatSwsStatusLabel,
    SWS_STATUS_FILTER_VALUES,
    SWS_REVIEW_FILTER_VALUES,
    SWS_STATUS_FILTER_KEYS,
    SWS_REVIEW_FILTER_KEYS,
} from '../../utils/suppliersWarehouseSalesI18n';

const EXPORT_LIMIT = 5000;

const PAYMENT_STATUS_TONE = {
    paid: 'ok',
    unpaid: 'dang',
    partial: 'warn',
};

const REVIEW_TONE = {
    accepted: 'ok',
    rejected: 'dang',
};

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const money2 = (v) =>
    toNumber(v).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function PaymentBadge({ status, t }) {
    const key = String(status ?? '').trim().toLowerCase();
    return (
        <span className={`ui-pill ui-pill--${PAYMENT_STATUS_TONE[key] ?? 'warn'}`}>
            {formatSwsStatusLabel(status, t)}
        </span>
    );
}

function ReviewBadge({ status, t }) {
    const key = String(status ?? '').trim().toLowerCase();
    return (
        <span className={`ui-pill ui-pill--${REVIEW_TONE[key] ?? 'warn'}`}>
            {status ? formatSwsStatusLabel(status, t) : t('review.pendingShort')}
        </span>
    );
}

function AffiliationBadge({ isAffiliated, t }) {
    return (
        <span
            className={`ui-pill ui-pill--${isAffiliated ? 'ok' : 'neutral'}`}
            title={isAffiliated ? t('aff.titleYes') : t('aff.titleNo')}
        >
            {isAffiliated ? t('aff.yes') : t('aff.no')}
        </span>
    );
}

/**
 * Dates are rendered in the business timezone. The API sends UTC instants, so
 * without it an invoice dated the 1st reads as the 31st on any browser set west
 * of Riyadh — and a due date that moves is worse than one that is merely ugly.
 */
function formatDateOnly(raw) {
    if (raw == null || raw === '') return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString(undefined, {
        timeZone: BUSINESS_TIMEZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

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

function formatDiscountCell(mode, value, t) {
    const typ = String(mode ?? '').toLowerCase();
    const v = toNumber(value);
    if (!v) return '—';
    if (typ === 'percent' || typ === 'percentage') return `${v}%`;
    return t('money.sar', { amount: v.toLocaleString() });
}

/**
 * A `datetime-local` bound as the UTC instant the API wants, reading the typed
 * wall clock as Asia/Riyadh rather than the viewer's own zone. Computed while
 * rendering, so a value the helper rejects drops the bound instead of throwing
 * the screen away.
 */
function isoBound(raw, edge) {
    try {
        return riyadhBoundToApiIso(raw, edge) || undefined;
    } catch {
        return undefined;
    }
}

const sar = (t, v) => t('money.sar', { amount: toNumber(v).toLocaleString() });

/** Build {headers, rows} mirroring the on-screen table — used for PDF/Excel export. */
function buildSupplierSalesExportRows(invoices, t) {
    const headers = [
        t('exp.invNo'),
        t('exp.status'),
        t('exp.invoiceDate'),
        t('exp.dueDate'),
        t('exp.supplier'),
        t('exp.supplierMobile'),
        t('exp.affiliation'),
        t('exp.workshop'),
        t('exp.branch'),
        t('exp.items'),
        t('exp.total'),
        t('exp.paid'),
        t('exp.balance'),
        t('exp.payment'),
        t('exp.review'),
    ];
    const n2 = (v) => Number(toNumber(v).toFixed(2));
    const rows = (invoices || []).map((inv) => [
        inv.invoiceNo ?? '—',
        formatSwsStatusLabel(inv.status, t),
        formatDateOnly(inv.invoiceDate),
        formatDateOnly(inv.dueDate),
        inv.supplierName ?? '—',
        inv.supplierMobile ?? '—',
        inv.isAffiliated ? t('aff.yes') : t('aff.no'),
        inv.workshopName ?? '—',
        inv.branchName ?? '—',
        n2(inv.itemsCount),
        n2(inv.grandTotal),
        n2(inv.paidAmount),
        n2(inv.balance),
        formatSwsStatusLabel(inv.paymentStatus, t),
        formatSwsStatusLabel(inv.workshopReviewStatus, t),
    ]);
    return { headers, rows };
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

function SupplierInvoiceDetailsBody({ data, loading, error, t }) {
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

    return (
        <div className="ui-stack">
            <DetailTable>
                <tbody>
                    <tr><th>{t('d.invoiceNo')}</th><td>{data.invoiceNo ?? '—'}</td></tr>
                    <tr><th>{t('d.invoiceDate')}</th><td>{formatDateOnly(data.invoiceDate)}</td></tr>
                    <tr><th>{t('d.dueDate')}</th><td>{formatDateOnly(data.dueDate)}</td></tr>
                    {data.paymentTerms ? (
                        <tr><th>{t('d.paymentTerms')}</th><td>{data.paymentTerms}</td></tr>
                    ) : null}
                    <tr><th>{t('d.status')}</th><td>{formatSwsStatusLabel(data.status, t)}</td></tr>
                    <tr>
                        <th>{t('d.workshopReview')}</th>
                        <td>
                            {data.workshopReviewStatus
                                ? formatSwsStatusLabel(data.workshopReviewStatus, t)
                                : t('review.pendingShort')}
                            {data.workshopReviewedAt
                                ? ` · ${formatDateTime(data.workshopReviewedAt)}`
                                : ''}
                        </td>
                    </tr>
                    {data.workshopRejectionReason ? (
                        <tr>
                            <th>{t('d.rejectionReason')}</th>
                            <td>{data.workshopRejectionReason}</td>
                        </tr>
                    ) : null}
                    <tr>
                        <th>{t('d.supplier')}</th>
                        <td>
                            <div className="ui-strong">{data.supplier?.name ?? '—'}</div>
                            <div className="ui-meta">
                                {[data.supplier?.mobile, data.supplier?.email]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                            </div>
                            {data.supplier?.vatId ? (
                                <div className="ui-meta">
                                    {t('d.vatId', { id: data.supplier.vatId })}
                                </div>
                            ) : null}
                        </td>
                    </tr>
                    <tr><th>{t('d.workshop')}</th><td>{data.workshop?.name ?? '—'}</td></tr>
                    <tr><th>{t('d.branch')}</th><td>{data.branch?.name ?? '—'}</td></tr>
                    {data.po ? (
                        <tr>
                            <th>{t('d.po')}</th>
                            <td>
                                {t('d.poLine', {
                                    id: data.po.id,
                                    status: formatSwsStatusLabel(data.po.status, t),
                                })}
                            </td>
                        </tr>
                    ) : null}
                    <tr><th>{t('d.subtotal')}</th><td className="ui-num">{sar(t, data.subtotal)}</td></tr>
                    <tr>
                        <th>{t('d.invoiceDiscount')}</th>
                        <td className="ui-num">{sar(t, data.invoiceDiscount)}</td>
                    </tr>
                    <tr><th>{t('d.freightIn')}</th><td className="ui-num">{sar(t, data.freightIn)}</td></tr>
                    <tr><th>{t('d.vat')}</th><td className="ui-num">{sar(t, data.vatAmount)}</td></tr>
                    <tr>
                        <th>{t('d.grandTotal')}</th>
                        <td className="ui-num ui-strong">{sar(t, data.grandTotal)}</td>
                    </tr>
                    <tr><th>{t('d.paid')}</th><td className="ui-num">{sar(t, data.paidAmount)}</td></tr>
                    <tr>
                        <th>{t('d.balance')}</th>
                        <td className="ui-num ui-strong">{sar(t, data.balance)}</td>
                    </tr>
                    <tr>
                        <th>{t('d.payment')}</th>
                        <td>{formatSwsStatusLabel(data.paymentStatus, t)}</td>
                    </tr>
                </tbody>
            </DetailTable>

            {Array.isArray(data.items) && data.items.length > 0 ? (
                <DetailTable title={t('d.lineItems')}>
                    <thead>
                        <tr>
                            <th>{t('d.th.item')}</th>
                            <th>{t('d.th.description')}</th>
                            <th>{t('d.th.qty')}</th>
                            <th>{t('d.th.unit')}</th>
                            <th>{t('d.th.discount')}</th>
                            <th>{t('d.th.vat')}</th>
                            <th>{t('d.th.line')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((it) => (
                            <tr key={it.id}>
                                <td className="ui-strong">{it.itemName ?? '—'}</td>
                                <td>{it.lineDescription ?? '—'}</td>
                                <td className="ui-num">{it.qty}</td>
                                <td className="ui-num">{toNumber(it.unitPrice).toLocaleString()}</td>
                                <td>{formatDiscountCell(it.lineDiscountMode, it.lineDiscountValue, t)}</td>
                                <td className="ui-num">{toNumber(it.vatRate)}%</td>
                                <td className="ui-num ui-strong">
                                    {toNumber(it.lineTotal).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </DetailTable>
            ) : null}

            {Array.isArray(data.payments) && data.payments.length > 0 ? (
                <DetailTable title={t('d.payments')}>
                    <thead>
                        <tr>
                            <th>{t('d.th.method')}</th>
                            <th>{t('d.th.amount')}</th>
                            <th>{t('d.th.paidOn')}</th>
                            <th>{t('d.th.reference')}</th>
                            <th>{t('d.th.recordedBy')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.payments.map((p) => (
                            <tr key={p.id}>
                                <td>{p.method ?? '—'}</td>
                                <td className="ui-num ui-strong">
                                    {toNumber(p.amount).toLocaleString()}
                                </td>
                                <td className="ui-nowrap">{formatDateOnly(p.paidAt)}</td>
                                <td>{p.reference ?? '—'}</td>
                                <td>{p.recordedBy?.name ?? p.recordedBy?.email ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </DetailTable>
            ) : null}

            {Array.isArray(data.returns) && data.returns.length > 0 ? (
                <DetailTable title={t('d.returns')}>
                    <thead>
                        <tr>
                            <th>{t('d.th.returnNo')}</th>
                            <th>{t('d.th.date')}</th>
                            <th>{t('d.th.status')}</th>
                            <th>{t('d.th.total')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.returns.map((r) => (
                            <tr key={r.id}>
                                <td>{r.returnNo ?? '—'}</td>
                                <td className="ui-nowrap">{formatDateOnly(r.returnDate)}</td>
                                <td>{formatSwsStatusLabel(r.status, t)}</td>
                                <td className="ui-num ui-strong">
                                    {toNumber(r.grandTotal).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </DetailTable>
            ) : null}
        </div>
    );
}

export default function SuppliersWarehouseSales() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => swsT(locale, key, vars), [locale]);

    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [workshopOptionsLoading, setWorkshopOptionsLoading] = useState(true);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');

    const [branchOptions, setBranchOptions] = useState([]);
    const [branchOptionsLoading, setBranchOptionsLoading] = useState(false);
    const [selectedBranchId, setSelectedBranchId] = useState('');

    const [supplierOptions, setSupplierOptions] = useState([]);
    const [supplierOptionsLoading, setSupplierOptionsLoading] = useState(true);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');

    const [statusFilter, setStatusFilter] = useState('');
    const [reviewStatusFilter, setReviewStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');

    const [invoices, setInvoices] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [detailId, setDetailId] = useState('');
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [exporting, setExporting] = useState(false);

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
                            name: String(w.name || '').trim() || 'Workshop',
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
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setSupplierOptionsLoading(true);
            try {
                // The options endpoint, not the paged list: that one stops at 200
                // rows, so a supplier past the cap could not be picked here.
                const res = await getSupplierOptions(
                    selectedWorkshopId ? { workshopId: selectedWorkshopId } : {},
                );
                const list = Array.isArray(res?.suppliers)
                    ? res.suppliers
                    : Array.isArray(res?.data?.suppliers)
                      ? res.data.suppliers
                      : [];
                if (!cancelled) {
                    setSupplierOptions(
                        list.map((s) => ({
                            id: String(s.id),
                            name: String(s.name || '').trim() || 'Supplier',
                        })),
                    );
                    setSelectedSupplierId('');
                }
            } catch {
                if (!cancelled) {
                    setSupplierOptions([]);
                    setSelectedSupplierId('');
                }
            } finally {
                if (!cancelled) setSupplierOptionsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedWorkshopId]);

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
                            name: String(b.name || '').trim() || 'Branch',
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
    }, [selectedWorkshopId]);

    useEffect(() => {
        const timer = setTimeout(() => setSearchDebounced(searchInput.trim()), 380);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const listQuery = useMemo(() => ({
        workshopId: selectedWorkshopId || undefined,
        branchId: selectedBranchId || undefined,
        supplierId: selectedSupplierId || undefined,
        status: statusFilter || undefined,
        workshopReviewStatus: reviewStatusFilter || undefined,
        search: searchDebounced || undefined,
        startDate: isoBound(dateFrom, 'start'),
        endDate: isoBound(dateTo, 'end'),
    }), [
        selectedWorkshopId,
        selectedBranchId,
        selectedSupplierId,
        statusFilter,
        reviewStatusFilter,
        searchDebounced,
        dateFrom,
        dateTo,
    ]);

    // Every filter is part of the reset key, so changing one goes back to the
    // first page during the same render rather than in a follow-up effect.
    const resetKey = [
        selectedWorkshopId, selectedBranchId, selectedSupplierId, statusFilter,
        reviewStatusFilter, dateFrom, dateTo, searchDebounced,
    ].join('|');
    const { page, pageSize, pagerFor } = useServerPaging({ resetKey });

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await getSupplierInvoices({
                ...listQuery,
                limit: String(pageSize),
                offset: String((page - 1) * pageSize),
            });
            const rows = Array.isArray(res?.supplierInvoices)
                ? res.supplierInvoices
                : Array.isArray(res?.data?.supplierInvoices)
                  ? res.data.supplierInvoices
                  : [];
            setInvoices(rows);
            const tot = res?.total ?? res?.data?.total;
            setTotal(
                typeof tot === 'number' && Number.isFinite(tot)
                    ? tot
                    : Number.parseInt(String(tot ?? ''), 10) || rows.length,
            );
        } catch (e) {
            setInvoices([]);
            setTotal(0);
            setLoadError(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [listQuery, page, pageSize, t]);

    useEffect(() => {
        void fetchInvoices();
    }, [fetchInvoices]);

    // Export the FULL filtered set (one bounded re-fetch with the active filters).
    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setLoadError('');
        try {
            const res = await getSupplierInvoices({
                ...listQuery,
                limit: String(EXPORT_LIMIT),
                offset: '0',
            });
            const list = Array.isArray(res?.supplierInvoices) ? res.supplierInvoices
                : Array.isArray(res?.data?.supplierInvoices) ? res.data.supplierInvoices : [];
            const { headers, rows } = buildSupplierSalesExportRows(list, t);
            const subtitle = t('export.subtitle', { n: rows.length })
                + (dateFrom || dateTo ? ` · ${dateFrom || '…'} → ${dateTo || '…'}` : '')
                + (statusFilter ? t('export.statusPart', { status: statusFilter }) : '');
            if (kind === 'pdf') {
                exportRowsToPdf({
                    title: t('export.title'),
                    subtitle,
                    headers,
                    rows,
                    filenameBase: 'suppliers-warehouse-sales',
                });
            } else {
                exportRowsToExcel({
                    sheetName: t('export.sheet'),
                    headers,
                    rows,
                    filenameBase: 'suppliers-warehouse-sales',
                });
            }
        } catch (e) {
            setLoadError(e?.message || t('err.export'));
        } finally {
            setExporting(false);
        }
    }, [listQuery, dateFrom, dateTo, statusFilter, t]);

    const openDetails = useCallback(async (invoiceId, source) => {
        if (!invoiceId) return;
        setDetailId(String(invoiceId));
        setDetailLoading(true);
        setDetailError('');
        setDetailData(null);
        try {
            const fetcher = source === 'local' ? getLocalSupplierInvoice : getSupplierInvoice;
            const res = await fetcher(invoiceId);
            const payload =
                res && typeof res === 'object' && res.data && typeof res.data === 'object'
                    ? res.data
                    : res;
            setDetailData(payload && typeof payload === 'object' ? payload : null);
        } catch (e) {
            setDetailError(e?.message || t('err.detail'));
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

    // Page-scoped sums beside the filtered count; the labels say which is which.
    const kpis = useMemo(() => {
        const totalIssued = invoices.reduce((acc, i) => acc + toNumber(i.grandTotal), 0);
        const totalPaid = invoices.reduce((acc, i) => acc + toNumber(i.paidAmount), 0);
        const totalBalance = invoices.reduce((acc, i) => acc + toNumber(i.balance), 0);
        const money = (n) => t('money.sar', {
            amount: n.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        });
        return [
            { label: t('kpi.total'), value: total.toLocaleString() },
            { label: t('kpi.issued'), value: money(totalIssued) },
            { label: t('kpi.collected'), value: money(totalPaid), tone: 'ok' },
            { label: t('kpi.outstanding'), value: money(totalBalance), tone: 'warn' },
        ];
    }, [invoices, total, t]);

    const detailKind =
        detailData?.source === 'local' ? t('detail.titleLocal') : t('detail.titleSupplier');
    const detailTitle = detailData?.invoiceNo
        ? t('detail.titleWithNo', { kind: detailKind, no: detailData.invoiceNo })
        : t('detail.titleFallback', { kind: detailKind });

    if (detailId) {
        return (
            <AdminModalAsScreen title={detailTitle} onClose={closeDetails} wide>
                <SupplierInvoiceDetailsBody
                    data={detailData}
                    loading={detailLoading}
                    error={detailError}
                    t={t}
                />
            </AdminModalAsScreen>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-row">
                <div className="ui-head">
                    <h1>
                        <Truck size={18} /> {t('page.title')}
                    </h1>
                    <p>{t('page.sub')}</p>
                </div>
                <div className="ui-toolbar-end">
                    <span className="ui-pill ui-pill--neutral">
                        {t('page.count', { n: total.toLocaleString() })}
                    </span>
                    <ExportMenu
                        onPdf={() => runExport('pdf')}
                        onExcel={() => runExport('excel')}
                        busy={exporting}
                        disabled={loading}
                        locale={locale}
                        t={t}
                    />
                </div>
            </div>

            <div className="ui-kpis">
                {kpis.map((k) => (
                    <div key={k.label} className={`ui-metric${k.tone ? ` ui-metric--${k.tone}` : ''}`}>
                        <div className="ui-metric-label">{k.label}</div>
                        <div className="ui-metric-value">{k.value}</div>
                    </div>
                ))}
            </div>

            <div className="ui-row ui-row--fields">
                <div className="ui-field ui-field--grow">
                    <label htmlFor="sws-search">{t('filter.search')}</label>
                    <div className="ui-search">
                        <Search size={15} />
                        <input
                            id="sws-search"
                            type="text"
                            className="ui-input"
                            placeholder={t('search.placeholder')}
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>
                </div>
                <div className="ui-field">
                    <label htmlFor="sws-workshop">{t('filter.workshop')}</label>
                    <select
                        id="sws-workshop"
                        className="ui-select"
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                        disabled={workshopOptionsLoading}
                    >
                        <option value="">
                            {workshopOptionsLoading ? t('opt.loadingWorkshops') : t('opt.allWorkshops')}
                        </option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="sws-branch">{t('filter.branch')}</label>
                    <select
                        id="sws-branch"
                        className="ui-select"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId || branchOptionsLoading}
                    >
                        <option value="">
                            {selectedWorkshopId ? t('opt.allBranches') : t('opt.selectWorkshopFirst')}
                        </option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="sws-supplier">{t('filter.supplier')}</label>
                    <select
                        id="sws-supplier"
                        className="ui-select"
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        disabled={supplierOptionsLoading}
                    >
                        <option value="">
                            {supplierOptionsLoading ? t('opt.loadingSuppliers') : t('opt.allSuppliers')}
                        </option>
                        {supplierOptions.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="sws-status">{t('filter.status')}</label>
                    <select
                        id="sws-status"
                        className="ui-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        {SWS_STATUS_FILTER_VALUES.map((value) => (
                            <option key={value || 'all'} value={value}>
                                {t(SWS_STATUS_FILTER_KEYS[value] || 'status.all')}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="sws-review">{t('filter.review')}</label>
                    <select
                        id="sws-review"
                        className="ui-select"
                        value={reviewStatusFilter}
                        onChange={(e) => setReviewStatusFilter(e.target.value)}
                    >
                        {SWS_REVIEW_FILTER_VALUES.map((value) => (
                            <option key={value || 'all'} value={value}>
                                {t(SWS_REVIEW_FILTER_KEYS[value] || 'review.all')}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="sws-from">{t('date.from')}</label>
                    <input
                        id="sws-from"
                        type="datetime-local"
                        className="ui-input"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        step={60}
                    />
                </div>
                <div className="ui-field">
                    <label htmlFor="sws-to">{t('date.to')}</label>
                    <input
                        id="sws-to"
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
                            <th>{t('th.invoice')}</th>
                            <th>{t('th.invoiceDate')}</th>
                            <th>{t('th.dueDate')}</th>
                            <th>{t('th.supplier')}</th>
                            <th>{t('th.affiliation')}</th>
                            <th>{t('th.workshop')}</th>
                            <th>{t('th.branch')}</th>
                            <th>{t('th.items')}</th>
                            <th>{t('th.total')}</th>
                            <th>{t('th.paid')}</th>
                            <th>{t('th.balance')}</th>
                            <th>{t('th.payment')}</th>
                            <th>{t('th.review')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && invoices.length === 0 ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={`sk-${i}`} className="ui-sk-row">
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                                    <td><div className="ui-sk ui-sk--pill" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                    <td><div className="ui-sk ui-sk--pill" /></td>
                                    <td><div className="ui-sk ui-sk--pill" /></td>
                                </tr>
                            ))
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={13}>
                                    <div className="ui-empty">
                                        <div className="ui-empty-icon"><Truck size={18} /></div>
                                        <div className="ui-empty-title">{t('empty')}</div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={inv.id} onClick={() => openDetails(inv.id, inv.source)}>
                                    <td data-label={t('th.invoice')}>
                                        <div className="ui-strong">{inv.invoiceNo ?? '—'}</div>
                                        <div className="ui-meta">
                                            {t('row.status', {
                                                status: formatSwsStatusLabel(inv.status, t),
                                            })}
                                        </div>
                                    </td>
                                    <td data-label={t('th.invoiceDate')} className="ui-nowrap">
                                        {formatDateOnly(inv.invoiceDate)}
                                    </td>
                                    <td data-label={t('th.dueDate')} className="ui-nowrap">
                                        {formatDateOnly(inv.dueDate)}
                                    </td>
                                    <td data-label={t('th.supplier')}>
                                        <div className="ui-strong">{inv.supplierName ?? '—'}</div>
                                        <div className="ui-meta">{inv.supplierMobile ?? '—'}</div>
                                    </td>
                                    <td data-label={t('th.affiliation')}>
                                        <AffiliationBadge isAffiliated={!!inv.isAffiliated} t={t} />
                                    </td>
                                    <td data-label={t('th.workshop')}>{inv.workshopName ?? '—'}</td>
                                    <td data-label={t('th.branch')}>{inv.branchName ?? '—'}</td>
                                    <td data-label={t('th.items')} className="ui-num">
                                        {toNumber(inv.itemsCount)}
                                    </td>
                                    <td data-label={t('th.total')} className="ui-num ui-strong">
                                        {money2(inv.grandTotal)}
                                    </td>
                                    <td data-label={t('th.paid')} className="ui-num">
                                        {money2(inv.paidAmount)}
                                    </td>
                                    <td data-label={t('th.balance')} className="ui-num">
                                        {money2(inv.balance)}
                                    </td>
                                    <td data-label={t('th.payment')}>
                                        <PaymentBadge status={inv.paymentStatus} t={t} />
                                    </td>
                                    <td data-label={t('th.review')}>
                                        <ReviewBadge status={inv.workshopReviewStatus} t={t} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                <UiPager {...pagerFor(total)} />
            </div>
        </div>
    );
}
