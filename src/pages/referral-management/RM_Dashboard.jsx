import React from 'react';
import { 
    Users, TrendingUp, DollarSign, Wallet, 
    ChevronRight, ArrowUpRight, TrendingDown 
} from 'lucide-react';
import { 
    MOCK_STATS, MOCK_REFERRALS, MOCK_JOURNAL_ENTRIES 
} from './RM_Constants';

const StatCard = ({ label, value, sub, icon: Icon, color }) => (
    <div className="rm-card">
        <div className="rm-kpi-header">
            <div className="rm-kpi-icon" style={{ background: `${color}15`, color: color }}>
                <Icon size={22} />
            </div>
            {sub && (
                <div style={{ fontSize: '0.7rem', background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '4px', height: 'fit-content', fontWeight: 600 }}>
                    {sub}
                </div>
            )}
        </div>
        <p className="rm-kpi-value">{typeof value === 'number' ? `SAR ${value.toLocaleString()}` : value}</p>
        <p className="rm-kpi-label">{label}</p>
    </div>
);

export default function RM_Dashboard({ onTabChange }) {
    return (
        <div className="rm-content">
            {/* KPI Grid */}
            <div className="rm-kpi-grid">
                <StatCard 
                    label="Active Referrers" 
                    value={MOCK_STATS.activeReferrers} 
                    sub="↑ 12%" 
                    icon={Users} 
                    color="var(--rm-accent-gold)" 
                />
                <StatCard 
                    label="Total Referrals" 
                    value={MOCK_STATS.totalReferrals} 
                    sub="2 pending review" 
                    icon={TrendingUp} 
                    color="#3b82f6" 
                />
                <StatCard 
                    label="Commission Expense" 
                    value={MOCK_STATS.commissionExpense} 
                    icon={TrendingDown} 
                    color="#f59e0b" 
                />
                <StatCard 
                    label="Outstanding Payable" 
                    value={MOCK_STATS.outstandingPayable} 
                    icon={DollarSign} 
                    color="#ef4444" 
                />
            </div>

            {/* Activity Split */}
            <div className="rm-activity-grid">
                {/* Recent Referrals */}
                <div className="rm-card">
                    <div className="rm-card-header">
                        <h3 className="rm-card-title">Recent Referrals</h3>
                        <button className="rm-view-all" onClick={() => onTabChange('referrals')}>
                            View all <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="rm-list">
                        {MOCK_REFERRALS.map(r => (
                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <div>
                                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.customerName}</p>
                                    <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>by {r.referrer} • {r.serviceType}</p>
                                </div>
                                <div>
                                    <span className={`rm-badge rm-badge--${r.status.toLowerCase().replace(' ', '_')}`} style={r.status === 'Approved' ? {background: '#fef9c3', color: 'var(--rm-accent-gold)'} : {}}>
                                        {r.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Journal Entries */}
                <div className="rm-card" style={{ height: 'fit-content' }}>
                    <div className="rm-card-header">
                        <h3 className="rm-card-title">Recent Journal Entries</h3>
                        <button className="rm-view-all" style={{ color: '#3b82f6' }} onClick={() => onTabChange('journal_entries')}>
                            View all <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="rm-list">
                        {MOCK_JOURNAL_ENTRIES.map(je => (
                            <div key={je.id} style={{ paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <p style={{ fontWeight: 700, fontSize: '0.85rem' }}>{je.id.toUpperCase()}</p>
                                    <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>{je.date}</p>
                                </div>
                                <p style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '6px' }}>{je.label}</p>
                                <div style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', fontWeight: 600 }}>
                                    <span style={{ color: '#ef4444' }}>DR ${je.dr}</span>
                                    <span style={{ color: 'var(--rm-accent-gold)' }}>CR ${je.cr}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
