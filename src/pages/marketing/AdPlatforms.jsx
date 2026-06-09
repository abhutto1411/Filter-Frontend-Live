import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
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
  marketingCreateAdPlatform,
  marketingListAdPlatforms,
  marketingSyncAdPlatform,
  marketingUpdateAdPlatform,
} from '../../services/superAdminMarketingApi';
import './MarketingUniversal.css';

const PLATFORM_DEFINITIONS = [
  {
    key: 'meta',
    title: 'Meta Ads',
    subtitle: 'Meta / Facebook ads integration',
    iconType: 'meta',
    color: '#0ea5e9',
    fields: [
      {
        name: 'accountId',
        label: 'Account Id',
        placeholder: 'Enter account id...',
        required: true,
      },
      {
        name: 'accessToken',
        label: 'Access Token',
        placeholder: 'Enter access token...',
        required: true,
      },
      {
        name: 'adAccountId',
        label: 'Ad Account Id',
        placeholder: 'Enter ad account id...',
        required: false,
      },
    ],
  },
  {
    key: 'google_ads',
    title: 'Google Ads',
    subtitle: 'Google ads integration',
    iconType: 'google',
    color: '#334155',
    fields: [
      {
        name: 'customerId',
        label: 'Customer Id',
        placeholder: 'Enter customer id...',
        required: true,
      },
      {
        name: 'developerToken',
        label: 'Developer Token',
        placeholder: 'Enter developer token...',
        required: true,
      },
      {
        name: 'clientId',
        label: 'Client Id',
        placeholder: 'Enter client id...',
        required: true,
      },
      {
        name: 'clientSecret',
        label: 'Client Secret',
        placeholder: 'Enter client secret...',
        required: true,
      },
      {
        name: 'refreshToken',
        label: 'Refresh Token',
        placeholder: 'Enter refresh token...',
        required: true,
      },
    ],
  },
  {
    key: 'tiktok',
    title: 'TikTok Ads',
    subtitle: 'TikTok ads integration',
    iconType: 'tiktok',
    color: '#7c3aed',
    fields: [
      {
        name: 'appId',
        label: 'App Id',
        placeholder: 'Enter app id...',
        required: true,
      },
      {
        name: 'secret',
        label: 'Secret',
        placeholder: 'Enter secret...',
        required: true,
      },
      {
        name: 'advertiserId',
        label: 'Advertiser Id',
        placeholder: 'Enter advertiser id...',
        required: true,
      },
      {
        name: 'accessToken',
        label: 'Access Token',
        placeholder: 'Enter access token...',
        required: true,
      },
    ],
  },
  {
    key: 'snapchat',
    title: 'Snapchat Ads',
    subtitle: 'Snapchat ads integration',
    iconType: 'snapchat',
    color: '#111827',
    fields: [
      {
        name: 'clientId',
        label: 'Client Id',
        placeholder: 'Enter client id...',
        required: true,
      },
      {
        name: 'clientSecret',
        label: 'Client Secret',
        placeholder: 'Enter client secret...',
        required: true,
      },
      {
        name: 'adAccountId',
        label: 'Ad Account Id',
        placeholder: 'Enter ad account id...',
        required: true,
      },
    ],
  },
  {
    key: 'google_analytics',
    title: 'Google Analytics',
    subtitle: 'Google analytics integration',
    iconType: 'analytics',
    color: '#16a34a',
    fields: [
      {
        name: 'measurementId',
        label: 'Measurement Id',
        placeholder: 'Enter measurement id...',
        required: true,
      },
      {
        name: 'apiSecret',
        label: 'Api Secret',
        placeholder: 'Enter api secret...',
        required: true,
      },
      {
        name: 'propertyId',
        label: 'Property Id',
        placeholder: 'Enter property id...',
        required: true,
      },
    ],
  },
];

const EMPTY_FORM = {};

function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalizePlatform(row) {
  return {
    id: String(row.id || ''),
    platform: row.platform || row.provider || 'other',
    accountName:
      row.accountName ||
      row.account_name ||
      row.platformName ||
      row.name ||
      'Ad Account',
    accountId: row.accountId || row.account_id || '',
    maskedToken:
      row.maskedToken ||
      row.masked_token ||
      row.accessToken ||
      row.token ||
      '',
    status: row.status || 'disconnected',
    connected: Boolean(row.connected) || row.status === 'connected',
    autoSync: Boolean(row.autoSync ?? row.auto_sync),
    syncStatus: row.syncStatus || row.sync_status || 'not_synced',
    lastSyncAt: row.lastSyncAt || row.last_sync_at || '',
    notes: row.notes || '',
  };
}

function extractPlatforms(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.platforms)
      ? payload.platforms
      : Array.isArray(payload?.adPlatforms)
        ? payload.adPlatforms
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.data?.platforms)
            ? payload.data.platforms
            : Array.isArray(payload?.data?.adPlatforms)
              ? payload.data.adPlatforms
              : [];

  return rows.map(normalizePlatform);
}

function formatTime(value) {
  if (!value) return 'Never';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Never';

  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCredentialSummary(definition, form) {
  if (definition.key === 'meta') {
    return {
      accountId: form.accountId || '',
      accessToken: form.accessToken || '',
      adAccountId: form.adAccountId || '',
    };
  }

  if (definition.key === 'google_ads') {
    return {
      customerId: form.customerId || '',
      developerToken: form.developerToken || '',
      clientId: form.clientId || '',
      clientSecret: form.clientSecret || '',
      refreshToken: form.refreshToken || '',
    };
  }

  if (definition.key === 'tiktok') {
    return {
      appId: form.appId || '',
      secret: form.secret || '',
      advertiserId: form.advertiserId || '',
      accessToken: form.accessToken || '',
    };
  }

  if (definition.key === 'snapchat') {
    return {
      clientId: form.clientId || '',
      clientSecret: form.clientSecret || '',
      adAccountId: form.adAccountId || '',
    };
  }

  return {
    measurementId: form.measurementId || '',
    apiSecret: form.apiSecret || '',
    propertyId: form.propertyId || '',
  };
}

function buildPayload(definition, form, autoSync) {
  const credentials = getCredentialSummary(definition, form);

  const accountId =
    credentials.accountId ||
    credentials.customerId ||
    credentials.advertiserId ||
    credentials.adAccountId ||
    credentials.measurementId ||
    credentials.propertyId ||
    '';

  const token =
    credentials.accessToken ||
    credentials.developerToken ||
    credentials.refreshToken ||
    credentials.clientSecret ||
    credentials.secret ||
    credentials.apiSecret ||
    '';

  return {
    platform: definition.key,
    provider: definition.key,
    platformName: definition.title,
    name: definition.title,
    accountName: definition.title,
    accountId,
    accessToken: token,
    token,
    refreshToken: credentials.refreshToken || undefined,
    status: 'connected',
    autoSync: Boolean(autoSync),
    spendLimit: 0,
    currencyCode: 'SAR',
    notes: JSON.stringify(
      {
        source: 'marketing_portal_ad_platform_modal',
        credentials,
      },
      null,
      2,
    ),
  };
}

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
  const [platforms, setPlatforms] = useState([]);
  const [logs, setLogs] = useState([]);
  const [autoSync, setAutoSync] = useState(false);

  const [activeDefinition, setActiveDefinition] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openConfigureModal = (definition) => {
    setActiveDefinition(definition);
    setForm({});
  };

  const closeModal = () => {
    if (saving) return;
    setActiveDefinition(null);
    setForm({});
  };

  const validateForm = () => {
    if (!activeDefinition) return false;

    const missing = activeDefinition.fields.find(
      (field) => field.required && !String(form[field.name] || '').trim(),
    );

    if (missing) {
      alert(`${missing.label} is required.`);
      return false;
    }

    return true;
  };

  const handleSaveConnection = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    const existing = platformMap.get(activeDefinition.key);
    const payload = buildPayload(activeDefinition, form, autoSync);

    try {
      setSaving(true);

      if (existing?.id) {
        await marketingUpdateAdPlatform(existing.id, payload);
      } else {
        await marketingCreateAdPlatform(payload);
      }

      addLog(`${activeDefinition.title} connected`);

      closeModal();
      await loadPlatforms();
    } catch (err) {
      alert(err?.message || 'Failed to connect platform.');
    } finally {
      setSaving(false);
    }
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
      openConfigureModal(definition);
      return;
    }

    if (existing.status !== 'connected') {
      alert('Connect this platform first.');
      return;
    }

    try {
      setActionLoading(definition.key);

      await marketingSyncAdPlatform(existing.id, {
        forceSync: true,
        syncMode: 'sync_campaign_metrics',
        notes: `Manual sync for ${definition.title}`,
      });

      addLog(`${definition.title} synced`);
      await loadPlatforms();
    } catch (err) {
      alert(err?.message || 'Failed to sync platform.');
    } finally {
      setActionLoading('');
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
        await marketingSyncAdPlatform(item.existing.id, {
          forceSync: true,
          syncMode: 'sync_campaign_metrics',
          notes: `Sync all triggered for ${item.definition.title}`,
        });
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
          <span>Auto-Sync</span>
          <Toggle enabled={autoSync} onClick={() => setAutoSync((prev) => !prev)} />
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
                    onClick={() => openConfigureModal(definition)}
                    disabled={busy}
                  >
                    <Settings size={13} />
                  </button>
                </div>
              </div>

              <div className="adp-card-body">
                {connected ? (
                  <>
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
                    onClick={() => openConfigureModal(definition)}
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

      {activeDefinition ? (
        <div className="adp-modal-overlay">
          <div className="adp-modal-card">
            <div className="adp-modal-header">
              <div>
                <PlatformIcon definition={activeDefinition} />
                <h2>Configure {activeDefinition.title}</h2>
              </div>

              <button type="button" onClick={closeModal}>
                <X size={17} />
              </button>
            </div>

            <div className="adp-modal-alert">
              Enter your {activeDefinition.title} API credentials. These are stored
              locally for metric sync.
            </div>

            <form onSubmit={handleSaveConnection}>
              {activeDefinition.fields.map((field, index) => (
                <div className="adp-form-group" key={field.name}>
                  <label>{field.label}</label>
                  <input
                    autoFocus={index === 0}
                    type={
                      /token|secret|password|apiSecret|developerToken/i.test(
                        field.name,
                      )
                        ? 'password'
                        : 'text'
                    }
                    value={form[field.name] || ''}
                    onChange={(event) => updateForm(field.name, event.target.value)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}

              <div className="adp-modal-footer">
                <button
                  type="button"
                  className="adp-cancel-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="adp-save-btn"
                  disabled={saving}
                >
                  <RefreshCw size={13} className={saving ? 'adp-spin' : ''} />
                  {saving ? 'Saving...' : 'Save & Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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