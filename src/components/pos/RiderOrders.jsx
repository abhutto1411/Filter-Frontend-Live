import { useState, useEffect, useCallback } from 'react';
import { Smartphone, Check, X, RefreshCw, Car, Calendar, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { apiFetch } from '../../services/api';

const FILTERS = [
    { id: 'pending', label: 'Waiting for approval' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLE = {
    submitted: { bg: '#fef9c3', fg: '#854d0e', label: 'Waiting for approval' },
    approving: { bg: '#e0f2fe', fg: '#0369a1', label: 'Approving…' },
    approved: { bg: '#dcfce7', fg: '#15803d', label: 'Approved' },
    rejected: { bg: '#fef2f2', fg: '#b91c1c', label: 'Rejected' },
    cancelled: { bg: '#f1f5f9', fg: '#475569', label: 'Cancelled by customer' },
};

const money = (n) => `${Number(n || 0).toFixed(2)} SAR`;
const when = (v) => {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-SA', { dateStyle: 'medium', timeStyle: 'short' });
};

/** Red badge on the POS menu: orders waiting for approval + approved ones the customer asked to cancel. */
export function RiderOrdersNavBadge() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let alive = true;
        const load = () =>
            apiFetch('/cashier/rider-bookings/summary')
                .then((d) => { if (alive) setCount(Number(d?.pendingCount || 0) + Number(d?.cancelRequestedCount || 0)); })
                .catch(() => {});
        load();
        const t = setInterval(load, 30000);
        return () => { alive = false; clearInterval(t); };
    }, []);
    if (!count) return null;
    return (
        <span style={{ marginLeft: 'auto', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {count > 99 ? '99+' : count}
        </span>
    );
}

/**
 * POS "Rider Orders": workshop orders customers placed in the Filter Rider app
 * for this branch. Approve creates a normal walk-in sales order (it then shows
 * under Orders); reject needs a reason, which the customer sees in the app.
 * Payment is taken here at the workshop.
 */
export default function RiderOrders({ onOpenOrders }) {
    const [filter, setFilter] = useState('pending');
    const [data, setData] = useState({ bookings: [], pendingCount: 0, cancelRequestedCount: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [notice, setNotice] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        apiFetch(`/cashier/rider-bookings?filter=${filter}&limit=50`)
            .then((d) => setData({
                bookings: d?.bookings || [],
                pendingCount: d?.pendingCount || 0,
                cancelRequestedCount: d?.cancelRequestedCount || 0,
            }))
            .catch((e) => { setError(e.message || 'Could not load Rider orders'); setData((p) => ({ ...p, bookings: [] })); })
            .finally(() => setLoading(false));
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    const approve = async (b) => {
        if (!window.confirm(`Approve ${b.bookingCode} for ${b.customerName || b.customerPhone}? A walk-in order will be created.`)) return;
        setBusyId(b.id);
        setError('');
        try {
            const res = await apiFetch(`/cashier/rider-bookings/${b.id}/approve`, { method: 'POST', body: JSON.stringify({}) });
            setNotice(res?.message || `Approved — sales order #${res?.salesOrderId}`);
            load();
        } catch (e) {
            setError(e.message || 'Could not approve');
            load();
        } finally {
            setBusyId(null);
        }
    };

    const reject = async (b) => {
        const reason = window.prompt('Reason for rejecting (the customer will see it):', '');
        if (reason === null) return;
        if (!reason.trim()) { setError('A reason is required to reject.'); return; }
        setBusyId(b.id);
        setError('');
        try {
            await apiFetch(`/cashier/rider-bookings/${b.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
            setNotice(`${b.bookingCode} rejected`);
            load();
        } catch (e) {
            setError(e.message || 'Could not reject');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ ...iconBox }}><Smartphone size={18} /></span>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Rider Orders</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                        Orders from the Filter Rider app for this branch · payment at the workshop
                    </p>
                </div>
                <button onClick={load} style={refreshBtn} disabled={loading}>
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {data.cancelRequestedCount > 0 && filter !== 'approved' && (
                <button onClick={() => setFilter('approved')} style={{ ...banner, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                    <AlertTriangle size={16} />
                    {data.cancelRequestedCount} approved order{data.cancelRequestedCount === 1 ? '' : 's'} the customer asked to cancel — open Approved to handle {data.cancelRequestedCount === 1 ? 'it' : 'them'} in Orders.
                </button>
            )}
            {notice && (
                <div style={{ ...banner, background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
                    <Check size={16} /> <span style={{ flex: 1 }}>{notice}</span>
                    {onOpenOrders && <button onClick={onOpenOrders} style={linkBtn}>Open Orders</button>}
                    <button onClick={() => setNotice('')} style={linkBtn}>×</button>
                </div>
            )}
            {error && (
                <div style={{ ...banner, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
                    <AlertTriangle size={16} /> <span style={{ flex: 1 }}>{error}</span>
                    <button onClick={() => setError('')} style={linkBtn}>×</button>
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                {FILTERS.map((f) => (
                    <button key={f.id} onClick={() => setFilter(f.id)} style={{ ...pill, ...(filter === f.id ? pillOn : {}) }}>
                        {f.label}
                        {f.id === 'pending' && data.pendingCount > 0 && <span style={pillCount}>{data.pendingCount}</span>}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1, 2, 3].map((i) => <div key={i} style={{ height: 120, background: '#f1f5f9', borderRadius: 16 }} />)}
                </div>
            ) : data.bookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                    <Smartphone size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No orders here</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {data.bookings.map((b) => {
                        const st = STATUS_STYLE[b.status] || STATUS_STYLE.submitted;
                        const busy = busyId === b.id;
                        const v = b.vehicle || {};
                        return (
                            <div key={b.id} style={card}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                                            {b.bookingCode} · {b.customerName || 'Rider customer'}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>{b.customerPhone}</p>
                                    </div>
                                    <span style={{ padding: '4px 10px', borderRadius: 20, background: st.bg, color: st.fg, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {st.label}
                                    </span>
                                </div>

                                {b.cancelRequested && b.status === 'approved' && (
                                    <div style={{ ...banner, margin: '10px 0 0', background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
                                        <AlertTriangle size={15} />
                                        The customer asked to cancel{b.cancelReason ? `: "${b.cancelReason}"` : ''}. Cancel sales order #{b.salesOrderId} in Orders.
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '10px 0', fontSize: '0.8rem', color: '#334155' }}>
                                    <span style={meta}><Calendar size={14} /> {when(b.scheduledAt)}</span>
                                    <span style={meta}>
                                        <Car size={14} /> {v.plateNo}
                                        {[v.make, v.model, v.year].filter(Boolean).length > 0 && ` · ${[v.make, v.model, v.year].filter(Boolean).join(' ')}`}
                                        {v.color && ` · ${v.color}`}
                                    </span>
                                    {v.vin && <span style={meta}>VIN {v.vin}</span>}
                                    {v.odometer != null && <span style={meta}>{Number(v.odometer).toLocaleString()} km</span>}
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <tbody>
                                        {(b.items || []).map((i, idx) => (
                                            <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '6px 0', color: '#0f172a' }}>{i.name}{i.nameAr ? <span style={{ color: '#94a3b8' }}> · {i.nameAr}</span> : null}</td>
                                                <td style={{ padding: '6px 8px', color: '#64748b', textAlign: 'right', whiteSpace: 'nowrap' }}>{i.qty} × {money(i.unitPrice)}</td>
                                                <td style={{ padding: '6px 0', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(i.lineTotal)}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '6px 0', color: '#64748b' }}>Subtotal {money(b.subtotal)} · VAT {money(b.vatAmount)}</td>
                                            <td />
                                            <td style={{ padding: '6px 0', fontWeight: 800, textAlign: 'right' }}>{money(b.totalAmount)}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {b.notes && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#334155' }}><FileText size={13} style={{ verticalAlign: '-2px' }} /> {b.notes}</p>}
                                {b.rejectionReason && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>Rejected: {b.rejectionReason}</p>}
                                {b.salesOrderId && <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#64748b' }}>Sales order #{b.salesOrderId}</p>}

                                {(b.status === 'submitted' || b.status === 'approving') && (
                                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                        <button onClick={() => approve(b)} disabled={busy || b.status === 'approving'} style={approveBtn}>
                                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
                                        </button>
                                        <button onClick={() => reject(b)} disabled={busy || b.status === 'approving'} style={rejectBtn}>
                                            <X size={13} /> Reject
                                        </button>
                                        <span style={{ alignSelf: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                                            Prices are checked again on approval (current branch prices).
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const iconBox = { width: 38, height: 38, borderRadius: 10, background: '#FFF9EC', color: '#92400e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const refreshBtn = { marginLeft: 'auto', background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem' };
const banner = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, border: '1px solid', borderRadius: 12, fontSize: '0.82rem', fontWeight: 600 };
const linkBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 800, fontSize: '0.8rem', textDecoration: 'underline' };
const pill = { padding: '7px 16px', borderRadius: 20, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 };
const pillOn = { border: '1px solid #D4A017', background: '#FFF9EC', color: '#92400e' };
const pillCount = { minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#ef4444', color: '#fff', fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', padding: '14px 18px' };
const meta = { display: 'inline-flex', alignItems: 'center', gap: 5 };
const approveBtn = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#059669', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 };
const rejectBtn = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 };
