import React, { useState, useMemo } from 'react';
import { FileBarChart2, Calendar, Download, CheckCircle2, DollarSign, TrendingUp } from 'lucide-react';
import './TechnicianDashboard.css';

const REPORT_PERIODS = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
    { id: 'range', label: 'Date Range' },
];

function formatDateLocal(d) {
    return d.toISOString().slice(0, 10);
}

export default function TechnicianReports({ orders }) {
    const now = new Date();
    const [reportPeriod, setReportPeriod] = useState('daily');
    const [reportDate, setReportDate] = useState(formatDateLocal(now));
    const [reportFrom, setReportFrom] = useState(formatDateLocal(new Date(now.getTime() - 7 * 86400000)));
    const [reportTo, setReportTo] = useState(formatDateLocal(now));

    const reportData = useMemo(() => {
        const completed = orders.filter(o => o.order_status === 'completed' || o.workflow_status === 'invoice_generated');
        const inRange = (d) => {
            const orderDate = new Date(d);
            orderDate.setHours(0, 0, 0, 0);
            if (reportPeriod === 'daily') {
                const sel = new Date(reportDate);
                sel.setHours(0, 0, 0, 0);
                return orderDate.getTime() === sel.getTime();
            }
            if (reportPeriod === 'range') {
                const from = new Date(reportFrom);
                const to = new Date(reportTo);
                from.setHours(0, 0, 0, 0);
                to.setHours(23, 59, 59, 999);
                return orderDate >= from && orderDate <= to;
            }
            if (reportPeriod === 'weekly') {
                const sel = new Date(reportDate);
                const weekStart = new Date(sel);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                return orderDate >= weekStart && orderDate <= weekEnd;
            }
            if (reportPeriod === 'monthly') {
                const parts = reportDate.split('-');
                const y = parseInt(parts[0], 10);
                const m = (parts[1] ? parseInt(parts[1], 10) : 1) - 1;
                return orderDate.getFullYear() === y && orderDate.getMonth() === m;
            }
            if (reportPeriod === 'yearly') {
                return orderDate.getFullYear() === parseInt(reportDate, 10);
            }
            return false;
        };
        const filtered = completed.filter(o => inRange(o.created_date));
        const revenue = filtered.reduce((s, o) => s + (o.grand_total || 0), 0);
        const commission = filtered.reduce((s, o) => s + (o.commission_amount || 0), 0);
        return { orders: filtered, revenue, commission, jobsCount: filtered.length };
    }, [orders, reportPeriod, reportDate, reportFrom, reportTo]);

    return (
        <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileBarChart2 size={18} style={{ color: '#7C3AED' }} /> Performance Reports
            </h3>

            <div className="tech-dash-tabs" style={{ marginBottom: 20 }}>
                {REPORT_PERIODS.map(p => (
                    <button
                        key={p.id}
                        type="button"
                        className={`tech-dash-tab ${reportPeriod === p.id ? 'active' : ''}`}
                        onClick={() => setReportPeriod(p.id)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="ws-section" style={{ marginBottom: 20, padding: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
                    {reportPeriod === 'daily' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Date</label>
                            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: '0.875rem' }} />
                        </div>
                    )}
                    {reportPeriod === 'weekly' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Week of</label>
                            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: '0.875rem' }} />
                        </div>
                    )}
                    {reportPeriod === 'monthly' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Month</label>
                            <input type="month" value={reportDate.length >= 7 ? reportDate.slice(0, 7) : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`} onChange={e => setReportDate(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: '0.875rem' }} />
                        </div>
                    )}
                    {reportPeriod === 'yearly' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Year</label>
                            <select value={/^\d{4}$/.test(reportDate) ? reportDate : String(now.getFullYear())} onChange={e => setReportDate(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: '0.875rem', minWidth: 100 }}>
                                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2, now.getFullYear() - 3].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {reportPeriod === 'range' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <Calendar size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>From</label>
                                <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: '0.875rem' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>To</label>
                                <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: '0.875rem' }} />
                            </div>
                        </div>
                    )}
                    <button type="button" className="btn-portal-outline" style={{ fontSize: '0.8125rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                        <Download size={14} /> Export
                    </button>
                </div>
            </div>

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">Jobs Completed</p><p className="ws-kpi-value">{reportData.jobsCount}</p><p className="ws-kpi-sub">In selected period</p></div><div className="ws-kpi-icon ws-kpi-icon--blue"><CheckCircle2 size={22} /></div></div>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">Revenue</p><p className="ws-kpi-value">SAR {reportData.revenue.toFixed(0)}</p><p className="ws-kpi-sub">Order value</p></div><div className="ws-kpi-icon ws-kpi-icon--green"><DollarSign size={22} /></div></div>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">Commission</p><p className="ws-kpi-value">SAR {reportData.commission.toFixed(0)}</p><p className="ws-kpi-sub">Earned</p></div><div className="ws-kpi-icon ws-kpi-icon--yellow"><TrendingUp size={22} /></div></div>
            </div>

            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 12 }}>Order Details</h4>
            {reportData.orders.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <FileBarChart2 size={48} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No orders in selected period</p>
                </div>
            ) : (
                <div className="ws-section">
                    <table className="ws-table">
                        <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Vehicle</th><th>Department</th><th>Total</th><th>Commission</th></tr></thead>
                        <tbody>
                            {reportData.orders.map(o => (
                                <tr key={o.id}>
                                    <td><strong>#{o.order_number}</strong></td>
                                    <td>{new Date(o.created_date).toLocaleDateString()}</td>
                                    <td>{o.customer_name || 'Walk-in'}</td>
                                    <td>{o.vehicle_plate || '–'}</td>
                                    <td>{o.department_name || '–'}</td>
                                    <td>SAR {(o.grand_total || 0).toFixed(2)}</td>
                                    <td style={{ color: '#16A34A', fontWeight: 600 }}>SAR {(o.commission_amount || 0).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
