import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import './MarketingUniversal.css';

const initialRequests = [];

export const CampaignRequests = () => {
const [search, setSearch] = useState('');
const [requests] = useState(initialRequests);

const filteredRequests = useMemo(() => {
const q = search.trim().toLowerCase();

if (!q) return requests;

return requests.filter((item) => {
const text = [
item.name,
item.platform,
item.type,
item.status,
item.requestedBy,
]
.filter(Boolean)
.join(' ')
.toLowerCase();

return text.includes(q);
});
}, [requests, search]);

return (
<div className="mk-page">
<div className="mk-page-actions mk-page-actions-left">
<label className="mk-search-field">
<Search size={15} color="#94A3B8" strokeWidth={2} />

<input
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search requests..."
/>
</label>
</div>

<section className="mk-empty-card mk-empty-card-requests">
{filteredRequests.length === 0 ? (
<div className="mk-empty-card-text">
No campaign requests
</div>
) : (
<table className="mk-table">
<thead>
<tr>
<th>Campaign</th>
<th>Requested By</th>
<th>Platform</th>
<th>Type</th>
<th>Budget</th>
<th>Status</th>
<th>Actions</th>
</tr>
</thead>

<tbody>
{filteredRequests.map((item) => (
<tr key={item.id}>
<td>{item.name}</td>
<td>{item.requestedBy}</td>
<td>{item.platform}</td>
<td>{item.type}</td>
<td>{item.budget}</td>
<td>{item.status}</td>
<td>{item.actions}</td>
</tr>
))}
</tbody>
</table>
)}
</section>
</div>
);
};

export default CampaignRequests;
