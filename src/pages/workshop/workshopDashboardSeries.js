/**
 * Dashboard sales/activity series helpers. Pure — no React, no network.
 * Grain rules match GET /workshop-staff/dashboard/series.
 */

export const DASH_SERIES_TZ = 'Asia/Riyadh';
export const DASH_MAX_HOURLY_MS = 72 * 60 * 60 * 1000;
export const DASH_MAX_DAILY_MS = 400 * 24 * 60 * 60 * 1000;
export const DASH_SERIES_REFRESH_MS = 30_000;

export function parseDashboardGrain(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'hourly' || s === 'daily' || s === 'monthly') return s;
  return '';
}

export function dashboardAllowedGrains({ startIso, endIso, instantWindow }) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ['daily', 'monthly'];
  }
  const ms = end.getTime() - start.getTime();
  const allowed = ['monthly'];
  if (ms <= DASH_MAX_DAILY_MS) allowed.unshift('daily');
  if (instantWindow && ms > 0 && ms <= DASH_MAX_HOURLY_MS) {
    allowed.unshift('hourly');
  }
  return allowed;
}

export function coerceDashboardGrain(requested, allowed) {
  const list = Array.isArray(allowed) && allowed.length ? allowed : ['monthly'];
  const g = parseDashboardGrain(requested);
  if (g && list.includes(g)) return g;
  return list[0];
}

/** Series whitelist: range + branch + grain + compare. Never `basis`. */
export function dashboardSeriesQueryParams({
  rangeParams,
  branchId,
  grain,
  compare,
} = {}) {
  const q = { ...(rangeParams && typeof rangeParams === 'object' ? rangeParams : {}) };
  if (branchId && branchId !== 'all') q.branchId = String(branchId);
  const g = parseDashboardGrain(grain);
  if (g) q.grain = g;
  q.compare = String(compare || '').trim().toLowerCase() === 'none' ? 'none' : 'previous';
  return q;
}

export function seriesHasBasis(params) {
  return Object.prototype.hasOwnProperty.call(params || {}, 'basis');
}

export function formatDashBucketLabel(key, grain, locale) {
  const raw = String(key || '');
  const loc = locale === 'ar' ? 'ar-SA' : 'en-GB';
  const opts = { timeZone: DASH_SERIES_TZ };
  if (grain === 'monthly' && /^\d{4}-\d{2}$/.test(raw)) {
    const dt = new Date(`${raw}-01T00:00:00+03:00`);
    if (Number.isNaN(dt.getTime())) return raw;
    return new Intl.DateTimeFormat(loc, { ...opts, month: 'short', year: 'numeric' }).format(dt);
  }
  if (grain === 'hourly' && /^\d{4}-\d{2}-\d{2}T\d{2}/.test(raw)) {
    const hm = raw.match(/T(\d{2})/);
    return hm ? `${hm[1]}:00` : raw;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const dt = new Date(`${raw}T00:00:00+03:00`);
    if (Number.isNaN(dt.getTime())) return raw;
    return new Intl.DateTimeFormat(loc, { ...opts, month: 'short', day: 'numeric' }).format(dt);
  }
  return raw;
}

export function formatRiyadhDateTime(iso, locale) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const loc = locale === 'ar' ? 'ar-SA' : 'en-GB';
  return new Intl.DateTimeFormat(loc, {
    timeZone: DASH_SERIES_TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(d);
}

export function chartUnknownNotZero(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function sumFinite(values) {
  let s = 0;
  for (const v of values || []) {
    const n = Number(v);
    if (Number.isFinite(n)) s = Math.round((s + n) * 100) / 100;
  }
  return s;
}

export function salesChartRows(buckets, grain, locale, vatMode) {
  const useInc = vatMode === 'inc';
  return (buckets || []).map((b) => {
    const current = chartUnknownNotZero(useInc ? b.netIncVat : b.netExVat);
    const previous = chartUnknownNotZero(useInc ? b.previousNetIncVat : b.previousNetExVat);
    return {
      key: b.key,
      label: formatDashBucketLabel(b.key, grain, locale),
      current,
      previous,
      grossExVat: chartUnknownNotZero(b.grossExVat),
      returnsExVat: chartUnknownNotZero(b.returnsExVat),
      netExVat: chartUnknownNotZero(b.netExVat),
      netIncVat: chartUnknownNotZero(b.netIncVat),
    };
  });
}

export function activityChartRows(buckets, grain, locale) {
  return (buckets || []).map((b) => ({
    key: b.key,
    label: formatDashBucketLabel(b.key, grain, locale),
    current: chartUnknownNotZero(b.jobCount),
    previous: chartUnknownNotZero(b.previousJobCount),
  }));
}

export function paymentMethodKey(method) {
  const s = String(method || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!s) return 'unknown';
  if (s === 'cash') return 'cash';
  if (s === 'card' || s === 'credit_card' || s === 'visa' || s === 'mastercard') return 'card';
  if (s === 'mada') return 'mada';
  if (s === 'bank_transfer' || s === 'transfer' || s === 'bank') return 'transfer';
  if (s === 'tabby') return 'tabby';
  if (s === 'tamara') return 'tamara';
  return 'other';
}

export function shouldSkipHiddenRefresh(visibilityState) {
  return String(visibilityState || '') === 'hidden';
}

export function dashboardContextKey({
  branchId,
  rangeFrom,
  rangeTo,
  grain,
  compare,
  basis,
} = {}) {
  return [
    branchId == null || branchId === '' ? 'all' : String(branchId),
    String(rangeFrom || ''),
    String(rangeTo || ''),
    String(grain || ''),
    String(compare || ''),
    basis == null ? '' : String(basis),
  ].join('|');
}

export function isSeriesContextMatch(payload, expected) {
  if (!payload || !expected) return false;
  const payloadBranch =
    payload.branchId == null || payload.branchId === ''
      ? 'all'
      : String(payload.branchId);
  const expectedBranch =
    expected.branchId == null || expected.branchId === '' || expected.branchId === 'all'
      ? 'all'
      : String(expected.branchId);
  if (payloadBranch !== expectedBranch) return false;
  if (expected.grain && payload.grain && payload.grain !== expected.grain && !payload.grainCoerced) {
    return false;
  }
  if (expected.compare && payload.compare && payload.compare !== expected.compare) {
    return false;
  }
  if (expected.rangeStart && payload.rangeStart && payload.rangeStart !== expected.rangeStart) {
    return false;
  }
  if (expected.rangeEnd && payload.rangeEnd && payload.rangeEnd !== expected.rangeEnd) {
    return false;
  }
  return true;
}

export function lowStockPanelState({
  loading,
  error,
  unauthorized,
  items,
  contextMatch,
} = {}) {
  if (unauthorized) return 'unauthorized';
  if (error) return 'error';
  if (!contextMatch) return loading ? 'loading' : 'stale';
  if (loading && items == null) return 'loading';
  if (!Array.isArray(items)) return 'unavailable';
  if (items.length === 0) return 'empty';
  return 'rows';
}
