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

export { PLATFORM_DEFINITIONS, getCredentialSummary, buildPayload, normalizePlatform, extractPlatforms };
