import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  marketingCreateReferrer,
  marketingGetReferrer,
  marketingUpdateReferrer,
} from '../../services/superAdminMarketingApi';
import {
  mktRefCategoryLabel,
  mktRefStatusLabel,
  mktRefT,
} from '../../utils/marketingReferrersI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  buildReferrerPayload,
  InputField,
  initialReferrerForm,
  SelectField,
  TextAreaField,
} from './referrerFormShared';
import './MarketingUniversal.css';

const CATEGORY_VALUES = ['Individual', 'Corporate', 'Technician', 'Employee'];
const STATUS_VALUES = ['Active', 'Inactive'];

export default function ReferrerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktRefT(locale, key, vars), [locale]);
  const listPath = `${marketingSectionPath(location.pathname, 'referrer-management')}?tab=referrers`;

  const [form, setForm] = useState(initialReferrerForm);
  const [loadingPage, setLoadingPage] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  const goBack = () => navigate(listPath);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingPage(true);
        const res = await marketingGetReferrer(id);
        const item = res?.referrer || res?.data || res?.item || res;
        if (!item?.id) throw new Error(t('err.referrerNotFound'));
        if (!cancelled) {
          const rawType = item.type || item.category || 'Individual';
          const matchedCat =
            CATEGORY_VALUES.find(
              (c) => c.toLowerCase() === String(rawType).toLowerCase(),
            ) || 'Individual';
          const rawStatus = item.status || 'Active';
          const matchedStatus =
            STATUS_VALUES.find(
              (s) => s.toLowerCase() === String(rawStatus).toLowerCase(),
            ) || 'Active';
          setForm({
            id: String(item.id),
            fullName: item.name || item.fullName || '',
            category: matchedCat,
            mobile: item.mobile || item.phone || '',
            email: item.email || '',
            nationalId: item.nationalId || item.national_id || '',
            status: matchedStatus,
            bankName: item.bankName || item.bank_name || '',
            iban: item.iban || '',
            notes: item.notes || '',
          });
        }
      } catch (err) {
        if (!cancelled) setPageError(err?.message || t('err.loadReferrer'));
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, t]);

  const saveReferrer = async () => {
    if (!form.fullName.trim()) {
      alert(t('err.nameRequired'));
      return;
    }

    try {
      setSaving(true);
      const payload = buildReferrerPayload(form);
      if (form.id) {
        await marketingUpdateReferrer(form.id, payload);
      } else {
        await marketingCreateReferrer(payload);
      }
      goBack();
    } catch (err) {
      alert(err?.message || t('err.saveReferrer'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingFormShell
      title={isEdit ? t('form.referrerEdit') : t('form.referrerNew')}
      subtitle={t('form.referrerSub')}
      backLabel={t('form.referrerBack')}
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      {pageError ? <div className="mk-error-text">{pageError}</div> : null}

      {loadingPage ? (
        <div className="mk-panel-empty">{t('form.loading')}</div>
      ) : (
        <div className="mkp-form-page-body" dir={locale === 'ar' ? 'rtl' : undefined}>
          <div className="mk-ref-form-grid">
            <InputField
              label={t('form.fullName')}
              required
              value={form.fullName}
              onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
              placeholder={t('form.fullNamePh')}
            />
            <SelectField
              label={t('form.category')}
              required
              value={form.category}
              onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
              options={CATEGORY_VALUES.map((value) => ({
                value,
                label: mktRefCategoryLabel(locale, value),
              }))}
            />
            <InputField
              label={t('form.mobile')}
              value={form.mobile}
              onChange={(value) => setForm((prev) => ({ ...prev, mobile: value }))}
              placeholder={t('form.mobilePh')}
            />
            <InputField
              label={t('form.email')}
              value={form.email}
              onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
            />
            <InputField
              label={t('form.nationalId')}
              value={form.nationalId}
              onChange={(value) => setForm((prev) => ({ ...prev, nationalId: value }))}
            />
            <SelectField
              label={t('form.status')}
              value={form.status}
              onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              options={STATUS_VALUES.map((value) => ({
                value,
                label: mktRefStatusLabel(locale, value),
              }))}
            />
            <InputField
              label={t('form.bankName')}
              value={form.bankName}
              onChange={(value) => setForm((prev) => ({ ...prev, bankName: value }))}
            />
            <InputField
              label={t('form.iban')}
              value={form.iban}
              onChange={(value) => setForm((prev) => ({ ...prev, iban: value }))}
              placeholder={t('form.ibanPh')}
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
            <button type="button" className="mk-ref-primary-btn" onClick={saveReferrer} disabled={saving}>
              {saving ? t('form.saving') : t('form.save')}
            </button>
          </div>
        </div>
      )}
    </MarketingFormShell>
  );
}
