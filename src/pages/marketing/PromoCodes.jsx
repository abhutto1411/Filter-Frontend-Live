import React, { useMemo, useState } from 'react';
import {
Plus,
Search,
X,
Tag,
Copy,
ChevronDown,
Hourglass,
} from 'lucide-react';
import './MarketingUniversal.css';

const initialCodes = [];

const statusOptions = ['Active', 'Draft', 'Expired'];
const discountTypeOptions = ['Percentage (%)', 'Fixed (SAR)'];

function randomCode() {
return Math.random().toString(36).slice(2, 9).toUpperCase();
}

const SelectField = ({ value, onChange, options }) => {
return (
<div className="mk-code-select-wrap">
<select
value={value}
onChange={(e) => onChange(e.target.value)}
className="mk-code-input mk-code-select"
>
{options.map((option) => (
<option key={option.value || option} value={option.value || option}>
{option.label || option}
</option>
))}
</select>

<ChevronDown size={14} strokeWidth={2} className="mk-code-select-icon" />
</div>
);
};

const Toggle = ({ checked, onChange, label }) => {
return (
<button
type="button"
onClick={() => onChange(!checked)}
className="mk-code-toggle-btn"
>
<span className={checked ? 'mk-code-toggle active' : 'mk-code-toggle'}>
<span />
</span>

{label}
</button>
);
};

const GenerateCodeModal = ({
open,
onClose,
onSubmit,
form,
setForm,
}) => {
if (!open) return null;

const update = (field, value) => {
setForm((prev) => ({
...prev,
[field]: value,
}));
};

const handleSubmit = (e) => {
e.preventDefault();

if (!form.code.trim()) {
alert('Promo code is required.');
return;
}

onSubmit();
};

return (
<div className="mk-code-modal-overlay">
<div className="mk-code-modal">
<div className="mk-code-modal-header">
<h2>Generate Promo Code</h2>

<button type="button" onClick={onClose} className="mk-code-close-btn">
<X size={17} strokeWidth={2} />
</button>
</div>

<form onSubmit={handleSubmit} className="mk-code-modal-form">
<div className="mk-code-form-group">
<label className="mk-code-label">Promo Code *</label>

<div className="mk-code-row">
<input
autoFocus
value={form.code}
onChange={(e) => update('code', e.target.value)}
placeholder="e.g. RAMADAN50"
className="mk-code-input mk-code-focus-input mk-code-flex-input"
/>

<button
type="button"
onClick={() => update('code', randomCode())}
className="mk-code-auto-btn"
>
Auto
</button>
</div>
</div>

<div className="mk-code-form-group">
<label className="mk-code-label">Link to Promotion (optional)</label>

<SelectField
value={form.promotion}
onChange={(value) => update('promotion', value)}
options={[
{ label: 'Select promotion...', value: '' },
]}
/>
</div>

<div className="mk-code-two-col">
<div className="mk-code-form-group">
<label className="mk-code-label">Discount Type</label>

<SelectField
value={form.discountType}
onChange={(value) => update('discountType', value)}
options={discountTypeOptions}
/>
</div>

<div className="mk-code-form-group">
<label className="mk-code-label">Discount Value</label>

<input
value={form.discountValue}
onChange={(e) => update('discountValue', e.target.value)}
className="mk-code-input"
/>
</div>
</div>

<div className="mk-code-two-col">
<div className="mk-code-form-group">
<label className="mk-code-label">Min. Purchase (SAR)</label>

<input
type="number"
value={form.minPurchase}
onChange={(e) => update('minPurchase', e.target.value)}
className="mk-code-input"
/>
</div>

<div className="mk-code-form-group">
<label className="mk-code-label">Max Usage (0=unlimited)</label>

<input
type="number"
value={form.maxUsage}
onChange={(e) => update('maxUsage', e.target.value)}
className="mk-code-input"
/>
</div>
</div>

<div className="mk-code-two-col">
<div className="mk-code-form-group">
<label className="mk-code-label">Valid From</label>

<input
type="datetime-local"
value={form.validFrom}
onChange={(e) => update('validFrom', e.target.value)}
className="mk-code-input"
/>
</div>

<div className="mk-code-form-group">
<label className="mk-code-label">Valid Until</label>

<input
type="datetime-local"
value={form.validUntil}
onChange={(e) => update('validUntil', e.target.value)}
className="mk-code-input"
/>
</div>
</div>

<div className="mk-code-form-group">
<label className="mk-code-label">Status</label>

<SelectField
value={form.status}
onChange={(value) => update('status', value)}
options={statusOptions}
/>
</div>

<div className="mk-code-form-group">
<Toggle
checked={form.showSavings}
onChange={(value) => update('showSavings', value)}
label="Show code savings on invoice"
/>
</div>

<div className="mk-code-form-group">
<label className="mk-code-label">Notes</label>

<textarea
value={form.notes}
onChange={(e) => update('notes', e.target.value)}
placeholder="Internal notes..."
className="mk-code-textarea"
/>
</div>

<div className="mk-code-approval-note">
<Hourglass size={14} strokeWidth={2} />
<span>
This code will be sent to <b>Super Admin for approval</b> before activation.
</span>
</div>

<div className="mk-code-modal-footer">
<button type="button" onClick={onClose} className="mk-code-cancel-btn">
Cancel
</button>

<button type="submit" className="mk-code-submit-btn">
Submit for Approval
</button>
</div>
</form>
</div>
</div>
);
};

export const PromoCodes = () => {
const [codes, setCodes] = useState(initialCodes);
const [search, setSearch] = useState('');
const [showModal, setShowModal] = useState(false);

const [form, setForm] = useState({
code: '',
promotion: '',
discountType: 'Percentage (%)',
discountValue: '',
minPurchase: '0',
maxUsage: '0',
validFrom: '',
validUntil: '',
status: 'Active',
showSavings: true,
notes: '',
});

const filteredCodes = useMemo(() => {
const q = search.trim().toLowerCase();

return codes.filter((item) => {
if (!q) return true;

return (
item.code.toLowerCase().includes(q) ||
item.promotion.toLowerCase().includes(q)
);
});
}, [codes, search]);

const resetForm = () => {
setForm({
code: '',
promotion: '',
discountType: 'Percentage (%)',
discountValue: '',
minPurchase: '0',
maxUsage: '0',
validFrom: '',
validUntil: '',
status: 'Active',
showSavings: true,
notes: '',
});
};

const openModal = () => {
resetForm();
setShowModal(true);
};

const closeModal = () => {
setShowModal(false);
resetForm();
};

const handleSubmit = () => {
setCodes((prev) => [
{
id: Date.now(),
code: form.code.trim(),
promotion: form.promotion.trim(),
discountType: form.discountType,
discountValue: form.discountValue,
minPurchase: form.minPurchase,
maxUsage: form.maxUsage,
validFrom: form.validFrom,
validUntil: form.validUntil,
status: form.status,
showSavings: form.showSavings,
notes: form.notes,
},
...prev,
]);

closeModal();
};

const handleCopy = async (value) => {
try {
await navigator.clipboard.writeText(value);
alert('Code copied');
} catch {
alert('Could not copy code');
}
};

return (
<div className="mk-page mk-code-page">
<div className="mk-code-header">
<div>
<h1 className="mk-code-title">Promo Codes</h1>
<p className="mk-code-subtitle">
Generate and validate promo codes — codes appear on POS and invoices
</p>
</div>

<button type="button" onClick={openModal} className="mk-code-new-btn">
<Plus size={15} strokeWidth={2.5} />
Generate Code
</button>
</div>

<div className="mk-code-filters">
<label className="mk-code-search">
<Search size={13} strokeWidth={2} />

<input
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search by code or promotion..."
/>
</label>
</div>

<div className="mk-code-content-area">
{filteredCodes.length === 0 ? (
<div className="mk-code-empty-state">
<Tag size={41} strokeWidth={1.8} />
<div>No promo codes yet</div>
</div>
) : (
<div className="mk-code-table-wrap">
<table className="mk-code-table">
<thead>
<tr>
<th>Code</th>
<th>Promotion</th>
<th>Type</th>
<th>Value</th>
<th>Status</th>
<th>Actions</th>
</tr>
</thead>

<tbody>
{filteredCodes.map((item) => (
<tr key={item.id}>
<td className="mk-code-td-strong">{item.code}</td>
<td>{item.promotion || '-'}</td>
<td>{item.discountType}</td>
<td>{item.discountValue || '-'}</td>
<td>
<span className="mk-code-status-badge">
{item.status}
</span>
</td>
<td>
<button
type="button"
onClick={() => handleCopy(item.code)}
className="mk-code-copy-btn"
>
<Copy size={13} strokeWidth={2} />
Copy
</button>
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>

<GenerateCodeModal
open={showModal}
onClose={closeModal}
onSubmit={handleSubmit}
form={form}
setForm={setForm}
/>
</div>
);
};

export default PromoCodes;
