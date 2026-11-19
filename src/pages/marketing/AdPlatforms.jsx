import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Link2,
  Unlink,
  Settings,
  Smartphone,
  Search,
  Music2,
  Ghost,
  BarChart3,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import {
  marketingChangeAdPlatformStatus,
  marketingListAdPlatforms,
  marketingSyncAdPlatform,
  marketingUpdateAdPlatform,
} from '../../services/superAdminMarketingApi';
import {
  localizePlatformDefinition,
  mktAdT,
} from '../../utils/marketingAdPlatformsI18n';
import { AlertTriangle, Plug } from 'lucide-react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import '../../styles/ui.css';
import { marketingSectionPath } from './marketingRouteUtils';
import { PLATFORM_DEFINITIONS, extractPlatforms } from './adPlatformShared';

const PLATFORM_GLYPH = {
  meta: Smartphone,
  google: Search,
  tiktok: Music2,
  snapchat: Ghost,
};

const PlatformIcon = ({ definition }) => {
  const Glyph = PLATFORM_GLYPH[definition.iconType] || BarChart3;
  return (
    <span className="ui-avatar" aria-hidden>
      <Glyph size={17} strokeWidth={2} />
    </span>
  );
};

function formatTime(value, locale = 'en') {
  try {
    return new Date(value).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

const Toggle = ({ enabled, onClick, label }) => (
  <label className="ui-switch">
    <input type="checkbox" checked={enabled} onChange={onClick} />
    <span className="ui-switch-track" />
    <span className="ui-switch-text">{label}</span>
  </label>
);

export const AdPlatforms = () => {
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

  const localizedDefs = useMemo(
    () => PLATFORM_DEFINITIONS.map((d) => localizePlatformDefinition(d, locale)),
    [locale],
  );

  const [platforms, setPlatforms] = useState([]);
  const [logs, setLogs] = useState([]);
  const [autoSync, setAutoSync] = useState(false);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  const platformMap = useMemo(() => {
    const map = new Map();

    platforms.forEach((item) => {
      map.set(item.platform, item);
    });

    return map;
  }, [platforms]);

  const connectedCount = useMemo(
    () =>
      PLATFORM_DEFINITIONS.filter((definition) => {
        const existing = platformMap.get(definition.key);
        return existing?.status === 'connected';
      }).length,
    [platformMap],
  );

  const addLog = (text) => {
    const now = new Date();

    setLogs((prev) => [
      {
        id: `${now.getTime()}-${Math.random()}`,
        time: formatTime(now, locale),
        text,
      },
      ...prev,
    ]);
  };

  const loadPlatforms = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingListAdPlatforms({
        limit: 100,
        offset: 0,
        status: 'all',
      });

      const rows = extractPlatforms(res);

      setPlatforms(rows);
      setAutoSync(rows.some((item) => item.autoSync));
    } catch (err) {
      setPlatforms([]);
      setError(err?.message || t('err.load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatforms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const openConfigurePage = (definition) => {
    navigate(`${listPath}/${definition.key}/configure`);
  };

  const handleDisconnect = async (definition, displayTitle) => {
    const existing = platformMap.get(definition.key);

    if (!existing?.id) return;

    try {
      setError('');
      setActionLoading(definition.key);

      await marketingChangeAdPlatformStatus(existing.id, {
        status: 'disconnected',
        notes: `${definition.title} disconnected from Marketing Portal`,
      });

      addLog(t('log.disconnected', { title: displayTitle }));
      await loadPlatforms();
    } catch (err) {
      setError(err?.message || t('err.disconnect'));
    } finally {
      setActionLoading('');
    }
  };

  const handleSyncOne = async (definition, displayTitle) => {
    const existing = platformMap.get(definition.key);

    if (!existing?.id) {
      openConfigurePage(definition);
      return;
    }

    if (existing.status !== 'connected') {
      setError(t('err.connectFirst'));
      return;
    }

    try {
      setError('');
      setActionLoading(definition.key);

      const res = await marketingSyncAdPlatform(existing.id, {
        trigger: 'manual',
        forceSync: true,
        syncMode: 'sync_campaign_metrics',
        notes: `Manual sync for ${definition.title}`,
      });

      if (res?.success === false) {
        addLog(
          t('log.syncSkipped', {
            title: displayTitle,
            message: res?.message || t('log.syncSkippedDefault'),
          }),
        );
        setError(res?.message || t('err.syncMetrics'));
      } else {
        const m = res?.sync?.metrics;
        addLog(
          m
            ? t('log.syncedMetrics', {
                title: displayTitle,
                impressions: m.impressions,
                clicks: m.clicks,
                conversions: m.conversions,
              })
            : t('log.synced', { title: displayTitle }),
        );
      }

      await loadPlatforms();
    } catch (err) {
      setError(err?.message || t('err.sync'));
    } finally {
      setActionLoading('');
    }
  };

  const handleToggleAutoSync = async () => {
    const next = !autoSync;
    setAutoSync(next);

    const connected = platforms.filter((item) => item?.id);

    if (connected.length === 0) return;

    try {
      await Promise.all(
        connected.map((item) =>
          marketingUpdateAdPlatform(item.id, { autoSync: next }),
        ),
      );
      addLog(next ? t('log.autoSyncOn') : t('log.autoSyncOff'));
      await loadPlatforms();
    } catch (err) {
      setAutoSync(!next);
      setError(err?.message || t('err.autoSync'));
    }
  };

  const handleSyncAll = async () => {
    const connected = PLATFORM_DEFINITIONS.map((definition) => ({
      definition,
      localized: localizePlatformDefinition(definition, locale),
      existing: platformMap.get(definition.key),
    })).filter((item) => item.existing?.status === 'connected');

    if (connected.length === 0) {
      setError(t('err.syncAllNone'));
      return;
    }

    try {
      setError('');
      setActionLoading('sync_all');

      for (const item of connected) {
        const res = await marketingSyncAdPlatform(item.existing.id, {
          trigger: 'manual',
          forceSync: true,
          syncMode: 'sync_campaign_metrics',
          notes: `Sync all triggered for ${item.definition.title}`,
        });

        if (res?.success === false) {
          addLog(
            t('log.syncSkipped', {
              title: item.localized.title,
              message: res?.message || t('log.syncSkippedDefault'),
            }),
          );
        }
      }

      addLog(t('log.syncedCount', { count: connected.length }));
      await loadPlatforms();
    } catch (err) {
      setError(err?.message || t('err.syncAll'));
    } finally {
      setActionLoading('');
    }
  };

  const numberLocale = locale === 'ar' ? 'ar-SA' : undefined;

  return (
    <div className="ui-root ui-root--flush ui-stack" dir={locale === 'ar' ? 'rtl' : undefined}>
      <section className="ui-panel ui-panel-pad ui-stack-sm">
        <div className="ui-row">
          <div className="ui-head">
            <h1>{t('title')}</h1>
            <p>
              {t('connectedOf', {
                connected: connectedCount,
                total: PLATFORM_DEFINITIONS.length,
              })}
            </p>
          </div>

          <div className="ui-toolbar-end">
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={handleSyncAll}
              disabled={loading || actionLoading === 'sync_all'}
            >
              <RefreshCw
                size={14}
                className={actionLoading === 'sync_all' ? 'ui-spin' : ''}
              />
              {t('btn.syncAll')}
            </button>
          </div>
        </div>

        <div className="ui-row">
          <Zap size={14} />
          <Toggle
            enabled={autoSync}
            onClick={handleToggleAutoSync}
            label={t('autoSync')}
          />
        </div>
      </section>

      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="ui-panels">
        {localizedDefs.map((definition) => {
          const raw = PLATFORM_DEFINITIONS.find((d) => d.key === definition.key);
          const existing = platformMap.get(definition.key);
          const connected = existing?.status === 'connected';
          const busy = actionLoading === definition.key;

          return (
            <section key={definition.key} className="ui-panel">
              <div className="ui-panel-head">
                <PlatformIcon definition={definition} />

                <div>
                  <div className="ui-panel-title">{definition.title}</div>
                  <span className={`ui-pill ui-pill--${connected ? 'ok' : 'neutral'}`}>
                    {connected ? <ShieldCheck size={11} /> : null}
                    {connected ? t('status.connected') : t('status.notConnected')}
                  </span>
                </div>

                <div className="ui-panel-end ui-rowacts">
                  {connected ? (
                    <button
                      type="button"
                      className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                      title={t('title.sync')}
                      aria-label={t('title.sync')}
                      onClick={() => handleSyncOne(raw, definition.title)}
                      disabled={busy}
                    >
                      <RefreshCw size={13} className={busy ? 'ui-spin' : ''} />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                    title={t('title.configure')}
                    aria-label={t('title.configure')}
                    onClick={() => openConfigurePage(raw)}
                    disabled={busy}
                  >
                    <Settings size={13} />
                  </button>
                </div>
              </div>

              <div className="ui-panel-pad ui-stack-sm">
                {connected ? (
                  <>
                    {existing?.lastSyncMetrics ? (
                      <div className="ui-meta">
                        {t('metrics.line', {
                          impr: Number(existing.lastSyncMetrics.impressions || 0).toLocaleString(
                            numberLocale,
                          ),
                          clicks: Number(existing.lastSyncMetrics.clicks || 0).toLocaleString(
                            numberLocale,
                          ),
                          conv: Number(existing.lastSyncMetrics.conversions || 0).toLocaleString(
                            numberLocale,
                          ),
                        })}
                      </div>
                    ) : null}

                    {existing?.lastSyncError ? (
                      <p className="ui-help ui-help--err">{existing.lastSyncError}</p>
                    ) : null}

                    <div className="ui-row">
                      <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={() => handleSyncOne(raw, definition.title)}
                        disabled={busy}
                      >
                        <RefreshCw size={13} className={busy ? 'ui-spin' : ''} />
                        {t('btn.syncNow')}
                      </button>

                      <button
                        type="button"
                        className="ui-btn ui-btn--danger ui-btn--sm"
                        onClick={() => handleDisconnect(raw, definition.title)}
                        disabled={busy}
                      >
                        <Unlink size={13} />
                        {t('btn.disconnect')}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ui-btn ui-btn--primary ui-btn--sm"
                    onClick={() => openConfigurePage(raw)}
                    disabled={busy}
                  >
                    <Link2 size={13} />
                    {t('btn.connect', { title: definition.title })}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="ui-panel">
        <div className="ui-panel-head">
          <RefreshCw size={13} />
          <span className="ui-panel-title">{t('log.title')}</span>
          <div className="ui-panel-end">
            <button
              type="button"
              className="ui-btn ui-btn--subtle ui-btn--sm"
              onClick={() => setLogs([])}
              disabled={logs.length === 0}
            >
              {t('log.clear')}
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="ui-empty">
            <div className="ui-empty-icon"><Plug size={18} /></div>
            <div className="ui-empty-title">{t('log.empty')}</div>
          </div>
        ) : (
          <ul className="ui-list">
            {logs.map((log) => (
              <li key={log.id} className="ui-list-row">
                <div className="ui-list-main">
                  <span className="ui-list-title">{log.text}</span>
                  <span className="ui-list-meta">{log.time}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
};

export default AdPlatforms;
