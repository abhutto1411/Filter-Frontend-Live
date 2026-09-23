import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  marketingCreateCommissionRule,
  marketingListReferrers,
} from '../../services/superAdminMarketingApi';
import { mktRefCategoryLabel, mktRefT } from '../../utils/marketingReferrersI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import { InputField, SelectField, TextAreaField } from './referrerFormShared';
import './MarketingUniversal.css';

const CATEGORY_VALUES = ['Individual', 'Corporate', 'Technician', 'Employee'];
const ALL_REFERRERS = 'All Referrers';
const ALL_CATEGORIES = 'All Categories';
const ALL_CUSTOMERS = 'All Customers';

export default function ReferrerCommissionRuleFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktRefT(locale, key, vars), [locale]);
  const listPath = `${marketingSectionPath(location.pathname, 'referrer-management')}?tab=rules`;

  const [referrers, setReferrers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    referrer: ALL_REFERRERS,
    category: ALL_CATEGORIES,
    customerType: ALL_CUSTOMERS,
    service: '',
    commissionType: 'percentage',
    value: '',
    effectiveFrom: '',
    effectiveTo: '',
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
    const value = Number(form.value);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('ruleForm.valueRequired'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await marketingCreateCommissionRule({
        referrerId: form.referrer === ALL_REFERRERS ? null : form.referrer,
        category: form.category === ALL_CATEGORIES ? null : form.category,
        customerType: form.customerType === ALL_CUSTOMERS ? null : form.customerType,
        service: form.service.trim() || null,
        commissionType: form.commissionType,
        value,
        effectiveFrom: form.effectiveFrom || null,
        effectiveTo: form.effectiveTo || null,
        notes: form.notes.trim() || null,
      });
      goBack();
    } catch (err) {
      setError(err?.message || t('err.saveRule'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingFormShell
      title={t('ruleForm.title')}
      subtitle={t('ruleForm.subtitle')}
      backLabel={t('ruleForm.back')}
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      <div className="mkp-form-page-body" dir={locale === 'ar' ? 'rtl' : undefined}>
        {error ? <div className="mk-error-text">{error}</div> : null}

        <div className="mk-ref-form-grid">
          <SelectField
            label={t('ruleForm.referrer')}
            value={form.referrer}
            onChange={(value) => setForm((prev) => ({ ...prev, referrer: value }))}
            options={referrerOptions}
          />
          <SelectField
            label={t('ruleForm.category')}
            value={form.category}
            onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
            options={[
              { value: ALL_CATEGORIES, label: t('ruleForm.allCategories') },
              ...CATEGORY_VALUES.map((value) => ({
                value,
                label: mktRefCategoryLabel(locale, value),
              })),
            ]}
          />
          <SelectField
            label={t('ruleForm.customerType')}
            value={form.customerType}
            onChange={(value) => setForm((prev) => ({ ...prev, customerType: value }))}
            options={[{ value: ALL_CUSTOMERS, label: t('ruleForm.allCustomers') }]}
          />
          <InputField
            label={t('ruleForm.service')}
            value={form.service}
            onChange={(value) => setForm((prev) => ({ ...prev, service: value }))}
            placeholder={t('ruleForm.servicePh')}
          />
          <SelectField
            label={t('ruleForm.commissionType')}
            value={form.commissionType}
            onChange={(value) => setForm((prev) => ({ ...prev, commissionType: value }))}
            options={[
              { value: 'percentage', label: t('ruleForm.percentage') },
              { value: 'fixed', label: t('ruleForm.fixed') },
            ]}
          />
          <InputField
            label={form.commissionType === 'fixed' ? t('ruleForm.valueSar') : t('ruleForm.value')}
            value={form.value}
            onChange={(value) => setForm((prev) => ({ ...prev, value }))}
            placeholder={t('ruleForm.valuePh')}
            type="number"
          />
          <InputField
            label={t('ruleForm.from')}
            value={form.effectiveFrom}
            onChange={(value) => setForm((prev) => ({ ...prev, effectiveFrom: value }))}
            type="date"
          />
          <InputField
            label={t('ruleForm.to')}
            value={form.effectiveTo}
            onChange={(value) => setForm((prev) => ({ ...prev, effectiveTo: value }))}
            type="date"
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
            {saving ? t('form.saving') : t('ruleForm.save')}
          </button>
        </div>
      </div>
    </MarketingFormShell>
  );
}
