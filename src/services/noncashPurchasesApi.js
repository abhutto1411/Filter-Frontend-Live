import { apiFetch, BASE_URL, getAuthToken } from './api';
import { mergeAccountingScopeParams } from '../utils/accountingWorkshopScope';

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(mergeAccountingScopeParams(params)).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

/** GET /accounting/noncash-purchases — P-A20A queue */
export const listNoncashPurchases = (params = {}) =>
  apiFetch(withQuery('/accounting/noncash-purchases', params));

/** GET /accounting/noncash-purchases/:id — never writes on backend */
export const getNoncashPurchase = (id, params = {}) =>
  apiFetch(
    withQuery(
      `/accounting/noncash-purchases/${encodeURIComponent(String(id))}`,
      params,
    ),
  );

/** GET /accounting/noncash-purchases/:id/proof — blob (inline data URL). */
export async function getNoncashPurchaseProofBlob(id, params = {}) {
  const path = withQuery(
    `/accounting/noncash-purchases/${encodeURIComponent(String(id))}/proof`,
    params,
  );
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: {
      Accept: '*/*',
      ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Proof ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** POST /accounting/noncash-purchases/:id/approve */
export const approveNoncashPurchase = (id, body = {}) =>
  apiFetch(
    `/accounting/noncash-purchases/${encodeURIComponent(String(id))}/approve`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );

/** POST /accounting/noncash-purchases/:id/reject */
export const rejectNoncashPurchase = (id, body = {}) =>
  apiFetch(
    `/accounting/noncash-purchases/${encodeURIComponent(String(id))}/reject`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );

/** POST /accounting/noncash-purchases/:id/reverse */
export const reverseNoncashPurchase = (id, body = {}) =>
  apiFetch(
    `/accounting/noncash-purchases/${encodeURIComponent(String(id))}/reverse`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
