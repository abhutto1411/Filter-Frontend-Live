import { apiFetch } from './api';

const qs = (params = {}) => {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length === 0) return '';
    const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    return `?${search}`;
};

export const listExpenseCategories = (params = {}) =>
    apiFetch(`/employee-expense/categories${qs(params)}`);

export const listExpenseWorkshopBranches = (params = {}) =>
    apiFetch(`/employee-expense/branches${qs(params)}`);

export const getMyExpenseRequests = (params = {}) =>
    apiFetch(`/employee-expense/my${qs(params)}`);

export const getMyPettyCash = (params = {}) =>
    apiFetch(`/employee-expense/my-petty-cash${qs(params)}`);

export const listWorkshopExpenseRequests = (params = {}) =>
    apiFetch(`/employee-expense/workshop${qs(params)}`);

export const listWorkshopPettyCashWallets = (params = {}) =>
    apiFetch(`/employee-expense/workshop-petty-cash${qs(params)}`);

export const getStaffPettyCashWallet = (userId, params = {}) =>
    apiFetch(`/employee-expense/workshop-petty-cash/${encodeURIComponent(String(userId))}${qs(params)}`);

export const listExpenseIssuanceTargets = (params = {}) =>
    apiFetch(`/employee-expense/issuance-targets${qs(params)}`);

export const submitFundRequest = (body, params = {}) =>
    apiFetch(`/employee-expense/fund-request${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const submitExpense = (body, params = {}) =>
    apiFetch(`/employee-expense/expense${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const issuePettyCash = (body, params = {}) =>
    apiFetch(`/employee-expense/issue${qs(params)}`, {
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

export const approveExpenseRequest = (id, body = {}, params = {}) =>
    apiFetch(`/employee-expense/${encodeURIComponent(String(id))}/approve${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const rejectExpenseRequest = (id, body, params = {}) =>
    apiFetch(`/employee-expense/${encodeURIComponent(String(id))}/reject${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });
