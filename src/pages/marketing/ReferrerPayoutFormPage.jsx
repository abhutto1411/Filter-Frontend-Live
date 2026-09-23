import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { marketingGetReferralCommissionsDashboard } from '../../services/superAdminMarketingApi';
import { mktRefFormatSar, mktRefT } from '../../utils/marketingReferrersI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import { InputField, SelectField, TextAreaField } from './referrerFormShared';
import './MarketingUniversal.css';

function extractPayableRows(payload, locale) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.payableSummary)
      ? payload.payableSummary
      : Array.isArray(payload?.data?.payableSummary)
        ? payload.data.payableSummary
        : [];

  return rows.map((row) => ({
    id: String(row.id || row.referrerId || ''),
    name: row.name || row.referrerName || mktRefT(locale, 'fallback.referrer'),
    available: Number(row.available ?? row.availableCommission ?? 0),
  }));
}

export default function ReferrerPayoutFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktRefT(locale, key, vars), [locale]);
  const listPath = `${marketingSectionPath(location.pathname, 'referrer-management')}?tab=payout`;

  const [payableSummary, setPayableSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    referrer: '',
    amount: '',
    method: 'Bank Transfer',
    coa: '',
    notes: '',
  });

  const goBack = () => navigate(listPath);

  useEffect(() => {
    marketingGetReferralCommissionsDashboard({ tableLimit: 100 })
      .then((res) => setPayableSummary(extractPayableRows(res, locale)))
      .catch(() => setPayableSummary([]))
      .finally(() => setLoading(false));
  }, [locale]);

  const referrerOptions = [
    { label: t('payoutForm.selectReferrer'), value: '' },
    ...payableSummary.map((item) => ({
      label: t('payoutForm.optionLabel', {
        name: item.name,
        amount: mktRefFormatSar(locale, item.available),
      }),
      value: item.id,
    })),
  ];

  return (
    <MarketingFormShell
      title={t('payoutForm.title')}
      subtitle={t('payoutForm.subtitle')}
      backLabel={t('payoutForm.back')}
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      {loading ? (
        <div className="mk-panel-empty">{t('form.loading')}</div>
      ) : (
        <div className="mkp-form-page-body" dir={locale === 'ar' ? 'rtl' : undefined}>
          <div className="mk-ref-form-grid">
            <SelectField
              label={t('payoutForm.referrer')}
              required
              value={form.referrer}
              onChange={(value) => setForm((prev) => ({ ...prev, referrer: value }))}
              options={referrerOptions}
            />
            <InputField
              label={t('payoutForm.amount')}
              required
              value={form.amount}
              onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
              placeholder={t('payoutForm.amountPh')}
            />
            <SelectField
              label={t('payoutForm.method')}
              value={form.method}
              onChange={(value) => setForm((prev) => ({ ...prev, method: value }))}
              options={[
                { value: 'Bank Transfer', label: t('payoutForm.bankTransfer') },
                { value: 'Cash', label: t('payoutForm.cash') },
                { value: 'Cheque', label: t('payoutForm.cheque') },
              ]}
            />
            <SelectField
              label={t('payoutForm.coa')}
              value={form.coa}
              onChange={(value) => setForm((prev) => ({ ...prev, coa: value }))}
              options={[{ label: t('payoutForm.selectAccount'), value: '' }]}
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
                alert(t('payoutForm.notExposed'));
                goBack();
              }}
            >
              {t('payoutForm.create')}
            </button>
          </div>
        </div>
      )}
    </MarketingFormShell>
  );
}
