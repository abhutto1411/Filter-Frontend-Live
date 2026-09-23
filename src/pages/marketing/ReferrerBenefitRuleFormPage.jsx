import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  marketingCreateBenefitRule,
  marketingListReferrers,
} from '../../services/superAdminMarketingApi';
import { mktRefT } from '../../utils/marketingReferrersI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import { InputField, SelectField, TextAreaField } from './referrerFormShared';
import './MarketingUniversal.css';

const ALL_REFERRERS = 'All Referrers';

export default function ReferrerBenefitRuleFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktRefT(locale, key, vars), [locale]);
  const listPath = `${marketingSectionPath(location.pathname, 'referrer-management')}?tab=benefits`;

  const [referrers, setReferrers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    referrer: ALL_REFERRERS,
    oncePerCustomer: 'true',
    discountType: 'percentage',
    discountValue: '',
    minOrderValue: '0',
    notes: '',
  });

  const goBack = () => navigate(listPath);

  useEffect(() => {
    marketingListReferrers({ limit: 100, offset: 0, status: 'all' })
      .then((res) => {
        const rows = Array.isArray(res?.referrers)
          ? res.referrers
          : Array.isArray(res?.data)
            ? res.data
            : [];
        setReferrers(rows);
      })
      .catch(() => setReferrers([]));
  }, []);

  const referrerOptions = [
    { label: t('ruleForm.allReferrers'), value: ALL_REFERRERS },
    ...referrers.map((item) => ({
      label: item.name || item.fullName || t('fallback.referrer'),
      value: String(item.id),
    })),
  ];

  const save = async () => {
    const discountValue = Number(form.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setError(t('benefitForm.valueRequired'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await marketingCreateBenefitRule({
        referrerId: form.referrer === ALL_REFERRERS ? null : form.referrer,
        oncePerCustomer: form.oncePerCustomer === 'true',
        discountType: form.discountType,
        discountValue,
        minOrderValue: Number(form.minOrderValue) || 0,
        notes: form.notes.trim() || null,
      });
      goBack();
    } catch (err) {
      setError(err?.message || t('err.saveBenefit'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingFormShell
      title={t('benefitForm.title')}
      subtitle={t('benefitForm.subtitle')}
      backLabel={t('benefitForm.back')}
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      <div className="mkp-form-page-body" dir={locale === 'ar' ? 'rtl' : undefined}>
        {error ? <div className="mk-error-text">{error}</div> : null}

        <div className="mk-ref-form-grid">
          <SelectField
            label={t('benefitForm.referrer')}
            value={form.referrer}
            onChange={(value) => setForm((prev) => ({ ...prev, referrer: value }))}
            options={referrerOptions}
          />
          <SelectField
            label={t('benefitForm.once')}
            value={form.oncePerCustomer}
            onChange={(value) => setForm((prev) => ({ ...prev, oncePerCustomer: value }))}
            options={[
              { value: 'true', label: t('benefitForm.onceYes') },
              { value: 'false', label: t('benefitForm.onceNo') },
            ]}
          />
          <SelectField
            label={t('benefitForm.discountType')}
            value={form.discountType}
            onChange={(value) => setForm((prev) => ({ ...prev, discountType: value }))}
            options={[
              { value: 'percentage', label: t('ruleForm.percentage') },
              { value: 'fixed', label: t('ruleForm.fixed') },
            ]}
          />
          <InputField
            label={
              form.discountType === 'fixed' ? t('benefitForm.valueSar') : t('benefitForm.value')
            }
            value={form.discountValue}
            onChange={(value) => setForm((prev) => ({ ...prev, discountValue: value }))}
            placeholder={t('ruleForm.valuePh')}
            type="number"
          />
          <InputField
            label={t('benefitForm.minOrder')}
            value={form.minOrderValue}
            onChange={(value) => setForm((prev) => ({ ...prev, minOrderValue: value }))}
            placeholder={t('benefitForm.minOrderPh')}
            type="number"
          />
          <TextAreaField
            label={t('form.notes')}
            value={form.notes}
            onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
          />
        </div>

        <div className="mkp-form-page-footer">
          <button type="button" className="mk-ref-secondary-btn" onClick={goBack} disabled={saving}>
            {t('form.cancel')}
          </button>
          <button type="button" className="mk-ref-primary-btn" onClick={save} disabled={saving}>
            {saving ? t('form.saving') : t('benefitForm.save')}
          </button>
        </div>
      </div>
    </MarketingFormShell>
  );
}
