import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plug,
  Save,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import {
  marketingGetIntegrations,
  marketingSaveIntegrations,
  marketingTestIntegration,
} from '../../services/superAdminMarketingApi';
import { BUSINESS_TIMEZONE } from '../../utils/riyadhBusinessRange';
import { mktIntT } from '../../utils/marketingIntegrationsI18n';
import '../../styles/ui.css';

/** The icon that stands for each group of credentials. */
const GROUP_ICON = {
  llm: Sparkles,
};

/**
 * The server sends its catalogue labels in English only — five fixed groups
 * and thirteen fixed keys, both with stable ids. These translate them without
 * a round trip; anything the dictionary has no entry for falls through to the
 * server's own string, so a group added upstream still renders.
 */
const groupIcon = (id) => GROUP_ICON[id] || Plug;

/** The shape the credential cards are about to take. */
const IntegrationsSkeleton = ({ label }) => (
  <div className="ui-panels" aria-busy="true" role="status" aria-label={label}>
    {Array.from({ length: 4 }).map((_, i) => (
      <section key={`sk-${i}`} className="ui-panel">
        <div className="ui-panel-head">
          <div className="ui-sk ui-sk--circle" />
          <div className="ui-field ui-field--grow">
            <div className="ui-sk ui-sk--strong ui-sk--w55" />
            <div className="ui-sk ui-sk--text ui-sk--w90" />
          </div>
        </div>
        <div className="ui-panel-pad ui-stack-sm">
          {Array.from({ length: 2 }).map((__, f) => (
            <div key={`sk-f-${i}-${f}`} className="ui-stack-sm">
              <div className="ui-sk ui-sk--label ui-sk--w25" />
              <div className="ui-sk ui-sk--input" />
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);

export const Integrations = () => {
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktIntT(locale, key, vars), [locale]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [edits, setEdits] = useState({});
  const [testState, setTestState] = useState({});

  /**
   * A translated catalogue label, or the server's own string when the
   * dictionary has no entry for that id.
   */
  const catalogText = useCallback((key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  }, [t]);

  // Stated in the business timezone, so "last changed" does not read as the
  // previous day to a browser further west.
  const fmtWhen = useCallback((iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(locale === 'ar' ? 'ar-SA' : undefined, {
      timeZone: BUSINESS_TIMEZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [locale]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await marketingGetIntegrations();
      setData(res);
      setEdits({});
    } catch (err) {
      setError(err?.message || t('err.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // The catalogue is the same in either language — the labels are translated
  // on this side — so it loads once rather than on every locale change.
  useEffect(() => {
    void load();
  }, [load]);

  const setField = (key, value) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    setSuccess('');
  };

  const pendingCount = useMemo(() => Object.keys(edits).length, [edits]);

  const applyEdits = useCallback(async () => {
    const res = await marketingSaveIntegrations(edits);
    if (res?.status) setData(res.status);
    setEdits({});
    return (res?.changed?.length || 0) + (res?.cleared?.length || 0);
  }, [edits]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const n = await applyEdits();
      setSuccess(t('msg.saved', { n }));
    } catch (err) {
      setError(err?.message || t('err.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (group) => {
    setTestState((prev) => ({ ...prev, [group.id]: { loading: true } }));
    setError('');

    // The button is "Save & Test": whatever is typed has to be stored before
    // the server can test it. A failure here is a save failure, not a test
    // failure, and says so.
    if (pendingCount > 0) {
      try {
        const n = await applyEdits();
        setSuccess(t('msg.saved', { n }));
      } catch (err) {
        setError(err?.message || t('err.save'));
        setTestState((prev) => ({ ...prev, [group.id]: {} }));
        return;
      }
    }

    try {
      const body =
        group.id === 'llm'
          ? { type: 'llm' }
          : { type: 'platform', platform: group.platform };
      const res = await marketingTestIntegration(body);
      setTestState((prev) => ({
        ...prev,
        [group.id]: {
          loading: false,
          ok: !!res?.ok,
          msg: res?.ok
            ? group.id === 'llm'
              ? t('test.llmOk', {
                  provider: res.provider,
                  sample: res.sample || t('test.sampleOk'),
                })
              : t('test.platformOk', {
                  label: res.label || t('test.providerFallback'),
                })
            : res?.reason || t('test.failed'),
        },
      }));
    } catch (err) {
      setTestState((prev) => ({
        ...prev,
        [group.id]: { loading: false, ok: false, msg: err?.message || t('test.failed') },
      }));
    }
  };

  const groups = data?.groups || [];

  return (
    // The portal layout prints the page title in its own top bar and sets
    // `dir` on its root, so this screen repeats neither.
    <div className="ui-root ui-root--flush ui-stack">
      <div className="ui-row">
        <div className="ui-field ui-field--grow">
          <div className="ui-panel-title">
            <KeyRound size={14} /> {t('title')}
          </div>
          <p className="ui-help">{t('subtitle')}</p>
        </div>
        <div className="ui-toolbar-end">
          {pendingCount > 0 ? (
            <span className="ui-pill ui-pill--warn">
              {t('label.pending', { n: pendingCount })}
            </span>
          ) : null}
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={handleSave}
            disabled={saving || loading || pendingCount === 0}
          >
            {saving ? <Loader2 size={15} className="ui-spin" /> : <Save size={15} />}
            {saving ? t('btn.saving') : t('btn.saveAll')}
          </button>
        </div>
      </div>

      {data?.llm ? (
        <div
          className={`ui-banner ui-banner--${data.llm.configured ? 'ok' : 'warn'}`}
          role="status"
        >
          {data.llm.configured ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>
            {data.llm.configured
              ? t('banner.aiActive', { provider: data.llm.provider })
              : t('banner.aiInactive')}
          </span>
        </div>
      ) : null}

      {success ? (
        <div className="ui-banner ui-banner--ok" role="status">
          <CheckCircle2 size={14} />
          <span>{success}</span>
          <button
            type="button"
            className="ui-banner-x"
            onClick={() => setSuccess('')}
            aria-label={t('notice.dismiss')}
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button
            type="button"
            className="ui-banner-x"
            onClick={() => setError('')}
            aria-label={t('notice.dismiss')}
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

      {loading ? (
        <IntegrationsSkeleton label={t('loading')} />
      ) : groups.length === 0 ? (
        <div className="ui-empty">
          <div className="ui-empty-icon"><Plug size={18} /></div>
          <div className="ui-empty-title">{t('empty.none')}</div>
        </div>
      ) : (
        <div className="ui-panels">
          {groups.map((group) => {
            const Icon = groupIcon(group.id);
            const ts = testState[group.id] || {};
            return (
              <section key={group.id} className="ui-panel">
                <div className="ui-panel-head">
                  <span className="ui-avatar" aria-hidden>
                    <Icon size={14} />
                  </span>
                  <div>
                    <div className="ui-panel-title">
                      {catalogText(`grp.${group.id}.title`, group.title)}
                    </div>
                    <div className="ui-help">
                      {catalogText(`grp.${group.id}.desc`, group.description)}
                    </div>
                  </div>
                  <span
                    className={`ui-pill ui-panel-end ui-pill--${group.configured ? 'ok' : 'neutral'}`}
                  >
                    {group.configured ? <ShieldCheck size={11} /> : null}
                    {group.configured ? t('badge.configured') : t('badge.notSet')}
                  </span>
                </div>

                <div className="ui-panel-pad ui-stack-sm">
                  {group.keys.map((field) => {
                    const edited = Object.prototype.hasOwnProperty.call(edits, field.key);
                    const inputValue = edited
                      ? edits[field.key]
                      : field.secret
                        ? ''
                        : field.value || '';
                    const fallbackPlaceholder =
                      catalogText(`ph.${field.key}`, field.placeholder) || t('ph.enterValue');
                    const placeholder =
                      field.secret && field.last4
                        ? t('ph.masked', { last4: field.last4 })
                        : fallbackPlaceholder;
                    const when = fmtWhen(field.updatedAt);

                    return (
                      <div key={field.key} className="ui-field">
                        <label htmlFor={`intg-${field.key}`}>
                          {catalogText(`fld.${field.key}`, field.label)}
                          {field.secret ? (
                            <span className="ui-field-opt"> {t('tag.secret')}</span>
                          ) : null}
                          {field.configured ? (
                            <span className="ui-tag-sub">
                              {' · '}
                              {field.source === 'env' ? t('tag.fromEnv') : t('tag.saved')}
                            </span>
                          ) : null}
                        </label>
                        <input
                          id={`intg-${field.key}`}
                          className="ui-input"
                          type={field.secret ? 'password' : 'text'}
                          autoComplete="off"
                          spellCheck={false}
                          value={inputValue}
                          placeholder={placeholder}
                          onChange={(e) => setField(field.key, e.target.value)}
                        />
                        {/* The server sends a hint per key; the screen used to
                            drop it on the floor. */}
                        {field.hint ? <p className="ui-help">{field.hint}</p> : null}
                        {field.secret && field.configured ? (
                          <p className="ui-help">{t('hint.secretSaved')}</p>
                        ) : null}
                        {when ? (
                          <p className="ui-help">
                            {field.updatedByName
                              ? t('hint.changedBy', { name: field.updatedByName, when })
                              : t('hint.changedAt', { when })}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}

                  {ts.msg ? (
                    <div
                      className={`ui-banner ui-banner--${ts.ok ? 'ok' : 'dang'}`}
                      role={ts.ok ? 'status' : 'alert'}
                    >
                      {ts.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>{ts.msg}</span>
                    </div>
                  ) : null}
                </div>

                <div className="ui-panel-foot">
                  <button
                    type="button"
                    className="ui-btn ui-btn--default ui-btn--sm"
                    onClick={() => handleTest(group)}
                    disabled={ts.loading || saving}
                  >
                    {ts.loading ? <Loader2 size={13} className="ui-spin" /> : <Zap size={13} />}
                    {ts.loading ? t('btn.testing') : t('btn.test')}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Integrations;
