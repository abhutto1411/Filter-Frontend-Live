import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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
// The shell's own chrome (back button, heading) still comes from here.
import './MarketingUniversal.css';
import '../../styles/ui.css';

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
  // Was two alert() dialogs; a browser can block them, and the message is
  // gone the moment one is dismissed.
  const [error, setError] = useState('');

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
        className="mk-page ui-tokens ui-formpage"
      >
        <div className="ui-banner ui-banner--dang">
          <AlertTriangle size={14} />
          <span>{t('cfg.unknown', { key: platformKey })}</span>
        </div>
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
      setError(t('err.fieldRequired', { label: missing.label }));
      return;
    }
    setError('');

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
      setError(err?.message || t('err.connectSave'));
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
      className="mk-page ui-tokens ui-formpage"
    >
      {loading ? (
        <section className="ui-panel ui-panel-pad">
          <div className="ui-stack-sm" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`sk-${i}`} className="ui-stack-sm">
                <div className="ui-sk ui-sk--label ui-sk--w25" />
                <div className="ui-sk ui-sk--input" />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="ui-stack"
          dir={locale === 'ar' ? 'rtl' : undefined}
          noValidate
        >
          {error ? (
            <div className="ui-banner ui-banner--dang" role="alert">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="ui-banner ui-banner--info">
            <AlertTriangle size={14} />
            <span>{t('cfg.alert', { title: localized.title })}</span>
          </div>

          <section className="ui-panel ui-panel-pad ui-stack-sm">
            {localized.fields.map((field, index) => (
              <div className="ui-field" key={field.name}>
                <label htmlFor={`adp-${field.name}`}>
                  {field.label}
                  {field.required ? <span className="ui-field-req"> *</span> : null}
                </label>
                <input
                  id={`adp-${field.name}`}
                  autoFocus={index === 0}
                  type={
                    /token|secret|password|apiSecret|developerToken/i.test(field.name)
                      ? 'password'
                      : 'text'
                  }
                  value={form[field.name] || ''}
                  onChange={(event) => updateForm(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  className="ui-input"
                />
              </div>
            ))}

            <label className="ui-switch">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
              />
              <span className="ui-switch-track" />
              <span className="ui-switch-text">{t('cfg.autoSync')}</span>
            </label>
          </section>

          <div className="ui-form-foot">
            <button
              type="button"
              className="ui-btn ui-btn--default"
              onClick={goBack}
              disabled={saving}
            >
              {t('cfg.cancel')}
            </button>
            <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
              <RefreshCw size={13} className={saving ? 'ui-spin' : ''} />
              {saving ? t('cfg.saving') : t('cfg.save')}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
}
