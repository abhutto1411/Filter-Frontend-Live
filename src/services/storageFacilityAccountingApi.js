import { apiFetch } from './api';

const base = (brandId) =>
    `/supplier/storage-facility/brands/${encodeURIComponent(brandId)}/accounting`;

function withQuery(path, params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    const qs = q.toString();
    return qs ? `${path}?${qs}` : path;
}

export function unwrapBrandAccounts(res) {
    if (Array.isArray(res?.accounts)) return res.accounts;
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

export const getBrandAccounts = (brandId, params = {}) =>
    apiFetch(withQuery(`${base(brandId)}/accounts`, params));

export const createBrandAccount = (brandId, body) =>
    apiFetch(`${base(brandId)}/accounts`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateBrandAccount = (brandId, accountId, body) =>
    apiFetch(`${base(brandId)}/accounts/${encodeURIComponent(accountId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const deleteBrandAccount = (brandId, accountId) =>
    apiFetch(`${base(brandId)}/accounts/${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
    });

export const getBrandTrialBalance = (brandId, params = {}) =>
    apiFetch(withQuery(`${base(brandId)}/reports/trial-balance`, params));

export const getBrandProfitLoss = (brandId, params = {}) =>
    apiFetch(withQuery(`${base(brandId)}/reports/profit-loss`, params));

export const getBrandBalanceSheet = (brandId, params = {}) =>
    apiFetch(withQuery(`${base(brandId)}/reports/balance-sheet`, params));

export const getBrandCashBankRegisters = (brandId) =>
    apiFetch(`${base(brandId)}/cash-bank-registers`);

export const getBrandAccountLedger = (brandId, accountId, params = {}) =>
    apiFetch(withQuery(`${base(brandId)}/accounts/${encodeURIComponent(accountId)}/ledger`, params));

export const postBrandPayment = (brandId, body) =>
    apiFetch(`${base(brandId)}/hub/payments`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const postBrandReceipt = (brandId, body) =>
    apiFetch(`${base(brandId)}/hub/receipts`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const postBrandGeneralJournal = (brandId, body) =>
    apiFetch(`${base(brandId)}/hub/journals`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const listBrandPayments = (brandId, params = {}) =>
    apiFetch(withQuery(`${base(brandId)}/logs/payments`, params));

export const listBrandReceipts = (brandId, params = {}) =>
    apiFetch(withQuery(`${base(brandId)}/logs/receipts`, params));

export const listBrandGeneralJournals = (brandId, params = {}) =>
    apiFetch(withQuery(`${base(brandId)}/logs/journals`, params));

export const getBrandJournalById = (brandId, journalId) =>
    apiFetch(`${base(brandId)}/journals/${encodeURIComponent(journalId)}`);
