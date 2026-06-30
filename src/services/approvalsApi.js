import { apiFetch } from './api';

const qs = (params = {}) => {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length === 0) return '';
    const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    return `?${search}`;
};

/** Super-admin approval queue (workshop signup, registrations, etc.). */
export const list = (params = {}) =>
    apiFetch(`/super-admin/approvals${qs(params)}`);

export const details = (entityType, id) =>
    apiFetch(`/super-admin/approvals/${encodeURIComponent(String(entityType))}/${encodeURIComponent(String(id))}`);

export const approve = (entityType, id, body = {}) =>
    apiFetch(
        `/super-admin/approvals/${encodeURIComponent(String(entityType))}/${encodeURIComponent(String(id))}/approve`,
        {
            method: 'PATCH',
            body: JSON.stringify(body ?? {}),
        },
    );

export const reject = (entityType, id, reason) =>
    apiFetch(
        `/super-admin/approvals/${encodeURIComponent(String(entityType))}/${encodeURIComponent(String(id))}/reject`,
        {
            method: 'PATCH',
            body: JSON.stringify({ reason: reason ?? '' }),
        },
    );

/**
 * Global master switch for auto-approving corporate walk-in bookings. When ON,
 * every cashier-submitted corporate walk-in auto-approves regardless of each
 * corporate account's own per-account toggle.
 */
export const getWalkInSettings = () =>
    apiFetch('/super-admin/approvals/walk-in-settings');

export const updateWalkInSettings = ({ autoApproveCorporateWalkIns }) =>
    apiFetch('/super-admin/approvals/walk-in-settings', {
        method: 'PATCH',
        body: JSON.stringify({ autoApproveCorporateWalkIns: !!autoApproveCorporateWalkIns }),
    });

/** HQ Cash & Bank registers for admin wallet fund approval. */
export const listAdminWalletCashAccounts = ({ workshopId, branchId } = {}) => {
    const params = new URLSearchParams();
    if (workshopId) params.set('workshopId', String(workshopId));
    if (branchId) params.set('branchId', String(branchId));
    const qs = params.toString();
    return apiFetch(`/super-admin/approvals/admin-wallet-cash-accounts${qs ? `?${qs}` : ''}`);
};
