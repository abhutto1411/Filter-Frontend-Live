import { useState, useEffect } from 'react';
import { ArrowLeft, Building2, Check, X, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function CorporateBookings({ onBack, onApproveAndEdit }) {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');

    const fetchBookings = () => {
        setLoading(true);
        apiFetch(`/cashier/corporate-bookings?filter=${filter}&limit=30`)
            .then(d => setBookings(d.bookings || d.orders || d.data || []))
            .catch(() => setBookings([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchBookings(); }, [filter]);

    const handleApprove = async (booking) => {
        try {
            await apiFetch(`/cashier/corporate-bookings/${booking.id}/approve`, { method: 'POST', body: JSON.stringify({}) });
            onApproveAndEdit(booking);
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const handleReject = async (booking) => {
        const reason = prompt('Reason for rejection (optional):') ?? '';
        if (reason === null) return; // user cancelled
        if (!confirm('Reject this booking?')) return;
        try {
            // Reference uses POST with { reason }
            await apiFetch(`/cashier/corporate-bookings/${booking.id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason: reason.trim() || 'Rejected by cashier' })
            });
            fetchBookings();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const statusColor = { pending: '#fef9c3', approved: '#dcfce7', rejected: '#fef2f2' };
    const statusText = { pending: '#854d0e', approved: '#15803d', rejected: '#b91c1c' };

    return (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Corporate Bookings</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>Manage online bookings from corporate customers</p>
                </div>
                <button onClick={fetchBookings} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem' }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['pending', 'approved', 'rejected'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        style={{ padding: '7px 16px', borderRadius: 20, border: `1px solid ${filter === f ? '#D4A017' : '#e2e8f0'}`, background: filter === f ? '#FFF9EC' : '#fff', color: filter === f ? '#92400e' : '#475569', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, textTransform: 'capitalize' }}>
                        {f}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1,2,3].map(i => <div key={i} style={{ height: 100, background: '#f1f5f9', borderRadius: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
                </div>
            ) : bookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                    <Building2 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No {filter} bookings</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {bookings.map(booking => (
                        <div key={booking.id} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            <div style={{ padding: '14px 18px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                                            {booking.customerName || booking.customer?.name || 'Corporate Customer'}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                            {booking.companyName || booking.customer?.companyName || ''}
                                            {booking.vehiclePlate ? ` · ${booking.vehiclePlate}` : ''}
                                        </p>
                                        {booking.serviceRequired && (
                                            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#0369a1', fontWeight: 600 }}>
                                                Service: {booking.serviceRequired}
                                            </p>
                                        )}
                                        {booking.scheduledDate && (
                                            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                Scheduled: {new Date(booking.scheduledDate).toLocaleDateString('en-SA')}
                                            </p>
                                        )}
                                    </div>
                                    <span style={{ padding: '4px 10px', borderRadius: 20, background: statusColor[booking.status] || '#f1f5f9', color: statusText[booking.status] || '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                                        {booking.status}
                                    </span>
                                </div>

                                {booking.status === 'pending' && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => handleApprove(booking)}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#059669', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
                                            <Check size={13} /> Approve & Edit
                                        </button>
                                        <button onClick={() => handleReject(booking)}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
                                            <X size={13} /> Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
    );
}

const iconBtn = { background: 'none', border: '1px solid #e2e8f0', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#475569' };
