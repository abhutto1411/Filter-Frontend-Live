import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, FileText, Search } from 'lucide-react';
import '../../styles/ui.css';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import { BUSINESS_TIMEZONE, riyadhBoundToApiIso } from '../../utils/riyadhBusinessRange';
import {
    getBranches,
    getInvoice,
    getInvoices,
    getWorkshopOptions,
} from '../../services/superAdminApi';
import { ExportMenu } from '../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../utils/tableExport';
import { salesT, SALES_PAY_STATUS_KEYS } from '../../utils/salesI18n';

/** Backend `listInvoices` caps each request at 200 rows. */
const EXPORT_BATCH_SIZE = 200;
/** And an export stops there, so a six-figure filter cannot fire 500 requests. */
const EXPORT_MAX_ROWS = 5000;

function unwrapInvoicesList(res) {
    if (Array.isArray(res?.invoices)) return res.invoices;
    if (Array.isArray(res?.data?.invoices)) return res.data.invoices;
    return [];
}

function unwrapInvoicesTotal(res, fallback = 0) {
    const raw = res?.total ?? res?.data?.total;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * A `datetime-local` bound as the UTC instant the API wants, reading the typed
 * wall clock as Asia/Riyadh — the business timezone the figures are reported
 * in, not whatever zone the viewer's laptop is set to. It is computed while
 * rendering, so a value the helper rejects drops the bound rather than
 * throwing the screen away.
 */
function isoBound(raw, edge) {
    try {
        return riyadhBoundToApiIso(raw, edge) || undefined;
    } catch {
        return undefined;
    }
}

function buildInvoiceListQuery({
    workshopId,
    branchId,
    paymentStatus,
    search,
    dateFrom,
    dateTo,
    limit,
    offset,
}) {
    return {
        workshopId: workshopId || undefined,
        branchId: branchId || undefined,
        paymentStatus: paymentStatus || undefined,
        search: search || undefined,
        startDate: isoBound(dateFrom, 'start'),
        endDate: isoBound(dateTo, 'end'),
        limit: String(limit),
        offset: String(offset),
    };
}

/** Build {headers, rows} mirroring the on-screen table — used for PDF/Excel export. */
function buildWorkshopSalesExportRows(invoices, fmtDateTime, t) {
    const headers = [
        t('ws.exp.invNo'),
        t('ws.exp.order'),
        t('ws.exp.datetime'),
        t('ws.exp.workshop'),
        t('ws.exp.branch'),
        t('ws.exp.customer'),
        t('ws.exp.mobile'),
        t('ws.exp.vehicle'),
        t('ws.exp.items'),
        t('ws.exp.total'),
        t('ws.exp.payment'),
    ];
    const n2 = (v) => { const x = Number(v); return Number.isFinite(x) ? Number(x.toFixed(2)) : 0; };
    const rows = (invoices || []).map((inv) => [
        inv.invoiceNo ?? '—',
        inv.salesOrderId ?? '—',
        fmtDateTime(inv?.issuedAt ?? inv?.invoiceDate),
        inv.workshopName ?? '—',
        inv.branchName ?? '—',
        inv.customerName ?? t('ws.walkIn'),
        inv.customerMobile ?? '—',
        inv.plateNo ?? '—',
        n2(inv.itemsCount),
        n2(inv.totalAmount),
        String(inv.paymentStatus ?? '—'),
    ]);
    return { headers, rows };
}

const PAYMENT_STATUS_OPTIONS = ['', 'paid', 'unpaid', 'partial'];

const PAYMENT_STATUS_TONE = {
    paid: 'ok',
    unpaid: 'dang',
    partial: 'warn',
};

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

function formatStatusLabel(status) {
    if (status == null || String(status).trim() === '') return '—';
    return String(status)
        .trim()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function PaymentStatusBadge({ status, t }) {
    const key = String(status ?? '').trim().toLowerCase();
    const labelKey = SALES_PAY_STATUS_KEYS[key];
    const label = labelKey ? t(labelKey) : formatStatusLabel(status);
    return (
        <span className={`ui-pill ui-pill--${PAYMENT_STATUS_TONE[key] ?? 'warn'}`}>
            {label}
        </span>
    );
}

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

function formatInvoiceDateTime(inv) {
    return formatDateTime(inv?.issuedAt ?? inv?.invoiceDate);
}

function formatDiscountCell(discountType, discountValue, t) {
    const dtype = String(discountType ?? '').toLowerCase();
    const v = toNumber(discountValue);
    if (!v) return '—';
    if (dtype === 'percent' || dtype === 'percentage') return `${v}%`;
    return t('money.sar', { amount: v.toLocaleString() });
}

function formatPayStatusLabel(status, t) {
    const key = String(status ?? '').trim().toLowerCase();
    const labelKey = SALES_PAY_STATUS_KEYS[key];
    return labelKey ? t(labelKey) : formatStatusLabel(status);
}

const sar = (t, v) => t('money.sar', { amount: toNumber(v).toLocaleString() });

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

function InvoiceDetailsBody({ data, loading, error, t }) {
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

    const disc = data.orderDiscount;
    const showDiscount = disc
        && (toNumber(disc.totalDiscountValue) > 0
            || toNumber(disc.promoDiscountAmount) > 0
            || disc.promoCode);

    return (
        <div className="ui-stack">
            <DetailTable>
                <tbody>
                    <tr><th>{t('ws.d.invoiceNo')}</th><td>{data.invoiceNo ?? '—'}</td></tr>
                    <tr>
                        <th>{t('ws.d.datetime')}</th>
                        <td>{formatInvoiceDateTime(data)}</td>
                    </tr>
                    <tr><th>{t('ws.d.workshop')}</th><td>{data.workshopName ?? '—'}</td></tr>
                    <tr><th>{t('ws.d.branch')}</th><td>{data.branchName ?? '—'}</td></tr>
                    <tr><th>{t('ws.d.source')}</th><td>{formatStatusLabel(data.salesOrder?.source)}</td></tr>
                    <tr><th>{t('ws.d.orderStatus')}</th><td>{formatStatusLabel(data.salesOrder?.status)}</td></tr>
                    <tr><th>{t('ws.d.placed')}</th><td>{formatDateTime(data.salesOrder?.createdAt)}</td></tr>
                    <tr><th>{t('ws.d.customer')}</th><td>{data.customer?.name ?? '—'}</td></tr>
                    <tr><th>{t('ws.d.phone')}</th><td>{data.customer?.mobile ?? '—'}</td></tr>
                    <tr>
                        <th>{t('ws.d.vehicle')}</th>
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
                    <tr><th>{t('ws.d.subtotal')}</th><td className="ui-num">{sar(t, data.subtotal)}</td></tr>
                    <tr><th>{t('ws.d.vat')}</th><td className="ui-num">{sar(t, data.vatAmount)}</td></tr>
                    <tr><th>{t('ws.d.discount')}</th><td className="ui-num">{sar(t, data.discountAmount)}</td></tr>
                    <tr>
                        <th>{t('ws.d.total')}</th>
                        <td className="ui-num ui-strong">{sar(t, data.totalAmount)}</td>
                    </tr>
                    <tr>
                        <th>{t('ws.d.payStatus')}</th>
                        <td>{formatPayStatusLabel(data.paymentStatus, t)}</td>
                    </tr>
                    {data.deferredPaymentMethod ? (
                        <tr>
                            <th>{t('ws.d.deferred')}</th>
                            <td>{data.deferredPaymentMethod}</td>
                        </tr>
                    ) : null}
                    {data.createdBy ? (
                        <tr>
                            <th>{t('ws.d.createdBy')}</th>
                            <td>
                                {data.createdBy.name ?? data.createdBy.email ?? '—'}
                                {data.createdBy.userType ? ` · ${formatStatusLabel(data.createdBy.userType)}` : ''}
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </DetailTable>

            {showDiscount ? (
                <DetailTable title={t('ws.d.promoTitle')}>
                    <tbody>
                        <tr>
                            <th>{t('ws.d.orderDisc')}</th>
                            <td>
                                {formatDiscountCell(disc.totalDiscountType, disc.totalDiscountValue, t)}
                            </td>
                        </tr>
                        <tr>
                            <th>{t('ws.d.promoDisc')}</th>
                            <td className="ui-num">{sar(t, disc.promoDiscountAmount)}</td>
                        </tr>
                        <tr>
                            <th>{t('ws.d.promoCode')}</th>
                            <td>{disc.promoCode ?? '—'}</td>
                        </tr>
                    </tbody>
                </DetailTable>
            ) : null}

            {Array.isArray(data.jobs) && data.jobs.length > 0 ? (
                <DetailTable title={t('ws.d.jobs')}>
                    <thead>
                        <tr>
                            <th>{t('ws.d.jobNo')}</th>
                            <th>{t('ws.d.dept')}</th>
                            <th>{t('ws.d.status')}</th>
                            <th>{t('ws.d.opened')}</th>
                            <th>{t('ws.d.completed')}</th>
                            <th>{t('ws.d.beforeDisc')}</th>
                            <th>{t('ws.d.afterDisc')}</th>
                            <th>{t('ws.d.vat')}</th>
                            <th>{t('ws.d.jobTotal')}</th>
                            <th>{t('ws.d.techs')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.jobs.map((job) => (
                            <tr key={job.id}>
                                <td className="ui-num">{job.id}</td>
                                <td>{job.departmentName ?? '—'}</td>
                                <td>{formatStatusLabel(job.status)}</td>
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
                <DetailTable title={t('ws.d.lines')}>
                    <thead>
                        <tr>
                            <th>{t('ws.d.jobNo')}</th>
                            <th>{t('ws.d.deptShort')}</th>
                            <th>{t('ws.d.item')}</th>
                            <th>{t('ws.d.type')}</th>
                            <th>{t('ws.d.qty')}</th>
                            <th>{t('ws.d.unit')}</th>
                            <th>{t('ws.d.discount')}</th>
                            <th>{t('ws.d.vat')}</th>
                            <th>{t('ws.d.lineTotal')}</th>
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

            {Array.isArray(data.payments) && data.payments.length > 0 ? (
                <DetailTable title={t('ws.d.payments')}>
                    <thead>
                        <tr>
                            <th>{t('ws.d.method')}</th>
                            <th>{t('ws.d.amount')}</th>
                            <th>{t('ws.d.paidAt')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.payments.map((p) => (
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

export default function WorkshopSales() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => salesT(locale, key, vars), [locale]);

    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [workshopOptionsLoading, setWorkshopOptionsLoading] = useState(true);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');

    const [branchOptions, setBranchOptions] = useState([]);
    const [branchOptionsLoading, setBranchOptionsLoading] = useState(false);
    const [selectedBranchId, setSelectedBranchId] = useState('');

    const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
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
                        list.map((b) => ({ id: String(b.id), name: String(b.name || '').trim() || 'Branch' })),
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

    const listQueryBase = useMemo(
        () => ({
            workshopId: selectedWorkshopId,
            branchId: selectedBranchId,
            paymentStatus: paymentStatusFilter,
            search: searchDebounced,
            dateFrom,
            dateTo,
        }),
        [selectedWorkshopId, selectedBranchId, paymentStatusFilter, searchDebounced, dateFrom, dateTo],
    );

    // Every filter is part of the reset key, so changing one goes back to the
    // first page during the same render rather than in a follow-up effect.
    const resetKey = [
        selectedWorkshopId, selectedBranchId, paymentStatusFilter, dateFrom, dateTo, searchDebounced,
    ].join('|');
    const { page, pageSize, pagerFor } = useServerPaging({ resetKey });

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await getInvoices(
                buildInvoiceListQuery({
                    ...listQueryBase,
                    limit: pageSize,
                    offset: (page - 1) * pageSize,
                }),
            );
            const rows = unwrapInvoicesList(res);
            setInvoices(rows);
            setTotal(unwrapInvoicesTotal(res, rows.length));
        } catch (e) {
            setInvoices([]);
            setTotal(0);
            setLoadError(e?.message || t('ws.errLoad'));
        } finally {
            setLoading(false);
        }
    }, [listQueryBase, page, pageSize, t]);

    useEffect(() => {
        void fetchInvoices();
    }, [fetchInvoices]);

    const fetchAllFilteredInvoices = useCallback(async () => {
        let offset = 0;
        let totalCount = Number.POSITIVE_INFINITY;
        const all = [];
        while (offset < totalCount && all.length < EXPORT_MAX_ROWS) {
            const res = await getInvoices(
                buildInvoiceListQuery({
                    ...listQueryBase,
                    limit: EXPORT_BATCH_SIZE,
                    offset,
                }),
            );
            const batch = unwrapInvoicesList(res);
            totalCount = unwrapInvoicesTotal(res, batch.length);
            all.push(...batch);
            if (!batch.length) break;
            offset += EXPORT_BATCH_SIZE;
            if (all.length >= totalCount) break;
        }
        return all.slice(0, EXPORT_MAX_ROWS);
    }, [listQueryBase]);

    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setLoadError('');
        try {
            const list = await fetchAllFilteredInvoices();
            const { headers, rows } = buildWorkshopSalesExportRows(list, formatDateTime, t);
            const subtitle = t('ws.count', { n: rows.length })
                + (dateFrom || dateTo ? ` · ${dateFrom || '…'} → ${dateTo || '…'}` : '')
                + (paymentStatusFilter ? ` · ${formatPayStatusLabel(paymentStatusFilter, t)}` : '');
            const title = t('ws.exportTitle');
            if (kind === 'pdf') {
                exportRowsToPdf({ title, subtitle, headers, rows, filenameBase: 'workshop-sales' });
            } else {
                exportRowsToExcel({ sheetName: title, headers, rows, filenameBase: 'workshop-sales' });
            }
        } catch (e) {
            setLoadError(e?.message || t('ws.errExport'));
        } finally {
            setExporting(false);
        }
    }, [fetchAllFilteredInvoices, dateFrom, dateTo, paymentStatusFilter, t]);

    const openDetails = useCallback(async (invoiceId) => {
        if (!invoiceId) return;
        setDetailId(String(invoiceId));
        setDetailLoading(true);
        setDetailError('');
        setDetailData(null);
        try {
            const res = await getInvoice(invoiceId);
            const payload =
                res && typeof res === 'object' && res.data && typeof res.data === 'object'
                    ? res.data
                    : res;
            setDetailData(payload && typeof payload === 'object' ? payload : null);
        } catch (e) {
            setDetailError(e?.message || t('ws.errDetail'));
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

    // Page-scoped figures; the labels say "this page" for exactly that reason.
    const kpis = useMemo(() => {
        const totalIssued = invoices.reduce((acc, i) => acc + toNumber(i.totalAmount), 0);
        const totalPaid = invoices
            .filter((i) => String(i.paymentStatus ?? '').toLowerCase() === 'paid')
            .reduce((acc, i) => acc + toNumber(i.totalAmount), 0);
        const unpaidCount = invoices.filter(
            (i) => String(i.paymentStatus ?? '').toLowerCase() !== 'paid',
        ).length;
        const money = (n) => t('money.sar', {
            amount: n.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        });
        return [
            { label: t('ws.kpi.total'), value: total.toLocaleString() },
            { label: t('ws.kpi.issued'), value: money(totalIssued) },
            { label: t('ws.kpi.collected'), value: money(totalPaid), tone: 'ok' },
            { label: t('ws.kpi.unpaid'), value: unpaidCount.toLocaleString() },
        ];
    }, [invoices, total, t]);

    const detailTitle = detailData?.invoiceNo
        ? t('ws.detail.titleNo', { no: detailData.invoiceNo })
        : t('ws.detail.title');

    if (detailId) {
        return (
            <AdminModalAsScreen title={detailTitle} onClose={closeDetails} wide>
                <InvoiceDetailsBody
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
                        <FileText size={18} /> {t('ws.title')}
                    </h1>
                    <p>{t('ws.sub')}</p>
                </div>
                <div className="ui-toolbar-end">
                    <span className="ui-pill ui-pill--neutral">{t('ws.count', { n: total.toLocaleString() })}</span>
                    <ExportMenu
                        onPdf={() => runExport('pdf')}
                        onExcel={() => runExport('excel')}
                        busy={exporting}
                        disabled={loading}
                        t={t}
                        locale={locale}
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
                    <label htmlFor="wsales-search">{t('ws.label.search')}</label>
                    <div className="ui-search">
                        <Search size={15} />
                        <input
                            id="wsales-search"
                            type="text"
                            className="ui-input"
                            placeholder={t('ws.search')}
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>
                </div>
                <div className="ui-field">
                    <label htmlFor="wsales-workshop">{t('ws.label.workshop')}</label>
                    <select
                        id="wsales-workshop"
                        className="ui-select"
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                        disabled={workshopOptionsLoading}
                    >
                        <option value="">{workshopOptionsLoading ? t('ws.loadingWorkshops') : t('ws.allWorkshops')}</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="wsales-branch">{t('ws.label.branch')}</label>
                    <select
                        id="wsales-branch"
                        className="ui-select"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId || branchOptionsLoading}
                    >
                        <option value="">
                            {selectedWorkshopId ? t('ws.allBranches') : t('ws.selectWorkshopFirst')}
                        </option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="wsales-pay">{t('ws.label.payment')}</label>
                    <select
                        id="wsales-pay"
                        className="ui-select"
                        value={paymentStatusFilter}
                        onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    >
                        {PAYMENT_STATUS_OPTIONS.map((value) => (
                            <option key={value || 'all'} value={value}>
                                {t(SALES_PAY_STATUS_KEYS[value] || 'ws.pay.all')}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="wsales-from">{t('ws.label.from')}</label>
                    <input
                        id="wsales-from"
                        type="datetime-local"
                        className="ui-input"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        step={60}
                    />
                </div>
                <div className="ui-field">
                    <label htmlFor="wsales-to">{t('ws.label.to')}</label>
                    <input
                        id="wsales-to"
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
                            <th>{t('ws.th.invoice')}</th>
                            <th>{t('ws.th.datetime')}</th>
                            <th>{t('ws.th.workshop')}</th>
                            <th>{t('ws.th.branch')}</th>
                            <th>{t('ws.th.customer')}</th>
                            <th>{t('ws.th.vehicle')}</th>
                            <th>{t('ws.th.items')}</th>
                            <th>{t('ws.th.total')}</th>
                            <th>{t('ws.th.payment')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && invoices.length === 0 ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={`sk-${i}`} className="ui-sk-row">
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                    <td><div className="ui-sk ui-sk--pill" /></td>
                                </tr>
                            ))
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={9}>
                                    <div className="ui-empty">
                                        <div className="ui-empty-icon"><FileText size={18} /></div>
                                        <div className="ui-empty-title">{t('ws.empty')}</div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={inv.id} onClick={() => openDetails(inv.id)}>
                                    <td data-label={t('ws.th.invoice')}>
                                        <div className="ui-strong">{inv.invoiceNo ?? '—'}</div>
                                        <div className="ui-meta">{t('ws.orderNo', { id: inv.salesOrderId })}</div>
                                    </td>
                                    <td data-label={t('ws.th.datetime')} className="ui-nowrap">
                                        {formatInvoiceDateTime(inv)}
                                    </td>
                                    <td data-label={t('ws.th.workshop')}>{inv.workshopName ?? '—'}</td>
                                    <td data-label={t('ws.th.branch')}>{inv.branchName ?? '—'}</td>
                                    <td data-label={t('ws.th.customer')}>
                                        <div className="ui-strong">{inv.customerName ?? t('ws.walkIn')}</div>
                                        <div className="ui-meta">{inv.customerMobile ?? '—'}</div>
                                    </td>
                                    <td data-label={t('ws.th.vehicle')}>{inv.plateNo ?? '—'}</td>
                                    <td data-label={t('ws.th.items')} className="ui-num">
                                        {toNumber(inv.itemsCount)}
                                    </td>
                                    <td data-label={t('ws.th.total')} className="ui-num ui-strong">
                                        {toNumber(inv.totalAmount).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>
                                    <td data-label={t('ws.th.payment')}>
                                        <PaymentStatusBadge status={inv.paymentStatus} t={t} />
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
