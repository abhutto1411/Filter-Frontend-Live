import { useState, useEffect, useCallback } from 'react';
import { Calendar, Tag, Car, FileText, AlertTriangle, ArrowRight, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

const FALLBACK_BANNER = { text: 'Welcome to Filter OS Corporate Portal', gradient: 'linear-gradient(135deg,#2563EB,#1D4ED8)' };

export default function CorporateDashboard({ onTabChange, setBookingOpen, setQuoteOpen }) {
    const [dashboard, setDashboard] = useState(null);
    const [banners, setBanners] = useState([FALLBACK_BANNER]);
    const [bannerIdx, setBannerIdx] = useState(0);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadDashboard = useCallback(() => {
        setLoading(true);
        Promise.all([
            apiFetch('/corporate/dashboard').catch(() => null),
            apiFetch('/corporate/banners').catch(() => null),
            apiFetch('/corporate/bookings?limit=5&offset=0').catch(() => null),
        ]).then(([dash, bannersData, ordersData]) => {
            if (dash) setDashboard(dash);
            const b = bannersData?.banners || bannersData?.data;
            if (b?.length) setBanners(b);
            const list = ordersData?.bookings || ordersData?.orders || ordersData?.data?.bookings;
            if (Array.isArray(list)) setRecentOrders(list);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    useEffect(() => {
        const onSocket = () => loadDashboard();
        window.addEventListener('corporate-portal-dashboard-refresh', onSocket);
        window.addEventListener('corporate-portal-bookings-refresh', onSocket);
        return () => {
            window.removeEventListener('corporate-portal-dashboard-refresh', onSocket);
            window.removeEventListener('corporate-portal-bookings-refresh', onSocket);
        };
    }, [loadDashboard]);

    useEffect(() => {
        if (banners.length <= 1) return;
        const t = setInterval(() => setBannerIdx(i => (i + 1) % banners.length), 4000);
        return () => clearInterval(t);
    }, [banners.length]);

    const STATUS_BADGE = {
        pending: 'ws-badge--yellow',
        paid: 'ws-badge--green',
        completed: 'ws-badge--green',
        in_progress: 'ws-badge--blue',
        submitted: 'ws-badge--blue',
        confirmed: 'ws-badge--blue',
        cancelled: 'ws-badge--red',
        draft: 'ws-badge--gray',
        approved: 'ws-badge--green',
        rejected: 'ws-badge--red',
        invoiced: 'ws-badge--green',
        corporate_approved: 'ws-badge--green',
        waiting_for_corporate_approval: 'ws-badge--yellow',
        rejected_by_corporate: 'ws-badge--red',
    };

    const walletBal = dashboard?.walletBalance ?? dashboard?.wallet_balance ?? 0;
    const totalOutstanding = dashboard?.outstandingBalance ?? dashboard?.outstanding_balance ?? dashboard?.dueBalance ?? 0;
    const thisMonth = dashboard?.thisMonthOrders ?? dashboard?.bookingsThisMonth ?? dashboard?.monthlyOrders ?? '—';
    const completed = dashboard?.completedOrders ?? dashboard?.completed ?? 0;
    const totalSpent = dashboard?.totalSpent ?? dashboard?.total_spent ?? 0;
    const monthDue = dashboard?.currentBillAmount ?? dashboard?.monthlyDue ?? dashboard?.currentBill?.totalAmount ?? 0;
    const billStatus = dashboard?.currentBillStatus ?? dashboard?.billStatus ?? dashboard?.currentBill?.status ?? 'No bill';

    const kpis = [
        { label: 'Bookings This Month', value: loading ? '…' : thisMonth, sub: `${completed} total completed`, color: '#2563EB' },
        { label: 'This Month Due', value: loading ? '…' : `SAR ${Number(monthDue).toLocaleString()}`, sub: billStatus, color: '#D97706' },
        { label: 'Total Spent', value: loading ? '…' : `SAR ${totalSpent >= 1000 ? (totalSpent / 1000).toFixed(1) + 'K' : Number(totalSpent).toFixed(0)}`, sub: 'All time', color: '#059669' },
        { label: 'Wallet Balance', value: loading ? '…' : `SAR ${Number(walletBal).toLocaleString()}`, sub: 'Top-up Now', subAction: () => onTabChange('wallet'), color: '#7C3AED' },
    ];

    const banner = banners[bannerIdx] || FALLBACK_BANNER;

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Corporate Dashboard</h2><p className="ws-page-sub">Fleet & corporate account overview</p></div>
            </div>

            {!loading && totalOutstanding > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 14, background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AlertTriangle size={20} style={{ color: '#D97706', flexShrink: 0 }}/>
                        <div>
                            <p style={{ fontWeight: 600, color: '#92400E', margin: 0 }}>Outstanding Balance: SAR {Number(totalOutstanding).toFixed(2)}</p>
                            <p style={{ fontSize: '0.75rem', color: '#B45309', margin: '2px 0 0 0' }}>Please settle your pending invoices</p>
                        </div>
                    </div>
                    <button className="btn-portal" style={{ background: '#D97706', color: '#fff', border: 'none' }} onClick={() => onTabChange('billing')}>
                        Pay Now <ArrowRight size={14} style={{ marginLeft: 4 }}/>
                    </button>
                </div>
            )}

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 20 }}>
                {kpis.map(k => (
                    <div key={k.label} className="ws-kpi-card">
                        <div>
                            <p className="ws-kpi-label">{k.label}</p>
                            <p className="ws-kpi-value" style={{ color: k.color }}>{k.value}</p>
                            {k.subAction ? (
                                <button onClick={k.subAction} style={{ fontSize: '0.75rem', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: 4 }}>{k.sub}</button>
                            ) : (
                                <p className="ws-kpi-sub">{k.sub}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ borderRadius: 16, background: banner.gradient || banner.backgroundColor || 'linear-gradient(135deg,#2563EB,#1D4ED8)', color: '#fff', padding: '16px 24px', marginBottom: 20, transition: 'background 0.3s' }}>
                <p style={{ fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>{banner.text || banner.title || banner.message || 'Welcome to Filter OS'}</p>
                {banners.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        {banners.map((_, i) => (
                            <button key={i} type="button" onClick={() => setBannerIdx(i)} style={{ width: 6, height: 6, borderRadius: '50%', border: 'none', background: i === bannerIdx ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}/>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'New Booking', Icon: Calendar, bg: '#059669', hover: '#047857', action: () => setBookingOpen(true) },
                    { label: 'Price Quotation', Icon: Tag, bg: '#7C3AED', hover: '#6D28D9', action: () => setQuoteOpen(true) },
                    { label: 'My Vehicles', Icon: Car, bg: '#2563EB', hover: '#1D4ED8', action: () => onTabChange('vehicles') },
                    { label: 'Monthly Billing', Icon: FileText, bg: '#EA580C', hover: '#C2410C', action: () => onTabChange('billing') },
                ].map(a => (
                    <button key={a.label} type="button" onClick={a.action}
                        style={{ background: a.bg, color: '#fff', padding: 16, borderRadius: 14, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                        onMouseOver={e => { e.currentTarget.style.background = a.hover; }}
                        onMouseOut={e => { e.currentTarget.style.background = a.bg; }}>
                        <a.Icon size={24}/>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{a.label}</span>
                    </button>
                ))}
            </div>

            <div className="ws-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border-light)' }}>
                    <p style={{ fontWeight: 700, color: 'var(--color-text-dark)', margin: 0 }}>Recent Bookings</p>
                    <button onClick={() => onTabChange('bookings')} style={{ fontSize: '0.75rem', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>View all <ChevronRight size={14}/></button>
                </div>
                <div>
                    {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Loader2 className="spin" size={24} style={{ color: 'var(--color-primary)' }}/></div>}
                    {!loading && recentOrders.length === 0 && <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', padding: 32, margin: 0 }}>No orders yet</p>}
                    {recentOrders.slice(0, 5).map((o, i) => {
                        const statusRaw = o.status || o.orderStatus || o.order_status || 'pending';
                        const statusKey = String(statusRaw).toLowerCase().replace(/\s+/g, '_');
                        return (
                            <div
                                key={o.bookingId || `${o.bookingType || 'booking'}-${o.id}`}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < Math.min(5, recentOrders.length) - 1 ? '1px solid var(--color-border-light)' : 'none' }}
                            >
                                <div>
                                    <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>
                                        {o.bookingCode ||
                                            o.booking_code ||
                                            o.orderNumber ||
                                            o.order_number ||
                                            o.bookingId ||
                                            `#${o.id}`}
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                        {o.bookedFor || o.booked_for || o.createdAt ? new Date(o.bookedFor || o.booked_for || o.createdAt).toLocaleDateString('en-SA') : '—'}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>
                                        {(o.amount ?? o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total) != null
                                            ? `SAR ${Number(o.amount ?? o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total).toFixed(2)}`
                                            : 'Pending'}
                                    </p>
                                    <span className={`ws-badge ${STATUS_BADGE[statusKey] || 'ws-badge--yellow'}`}>
                                        {String(statusRaw).replace(/_/g, ' ')}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
