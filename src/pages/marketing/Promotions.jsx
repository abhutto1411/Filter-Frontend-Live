import React, { useMemo, useState } from 'react';
import {
Search,
Plus,
X,
ChevronDown,
Pencil,
BarChart3,
Pause,
} from 'lucide-react';
import './MarketingUniversal.css';

const platformOptions = [
'meta',
'google ads',
'tiktok',
'snapchat',
'seo',
'influencer',
'offline',
'email',
'sms',
'multiple',
];

const typeOptions = [
'brand awareness',
'lead generation',
'conversion',
'retention',
'referral',
'discount',
'bundle',
'seasonal',
'loyalty',
];

const initialForm = {
name: '',
workshopBranch: '',
platform: 'meta',
type: 'brand awareness',
startDate: '',
endDate: '',
budget: '0',
notes: '',
};

function formatSar(value) {
const n = Number(value);

if (!Number.isFinite(n)) return '0 SAR';

return `${n.toLocaleString(undefined, {
maximumFractionDigits: 0,
})} SAR`;
}

function titleCase(value) {
return String(value || '')
.split(' ')
.filter(Boolean)
.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
.join(' ');
}

const SelectField = ({ value, onChange, options }) => {
return (
<div className="mk-select-wrap">
<select
className="mk-input mk-select"
value={value}
onChange={(e) => onChange(e.target.value)}
>
{options.map((option) => (
<option key={option} value={option}>
{option}
</option>
))}
</select>

<ChevronDown className="mk-select-icon" size={15} strokeWidth={2} />
</div>
);
};

const StatusBadge = ({ status }) => {
const value = String(status || 'active').toLowerCase();

return <span className="mk-status mk-status-active">{value}</span>;
};

export const Promotions = () => {
const [campaigns, setCampaigns] = useState([]);
const [search, setSearch] = useState('');
const [showModal, setShowModal] = useState(false);
const [form, setForm] = useState(initialForm);

const filteredCampaigns = useMemo(() => {
const q = search.trim().toLowerCase();

if (!q) return campaigns;

return campaigns.filter((item) => {
const text = [
item.name,
item.workshopBranch,
item.platform,
item.type,
item.status,
]
.filter(Boolean)
.join(' ')
.toLowerCase();

return text.includes(q);
});
}, [campaigns, search]);

const updateForm = (field, value) => {
setForm((prev) => ({
...prev,
[field]: value,
}));
};

const openModal = () => {
setForm(initialForm);
setShowModal(true);
};

const closeModal = () => {
setShowModal(false);
setForm(initialForm);
};

const handleSubmit = (e) => {
e.preventDefault();

if (!form.name.trim()) {
alert('Campaign name is required.');
return;
}

if (!form.workshopBranch.trim()) {
alert('Workshop / branch name is required.');
return;
}

setCampaigns((prev) => [
{
id: Date.now(),
name: form.name.trim(),
workshopBranch: form.workshopBranch.trim(),
platform: titleCase(form.platform),
type: titleCase(form.type),
budget: Number(form.budget || 0),
spent: 0,
revenue: 0,
status: 'active',
startDate: form.startDate,
endDate: form.endDate,
notes: form.notes,
},
...prev,
]);

closeModal();
};

return (
<div className="mk-page">
<div className="mk-page-actions">
<label className="mk-search-field">
<Search size={15} color="#94A3B8" strokeWidth={2} />

<input
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search campaigns..."
/>
</label>

<button type="button" className="mk-btn-primary" onClick={openModal}>
<Plus size={16} strokeWidth={2.5} />
New Campaign
</button>
</div>

<div className="mk-error-text">Unauthorized</div>

<section className="mk-table-card">
<table className="mk-table">
<thead>
<tr>
<th>Campaign</th>
<th>Platform</th>
<th>Type</th>
<th>Budget</th>
<th>Spent</th>
<th>Revenue</th>
<th>Status</th>
<th>Actions</th>
</tr>
</thead>

<tbody>
{filteredCampaigns.length === 0 ? (
<tr>
<td colSpan={8} className="mk-empty-table">
No campaigns found
</td>
</tr>
) : (
filteredCampaigns.map((item) => (
<tr key={item.id}>
<td>
<div className="mk-table-title">{item.name}</div>
<div className="mk-table-subtitle">
{item.workshopBranch}
</div>
</td>

<td>{item.platform}</td>
<td>{item.type}</td>
<td>{formatSar(item.budget)}</td>
<td>{formatSar(item.spent)}</td>
<td>{formatSar(item.revenue)}</td>
<td>
<StatusBadge status={item.status} />
</td>
<td>
<div className="mk-icon-actions">
<button type="button" title="Edit">
<Pencil size={15} />
</button>

<button type="button" title="Analytics">
<BarChart3 size={15} />
</button>

<button type="button" title="Pause">
<Pause size={15} />
</button>
</div>
</td>
</tr>
))
)}
</tbody>
</table>
</section>

{showModal ? (
<div className="mk-modal-overlay">
<div className="mk-modal-card">
<div className="mk-modal-header">
<h2>New Campaign</h2>

<button
type="button"
className="mk-modal-close"
onClick={closeModal}
>
<X size={18} strokeWidth={2} />
</button>
</div>

<form onSubmit={handleSubmit}>
<div className="mk-form-group">
<label className="mk-label">Campaign Name</label>
<input
autoFocus
className="mk-input mk-input-focus"
value={form.name}
onChange={(e) => updateForm('name', e.target.value)}
/>
</div>

<div className="mk-form-group">
<label className="mk-label">Workshop / Branch Name</label>
<input
className="mk-input"
value={form.workshopBranch}
onChange={(e) =>
updateForm('workshopBranch', e.target.value)
}
placeholder="Enter branch name"
/>
</div>

<div className="mk-form-grid-2">
<div className="mk-form-group">
<label className="mk-label">Platform</label>
<SelectField
value={form.platform}
onChange={(value) => updateForm('platform', value)}
options={platformOptions}
/>
</div>

<div className="mk-form-group">
<label className="mk-label">Type</label>
<SelectField
value={form.type}
onChange={(value) => updateForm('type', value)}
options={typeOptions}
/>
</div>
</div>

<div className="mk-form-grid-2">
<div className="mk-form-group">
<label className="mk-label">Start Date</label>
<input
type="date"
className="mk-input"
value={form.startDate}
onChange={(e) =>
updateForm('startDate', e.target.value)
}
/>
</div>

<div className="mk-form-group">
<label className="mk-label">End Date</label>
<input
type="date"
className="mk-input"
value={form.endDate}
onChange={(e) =>
updateForm('endDate', e.target.value)
}
/>
</div>
</div>

<div className="mk-form-group">
<label className="mk-label">Budget Allocated (SAR)</label>
<input
type="number"
className="mk-input"
value={form.budget}
onChange={(e) => updateForm('budget', e.target.value)}
/>
</div>

<div className="mk-form-group">
<label className="mk-label">Notes</label>
<input
className="mk-input"
value={form.notes}
onChange={(e) => updateForm('notes', e.target.value)}
/>
</div>

<div className="mk-modal-footer">
<button
type="button"
className="mk-btn-secondary"
onClick={closeModal}
>
Cancel
</button>

<button type="submit" className="mk-btn-primary">
Save Campaign
</button>
</div>
</form>
</div>
</div>
) : null}
</div>
);
};

export default Promotions;
