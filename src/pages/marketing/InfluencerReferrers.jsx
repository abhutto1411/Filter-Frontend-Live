import React, { useMemo, useState } from 'react';
import { Star, DollarSign, TrendingUp, Search } from 'lucide-react';
import './MarketingUniversal.css';

const StatCard = ({ icon: Icon, title, value, tone = 'yellow' }) => {
return (
<div className="mk-influencer-stat-card">
<div className={`mk-influencer-stat-icon mk-influencer-icon-${tone}`}>
<Icon size={18} strokeWidth={2} />
</div>

<div>
<div className="mk-influencer-stat-title">{title}</div>
<div className="mk-influencer-stat-value">{value}</div>
</div>
</div>
);
};

export const InfluencerReferrers = () => {
const [search, setSearch] = useState('');
const [influencers] = useState([]);

const filteredInfluencers = useMemo(() => {
const q = search.trim().toLowerCase();

if (!q) return influencers;

return influencers.filter((item) => {
const text = [
item.name,
item.email,
item.phone,
item.platform,
item.status,
]
.filter(Boolean)
.join(' ')
.toLowerCase();

return text.includes(q);
});
}, [search, influencers]);

const totalInfluencers = influencers.length;

const totalCommissions = influencers.reduce(
(sum, item) => sum + Number(item.commission || 0),
0,
);

const activeCampaigns = influencers.reduce(
(sum, item) => sum + Number(item.activeCampaigns || 0),
0,
);

return (
<div className="mk-page mk-influencer-page">
<div className="mk-influencer-stats-grid">
<StatCard
icon={Star}
title="Influencers"
value={totalInfluencers}
tone="yellow"
/>

<StatCard
icon={DollarSign}
title="Total Commissions"
value={`${totalCommissions} SAR`}
tone="green"
/>

<StatCard
icon={TrendingUp}
title="Active Campaigns w / Influencers"
value={activeCampaigns}
tone="blue"
/>
</div>

<section className="mk-card mk-influencer-panel">
<div className="mk-influencer-panel-header">
<h3 className="mk-influencer-panel-title">
Influencer Referrers
</h3>

<label className="mk-influencer-search">
<Search size={14} color="#9CA3AF" strokeWidth={2} />

<input
type="text"
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search..."
/>
</label>
</div>

<div className="mk-influencer-empty">
{filteredInfluencers.length === 0
? 'No influencer referrers found'
: 'Influencer data available'}
</div>
</section>
</div>
);
};

export default InfluencerReferrers;
