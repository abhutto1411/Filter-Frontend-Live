import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { marketingListReferrers } from '../../services/superAdminMarketingApi';
import { mktRefCategoryLabel, mktRefT } from '../../utils/marketingReferrersI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import { InputField, SelectField, TextAreaField } from './referrerFormShared';
import './MarketingUniversal.css';

const CATEGORY_VALUES = ['Individual', 'Corporate', 'Technician', 'Employee'];

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
  const [form, setForm] = useState({
    referrer: 'All Referrers',
    category: 'All Categories',
    customerType: 'All Customers',
    service: '',
    commissionType: 'Percentage (%)',
    value: '0',
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
    { label: t('ruleForm.allReferrers'), value: 'All Referrers' },
    ...referrers.map((item) => ({
      label: item.name || item.fullName || t('fallback.referrer'),
      value: String(item.id),
    })),
  ];

  return (
    <MarketingFormShell
      title={t('ruleForm.title')}
      subtitle={t('ruleForm.subtitle')}
      backLabel={t('ruleForm.back')}
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      <div className="mkp-form-page-body" dir={locale === 'ar' ? 'rtl' : undefined}>
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
              { value: 'All Categories', label: t('ruleForm.allCategories') },
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
            options={[{ value: 'All Customers', label: t('ruleForm.allCustomers') }]}
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
            options={[{ value: 'Percentage (%)', label: t('ruleForm.percentage') }]}
          />
          <InputField
            label={t('ruleForm.value')}
            value={form.value}
            onChange={(value) => setForm((prev) => ({ ...prev, value: value }))}
            placeholder={t('ruleForm.valuePh')}
          />
          <InputField
            label={t('ruleForm.from')}
            value={form.effectiveFrom}
            onChange={(value) => setForm((prev) => ({ ...prev, effectiveFrom: value }))}
            placeholder={t('ruleForm.datePh')}
          />
          <InputField
            label={t('ruleForm.to')}
            value={form.effectiveTo}
            onChange={(value) => setForm((prev) => ({ ...prev, effectiveTo: value }))}
            placeholder={t('ruleForm.datePh')}
          />
          <TextAreaField
            label={t('form.notes')}
            value={form.notes}
            onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
          />
        </div>

        <div className="mkp-form-page-footer">
          <button type="button" className="mk-ref-secondary-btn" onClick={goBack}>
            {t('form.cancel')}
          </button>
          <button
            type="button"
            className="mk-ref-primary-btn"
            onClick={() => {
              alert(t('ruleForm.notExposed'));
              goBack();
            }}
          >
            {t('ruleForm.save')}
          </button>
        </div>
      </div>
    </MarketingFormShell>
  );
}
