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

/** Unwrap SuccessResponseInterceptor / common list envelopes. */
function parseAccountsList(res) {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && Array.isArray(res.accounts)) return res.accounts;
    if (res && Array.isArray(res.list)) return res.list;
    return [];
}

export const getAccountsList = (params = {}) =>
    apiFetch(`/accounts${qs(params)}`).then(parseAccountsList);

export const getAccountLedger = (id, params = {}) =>
    apiFetch(`/accounts/${encodeURIComponent(String(id))}/ledger${qs(params)}`);
