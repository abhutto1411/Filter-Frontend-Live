import { useCallback, useEffect, useMemo, useState } from 'react';
import { Truck, Search, Loader } from 'lucide-react';
import '../../styles/admin/SalesOrders.css';
import '../workshop/Workshop.css';
import Modal from '../../components/Modal';
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

const PAGE_SIZE = 25;
const EXPORT_LIMIT = 5000;

const PAYMENT_STATUS_CLASS = {
    paid: 'so-status-completed',
    unpaid: 'so-status-cancelled',
    partial: 'so-status-pending',
};

const REVIEW_STATUS_OPTIONS = [
    { value: '', label: 'All Review Status' },
    { value: 'pending', label: 'Pending review' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
];

const STATUS_OPTIONS = [
    { value: '', label: 'All Status' },
    { value: 'pending_payment', label: 'Pending payment' },
    { value: 'partially_paid', label: 'Partially paid' },
    { value: 'paid', label: 'Paid' },
    { value: 'cancelled', label: 'Cancelled' },
];

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

function PaymentBadge({ status }) {
    const key = String(status ?? '').trim().toLowerCase();
    return (
        <span className={`so-status-badge ${PAYMENT_STATUS_CLASS[key] ?? 'so-status-pending'}`}>
            {formatStatusLabel(status)}
        </span>
    );
}

function ReviewBadge({ status }) {
    const key = String(status ?? '').trim().toLowerCase();
    const cls =
        key === 'accepted'
            ? 'so-status-completed'
            : key === 'rejected'
              ? 'so-status-cancelled'
              : 'so-status-pending';
    return (
        <span className={`so-status-badge ${cls}`}>
            {status ? formatStatusLabel(status) : 'Pending'}
        </span>
    );
}

function AffiliationBadge({ isAffiliated }) {
    return (
        <span
            className={`so-status-badge ${isAffiliated ? 'so-status-completed' : 'so-status-pending'}`}
            title={
                isAffiliated
                    ? 'Supplier is linked to this workshop via WorkshopSupplier.'
                    : 'No active WorkshopSupplier link between this supplier and workshop.'
            }
        >
            {isAffiliated ? 'Affiliated' : 'Non-affiliated'}
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

function formatDiscountCell(mode, value) {
    const t = String(mode ?? '').toLowerCase();
    const v = toNumber(value);
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

/** Build {headers, rows} mirroring the on-screen table — used for PDF/Excel export. */
function buildSupplierSalesExportRows(invoices) {
    const headers = [
        'Invoice No', 'Status', 'Invoice Date', 'Due Date', 'Supplier', 'Supplier Mobile',
        'Affiliation', 'Workshop', 'Branch', 'Items', 'Total (SAR)', 'Paid (SAR)', 'Balance (SAR)',
        'Payment', 'Review',
    ];
    const n2 = (v) => Number(toNumber(v).toFixed(2));
    const rows = (invoices || []).map((inv) => [
        inv.invoiceNo ?? '—',
        formatStatusLabel(inv.status),
        formatDateOnly(inv.invoiceDate),
        formatDateOnly(inv.dueDate),
        inv.supplierName ?? '—',
        inv.supplierMobile ?? '—',
        inv.isAffiliated ? 'Affiliated' : 'Non-affiliated',
        inv.workshopName ?? '—',
        inv.branchName ?? '—',
        n2(inv.itemsCount),
        n2(inv.grandTotal),
        n2(inv.paidAmount),
        n2(inv.balance),
        formatStatusLabel(inv.paymentStatus),
        formatStatusLabel(inv.workshopReviewStatus),
    ]);
    return { headers, rows };
}

export default function SuppliersWarehouseSales() {
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
                        list.map((s) => ({ id: String(s.id), name: String(s.name || '').trim() || 'Supplier' })),
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
            setLoadError(e?.message || 'Failed to load supplier sales invoices.');
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
            const { headers, rows } = buildSupplierSalesExportRows(list);
            const subtitle = `${rows.length} invoice(s)`
                + (dateFrom || dateTo ? ` · ${dateFrom || '…'} → ${dateTo || '…'}` : '')
                + (statusFilter ? ` · status: ${statusFilter}` : '');
            if (kind === 'pdf') {
                exportRowsToPdf({ title: 'Suppliers & Warehouse Sales', subtitle, headers, rows, filenameBase: 'suppliers-warehouse-sales' });
            } else {
                exportRowsToExcel({ sheetName: 'Supplier Sales', headers, rows, filenameBase: 'suppliers-warehouse-sales' });
            }
        } catch (e) {
            setLoadError(e?.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    }, [selectedWorkshopId, selectedBranchId, selectedSupplierId, statusFilter, reviewStatusFilter, searchDebounced, dateFrom, dateTo]);

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
        const totalIssued = invoices.reduce((acc, i) => acc + toNumber(i.grandTotal), 0);
        const totalPaid = invoices.reduce((acc, i) => acc + toNumber(i.paidAmount), 0);
        const totalBalance = invoices.reduce((acc, i) => acc + toNumber(i.balance), 0);
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
            {
                label: 'Outstanding (this page)',
                value: `SAR ${totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            },
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
                        <Truck size={20} color="#F59E0B" /> Suppliers &amp; Warehouse Sales
                    </h2>
                    <p className="so-sub">
                        Sales invoices issued by suppliers / warehouses to workshops
                    </p>
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
                        placeholder="Search invoice no, supplier, mobile, workshop, branch…"
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
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    disabled={supplierOptionsLoading}
                    aria-label="Supplier filter"
                >
                    <option value="">{supplierOptionsLoading ? 'Loading suppliers…' : 'All Suppliers'}</option>
                    {supplierOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Status filter"
                >
                    {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <select
                    className="so-select"
                    value={reviewStatusFilter}
                    onChange={(e) => setReviewStatusFilter(e.target.value)}
                    aria-label="Workshop review status filter"
                >
                    {REVIEW_STATUS_OPTIONS.map((opt) => (
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
                            <th>Invoice Date</th>
                            <th>Due Date</th>
                            <th>Supplier</th>
                            <th>Affiliation</th>
                            <th>Workshop</th>
                            <th>Branch</th>
                            <th>Items</th>
                            <th>Total (SAR)</th>
                            <th>Paid (SAR)</th>
                            <th>Balance (SAR)</th>
                            <th>Payment</th>
                            <th>Review</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && invoices.length === 0 ? (
                            <tr>
                                <td colSpan={13} style={{ textAlign: 'center', padding: 24 }}>
                                    <Loader size={18} className="spin" /> Loading…
                                </td>
                            </tr>
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={13} style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>
                                    No supplier sales invoices match these filters.
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
                                                Status: {formatStatusLabel(inv.status)}
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
                                    <td><AffiliationBadge isAffiliated={!!inv.isAffiliated} /></td>
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
                                    <td><PaymentBadge status={inv.paymentStatus} /></td>
                                    <td><ReviewBadge status={inv.workshopReviewStatus} /></td>
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
                    <nav className="ws-report-pagination__nav" aria-label="Supplier invoices pages">
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
                    title={`${detailData?.source === 'local' ? 'Local Supplier Purchase Invoice' : 'Supplier Invoice'} ${detailData?.invoiceNo ? `- ${detailData.invoiceNo}` : 'Details'}`}
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
                                        <tr><th>INVOICE DATE</th><td>{formatDateOnly(detailData.invoiceDate)}</td></tr>
                                        <tr><th>DUE DATE</th><td>{formatDateOnly(detailData.dueDate)}</td></tr>
                                        {detailData.paymentTerms ? (
                                            <tr><th>PAYMENT TERMS</th><td>{detailData.paymentTerms}</td></tr>
                                        ) : null}
                                        <tr><th>STATUS</th><td>{formatStatusLabel(detailData.status)}</td></tr>
                                        <tr>
                                            <th>WORKSHOP REVIEW</th>
                                            <td>
                                                {formatStatusLabel(detailData.workshopReviewStatus) || 'Pending'}
                                                {detailData.workshopReviewedAt
                                                    ? ` · ${formatDateTime(detailData.workshopReviewedAt)}`
                                                    : ''}
                                            </td>
                                        </tr>
                                        {detailData.workshopRejectionReason ? (
                                            <tr>
                                                <th>REJECTION REASON</th>
                                                <td>{detailData.workshopRejectionReason}</td>
                                            </tr>
                                        ) : null}
                                        <tr>
                                            <th>SUPPLIER</th>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{detailData.supplier?.name ?? '—'}</div>
                                                <div style={{ fontSize: 12, color: '#6B7280' }}>
                                                    {[detailData.supplier?.mobile, detailData.supplier?.email]
                                                        .filter(Boolean)
                                                        .join(' · ') || '—'}
                                                </div>
                                                {detailData.supplier?.vatId ? (
                                                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                                                        VAT: {detailData.supplier.vatId}
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                        <tr><th>WORKSHOP</th><td>{detailData.workshop?.name ?? '—'}</td></tr>
                                        <tr><th>BRANCH</th><td>{detailData.branch?.name ?? '—'}</td></tr>
                                        {detailData.po ? (
                                            <tr>
                                                <th>PURCHASE ORDER</th>
                                                <td>#{detailData.po.id} · {formatStatusLabel(detailData.po.status)}</td>
                                            </tr>
                                        ) : null}
                                        <tr><th>SUBTOTAL</th><td>SAR {toNumber(detailData.subtotal).toLocaleString()}</td></tr>
                                        <tr><th>INVOICE DISCOUNT</th><td>SAR {toNumber(detailData.invoiceDiscount).toLocaleString()}</td></tr>
                                        <tr><th>FREIGHT IN</th><td>SAR {toNumber(detailData.freightIn).toLocaleString()}</td></tr>
                                        <tr><th>VAT</th><td>SAR {toNumber(detailData.vatAmount).toLocaleString()}</td></tr>
                                        <tr>
                                            <th>GRAND TOTAL</th>
                                            <td className="ws-font-bold">
                                                SAR {toNumber(detailData.grandTotal).toLocaleString()}
                                            </td>
                                        </tr>
                                        <tr><th>PAID</th><td>SAR {toNumber(detailData.paidAmount).toLocaleString()}</td></tr>
                                        <tr><th>BALANCE</th><td className="ws-font-bold">SAR {toNumber(detailData.balance).toLocaleString()}</td></tr>
                                        <tr><th>PAYMENT</th><td>{formatStatusLabel(detailData.paymentStatus)}</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            {Array.isArray(detailData.items) && detailData.items.length > 0 ? (
                                <div className="ws-report-table-wrapper">
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Line items</p>
                                    <div className="ws-order-details-table-scroll">
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>Item</th>
                                                    <th>Description</th>
                                                    <th>Qty</th>
                                                    <th>Unit (SAR)</th>
                                                    <th>Discount</th>
                                                    <th>VAT</th>
                                                    <th>Line (SAR)</th>
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
                                                        <td>{formatDiscountCell(it.lineDiscountMode, it.lineDiscountValue)}</td>
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
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Payments</p>
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>Method</th>
                                                <th>Amount (SAR)</th>
                                                <th>Paid on</th>
                                                <th>Reference</th>
                                                <th>Recorded by</th>
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
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Returns</p>
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>Return #</th>
                                                <th>Date</th>
                                                <th>Status</th>
                                                <th>Total (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailData.returns.map((r) => (
                                                <tr key={r.id}>
                                                    <td>{r.returnNo ?? '—'}</td>
                                                    <td>{formatDateOnly(r.returnDate)}</td>
                                                    <td>{formatStatusLabel(r.status)}</td>
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
                </Modal>
            )}
        </div>
    );
}
