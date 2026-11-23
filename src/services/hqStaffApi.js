import { apiFetch } from './api';

function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v != null && v !== '' && String(v) !== 'undefined') p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}
const enc = (v) => encodeURIComponent(String(v));
const post = (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body || {}) });

// ── Super Admin ─────────────────────────────────────────────────────────────
export const listHqStaff = (params) => apiFetch(`/super-admin/hq-staff${qs(params)}`);
export const getHqStaffPerson = (userId) => apiFetch(`/super-admin/hq-staff/${enc(userId)}`);
export const assignHqStaff = (userId, body) => post(`/super-admin/hq-staff/${enc(userId)}/assign`, body);
export const transferHqStaff = (userId, body) => post(`/super-admin/hq-staff/${enc(userId)}/transfer`, body);
export const endHqStaffLink = (assignmentId, body) => post(`/super-admin/hq-staff/assignments/${enc(assignmentId)}/end`, body);
export const getHqStaffRecharges = (params) => apiFetch(`/super-admin/hq-staff/recharges${qs(params)}`);

// ── Workshop ────────────────────────────────────────────────────────────────
export const listMyHqStaff = (params) => apiFetch(`/workshop-staff/hq-staff${qs(params)}`);

// ── Super Admin: Platform-HQ employees (HR record first, login optional) ────
export const createHqEmployee = (body) => post('/super-admin/hq-staff/employees', body);
export const updateHqEmployee = (userId, body) =>
    apiFetch(`/super-admin/hq-staff/employees/${enc(userId)}`, { method: 'PATCH', body: JSON.stringify(body || {}) });
export const setHqLogin = (userId, body) => post(`/super-admin/hq-staff/${enc(userId)}/login`, body);
export const disableHqLogin = (userId) => post(`/super-admin/hq-staff/${enc(userId)}/login/disable`, {});
