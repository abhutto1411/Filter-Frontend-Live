import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  marketingCreateReferrer,
  marketingGetReferrer,
  marketingUpdateReferrer,
} from '../../services/superAdminMarketingApi';
import {
  mktInfPlatformLabel,
  mktInfStatusLabel,
  mktInfT,
} from '../../utils/marketingInfluencersI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  EMPTY_INFLUENCER_FORM,
  platformOptions,
} from './influencerReferrerShared';
import './MarketingUniversal.css';

export default function InfluencerReferrerFormPage() {
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
  const t = useCallback((key, vars) => mktInfT(locale, key, vars), [locale]);
  const listPath = marketingSectionPath(location.pathname, 'influencer-referrers');

  const [form, setForm] = useState(EMPTY_INFLUENCER_FORM);
  const [loadingPage, setLoadingPage] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  const goBack = () => navigate(listPath);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingPage(true);
        const res = await marketingGetReferrer(id);
        const row = res?.referrer || res?.data || res?.item || res;
        if (!row?.id) throw new Error(t('err.notFound'));
        if (!cancelled) {
          setForm({
            id: String(row.id),
            name: row.name || row.fullName || '',
            email: row.email || '',
            phone: row.phone || row.mobile || '',
            platform: row.platform || row.socialPlatform || 'instagram',
            handle: row.handle || row.socialHandle || '',
            commissionRate: String(
              row.commissionRate ?? row.commission_rate ?? row.rate ?? ''
            ),
            activeCampaigns: String(
              row.activeCampaigns ?? row.active_campaigns ?? ''
            ),
            status: row.status || 'active',
            notes: row.notes || '',
          });
        }
      } catch (err) {
        if (!cancelled) setPageError(err?.message || t('err.loadOne'));
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, t]);

  const buildPayload = () => ({
    name: form.name.trim(),
    fullName: form.name.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    platform: form.platform,
    socialPlatform: form.platform,
    handle: form.handle.trim() || undefined,
    socialHandle: form.handle.trim() || undefined,
    commissionRate: Number(form.commissionRate || 0),
    activeCampaigns: Number(form.activeCampaigns || 0),
    status: form.status,
    type: 'influencer',
    referrerType: 'influencer',
    category: 'influencer',
    notes: form.notes.trim() || undefined,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      alert(t('err.nameRequired'));
      return;
    }

    try {
      setSaving(true);
      const payload = buildPayload();
      if (isEdit) {
        await marketingUpdateReferrer(form.id, payload);
      } else {
        await marketingCreateReferrer(payload);
      }
      goBack();
    } catch (err) {
      alert(err?.message || t('err.save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingFormShell
      title={isEdit ? t('form.titleEdit') : t('form.titleNew')}
      subtitle={t('form.subtitle')}
      backLabel={t('form.back')}
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      {pageError ? <div className="mk-error-text">{pageError}</div> : null}

      {loadingPage ? (
        <div className="mk-panel-empty">{t('form.loading')}</div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mkp-form-page-body"
          dir={locale === 'ar' ? 'rtl' : undefined}
        >
          <div className="mk-form-grid-2">
            <div className="mk-form-group">
              <label className="mk-label">{t('form.name')}</label>
              <input
                autoFocus
                className="mk-input"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
            </div>
            <div className="mk-form-group">
              <label className="mk-label">{t('form.status')}</label>
              <select
                className="mk-input"
                value={form.status}
                onChange={(e) => updateForm('status', e.target.value)}
              >
                {['active', 'inactive', 'pending', 'suspended'].map((s) => (
                  <option key={s} value={s}>
                    {mktInfStatusLabel(locale, s)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mk-form-grid-2">
            <div className="mk-form-group">
              <label className="mk-label">{t('form.email')}</label>
              <input
                className="mk-input"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
              />
            </div>
            <div className="mk-form-group">
              <label className="mk-label">{t('form.phone')}</label>
              <input
                className="mk-input"
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="mk-form-grid-2">
            <div className="mk-form-group">
              <label className="mk-label">{t('form.platform')}</label>
              <select
                className="mk-input"
                value={form.platform}
                onChange={(e) => updateForm('platform', e.target.value)}
              >
                {platformOptions.map((option) => (
                  <option key={option} value={option}>
                    {mktInfPlatformLabel(locale, option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mk-form-group">
              <label className="mk-label">{t('form.handle')}</label>
              <input
                className="mk-input"
                value={form.handle}
                onChange={(e) => updateForm('handle', e.target.value)}
                placeholder={t('form.handlePh')}
              />
            </div>
          </div>

          <div className="mk-form-grid-2">
            <div className="mk-form-group">
              <label className="mk-label">{t('form.rate')}</label>
              <input
                type="number"
                min="0"
                className="mk-input"
                value={form.commissionRate}
                onChange={(e) => updateForm('commissionRate', e.target.value)}
              />
            </div>
            <div className="mk-form-group">
              <label className="mk-label">{t('form.campaigns')}</label>
              <input
                type="number"
                min="0"
                className="mk-input"
                value={form.activeCampaigns}
                onChange={(e) => updateForm('activeCampaigns', e.target.value)}
              />
            </div>
          </div>

          <div className="mk-form-group">
            <label className="mk-label">{t('form.notes')}</label>
            <input
              className="mk-input"
              value={form.notes}
              onChange={(e) => updateForm('notes', e.target.value)}
            />
          </div>

          <div className="mkp-form-page-footer">
            <button type="button" className="mk-btn-secondary" onClick={goBack} disabled={saving}>
              {t('form.cancel')}
            </button>
            <button type="submit" className="mk-btn-primary" disabled={saving}>
              {saving ? t('form.saving') : t('form.save')}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
}
