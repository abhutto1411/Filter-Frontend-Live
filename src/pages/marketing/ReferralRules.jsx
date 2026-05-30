import React, { useMemo, useState } from 'react';
import { Search, Plus, X, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import './MarketingUniversal.css';

const expenseCategories = [
'social media ads',
'google ads',
'influencer marketing',
'printing',
'events',
'content creation',
'email marketing',
'sms marketing',
'other',
];

const initialExpenses = [
{
id: 1,
ref: 'EXP-1779286061557',
vendor: '-',
category: 'Social Media Ads',
campaign: '-',
amount: 0,
date: '2026-05-20',
status: 'pending approval',
},
];

const initialForm = {
category: 'social media ads',
vendorName: '',
description: '',
amount: '0',
date: '2026-05-20',
linkedCampaign: '',
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

const ExpenseStatus = ({ status }) => {
const value = String(status || 'pending approval').toLowerCase();

return (
<span className="mk-expense-status mk-expense-status-pending">
{value}
</span>
);
};

const SelectField = ({ value, onChange, options, placeholder }) => {
return (
<div className="mk-select-wrap">
<select
className="mk-input mk-select"
value={value}
onChange={(e) => onChange(e.target.value)}
>
{placeholder ? (
<option value="">{placeholder}</option>
) : null}

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

export const ReferralRules = () => {
const [expenses, setExpenses] = useState(initialExpenses);
const [search, setSearch] = useState('');
const [showModal, setShowModal] = useState(false);
const [form, setForm] = useState(initialForm);

const filteredExpenses = useMemo(() => {
const q = search.trim().toLowerCase();

if (!q) return expenses;

return expenses.filter((item) => {
const text = [
item.ref,
item.vendor,
item.category,
item.campaign,
item.status,
item.date,
]
.filter(Boolean)
.join(' ')
.toLowerCase();

return text.includes(q);
});
}, [expenses, search]);

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
setForm(initialForm);
setShowModal(false);
};

const handleSubmit = (e) => {
e.preventDefault();

const amountValue = Number(form.amount);

if (!Number.isFinite(amountValue) || amountValue < 0) {
alert('Enter valid amount.');
return;
}

setExpenses((prev) => [
{
id: Date.now(),
ref: `EXP-${Date.now()}`,
vendor: form.vendorName.trim() || '-',
category: titleCase(form.category),
campaign: form.linkedCampaign || '-',
amount: amountValue,
date: form.date,
status: 'pending approval',
},
...prev,
]);

closeModal();
};

const updateExpenseStatus = (id, status) => {
setExpenses((prev) =>
prev.map((item) =>
item.id === id
? {
...item,
status,
}
: item,
),
);
};

return (
<div className="mk-page">
<div className="mk-page-actions">
<label className="mk-search-field">
<Search size={15} color="#94A3B8" strokeWidth={2} />

<input
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search expenses..."
/>
</label>

<button type="button" className="mk-btn-primary" onClick={openModal}>
<Plus size={16} strokeWidth={2.5} />
New Expense
</button>
</div>

<section className="mk-table-card">
<table className="mk-table mk-expenses-table">
<thead>
<tr>
<th>Ref</th>
<th>Vendor</th>
<th>Category</th>
<th>Campaign</th>
<th>Amount</th>
<th>Date</th>
<th>Status</th>
<th>Actions</th>
</tr>
</thead>

<tbody>
{filteredExpenses.length === 0 ? (
<tr>
<td colSpan={8} className="mk-empty-table">
No expenses found
</td>
</tr>
) : (
filteredExpenses.map((item) => (
<tr key={item.id}>
<td>{item.ref}</td>
<td>{item.vendor}</td>
<td>{item.category}</td>
<td>{item.campaign}</td>
<td className="mk-td-bold">{formatSar(item.amount)}</td>
<td>{item.date}</td>
<td>
<ExpenseStatus status={item.status} />
</td>
<td>
<div className="mk-expense-actions">
<button
type="button"
title="Approve"
onClick={() =>
updateExpenseStatus(item.id, 'approved')
}
>
<CheckCircle2 size={15} strokeWidth={2} />
</button>

<button
type="button"
title="Reject"
onClick={() =>
updateExpenseStatus(item.id, 'rejected')
}
>
<XCircle size={15} strokeWidth={2} />
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
<div className="mk-modal-card mk-modal-md">
<div className="mk-modal-header">
<h2>New Marketing Expense</h2>

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
<label className="mk-label">Category</label>

<SelectField
value={form.category}
onChange={(value) => updateForm('category', value)}
options={expenseCategories}
/>
</div>

<div className="mk-form-group">
<label className="mk-label">Vendor Name</label>
<input
className="mk-input"
value={form.vendorName}
onChange={(e) =>
updateForm('vendorName', e.target.value)
}
/>
</div>

<div className="mk-form-group">
<label className="mk-label">Description</label>
<input
className="mk-input"
value={form.description}
onChange={(e) =>
updateForm('description', e.target.value)
}
/>
</div>

<div className="mk-form-grid-2">
<div className="mk-form-group">
<label className="mk-label">Amount (SAR)</label>
<input
type="number"
className="mk-input"
value={form.amount}
onChange={(e) =>
updateForm('amount', e.target.value)
}
/>
</div>

<div className="mk-form-group">
<label className="mk-label">Date</label>
<input
type="date"
className="mk-input"
value={form.date}
onChange={(e) => updateForm('date', e.target.value)}
/>
</div>
</div>

<div className="mk-form-group">
<label className="mk-label">Linked Campaign (optional)</label>
<input
className="mk-input"
value={form.linkedCampaign}
onChange={(e) =>
updateForm('linkedCampaign', e.target.value)
}
placeholder="Select campaign..."
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
Submit Expense
</button>
</div>
</form>
</div>
</div>
) : null}
</div>
);
};

export default ReferralRules;
