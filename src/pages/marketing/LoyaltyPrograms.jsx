import React, { useMemo, useState } from 'react';
import { Plus, X, Trophy, Star, AlertTriangle } from 'lucide-react';
import './MarketingUniversal.css';

const tierMeta = [
{
key: 'bronze',
name: 'Bronze',
className: 'mk-loyalty-tier-bronze',
},
{
key: 'silver',
name: 'Silver',
className: 'mk-loyalty-tier-silver',
},
{
key: 'gold',
name: 'Gold',
className: 'mk-loyalty-tier-gold',
},
{
key: 'platinum',
name: 'Platinum',
className: 'mk-loyalty-tier-platinum',
},
];

const initialPrograms = [];

const TierPreviewCard = ({ tier, programName }) => {
return (
<div className={`mk-loyalty-tier-preview ${tier.className}`}>
<div className="mk-loyalty-tier-preview-title">
<Star size={13} strokeWidth={2.2} />
{tier.name}
</div>

<div className="mk-loyalty-tier-preview-sub">
{programName || 'No program set'}
</div>
</div>
);
};

const PointsRuleField = ({ label, value, onChange }) => {
return (
<div className="mk-loyalty-points-card">
<label className="mk-loyalty-points-label">{label}</label>
<input
value={value}
onChange={(e) => onChange(e.target.value)}
className="mk-loyalty-input"
/>
</div>
);
};

const TierConfigCard = ({ tier, values, onChange }) => {
return (
<div className={`mk-loyalty-tier-config ${tier.className}`}>
<div className="mk-loyalty-tier-config-title">{tier.name} Tier</div>

<div className="mk-loyalty-tier-config-grid">
<div>
<label className="mk-loyalty-tier-label">Minimum Points</label>
<input
value={values.minPoints}
onChange={(e) =>
onChange(tier.key, 'minPoints', e.target.value)
}
className="mk-loyalty-tier-input"
/>
</div>

<div>
<label className="mk-loyalty-tier-label">Discount %</label>
<input
value={values.discount}
onChange={(e) =>
onChange(tier.key, 'discount', e.target.value)
}
className="mk-loyalty-tier-input"
/>
</div>
</div>
</div>
);
};

export const LoyaltyPrograms = () => {
const [programs, setPrograms] = useState(initialPrograms);
const [showModal, setShowModal] = useState(false);

const [form, setForm] = useState({
name: '',
description: '',
pointsPerSar: '1',
pointsForDiscount: '100',
minRedeemPoints: '500',
bronze: {
minPoints: '0',
discount: '0',
},
silver: {
minPoints: '1000',
discount: '5',
},
gold: {
minPoints: '5000',
discount: '10',
},
platinum: {
minPoints: '15000',
discount: '15',
},
});

const latestProgram = useMemo(() => {
return programs.length > 0 ? programs[0] : null;
}, [programs]);

const resetForm = () => {
setForm({
name: '',
description: '',
pointsPerSar: '1',
pointsForDiscount: '100',
minRedeemPoints: '500',
bronze: {
minPoints: '0',
discount: '0',
},
silver: {
minPoints: '1000',
discount: '5',
},
gold: {
minPoints: '5000',
discount: '10',
},
platinum: {
minPoints: '15000',
discount: '15',
},
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

const updateField = (field, value) => {
setForm((prev) => ({
...prev,
[field]: value,
}));
};

const updateTierField = (tierKey, field, value) => {
setForm((prev) => ({
...prev,
[tierKey]: {
...prev[tierKey],
[field]: value,
},
}));
};

const handleSubmit = (e) => {
e.preventDefault();

if (!form.name.trim()) {
alert('Program Name is required.');
return;
}

const newProgram = {
id: Date.now(),
name: form.name.trim(),
description: form.description.trim(),
pointsPerSar: form.pointsPerSar,
pointsForDiscount: form.pointsForDiscount,
minRedeemPoints: form.minRedeemPoints,
bronze: { ...form.bronze },
silver: { ...form.silver },
gold: { ...form.gold },
platinum: { ...form.platinum },
};

setPrograms((prev) => [newProgram, ...prev]);
closeModal();
};

return (
<div className="mk-page mk-loyalty-page">
<div className="mk-loyalty-header">
<div>
<h1 className="mk-loyalty-title">Loyalty Programs</h1>
<p className="mk-loyalty-subtitle">
Reward returning customers with points &amp; tier benefits
</p>
</div>

<button type="button" onClick={openModal} className="mk-loyalty-new-btn">
<Plus size={15} strokeWidth={2.5} />
New Program
</button>
</div>

<div className="mk-loyalty-tier-grid">
{tierMeta.map((tier) => (
<TierPreviewCard
key={tier.key}
tier={tier}
programName={latestProgram?.name || ''}
/>
))}
</div>

<div className="mk-loyalty-content-area">
{programs.length === 0 ? (
<div className="mk-loyalty-empty-state">
<Trophy size={38} strokeWidth={1.8} />
<div className="mk-loyalty-empty-title">
No loyalty programs yet
</div>
<div className="mk-loyalty-empty-sub">
Create your first loyalty program to reward customers
</div>
</div>
) : (
<div className="mk-loyalty-program-list">
{programs.map((program) => (
<div key={program.id} className="mk-loyalty-program-card">
<div className="mk-loyalty-program-head">
<div>
<div className="mk-loyalty-program-name">
{program.name}
</div>
<div className="mk-loyalty-program-desc">
{program.description || 'No description'}
</div>
</div>

<div className="mk-loyalty-program-badge">
Pending Approval
</div>
</div>

<div className="mk-loyalty-rules-grid">
<div className="mk-loyalty-rule-card">
<div className="mk-loyalty-rule-label">
Points earned per SAR spent
</div>
<div className="mk-loyalty-rule-value">
{program.pointsPerSar}
</div>
</div>

<div className="mk-loyalty-rule-card">
<div className="mk-loyalty-rule-label">
Points needed per SAR discount
</div>
<div className="mk-loyalty-rule-value">
{program.pointsForDiscount}
</div>
</div>

<div className="mk-loyalty-rule-card">
<div className="mk-loyalty-rule-label">
Minimum points to redeem
</div>
<div className="mk-loyalty-rule-value">
{program.minRedeemPoints}
</div>
</div>
</div>
</div>
))}
</div>
)}
</div>

{showModal && (
<div className="mk-loyalty-modal-overlay">
<div className="mk-loyalty-modal">
<div className="mk-loyalty-modal-header">
<h2>New Loyalty Program</h2>

<button
type="button"
onClick={closeModal}
className="mk-loyalty-close-btn"
>
<X size={17} strokeWidth={2} />
</button>
</div>

<form onSubmit={handleSubmit} className="mk-loyalty-modal-form">
<div className="mk-loyalty-form-group">
<label className="mk-loyalty-label">Program Name *</label>
<input
autoFocus
value={form.name}
onChange={(e) => updateField('name', e.target.value)}
placeholder="e.g. FILTER Rewards"
className="mk-loyalty-input mk-loyalty-focus-input"
/>
</div>

<div className="mk-loyalty-form-group">
<label className="mk-loyalty-label">Description</label>
<textarea
value={form.description}
onChange={(e) =>
updateField('description', e.target.value)
}
className="mk-loyalty-textarea"
/>
</div>

<div className="mk-loyalty-section-heading">Points Rules</div>

<div className="mk-loyalty-points-grid">
<PointsRuleField
label="Points earned per SAR spent"
value={form.pointsPerSar}
onChange={(value) => updateField('pointsPerSar', value)}
/>

<PointsRuleField
label="Points needed per SAR discount"
value={form.pointsForDiscount}
onChange={(value) =>
updateField('pointsForDiscount', value)
}
/>

<PointsRuleField
label="Minimum points to redeem"
value={form.minRedeemPoints}
onChange={(value) =>
updateField('minRedeemPoints', value)
}
/>
</div>

<div className="mk-loyalty-section-heading">
Tier Configuration
</div>

{tierMeta.map((tier) => (
<TierConfigCard
key={tier.key}
tier={tier}
values={form[tier.key]}
onChange={updateTierField}
/>
))}

<div className="mk-loyalty-approval-note">
<AlertTriangle size={14} strokeWidth={2} />
<span>
This program will be sent to <b>Super Admin</b> for
approval before activation.
</span>
</div>

<div className="mk-loyalty-modal-footer">
<button
type="button"
onClick={closeModal}
className="mk-loyalty-cancel-btn"
>
Cancel
</button>

<button type="submit" className="mk-loyalty-submit-btn">
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

export default LoyaltyPrograms;
