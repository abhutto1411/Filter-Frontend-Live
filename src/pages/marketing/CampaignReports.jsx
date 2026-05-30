import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
CalendarDays,
Bot,
Download,
RefreshCw,
TrendingUp,
Table2,
} from 'lucide-react';
import { marketingListPromotions } from '../../services/superAdminMarketingApi';
import './MarketingUniversal.css';

function normalizeCampaigns(payload) {
const rows = Array.isArray(payload)
? payload
: Array.isArray(payload?.promotions)
? payload.promotions
: Array.isArray(payload?.campaigns)
? payload.campaigns
: Array.isArray(payload?.items)
? payload.items
: Array.isArray(payload?.data)
? payload.data
: Array.isArray(payload?.data?.promotions)
? payload.data.promotions
: Array.isArray(payload?.data?.campaigns)
? payload.data.campaigns
: Array.isArray(payload?.data?.items)
? payload.data.items
: [];

return rows.map((item) => ({
id: item.id ?? item._id ?? item.campaignId ?? item.promotionId ?? item.name,
name: item.name ?? item.title ?? item.campaignName ?? 'National Day',
platform: item.platform ?? item.adPlatform ?? 'Meta',
budget: Number(item.budget ?? item.totalBudget ?? item.marketingBudget ?? 5000) || 0,
spent: Number(item.spent ?? item.totalSpent ?? item.expenseAmount ?? 0) || 0,
revenue: Number(item.revenue ?? item.totalRevenue ?? item.revenueGenerated ?? 0) || 0,
impressions: Number(item.impressions ?? item.totalImpressions ?? 0) || 0,
clicks: Number(item.clicks ?? item.totalClicks ?? 0) || 0,
leads: Number(item.leads ?? item.totalLeads ?? 0) || 0,
conversions: Number(item.conversions ?? item.totalConversions ?? 0) || 0,
status: item.status ?? 'active',
}));
}

function formatSar(value) {
const n = Number(value);

if (!Number.isFinite(n)) return '0 SAR';

return `${n.toLocaleString(undefined, {
maximumFractionDigits: 0,
})} SAR`;
}

function calcPercent(part, total) {
const p = Number(part) || 0;
const t = Number(total) || 0;

if (t <= 0) return 0;

return (p / t) * 100;
}

function formatPercent(value) {
const n = Number(value);

if (!Number.isFinite(n)) return '0%';

return `${Math.round(n)}%`;
}

const SelectField = ({ label, value, onChange, options }) => {
return (
<div className="mk-report-filter">
<label className="mk-report-filter-label">{label}</label>

<select
className="mk-input mk-report-select"
value={value}
onChange={(e) => onChange(e.target.value)}
>
{options.map((option) => (
<option key={option.value} value={option.value}>
{option.label}
</option>
))}
</select>
</div>
);
};

const MetricCard = ({ title, value, sub, tone = 'dark' }) => {
return (
<div className="mk-report-metric-card">
<div className="mk-report-metric-title">{title}</div>
<div className={`mk-report-metric-value mk-report-tone-${tone}`}>
{value}
</div>
<div className="mk-report-metric-sub">{sub}</div>
</div>
);
};

const ReportIconButton = ({ active, title, children }) => {
return (
<button
type="button"
className={active ? 'mk-report-icon-btn active' : 'mk-report-icon-btn'}
title={title}
>
{children}
</button>
);
};

const PerformanceChart = ({ campaigns }) => {
const width = 1000;
const height = 170;
const left = 38;
const right = 14;
const top = 12;
const bottom = 30;
const chartW = width - left - right;
const chartH = height - top - bottom;

const selectedCampaign = campaigns[0]?.name || 'National Day';
const ticks = [0, 1, 2, 3, 4];

return (
<section className="mk-card mk-report-chart-card">
<div className="mk-report-chart-header">
<h3 className="mk-report-section-title">Performance Visualization</h3>

<div className="mk-report-icon-actions">
<ReportIconButton active title="Download">
<Download size={13} />
</ReportIconButton>

<ReportIconButton title="Refresh">
<RefreshCw size={13} />
</ReportIconButton>

<ReportIconButton title="Trend">
<TrendingUp size={13} />
</ReportIconButton>

<ReportIconButton title="Table">
<Table2 size={13} />
</ReportIconButton>
</div>
</div>

<svg
viewBox={`0 0 ${width} ${height}`}
preserveAspectRatio="none"
className="mk-report-chart-svg"
>
{ticks.map((tick) => {
const y = top + chartH - (tick / 4) * chartH;

return (
<g key={tick}>
<line
x1={left}
y1={y}
x2={width - right}
y2={y}
className={
tick === 0
? 'mk-report-axis-line'
: 'mk-report-grid-line'
}
/>

<text
x={left - 8}
y={y + 4}
textAnchor="end"
className="mk-report-chart-text"
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
className="mk-report-axis-vertical"
/>

<text
x={left + chartW / 2}
y={height - 16}
textAnchor="middle"
className="mk-report-chart-text"
>
{selectedCampaign}
</text>

<rect
x={left + chartW / 2 - 63}
y={height - 1}
width="8"
height="8"
className="mk-report-legend-spent"
/>

<text
x={left + chartW / 2 - 52}
y={height + 6}
className="mk-report-legend-text spent"
>
Spent
</text>

<rect
x={left + chartW / 2 - 20}
y={height - 1}
width="8"
height="8"
className="mk-report-legend-revenue"
/>

<text
x={left + chartW / 2 - 9}
y={height + 6}
className="mk-report-legend-text revenue"
>
Revenue
</text>
</svg>
</section>
);
};

export const CampaignReports = () => {
const ctx = useOutletContext() || {};
const marketingWorkshopId = ctx.marketingWorkshopId ?? '';

const [campaigns, setCampaigns] = useState([]);
const [loading, setLoading] = useState(false);
const [loadError, setLoadError] = useState('');

const [campaignFilter, setCampaignFilter] = useState('all');
const [period, setPeriod] = useState('all');
const [compareTo, setCompareTo] = useState('none');
const [scheduleOn, setScheduleOn] = useState(false);

const loadReports = useCallback(async () => {
setLoading(true);
setLoadError('');

try {
const res = await marketingListPromotions({
...(marketingWorkshopId ? { workshopId: marketingWorkshopId } : {}),
status: 'all',
limit: 100,
offset: 0,
});

setCampaigns(normalizeCampaigns(res));
} catch (e) {
const fallback = Array.isArray(ctx.promotions)
? normalizeCampaigns(ctx.promotions)
: [];

setCampaigns(fallback);
setLoadError(e?.message || '');
} finally {
setLoading(false);
}
}, [marketingWorkshopId, ctx.promotions]);

useEffect(() => {
loadReports();
}, [loadReports]);

const filteredCampaigns = useMemo(() => {
if (campaignFilter === 'all') return campaigns;

return campaigns.filter((item) => String(item.id) === String(campaignFilter));
}, [campaigns, campaignFilter]);

const summary = useMemo(() => {
const budget = filteredCampaigns.reduce(
(sum, item) => sum + Number(item.budget || 0),
0,
);

const spent = filteredCampaigns.reduce(
(sum, item) => sum + Number(item.spent || 0),
0,
);

const revenue = filteredCampaigns.reduce(
(sum, item) => sum + Number(item.revenue || 0),
0,
);

const impressions = filteredCampaigns.reduce(
(sum, item) => sum + Number(item.impressions || 0),
0,
);

const clicks = filteredCampaigns.reduce(
(sum, item) => sum + Number(item.clicks || 0),
0,
);

const leads = filteredCampaigns.reduce(
(sum, item) => sum + Number(item.leads || 0),
0,
);

const conversions = filteredCampaigns.reduce(
(sum, item) => sum + Number(item.conversions || 0),
0,
);

return {
budget,
spent,
revenue,
impressions,
clicks,
leads,
conversions,
ctr: calcPercent(clicks, impressions),
costPerLead: leads > 0 ? spent / leads : 0,
conversionRate: calcPercent(conversions, leads),
};
}, [filteredCampaigns]);

const campaignOptions = useMemo(() => {
return [
{ value: 'all', label: 'All Campaigns' },
...campaigns.map((item) => ({
value: String(item.id),
label: item.name,
})),
];
}, [campaigns]);

return (
<div className="mk-page mk-report-page">
<section className="mk-card mk-report-config-card">
<div className="mk-report-config-header">
<h3 className="mk-report-section-title">Report Configuration</h3>

<span className="mk-report-scope-badge">
{filteredCampaigns.length || 1} campaigns in scope
</span>
</div>

<div className="mk-report-config-grid">
<SelectField
label="Campaign"
value={campaignFilter}
onChange={setCampaignFilter}
options={campaignOptions}
/>

<SelectField
label="Period"
value={period}
onChange={setPeriod}
options={[
{ value: 'all', label: 'All Time' },
{ value: 'today', label: 'Today' },
{ value: 'week', label: 'This Week' },
{ value: 'month', label: 'This Month' },
]}
/>

<SelectField
label="Compare To"
value={compareTo}
onChange={setCompareTo}
options={[
{ value: 'none', label: 'No Comparison' },
{ value: 'previous_period', label: 'Previous Period' },
{ value: 'last_month', label: 'Last Month' },
]}
/>

<button type="button" className="mk-report-ai-btn">
<Bot size={14} />
AI Report
</button>
</div>
</section>

{loadError ? (
<div className="mk-field-error mk-report-load-error">
{loadError}
</div>
) : null}

{loading ? (
<div className="mk-report-loading">Loading report...</div>
) : null}

<div className="mk-report-metrics-grid">
<MetricCard
title="Budget Allocated"
value={formatSar(summary.budget)}
sub={`${formatPercent(calcPercent(summary.spent, summary.budget))} utilized`}
tone="dark"
/>

<MetricCard
title="Total Spent"
value={formatSar(summary.spent)}
sub="Marketing spend"
tone="red"
/>

<MetricCard
title="Revenue"
value={formatSar(summary.revenue)}
sub="ROI: 0%"
tone="green"
/>

<MetricCard
title="Leads"
value={summary.leads}
sub={`${summary.conversions} conversions`}
tone="blue"
/>

<MetricCard
title="Impressions"
value={summary.impressions}
sub={`CTR: ${formatPercent(summary.ctr)}`}
tone="purple"
/>

<MetricCard
title="Clicks"
value={summary.clicks}
sub="Total ad clicks"
tone="yellow"
/>

<MetricCard
title="Cost Per Lead"
value={formatSar(summary.costPerLead)}
sub="Acquisition cost"
tone="orange"
/>

<MetricCard
title="Conv. Rate"
value={formatPercent(summary.conversionRate)}
sub={`${filteredCampaigns.length} active campaigns`}
tone="green"
/>
</div>

<PerformanceChart
campaigns={filteredCampaigns.length ? filteredCampaigns : campaigns}
/>

<section className="mk-card mk-report-schedule-card">
<div className="mk-report-schedule-header">
<CalendarDays size={14} color="#D5AD27" />

<h3 className="mk-report-section-title">Scheduled Report Delivery</h3>

<span className="mk-report-off-badge">Off</span>
</div>

<div className="mk-report-schedule-row">
<button
type="button"
onClick={() => setScheduleOn((prev) => !prev)}
className={scheduleOn ? 'mk-report-toggle on' : 'mk-report-toggle'}
>
<span />
</button>

<span className="mk-report-schedule-text">
Auto-generate &amp; email report
</span>

<button type="button" className="mk-report-save-btn">
Save Schedule
</button>
</div>
</section>
</div>
);
};

export default CampaignReports;
