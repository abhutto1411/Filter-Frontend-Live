import { apiFetch } from './api';

const qs = (params = {}) => {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (!entries.length) return '';
    const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    return `?${search}`;
};

export const listCashBankTransactionsLog = (params = {}) =>
    apiFetch(`/accounting/logs/transactions${qs(params)}`);

export const listPettyCashExpensesLog = (params = {}) =>
    apiFetch(`/accounting/logs/petty-expenses${qs(params)}`);

export const listLogFilterUsers = (params = {}) =>
    apiFetch(`/accounting/logs/filter-users${qs(params)}`);
