import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, FileText, ReceiptText, Search } from 'lucide-react';
import {
    getSuperAdminReceipts,
    getSuperAdminInvoiceView,
    getWorkshopOptions,
    getBranches,
} from '../../services/superAdminApi';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';

const PAGE_SIZE = 50;

const num = (v) =>
    `SAR ${Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function formatDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
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
 * Admin → Sales → Receipts. Monthly-billing invoices that have actually been
 * settled (real, non-phantom payments cover the total). Newest settlement first.
 */
export default function Receipts() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [invoice, setInvoice] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
    const [invoiceErr, setInvoiceErr] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getSuperAdminReceipts({
                workshopId: selectedWorkshopId || undefined,
                branchId:   selectedBranchId   || undefined,
                limit: PAGE_SIZE,
                offset: (page - 1) * PAGE_SIZE,
            });
            const list = Array.isArray(res?.receipts)
                ? res.receipts
                : Array.isArray(res?.items) ? res.items
                : Array.isArray(res) ? res : [];
            setRows(list);
            setTotal(Number(res?.total) || list.length);
        } catch (e) {
            setError(e?.message || 'Could not load receipts');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [selectedWorkshopId, selectedBranchId, page]);

    useEffect(() => { void load(); }, [load]);

    // Snap back to page 1 when filters change.
    useEffect(() => { setPage(1); }, [selectedWorkshopId, selectedBranchId]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Workshop options (load once).
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

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => {
            const hay = [
                r.invoiceNo,
                r.corporateAccountName, r.customerName,
                r.workshopName, r.branchName,
                r.paymentMethod, r.deferredPaymentMethod,
                r.totalAmount, r.amountPaid,
            ].map((x) => String(x ?? '').toLowerCase()).join(' ');
            return hay.includes(q);
        });
    }, [rows, search]);

    const { totalBilled, totalCollected } = useMemo(() => {
        let billed = 0;
        let collected = 0;
        for (const r of filtered) {
            billed += Number(r.totalAmount ?? 0);
            collected += Number(r.amountPaid ?? r.totalAmount ?? 0);
        }
        return { totalBilled: billed, totalCollected: collected };
    }, [filtered]);

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
        whiteSpace: 'nowrap',
    };
    const cellTd = { padding: '12px', verticalAlign: 'middle', fontSize: '0.8125rem' };
    const labelStyle = { fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 };
    const inputStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.875rem', background: '#fff' };

    return (
        <div style={{ padding: 20 }}>
            <header style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ReceiptText size={19} color="#047857" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Receipts</h1>
                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                            Monthly billing with real payments — paid &amp; partially paid. Filter by workshop / branch.
                        </p>
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
            </header>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                    <label style={labelStyle}>Workshop</label>
                    <select value={selectedWorkshopId} onChange={(e) => setSelectedWorkshopId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                        <option value="">All workshops</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                    <label style={labelStyle}>Branch</label>
                    <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId}
                        style={{ ...inputStyle, minWidth: 200, opacity: selectedWorkshopId ? 1 : 0.6 }}
                        title={selectedWorkshopId ? '' : 'Select a workshop first'}
                    >
                        <option value="">All branches</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search company, invoice no, method, amount…"
                        style={{ ...inputStyle, width: '100%', paddingLeft: 36 }}
                    />
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fdfa', border: '1px solid #99f6e4', display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#0f766e', fontWeight: 700, textTransform: 'uppercase' }}>Receipts</div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#134e4a' }}>{filtered.length}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#0f766e', fontWeight: 700, textTransform: 'uppercase' }}>Billed</div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#134e4a' }}>{num(totalBilled)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#0f766e', fontWeight: 700, textTransform: 'uppercase' }}>Collected</div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#15803d' }}>{num(totalCollected)}</div>
                    </div>
                </div>
            </div>

            {error ? (
                <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, marginBottom: 12 }}>{error}</div>
            ) : null}

            {invoiceErr ? (
                <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Invoice view failed: {invoiceErr}</span>
                    <button type="button" onClick={() => setInvoiceErr('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#991b1b', fontWeight: 700 }}>×</button>
                </div>
            ) : null}

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                        <tr>
                            <th style={cellTh}>Payment Date</th>
                            <th style={cellTh}>Invoice No</th>
                            <th style={cellTh}>Customer</th>
                            <th style={cellTh}>Workshop / Branch</th>
                            <th style={cellTh}>Method</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Total</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Paid</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Balance</th>
                            <th style={cellTh}>Status</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                <Loader2 size={18} className="spin" /> Loading…
                            </td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                No monthly-billing receipts for the selected filters.
                            </td></tr>
                        ) : filtered.map((r) => {
                            const total = Number(r.totalAmount ?? 0);
                            const paid = Number(r.amountPaid ?? total);
                            const balance = r.balance != null ? Number(r.balance) : Math.max(0, total - paid);
                            const isPartial = balance > 0.01 && String(r.paymentStatus).toLowerCase() !== 'paid';
                            return (
                                <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                    <td style={{ ...cellTd, whiteSpace: 'nowrap' }}>{formatDate(r.paymentDate ?? r.issuedAt ?? r.invoiceDate)}</td>
                                    <td style={cellTd}><span style={{ fontWeight: 700, color: '#2563eb' }}>{r.invoiceNo ?? '—'}</span></td>
                                    <td style={cellTd}>
                                        <div style={{ fontWeight: 700 }}>{r.corporateAccountName ?? r.customerName ?? '—'}</div>
                                    </td>
                                    <td style={cellTd}>
                                        <div>{r.workshopName ?? '—'}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.branchName ?? '—'}</div>
                                    </td>
                                    <td style={cellTd}>
                                        <span style={{ textTransform: 'capitalize' }}>{(r.paymentMethod || '—').toString().replace(/_/g, ' ')}</span>
                                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>via {(r.deferredPaymentMethod || 'Monthly Billing').toString().replace(/_/g, ' ')}</div>
                                    </td>
                                    <td style={{ ...cellTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(total)}</td>
                                    <td style={{ ...cellTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#15803d', fontWeight: 700 }}>{num(paid)}</td>
                                    <td style={{ ...cellTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: balance > 0 ? '#b91c1c' : '#94a3b8' }}>{num(balance)}</td>
                                    <td style={cellTd}>
                                        <span style={{
                                            padding: '3px 10px',
                                            borderRadius: 999,
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            display: 'inline-block',
                                            whiteSpace: 'nowrap',
                                            background: isPartial ? '#fef3c7' : '#dcfce7',
                                            color: isPartial ? '#92400e' : '#166534',
                                        }}>
                                            {isPartial ? 'Partially Paid' : 'Paid'}
                                        </span>
                                    </td>
                                    <td style={{ ...cellTd, textAlign: 'right' }}>
                                        <button
                                            type="button"
                                            onClick={() => openInvoice(r.id)}
                                            disabled={invoiceLoadingId === String(r.id)}
                                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: invoiceLoadingId === String(r.id) ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                        >
                                            {invoiceLoadingId === String(r.id) ? <Loader2 size={12} className="spin" /> : <FileText size={12} />} View
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    pageSize={PAGE_SIZE}
                    rowsThisPage={rows.length}
                    onChange={(next) => setPage(Math.max(1, Math.min(totalPages, next)))}
                    disabled={loading}
                />
            </div>

            <InvoiceDetailsModal
                invoice={invoice}
                isOpen={!!invoice}
                footerVariant="corporate"
                onClose={() => setInvoice(null)}
            />
        </div>
    );
}

/** Bottom-of-table pagination. */
function PaginationBar({ page, totalPages, total, pageSize, rowsThisPage, onChange, disabled }) {
    if (total === 0) return null;
    const firstRow = (page - 1) * pageSize + 1;
    const lastRow  = (page - 1) * pageSize + rowsThisPage;
    const btn = (active) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #cbd5e1',
        background: active ? '#fff' : '#f8fafc',
        color: active ? '#0f172a' : '#94a3b8',
        cursor: active ? 'pointer' : 'not-allowed',
        fontSize: '0.75rem',
        fontWeight: 700,
    });
    return (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Showing <strong>{firstRow}–{lastRow}</strong> of <strong>{total}</strong>
                {' '}· page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </div>
            <div style={{ display: 'inline-flex', gap: 6 }}>
                <button type="button" onClick={() => onChange(1)} disabled={disabled || page === 1} style={btn(!(disabled || page === 1))}>« First</button>
                <button type="button" onClick={() => onChange(page - 1)} disabled={disabled || page === 1} style={btn(!(disabled || page === 1))}>‹ Prev</button>
                <button type="button" onClick={() => onChange(page + 1)} disabled={disabled || page >= totalPages} style={btn(!(disabled || page >= totalPages))}>Next ›</button>
                <button type="button" onClick={() => onChange(totalPages)} disabled={disabled || page >= totalPages} style={btn(!(disabled || page >= totalPages))}>Last »</button>
            </div>
        </div>
    );
}
