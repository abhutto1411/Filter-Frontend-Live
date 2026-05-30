import React, { useMemo, useState } from 'react';
import {
Plus,
X,
Megaphone,
ChevronDown,
Upload,
Building2,
MapPin,
Package,
Gift,
Image,
Hourglass,
} from 'lucide-react';
import './MarketingUniversal.css';

const initialPromotions = [];

const strategyOptions = [
'Standard Promotion',
'Cross-Platform Promotion',
'Zone-Wise Offer',
'Loyalty Reward',
'Seasonal Campaign',
];

const promotionTypeOptions = [
'Percentage Discount',
'Fixed Amount Discount',
'Buy X Get Y Free',
'Bundle Offer',
'Free Service',
];

const discountTypeOptions = ['Percentage (%)', 'Fixed (SAR)'];

const customerSegmentOptions = [
'All Customers',
'New Customers Only',
'Returning Customers',
'VIP Customers',
'Corporate Customers',
];

const statusOptions = ['Draft', 'Scheduled', 'Active'];

const filterStatusOptions = [
'All Statuses',
'Draft',
'Scheduled',
'Active',
'Inactive',
];

const SelectField = ({ value, onChange, options, small = false }) => {
return (
<div className={small ? 'mk-promo-select-wrap small' : 'mk-promo-select-wrap'}>
<select
value={value}
onChange={(e) => onChange(e.target.value)}
className="mk-promo-input mk-promo-select"
>
{options.map((option) => (
<option key={option} value={option}>
{option}
</option>
))}
</select>

<ChevronDown
size={14}
strokeWidth={2}
className="mk-promo-select-icon"
/>
</div>
);
};

const MultiSelectLikeField = ({ label, icon }) => {
const Icon = icon;

return (
<div className="mk-promo-form-group">
<label className="mk-promo-label">
{Icon ? <Icon size={13} strokeWidth={2} /> : null}
{label}
</label>

<button type="button" className="mk-promo-select-like">
<span>Select options...</span>
<ChevronDown size={14} strokeWidth={2} />
</button>
</div>
);
};

const Toggle = ({ checked, onChange, label }) => {
return (
<button
type="button"
onClick={() => onChange(!checked)}
className="mk-promo-toggle-btn"
>
<span className={checked ? 'mk-promo-toggle active' : 'mk-promo-toggle'}>
<span />
</span>

{label}
</button>
);
};

export const MarketingPromotions = () => {
const [promotions, setPromotions] = useState(initialPromotions);
const [search, setSearch] = useState('');
const [statusFilter, setStatusFilter] = useState('All Statuses');
const [showModal, setShowModal] = useState(false);

const [form, setForm] = useState({
name: '',
strategy: 'Standard Promotion',
promotionType: 'Percentage Discount',
discountType: 'Percentage (%)',
discountValue: '',
customerSegment: 'All Customers',
minPurchase: '0',
maxUsage: '0',
status: 'Draft',
startDate: '',
endDate: '',
bannerText: '',
description: '',
terms: '',
autoClose: true,
showPos: true,
showCustomerPortal: true,
});

const filteredPromotions = useMemo(() => {
const q = search.trim().toLowerCase();

return promotions.filter((item) => {
const matchesSearch = !q || item.name.toLowerCase().includes(q);
const matchesStatus =
statusFilter === 'All Statuses' || item.status === statusFilter;

return matchesSearch && matchesStatus;
});
}, [promotions, search, statusFilter]);

const resetForm = () => {
setForm({
name: '',
strategy: 'Standard Promotion',
promotionType: 'Percentage Discount',
discountType: 'Percentage (%)',
discountValue: '',
customerSegment: 'All Customers',
minPurchase: '0',
maxUsage: '0',
status: 'Draft',
startDate: '',
endDate: '',
bannerText: '',
description: '',
terms: '',
autoClose: true,
showPos: true,
showCustomerPortal: true,
});
};

const updateForm = (field, value) => {
setForm((prev) => ({
...prev,
[field]: value,
}));
};

const openModal = () => {
resetForm();
setShowModal(true);
};

const closeModal = () => {
setShowModal(false);
resetForm();
};

const handleSubmit = (e) => {
e.preventDefault();

if (!form.name.trim()) {
alert('Promotion name is required.');
return;
}

setPromotions((prev) => [
{
id: Date.now(),
name: form.name.trim(),
strategy: form.strategy,
promotionType: form.promotionType,
discountValue: form.discountValue,
status: form.status,
},
...prev,
]);

closeModal();
};

return (
<div className="mk-page mk-promo-page">
<div className="mk-promo-header">
<div>
<h1 className="mk-promo-title">Promotions</h1>
<p className="mk-promo-subtitle">
Create and manage marketing promotions with banners,
multi-branch, multi-zone &amp; multi-product support
</p>
</div>

<button type="button" onClick={openModal} className="mk-promo-new-btn">
<Plus size={15} strokeWidth={2.5} />
New Promotion
</button>
</div>

<div className="mk-promo-filters">
<label className="mk-promo-search">
<input
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search promotions..."
/>
</label>

<SelectField
value={statusFilter}
onChange={setStatusFilter}
options={filterStatusOptions}
small
/>
</div>

<div className="mk-promo-empty-area">
{filteredPromotions.length === 0 ? (
<div className="mk-promo-empty-state">
<Megaphone size={39} strokeWidth={1.8} />
<div>No promotions found</div>
</div>
) : (
<div className="mk-promo-list">
{filteredPromotions.map((item) => (
<div key={item.id} className="mk-promo-card">
<div>
<div className="mk-promo-card-title">{item.name}</div>
<div className="mk-promo-card-sub">
{item.strategy} • {item.promotionType}
</div>
</div>

<span className="mk-promo-status-badge">
{item.status}
</span>
</div>
))}
</div>
)}
</div>

{showModal && (
<div className="mk-promo-modal-overlay">
<div className="mk-promo-modal">
<div className="mk-promo-modal-header">
<h2>New Promotion</h2>

<button
type="button"
onClick={closeModal}
className="mk-promo-close-btn"
>
<X size={17} strokeWidth={2} />
</button>
</div>

<form onSubmit={handleSubmit} className="mk-promo-modal-form">
<div className="mk-promo-form-group">
<label className="mk-promo-label">Promotion Name *</label>
<input
autoFocus
value={form.name}
onChange={(e) => updateForm('name', e.target.value)}
placeholder="e.g. Ramadan Special Offer"
className="mk-promo-input mk-promo-focus-input"
/>
</div>

<div className="mk-promo-two-col">
<div className="mk-promo-form-group">
<label className="mk-promo-label">Marketing Strategy</label>
<SelectField
value={form.strategy}
onChange={(value) => updateForm('strategy', value)}
options={strategyOptions}
/>
</div>

<div className="mk-promo-form-group">
<label className="mk-promo-label">Promotion Type</label>
<SelectField
value={form.promotionType}
onChange={(value) => updateForm('promotionType', value)}
options={promotionTypeOptions}
/>
</div>
</div>

<div className="mk-promo-two-col">
<div className="mk-promo-form-group">
<label className="mk-promo-label">Discount Type</label>
<SelectField
value={form.discountType}
onChange={(value) => updateForm('discountType', value)}
options={discountTypeOptions}
/>
</div>

<div className="mk-promo-form-group">
<label className="mk-promo-label">Discount Value</label>
<input
value={form.discountValue}
onChange={(e) => updateForm('discountValue', e.target.value)}
placeholder="e.g. 15"
className="mk-promo-input"
/>
</div>
</div>

<MultiSelectLikeField
label="Source Branch / Store — Created From (select multiple)"
icon={Building2}
/>

<MultiSelectLikeField
label="Target Branches (Where Applicable — select multiple)"
icon={Building2}
/>

<MultiSelectLikeField
label="Target Zones (select multiple)"
icon={MapPin}
/>

<MultiSelectLikeField
label="Trigger Products — Customer Must Buy (select multiple)"
icon={Package}
/>

<MultiSelectLikeField
label="Reward Products / Services — Customer Gets Free or Discounted (select multiple)"
icon={Gift}
/>

<div className="mk-promo-two-col">
<div className="mk-promo-form-group">
<label className="mk-promo-label">Customer Segment</label>
<SelectField
value={form.customerSegment}
onChange={(value) => updateForm('customerSegment', value)}
options={customerSegmentOptions}
/>
</div>

<div className="mk-promo-form-group">
<label className="mk-promo-label">
Min. Purchase Amount (SAR)
</label>
<input
type="number"
value={form.minPurchase}
onChange={(e) => updateForm('minPurchase', e.target.value)}
className="mk-promo-input"
/>
</div>
</div>

<div className="mk-promo-two-col">
<div className="mk-promo-form-group">
<label className="mk-promo-label">
Max Usage Count (0 = unlimited)
</label>
<input
type="number"
value={form.maxUsage}
onChange={(e) => updateForm('maxUsage', e.target.value)}
className="mk-promo-input"
/>
</div>

<div className="mk-promo-form-group">
<label className="mk-promo-label">Status</label>
<SelectField
value={form.status}
onChange={(value) => updateForm('status', value)}
options={statusOptions}
/>
</div>
</div>

<div className="mk-promo-two-col">
<div className="mk-promo-form-group">
<label className="mk-promo-label">Start Date &amp; Time</label>
<input
type="datetime-local"
value={form.startDate}
onChange={(e) => updateForm('startDate', e.target.value)}
className="mk-promo-input"
/>
</div>

<div className="mk-promo-form-group">
<label className="mk-promo-label">End Date &amp; Time</label>
<input
type="datetime-local"
value={form.endDate}
onChange={(e) => updateForm('endDate', e.target.value)}
className="mk-promo-input"
/>
</div>
</div>

<div className="mk-promo-form-group">
<label className="mk-promo-label">Invoice Banner Text</label>
<input
value={form.bannerText}
onChange={(e) => updateForm('bannerText', e.target.value)}
placeholder="e.g. You saved SAR 50 with Ramadan Offer!"
className="mk-promo-input"
/>
</div>

<div className="mk-promo-form-group">
<label className="mk-promo-label">Description</label>
<textarea
value={form.description}
onChange={(e) => updateForm('description', e.target.value)}
className="mk-promo-textarea"
/>
</div>

<div className="mk-promo-form-group">
<label className="mk-promo-label">Terms &amp; Conditions</label>
<textarea
value={form.terms}
onChange={(e) => updateForm('terms', e.target.value)}
placeholder="T&Cs printed on invoice..."
className="mk-promo-textarea"
/>
</div>

<div className="mk-promo-form-group">
<label className="mk-promo-label">
<Image size={13} strokeWidth={2} />
Advertising / Marketing Banners
<span>
(displayed on Customer Portal &amp; App)
</span>
</label>

<div className="mk-promo-upload-row">
<button type="button" className="mk-promo-upload-box">
<Upload size={15} strokeWidth={2} />
<span>Upload</span>
</button>
</div>

<div className="mk-promo-upload-hint">
Upload PNG, JPG, or WebP. Banners will be displayed to
customers in the portal and POS.
</div>
</div>

<div className="mk-promo-toggles-row">
<Toggle
checked={form.autoClose}
onChange={(value) => updateForm('autoClose', value)}
label="Auto-close on end date"
/>

<Toggle
checked={form.showPos}
onChange={(value) => updateForm('showPos', value)}
label="Show on POS Invoice"
/>

<Toggle
checked={form.showCustomerPortal}
onChange={(value) => updateForm('showCustomerPortal', value)}
label="Show on Customer Portal"
/>
</div>

<div className="mk-promo-approval-note">
<Hourglass size={14} strokeWidth={2} />
After creating, this will be sent to the{' '}
<b>Super Admin for approval</b> before it goes live.
</div>

<div className="mk-promo-modal-footer">
<button
type="button"
onClick={closeModal}
className="mk-promo-cancel-btn"
>
Cancel
</button>

<button type="submit" className="mk-promo-submit-btn">
Submit for Approval
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};

export default MarketingPromotions;
