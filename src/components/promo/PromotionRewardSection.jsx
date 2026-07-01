import React from 'react';
import { Gift } from 'lucide-react';
import { MultiSelectApiField } from '../../pages/marketing/marketingPromotionShared';

const BENEFIT_CHOICES = [
  { value: 'none', label: 'No reward (standard discount only)' },
  { value: 'free', label: 'Free (100% off reward items)' },
  { value: 'percentage', label: 'Percentage off reward items' },
  { value: 'fixed', label: 'Fixed amount off reward items' },
];

/**
 * "What the customer gets" — the reward leg of a Buy X → Get Y promotion.
 * Always visible. Leave the reward type as "No reward" for a plain discount,
 * or pick a benefit + reward items to turn it into a Buy → Get promotion.
 */
export default function PromotionRewardSection({
  form,
  onChange,
  rewardOptions = [],
  loading = false,
  error = '',
  disabled = false,
}) {
  const benefit = form.rewardBenefitType || 'none';
  const isActive = benefit !== 'none';

  return (
    <div className="mkp-section">
      <div className="mkp-section-title">What The Customer Gets (Reward)</div>

      <div className="mk-expense-info-banner" role="note">
        <b>Buy → Get:</b> Pick a reward type and reward items below. When the trigger
        items are in the cart, the reward is applied automatically on the POS invoice.
        Leave as <b>No reward</b> for a plain discount promotion.
      </div>

      <div className="mkp-two-col">
        <div className="mkp-form-group">
          <label className="mkp-label">Reward Type</label>
          <select
            className="mkp-input"
            value={benefit}
            disabled={disabled}
            onChange={(e) => onChange('rewardBenefitType', e.target.value)}
          >
            {BENEFIT_CHOICES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {isActive && benefit !== 'free' ? (
          <div className="mkp-form-group">
            <label className="mkp-label">
              Reward Value {benefit === 'percentage' ? '(%)' : '(SAR per item)'}
            </label>
            <input
              type="number"
              className="mkp-input"
              value={form.rewardDiscountValue}
              disabled={disabled}
              placeholder={benefit === 'percentage' ? 'e.g. 50' : 'e.g. 25'}
              onChange={(e) => onChange('rewardDiscountValue', e.target.value)}
            />
          </div>
        ) : isActive ? (
          <div className="mkp-form-group">
            <label className="mkp-label">Max Reward Items (0 = all matching)</label>
            <input
              type="number"
              className="mkp-input"
              value={form.rewardMaxQuantity}
              disabled={disabled}
              placeholder="e.g. 1"
              onChange={(e) => onChange('rewardMaxQuantity', e.target.value)}
            />
          </div>
        ) : null}
      </div>

      {isActive && benefit !== 'free' ? (
        <div className="mkp-form-group">
          <label className="mkp-label">Max Reward Items (0 = all matching)</label>
          <input
            type="number"
            className="mkp-input"
            value={form.rewardMaxQuantity}
            disabled={disabled}
            placeholder="e.g. 2"
            onChange={(e) => onChange('rewardMaxQuantity', e.target.value)}
          />
        </div>
      ) : null}

      <MultiSelectApiField
        label="Reward Products / Services — Customer Gets Free or Discounted"
        icon={Gift}
        options={rewardOptions}
        selectedIds={(form.rewardProductIds || []).map(String)}
        onChange={(ids) => onChange('rewardProductIds', ids)}
        loading={loading}
        error={error}
        placeholder="Type to search reward items…"
      />
    </div>
  );
}
