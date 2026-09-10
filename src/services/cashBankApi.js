import { apiFetch } from './api';

const parseArr = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
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

export const getSummary = () => apiFetch('/cash-bank/summary');

/** GET /cash-bank/accounts — cash & bank register (not COA /accounts). */
export const getCashBankAccounts = (params = {}) =>
    apiFetch(withQuery('/cash-bank/accounts', { ...params, _t: Date.now() })).then(parseArr);

/** Alias used by CashBankView and older imports. */
export const getAccounts = getCashBankAccounts;

export const getAccountById = (id) => apiFetch(`/cash-bank/accounts/${encodeURIComponent(id)}`);

export const createAccount = (body) =>
    apiFetch('/cash-bank/accounts', { method: 'POST', body: JSON.stringify(body) });

export const updateAccount = (id, body) =>
    apiFetch(`/cash-bank/accounts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const deleteAccount = (id) =>
    apiFetch(`/cash-bank/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const getTransactions = (params = {}) =>
    apiFetch(withQuery('/cash-bank/transactions', params)).then(parseArr);

export const createTransaction = (body) =>
    apiFetch('/cash-bank/transactions', { method: 'POST', body: JSON.stringify(body) });
