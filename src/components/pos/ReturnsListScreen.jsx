import { useState, useEffect } from 'react';
import { List, RefreshCw, RotateCcw, Calendar, User } from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function ReturnsListScreen() {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchReturns = (showRefresh = false) => {
        if (showRefresh) setRefreshing(true); else setLoading(true);
        apiFetch('/cashier/return/list?limit=50&offset=0')
            .then(d => {
                const list = d.returns || d.salesReturns || d.data || d || [];
                setReturns(Array.isArray(list) ? list : []);
            })
            .catch(() => setReturns([]))
            .finally(() => { setLoading(false); setRefreshing(false); });
    };

    useEffect(() => { fetchReturns(); }, []);

    const totalRefund = returns.reduce((s, r) => s + (parseFloat(r.refundAmount ?? r.totalAmount ?? r.amount ?? 0) || 0), 0);

    return (
        <div style={{ width: '100%', padding: 24, boxSizing: 'border-box' }}>
            {/* Section title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 4, height: 24, background: '#FCC247', borderRadius: 2 }} />
                <RotateCcw size={20} color="#23262D" />
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#1E2124' }}>Returns List</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>All processed sales returns</p>
                </div>
                <button onClick={() => fetchReturns(true)} disabled={refreshing}
                    style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                    <RefreshCw size={14} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} />
                    Refresh
                </button>
            </div>

            {/* Summary card */}
            {!loading && returns.length > 0 && (
                <div style={{ background: 'linear-gradient(135deg, #23262D, #2C3136)', borderRadius: 14, padding: '14px 18px', color: '#fff', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 6px 16px rgba(35,38,45,0.15)' }}>
                    <div>
                        <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#FCC247', fontWeight: 600, letterSpacing: 0.5 }}>TOTAL RETURNS</p>
                        <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>{returns.length}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#FCC247', fontWeight: 600, letterSpacing: 0.5 }}>REFUND AMOUNT</p>
                        <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>SAR {totalRefund.toFixed(2)}</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[1,2,3].map(i => <div key={i} style={{ height: 88, background: '#fff', borderRadius: 14, animation: 'pulse 1.5s infinite' }} />)}
                </div>
            ) : returns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                    <List size={44} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No returns found</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>Processed returns will appear here</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {returns.map((r, i) => {
                        const status = (r.status || 'returned').toLowerCase();
                        const statusColor = status === 'completed' ? { bg: '#DCFCE7', fg: '#15803D' }
                            : status === 'pending' ? { bg: '#FEF3C7', fg: '#92400E' }
                            : { bg: '#FEE2E2', fg: '#B91C1C' };
                        const dateStr = r.createdAt
                            ? new Date(r.createdAt).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '';
                        return (
                            <div key={r.id || i} style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <p style={{ margin: 0, fontWeight: 900, fontSize: '0.9rem', color: '#1E2124' }}>
                                        Return #{r.returnNumber || r.id?.slice?.(-6) || r.id}
                                    </p>
                                    <span style={{ padding: '3px 10px', borderRadius: 20, background: statusColor.bg, color: statusColor.fg, fontSize: '0.7rem', fontWeight: 800, textTransform: 'capitalize' }}>
                                        {status}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <span style={{ fontSize: '0.76rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                            <User size={12} /> {r.customerName || r.customer?.name || 'Customer'}
                                        </span>
                                        {dateStr && (
                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                                <Calendar size={11} /> {dateStr}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ margin: 0, fontWeight: 900, fontSize: '1rem', color: '#b91c1c' }}>
                                        SAR {(parseFloat(r.refundAmount ?? r.totalAmount ?? r.amount ?? 0) || 0).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
    );
}
