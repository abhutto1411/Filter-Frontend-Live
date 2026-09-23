import { apiFetch } from './api';

const qs = (params = {}) => {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            usp.set(key, String(value));
        }
    });
    const out = usp.toString();
    return out ? `?${out}` : '';
};

export const getSoftPosStats = () => apiFetch('/super-admin/softpos/stats');

export const listSoftPosTerminals = (params = {}) =>
    apiFetch(`/super-admin/softpos/terminals${qs(params)}`);

export const createSoftPosTerminal = (body) =>
    apiFetch('/super-admin/softpos/terminals', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateSoftPosTerminal = (id, body) =>
    apiFetch(`/super-admin/softpos/terminals/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const deleteSoftPosTerminal = (id) =>
    apiFetch(`/super-admin/softpos/terminals/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });

export const listSoftPosRules = (params = {}) =>
    apiFetch(`/super-admin/softpos/rules${qs(params)}`);

export const createSoftPosRule = (body) =>
    apiFetch('/super-admin/softpos/rules', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateSoftPosRule = (id, body) =>
    apiFetch(`/super-admin/softpos/rules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const deleteSoftPosRule = (id) =>
    apiFetch(`/super-admin/softpos/rules/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });

export const listSoftPosTransactions = (params = {}) =>
    apiFetch(`/super-admin/softpos/transactions${qs(params)}`);

export const previewSoftPosSplit = (body) =>
    apiFetch('/super-admin/softpos/transactions/preview-split', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const refundSoftPosTransaction = (id, body) =>
    apiFetch(`/super-admin/softpos/transactions/${encodeURIComponent(id)}/refund`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const listSoftPosBatches = (params = {}) =>
    apiFetch(`/super-admin/softpos/batches${qs(params)}`);
