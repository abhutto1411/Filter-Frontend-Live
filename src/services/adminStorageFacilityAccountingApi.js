import { apiFetch } from './api';
import { unwrapBrandAccounts } from './storageFacilityAccountingApi';

function withQuery(path, params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    const qs = q.toString();
    return qs ? `${path}?${qs}` : path;
}

function baseFor(supplierId, brandId) {
    return `/super-admin/storage-facility/${encodeURIComponent(String(supplierId))}/brands/${encodeURIComponent(brandId)}/accounting`;
}

/** Super-admin storage facility accounting API — scoped to supplier + brand. */
export function createAdminStorageFacilityAccountingApi(supplierId) {
    const base = (brandId) => baseFor(supplierId, brandId);

    return {
        unwrapBrandAccounts,

        getBrandAccounts: (brandId, params = {}) =>
            apiFetch(withQuery(`${base(brandId)}/accounts`, params)),

        createBrandAccount: (brandId, body) =>
            apiFetch(`${base(brandId)}/accounts`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateBrandAccount: (brandId, accountId, body) =>
            apiFetch(`${base(brandId)}/accounts/${encodeURIComponent(accountId)}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            }),

        deleteBrandAccount: (brandId, accountId) =>
            apiFetch(`${base(brandId)}/accounts/${encodeURIComponent(accountId)}`, {
                method: 'DELETE',
            }),

        getBrandTrialBalance: (brandId, params = {}) =>
            apiFetch(withQuery(`${base(brandId)}/reports/trial-balance`, params)),

        getBrandProfitLoss: (brandId, params = {}) =>
            apiFetch(withQuery(`${base(brandId)}/reports/profit-loss`, params)),

        getBrandBalanceSheet: (brandId, params = {}) =>
            apiFetch(withQuery(`${base(brandId)}/reports/balance-sheet`, params)),

        getBrandCashBankRegisters: (brandId) =>
            apiFetch(`${base(brandId)}/cash-bank-registers`),

        getBrandAccountLedger: (brandId, accountId, params = {}) =>
            apiFetch(
                withQuery(`${base(brandId)}/accounts/${encodeURIComponent(accountId)}/ledger`, params),
            ),

        postBrandPayment: (brandId, body) =>
            apiFetch(`${base(brandId)}/hub/payments`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        postBrandReceipt: (brandId, body) =>
            apiFetch(`${base(brandId)}/hub/receipts`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        postBrandGeneralJournal: (brandId, body) =>
            apiFetch(`${base(brandId)}/hub/journals`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        listBrandPayments: (brandId, params = {}) =>
            apiFetch(withQuery(`${base(brandId)}/logs/payments`, params)),

        listBrandReceipts: (brandId, params = {}) =>
            apiFetch(withQuery(`${base(brandId)}/logs/receipts`, params)),

        listBrandGeneralJournals: (brandId, params = {}) =>
            apiFetch(withQuery(`${base(brandId)}/logs/journals`, params)),

        getBrandJournalById: (brandId, journalId) =>
            apiFetch(`${base(brandId)}/journals/${encodeURIComponent(journalId)}`),
    };
}
