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

export const getAccounts = (params = {}) => {
    const query = { ...params, _t: Date.now() };
    return apiFetch(withQuery('/accounts', query)).then(parseArr);
};

export const getAccountsTree = (params = {}) =>
    apiFetch(withQuery('/accounts/tree', { ...params, _t: Date.now() })).then(parseArr);

export const getAccountsBranches = () =>
    apiFetch(`/accounts/branches?_t=${Date.now()}`).then(parseArr);

export const getAccountById = (id) => apiFetch(`/accounts/${encodeURIComponent(id)}`);

/** General ledger lines for one COA account (optional dateFrom, dateTo, branchId, limit). */
export const getAccountLedger = (id, params = {}) =>
    apiFetch(withQuery(`/accounts/${encodeURIComponent(id)}/ledger`, { ...params, _t: Date.now() }));

export const createAccount = (body) =>
    apiFetch('/accounts', { method: 'POST', body: JSON.stringify(body) });

export const updateAccount = (id, body) =>
    apiFetch(`/accounts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const deleteAccount = (id) =>
    apiFetch(`/accounts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });

export const getTrialBalance = (params = {}) =>
    apiFetch(withQuery('/accounts/reports/trial-balance', { ...params, _t: Date.now() }));

export const getPLReport = (params = {}) =>
    apiFetch(withQuery('/accounts/reports/pl', { ...params, _t: Date.now() }));

export const getBalanceSheet = (params = {}) =>
    apiFetch(withQuery('/accounts/reports/balance-sheet', { ...params, _t: Date.now() }));
