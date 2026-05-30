import { apiFetch } from './api';

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

// ---- Lookups --------------------------------------------------------------

export const listCashBankAccounts = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/lookups/cash-bank', params));

/** kind = 'payable_expense' | 'receivable_revenue' | 'all' */
export const listCoaAccounts = (kind = 'all', params = {}) =>
    apiFetch(withQuery('/workshop-accounting/lookups/coa', { kind, ...params }));

/** type = 'supplier' | 'employee' | 'customer' | 'other' */
export const listPayees = (type = 'supplier', params = {}) =>
    apiFetch(withQuery('/workshop-accounting/lookups/payees', { type, ...params }));

// ---- Create ---------------------------------------------------------------

export const createPayments = (body) =>
    apiFetch('/workshop-accounting/payments', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const createReceipts = (body) =>
    apiFetch('/workshop-accounting/receipts', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const createJournalEntry = (body) =>
    apiFetch('/workshop-accounting/journal-entries', {
        method: 'POST',
        body: JSON.stringify(body),
    });

// ---- Logs -----------------------------------------------------------------

export const listPayments = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/payments', params));

export const getPaymentsSummary = () =>
    apiFetch('/workshop-accounting/payments/summary');

export const listRecentPayments = (limit = 10) =>
    apiFetch(withQuery('/workshop-accounting/payments/recent', { limit }));

export const approvePayment = (id) =>
    apiFetch(`/workshop-accounting/payments/${encodeURIComponent(id)}/approve`, {
        method: 'PATCH',
    });

export const rejectPayment = (id) =>
    apiFetch(`/workshop-accounting/payments/${encodeURIComponent(id)}/reject`, {
        method: 'PATCH',
    });

export const listReceipts = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/receipts', params));

export const getReceiptsSummary = () =>
    apiFetch('/workshop-accounting/receipts/summary');

export const listRecentReceipts = (limit = 10) =>
    apiFetch(withQuery('/workshop-accounting/receipts/recent', { limit }));

export const approveReceipt = (id) =>
    apiFetch(`/workshop-accounting/receipts/${encodeURIComponent(id)}/approve`, {
        method: 'PATCH',
    });

export const rejectReceipt = (id) =>
    apiFetch(`/workshop-accounting/receipts/${encodeURIComponent(id)}/reject`, {
        method: 'PATCH',
    });

export const listJournalEntries = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/journal-entries', params));

export const getJournalEntry = (id) =>
    apiFetch(`/workshop-accounting/journal-entries/${encodeURIComponent(id)}`);
