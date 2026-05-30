import { apiFetch } from './api';

function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '' && String(v) !== 'undefined') p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

const ROOT = '/super-admin-marketing-protal';

/** @param {Record<string, string|number|undefined|null>} params */
export const marketingListBranches = (params = {}) => apiFetch(`${ROOT}/branches${qs(params)}`);

/** @param {Record<string, string|number|undefined|null>} params */
export const marketingListTargetZones = (params = {}) => apiFetch(`${ROOT}/target-zones${qs(params)}`);

/** @param {Record<string, string|number|undefined|null>} params */
export const marketingListTargetProducts = (params = {}) => apiFetch(`${ROOT}/target-products${qs(params)}`);

/** @param {Record<string, string|number|undefined|null>} params */
export const marketingListRewardItems = (params = {}) => apiFetch(`${ROOT}/reward-items${qs(params)}`);

export const marketingCreatePromoCode = (body) =>
    apiFetch(`${ROOT}/promo-codes`, { method: 'POST', body: JSON.stringify(body) });

/** @param {Record<string, string|number|undefined|null>} params */
export const marketingListPromoCodes = (params = {}) => apiFetch(`${ROOT}/promo-codes${qs(params)}`);

export const marketingGetPromoCode = (id) => apiFetch(`${ROOT}/promo-codes/${encodeURIComponent(String(id))}`);

export const marketingUpdatePromoCode = (id, body) =>
    apiFetch(`${ROOT}/promo-codes/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const marketingDeletePromoCode = (id) =>
    apiFetch(`${ROOT}/promo-codes/${encodeURIComponent(String(id))}`, { method: 'DELETE' });

/** @param {{ workshopId: string }} params */
export const marketingGeneratePromoAutoCode = (params) =>
    apiFetch(`${ROOT}/promo-codes/auto-code/generate${qs(params)}`);

export const marketingCreatePromotion = (body) =>
    apiFetch(`${ROOT}/promotions`, { method: 'POST', body: JSON.stringify(body) });

/** @param {Record<string, string|number|undefined|null>} params */
export const marketingListPromotions = (params = {}) => apiFetch(`${ROOT}/promotions${qs(params)}`);

export const marketingGetPromotion = (id) => apiFetch(`${ROOT}/promotions/${encodeURIComponent(String(id))}`);

export const marketingUpdatePromotion = (id, body) =>
    apiFetch(`${ROOT}/promotions/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const marketingDeletePromotion = (id) =>
    apiFetch(`${ROOT}/promotions/${encodeURIComponent(String(id))}`, { method: 'DELETE' });

export const marketingCreateReferrer = (body) =>
    apiFetch(`${ROOT}/referrers`, { method: 'POST', body: JSON.stringify(body) });

/** @param {Record<string, string|number|undefined|null>} params */
export const marketingListReferrers = (params = {}) => apiFetch(`${ROOT}/referrers${qs(params)}`);

export const marketingGetReferrer = (id) => apiFetch(`${ROOT}/referrers/${encodeURIComponent(String(id))}`);

export const marketingUpdateReferrer = (id, body) =>
    apiFetch(`${ROOT}/referrers/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const marketingDeleteReferrer = (id) =>
    apiFetch(`${ROOT}/referrers/${encodeURIComponent(String(id))}`, { method: 'DELETE' });

export const marketingCreateLoyaltyProgram = (body) =>
    apiFetch(`${ROOT}/loyalty-programs`, { method: 'POST', body: JSON.stringify(body) });

/** @param {Record<string, string|number|undefined|null>} params */
export const marketingListLoyaltyPrograms = (params = {}) => apiFetch(`${ROOT}/loyalty-programs${qs(params)}`);

export const marketingGetLoyaltyProgram = (id) =>
    apiFetch(`${ROOT}/loyalty-programs/${encodeURIComponent(String(id))}`);

export const marketingUpdateLoyaltyProgram = (id, body) =>
    apiFetch(`${ROOT}/loyalty-programs/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const marketingDeleteLoyaltyProgram = (id) =>
    apiFetch(`${ROOT}/loyalty-programs/${encodeURIComponent(String(id))}`, { method: 'DELETE' });

/** @param {Record<string, string|number|undefined|null>} params */
export const marketingGetCustomerInsights = (params = {}) => apiFetch(`${ROOT}/customer-insights${qs(params)}`);

/** @param {Record<string, string|number|undefined|null>} params */
export const marketingGetDashboard = (params = {}) => apiFetch(`${ROOT}/dashboard${qs(params)}`);

/** @param {{ recentReferrals?: number, recentReferrers?: number }} params */
export const marketingGetReferralManagementDashboard = (params = {}) =>
    apiFetch(`${ROOT}/referral_management_dashboard${qs(params)}`);

/** @param {{ workshopId: string, tableLimit?: number }} params */
export const marketingGetReferralCommissionsDashboard = (params) =>
    apiFetch(`${ROOT}/referral-commissions/dashboard${qs(params)}`);

export const marketingLookupReferralCommissionsDashboard = (body) =>
    apiFetch(`${ROOT}/referral-commissions/dashboard/lookup`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

/** @param {{ workshopId: string }} params */
export const marketingListReferralLedgerAccounts = (params) =>
    apiFetch(`${ROOT}/referral-marketing/ledger-accounts${qs(params)}`);

export const marketingLookupReferralLedgerAccounts = (body) =>
    apiFetch(`${ROOT}/referral-marketing/ledger-accounts/lookup`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

/** @param {{ workshopId: string }} params */
export const marketingGetReferralMarketingSettings = (params) =>
    apiFetch(`${ROOT}/referral-marketing/settings${qs(params)}`);

export const marketingLookupReferralMarketingSettings = (body) =>
    apiFetch(`${ROOT}/referral-marketing/settings/lookup`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const marketingUpsertReferralMarketingSettings = (body) =>
    apiFetch(`${ROOT}/referral-marketing/settings`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
