import { apiFetch } from './api';
import { mergeAccountingScopeParams } from '../utils/accountingWorkshopScope';

const qs = (params = {}) => {
    const entries = Object.entries(mergeAccountingScopeParams(params)).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
    );
    if (!entries.length) return '';
    const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    return `?${search}`;
};

export const getAccountsList = (params = {}) =>
    apiFetch(`/accounts${qs(params)}`);

export const getAccountLedger = (id, params = {}) =>
    apiFetch(`/accounts/${encodeURIComponent(String(id))}/ledger${qs(params)}`);
