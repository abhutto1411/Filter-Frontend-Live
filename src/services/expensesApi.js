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

export const getSummary = () => apiFetch('/expenses-global/summary');
export const getExpenseAccounts = () =>
    apiFetch('/expenses-global/accounts').then(parseArr);
export const createExpenseAccount = (body) =>
    apiFetch('/expenses-global/accounts', { method: 'POST', body: JSON.stringify(body) });
export const getExpenses = (params = {}) => apiFetch(withQuery('/expenses-global', params));
export const createExpense = (body) =>
    apiFetch('/expenses-global', { method: 'POST', body: JSON.stringify(body) });
export const approveExpense = (id, body) =>
    apiFetch(`/expenses-global/${encodeURIComponent(id)}/approve`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteExpense = (id) =>
    apiFetch(`/expenses-global/${encodeURIComponent(id)}`, { method: 'DELETE' });
