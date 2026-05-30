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
