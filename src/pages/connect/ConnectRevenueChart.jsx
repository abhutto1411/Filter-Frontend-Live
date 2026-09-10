import React from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

function sar(n) {
    return `SAR ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ConnectRevenueChart({ series, hasLastYear, loading }) {
    const rows = Array.isArray(series) ? series : [];
    if (loading) return <div className="cn-skeleton-rows cn-chart-skeleton" />;
    if (!rows.length) {
        return <p className="cn-panel-empty">No invoice dates in this window yet.</p>;
    }

    return (
        <div className="cn-chart-body">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="cnRevThis" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FFD600" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#FFD600" stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eceff3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    />
                    <Tooltip
                        contentStyle={{
                            background: '#fff',
                            border: '1px solid #e6e8eb',
                            borderRadius: 10,
                            fontSize: 12,
                        }}
                        formatter={(value, name) => [sar(value), name]}
                    />
                    <Area
                        type="monotone"
                        dataKey="thisYear"
                        name="This year"
                        stroke="#C9A800"
                        strokeWidth={2.2}
                        fill="url(#cnRevThis)"
                    />
                    {hasLastYear ? (
                        <Area
                            type="monotone"
                            dataKey="lastYear"
                            name="Last year"
                            stroke="#9ca3af"
                            strokeWidth={1.6}
                            strokeDasharray="5 4"
                            fill="transparent"
                        />
                    ) : null}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function ConnectSparkline({ points }) {
    const rows = Array.isArray(points) ? points : [];
    if (rows.length < 2) return null;
    return (
        <div className="cn-spark">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="cnSpark" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FFD600" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#FFD600" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#C9A800"
                        strokeWidth={1.6}
                        fill="url(#cnSpark)"
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
