import { apiFetch } from './api';

const BASE = '/workshop/purchase-quotes';

function withQuery(path, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

export const listWorkshopPurchaseQuotes = (params = {}) =>
    apiFetch(withQuery(BASE, { ...params, _t: Date.now() }));

export const getWorkshopPurchaseQuote = (id) =>
    apiFetch(`${BASE}/${encodeURIComponent(id)}`);

export const createWorkshopPurchaseQuote = (body) =>
    apiFetch(BASE, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateWorkshopPurchaseQuote = (id, body) =>
    apiFetch(`${BASE}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });

export const sendWorkshopPurchaseQuote = (id) =>
    apiFetch(`${BASE}/${encodeURIComponent(id)}/send`, {
        method: 'POST',
    });

export const acceptWorkshopPurchaseQuote = (id) =>
    apiFetch(`${BASE}/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
    });

export const rejectWorkshopPurchaseQuote = (id) =>
    apiFetch(`${BASE}/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
    });

export const listWorkshopPurchaseQuoteCatalog = (params = {}) =>
    apiFetch(withQuery(`${BASE}/catalog`, params));
