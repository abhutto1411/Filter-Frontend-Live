import { apiFetch } from './api';

/**
 * Super Admin (platform_admin) READ-ONLY monitoring of any supplier's books.
 * Mirrors the supplier-facing accounting endpoints, scoped by `supplierId`.
 */

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

const BASE = '/super-admin/supplier-accounting';

export const monitorSupplierAccounts = (supplierId, params = {}) =>
    apiFetch(withQuery(`${BASE}/accounts`, { supplierId, ...params }));

export const monitorSupplierAccountsTree = (supplierId) =>
    apiFetch(withQuery(`${BASE}/accounts/tree`, { supplierId }));

export const monitorSupplierAccountLedger = (supplierId, id, params = {}) =>
    apiFetch(withQuery(`${BASE}/accounts/${encodeURIComponent(id)}/ledger`, { supplierId, ...params }));

export const monitorSupplierPayments = (supplierId, params = {}) =>
    apiFetch(withQuery(`${BASE}/logs/payments`, { supplierId, ...params }));

export const monitorSupplierReceipts = (supplierId, params = {}) =>
    apiFetch(withQuery(`${BASE}/logs/receipts`, { supplierId, ...params }));

export const monitorSupplierJournals = (supplierId, params = {}) =>
    apiFetch(withQuery(`${BASE}/logs/journals`, { supplierId, ...params }));

export const monitorSupplierAllJournals = (supplierId, params = {}) =>
    apiFetch(withQuery(`${BASE}/logs/all`, { supplierId, ...params }));

export const monitorSupplierTrialBalance = (supplierId, params = {}) =>
    apiFetch(withQuery(`${BASE}/reports/trial-balance`, { supplierId, ...params }));

export const monitorSupplierPL = (supplierId, params = {}) =>
    apiFetch(withQuery(`${BASE}/reports/pl`, { supplierId, ...params }));

export const monitorSupplierBalanceSheet = (supplierId, params = {}) =>
    apiFetch(withQuery(`${BASE}/reports/balance-sheet`, { supplierId, ...params }));

export const monitorSupplierCashFlow = (supplierId, params = {}) =>
    apiFetch(withQuery(`${BASE}/reports/cash-flow`, { supplierId, ...params }));

export const monitorSupplierVat = (supplierId, params = {}) =>
    apiFetch(withQuery(`${BASE}/reports/vat`, { supplierId, ...params }));
