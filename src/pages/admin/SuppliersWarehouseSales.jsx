import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Truck, Search, Loader } from 'lucide-react';
import '../../styles/admin/SalesOrders.css';
import '../workshop/Workshop.css';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import { ShimmerTextBlock } from '../../components/supplier/Shimmer';
import {
    getBranches,
    getSuppliers,
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

const PAGE_SIZE = 25;
const EXPORT_LIMIT = 5000;

const PAYMENT_STATUS_CLASS = {
    paid: 'so-status-completed',
    unpaid: 'so-status-cancelled',
    partial: 'so-status-pending',
};

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

function PaymentBadge({ status, t }) {
    const key = String(status ?? '').trim().toLowerCase();
    return (
        <span className={`so-status-badge ${PAYMENT_STATUS_CLASS[key] ?? 'so-status-pending'}`}>
            {formatSwsStatusLabel(status, t)}
        </span>
    );
}

function ReviewBadge({ status, t }) {
    const key = String(status ?? '').trim().toLowerCase();
    const cls =
        key === 'accepted'
            ? 'so-status-completed'
            : key === 'rejected'
              ? 'so-status-cancelled'
              : 'so-status-pending';
    return (
        <span className={`so-status-badge ${cls}`}>
            {status ? formatSwsStatusLabel(status, t) : t('review.pendingShort')}
        </span>
    );
}

function AffiliationBadge({ isAffiliated, t }) {
    return (
        <span
            className={`so-status-badge ${isAffiliated ? 'so-status-completed' : 'so-status-pending'}`}
            title={isAffiliated ? t('aff.titleYes') : t('aff.titleNo')}
        >
            {isAffiliated ? t('aff.yes') : t('aff.no')}
        </span>
    );
}

function formatDateOnly(raw) {
    if (raw == null || raw === '') return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString(undefined, {
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

function localDateTimeToIso(localValue) {
    if (!localValue) return '';
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
}

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
                const res = await getSuppliers(
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

    useEffect(() => {
        setPage(1);
    }, [
        selectedWorkshopId,
        selectedBranchId,
        selectedSupplierId,
        statusFilter,
        reviewStatusFilter,
        dateFrom,
        dateTo,
        searchDebounced,
    ]);

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await getSupplierInvoices({
                workshopId: selectedWorkshopId || undefined,
                branchId: selectedBranchId || undefined,
                supplierId: selectedSupplierId || undefined,
                status: statusFilter || undefined,
                workshopReviewStatus: reviewStatusFilter || undefined,
                search: searchDebounced || undefined,
                startDate: localDateTimeToIso(dateFrom) || undefined,
                endDate: localDateTimeToIso(dateTo) || undefined,
                limit: String(PAGE_SIZE),
                offset: String((page - 1) * PAGE_SIZE),
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
    }, [
        selectedWorkshopId,
        selectedBranchId,
        selectedSupplierId,
        statusFilter,
        reviewStatusFilter,
        searchDebounced,
        dateFrom,
        dateTo,
        page,
        t,
    ]);

    useEffect(() => {
        void fetchInvoices();
    }, [fetchInvoices]);

    // Export the FULL filtered set (one bounded re-fetch with the active filters).
    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setLoadError('');
        try {
            const res = await getSupplierInvoices({
                workshopId: selectedWorkshopId || undefined,
                branchId: selectedBranchId || undefined,
                supplierId: selectedSupplierId || undefined,
                status: statusFilter || undefined,
                workshopReviewStatus: reviewStatusFilter || undefined,
                search: searchDebounced || undefined,
                startDate: localDateTimeToIso(dateFrom) || undefined,
                endDate: localDateTimeToIso(dateTo) || undefined,
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
    }, [
        selectedWorkshopId,
        selectedBranchId,
        selectedSupplierId,
        statusFilter,
        reviewStatusFilter,
        searchDebounced,
        dateFrom,
        dateTo,
        t,
    ]);

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
            { label: t('kpi.collected'), value: money(totalPaid), className: 'revenue' },
            { label: t('kpi.outstanding'), value: money(totalBalance) },
        ];
    }, [invoices, total, t]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const rangeTo = Math.min(page * PAGE_SIZE, total);

    const detailKind =
        detailData?.source === 'local' ? t('detail.titleLocal') : t('detail.titleSupplier');
    const detailTitle = detailData?.invoiceNo
        ? t('detail.titleWithNo', { kind: detailKind, no: detailData.invoiceNo })
        : t('detail.titleFallback', { kind: detailKind });

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
                                        <tr><th>{t('d.invoiceNo')}</th><td>{detailData.invoiceNo ?? '—'}</td></tr>
                                        <tr><th>{t('d.invoiceDate')}</th><td>{formatDateOnly(detailData.invoiceDate)}</td></tr>
                                        <tr><th>{t('d.dueDate')}</th><td>{formatDateOnly(detailData.dueDate)}</td></tr>
                                        {detailData.paymentTerms ? (
                                            <tr><th>{t('d.paymentTerms')}</th><td>{detailData.paymentTerms}</td></tr>
                                        ) : null}
                                        <tr><th>{t('d.status')}</th><td>{formatSwsStatusLabel(detailData.status, t)}</td></tr>
                                        <tr>
                                            <th>{t('d.workshopReview')}</th>
                                            <td>
                                                {detailData.workshopReviewStatus
                                                    ? formatSwsStatusLabel(detailData.workshopReviewStatus, t)
                                                    : t('review.pendingShort')}
                                                {detailData.workshopReviewedAt
                                                    ? ` · ${formatDateTime(detailData.workshopReviewedAt)}`
                                                    : ''}
                                            </td>
                                        </tr>
                                        {detailData.workshopRejectionReason ? (
                                            <tr>
                                                <th>{t('d.rejectionReason')}</th>
                                                <td>{detailData.workshopRejectionReason}</td>
                                            </tr>
                                        ) : null}
                                        <tr>
                                            <th>{t('d.supplier')}</th>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{detailData.supplier?.name ?? '—'}</div>
                                                <div style={{ fontSize: 12, color: '#6B7280' }}>
                                                    {[detailData.supplier?.mobile, detailData.supplier?.email]
                                                        .filter(Boolean)
                                                        .join(' · ') || '—'}
                                                </div>
                                                {detailData.supplier?.vatId ? (
                                                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                                                        {t('d.vatId', { id: detailData.supplier.vatId })}
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                        <tr><th>{t('d.workshop')}</th><td>{detailData.workshop?.name ?? '—'}</td></tr>
                                        <tr><th>{t('d.branch')}</th><td>{detailData.branch?.name ?? '—'}</td></tr>
                                        {detailData.po ? (
                                            <tr>
                                                <th>{t('d.po')}</th>
                                                <td>
                                                    {t('d.poLine', {
                                                        id: detailData.po.id,
                                                        status: formatSwsStatusLabel(detailData.po.status, t),
                                                    })}
                                                </td>
                                            </tr>
                                        ) : null}
                                        <tr>
                                            <th>{t('d.subtotal')}</th>
                                            <td>{t('money.sar', { amount: toNumber(detailData.subtotal).toLocaleString() })}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('d.invoiceDiscount')}</th>
                                            <td>{t('money.sar', { amount: toNumber(detailData.invoiceDiscount).toLocaleString() })}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('d.freightIn')}</th>
                                            <td>{t('money.sar', { amount: toNumber(detailData.freightIn).toLocaleString() })}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('d.vat')}</th>
                                            <td>{t('money.sar', { amount: toNumber(detailData.vatAmount).toLocaleString() })}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('d.grandTotal')}</th>
                                            <td className="ws-font-bold">
                                                {t('money.sar', { amount: toNumber(detailData.grandTotal).toLocaleString() })}
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>{t('d.paid')}</th>
                                            <td>{t('money.sar', { amount: toNumber(detailData.paidAmount).toLocaleString() })}</td>
                                        </tr>
                                        <tr>
                                            <th>{t('d.balance')}</th>
                                            <td className="ws-font-bold">
                                                {t('money.sar', { amount: toNumber(detailData.balance).toLocaleString() })}
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>{t('d.payment')}</th>
                                            <td>{formatSwsStatusLabel(detailData.paymentStatus, t)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {Array.isArray(detailData.items) && detailData.items.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>
                                        {t('d.lineItems')}
                                    </p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
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
                                                {detailData.items.map((it) => (
                                                    <tr key={it.id}>
                                                        <td><strong>{it.itemName ?? '—'}</strong></td>
                                                        <td style={{ fontSize: '0.8125rem', color: '#6B7280' }}>
                                                            {it.lineDescription ?? '—'}
                                                        </td>
                                                        <td>{it.qty}</td>
                                                        <td>{toNumber(it.unitPrice).toLocaleString()}</td>
                                                        <td>{formatDiscountCell(it.lineDiscountMode, it.lineDiscountValue, t)}</td>
                                                        <td>{toNumber(it.vatRate)}%</td>
                                                        <td className="ws-font-bold">
                                                            {toNumber(it.lineTotal).toLocaleString()}
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
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>
                                        {t('d.payments')}
                                    </p>
                                    <table className="ws-table">
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
                                            {detailData.payments.map((p) => (
                                                <tr key={p.id}>
                                                    <td>{p.method ?? '—'}</td>
                                                    <td className="ws-font-bold">
                                                        {toNumber(p.amount).toLocaleString()}
                                                    </td>
                                                    <td>{formatDateOnly(p.paidAt)}</td>
                                                    <td>{p.reference ?? '—'}</td>
                                                    <td>{p.recordedBy?.name ?? p.recordedBy?.email ?? '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}

                            {Array.isArray(detailData.returns) && detailData.returns.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>
                                        {t('d.returns')}
                                    </p>
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>{t('d.th.returnNo')}</th>
                                                <th>{t('d.th.date')}</th>
                                                <th>{t('d.th.status')}</th>
                                                <th>{t('d.th.total')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailData.returns.map((r) => (
                                                <tr key={r.id}>
                                                    <td>{r.returnNo ?? '—'}</td>
                                                    <td>{formatDateOnly(r.returnDate)}</td>
                                                    <td>{formatSwsStatusLabel(r.status, t)}</td>
                                                    <td className="ws-font-bold">
                                                        {toNumber(r.grandTotal).toLocaleString()}
                                                    </td>
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
                        <Truck size={20} color="#F59E0B" /> {t('page.title')}
                    </h2>
                    <p className="so-sub">{t('page.sub')}</p>
                </div>
                <div style={{ display: 'inline-flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExportMenu
                        onPdf={() => runExport('pdf')}
                        onExcel={() => runExport('excel')}
                        busy={exporting}
                        disabled={loading}
                        locale={locale}
                        t={t}
                    />
                    <div className="so-order-count-badge">
                        {t('page.count', { n: total.toLocaleString() })}
                    </div>
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
                        placeholder={t('search.placeholder')}
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
                    <option value="">
                        {workshopOptionsLoading ? t('opt.loadingWorkshops') : t('opt.allWorkshops')}
                    </option>
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
                        {selectedWorkshopId ? t('opt.allBranches') : t('opt.selectWorkshopFirst')}
                    </option>
                    {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    disabled={supplierOptionsLoading}
                    aria-label={t('filter.supplier')}
                >
                    <option value="">
                        {supplierOptionsLoading ? t('opt.loadingSuppliers') : t('opt.allSuppliers')}
                    </option>
                    {supplierOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label={t('filter.status')}
                >
                    {SWS_STATUS_FILTER_VALUES.map((value) => (
                        <option key={value || 'all'} value={value}>
                            {t(SWS_STATUS_FILTER_KEYS[value] || 'status.all')}
                        </option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={reviewStatusFilter}
                    onChange={(e) => setReviewStatusFilter(e.target.value)}
                    aria-label={t('filter.review')}
                >
                    {SWS_REVIEW_FILTER_VALUES.map((value) => (
                        <option key={value || 'all'} value={value}>
                            {t(SWS_REVIEW_FILTER_KEYS[value] || 'review.all')}
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
                            <tr>
                                <td colSpan={13} style={{ textAlign: 'center', padding: 24 }}>
                                    <Loader size={18} className="spin" /> {t('loading')}
                                </td>
                            </tr>
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={13} style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>
                                    {t('empty')}
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr
                                    key={inv.id}
                                    onClick={() => openDetails(inv.id, inv.source)}
                                    style={{ cursor: 'pointer', opacity: loading ? 0.55 : undefined }}
                                >
                                    <td>
                                        <div className="so-customer-info">
                                            <strong className="so-inv-link">{inv.invoiceNo ?? '—'}</strong>
                                            <span className="so-customer-mobile">
                                                {t('row.status', {
                                                    status: formatSwsStatusLabel(inv.status, t),
                                                })}
                                            </span>
                                        </div>
                                    </td>
                                    <td>{formatDateOnly(inv.invoiceDate)}</td>
                                    <td>{formatDateOnly(inv.dueDate)}</td>
                                    <td>
                                        <div className="so-customer-info">
                                            <strong>{inv.supplierName ?? '—'}</strong>
                                            <span className="so-customer-mobile">{inv.supplierMobile ?? '—'}</span>
                                        </div>
                                    </td>
                                    <td><AffiliationBadge isAffiliated={!!inv.isAffiliated} t={t} /></td>
                                    <td className="so-text-dim">{inv.workshopName ?? '—'}</td>
                                    <td className="so-text-dim">{inv.branchName ?? '—'}</td>
                                    <td>{toNumber(inv.itemsCount)}</td>
                                    <td style={{ fontWeight: 600 }}>
                                        {toNumber(inv.grandTotal).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>
                                    <td>
                                        {toNumber(inv.paidAmount).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>
                                    <td>
                                        {toNumber(inv.balance).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>
                                    <td><PaymentBadge status={inv.paymentStatus} t={t} /></td>
                                    <td><ReviewBadge status={inv.workshopReviewStatus} t={t} /></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {total > 0 && (
                <div className="ws-report-pagination" style={{ marginTop: 12 }}>
                    <p className="ws-report-pagination__info">
                        {t('page.showing', {
                            from: rangeFrom,
                            to: rangeTo,
                            total: total.toLocaleString(),
                        })}
                        {loading ? <span> · {t('loading')}</span> : null}
                    </p>
                    <nav className="ws-report-pagination__nav" aria-label={t('page.aria')}>
                        <button
                            type="button"
                            className="ws-report-pagination__edge"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            {t('page.prev')}
                        </button>
                        <div className="ws-report-pagination__pages" role="group" aria-label={t('page.nums')}>
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
                            {t('page.next')}
                        </button>
                    </nav>
                </div>
            )}
        </div>
    );
}
