import { apiFetch } from './api';

const qs = (params = {}) => {
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
    );
    if (!entries.length) return '';
    const search = new URLSearchParams(
        entries.map(([k, v]) => [k, String(v)]),
    ).toString();
    return `?${search}`;
};

/** GET /locker/expense-accounts — selectable CoA accounts + read-only clearing account */
export const listLockerExpenseAccounts = (params = {}) =>
    apiFetch(`/locker/expense-accounts${qs(params)}`);