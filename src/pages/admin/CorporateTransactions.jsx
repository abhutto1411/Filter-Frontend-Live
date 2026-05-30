import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Eye, RefreshCw, X, FileText, Image as ImageIcon } from 'lucide-react';
import {
    listCorporatePaymentApprovals,
    getCorporatePaymentApproval,
    getSuperAdminInvoiceView,
    getWorkshopOptions,
    getBranches,
} from '../../services/superAdminApi';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';

const num = (v) =>
    `SAR ${Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function formatDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatDateTime(raw) {
    if (!raw) return '—';
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

/** Normalize backend invoice payload into the shape InvoiceDetailsModal expects. */
function normalizeInvoiceForModal(invoice) {
    if (!invoice || typeof invoice !== 'object') return invoice;
    const srcOrder = invoice.salesOrder || invoice.sales_order || {};
    const srcCustomer = srcOrder.customer || invoice.customer || {};
    const srcVehicle = srcOrder.vehicle || invoice.vehicle || {};
    const srcJobs = Array.isArray(srcOrder.jobs)
        ? srcOrder.jobs
        : Array.isArray(invoice.jobs)
            ? invoice.jobs
            : [];
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

export default function CorporateTransactions() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [detailRow, setDetailRow] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailErr, setDetailErr] = useState('');
    const [invoice, setInvoice] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
    const [invoiceErr, setInvoiceErr] = useState('');
    /** Standalone proof viewer (independent of the row detail modal). */
    const [proofView, setProofView] = useState(null);
    const [proofLoadingId, setProofLoadingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listCorporatePaymentApprovals({
                status: 'approved',
                limit: 200,
                offset: 0,
            });
            setRows(Array.isArray(res?.approvals) ? res.approvals : []);
            setTotal(Number(res?.total) || 0);
        } catch (e) {
            setError(e?.message || 'Could not load transactions');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // Workshop options (load once).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getWorkshopOptions();
                const list = Array.isArray(res?.workshops)
                    ? res.workshops
                    : Array.isArray(res?.data?.workshops)
                        ? res.data.workshops
                        : Array.isArray(res)
                            ? res
                            : [];
                if (!cancelled) {
                    setWorkshopOptions(
                        list.map((w) => ({ id: String(w.id), name: String(w.name || '').trim() || 'Workshop' })),
                    );
                }
            } catch {
                if (!cancelled) setWorkshopOptions([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Branches for the selected workshop.
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
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedWorkshopId]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const workshopName = workshopOptions.find((w) => w.id === selectedWorkshopId)?.name?.toLowerCase() ?? null;
        const branchName = branchOptions.find((b) => b.id === selectedBranchId)?.name?.toLowerCase() ?? null;
        return rows.filter((r) => {
            // Workshop / branch filter — match by name (backend returns names, not ids).
            if (workshopName) {
                const rWorkshop = String(r.invoice?.workshopName ?? '').toLowerCase();
                if (rWorkshop !== workshopName) return false;
            }
            if (branchName) {
                const rBranch = String(r.invoice?.branchName ?? '').toLowerCase();
                if (rBranch !== branchName) return false;
            }
            if (!q) return true;
            const hay = [
                r.corporate?.companyName,
                r.invoice?.invoiceNo,
                r.invoice?.workshopName,
                r.invoice?.branchName,
                r.paymentMethod,
                r.amount,
                r.id,
                r.requestedByUser?.name,
                r.requestedByUser?.email,
            ]
                .map((x) => String(x ?? '').toLowerCase())
                .join(' ');
            return hay.includes(q);
        });
    }, [rows, search, selectedWorkshopId, selectedBranchId, workshopOptions, branchOptions]);

    const totalAmount = useMemo(
        () => filtered.reduce((s, r) => s + Number(r.amount ?? 0), 0),
        [filtered],
    );

    const openDetail = async (row) => {
        setDetailLoading(true);
        setDetailErr('');
        setInvoiceErr('');
        setInvoice(null);
        setDetailRow({ id: row.id, loading: true });
        try {
            const res = await getCorporatePaymentApproval(row.id);
            setDetailRow(res);
        } catch (e) {
            setDetailErr(e?.message || 'Could not load transaction detail');
            setDetailRow({ id: row.id, error: e?.message });
        } finally {
            setDetailLoading(false);
        }
    };

    const closeDetail = () => {
        setDetailRow(null);
        setDetailErr('');
        setInvoiceErr('');
    };

    const openInvoice = async (invoiceId) => {
        if (!invoiceId) return;
        setInvoiceLoadingId(String(invoiceId));
        setInvoiceErr('');
        try {
            const raw = await getSuperAdminInvoiceView(invoiceId);
            const inv = raw?.invoice ?? raw?.data?.invoice ?? raw?.data ?? raw;
            setInvoice(normalizeInvoiceForModal(inv));
        } catch (e) {
            setInvoiceErr(e?.message || 'Could not load invoice');
        } finally {
            setInvoiceLoadingId(null);
        }
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
    };
    const cellTd = { padding: '12px', verticalAlign: 'middle', fontSize: '0.8125rem' };

    return (
        <div style={{ padding: 20 }}>
            <header style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                        Corporate Transactions
                    </h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        Approved payment proofs from corporate clients — actual receipts recorded against invoices.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => load()}
                    disabled={loading}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        cursor: loading ? 'wait' : 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                    }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </header>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Workshop</label>
                    <select
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            background: '#fff',
                            minWidth: 200,
                        }}
                    >
                        <option value="">All workshops</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Branch</label>
                    <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            background: '#fff',
                            minWidth: 200,
                            opacity: selectedWorkshopId ? 1 : 0.6,
                        }}
                        title={selectedWorkshopId ? '' : 'Select a workshop first'}
                    >
                        <option value="">All branches</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search company, invoice no, method, amount…"
                    style={{
                        flex: 1,
                        minWidth: 240,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.875rem',
                    }}
                />
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fdfa', border: '1px solid #99f6e4', display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#0f766e', fontWeight: 700, textTransform: 'uppercase' }}>Transactions</div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#134e4a' }}>{filtered.length}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#0f766e', fontWeight: 700, textTransform: 'uppercase' }}>Total Received</div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#134e4a' }}>{num(totalAmount)}</div>
                    </div>
                </div>
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
                            <th style={cellTh}>Date</th>
                            <th style={cellTh}>Corporate</th>
                            <th style={cellTh}>Invoice</th>
                            <th style={cellTh}>Workshop / Branch</th>
                            <th style={cellTh}>Method</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Amount</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                    <Loader2 size={18} className="spin" /> Loading…
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                    {rows.length === 0
                                        ? 'No approved corporate transactions yet.'
                                        : 'No transactions match your search.'}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((r) => {
                                const hasMulti =
                                    Array.isArray(r.allocations) && r.allocations.length > 1;
                                return (
                                    <tr
                                        key={r.id}
                                        onClick={() => openDetail(r)}
                                        style={{
                                            borderTop: '1px solid #f1f5f9',
                                            cursor: 'pointer',
                                            transition: 'background 0.12s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#fafafa';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <td style={cellTd}>{formatDateTime(r.reviewedAt || r.updatedAt || r.createdAt)}</td>
                                        <td style={cellTd}>
                                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.corporate?.companyName ?? '—'}</div>
                                            {r.requestedByUser?.name ? (
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                                                    by {r.requestedByUser.name}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td style={cellTd}>
                                            {hasMulti ? (
                                                <span style={{ fontWeight: 700, color: '#2563eb' }}>
                                                    {r.allocations.length} invoices ({r.allocations.map((a) => a.invoiceNo).filter(Boolean).slice(0, 2).join(', ')}{r.allocations.length > 2 ? '…' : ''})
                                                </span>
                                            ) : (
                                                <span style={{ fontWeight: 700, color: '#2563eb' }}>{r.invoice?.invoiceNo ?? '—'}</span>
                                            )}
                                        </td>
                                        <td style={cellTd}>
                                            <div>{r.invoice?.workshopName ?? '—'}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.invoice?.branchName ?? '—'}</div>
                                        </td>
                                        <td style={{ ...cellTd, textTransform: 'capitalize' }}>{r.paymentMethod}</td>
                                        <td style={{ ...cellTd, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                            {num(r.amount)}
                                        </td>
                                        <td style={{ ...cellTd, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => openDetail(r)}
                                                style={{
                                                    padding: '6px 10px',
                                                    borderRadius: 8,
                                                    border: '1px solid #bfdbfe',
                                                    background: '#eff6ff',
                                                    color: '#1d4ed8',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                }}
                                                title="View details"
                                            >
                                                <Eye size={13} /> View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                {total > rows.length ? (
                    <div style={{ padding: 10, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                        Showing first {rows.length} of {total}.
                    </div>
                ) : null}
            </div>

            {/* Detail modal */}
            {detailRow ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                        padding: 16,
                    }}
                    onClick={() => closeDetail()}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#fff',
                            borderRadius: 16,
                            width: 'min(900px, 100%)',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 24px 48px rgba(15,23,42,0.2)',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                                Corporate transaction · #{detailRow.id ?? ''}
                            </h3>
                            <button
                                type="button"
                                onClick={closeDetail}
                                style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, padding: 8, cursor: 'pointer' }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: 22 }}>
                            {detailLoading || detailRow.loading ? (
                                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                                    <Loader2 size={20} className="spin" /> Loading…
                                </div>
                            ) : detailErr || detailRow.error ? (
                                <div style={{ color: '#b91c1c' }}>{detailErr || detailRow.error}</div>
                            ) : (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Corporate</p>
                                            <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1rem' }}>{detailRow.corporate?.companyName ?? '—'}</p>
                                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                                Paid by {detailRow.requestedByUser?.name ?? detailRow.requestedByUser?.email ?? '—'}
                                            </p>
                                            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                Submitted {formatDateTime(detailRow.createdAt)} · Approved {formatDateTime(detailRow.reviewedAt)}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Reviewed By</p>
                                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{detailRow.reviewedByUser?.name ?? '—'}</p>
                                            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{detailRow.reviewedByUser?.email ?? ''}</p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Method</p>
                                            <p style={{ margin: '4px 0 0', fontWeight: 700, textTransform: 'capitalize' }}>{detailRow.paymentMethod}</p>
                                        </div>
                                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Amount</p>
                                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{num(detailRow.amount)}</p>
                                        </div>
                                    </div>

                                    {detailRow.notes ? (
                                        <div style={{ marginBottom: 14, padding: 10, background: '#fefce8', borderRadius: 10, fontSize: '0.875rem' }}>
                                            <strong>Notes:</strong> {detailRow.notes}
                                        </div>
                                    ) : null}

                                    {/* Invoices covered */}
                                    <p style={{ margin: '0 0 6px', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                                        Invoices covered ({Array.isArray(detailRow.allocations) && detailRow.allocations.length > 0 ? detailRow.allocations.length : 1})
                                    </p>
                                    <div style={{ marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                            <thead style={{ background: '#f8fafc' }}>
                                                <tr>
                                                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Invoice</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Invoice Total</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Balance</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Allocated</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>View</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(Array.isArray(detailRow.allocations) && detailRow.allocations.length > 0
                                                    ? detailRow.allocations
                                                    : [{
                                                          invoiceId: detailRow.invoice?.id,
                                                          invoiceNo: detailRow.invoice?.invoiceNo,
                                                          invoiceTotal: detailRow.invoice?.totalAmount,
                                                          invoiceBalance: detailRow.invoice?.balance,
                                                          amount: detailRow.amount,
                                                      }]
                                                ).map((alloc, idx) => (
                                                    <tr key={`${alloc.invoiceId}-${idx}`} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '10px', fontWeight: 700 }}>
                                                            {alloc.invoiceNo ?? `#${alloc.invoiceId}`}
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'right' }}>
                                                            {alloc.invoiceTotal != null ? num(alloc.invoiceTotal) : '—'}
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'right' }}>
                                                            {alloc.invoiceBalance != null ? num(alloc.invoiceBalance) : '—'}
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>
                                                            {num(alloc.amount)}
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'right' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => openInvoice(alloc.invoiceId)}
                                                                disabled={invoiceLoadingId === String(alloc.invoiceId)}
                                                                style={{
                                                                    padding: '6px 10px',
                                                                    borderRadius: 8,
                                                                    border: '1px solid #bfdbfe',
                                                                    background: '#eff6ff',
                                                                    color: '#1d4ed8',
                                                                    cursor: invoiceLoadingId === String(alloc.invoiceId) ? 'wait' : 'pointer',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                }}
                                                            >
                                                                {invoiceLoadingId === String(alloc.invoiceId)
                                                                    ? <Loader2 size={12} className="spin" />
                                                                    : <FileText size={12} />}
                                                                {' '}View Invoice
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {invoiceErr ? (
                                        <div style={{ marginBottom: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 10, fontSize: '0.8125rem' }}>
                                            {invoiceErr}
                                        </div>
                                    ) : null}

                                    {/* Proof image */}
                                    {detailRow.proofImage ? (
                                        <>
                                            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                                                <ImageIcon size={12} style={{ verticalAlign: 'middle' }} /> Proof
                                            </p>
                                            {detailRow.proofMimeType === 'application/pdf' ? (
                                                <iframe
                                                    title="proof-pdf"
                                                    src={detailRow.proofImage}
                                                    style={{ width: '100%', height: 460, border: '1px solid #e2e8f0', borderRadius: 10 }}
                                                />
                                            ) : (
                                                <img
                                                    alt="payment proof"
                                                    src={detailRow.proofImage}
                                                    style={{ width: '100%', maxHeight: 540, objectFit: 'contain', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}
                                                />
                                            )}
                                        </>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            <InvoiceDetailsModal
                invoice={invoice}
                isOpen={!!invoice}
                footerVariant="corporate"
                onClose={() => setInvoice(null)}
            />
        </div>
    );
}
