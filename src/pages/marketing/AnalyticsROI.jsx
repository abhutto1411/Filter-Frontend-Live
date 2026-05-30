import React, { useMemo } from 'react';
import './MarketingUniversal.css';

const campaigns = [
{
id: 1,
name: 'National Day',
platform: 'Meta',
spent: 0,
revenue: 0,
leads: 0,
conversions: 0,
},
];

function formatSar(value) {
const n = Number(value);

if (!Number.isFinite(n)) return '0 SAR';

return `${n.toLocaleString(undefined, {
maximumFractionDigits: 0,
})} SAR`;
}

function calcRoi(spent, revenue) {
const s = Number(spent) || 0;
const r = Number(revenue) || 0;

if (s <= 0) return 0;

return ((r - s) / s) * 100;
}

function formatPercent(value) {
const n = Number(value);

if (!Number.isFinite(n)) return '0%';

return `${Math.round(n)}%`;
}

const AnalyticsStatCard = ({ title, value, color }) => {
return (
<div className="mk-analytics-stat-card">
<div className="mk-analytics-stat-title">{title}</div>
<div className="mk-analytics-stat-value" style={{ color }}>
{value}
</div>
</div>
);
};

const RoiChart = () => {
const yTicks = [0, 1, 2, 3, 4];

return (
<section className="mk-card mk-analytics-chart-card">
<h3 className="mk-card-title">ROI by Platform (%)</h3>

<div className="mk-analytics-chart-wrap">
<svg
viewBox="0 0 1000 170"
preserveAspectRatio="none"
className="mk-analytics-chart-svg"
>
{yTicks.map((tick) => {
const y = 12 + 128 - (tick / 4) * 128;

return (
<g key={tick}>
<line
x1="45"
y1={y}
x2="985"
y2={y}
className={
tick === 0
? 'mk-chart-axis-line'
: 'mk-chart-grid-line'
}
/>

<text
x="36"
y={y + 4}
textAnchor="end"
className="mk-chart-tick-text"
>
{tick}
</text>
</g>
);
})}

<line
x1="45"
y1="12"
x2="45"
y2="140"
className="mk-chart-axis-vertical"
/>

<text
x="515"
y="158"
textAnchor="middle"
className="mk-chart-label-text"
>
meta
</text>
</svg>
</div>
</section>
);
};

export const AnalyticsROI = () => {
const summary = useMemo(() => {
const totalSpent = campaigns.reduce(
(sum, item) => sum + Number(item.spent || 0),
0,
);

const totalRevenue = campaigns.reduce(
(sum, item) => sum + Number(item.revenue || 0),
0,
);

return {
totalSpent,
totalRevenue,
overallRoi: calcRoi(totalSpent, totalRevenue),
};
}, []);

return (
<div className="mk-page">
<div className="mk-analytics-stats-grid">
<AnalyticsStatCard
title="Total Spent"
value={formatSar(summary.totalSpent)}
color="#EF4444"
/>

<AnalyticsStatCard
title="Total Revenue"
value={formatSar(summary.totalRevenue)}
color="#059669"
/>

<AnalyticsStatCard
title="Overall ROI"
value={formatPercent(summary.overallRoi)}
color="#059669"
/>
</div>

<RoiChart />

<section className="mk-card mk-analytics-performance-card">
<div className="mk-analytics-performance-header">
<h3 className="mk-card-title">Campaign Performance</h3>
</div>

<table className="mk-table mk-analytics-table">
<thead>
<tr>
<th>Campaign</th>
<th>Platform</th>
<th>Spent (SAR)</th>
<th>Revenue (SAR)</th>
<th>ROI %</th>
<th>Leads</th>
<th>Conversions</th>
</tr>
</thead>

<tbody>
{campaigns.map((item) => {
const roi = calcRoi(item.spent, item.revenue);

return (
<tr key={item.id}>
<td className="mk-td-bold">{item.name}</td>
<td>{item.platform}</td>
<td>{item.spent}</td>
<td>{item.revenue}</td>
<td className="mk-td-bold">{formatPercent(roi)}</td>
<td>{item.leads}</td>
<td>{item.conversions}</td>
</tr>
);
})}
</tbody>
</table>
</section>
</div>
);
};

export default AnalyticsROI;

