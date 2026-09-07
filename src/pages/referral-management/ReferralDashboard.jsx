import React from 'react';
import { 
    TrendingUp, DollarSign, Wallet, Clock, CheckCircle, 
    UserPlus, History, Bell, ChevronRight
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
    MOCK_USER, MOCK_STATS, MOCK_TREND_DATA, 
    MOCK_NOTIFICATIONS, MOCK_REFERRALS 
} from './constants';

export default function ReferralDashboard({ onTabChange }) {
    const kpis = [
        { label: 'Total Earnings', value: `SAR ${MOCK_STATS.totalEarnings.toLocaleString()}`, icon: TrendingUp, c: 'ws-kpi-icon--green' },
        { label: 'Available Balance', value: `SAR ${MOCK_STATS.availableBalance.toLocaleString()}`, icon: Wallet, c: 'ws-kpi-icon--blue' },
        { label: 'Pending Commission', value: `SAR ${MOCK_STATS.pendingCommission.toLocaleString()}`, icon: Clock, c: 'ws-kpi-icon--yellow' },
        { label: 'Paid Commission', value: `SAR ${MOCK_STATS.paidCommission.toLocaleString()}`, icon: CheckCircle, c: 'ws-kpi-icon--blue' },
        { label: 'Total Referrals', value: MOCK_STATS.totalReferrals, icon: History, c: 'ws-kpi-icon--purple' },
    ];

    return (
        <div className="ws-dashboard">
            {/* KPI Cards */}
            <div className="ws-kpi-grid">
                {kpis.map(k => (
                    <div key={k.label} className="ws-kpi-card">
                        <div>
                            <p className="ws-kpi-label">{k.label}</p>
                            <p className="ws-kpi-value">{k.value}</p>
                        </div>
                        <div className={`ws-kpi-icon ${k.c}`}><k.icon size={22} /></div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="ws-quick-actions" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                <button 
                    className="ws-btn-primary" 
                    onClick={() => onTabChange('add_referral')}
                    style={{ background: 'var(--color-primary)', color: '#fff' }}
                >
                    <UserPlus size={18} /> <span>Add Referral</span>
                </button>
                <button 
                    className="ws-btn-secondary" 
                    onClick={() => onTabChange('wallet')}
                    style={{ background: 'var(--color-primary)', color: '#fff' }}
                >
                    <History size={18} /> <span>Request Payout</span>
                </button>
            </div>

            {/* Main Grid */}
            <div className="ws-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                {/* Chart Segment - Standard ws-card */}
                <div className="ws-card">
                    <div className="ws-card-header">
                        <h3 className="ws-card-title">Earnings Trend</h3>
                    </div>
                    <div style={{ width: '100%', height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={MOCK_TREND_DATA}>
                                <defs>
                                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.08)" />
                                <XAxis 
                                    dataKey="month" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: 'var(--color-text-muted)', fontSize: 12}} 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: 'var(--color-text-muted)', fontSize: 12}} 
                                />
                                <Tooltip 
                                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--color-primary)' }}
                                />
                                <Area type="monotone" dataKey="earnings" stroke="var(--color-primary)" fillOpacity={1} fill="url(#colorEarnings)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Notifications Segment - Standard ws-card */}
                <div className="ws-card">
                    <div className="ws-card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h3 className="ws-card-title">Recent Notifications</h3>
                        <ChevronRight size={18} style={{ color: 'var(--gold)', cursor: 'pointer' }} onClick={() => onTabChange('notifications')} />
                    </div>
                    <div className="ws-notification-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {MOCK_NOTIFICATIONS.map(n => (
                            <div key={n.id} className="ws-notification-item" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--gold)' }}>
                                <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{n.title}</p>
                                <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.4rem' }}>{n.desc}</p>
                                <p style={{ fontSize: '0.65rem', opacity: 0.4 }}>{n.date}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Referrals Table - Standard ws-card */}
            <div className="ws-card">
                <div className="ws-card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h3 className="ws-card-title">Recent Referrals</h3>
                    <button className="ws-link-btn" onClick={() => onTabChange('my_referrals')}>View All</button>
                </div>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Customer Name</th>
                            <th>Service Type</th>
                            <th>Status</th>
                            <th>Commission</th>
                        </tr>
                    </thead>
                    <tbody>
                        {MOCK_REFERRALS.slice(0, 3).map(r => (
                            <tr key={r.id}>
                                <td>{r.customerName}</td>
                                <td>{r.serviceType}</td>
                                <td>
                                    <span className={`ws-status-badge ws-status-badge--${r.status.toLowerCase() === 'converted' ? 'success' : r.status.toLowerCase() === 'pending' ? 'warning' : 'danger'}`}>
                                        {r.status}
                                    </span>
                                </td>
                                <td style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{r.commission}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
