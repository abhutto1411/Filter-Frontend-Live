import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import {
  marketingCreateAdPlatform,
  marketingListAdPlatforms,
  marketingUpdateAdPlatform,
} from '../../services/superAdminMarketingApi';
import {
  localizePlatformDefinition,
  mktAdT,
} from '../../utils/marketingAdPlatformsI18n';
import {
  buildPayload,
  extractPlatforms,
  PLATFORM_DEFINITIONS,
} from './adPlatformShared';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import './MarketingUniversal.css';

export default function AdPlatformConfigurePage() {
  const { platformKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktAdT(locale, key, vars), [locale]);
  const listPath = marketingSectionPath(location.pathname, 'ad-platforms');

  const definition = useMemo(
    () => PLATFORM_DEFINITIONS.find((d) => d.key === platformKey),
    [platformKey],
  );
  const localized = useMemo(
    () => (definition ? localizePlatformDefinition(definition, locale) : null),
    [definition, locale],
  );

  const [form, setForm] = useState({});
  const [autoSync, setAutoSync] = useState(true);
  const [existingId, setExistingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const goBack = () => navigate(listPath);

  useEffect(() => {
    if (!definition) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await marketingListAdPlatforms({ limit: 100, offset: 0 });
        if (cancelled) return;
        const platforms = extractPlatforms(res);
        const existing = platforms.find((p) => p.platform === definition.key);
        if (existing) {
          setExistingId(existing.id);
          setAutoSync(Boolean(existing.autoSync));
        }
      } catch {
        /* optional */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [definition]);

  if (!definition || !localized) {
    return (
      <MarketingFormShell
        title={t('cfg.notFound')}
        backLabel={t('cfg.back')}
        onBack={goBack}
        className="mk-page mkp-form-page"
      >
        <p className="mk-error-text">{t('cfg.unknown', { key: platformKey })}</p>
      </MarketingFormShell>
    );
  }

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const missing = localized.fields.find(
      (field) => field.required && !String(form[field.name] || '').trim(),
    );
    if (missing) {
      alert(t('err.fieldRequired', { label: missing.label }));
      return;
    }

    const payload = buildPayload(definition, form, autoSync);

    try {
      setSaving(true);
      if (existingId) {
        await marketingUpdateAdPlatform(existingId, payload);
      } else {
        await marketingCreateAdPlatform(payload);
      }
      goBack();
    } catch (err) {
      alert(err?.message || t('err.connectSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingFormShell
      title={t('cfg.title', { title: localized.title })}
      subtitle={localized.subtitle}
      backLabel={t('cfg.back')}
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      {loading ? (
        <div className="mk-panel-empty">{t('cfg.loading')}</div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mkp-form-page-body"
          dir={locale === 'ar' ? 'rtl' : undefined}
        >
          <div className="adp-modal-alert">
            {t('cfg.alert', { title: localized.title })}
          </div>

          {localized.fields.map((field, index) => (
            <div className="adp-form-group" key={field.name}>
              <label>{field.label}</label>
              <input
                autoFocus={index === 0}
                type={
                  /token|secret|password|apiSecret|developerToken/i.test(field.name)
                    ? 'password'
                    : 'text'
                }
                value={form[field.name] || ''}
                onChange={(event) => updateForm(field.name, event.target.value)}
                placeholder={field.placeholder}
                className="mk-input"
              />
            </div>
          ))}

          <label className="mk-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
            {t('cfg.autoSync')}
          </label>

          <div className="mkp-form-page-footer">
            <button type="button" className="adp-cancel-btn" onClick={goBack} disabled={saving}>
              {t('cfg.cancel')}
            </button>
            <button type="submit" className="adp-save-btn" disabled={saving}>
              <RefreshCw size={13} className={saving ? 'adp-spin' : ''} />
              {saving ? t('cfg.saving') : t('cfg.save')}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
}
