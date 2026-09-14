import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, Search, Loader } from 'lucide-react';
import '../../styles/admin/SalesOrders.css';
import '../workshop/Workshop.css';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import { ShimmerTextBlock } from '../../components/supplier/Shimmer';
import {
    getBranches,
    getInvoice,
    getInvoices,
    getWorkshopOptions,
} from '../../services/superAdminApi';
import { ExportMenu } from '../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../utils/tableExport';
import { salesT, SALES_PAY_STATUS_KEYS } from '../../utils/salesI18n';

const PAGE_SIZE = 50;
/** Backend `listInvoices` caps each request at 200 rows. */
const EXPORT_BATCH_SIZE = 200;

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

function localDateTimeToIso(localValue) {
    if (!localValue) return '';
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
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
        startDate: localDateTimeToIso(dateFrom) || undefined,
        endDate: localDateTimeToIso(dateTo) || undefined,
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

const PAYMENT_STATUS_CLASS = {
    paid: 'so-status-completed',
    unpaid: 'so-status-cancelled',
    partial: 'so-status-pending',
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
        <span className={`so-status-badge ${PAYMENT_STATUS_CLASS[key] ?? 'so-status-pending'}`}>
            {label}
        </span>
    );
}

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
    const [page, setPage] = useState(1);
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

    useLayoutEffect(() => {
        setPage(1);
    }, [selectedWorkshopId, selectedBranchId, paymentStatusFilter, dateFrom, dateTo, searchDebounced]);

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

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await getInvoices(
                buildInvoiceListQuery({
                    ...listQueryBase,
                    limit: PAGE_SIZE,
                    offset: (page - 1) * PAGE_SIZE,
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
    }, [listQueryBase, page, t]);

    useEffect(() => {
        void fetchInvoices();
    }, [fetchInvoices]);

    const fetchAllFilteredInvoices = useCallback(async () => {
        let offset = 0;
        let totalCount = Number.POSITIVE_INFINITY;
        const all = [];
        while (offset < totalCount) {
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
        return all;
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
            { label: t('ws.kpi.collected'), value: money(totalPaid), className: 'revenue' },
            { label: t('ws.kpi.unpaid'), value: unpaidCount.toLocaleString() },
        ];
    }, [invoices, total, t]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const rangeTo = Math.min(page * PAGE_SIZE, total);

    const detailTitle = detailData?.invoiceNo
        ? t('ws.detail.titleNo', { no: detailData.invoiceNo })
        : t('ws.detail.title');

    if (detailId) {
        return (
            <AdminModalAsScreen
                title={detailTitle}
                onClose={closeDetails}
                wide
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
                                        <tr><th>{t('ws.d.invoiceNo')}</th><td>{detailData.invoiceNo ?? '—'}</td></tr>
                                        <tr>
                                            <th>{t('ws.d.datetime')}</th>
                                            <td>{formatDateTime(detailData.issuedAt ?? detailData.invoiceDate)}</td>
                                        </tr>
                                        <tr><th>{t('ws.d.workshop')}</th><td>{detailData.workshopName ?? '—'}</td></tr>
                                        <tr><th>{t('ws.d.branch')}</th><td>{detailData.branchName ?? '—'}</td></tr>
                                        <tr><th>{t('ws.d.source')}</th><td>{formatStatusLabel(detailData.salesOrder?.source)}</td></tr>
                                        <tr><th>{t('ws.d.orderStatus')}</th><td>{formatStatusLabel(detailData.salesOrder?.status)}</td></tr>
                                        <tr>
                                            <th>{t('ws.d.placed')}</th>
                                            <td>{formatDateTime(detailData.salesOrder?.createdAt)}</td>
                                        </tr>
                                        <tr><th>{t('ws.d.customer')}</th><td>{detailData.customer?.name ?? '—'}</td></tr>
                                        <tr><th>{t('ws.d.phone')}</th><td>{detailData.customer?.mobile ?? '—'}</td></tr>
                                        <tr>
                                            <th>{t('ws.d.vehicle')}</th>
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
                                        <tr>
                                            <th>{t('ws.d.subtotal')}</th>
                                            <td>{t('money.sar', { amount: toNumber(detailData.subtotal).toLocaleString() })}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('ws.d.vat')}</th>
                                            <td>{t('money.sar', { amount: toNumber(detailData.vatAmount).toLocaleString() })}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('ws.d.discount')}</th>
                                            <td>{t('money.sar', { amount: toNumber(detailData.discountAmount).toLocaleString() })}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('ws.d.total')}</th>
                                            <td className="ws-font-bold">
                                                {t('money.sar', { amount: toNumber(detailData.totalAmount).toLocaleString() })}
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>{t('ws.d.payStatus')}</th>
                                            <td>{formatPayStatusLabel(detailData.paymentStatus, t)}</td>
                                        </tr>
                                        {detailData.deferredPaymentMethod ? (
                                            <tr>
                                                <th>{t('ws.d.deferred')}</th>
                                                <td>{detailData.deferredPaymentMethod}</td>
                                            </tr>
                                        ) : null}
                                        {detailData.createdBy ? (
                                            <tr>
                                                <th>{t('ws.d.createdBy')}</th>
                                                <td>
                                                    {detailData.createdBy.name ?? detailData.createdBy.email ?? '—'}
                                                    {detailData.createdBy.userType ? ` · ${formatStatusLabel(detailData.createdBy.userType)}` : ''}
                                                </td>
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
                                        {t('ws.d.promoTitle')}
                                    </p>
                                    <table className="ws-table">
                                        <tbody>
                                            <tr>
                                                <th>{t('ws.d.orderDisc')}</th>
                                                <td>
                                                    {formatDiscountCell(
                                                        detailData.orderDiscount.totalDiscountType,
                                                        detailData.orderDiscount.totalDiscountValue,
                                                        t,
                                                    )}
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>{t('ws.d.promoDisc')}</th>
                                                <td>
                                                    {t('money.sar', {
                                                        amount: toNumber(detailData.orderDiscount.promoDiscountAmount).toLocaleString(),
                                                    })}
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>{t('ws.d.promoCode')}</th>
                                                <td>{detailData.orderDiscount.promoCode ?? '—'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}

                            {Array.isArray(detailData.jobs) && detailData.jobs.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('ws.d.jobs')}</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
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
                                                {detailData.jobs.map((job) => (
                                                    <tr key={job.id}>
                                                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{job.id}</td>
                                                        <td>{job.departmentName ?? '—'}</td>
                                                        <td>{formatStatusLabel(job.status)}</td>
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
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('ws.d.lines')}</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
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

                            {Array.isArray(detailData.payments) && detailData.payments.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>{t('ws.d.payments')}</p>
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('ws.d.method')}</th>
                                                <th>{t('ws.d.amount')}</th>
                                                <th>{t('ws.d.paidAt')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailData.payments.map((p) => (
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
            </AdminModalAsScreen>
        );
    }

    return (
        <div className="so-container">
            <header className="so-header">
                <div>
                    <h2 className="so-title">
                        <FileText size={20} color="#F59E0B" /> {t('ws.title')}
                    </h2>
                    <p className="so-sub">{t('ws.sub')}</p>
                </div>
                <div style={{ display: 'inline-flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExportMenu
                        onPdf={() => runExport('pdf')}
                        onExcel={() => runExport('excel')}
                        busy={exporting}
                        disabled={loading}
                        t={t}
                        locale={locale}
                    />
                    <div className="so-order-count-badge">{t('ws.count', { n: total.toLocaleString() })}</div>
                </div>
            </header>

            <div className="so-kpi-grid">
                {kpis.map((k) => (
                    <div key={k.label} className="so-kpi-card">
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
                        placeholder={t('ws.search')}
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                <select
                    className="so-select"
                    value={selectedWorkshopId}
                    onChange={(e) => setSelectedWorkshopId(e.target.value)}
                    disabled={workshopOptionsLoading}
                    aria-label={t('ws.filter.workshop')}
                >
                    <option value="">{workshopOptionsLoading ? t('ws.loadingWorkshops') : t('ws.allWorkshops')}</option>
                    {workshopOptions.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={!selectedWorkshopId || branchOptionsLoading}
                    aria-label={t('ws.filter.branch')}
                >
                    <option value="">
                        {selectedWorkshopId ? t('ws.allBranches') : t('ws.selectWorkshopFirst')}
                    </option>
                    {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    aria-label={t('ws.filter.payment')}
                >
                    {PAYMENT_STATUS_OPTIONS.map((value) => (
                        <option key={value || 'all'} value={value}>
                            {t(SALES_PAY_STATUS_KEYS[value] || 'ws.pay.all')}
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
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: 24 }}>
                                    <Loader size={18} className="spin" /> {t('ws.loading')}
                                </td>
                            </tr>
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>
                                    {t('ws.empty')}
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr
                                    key={inv.id}
                                    onClick={() => openDetails(inv.id)}
                                    style={{ cursor: 'pointer', opacity: loading ? 0.55 : undefined }}
                                >
                                    <td>
                                        <div className="so-customer-info">
                                            <strong className="so-inv-link">{inv.invoiceNo ?? '—'}</strong>
                                            <span className="so-customer-mobile">
                                                {t('ws.orderNo', { id: inv.salesOrderId })}
                                            </span>
                                        </div>
                                    </td>
                                    <td>{formatInvoiceDateTime(inv)}</td>
                                    <td className="so-text-dim">{inv.workshopName ?? '—'}</td>
                                    <td className="so-text-dim">{inv.branchName ?? '—'}</td>
                                    <td>
                                        <div className="so-customer-info">
                                            <strong>{inv.customerName ?? t('ws.walkIn')}</strong>
                                            <span className="so-customer-mobile">{inv.customerMobile ?? '—'}</span>
                                        </div>
                                    </td>
                                    <td>{inv.plateNo ?? '—'}</td>
                                    <td>{toNumber(inv.itemsCount)}</td>
                                    <td style={{ fontWeight: 600 }}>
                                        {toNumber(inv.totalAmount).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>
                                    <td>
                                        <PaymentStatusBadge status={inv.paymentStatus} t={t} />
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
                        {t('ws.showing', {
                            from: rangeFrom,
                            to: rangeTo,
                            total: total.toLocaleString(),
                        })}
                        {loading ? <span> · {t('ws.loading')}</span> : null}
                    </p>
                    <nav className="ws-report-pagination__nav" aria-label={t('ws.pageAria')}>
                        <button
                            type="button"
                            className="ws-report-pagination__edge"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            {t('ws.prev')}
                        </button>
                        <div className="ws-report-pagination__pages" role="group" aria-label={t('ws.pageNums')}>
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
                            {t('ws.next')}
                        </button>
                    </nav>
                </div>
            )}
        </div>
    );
}
