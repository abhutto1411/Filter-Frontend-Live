/**
 * DAR v6 adapter. Uses the existing authenticated client — no new base URL.
 */

import { apiFetch } from '../../../services/api';
import {
  buildRequestKey,
  classifyDarError,
  serializeDarQuery,
  validateReportPayload,
} from './dailyActivityFormat.js';
import { validateProofPayload } from './dailyActivityProof.js';

export { serializeDarQuery, isStaleRequest } from './dailyActivityFormat.js';

export const DAR_V6_REPORT_PATH = '/workshop-staff/reports/daily-activity/v6';
export const DAR_V6_PROOF_API_PATH = '/workshop-staff/reports/daily-activity/v6/proof';
export const DAR_V6_VERIFY_API_PATH = '/workshop-staff/reports/daily-activity/v6/verify';
export const DAR_V6_CONTRACT_SHA256 =
  'de5e81747c06701d63ad0e61cbc7ea804647e62e3f1ebf9512239a2ac318c8a0';

export async function fetchDailyActivityV6(query, options = {}) {
  const key = buildRequestKey(query);
  try {
    const payload = await apiFetch(`${DAR_V6_REPORT_PATH}${serializeDarQuery(query)}`, {
      signal: options.signal,
    });
    const check = validateReportPayload(payload);
    if (!check.ok) {
      const err = new Error('DAR v6 contract mismatch');
      err.status = 404;
      err.code = check.code;
      err.kind = 'backend';
      err.requestKey = key;
      throw err;
    }
    return { payload, requestKey: key, stale: false };
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    err.requestKey = key;
    err.classified = classifyDarError(err);
    throw err;
  }
}

export async function fetchDailyActivityV6Verify(query, options = {}) {
  const key = [
    query?.snapshotToken || '',
    query?.sourceFingerprint || '',
    serializeDarQuery(query),
  ].join('|');
  try {
    const payload = await apiFetch(`${DAR_V6_VERIFY_API_PATH}${serializeDarQuery(query)}`, {
      signal: options.signal,
    });
    if (!payload || payload.schemaVersion !== 'dar.v6.verify') {
      const err = new Error('DAR v6 verify contract mismatch');
      err.status = 404;
      err.code = 'BACKEND_UPDATE_REQUIRED';
      err.kind = 'backend';
      err.requestKey = key;
      throw err;
    }
    return { payload, requestKey: key };
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    err.requestKey = key;
    err.classified = classifyDarError(err);
    throw err;
  }
}

export async function fetchDailyActivityV6Proof(query, options = {}) {
  const key = [
    query?.metricKey || '',
    query?.snapshotToken || '',
    query?.cursor || '',
    query?.from || '',
    query?.to || '',
    serializeDarQuery(query),
  ].join('|');
  try {
    const payload = await apiFetch(`${DAR_V6_PROOF_API_PATH}${serializeDarQuery(query)}`, {
      signal: options.signal,
    });
    const check = validateProofPayload(payload);
    if (!check.ok) {
      const err = new Error('DAR v6 proof contract mismatch');
      err.status = 404;
      err.code = check.code;
      err.kind = 'backend';
      err.requestKey = key;
      throw err;
    }
    return { payload, requestKey: key, stale: false };
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    err.requestKey = key;
    err.classified = classifyDarError(err);
    throw err;
  }
}
