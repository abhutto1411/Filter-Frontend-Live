import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 50;
import {
    getSuperAdminInvoiceView,
    getWorkshopOptions,
    getBranches,
    getInvoices,
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
    const [page, setPage] = useState(1); // 1-indexed for display convenience
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [invoice, setInvoice] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
    // Error from the last invoice fetch (kept so we can surface it to the user
    // if the call fails — otherwise the View button used to spin forever
    // because openInvoice called setInvoiceErr() which was undefined →
    // ReferenceError thrown BEFORE the try/finally → loading state never reset).
    const [invoiceErr, setInvoiceErr] = useState('');

    // Server-side pagination — 50 per page. Page changes refetch.
    // Server returns paid + unpaid + overdue + partial in one payload;
    // each row carries its own `paymentStatus` we render as a badge.
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getInvoices({
                workshopId: selectedWorkshopId || undefined,
                branchId:   selectedBranchId   || undefined,
                limit: PAGE_SIZE,
                offset: (page - 1) * PAGE_SIZE,
                corporateOnly: true,     // only corporate invoices
                orderStatus: 'invoiced', // only orders that have been invoiced (paid or unpaid both shown)
            });
            const list = Array.isArray(res?.invoices)
                ? res.invoices
                : Array.isArray(res?.items) ? res.items
                : Array.isArray(res) ? res
                : [];
            setRows(list);
            setTotal(Number(res?.total) || list.length);
        } catch (e) {
            setError(e?.message || 'Could not load invoices');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [selectedWorkshopId, selectedBranchId, page]);

    useEffect(() => {
        void load();
    }, [load]);

    // Snap back to page 1 when filters change — otherwise an offset higher
    // than the new total returns nothing and the user sees an empty table.
    useEffect(() => {
        setPage(1);
    }, [selectedWorkshopId, selectedBranchId]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        if (!q) return rows;
        return rows.filter((r) => {
            const hay = [
                r.invoiceNo, r.invoice_no,
                // Search matches the displayed company name only — keep aligned
                // with what the Customer column shows so search results aren't
                // surprising (no hits on hidden contact-person names).
                r.corporateAccountName, r.corporate?.companyName,
                r.workshopName, r.workshop?.name,
                r.branchName, r.branch?.name,
                r.paymentStatus,
                r.totalAmount, r.balance, r.amountPaid,
            ].map((x) => String(x ?? '').toLowerCase()).join(' ');
            return hay.includes(q);
        });
    }, [rows, search]);

    // KPI totals — billed, collected (real, non-phantom) and outstanding.
    const { totalBilled, totalCollected, totalOutstanding } = useMemo(() => {
        let billed = 0;
        let collected = 0;
        let outstanding = 0;
        for (const r of filtered) {
            const total = Number(r.totalAmount ?? r.grandTotal ?? 0);
            const paid = r.realPaid != null
                ? Number(r.realPaid)
                : Math.max(0, total - Number(r.realBalance ?? r.balance ?? 0));
            const bal = r.realBalance != null
                ? Number(r.realBalance)
                : Number(r.balance ?? 0);
            billed += total;
            collected += paid;
            outstanding += bal;
        }
        return { totalBilled: billed, totalCollected: collected, totalOutstanding: outstanding };
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
                        All invoices across workshops — paid, unpaid, partial, and overdue. Filter by workshop / branch.
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Invoices" value={loading ? '—' : filtered.length.toLocaleString()} accent="#0f172a" />
                <KpiCard label="Total Billed" value={loading ? '—' : num(totalBilled)} accent="#0f172a" />
                <KpiCard label="Collected" value={loading ? '—' : num(totalCollected)} accent="#15803d" />
                <KpiCard label="Outstanding" value={loading ? '—' : num(totalOutstanding)} accent={totalOutstanding > 0 ? '#b91c1c' : '#15803d'} />
            </div>

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
            </div>

            {error ? (
                <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, marginBottom: 12 }}>
                    {error}
                </div>
            ) : null}

            {invoiceErr ? (
                <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Invoice view failed: {invoiceErr}</span>
                    <button type="button" onClick={() => setInvoiceErr('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#991b1b', fontWeight: 700 }}>×</button>
                </div>
            ) : null}

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'auto' }}>
                <InvoicesTable
                    loading={loading}
                    filtered={filtered}
                    cellTh={cellTh}
                    cellTd={cellTd}
                    invoiceLoadingId={invoiceLoadingId}
                    onOpenInvoice={openInvoice}
                />
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

/* ───────── KPI summary card ───────── */

function KpiCard({ label, value, accent = '#0f172a' }) {
    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
        }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums' }}>
                {value}
            </span>
        </div>
    );
}

/* ───────── Invoices table (only corporate + sales-order status=invoiced) ── */

/** Three-state payment badge derived from collected vs outstanding:
 *    balance ≈ 0            → Paid (green)
 *    paid > 0 & balance > 0 → Partially Paid (amber)
 *    paid ≈ 0               → Not Paid (red)  */
function PaidStatusBadge({ paid = 0, balance = 0 }) {
    const EPS = 0.01;
    const p = Number(paid) || 0;
    const b = Number(balance) || 0;
    let label;
    let style;
    if (b <= EPS) {
        label = 'Paid';
        style = { bg: '#dcfce7', fg: '#166534' };          // green
    } else if (p > EPS) {
        label = 'Partially Paid';
        style = { bg: '#fef3c7', fg: '#92400e' };          // amber
    } else {
        label = 'Not Paid';
        style = { bg: '#fef2f2', fg: '#991b1b' };          // red
    }
    return (
        <span style={{
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: '0.7rem',
            fontWeight: 700,
            background: style.bg,
            color: style.fg,
            display: 'inline-block',
            whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
    );
}

/** Distinguish the two corporate-order origins by the SalesOrder.source field:
 *    - 'walk_in_corporate' → cashier created the order for a corporate
 *      customer directly at the POS (no prior booking).
 *    - 'corporate_app'     → the corporate user sent a booking request that
 *      the cashier accepted; it then became an order.
 *  This page is filtered server-side to corporate orders only, so any other
 *  source value falls back to a generic "Corporate" label as a defensive
 *  catch-all (shouldn't appear in normal use). */
function OrderTypeBadge({ row }) {
    const src = String(row.orderSource ?? '').toLowerCase();

    let label = 'Corporate';
    let style = { bg: '#ecfeff', fg: '#155e75' }; // cyan default

    if (src === 'walk_in_corporate') {
        label = 'Walk-in Corporate';
        style = { bg: '#ecfeff', fg: '#155e75' }; // cyan
    } else if (src === 'corporate_app') {
        label = 'Corporate Booking';
        style = { bg: '#f5f3ff', fg: '#6b21a8' }; // purple
    }

    return (
        <span style={{
            padding: '3px 9px',
            borderRadius: 999,
            fontSize: '0.7rem',
            fontWeight: 700,
            background: style.bg,
            color: style.fg,
            display: 'inline-block',
        }}>
            {label}
        </span>
    );
}

function InvoicesTable({ loading, filtered, cellTh, cellTd, invoiceLoadingId, onOpenInvoice }) {
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
                <tr>
                    <th style={cellTh}>Invoice Date</th>
                    <th style={cellTh}>Invoice No</th>
                    <th style={cellTh}>Customer</th>
                    <th style={cellTh}>Order Type</th>
                    <th style={cellTh}>Workshop / Branch</th>
                    <th style={cellTh}>Status</th>
                    <th style={{ ...cellTh, textAlign: 'right' }}>Invoice amount</th>
                    <th style={{ ...cellTh, textAlign: 'right' }}>Receipt Amount</th>
                    <th style={{ ...cellTh, textAlign: 'right' }}>Balance</th>
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
                        No invoiced corporate orders for the selected filters.
                    </td></tr>
                ) : filtered.map((r) => {
                    const total = Number(r.totalAmount ?? r.grandTotal ?? 0);
                    // Prefer server-computed REAL values (exclude phantom monthly
                    // billing placeholder payments). Fall back to raw fields if
                    // older backend hasn't been redeployed yet.
                    const realPaid = r.realPaid != null
                        ? Number(r.realPaid)
                        : Math.max(0, total - Number(r.balance ?? 0));
                    const realBalance = r.realBalance != null
                        ? Number(r.realBalance)
                        : Number(r.balance ?? 0);
                    const realStatus = String(r.realPaymentStatus ?? r.paymentStatus ?? '').toLowerCase();
                    const isPaid = realStatus === 'paid';
                    return (
                        <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={cellTd}>{formatDate(r.invoiceDate ?? r.invoice_date ?? r.createdAt)}</td>
                            <td style={cellTd}><span style={{ fontWeight: 700, color: '#2563eb' }}>{r.invoiceNo ?? r.invoice_no ?? '—'}</span></td>
                            <td style={cellTd}>
                                <div style={{ fontWeight: 700 }}>
                                    {r.corporateAccountName
                                        ?? r.corporate?.companyName
                                        ?? '—'}
                                </div>
                            </td>
                            <td style={cellTd}><OrderTypeBadge row={r} /></td>
                            <td style={cellTd}>
                                <div>{r.workshopName ?? r.workshop?.name ?? '—'}</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.branchName ?? r.branch?.name ?? '—'}</div>
                            </td>
                            <td style={cellTd}><PaidStatusBadge paid={isPaid ? total : realPaid} balance={isPaid ? 0 : realBalance} /></td>
                            <td style={{ ...cellTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(total)}</td>
                            <td style={{ ...cellTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#15803d' }}>{num(realPaid)}</td>
                            <td style={{ ...cellTd, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: realBalance > 0 ? '#b91c1c' : '#94a3b8' }}>{num(realBalance)}</td>
                            <td style={{ ...cellTd, textAlign: 'right' }}>
                                <button
                                    type="button"
                                    onClick={() => onOpenInvoice(r.id)}
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
    );
}

/** Bottom-of-table pagination: Prev / page indicator / Next + summary. */
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
        <div style={{
            padding: '12px 14px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
        }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Showing <strong>{firstRow}–{lastRow}</strong> of <strong>{total}</strong>
                {' '}· page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </div>
            <div style={{ display: 'inline-flex', gap: 6 }}>
                <button
                    type="button"
                    onClick={() => onChange(1)}
                    disabled={disabled || page === 1}
                    style={btn(!(disabled || page === 1))}
                >
                    « First
                </button>
                <button
                    type="button"
                    onClick={() => onChange(page - 1)}
                    disabled={disabled || page === 1}
                    style={btn(!(disabled || page === 1))}
                >
                    <ChevronLeft size={12} /> Prev
                </button>
                <button
                    type="button"
                    onClick={() => onChange(page + 1)}
                    disabled={disabled || page >= totalPages}
                    style={btn(!(disabled || page >= totalPages))}
                >
                    Next <ChevronRight size={12} />
                </button>
                <button
                    type="button"
                    onClick={() => onChange(totalPages)}
                    disabled={disabled || page >= totalPages}
                    style={btn(!(disabled || page >= totalPages))}
                >
                    Last »
                </button>
            </div>
        </div>
    );
}
