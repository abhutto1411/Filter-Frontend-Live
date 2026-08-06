import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Plus, CreditCard, Bell, ChevronRight, TrendingUp
} from 'lucide-react';
import { 
    MOCK_STATS, MOCK_REFERRALS, MOCK_NOTIFICATIONS, CHART_DATA 
} from './ReferrerConstants';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import PayoutModal from '../../components/PayoutModal';

export default function ReferrerDashboard() {
    const navigate = useNavigate();
    const [isPayoutModalOpen, setIsPayoutModalOpen] = React.useState(false);

    return (
        <div className="rf-dashboard">
            <PayoutModal 
                isOpen={isPayoutModalOpen} 
                onClose={() => setIsPayoutModalOpen(false)} 
                balance="12,300" 
            />
            <header className="rf-header">
                <div className="rf-welcome">
                    <h1>Welcome back, Taha!</h1>
                    <p>FR-001 • Franchise</p>
                </div>
            </header>

            <div className="rf-stats-grid">
                {MOCK_STATS.map((stat, idx) => (
                    <div key={idx} className="rf-stat-card">
                        <div className="rf-stat-header">
                            <div className="rf-stat-icon">
                                <stat.icon size={20} />
                            </div>
                            {stat.unit && <span className="rf-stat-unit">{stat.unit}</span>}
                        </div>
                        <div className="rf-stat-info">
                            <p className="rf-stat-value">{stat.value}</p>
                            <p className="rf-stat-label">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rf-actions-bar">
                <button 
                    className="rf-btn-primary"
                    onClick={() => navigate('/referrer-portal/add_referral')}
                >
                    <Plus size={18} />
                    Add Referral
                </button>
                <button 
                    className="rf-btn-outline"
                    onClick={() => setIsPayoutModalOpen(true)}
                >
                    <CreditCard size={18} />
                    Request Payout
                </button>
            </div>

            <div className="rf-split-grid">
                <div className="rf-card">
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">Earnings Trend</h3>
                    </div>
                    <div className="rf-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={CHART_DATA}>
                                <defs>
                                    <linearGradient id="colorGold" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 12, fill: 'var(--color-text-faint)'}}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 12, fill: 'var(--color-text-faint)'}}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-premium)' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="earnings" 
                                    stroke="var(--color-primary)" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorGold)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rf-card" onClick={() => navigate('/referrer-portal/notifications')} style={{ cursor: 'pointer' }}>
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">Recent Notifications</h3>
                        <ChevronRight size={18} className="rf-icon-dim" />
                    </div>
                    <div className="rf-notif-list">
                        {MOCK_NOTIFICATIONS.map((notif, idx) => (
                            <div key={idx} className="rf-notif-item">
                                <p className="rf-notif-title">{notif.title}</p>
                                <p className="rf-notif-text">{notif.text}</p>
                                <p className="rf-notif-date">{notif.date}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="rf-card" onClick={() => navigate('/referrer-portal/my_referrals')} style={{ cursor: 'pointer' }}>
                <div className="rf-card-header">
                    <h3 className="rf-card-title">Recent Referrals</h3>
                    <ChevronRight size={18} className="rf-icon-dim" />
                </div>
                <div className="rf-table-container">
                    <table className="rf-table">
                        <thead>
                            <tr>
                                <th>Customer Name</th>
                                <th>Service Type</th>
                                <th>Status</th>
                                <th>Commission</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_REFERRALS.slice(0, 4).map((ref, idx) => (
                                <tr key={idx}>
                                    <td style={{ fontWeight: 600 }}>{ref.name}</td>
                                    <td>{ref.service}</td>
                                    <td>
                                        <span className={`rf-badge rf-badge-${ref.status.toLowerCase()}`}>
                                            {ref.status}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 700 }}>{ref.commission}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
