import { apiFetch } from './api';
import { mergeAccountingScopeParams } from '../utils/accountingWorkshopScope';

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(mergeAccountingScopeParams(params)).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => query.append(key, String(v)));
      } else {
        query.set(key, String(value));
      }
    }
  });
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

/** GET /workshop-accounting/opening-balance/status — P-A15A */
export const getOpeningBalanceStatus = (params = {}) =>
  apiFetch(withQuery('/workshop-accounting/opening-balance/status', params));

/** POST /workshop-accounting/opening-balance/preview — dry-run, writes nothing */
export const previewOpeningBalance = (body = {}) =>
  apiFetch('/workshop-accounting/opening-balance/preview', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** POST /workshop-accounting/opening-balance/post */
export const postOpeningBalance = (body = {}) =>
  apiFetch('/workshop-accounting/opening-balance/post', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** GET /workshop-accounting/opening-balance/workspace */
export const getOpeningBalanceWorkspace = (params = {}) =>
  apiFetch(withQuery('/workshop-accounting/opening-balance/workspace', params));

/** GET /workshop-accounting/opening-balance/subledger/:kind */
export const getOpeningBalanceSubledger = (kind, params = {}) =>
  apiFetch(
    withQuery(
      `/workshop-accounting/opening-balance/subledger/${encodeURIComponent(kind)}`,
      params,
    ),
  );

/** PUT /workshop-accounting/opening-balance/draft */
export const saveOpeningBalanceDraft = (body = {}) =>
  apiFetch('/workshop-accounting/opening-balance/draft', {
    method: 'PUT',
    body: JSON.stringify(body),
  });

/** POST /workshop-accounting/opening-balance/reverse */
export const reverseOpeningBalance = (body = {}) =>
  apiFetch('/workshop-accounting/opening-balance/reverse', {
    method: 'POST',
    body: JSON.stringify(body),
  });
