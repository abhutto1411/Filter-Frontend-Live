import React, { useEffect, useMemo, useState } from 'react';
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
import './MarketingUniversal.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { marketingSectionPath } from './marketingRouteUtils';
import { PLATFORM_DEFINITIONS, extractPlatforms } from './adPlatformShared';

const PlatformIcon = ({ definition }) => {
  if (definition.iconType === 'meta') {
    return (
      <div className="adp-platform-icon adp-icon-meta">
        <Smartphone size={18} strokeWidth={2.2} />
      </div>
    );
  }

  if (definition.iconType === 'google') {
    return (
      <div className="adp-platform-icon adp-icon-google">
        <Search size={20} strokeWidth={2.2} />
      </div>
    );
  }

  if (definition.iconType === 'tiktok') {
    return (
      <div className="adp-platform-icon adp-icon-tiktok">
        <Music2 size={20} strokeWidth={2.2} />
      </div>
    );
  }

  if (definition.iconType === 'snapchat') {
    return (
      <div className="adp-platform-icon adp-icon-snapchat">
        <Ghost size={19} strokeWidth={2.1} />
      </div>
    );
  }

  return (
    <div className="adp-platform-icon adp-icon-analytics">
      <BarChart3 size={19} strokeWidth={2.1} />
    </div>
  );
};

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

const Toggle = ({ enabled, onClick }) => (
  <button
    type="button"
    className={enabled ? 'adp-toggle adp-toggle-on' : 'adp-toggle'}
    onClick={onClick}
  >
    <span />
  </button>
);

export const AdPlatforms = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = marketingSectionPath(location.pathname, 'ad-platforms');

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
        time: formatTime(now),
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
      setError(err?.message || 'Failed to load ad platforms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatforms();
  }, []);

  const openConfigurePage = (definition) => {
    navigate(`${listPath}/${definition.key}/configure`);
  };

  const handleDisconnect = async (definition) => {
    const existing = platformMap.get(definition.key);

    if (!existing?.id) return;

    try {
      setActionLoading(definition.key);

      await marketingChangeAdPlatformStatus(existing.id, {
        status: 'disconnected',
        notes: `${definition.title} disconnected from Marketing Portal`,
      });

      addLog(`${definition.title} disconnected`);
      await loadPlatforms();
    } catch (err) {
      alert(err?.message || 'Failed to disconnect platform.');
    } finally {
      setActionLoading('');
    }
  };

  const handleSyncOne = async (definition) => {
    const existing = platformMap.get(definition.key);

    if (!existing?.id) {
      openConfigurePage(definition);
      return;
    }

    if (existing.status !== 'connected') {
      alert('Connect this platform first.');
      return;
    }

    try {
      setActionLoading(definition.key);

      const res = await marketingSyncAdPlatform(existing.id, {
        trigger: 'manual',
        forceSync: true,
        syncMode: 'sync_campaign_metrics',
        notes: `Manual sync for ${definition.title}`,
      });

      if (res?.success === false) {
        addLog(`${definition.title}: ${res?.message || 'sync skipped'}`);
        alert(res?.message || 'Sync could not pull metrics for this platform.');
      } else {
        const m = res?.sync?.metrics;
        addLog(
          m
            ? `${definition.title} synced — ${m.impressions} impressions, ${m.clicks} clicks, ${m.conversions} conversions`
            : `${definition.title} synced`,
        );
      }

      await loadPlatforms();
    } catch (err) {
      alert(err?.message || 'Failed to sync platform.');
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
      addLog(`Auto-sync ${next ? 'enabled' : 'disabled'}`);
      await loadPlatforms();
    } catch (err) {
      setAutoSync(!next);
      alert(err?.message || 'Failed to update auto-sync.');
    }
  };

  const handleSyncAll = async () => {
    const connected = PLATFORM_DEFINITIONS.map((definition) => ({
      definition,
      existing: platformMap.get(definition.key),
    })).filter((item) => item.existing?.status === 'connected');

    if (connected.length === 0) {
      alert('No connected platforms available to sync.');
      return;
    }

    try {
      setActionLoading('sync_all');

      for (const item of connected) {
        const res = await marketingSyncAdPlatform(item.existing.id, {
          trigger: 'manual',
          forceSync: true,
          syncMode: 'sync_campaign_metrics',
          notes: `Sync all triggered for ${item.definition.title}`,
        });

        if (res?.success === false) {
          addLog(`${item.definition.title}: ${res?.message || 'sync skipped'}`);
        }
      }

      addLog(`${connected.length} platforms synced`);
      await loadPlatforms();
    } catch (err) {
      alert(err?.message || 'Failed to sync all platforms.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="mk-page adp-page">
      <section className="adp-header-card">
        <div className="adp-header-main">
          <div>
            <h3>Ad Platform Integrations</h3>
            <p>
              {connectedCount} of {PLATFORM_DEFINITIONS.length} platforms connected
            </p>
          </div>

          <button
            type="button"
            className="adp-sync-all-btn"
            onClick={handleSyncAll}
            disabled={loading || actionLoading === 'sync_all'}
          >
            <RefreshCw
              size={14}
              className={actionLoading === 'sync_all' ? 'adp-spin' : ''}
            />
            Sync All Now
          </button>
        </div>

        <div className="adp-divider" />

        <div className="adp-auto-sync-row">
          <Zap size={14} />
          <span>Auto-Sync (hourly)</span>
          <Toggle enabled={autoSync} onClick={handleToggleAutoSync} />
        </div>
      </section>

      {error ? <div className="mk-error-text">{error}</div> : null}

      <div className="adp-grid">
        {PLATFORM_DEFINITIONS.map((definition) => {
          const existing = platformMap.get(definition.key);
          const connected = existing?.status === 'connected';
          const busy = actionLoading === definition.key;

          return (
            <section key={definition.key} className="adp-card">
              <div className="adp-card-head">
                <PlatformIcon definition={definition} />

                <div className="adp-card-title-area">
                  <h4>{definition.title}</h4>

                  {connected ? (
                    <p className="adp-connected">
                      <ShieldCheck size={11} />
                      Connected
                    </p>
                  ) : (
                    <p className="adp-not-connected">Not connected</p>
                  )}
                </div>

                <div className="adp-card-icons">
                  {connected ? (
                    <button
                      type="button"
                      title="Sync"
                      onClick={() => handleSyncOne(definition)}
                      disabled={busy}
                    >
                      <RefreshCw size={13} className={busy ? 'adp-spin' : ''} />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    title="Configure"
                    onClick={() => openConfigurePage(definition)}
                    disabled={busy}
                  >
                    <Settings size={13} />
                  </button>
                </div>
              </div>

              <div className="adp-card-body">
                {connected ? (
                  <>
                    {existing?.lastSyncMetrics ? (
                      <div className="adp-metrics-line">
                        {Number(existing.lastSyncMetrics.impressions || 0).toLocaleString()} impr ·{' '}
                        {Number(existing.lastSyncMetrics.clicks || 0).toLocaleString()} clicks ·{' '}
                        {Number(existing.lastSyncMetrics.conversions || 0).toLocaleString()} conv
                      </div>
                    ) : null}

                    {existing?.lastSyncError ? (
                      <div className="adp-error-line">{existing.lastSyncError}</div>
                    ) : null}

                    <button
                      type="button"
                      className="adp-outline-action"
                      onClick={() => handleSyncOne(definition)}
                      disabled={busy}
                    >
                      <RefreshCw size={13} className={busy ? 'adp-spin' : ''} />
                      Sync Now
                    </button>

                    <button
                      type="button"
                      className="adp-danger-link"
                      onClick={() => handleDisconnect(definition)}
                      disabled={busy}
                    >
                      <Unlink size={13} />
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="adp-connect-btn"
                    onClick={() => openConfigurePage(definition)}
                    disabled={busy}
                  >
                    <Link2 size={13} />
                    Connect {definition.title}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="adp-log-card">
        <div className="adp-log-header">
          <div>
            <RefreshCw size={13} />
            <strong>Sync Activity Log</strong>
          </div>

          <button type="button" onClick={() => setLogs([])}>
            Clear
          </button>
        </div>

        <div className="adp-log-list">
          {logs.length === 0 ? (
            <p className="adp-log-empty">No sync activity yet</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="adp-log-row">
                <span>{log.time}</span>
                <strong>⚙</strong>
                <p>{log.text}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <style>
        {`
          .adp-page {
            padding: 20px 24px;
          }

          .adp-header-card {
            background: #ffffff;
            border: 1px solid #dfe4ec;
            border-radius: 9px;
            padding: 15px 14px 14px;
            margin-bottom: 16px;
            box-sizing: border-box;
          }

          .adp-header-main {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }

          .adp-header-main h3 {
            margin: 0 0 4px;
            color: #111827;
            font-size: 14px;
            font-weight: 850;
          }

          .adp-header-main p {
            margin: 0;
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
          }

          .adp-sync-all-btn {
            height: 30px;
            border: 1px solid #dbe1ea;
            background: #ffffff;
            color: #334155;
            border-radius: 6px;
            padding: 0 12px;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            font-size: 11px;
            font-weight: 750;
            cursor: pointer;
          }

          .adp-sync-all-btn:hover {
            border-color: #cbd5e1;
            background: #f8fafc;
          }

          .adp-divider {
            height: 1px;
            background: #eef2f7;
            margin: 13px 0;
          }

          .adp-auto-sync-row {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #111827;
            font-size: 12px;
            font-weight: 750;
          }

          .adp-auto-sync-row svg {
            color: #d9ad18;
          }

          .adp-toggle {
            width: 34px;
            height: 18px;
            border: 0;
            border-radius: 999px;
            background: #e5e7eb;
            padding: 2px;
            cursor: pointer;
          }

          .adp-toggle span {
            width: 14px;
            height: 14px;
            display: block;
            border-radius: 50%;
            background: #ffffff;
            transition: transform 0.16s ease;
          }

          .adp-toggle-on {
            background: #d9ad18;
          }

          .adp-toggle-on span {
            transform: translateX(16px);
          }

          .adp-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 16px;
          }

          .adp-card {
            min-height: 110px;
            background: #ffffff;
            border: 1px solid #dfe4ec;
            border-radius: 9px;
            padding: 13px 13px 12px;
            box-sizing: border-box;
          }

          .adp-card-head {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            min-height: 44px;
          }

          .adp-platform-icon {
            width: 24px;
            height: 24px;
            border-radius: 5px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
          }

          .adp-icon-meta {
            color: #0369a1;
            background: #e0f2fe;
          }

          .adp-icon-google {
            color: #0f172a;
            background: #f1f5f9;
          }

          .adp-icon-tiktok {
            color: #5b21b6;
            background: #ede9fe;
          }

          .adp-icon-snapchat {
            color: #111827;
            background: #fefce8;
          }

          .adp-icon-analytics {
            color: #15803d;
            background: #ecfdf5;
          }

          .adp-card-title-area {
            flex: 1;
            min-width: 0;
          }

          .adp-card-title-area h4 {
            margin: 0 0 3px;
            color: #111827;
            font-size: 13px;
            font-weight: 850;
          }

          .adp-card-title-area p {
            margin: 0;
            font-size: 10px;
            font-weight: 650;
          }

          .adp-connected {
            color: #059669;
            display: inline-flex;
            align-items: center;
            gap: 3px;
          }

          .adp-not-connected {
            color: #94a3b8;
          }

          .adp-card-icons {
            display: flex;
            gap: 6px;
          }

          .adp-card-icons button {
            width: 22px;
            height: 22px;
            border: 0;
            background: transparent;
            color: #64748b;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 5px;
          }

          .adp-card-icons button:hover {
            background: #f1f5f9;
            color: #111827;
          }

          .adp-card-body {
            padding-top: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .adp-connect-btn,
          .adp-outline-action {
            width: 100%;
            height: 30px;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
          }

          .adp-connect-btn {
            border: 1px solid #d9ad18;
            background: #d9ad18;
            color: #ffffff;
          }

          .adp-outline-action {
            border: 1px solid #dbe1ea;
            background: #ffffff;
            color: #334155;
          }

          .adp-metrics-line {
            font-size: 10px;
            font-weight: 700;
            color: #0f766e;
            background: #ecfdf5;
            border-radius: 5px;
            padding: 5px 7px;
          }

          .adp-error-line {
            font-size: 10px;
            font-weight: 650;
            color: #b45309;
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 5px;
            padding: 5px 7px;
            line-height: 1.4;
          }

          .adp-danger-link {
            height: 22px;
            border: 0;
            background: transparent;
            color: #ff6b6b;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 10px;
            font-weight: 750;
            cursor: pointer;
          }

          .adp-log-card {
            background: #ffffff;
            border: 1px solid #dfe4ec;
            border-radius: 9px;
            overflow: hidden;
          }

          .adp-log-header {
            height: 36px;
            padding: 0 13px;
            border-bottom: 1px solid #eef2f7;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .adp-log-header div {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #111827;
          }

          .adp-log-header strong {
            font-size: 12px;
            font-weight: 850;
          }

          .adp-log-header button {
            border: 0;
            background: transparent;
            color: #94a3b8;
            font-size: 10px;
            font-weight: 750;
            cursor: pointer;
          }

          .adp-log-list {
            min-height: 28px;
            padding: 7px 13px;
          }

          .adp-log-empty {
            margin: 0;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 650;
          }

          .adp-log-row {
            display: flex;
            align-items: center;
            gap: 8px;
            min-height: 22px;
          }

          .adp-log-row span {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 650;
          }

          .adp-log-row p {
            margin: 0;
            color: #111827;
            font-size: 11px;
            font-weight: 700;
          }

          .adp-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 3000;
            background: rgba(15, 23, 42, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
          }

          .adp-modal-card {
            width: 336px;
            max-width: calc(100vw - 28px);
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 16px 45px rgba(15, 23, 42, 0.25);
            padding: 17px 18px 18px;
            box-sizing: border-box;
          }

          .adp-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .adp-modal-header > div {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .adp-modal-header h2 {
            margin: 0;
            color: #111827;
            font-size: 14px;
            font-weight: 850;
          }

          .adp-modal-header button {
            width: 24px;
            height: 24px;
            border: 0;
            background: transparent;
            color: #94a3b8;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .adp-modal-alert {
            border: 1px solid #facc15;
            background: #fffbeb;
            color: #92400e;
            border-radius: 6px;
            padding: 9px 10px;
            font-size: 10px;
            font-weight: 650;
            line-height: 1.45;
            margin-bottom: 12px;
          }

          .adp-form-group {
            margin-bottom: 10px;
          }

          .adp-form-group label {
            display: block;
            margin-bottom: 5px;
            color: #334155;
            font-size: 10px;
            font-weight: 700;
          }

          .adp-form-group input {
            width: 100%;
            height: 28px;
            border: 1px solid #dbe1ea;
            background: #ffffff;
            border-radius: 7px;
            padding: 0 9px;
            box-sizing: border-box;
            font-size: 11px;
            font-weight: 500;
            color: #111827;
            outline: none;
            font-family: inherit;
          }

          .adp-form-group input:focus {
            border-color: #eab308;
            box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.35);
          }

          .adp-modal-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            padding-top: 6px;
          }

          .adp-cancel-btn,
          .adp-save-btn {
            height: 28px;
            border-radius: 7px;
            padding: 0 14px;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
          }

          .adp-cancel-btn {
            background: #ffffff;
            border: 1px solid #dbe1ea;
            color: #334155;
          }

          .adp-save-btn {
            background: #d9ad18;
            border: 1px solid #d9ad18;
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            gap: 7px;
          }

          .adp-spin {
            animation: adp-spin 1s linear infinite;
          }

          @keyframes adp-spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 1050px) {
            .adp-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 700px) {
            .adp-grid {
              grid-template-columns: 1fr;
            }

            .adp-header-main {
              flex-direction: column;
            }
          }
        `}
      </style>
    </div>
  );
};

export default AdPlatforms;