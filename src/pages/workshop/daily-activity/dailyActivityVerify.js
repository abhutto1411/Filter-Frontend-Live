/**
 * DAR v6 FE verify helpers. Does not invent money. Status comes from the server.
 */

import { classifyDarError, formatDarErrorDetail } from './dailyActivityFormat.js';

export const DAR_V6_VERIFY_API_PATH = '/workshop-staff/reports/daily-activity/v6/verify';

export const VERIFY_OVERALL = [
  'unverified',
  'running',
  'matched',
  'partial',
  'mismatch',
  'missing',
  'stale',
  'error',
];

export function verifyStatusFromPayload(payload, capturedSnapshotToken) {
  if (!payload) return 'unverified';
  if (payload.snapshotToken && capturedSnapshotToken && payload.snapshotToken !== capturedSnapshotToken) {
    return 'stale';
  }
  const overall = String(payload.overallStatus || '').toLowerCase();
  if (VERIFY_OVERALL.includes(overall)) return overall;
  return 'error';
}

export function shouldAbortVerify(activeKey, requestKey) {
  return Boolean(activeKey) && activeKey !== requestKey;
}

export function serializeVerifyQuery(query) {
  const p = new URLSearchParams();
  if (query.from) p.set('from', query.from);
  if (query.to) p.set('to', query.to);
  if (query.branchIds?.length) p.set('branchIds', query.branchIds.join(','));
  if (query.sessionIds?.length) p.set('sessionIds', query.sessionIds.join(','));
  if (query.actorSource) p.set('actorSource', query.actorSource);
  if (query.snapshotToken) p.set('snapshotToken', query.snapshotToken);
  if (query.sourceFingerprint) p.set('sourceFingerprint', query.sourceFingerprint);
  if (query.asOf) p.set('asOf', query.asOf);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Bind verify to the captured report freeze instant. Missing asOf remints a new token (409). */
export function buildVerifyQueryFromCaptured(applied, captured) {
  const meta = captured?.meta || {};
  return {
    from: applied?.from,
    to: applied?.to,
    branchIds: applied?.branchIds,
    sessionIds: applied?.sessionIds,
    actorSource: applied?.actorSource,
    snapshotToken: meta.snapshotToken,
    sourceFingerprint: meta.sourceFingerprint,
    asOf: meta.asOf,
  };
}

export function sanitizeVerifyReason(text) {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (/authorization|bearer |access_token|id_token/i.test(s)) return '';
  s = s.replace(/snapshotToken=[^&\s]+/gi, 'snapshotToken=(omitted)');
  if (s.length > 220) return `${s.slice(0, 217)}…`;
  return s;
}

export function verifyErrorPayload(captured, err) {
  const classified = err?.classified || classifyDarError(err);
  const reasons = [];
  if (classified.kind === 'snapshot') reasons.push('snapshot');
  const detail = sanitizeVerifyReason(formatDarErrorDetail(err));
  if (detail) reasons.push(detail);
  if (!reasons.length) reasons.push(classified.kind || 'error');
  return {
    schemaVersion: 'dar.v6.verify',
    overallStatus: 'error',
    snapshotToken: captured?.meta?.snapshotToken || null,
    metrics: [],
    reasons,
    httpStatus: classified.status || err?.status || null,
    code: classified.code || err?.code || null,
  };
}
