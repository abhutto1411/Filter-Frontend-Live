import React, { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import './MarketingUniversal.css';

const customers = [];

function formatSar(value) {
const n = Number(value);

if (!Number.isFinite(n)) return 'SAR 0';

return `SAR ${n.toLocaleString(undefined, {
maximumFractionDigits: 0,
})}`;
}

const StatCard = ({ title, value, sub, tone }) => {
return (
<div className={`ci-stat-card ci-stat-${tone}`}>
<div className="ci-stat-title">{title}</div>
<div className="ci-stat-value">{value}</div>
<div className="ci-stat-sub">{sub}</div>
</div>
);
};

const GrowthChart = () => {
const width = 1000;
const height = 170;
const left = 45;
const right = 16;
const top = 10;
const bottom = 28;

const chartW = width - left - right;
const chartH = height - top - bottom;

const yTicks = [0, 1, 2, 3, 4];
const months = ['Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26'];

return (
<section className="ci-card ci-chart-card">
<h3 className="ci-section-title">New Customer Growth — Last 6 Months</h3>

<svg
viewBox={`0 0 ${width} ${height}`}
preserveAspectRatio="none"
className="ci-chart-svg"
>
{yTicks.map((tick) => {
const y = top + chartH - (tick / 4) * chartH;

return (
<g key={tick}>
<line
x1={left}
y1={y}
x2={width - right}
y2={y}
className={tick === 0 ? 'ci-axis-line' : 'ci-grid-line'}
/>

<text
x={left - 8}
y={y + 4}
textAnchor="end"
className="ci-chart-text"
>
{tick}
</text>
</g>
);
})}

<line
x1={left}
y1={top}
x2={left}
y2={top + chartH}
className="ci-axis-line"
/>

{months.map((month, index) => {
const x = left + (index / Math.max(months.length - 1, 1)) * chartW;

return (
<text
key={month}
x={x}
y={height - 10}
textAnchor="middle"
className="ci-chart-text"
>
{month}
</text>
);
})}
</svg>
</section>
);
};

export const CustomerInsights = () => {
const [search, setSearch] = useState('');
const [sortBy, setSortBy] = useState('revenue');

const filteredCustomers = useMemo(() => {
const q = search.trim().toLowerCase();

let rows = [...customers];

if (q) {
rows = rows.filter((customer) => {
const text = [
customer.name,
customer.phone,
customer.email,
customer.type,
]
.filter(Boolean)
.join(' ')
.toLowerCase();

return text.includes(q);
});
}

if (sortBy === 'revenue') {
rows.sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
}

if (sortBy === 'newest') {
rows.sort(
(a, b) =>
new Date(b.createdAt || 0).getTime() -
new Date(a.createdAt || 0).getTime(),
);
}

if (sortBy === 'visits') {
rows.sort((a, b) => Number(b.visits || 0) - Number(a.visits || 0));
}

return rows;
}, [search, sortBy]);

const stats = useMemo(() => {
const totalCustomers = customers.length;

const returningCustomers = customers.filter(
(item) => Number(item.visits || 0) > 1,
).length;

const newThisMonth = customers.filter((item) => {
if (!item.createdAt) return false;

const created = new Date(item.createdAt);
const now = new Date();

return (
created.getMonth() === now.getMonth() &&
created.getFullYear() === now.getFullYear()
);
}).length;

const totalRevenue = customers.reduce(
(sum, item) => sum + Number(item.revenue || 0),
0,
);

const avgSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

const retention =
totalCustomers > 0
? Math.round((returningCustomers / totalCustomers) * 100)
: 0;

return {
totalCustomers,
returningCustomers,
newThisMonth,
avgSpend,
retention,
};
}, []);

return (
<div className="ci-page">
<div className="ci-stats-grid">
<StatCard
title="Total Customers"
value={stats.totalCustomers}
sub="+0 this month"
tone="pink"
/>

<StatCard
title="Returning Customers"
value={stats.returningCustomers}
sub={`${stats.retention}% retention`}
tone="purple"
/>

<StatCard
title="New This Month"
value={stats.newThisMonth}
sub="vs last month"
tone="indigo"
/>

<StatCard
title="Avg. Spend / Customer"
value={formatSar(stats.avgSpend)}
sub="All time"
tone="teal"
/>
</div>

<GrowthChart />

<section className="ci-card ci-customers-card">
<div className="ci-customers-header">
<h3 className="ci-section-title">All Customers</h3>

<div className="ci-filters-wrap">
<label className="ci-search-box">
<Search size={13} color="#9CA3AF" />

<input
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search..."
/>
</label>

<select
value={sortBy}
onChange={(e) => setSortBy(e.target.value)}
className="ci-sort-select"
>
<option value="revenue">By Revenue</option>
<option value="newest">Newest</option>
<option value="visits">Most Visits</option>
</select>
</div>
</div>

{filteredCustomers.length === 0 ? (
<div className="ci-empty-state">
<Users size={38} color="#CBD5E1" strokeWidth={1.8} />
<div className="ci-empty-text">No customers found</div>
</div>
) : (
<div className="ci-table-wrap">
<table className="ci-table">
<thead>
<tr>
<th>Customer</th>
<th>Phone</th>
<th>Visits</th>
<th>Revenue</th>
<th>Last Visit</th>
</tr>
</thead>

<tbody>
{filteredCustomers.map((customer, index) => (
<tr key={customer.id || index}>
<td className="ci-td-strong">{customer.name}</td>
<td>{customer.phone || '-'}</td>
<td>{customer.visits || 0}</td>
<td>{formatSar(customer.revenue || 0)}</td>
<td>{customer.lastVisit || '-'}</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</section>
</div>
);
};

export default CustomerInsights;
