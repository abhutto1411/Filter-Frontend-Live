import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  marketingCreateLoyaltyProgram,
  marketingGetLoyaltyProgram,
  marketingUpdateLoyaltyProgram,
} from '../../services/superAdminMarketingApi';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  buildLoyaltyPayload,
  EMPTY_LOYALTY_FORM,
  PointsRuleField,
  SelectField,
  statusOptions,
  tierMeta,
  TierConfigCard,
} from './loyaltyProgramShared';
import './MarketingUniversal.css';

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const programToForm = (item) => {
  const tiers = Array.isArray(item?.tiers) ? item.tiers : [];
  const findTier = (name) =>
    tiers.find(
      (t) =>
        String(t?.tierName || t?.name || '')
          .toLowerCase()
          .trim() === name,
    );
  const tierVals = (key, defMin, defDiscount) => {
    const t = findTier(key);
    return {
      minPoints: num(
        t?.minPoints ?? item?.[`tier_${key}_min`] ?? item?.[`tier${key[0].toUpperCase()}${key.slice(1)}Min`],
        defMin,
      ),
      discount: num(
        t?.bonusPercent ?? item?.[`${key}_discount_pct`] ?? item?.[`${key}DiscountPct`],
        defDiscount,
      ),
    };
  };

  return {
    ...EMPTY_LOYALTY_FORM,
    name: item?.program_name || item?.programName || item?.name || '',
    description: item?.description || '',
    pointsPerSar: num(item?.points_per_sar ?? item?.pointsPerSar, 1),
    pointsForDiscount: num(item?.redemption_rate ?? item?.redemptionRate, 100),
    minRedeemPoints: num(item?.min_points_to_redeem ?? item?.minPointsToRedeem, 500),
    status:
      String(item?.status || (item?.isActive ? 'active' : 'inactive')).toLowerCase() === 'active'
        ? 'Active'
        : 'Inactive',
    bronze: tierVals('bronze', 0, 0),
    silver: tierVals('silver', 1000, 5),
    gold: tierVals('gold', 5000, 10),
    platinum: tierVals('platinum', 15000, 15),
  };
};

export default function LoyaltyProgramFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const editId = params?.id || null;
  const isEdit = Boolean(editId);
  const listPath = marketingSectionPath(location.pathname, 'loyalty-programs');

  const [form, setForm] = useState(EMPTY_LOYALTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const data = await marketingGetLoyaltyProgram(editId);
        const item = data?.loyaltyProgram || data?.data || data;
        if (active && item) setForm(programToForm(item));
      } catch (error) {
        alert(error?.message || 'Could not load loyalty program.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editId, isEdit]);

  const goBack = () => navigate(listPath);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateTierField = (tierKey, field, value) => {
    setForm((prev) => ({
      ...prev,
      [tierKey]: { ...prev[tierKey], [field]: value },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Program Name is required.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildLoyaltyPayload(form);
      if (isEdit) {
        await marketingUpdateLoyaltyProgram(editId, payload);
      } else {
        await marketingCreateLoyaltyProgram(payload);
      }
      goBack();
    } catch (error) {
      alert(error?.message || 'Could not save loyalty program.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingFormShell
      title={isEdit ? 'Edit Loyalty Program' : 'New Loyalty Program'}
      subtitle="Configure points rules and tiers. Sent to Super Admin for approval before activation."
      backLabel="Back to Loyalty Programs"
      onBack={goBack}
      className="mk-page mk-loyalty-page mkp-form-page"
    >
      <form onSubmit={handleSubmit} className="mkp-form-page-body mk-loyalty-modal-form">
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
            onChange={(e) => updateField('description', e.target.value)}
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
            onChange={(value) => updateField('pointsForDiscount', value)}
          />
          <PointsRuleField
            label="Minimum points to redeem"
            value={form.minRedeemPoints}
            onChange={(value) => updateField('minRedeemPoints', value)}
          />
        </div>

        <div className="mk-loyalty-section-heading">Tier Configuration</div>
        {tierMeta.map((tier) => (
          <TierConfigCard
            key={tier.key}
            tier={tier}
            values={form[tier.key]}
            onChange={updateTierField}
          />
        ))}

        <div className="mk-loyalty-form-group">
          <label className="mk-loyalty-label">Status</label>
          <SelectField
            value={form.status}
            onChange={(value) => updateField('status', value)}
            options={statusOptions}
          />
        </div>

        <div className="mk-loyalty-approval-note">
          <AlertTriangle size={14} strokeWidth={2} />
          <span>
            This program will be sent to <b>Super Admin</b> for approval before activation.
          </span>
        </div>

        <div className="mkp-form-page-footer">
          <button
            type="button"
            onClick={goBack}
            className="mk-loyalty-cancel-btn"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="mk-loyalty-submit-btn"
            disabled={submitting || loading}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="mk-loyalty-spin" />
                Saving...
              </>
            ) : isEdit ? (
              'Save Changes'
            ) : (
              'Submit for Approval'
            )}
          </button>
        </div>
      </form>
    </MarketingFormShell>
  );
}
