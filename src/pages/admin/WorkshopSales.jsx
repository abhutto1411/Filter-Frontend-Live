import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Search, Loader } from 'lucide-react';
import '../../styles/admin/SalesOrders.css';
import '../workshop/Workshop.css';
import Modal from '../../components/Modal';
import { ShimmerTextBlock } from '../../components/supplier/Shimmer';
import {
    getBranches,
    getInvoice,
    getInvoices,
    getWorkshopOptions,
} from '../../services/superAdminApi';
import { ExportMenu } from '../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../utils/tableExport';

const PAGE_SIZE = 25;
const EXPORT_LIMIT = 5000;

/** Build {headers, rows} mirroring the on-screen table — used for PDF/Excel export. */
function buildWorkshopSalesExportRows(invoices, fmtDateTime) {
    const headers = [
        'Invoice No', 'Order #', 'Date / Time', 'Workshop', 'Branch',
        'Customer', 'Mobile', 'Vehicle', 'Items', 'Total (SAR)', 'Payment',
    ];
    const n2 = (v) => { const x = Number(v); return Number.isFinite(x) ? Number(x.toFixed(2)) : 0; };
    const rows = (invoices || []).map((inv) => [
        inv.invoiceNo ?? '—',
        inv.salesOrderId ?? '—',
        fmtDateTime(inv?.issuedAt ?? inv?.invoiceDate),
        inv.workshopName ?? '—',
        inv.branchName ?? '—',
        inv.customerName ?? 'Walk-in',
        inv.customerMobile ?? '—',
        inv.plateNo ?? '—',
        n2(inv.itemsCount),
        n2(inv.totalAmount),
        String(inv.paymentStatus ?? '—'),
    ]);
    return { headers, rows };
}

const PAYMENT_STATUS_OPTIONS = [
    { value: '', label: 'All Payment Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'partial', label: 'Partial' },
];

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

function PaymentStatusBadge({ status }) {
    const key = String(status ?? '').trim().toLowerCase();
    return (
        <span className={`so-status-badge ${PAYMENT_STATUS_CLASS[key] ?? 'so-status-pending'}`}>
            {formatStatusLabel(status)}
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

function formatDiscountCell(discountType, discountValue) {
    const t = String(discountType ?? '').toLowerCase();
    const v = toNumber(discountValue);
    if (!v) return '—';
    if (t === 'percent' || t === 'percentage') return `${v}%`;
    return `SAR ${v.toLocaleString()}`;
}

function localDateTimeToIso(localValue) {
    if (!localValue) return '';
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
}

export default function WorkshopSales() {
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
        const t = setTimeout(() => setSearchDebounced(searchInput.trim()), 380);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        setPage(1);
    }, [selectedWorkshopId, selectedBranchId, paymentStatusFilter, dateFrom, dateTo, searchDebounced]);

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await getInvoices({
                workshopId: selectedWorkshopId || undefined,
                branchId: selectedBranchId || undefined,
                paymentStatus: paymentStatusFilter || undefined,
                search: searchDebounced || undefined,
                startDate: localDateTimeToIso(dateFrom) || undefined,
                endDate: localDateTimeToIso(dateTo) || undefined,
                limit: String(PAGE_SIZE),
                offset: String((page - 1) * PAGE_SIZE),
            });
            const rows = Array.isArray(res?.invoices)
                ? res.invoices
                : Array.isArray(res?.data?.invoices)
                  ? res.data.invoices
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
            setLoadError(e?.message || 'Failed to load workshop sales.');
        } finally {
            setLoading(false);
        }
    }, [selectedWorkshopId, selectedBranchId, paymentStatusFilter, searchDebounced, dateFrom, dateTo, page]);

    useEffect(() => {
        void fetchInvoices();
    }, [fetchInvoices]);

    // Export the FULL filtered set (one bounded re-fetch with the active filters).
    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setLoadError('');
        try {
            const res = await getInvoices({
                workshopId: selectedWorkshopId || undefined,
                branchId: selectedBranchId || undefined,
                paymentStatus: paymentStatusFilter || undefined,
                search: searchDebounced || undefined,
                startDate: localDateTimeToIso(dateFrom) || undefined,
                endDate: localDateTimeToIso(dateTo) || undefined,
                limit: String(EXPORT_LIMIT),
                offset: '0',
            });
            const list = Array.isArray(res?.invoices) ? res.invoices
                : Array.isArray(res?.data?.invoices) ? res.data.invoices : [];
            const { headers, rows } = buildWorkshopSalesExportRows(list, formatDateTime);
            const subtitle = `${rows.length} invoice(s)`
                + (dateFrom || dateTo ? ` · ${dateFrom || '…'} → ${dateTo || '…'}` : '')
                + (paymentStatusFilter ? ` · payment: ${paymentStatusFilter}` : '');
            if (kind === 'pdf') {
                exportRowsToPdf({ title: 'Workshop Sales', subtitle, headers, rows, filenameBase: 'workshop-sales' });
            } else {
                exportRowsToExcel({ sheetName: 'Workshop Sales', headers, rows, filenameBase: 'workshop-sales' });
            }
        } catch (e) {
            setLoadError(e?.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    }, [selectedWorkshopId, selectedBranchId, paymentStatusFilter, searchDebounced, dateFrom, dateTo]);

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
            setDetailError(e?.message || 'Failed to load invoice details.');
        } finally {
            setDetailLoading(false);
        }
    }, []);

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
        return [
            { label: 'Total Invoices (matching)', value: total.toLocaleString() },
            {
                label: 'Issued (this page)',
                value: `SAR ${totalIssued.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            },
            {
                label: 'Collected (this page)',
                value: `SAR ${totalPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                className: 'revenue',
            },
            { label: 'Unpaid / Partial (this page)', value: unpaidCount.toLocaleString() },
        ];
    }, [invoices, total]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const rangeTo = Math.min(page * PAGE_SIZE, total);

    return (
        <div className="so-container">
            <header className="so-header">
                <div>
                    <h2 className="so-title">
                        <FileText size={20} color="#F59E0B" /> Workshop Sales
                    </h2>
                    <p className="so-sub">POS invoices across all workshops &amp; branches</p>
                </div>
                <div style={{ display: 'inline-flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExportMenu
                        onPdf={() => runExport('pdf')}
                        onExcel={() => runExport('excel')}
                        busy={exporting}
                        disabled={loading}
                    />
                    <div className="so-order-count-badge">{total.toLocaleString()} invoices</div>
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
                        placeholder="Search invoice no, customer, mobile, plate, order id…"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                <select
                    className="so-select"
                    value={selectedWorkshopId}
                    onChange={(e) => setSelectedWorkshopId(e.target.value)}
                    disabled={workshopOptionsLoading}
                    aria-label="Workshop filter"
                >
                    <option value="">{workshopOptionsLoading ? 'Loading workshops…' : 'All Workshops'}</option>
                    {workshopOptions.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={!selectedWorkshopId || branchOptionsLoading}
                    aria-label="Branch filter"
                >
                    <option value="">
                        {selectedWorkshopId ? 'All Branches' : 'Select workshop first'}
                    </option>
                    {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    aria-label="Payment status filter"
                >
                    {PAYMENT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <div className="so-date-group">
                    <input
                        type="datetime-local"
                        className="so-date-input"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        step={60}
                        aria-label="From date and time"
                    />
                    <input
                        type="datetime-local"
                        className="so-date-input"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        step={60}
                        aria-label="To date and time"
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
                            <th>Invoice #</th>
                            <th>Date / Time</th>
                            <th>Workshop</th>
                            <th>Branch</th>
                            <th>Customer</th>
                            <th>Vehicle</th>
                            <th>Items</th>
                            <th>Total (SAR)</th>
                            <th>Payment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && invoices.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: 24 }}>
                                    <Loader size={18} className="spin" /> Loading…
                                </td>
                            </tr>
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>
                                    No invoices match these filters.
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
                                            <span className="so-customer-mobile">Order #{inv.salesOrderId}</span>
                                        </div>
                                    </td>
                                    <td>{formatInvoiceDateTime(inv)}</td>
                                    <td className="so-text-dim">{inv.workshopName ?? '—'}</td>
                                    <td className="so-text-dim">{inv.branchName ?? '—'}</td>
                                    <td>
                                        <div className="so-customer-info">
                                            <strong>{inv.customerName ?? 'Walk-in'}</strong>
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
                                        <PaymentStatusBadge status={inv.paymentStatus} />
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
                        Showing <strong>{rangeFrom}</strong>–<strong>{rangeTo}</strong> of{' '}
                        <strong>{total.toLocaleString()}</strong>
                        {loading ? <span> · Loading…</span> : null}
                    </p>
                    <nav className="ws-report-pagination__nav" aria-label="Workshop sales pages">
                        <button
                            type="button"
                            className="ws-report-pagination__edge"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Previous
                        </button>
                        <div className="ws-report-pagination__pages" role="group" aria-label="Page numbers">
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
                            Next
                        </button>
                    </nav>
                </div>
            )}

            {detailId && (
                <Modal
                    title={`Invoice ${detailData?.invoiceNo ? `- ${detailData.invoiceNo}` : 'Details'}`}
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
                                        <tr><th>INVOICE NO</th><td>{detailData.invoiceNo ?? '—'}</td></tr>
                                        <tr>
                                            <th>INVOICE DATE &amp; TIME</th>
                                            <td>{formatDateTime(detailData.issuedAt ?? detailData.invoiceDate)}</td>
                                        </tr>
                                        <tr><th>WORKSHOP</th><td>{detailData.workshopName ?? '—'}</td></tr>
                                        <tr><th>BRANCH</th><td>{detailData.branchName ?? '—'}</td></tr>
                                        <tr><th>ORDER SOURCE</th><td>{formatStatusLabel(detailData.salesOrder?.source)}</td></tr>
                                        <tr><th>ORDER STATUS</th><td>{formatStatusLabel(detailData.salesOrder?.status)}</td></tr>
                                        <tr>
                                            <th>ORDER PLACED</th>
                                            <td>{formatDateTime(detailData.salesOrder?.createdAt)}</td>
                                        </tr>
                                        <tr><th>CUSTOMER NAME</th><td>{detailData.customer?.name ?? '—'}</td></tr>
                                        <tr><th>PHONE</th><td>{detailData.customer?.mobile ?? '—'}</td></tr>
                                        <tr>
                                            <th>VEHICLE</th>
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
                                        <tr><th>SUBTOTAL</th><td>SAR {toNumber(detailData.subtotal).toLocaleString()}</td></tr>
                                        <tr><th>VAT</th><td>SAR {toNumber(detailData.vatAmount).toLocaleString()}</td></tr>
                                        <tr><th>DISCOUNT</th><td>SAR {toNumber(detailData.discountAmount).toLocaleString()}</td></tr>
                                        <tr>
                                            <th>TOTAL AMOUNT</th>
                                            <td className="ws-font-bold">
                                                SAR {toNumber(detailData.totalAmount).toLocaleString()}
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>PAYMENT STATUS</th>
                                            <td>{formatStatusLabel(detailData.paymentStatus)}</td>
                                        </tr>
                                        {detailData.deferredPaymentMethod ? (
                                            <tr>
                                                <th>DEFERRED METHOD</th>
                                                <td>{detailData.deferredPaymentMethod}</td>
                                            </tr>
                                        ) : null}
                                        {detailData.createdBy ? (
                                            <tr>
                                                <th>CREATED BY</th>
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
                                        Order discount &amp; promo
                                    </p>
                                    <table className="ws-table">
                                        <tbody>
                                            <tr>
                                                <th>Order-level discount</th>
                                                <td>
                                                    {formatDiscountCell(
                                                        detailData.orderDiscount.totalDiscountType,
                                                        detailData.orderDiscount.totalDiscountValue,
                                                    )}
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>Promo discount (order)</th>
                                                <td>
                                                    SAR {toNumber(detailData.orderDiscount.promoDiscountAmount).toLocaleString()}
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>Promo code</th>
                                                <td>{detailData.orderDiscount.promoCode ?? '—'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}

                            {Array.isArray(detailData.jobs) && detailData.jobs.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Jobs</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>Job #</th>
                                                    <th>Department</th>
                                                    <th>Status</th>
                                                    <th>Opened</th>
                                                    <th>Completed</th>
                                                    <th>Before disc.</th>
                                                    <th>After disc.</th>
                                                    <th>VAT</th>
                                                    <th>Job total</th>
                                                    <th>Technicians</th>
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
                                                        <td>SAR {toNumber(job.amountBeforeDiscount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.amountAfterDiscount).toLocaleString()}</td>
                                                        <td>SAR {toNumber(job.vatAmount).toLocaleString()}</td>
                                                        <td className="ws-font-bold">
                                                            SAR {toNumber(job.totalAmount).toLocaleString()}
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
                                                {detailData.lineItems.map((row) => (
                                                    <tr key={row.id}>
                                                        <td>{row.jobId ?? '—'}</td>
                                                        <td>{row.departmentName ?? '—'}</td>
                                                        <td>{row.itemName ?? '—'}</td>
                                                        <td>{row.itemType ?? '—'}</td>
                                                        <td>{row.qty}</td>
                                                        <td>{toNumber(row.unitPrice).toLocaleString()}</td>
                                                        <td>{formatDiscountCell(row.discountType, row.discountValue)}</td>
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
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Payments</p>
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>Method</th>
                                                <th>Amount (SAR)</th>
                                                <th>Paid at</th>
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
                </Modal>
            )}
        </div>
    );
}
