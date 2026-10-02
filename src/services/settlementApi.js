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

// ---- Settlement (HQ ↔ workshop net payout cycle) ----
export const previewSettlement = (params = {}) =>
    apiFetch(`/super-admin/settlement/preview${qs(params)}`);

export const listSettlements = (params = {}) =>
    apiFetch(`/super-admin/settlement${qs(params)}`);

export const getSettlement = (id) =>
    apiFetch(`/super-admin/settlement/${encodeURIComponent(id)}`);

export const generateSettlement = (body) =>
    apiFetch('/super-admin/settlement/generate', {
        method: 'POST',
        body: JSON.stringify(body),
    });

// ---- Franchise fee billing ----
export const listFranchiseBills = (params = {}) =>
    apiFetch(`/super-admin/franchise-billing${qs(params)}`);

export const getFranchiseBill = (id) =>
    apiFetch(`/super-admin/franchise-billing/${encodeURIComponent(id)}`);

export const createFranchiseBill = (body) =>
    apiFetch('/super-admin/franchise-billing', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const payFranchiseBill = (id) =>
    apiFetch(`/super-admin/franchise-billing/${encodeURIComponent(id)}/pay`, {
        method: 'POST',
    });

export const cancelFranchiseBill = (id) =>
    apiFetch(`/super-admin/franchise-billing/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
    });
