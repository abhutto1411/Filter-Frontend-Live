import React from 'react';
import { ChevronDown } from 'lucide-react';

export const tierMeta = [
  { key: 'bronze', name: 'Bronze', className: 'mk-loyalty-tier-bronze', colorHex: '#A65A21' },
  { key: 'silver', name: 'Silver', className: 'mk-loyalty-tier-silver', colorHex: '#7F95AE' },
  { key: 'gold', name: 'Gold', className: 'mk-loyalty-tier-gold', colorHex: '#E5A100' },
  { key: 'platinum', name: 'Platinum', className: 'mk-loyalty-tier-platinum', colorHex: '#2E3B54' },
];

export const statusOptions = ['Inactive', 'Active'];

export const EMPTY_LOYALTY_FORM = {
  name: '',
  description: '',
  pointsPerSar: '1',
  pointsForDiscount: '100',
  minRedeemPoints: '500',
  status: 'Inactive',
  bronze: { minPoints: '0', discount: '0' },
  silver: { minPoints: '1000', discount: '5' },
  gold: { minPoints: '5000', discount: '10' },
  platinum: { minPoints: '15000', discount: '15' },
};

const getStoredWorkshopId = () =>
  localStorage.getItem('workshopId') ||
  localStorage.getItem('workshop_id') ||
  localStorage.getItem('selectedWorkshopId') ||
  localStorage.getItem('filter_workshop_id') ||
  '';

const mapStatusToIsActive = (value) => String(value || '').toLowerCase() === 'active';

export const PointsRuleField = ({ label, value, onChange }) => (
  <div className="mk-loyalty-points-card">
    <label className="mk-loyalty-points-label">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mk-loyalty-input"
    />
  </div>
);

export const TierConfigCard = ({ tier, values, onChange }) => (
  <div className={`mk-loyalty-tier-config ${tier.className}`}>
    <div className="mk-loyalty-tier-config-title">{tier.name} Tier</div>
    <div className="mk-loyalty-tier-config-grid">
      <div>
        <label className="mk-loyalty-tier-label">Minimum Points</label>
        <input
          type="number"
          value={values.minPoints}
          onChange={(e) => onChange(tier.key, 'minPoints', e.target.value)}
          className="mk-loyalty-tier-input"
        />
      </div>
      <div>
        <label className="mk-loyalty-tier-label">Discount %</label>
        <input
          type="number"
          value={values.discount}
          onChange={(e) => onChange(tier.key, 'discount', e.target.value)}
          className="mk-loyalty-tier-input"
        />
      </div>
    </div>
  </div>
);

export const SelectField = ({ value, onChange, options }) => (
  <div className="mk-loyalty-select-wrap">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mk-loyalty-input mk-loyalty-select"
    >
      {options.map((option) => (
        <option key={option.value || option} value={option.value || option}>
          {option.label || option}
        </option>
      ))}
    </select>
    <ChevronDown size={14} className="mk-loyalty-select-icon" />
  </div>
);

export function buildLoyaltyPayload(form) {
  const workshopId = getStoredWorkshopId();
  const buildTiers = () =>
    tierMeta.map((tier, index) => ({
      tierName: tier.name,
      minPoints: Number(form[tier.key]?.minPoints || 0),
      bonusPercent: Number(form[tier.key]?.discount || 0),
      sortOrder: index + 1,
      colorHex: tier.colorHex,
    }));

  return {
    workshopId,
    name: form.name.trim(),
    program_name: form.name.trim(),
    programName: form.name.trim(),
    description: form.description.trim(),
    pointsPerSarSpent: Number(form.pointsPerSar || 1),
    points_per_sar: Number(form.pointsPerSar || 1),
    pointsPerSar: Number(form.pointsPerSar || 1),
    pointsPerSarDiscount: Number(form.pointsForDiscount || 100),
    redemption_rate: Number(form.pointsForDiscount || 100),
    redemptionRate: Number(form.pointsForDiscount || 100),
    minPointsToRedeem: Number(form.minRedeemPoints || 500),
    min_points_to_redeem: Number(form.minRedeemPoints || 500),
    isActive: mapStatusToIsActive(form.status),
    status: String(form.status || '').toLowerCase(),
    tiers: buildTiers(),
    tier_bronze_min: Number(form.bronze.minPoints || 0),
    tierBronzeMin: Number(form.bronze.minPoints || 0),
    tier_silver_min: Number(form.silver.minPoints || 1000),
    tierSilverMin: Number(form.silver.minPoints || 1000),
    tier_gold_min: Number(form.gold.minPoints || 5000),
    tierGoldMin: Number(form.gold.minPoints || 5000),
    tier_platinum_min: Number(form.platinum.minPoints || 15000),
    tierPlatinumMin: Number(form.platinum.minPoints || 15000),
    bronze_discount_pct: Number(form.bronze.discount || 0),
    bronzeDiscountPct: Number(form.bronze.discount || 0),
    silver_discount_pct: Number(form.silver.discount || 5),
    silverDiscountPct: Number(form.silver.discount || 5),
    gold_discount_pct: Number(form.gold.discount || 10),
    goldDiscountPct: Number(form.gold.discount || 10),
    platinum_discount_pct: Number(form.platinum.discount || 15),
    platinumDiscountPct: Number(form.platinum.discount || 15),
  };
}
