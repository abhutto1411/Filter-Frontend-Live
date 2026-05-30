import { apiFetch } from './api';

const qs = (params = {}) => {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length === 0) return '';
    const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    return `?${search}`;
};

export const listExpenseCategories = () =>
    apiFetch('/employee-expense/categories');

export const getMyExpenseRequests = (params = {}) =>
    apiFetch(`/employee-expense/my${qs(params)}`);

export const getMyPettyCash = (params = {}) =>
    apiFetch(`/employee-expense/my-petty-cash${qs(params)}`);

export const listWorkshopExpenseRequests = (params = {}) =>
    apiFetch(`/employee-expense/workshop${qs(params)}`);

export const listWorkshopPettyCashWallets = (params = {}) =>
    apiFetch(`/employee-expense/workshop-petty-cash${qs(params)}`);

export const listExpenseIssuanceTargets = () =>
    apiFetch('/employee-expense/issuance-targets');

export const submitFundRequest = (body) =>
    apiFetch('/employee-expense/fund-request', {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const submitExpense = (body) =>
    apiFetch('/employee-expense/expense', {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const issuePettyCash = (body) =>
    apiFetch('/employee-expense/issue', {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const listExpenseMessages = (id) =>
    apiFetch(`/employee-expense/${encodeURIComponent(String(id))}/messages`);

export const addExpenseMessage = (id, body) =>
    apiFetch(`/employee-expense/${encodeURIComponent(String(id))}/messages`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const approveExpenseRequest = (id, body = {}) =>
    apiFetch(`/employee-expense/${encodeURIComponent(String(id))}/approve`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const rejectExpenseRequest = (id, body) =>
    apiFetch(`/employee-expense/${encodeURIComponent(String(id))}/reject`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });
