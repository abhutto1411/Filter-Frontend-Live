import React, { useMemo, useState } from 'react';
import {
Zap,
Bell,
X,
Wand2,
AlertTriangle,
TrendingUp,
} from 'lucide-react';
import './MarketingUniversal.css';

function formatSar(value) {
const n = Number(value);

if (!Number.isFinite(n)) return '0 SAR';

return `${n.toLocaleString(undefined, {
maximumFractionDigits: 0,
})} SAR`;
}

function formatPercent(value) {
const n = Number(value);

if (!Number.isFinite(n)) return '0.0%';

return `${n.toFixed(1)}%`;
}

const OptimizerStat = ({ label, value, tone = 'dark' }) => {
return (
<div className="mk-budget-stat-box">
<div className="mk-budget-stat-label">{label}</div>
<div className={`mk-budget-stat-value mk-budget-tone-${tone}`}>
{value}
</div>
</div>
);
};

const RecommendationRow = ({ item }) => {
return (
<div className="mk-budget-recommendation-row">
<div className="mk-budget-recommendation-left">
<div className="mk-budget-recommendation-icon">
<TrendingUp size={14} strokeWidth={2.3} />
</div>

<div>
<div className="mk-budget-recommendation-title">
{item.title}
</div>

<div className="mk-budget-recommendation-sub">
{item.subtitle}
</div>
</div>
</div>

<div className="mk-budget-recommendation-amount">
{formatSar(item.amount)}
</div>
</div>
);
};

export const BudgetOptimizer = () => {
const [walletBalance] = useState(0);
const [totalSpent] = useState(0);
const [revenue] = useState(0);
const [leads] = useState(0);
const [activeCampaigns] = useState(1);

const [budget, setBudget] = useState('');
const [showAlert, setShowAlert] = useState(true);
const [recommendations, setRecommendations] = useState([]);

const stats = useMemo(() => {
const roi = totalSpent > 0 ? ((revenue - totalSpent) / totalSpent) * 100 : 0;
const budgetUtilized =
Number(budget) > 0 ? (totalSpent / Number(budget)) * 100 : 0;
const costPerLead = leads > 0 ? totalSpent / leads : 0;

return {
roi,
budgetUtilized,
costPerLead,
};
}, [budget, totalSpent, revenue, leads]);

const handleOptimize = () => {
const value = Number(budget || walletBalance);

if (!Number.isFinite(value) || value <= 0) {
alert('Enter valid budget amount.');
return;
}

setRecommendations([
{
title: 'Meta Ads',
subtitle: 'Recommended for awareness and retargeting.',
amount: value * 0.45,
},
{
title: 'Google Ads',
subtitle: 'Recommended for high-intent leads.',
amount: value * 0.35,
},
{
title: 'Reserve Budget',
subtitle: 'Keep for testing and emergency campaign boosts.',
amount: value * 0.2,
},
]);
};

return (
<div className="mk-page mk-budget-page">
{showAlert ? (
<div className="mk-budget-alert">
<div className="mk-budget-alert-left">
<AlertTriangle size={15} strokeWidth={2} />

<div>
<div className="mk-budget-alert-title">
Wallet Balance Low
<span className="mk-budget-critical-badge">
critical
</span>
</div>

<div className="mk-budget-alert-sub">
Current: {walletBalance} / threshold: 5000
</div>
</div>
</div>

<button
type="button"
onClick={() => setShowAlert(false)}
className="mk-budget-alert-close"
>
<X size={13} strokeWidth={2.2} />
</button>
</div>
) : null}

<section className="mk-card mk-budget-card">
<div className="mk-budget-header">
<div className="mk-budget-title-wrap">
<div className="mk-budget-icon-box">
<Zap size={17} strokeWidth={2.3} />
</div>

<div>
<h3 className="mk-budget-title">
AI Predictive Budget Optimizer
</h3>

<p className="mk-budget-subtitle">
Analyzes campaign history and recommends optimal budget
allocation to maximize ROI.
</p>
</div>
</div>

<button type="button" className="mk-budget-manage-btn">
<Bell size={14} strokeWidth={2} />
Manage Alerts
<span>4</span>
</button>
</div>

<div className="mk-budget-stats-grid">
<OptimizerStat
label="Wallet"
value={formatSar(walletBalance)}
tone="red"
/>

<OptimizerStat
label="Overall ROI"
value={formatPercent(stats.roi)}
tone="green"
/>

<OptimizerStat
label="Budget Utilized"
value={formatPercent(stats.budgetUtilized)}
tone="muted"
/>

<OptimizerStat
label="Cost Per Lead"
value={formatSar(stats.costPerLead)}
tone="dark"
/>
</div>

<div className="mk-budget-form-row">
<div className="mk-budget-input-wrap">
<label className="mk-label">
Total Budget to Optimize (SAR)
</label>

<input
type="number"
value={budget}
onChange={(e) => setBudget(e.target.value)}
placeholder="e.g. 0 (wallet balance)"
className="mk-input"
/>

<div className="mk-budget-hint">
Leave blank to use wallet balance
</div>
</div>

<button
type="button"
onClick={handleOptimize}
className="mk-budget-optimize-btn"
>
<Wand2 size={15} strokeWidth={2.4} />
Optimize Budget
</button>
</div>
</section>

{recommendations.length > 0 ? (
<section className="mk-card mk-budget-recommendations-card">
<div className="mk-budget-recommendations-header">
<div>
<h3 className="mk-budget-recommendations-title">
AI Budget Recommendations
</h3>

<p className="mk-budget-recommendations-sub">
Suggested allocation based on current wallet, campaign
activity, and expected ROI.
</p>
</div>

<div className="mk-budget-active-badge">
{activeCampaigns} active campaign
</div>
</div>

<div className="mk-budget-recommendations-list">
{recommendations.map((item) => (
<RecommendationRow key={item.title} item={item} />
))}
</div>
</section>
) : null}
</div>
);
};

export default BudgetOptimizer;

