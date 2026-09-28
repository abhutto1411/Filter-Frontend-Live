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

export const getStats = () => apiFetch('/commissions-global/stats');
export const getCommissions = (params = {}) =>
    apiFetch(withQuery('/commissions-global', params)).then(parseArr);
export const createCommission = (body) =>
    apiFetch('/commissions-global', { method: 'POST', body: JSON.stringify(body) });
export const generatePayout = (body) =>
    apiFetch('/commissions-global/payout', { method: 'POST', body: JSON.stringify(body) });
export const getCommissionRules = (params = {}) =>
    apiFetch(withQuery('/commissions-global/rules', params)).then(parseArr);
export const createCommissionRule = (body) =>
    apiFetch('/commissions-global/rules', { method: 'POST', body: JSON.stringify(body) });
export const updateCommissionRule = (id, body) =>
    apiFetch(`/commissions-global/rules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteCommissionRule = (id) =>
    apiFetch(`/commissions-global/rules/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const getServicesForRules = () =>
    apiFetch('/commissions-global/services').then(parseArr);
