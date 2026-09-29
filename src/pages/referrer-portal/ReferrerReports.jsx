import React, { useEffect, useMemo, useState } from 'react';
import { Users, Target, TrendingUp, DollarSign, FileDown, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';
import { rfT } from '../../utils/referrerPortalI18n';
import { useReferrerPortal } from './useReferrerPortal';
import { referrerPortalGetReports } from '../../services/referrerPortalApi';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';

const MIX_COLORS = { converted: '#15803d', pending: '#a16207' };
const PAGE_SIZE = 20;

function formatSar(locale, value) {
    const n = Number(value);
    const amount = Number.isFinite(n) ? n.toFixed(2) : '0.00';
    return locale === 'ar' ? `ر.س ${amount}` : `SAR ${amount}`;
}

function defaultFrom() {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

export default function ReferrerReports() {
    const { locale, isCommunity } = useReferrerPortal();
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(todayIso);
    const [data, setData] = useState(null);
    const [page, setPage] = useState(1);

    const load = (nextFrom = from, nextTo = to) => {
        referrerPortalGetReports({ from: nextFrom, to: nextTo })
            .then(setData)
            .catch(() => setData({ stats: {}, monthly: [], mix: [], orders: [] }));
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyDates = (e) => {
        e.preventDefault();
        setPage(1);
        load(from, to);
    };

    const statsObj = data?.stats || {};
    const stats = [
        { labelKey: 'reports.total', value: String(statsObj.referrals || 0), icon: Users },
        { labelKey: 'reports.converted', value: String(statsObj.converted || 0), icon: Target },
        { labelKey: 'reports.rate', value: `${statsObj.rate || 0}%`, icon: TrendingUp },
        {
            labelKey: isCommunity ? 'reports.avgDiscount' : 'reports.avg',
            value: formatSar(locale, isCommunity ? statsObj.avgDiscount : statsObj.avgCommission),
            icon: DollarSign,
        },
    ];

    const pieData = (Array.isArray(data?.mix) ? data.mix : []).map((d) => ({
        name: rfT(locale, `status.${d.key}`),
        value: d.value,
        color: MIX_COLORS[d.key] || '#94a3b8',
        key: d.key,
    }));

    const monthly = Array.isArray(data?.monthly) && data.monthly.length
        ? data.monthly
        : [{ month: '—', earnings: 0, discount: 0 }];

    const orders = Array.isArray(data?.orders) ? data.orders : [];
    const pageCount = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
    const pageRows = useMemo(
        () => orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [orders, page],
    );

    const exportRows = orders.map((o) => [
        o.invoiceNo || o.id,
        o.customerName || '',
        o.customerMobile || '',
        Number(o.invoiceTotal || 0).toFixed(2),
        Number(isCommunity ? o.discountAmount || 0 : o.commissionAmount || 0).toFixed(2),
        o.status || '',
        o.createdAt ? new Date(o.createdAt).toLocaleString() : '',
    ]);
    const headers = [
        rfT(locale, 'table.invoice'),
        rfT(locale, 'table.customer'),
        rfT(locale, 'add.mobile'),
        rfT(locale, 'table.invoiceTotal'),
        rfT(locale, isCommunity ? 'table.discount' : 'table.commission'),
        rfT(locale, 'table.status'),
        rfT(locale, 'table.date'),
    ];
    const subtitle = `${from || ''} → ${to || ''}`;

    return (
        <div className="rf-page">
            <p className="rf-page-lead">{rfT(locale, isCommunity ? 'reports.subtitleCommunity' : 'reports.subtitle')}</p>

            <form className="rf-date-filters" onSubmit={applyDates}>
                <div className="rf-form-group">
                    <label className="rf-label">{rfT(locale, 'reports.from')}</label>
                    <input className="rf-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="rf-form-group">
                    <label className="rf-label">{rfT(locale, 'reports.to')}</label>
                    <input className="rf-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <button type="submit" className="rf-btn-primary">{rfT(locale, 'reports.apply')}</button>
                <button
                    type="button"
                    className="rf-btn-outline"
                    onClick={() => exportRowsToPdf({
                        title: rfT(locale, 'title.reports'),
                        subtitle,
                        headers,
                        rows: exportRows,
                        filenameBase: 'referrer-reports',
                    })}
                    disabled={!orders.length}
                >
                    <FileDown size={16} /> {rfT(locale, 'reports.pdf')}
                </button>
                <button
                    type="button"
                    className="rf-btn-outline"
                    onClick={() => exportRowsToExcel({
                        sheetName: rfT(locale, 'title.reports'),
                        headers,
                        rows: exportRows,
                        filenameBase: 'referrer-reports',
                    })}
                    disabled={!orders.length}
                >
                    <FileSpreadsheet size={16} /> {rfT(locale, 'reports.excel')}
                </button>
            </form>

            <div className="rf-stats-grid rf-stats-grid-4">
                {stats.map((stat) => (
                    <div key={stat.labelKey} className="rf-stat-card">
                        <div className="rf-stat-header">
                            <div className="rf-stat-icon">
                                <stat.icon size={20} />
                            </div>
                        </div>
                        <p className="rf-stat-value">{stat.value}</p>
                        <p className="rf-stat-label">{rfT(locale, stat.labelKey)}</p>
                    </div>
                ))}
            </div>

            <div className="rf-split-grid">
                <div className="rf-card">
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">{rfT(locale, isCommunity ? 'reports.monthlyDiscount' : 'reports.monthly')}</h3>
                    </div>
                    <div className="rf-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthly}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-premium)' }} />
                                <Bar dataKey={isCommunity ? 'discount' : 'earnings'} fill="var(--color-primary)" radius={[6, 6, 0, 0]} barSize={36} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rf-card">
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">{rfT(locale, 'reports.mix')}</h3>
                    </div>
                    <div className="rf-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData.length ? pieData : [{ name: '—', value: 1, color: '#e5e7eb', key: 'empty' }]}
                                    innerRadius={62}
                                    outerRadius={84}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {(pieData.length ? pieData : [{ color: '#e5e7eb', key: 'empty' }]).map((entry) => (
                                        <Cell key={entry.key} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-premium)' }} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="rf-card">
                <div className="rf-card-header">
                    <h3 className="rf-card-title">{rfT(locale, 'reports.orders')}</h3>
                </div>
                <div className="rf-table-container">
                    <table className="rf-table">
                        <thead>
                            <tr>
                                <th>{rfT(locale, 'table.invoice')}</th>
                                <th>{rfT(locale, 'table.customer')}</th>
                                <th className="rf-num">{rfT(locale, 'table.invoiceTotal')}</th>
                                <th className="rf-num">{rfT(locale, isCommunity ? 'table.discount' : 'table.commission')}</th>
                                <th>{rfT(locale, 'table.date')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="rf-empty">{rfT(locale, 'reports.noOrders')}</td>
                                </tr>
                            ) : pageRows.map((o) => (
                                <tr key={o.id}>
                                    <td className="rf-name">{o.invoiceNo || o.id}</td>
                                    <td>
                                        <div className="rf-name">{o.customerName}</div>
                                        <div className="rf-muted">{o.customerMobile}</div>
                                    </td>
                                    <td className="rf-num">{formatSar(locale, o.invoiceTotal)}</td>
                                    <td className="rf-num">{formatSar(locale, isCommunity ? o.discountAmount : o.commissionAmount)}</td>
                                    <td className="rf-muted">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {orders.length > PAGE_SIZE ? (
                    <div className="rf-form-actions" style={{ marginTop: 12 }}>
                        <button type="button" className="rf-btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            <ChevronLeft size={16} />
                        </button>
                        <span className="rf-muted">{page} / {pageCount}</span>
                        <button type="button" className="rf-btn-outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
