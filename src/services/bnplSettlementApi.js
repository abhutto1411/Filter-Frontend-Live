import { apiFetch } from './api';

function withQuery(path, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value)) {
            if (value.length) query.set(key, value.join(','));
            return;
        }
        query.set(key, String(value));
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

export const getBnplDashboard = (params = {}) =>
    apiFetch(withQuery('/accounts/bnpl-settlement/dashboard', params));

export const getBnplWorkshopsSummary = (params = {}) =>
    apiFetch(withQuery('/accounts/bnpl-settlement/workshops-summary', params));

export const listBnplUnsettledTransactions = (params = {}) =>
    apiFetch(withQuery('/accounts/bnpl-settlement/transactions', params));

export const listBnplSettlementStatements = (params = {}) =>
    apiFetch(withQuery('/accounts/bnpl-settlement/statements', params));

export const getBnplSettlementStatement = (id) =>
    apiFetch(`/accounts/bnpl-settlement/statements/${encodeURIComponent(id)}`);

export const previewBnplSettlement = (body) =>
    apiFetch('/accounts/bnpl-settlement/preview', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const generateBnplSettlement = (body) =>
    apiFetch('/accounts/bnpl-settlement/generate', {
        method: 'POST',
        body: JSON.stringify(body),
    });
