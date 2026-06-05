import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Loader2,
    RefreshCw,
    FileText,
    RotateCcw,
    Eye,
    Printer,
    Search,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import CreditNotePrintView from '../../components/workshop/CreditNotePrintView';
import {
    getSuperAdminSalesReturns,
    getSuperAdminSalesReturn,
    getSuperAdminInvoiceView,
    getWorkshopOptions,
    getBranches,
    approveSuperAdminSalesReturn,
    rejectSuperAdminSalesReturn,
} from '../../services/superAdminApi';
import { useAuth } from '../../context/AuthContext';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';

const num = (v) =>
    `SAR ${Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function formatDateTime(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString();
}

function statusTone(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'completed') return { label: 'Approved', bg: '#ECFDF5', fg: '#047857' };
    if (s === 'pending') return { label: 'Pending', bg: '#FEF3C7', fg: '#92400E' };
    if (s === 'rejected') return { label: 'Rejected', bg: '#FEE2E2', fg: '#B91C1C' };
    return { label: s || '—', bg: '#F3F4F6', fg: '#374151' };
}

/** Normalize backend invoice payload into the shape InvoiceDetailsModal expects. */
function normalizeInvoiceForModal(invoice) {
    if (!invoice || typeof invoice !== 'object') return invoice;
    const srcOrder = invoice.salesOrder || invoice.sales_order || {};
    const srcCustomer = srcOrder.customer || invoice.customer || {};
    const srcVehicle = srcOrder.vehicle || invoice.vehicle || {};
    const srcJobs = Array.isArray(srcOrder.jobs)
        ? srcOrder.jobs
        : Array.isArray(invoice.jobs) ? invoice.jobs : [];
    return {
        ...invoice,
        order: { ...srcOrder, jobs: srcJobs },
        jobs: srcJobs,
        customer: srcCustomer,
        vehicle: srcVehicle,
        branch: invoice.branch || srcOrder.branch,
        workshop: invoice.workshop || srcOrder.workshop,
        paymentMethod: invoice.paymentMethod || invoice.payments?.[0]?.method,
    };
}

/**
 * Super-admin overview of sales returns originated from the cashier portal.
 * Workshop + Branch filters cascade. Rich columns (customer, vehicle, cashier,
 * credit note, return type); each row opens a detail modal with line items +
 * printable credit note, and can drill into the underlying invoice.
 */
export default function SalesReturnsPage() {
    const { hasPermission } = useAuth();
    const canApprove = hasPermission('sales.sales-returns.approve') || hasPermission('approvals.sales-return.approve');
    const canReject = hasPermission('sales.sales-returns.reject') || hasPermission('approvals.sales-return.reject');

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('completed');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');

    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const printRef = useRef(null);

    const [invoice, setInvoice] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [rejectRow, setRejectRow] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getSuperAdminSalesReturns({
                workshopId: selectedWorkshopId || undefined,
                branchId: selectedBranchId || undefined,
                status: statusFilter || undefined,
                search: search.trim() || undefined,
                startDate: dateFrom || undefined,
                endDate: dateTo || undefined,
                limit: 200,
                offset: 0,
            });
            setRows(Array.isArray(res?.items) ? res.items : []);
            setTotal(Number(res?.total) || 0);
        } catch (e) {
            setError(e?.message || 'Could not load sales returns');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
        // `search` is applied on Apply / Refresh / Enter (not as a live dependency).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWorkshopId, selectedBranchId, statusFilter, dateFrom, dateTo]);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getWorkshopOptions();
                const list = Array.isArray(res?.workshops)
                    ? res.workshops
                    : Array.isArray(res?.data?.workshops) ? res.data.workshops
                    : Array.isArray(res) ? res : [];
                if (!cancelled) {
                    setWorkshopOptions(list.map((w) => ({
                        id: String(w.id),
                        name: String(w.name || '').trim() || 'Workshop',
                    })));
                }
            } catch {
                if (!cancelled) setWorkshopOptions([]);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!selectedWorkshopId) {
            setBranchOptions([]);
            setSelectedBranchId('');
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await getBranches({ workshopId: selectedWorkshopId });
                const list = Array.isArray(res?.branches)
                    ? res.branches
                    : Array.isArray(res?.data?.branches) ? res.data.branches : [];
                if (!cancelled) {
                    setBranchOptions(list.map((b) => ({
                        id: String(b.id),
                        name: String(b.name || '').trim() || 'Branch',
                    })));
                    setSelectedBranchId('');
                }
            } catch {
                if (!cancelled) {
                    setBranchOptions([]);
                    setSelectedBranchId('');
                }
            }
        })();
        return () => { cancelled = true; };
    }, [selectedWorkshopId]);

    const totalAmount = useMemo(
        () => rows.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0),
        [rows],
    );

    const openDetail = async (row) => {
        setDetail(row);
        setDetailLoading(true);
        try {
            const res = await getSuperAdminSalesReturn(row.id);
            if (res?.salesReturn) setDetail(res.salesReturn);
        } catch {
            /* keep the list row as a fallback */
        } finally {
            setDetailLoading(false);
        }
    };

    const handleApprove = async (row) => {
        if (row.status !== 'pending' || !canApprove) return;
        setActionLoadingId(`approve-${row.id}`);
        try {
            await approveSuperAdminSalesReturn(row.id);
            await load();
        } catch (e) {
            alert(e?.message || 'Could not approve sales return');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRejectSubmit = async () => {
        if (!rejectRow || !rejectReason.trim() || !canReject) return;
        setActionLoadingId(`reject-${rejectRow.id}`);
        try {
            await rejectSuperAdminSalesReturn(rejectRow.id, rejectReason.trim());
            setRejectRow(null);
            setRejectReason('');
            await load();
        } catch (e) {
            alert(e?.message || 'Could not reject sales return');
        } finally {
            setActionLoadingId(null);
        }
    };

    const openInvoice = async (invoiceId) => {
        if (!invoiceId) return;
        setInvoiceLoadingId(String(invoiceId));
        try {
            const raw = await getSuperAdminInvoiceView(invoiceId);
            const inv = raw?.invoice ?? raw?.data?.invoice ?? raw?.data ?? raw;
            setInvoice(normalizeInvoiceForModal(inv));
        } catch (e) {
            alert(e?.message || 'Could not load invoice');
        } finally {
            setInvoiceLoadingId(null);
        }
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<!DOCTYPE html><html><head><title>Credit Note</title></head><body>${printRef.current.innerHTML}</body></html>`);
        w.document.close();
        w.focus();
        w.print();
    };

    const cellTh = {
        padding: '10px 12px',
        textAlign: 'left',
        fontSize: '0.7rem',
        fontWeight: 700,
        color: '#475569',
        textTransform: 'uppercase',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        whiteSpace: 'nowrap',
    };
    const cellTd = { padding: '12px', verticalAlign: 'middle', fontSize: '0.8125rem' };
    const labelStyle = { fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 };
    const inputStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.875rem', background: '#fff' };

    return (
        <div style={{ padding: 20 }}>
            <header style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RotateCcw size={19} color="#9A3412" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                            Sales Returns
                        </h1>
                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                            Returns recorded against invoices from the cashier portal — filter by workshop, branch, date &amp; status.
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
                    <div style={{ padding: '8px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase' }}>Returns</div>
                            <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#7f1d1d' }}>{loading ? '—' : rows.length.toLocaleString()}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase' }}>Total Returned</div>
                            <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#7f1d1d' }}>{loading ? '—' : num(totalAmount)}</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => load()}
                        disabled={loading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </header>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
                    <label style={labelStyle}>Workshop</label>
                    <select value={selectedWorkshopId} onChange={(e) => setSelectedWorkshopId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                        <option value="">All workshops</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
                    <label style={labelStyle}>Branch</label>
                    <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId}
                        style={{ ...inputStyle, minWidth: 180, opacity: selectedWorkshopId ? 1 : 0.6 }}
                        title={selectedWorkshopId ? '' : 'Select a workshop first'}
                    >
                        <option value="">All branches</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 150 }}>
                    <label style={labelStyle}>Status</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, minWidth: 150 }}>
                        <option value="completed">Approved</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                        <option value="">All</option>
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
                    <label style={labelStyle}>From</label>
                    <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputStyle, minWidth: 180 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
                    <label style={labelStyle}>To</label>
                    <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputStyle, minWidth: 180 }} />
                </div>
                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
                        placeholder="Search credit note, invoice, customer, reason…"
                        style={{ ...inputStyle, width: '100%', paddingLeft: 36 }}
                    />
                </div>
                <button type="button" onClick={() => load()} disabled={loading} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: '0.8125rem', fontWeight: 700, height: 40 }}>
                    {loading ? 'Loading…' : 'Apply'}
                </button>
            </div>

            {error ? (
                <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, marginBottom: 12 }}>
                    {error}
                </div>
            ) : null}

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                        <tr>
                            <th style={cellTh}>Date / time</th>
                            <th style={cellTh}>Credit note #</th>
                            <th style={cellTh}>Invoice #</th>
                            <th style={cellTh}>Customer</th>
                            <th style={cellTh}>Vehicle</th>
                            <th style={cellTh}>Cashier</th>
                            <th style={cellTh}>Workshop / Branch</th>
                            <th style={cellTh}>Type</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Amount</th>
                            <th style={cellTh}>Status</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={11} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                <Loader2 size={18} className="spin" /> Loading…
                            </td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={11} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                No sales returns for the selected filters.
                            </td></tr>
                        ) : rows.map((r) => {
                            const st = statusTone(r.status);
                            return (
                                <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                    <td style={{ ...cellTd, whiteSpace: 'nowrap' }}>{formatDateTime(r.returnDate ?? r.createdAt)}</td>
                                    <td style={cellTd}><span style={{ fontWeight: 700, color: '#0f172a' }}>{r.creditNoteNo ?? r.returnNo ?? '—'}</span></td>
                                    <td style={cellTd}><span style={{ fontWeight: 700, color: '#2563eb' }}>{r.invoice?.invoiceNo ?? '—'}</span></td>
                                    <td style={cellTd}>
                                        <div>{r.customerName || '—'}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{r.customerPhone || ''}</div>
                                    </td>
                                    <td style={cellTd}>{r.vehicleNumber || '—'}</td>
                                    <td style={cellTd}>{r.cashier?.name || r.createdBy?.name || '—'}</td>
                                    <td style={cellTd}>
                                        <div>{r.workshop?.name ?? '—'}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.branch?.name ?? '—'}</div>
                                    </td>
                                    <td style={cellTd}>
                                        <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: '#EEF2FF', color: '#3730A3', display: 'inline-block' }}>
                                            {(r.returnScope || '—').toString().toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ ...cellTd, textAlign: 'right', fontWeight: 700, color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>{num(r.totalAmount)}</td>
                                    <td style={cellTd}>
                                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: st.bg, color: st.fg, display: 'inline-block' }}>
                                            {st.label}
                                        </span>
                                    </td>
                                    <td style={{ ...cellTd, textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => openDetail(r)}
                                                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                            >
                                                <Eye size={14} /> View
                                            </button>
                                            {r.status === 'pending' && canApprove ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleApprove(r)}
                                                    disabled={actionLoadingId === `approve-${r.id}`}
                                                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                                >
                                                    {actionLoadingId === `approve-${r.id}` ? '…' : 'Approve'}
                                                </button>
                                            ) : null}
                                            {r.status === 'pending' && canReject ? (
                                                <button
                                                    type="button"
                                                    onClick={() => { setRejectRow(r); setRejectReason(''); }}
                                                    disabled={actionLoadingId === `reject-${r.id}`}
                                                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                                >
                                                    Reject
                                                </button>
                                            ) : null}
                                            {r.invoice?.id ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openInvoice(r.invoice.id)}
                                                    disabled={invoiceLoadingId === String(r.invoice.id)}
                                                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: invoiceLoadingId === String(r.invoice.id) ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                                >
                                                    {invoiceLoadingId === String(r.invoice.id) ? <Loader2 size={12} className="spin" /> : <FileText size={12} />} Invoice
                                                </button>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {total > rows.length ? (
                    <div style={{ padding: 10, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                        Showing first {rows.length} of {total}.
                    </div>
                ) : null}
            </div>

            <AnimatePresence>
                {detail ? (
                    <Modal onClose={() => { setDetail(null); setPrintOpen(false); }} title="Sales return detail" width="860px">
                        {detailLoading ? (
                            <p style={{ padding: 24, textAlign: 'center' }}><Loader2 size={18} className="spin" /> Loading…</p>
                        ) : (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: '0.875rem' }}>
                                    <div><strong>Credit note:</strong> {detail.creditNoteNo || detail.returnNo || '—'}</div>
                                    <div><strong>Invoice:</strong> {detail.invoiceNo || detail.invoice?.invoiceNo || '—'}</div>
                                    <div><strong>Customer:</strong> {detail.customerName || '—'} · {detail.customerPhone || '—'}</div>
                                    <div><strong>Vehicle:</strong> {detail.vehicleNumber || '—'}</div>
                                    <div><strong>Cashier:</strong> {detail.cashier?.name || detail.createdBy?.name || '—'}</div>
                                    <div><strong>Workshop / Branch:</strong> {(detail.workshopName || detail.workshop?.name || '—')} · {(detail.branchName || detail.branch?.name || '—')}</div>
                                    <div><strong>Return type:</strong> {detail.returnScope === 'full' ? 'Full return' : detail.returnScope === 'partial' ? 'Partial return' : '—'}</div>
                                    <div><strong>Date:</strong> {formatDateTime(detail.returnDate || detail.createdAt)}</div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', marginBottom: 16 }}>
                                    <thead>
                                        <tr style={{ background: '#F9FAFB' }}>
                                            <th style={{ padding: 10, textAlign: 'left' }}>Product / service</th>
                                            <th style={{ padding: 10, textAlign: 'right' }}>Return qty</th>
                                            <th style={{ padding: 10, textAlign: 'right' }}>Unit price</th>
                                            <th style={{ padding: 10, textAlign: 'right' }}>Line total</th>
                                            <th style={{ padding: 10, textAlign: 'left' }}>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(detail.items || []).length === 0 ? (
                                            <tr><td colSpan={5} style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>No line items.</td></tr>
                                        ) : (detail.items || []).map((it) => (
                                            <tr key={it.id} style={{ borderTop: '1px solid #eee' }}>
                                                <td style={{ padding: 10 }}>{it.name || '—'}</td>
                                                <td style={{ padding: 10, textAlign: 'right' }}>{it.qty}{it.originalQty != null ? ` / ${it.originalQty}` : ''}</td>
                                                <td style={{ padding: 10, textAlign: 'right' }}>{num(it.unitPrice || 0)}</td>
                                                <td style={{ padding: 10, textAlign: 'right' }}>{num(it.lineTotal || 0)}</td>
                                                <td style={{ padding: 10 }}>{it.reason || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
                                    {(detail.invoice?.id || detail.invoiceId) ? (
                                        <button
                                            type="button"
                                            onClick={() => openInvoice(detail.invoice?.id || detail.invoiceId)}
                                            disabled={invoiceLoadingId != null}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: invoiceLoadingId != null ? 'wait' : 'pointer', fontSize: '0.8125rem', fontWeight: 700 }}
                                        >
                                            {invoiceLoadingId != null ? <Loader2 size={14} className="spin" /> : <FileText size={14} />} View invoice
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => setPrintOpen(true)}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700 }}
                                    >
                                        <Printer size={16} /> View credit note / Print
                                    </button>
                                </div>
                            </div>
                        )}
                    </Modal>
                ) : null}
            </AnimatePresence>

            <AnimatePresence>
                {printOpen && detail ? (
                    <Modal onClose={() => setPrintOpen(false)} title="Credit note" width="900px">
                        <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                            <CreditNotePrintView ref={printRef} data={detail} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                            <button type="button" onClick={() => setPrintOpen(false)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8125rem' }}>Close</button>
                            <button type="button" onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8125rem' }}>
                                <Printer size={16} /> Print
                            </button>
                        </div>
                    </Modal>
                ) : null}
            </AnimatePresence>

            <InvoiceDetailsModal
                invoice={invoice}
                isOpen={!!invoice}
                footerVariant="corporate"
                onClose={() => setInvoice(null)}
            />

            {rejectRow ? (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: 'min(420px, 92vw)', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Reject sales return</h3>
                        <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.8125rem' }}>
                            {rejectRow.returnNo} · {rejectRow.invoice?.invoiceNo ?? 'Invoice'}
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Rejection reason (required)"
                            rows={4}
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.875rem', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                            <button type="button" onClick={() => { setRejectRow(null); setRejectReason(''); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}>Cancel</button>
                            <button type="button" onClick={handleRejectSubmit} disabled={!rejectReason.trim() || actionLoadingId === `reject-${rejectRow.id}`} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#b91c1c', color: '#fff', fontWeight: 700 }}>Reject</button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
