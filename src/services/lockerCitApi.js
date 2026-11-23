import { apiFetch } from './api';

const qs = (params = {}) => {
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
    );
    if (!entries.length) return '';
    const search = new URLSearchParams(
        entries.map(([k, v]) => [k, String(v)]),
    ).toString();
    return `?${search}`;
};

/** GET /locker/cit/summary — Cash in Transit by officer (P-A19A) */
export const getLockerCitSummary = (params = {}) =>
    apiFetch(`/locker/cit/summary${qs(params)}`);

/** GET /locker/cit/my-wallet */
export const getLockerCitMyWallet = (params = {}) =>
    apiFetch(`/locker/cit/my-wallet${qs(params)}`);

/** GET /locker/cit/officers/:officerId/wallet */
export const getLockerCitOfficerWallet = (officerId, params = {}) =>
    apiFetch(
        `/locker/cit/officers/${encodeURIComponent(String(officerId))}/wallet${qs(params)}`,
    );

/** GET /locker/cit/handovers */
export const listLockerCitHandovers = (params = {}) =>
    apiFetch(`/locker/cit/handovers${qs(params)}`);

/**
 * POST /locker/cit/receive
 * Body: officerUserId, destination, countedAmount, collectionIds?,
 * cashBankAccountId?, slipNo?, proofUrl?, notes?, idempotencyKey?
 */
export const receiveLockerCit = (body) =>
    apiFetch('/locker/cit/receive', {
        method: 'POST',
        body: JSON.stringify(body || {}),
    });

/** POST /locker/cit/handovers/:id/reverse */
export const reverseLockerCitHandover = (id, body = {}) =>
    apiFetch(`/locker/cit/handovers/${encodeURIComponent(String(id))}/reverse`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
    });
