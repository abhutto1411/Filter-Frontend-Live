/**
 * DAR v6 proof URL + payload helpers. No FE row sums. No raw HTML.
 */

import {
  DAR_V6_OWNED_QUERY_KEYS,
  DAR_V6_PAGE_PATH,
  DAR_V6_PROOF_PATH,
  DAR_V6_PROOF_SCHEMA,
  DAR_V6_UNAVAILABLE,
  allowlistedProofApiHref,
  allowlistedSourceHref,
  classifyDarError,
  formatExactDecimal,
  formatMetricValue,
  isYmd,
  normalizeActorSource,
  parseIdList,
  serializeDarQuery,
  wrapProofHref,
} from './dailyActivityFormat.js';

export const DAR_V6_PROOF_REDUCERS = [
  'sum',
  'count_distinct',
  'ratio',
  'average',
  'formula',
  'unavailable',
];

export function readProofSearch(search) {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const limitRaw = Number(params.get('limit'));
  const asOfRaw = String(params.get('asOf') || '').trim();
  const asOfOk =
    /^\d{4}-\d{2}-\d{2}T/.test(asOfRaw) && !Number.isNaN(Date.parse(asOfRaw))
      ? new Date(asOfRaw).toISOString()
      : '';
  return {
    from: isYmd(from) ? from : '',
    to: isYmd(to) ? to : '',
    branchIds: parseIdList(params.get('branchIds')),
    sessionIds: parseIdList(params.get('sessionIds')),
    actorSource: normalizeActorSource(params.get('actorSource')),
    metricKey: String(params.get('metricKey') || '').trim(),
    snapshotToken: String(params.get('snapshotToken') || '').trim(),
    sourceFingerprint: String(params.get('sourceFingerprint') || '').trim(),
    clickedValue: String(params.get('clickedValue') || '').trim(),
    returnTab: safeDarReturnHash(params.get('returnTab')),
    asOf: asOfOk,
    cursor: String(params.get('cursor') || '').trim(),
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 200) : undefined,
  };
}

const DAR_V6_RETURN_TAB_IDS = new Set([
  'accumulated',
  'depts',
  'sessions',
  'finance',
  'operations',
]);

/** Allowlisted DAR section hash only. External / unknown targets → empty. */
export function safeDarReturnHash(raw) {
  const id = String(raw || '')
    .replace(/^#/, '')
    .trim();
  return DAR_V6_RETURN_TAB_IDS.has(id) ? id : '';
}

/**
 * Module-scoped one-shot reopen intent (survives StrictMode remount; consumed once).
 * Not a token mint — only carries the metric key the stale Refresh asked to reopen.
 */
let pendingReopenIntent = null;

export function captureReopenIntentFromSearch(searchParams) {
  const src =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(String(searchParams || '').replace(/^\?/, ''));
  const metricKey = String(src.get('reopenProof') || '')
    .replace(/[<>'"\\]/g, '')
    .trim();
  if (!metricKey) return false;
  pendingReopenIntent = {
    metricKey,
    clicked: String(src.get('proofClicked') || '')
      .replace(/[<>'"\\]/g, '')
      .trim()
      .slice(0, 64),
  };
  return true;
}

export function takeReopenIntent() {
  const intent = pendingReopenIntent;
  pendingReopenIntent = null;
  return intent;
}

/** Test-only: clear module intent between cases. */
export function resetReopenIntentForTests() {
  pendingReopenIntent = null;
}

/**
 * Ordinary return to DAR with filters + optional allowlisted tab hash.
 * Reopen controls are OFF by default — even when query.metricKey is set.
 * Pass opts.reopen === true (and reopenMetricKey) only for stale-proof Refresh.
 * Never follows opts.returnTo / external URLs (always DAR_V6_PAGE_PATH).
 */
export function reportHrefFromProofQuery(query, opts = {}) {
  const params = new URLSearchParams();
  if (isYmd(query.from)) params.set('from', query.from);
  if (isYmd(query.to)) params.set('to', query.to);
  const branches = (query.branchIds || []).filter((id) => /^\d+$/.test(String(id))).join(',');
  if (branches) params.set('branchIds', branches);
  const sessions = (query.sessionIds || []).filter((id) => /^\d+$/.test(String(id))).join(',');
  if (sessions) params.set('sessionIds', sessions);
  if (query.actorSource && query.actorSource !== 'all') params.set('actorSource', query.actorSource);
  const explicitReopen = opts.reopen === true;
  if (explicitReopen) {
    const metric = String(opts.reopenMetricKey || '')
      .replace(/[<>'"\\]/g, '')
      .trim();
    if (metric) params.set('reopenProof', metric);
    if (opts.clickedValue != null && opts.clickedValue !== '') {
      params.set(
        'proofClicked',
        String(opts.clickedValue).replace(/[<>'"\\]/g, '').trim().slice(0, 64),
      );
    }
  }
  const hash = safeDarReturnHash(opts.hash);
  const s = params.toString();
  const base = s ? `${DAR_V6_PAGE_PATH}?${s}` : DAR_V6_PAGE_PATH;
  return hash ? `${base}#${hash}` : base;
}

export function nextProofSearch(currentSearch, cursor) {
  const next = new URLSearchParams();
  const cur =
    currentSearch instanceof URLSearchParams
      ? currentSearch
      : new URLSearchParams(String(currentSearch || '').replace(/^\?/, ''));
  for (const key of [...DAR_V6_OWNED_QUERY_KEYS, 'metricKey', 'snapshotToken', 'asOf', 'limit']) {
    const v = cur.get(key);
    if (v) next.set(key, v);
  }
  if (cursor) next.set('cursor', String(cursor));
  return next;
}

export function validateProofPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'empty', code: 'BACKEND_UPDATE_REQUIRED' };
  }
  if (payload.schemaVersion !== DAR_V6_PROOF_SCHEMA) {
    return { ok: false, reason: 'schema', code: 'BACKEND_UPDATE_REQUIRED' };
  }
  for (const key of ['metric', 'snapshotToken', 'reducer', 'rows', 'fullResult', 'coverage']) {
    if (!(key in payload)) {
      return { ok: false, reason: `missing:${key}`, code: 'BACKEND_UPDATE_REQUIRED' };
    }
  }
  if (!DAR_V6_PROOF_REDUCERS.includes(payload.reducer)) {
    return { ok: false, reason: 'reducer', code: 'BACKEND_UPDATE_REQUIRED' };
  }
  if (!Array.isArray(payload.rows)) {
    return { ok: false, reason: 'rows', code: 'BACKEND_UPDATE_REQUIRED' };
  }
  return { ok: true, reason: null, code: null };
}

export function classifyProofError(err) {
  return classifyDarError(err);
}

export function serializeProofQuery(query) {
  return serializeDarQuery(query);
}

export function wrapOperandProofHref(rawHref, fallbackQuery = {}) {
  const be = allowlistedProofApiHref(rawHref);
  if (!be) return '';
  return wrapProofHref({ proof: { href: be } }, fallbackQuery);
}

export function safeSourceHref(rawHref) {
  return allowlistedSourceHref(rawHref);
}

/** Backend all-page reduction only. Never sum the current page of rows. */
export function proofFullResultDisplay(proof) {
  const fr = proof?.fullResult;
  if (!fr || typeof fr !== 'object') {
    return {
      rowCount: DAR_V6_UNAVAILABLE,
      reconciledValue: DAR_V6_UNAVAILABLE,
      difference: DAR_V6_UNAVAILABLE,
    };
  }
  return {
    rowCount: formatMetricValue(fr.rowCount),
    reconciledValue:
      fr.reconciledValue == null ? DAR_V6_UNAVAILABLE : formatExactDecimal(fr.reconciledValue),
    difference: fr.difference == null ? DAR_V6_UNAVAILABLE : formatExactDecimal(fr.difference),
  };
}

export function snapshotTokenPreview(token) {
  const s = String(token || '').trim();
  if (!s) return DAR_V6_UNAVAILABLE;
  return s.length <= 16 ? s : `${s.slice(0, 12)}…`;
}

export function proofPageHref(search) {
  const qs =
    search instanceof URLSearchParams
      ? search.toString()
      : String(search || '').replace(/^\?/, '');
  return qs ? `${DAR_V6_PROOF_PATH}?${qs}` : DAR_V6_PROOF_PATH;
}
