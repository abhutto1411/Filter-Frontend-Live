import { apiFetch } from './api';

const parseArr = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.list)) return res.list;
    if (res && Array.isArray(res.entries)) return res.entries;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && typeof res === 'object') {
        return Object.values(res).filter(
            (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && v.id,
        );
    }
    return [];
};

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

export const createPayments = (body) =>
    apiFetch('/transactions/payments', { method: 'POST', body: JSON.stringify(body) });

export const createReceipts = (body) =>
    apiFetch('/transactions/receipts', { method: 'POST', body: JSON.stringify(body) });

export const getTransactions = (params = {}) =>
    apiFetch(withQuery('/transactions', params));

export const getRecentTransactions = (params = {}) =>
    apiFetch(withQuery('/transactions/recent', params)).then(parseArr);

export const getLedger = (params = {}) =>
    apiFetch(withQuery('/transactions/ledger', params));

export const getLedgerAccounts = () =>
    apiFetch('/transactions/ledger/accounts').then(parseArr);

export const getSummary = () => apiFetch('/transactions/summary');
