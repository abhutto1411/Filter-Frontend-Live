import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import {
  marketingCreateAdPlatform,
  marketingListAdPlatforms,
  marketingUpdateAdPlatform,
} from '../../services/superAdminMarketingApi';
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
  const listPath = marketingSectionPath(location.pathname, 'ad-platforms');

  const definition = useMemo(
    () => PLATFORM_DEFINITIONS.find((d) => d.key === platformKey),
    [platformKey],
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

  if (!definition) {
    return (
      <MarketingFormShell
        title="Platform not found"
        backLabel="Back to Ad Platforms"
        onBack={goBack}
        className="mk-page mkp-form-page"
      >
        <p className="mk-error-text">Unknown platform key: {platformKey}</p>
      </MarketingFormShell>
    );
  }

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const missing = definition.fields.find(
      (field) => field.required && !String(form[field.name] || '').trim(),
    );
    if (missing) {
      alert(`${missing.label} is required.`);
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
      alert(err?.message || 'Failed to connect platform.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingFormShell
      title={`Configure ${definition.title}`}
      subtitle={definition.subtitle}
      backLabel="Back to Ad Platforms"
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      {loading ? (
        <div className="mk-panel-empty">Loading...</div>
      ) : (
        <form onSubmit={handleSubmit} className="mkp-form-page-body">
          <div className="adp-modal-alert">
            Enter your {definition.title} API credentials. These are stored for metric sync.
          </div>

          {definition.fields.map((field, index) => (
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
            Enable automatic sync
          </label>

          <div className="mkp-form-page-footer">
            <button type="button" className="adp-cancel-btn" onClick={goBack} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="adp-save-btn" disabled={saving}>
              <RefreshCw size={13} className={saving ? 'adp-spin' : ''} />
              {saving ? 'Saving...' : 'Save & Connect'}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
}
