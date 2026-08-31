import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  marketingCreateLoyaltyProgram,
  marketingGetLoyaltyProgram,
  marketingUpdateLoyaltyProgram,
} from '../../services/superAdminMarketingApi';
import { loyT } from '../../utils/loyaltyProgramsI18n';
import { resolveMarketingLocale } from '../../utils/marketingPromotionsI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  buildLoyaltyPayload,
  EMPTY_LOYALTY_FORM,
  PointsRuleField,
  SelectField,
  localizedStatusOptions,
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
  const outletCtx = useOutletContext() || {};
  const locale = resolveMarketingLocale(outletCtx);
  const t = useCallback((key, vars) => loyT(locale, key, vars), [locale]);
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
        alert(error?.message || t('err.loadOne'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editId, isEdit, t]);

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
      alert(t('err.nameRequired'));
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
      alert(error?.message || t('err.save'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingFormShell
      title={isEdit ? t('form.titleEdit') : t('form.titleNew')}
      subtitle={t('form.subtitle')}
      backLabel={t('form.back')}
      onBack={goBack}
      className="mk-page mk-loyalty-page mkp-form-page"
    >
      <form onSubmit={handleSubmit} className="mkp-form-page-body mk-loyalty-modal-form">
        <div className="mk-loyalty-form-group">
          <label className="mk-loyalty-label">{t('form.name')}</label>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder={t('form.placeholder.name')}
            className="mk-loyalty-input mk-loyalty-focus-input"
          />
        </div>

        <div className="mk-loyalty-form-group">
          <label className="mk-loyalty-label">{t('form.description')}</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="mk-loyalty-textarea"
          />
        </div>

        <div className="mk-loyalty-section-heading">{t('form.section.points')}</div>
        <div className="mk-loyalty-points-grid">
          <PointsRuleField
            label={t('form.pointsPerSar')}
            value={form.pointsPerSar}
            onChange={(value) => updateField('pointsPerSar', value)}
          />
          <PointsRuleField
            label={t('form.pointsForDiscount')}
            value={form.pointsForDiscount}
            onChange={(value) => updateField('pointsForDiscount', value)}
          />
          <PointsRuleField
            label={t('form.minRedeem')}
            value={form.minRedeemPoints}
            onChange={(value) => updateField('minRedeemPoints', value)}
          />
        </div>

        <div className="mk-loyalty-section-heading">{t('form.section.tiers')}</div>
        {tierMeta.map((tier) => (
          <TierConfigCard
            key={tier.key}
            tier={tier}
            values={form[tier.key]}
            onChange={updateTierField}
            locale={locale}
          />
        ))}

        <div className="mk-loyalty-form-group">
          <label className="mk-loyalty-label">{t('form.status')}</label>
          <SelectField
            value={form.status}
            onChange={(value) => updateField('status', value)}
            options={localizedStatusOptions(locale)}
          />
        </div>

        <div className="mk-loyalty-approval-note">
          <AlertTriangle size={14} strokeWidth={2} />
          <span>{t('form.approvalNote')}</span>
        </div>

        <div className="mkp-form-page-footer">
          <button
            type="button"
            onClick={goBack}
            className="mk-loyalty-cancel-btn"
            disabled={submitting}
          >
            {t('form.cancel')}
          </button>
          <button
            type="submit"
            className="mk-loyalty-submit-btn"
            disabled={submitting || loading}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="mk-loyalty-spin" />
                {t('form.saving')}
              </>
            ) : isEdit ? (
              t('form.save')
            ) : (
              t('form.submit')
            )}
          </button>
        </div>
      </form>
    </MarketingFormShell>
  );
}
