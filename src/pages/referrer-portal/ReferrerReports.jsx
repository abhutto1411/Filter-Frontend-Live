import React from 'react';
import { 
    Users, Target, TrendingUp, DollarSign 
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

const STATS = [
    { label: 'Total Referrals', value: '6', icon: Users, color: '#3b82f6' },
    { label: 'Successful Conversions', value: '3', icon: Target, color: '#10b981' },
    { label: 'Conversion Rate', value: '50%', icon: TrendingUp, color: '#8b5cf6' },
    { label: 'Average Commission', value: '3,233 SAR', icon: DollarSign, color: '#f59e0b' },
];

const MONTHLY_DATA = [
    { name: 'Oct', earnings: 8200 },
    { name: 'Nov', earnings: 12500 },
    { name: 'Dec', earnings: 9800 },
    { name: 'Jan', earnings: 15800 },
    { name: 'Feb', earnings: 11200 },
    { name: 'Mar', earnings: 14700 },
];

const CONVERSION_DATA = [
    { name: 'Converted', value: 3, color: '#10b981' },
    { name: 'Pending', value: 2, color: '#f59e0b' },
    { name: 'Rejected', value: 1, color: '#ef4444' },
];

export default function ReferrerReports() {
    return (
        <div className="rf-content">
            <header className="rf-header">
                <div className="rf-welcome">
                    <h1>Reports & Analytics</h1>
                    <p>Detailed performance metrics and conversion data.</p>
                </div>
            </header>

            <div className="rf-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2.5rem' }}>
                {STATS.map((stat, idx) => (
                    <div key={idx} className="rf-stat-card">
                        <div className="rf-stat-header">
                            <div className="rf-stat-icon" style={{ background: `${stat.color}15`, color: stat.color }}>
                                <stat.icon size={20} />
                            </div>
                        </div>
                        <div className="rf-stat-info">
                            <p className="rf-stat-value">{stat.value}</p>
                            <p className="rf-stat-label">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rf-split-grid">
                <div className="rf-card">
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">Monthly Earnings</h3>
                    </div>
                    <div className="rf-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={MONTHLY_DATA}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6B7280'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6B7280'}} />
                                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-premium)'}} />
                                <Bar dataKey="earnings" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rf-card">
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">Conversion Rate</h3>
                    </div>
                    <div className="rf-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={CONVERSION_DATA}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {CONVERSION_DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-premium)'}} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
