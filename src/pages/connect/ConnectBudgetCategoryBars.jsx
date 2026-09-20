import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function sar(n) {
    return `SAR ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ConnectBudgetCategoryBars({ categories }) {
    const rows = (Array.isArray(categories) ? categories : []).map((c) => ({
        ...c,
        label: c.label || c.department,
    }));
    if (rows.length === 0) {
        return (
            <p className="cn-panel-empty">
                Assigned tasks with a budget appear here. Set the budget on the task — this chart
                compares that number to approved spend.
            </p>
        );
    }

    return (
        <div className="cn-chart-body cn-chart-body--bars">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eceff3" />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        interval={0}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={52}
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
                    <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, color: '#6b7280' }}
                    />
                    <Bar dataKey="budget" name="Budget" fill="#FFD600" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar
                        dataKey="spent"
                        name="Approved spend"
                        fill="#111418"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
