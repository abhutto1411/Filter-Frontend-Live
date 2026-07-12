import { apiFetch } from './api';

/**
 * Workshop-scoped Roles & Permissions API. All endpoints are mounted under
 * `/workshop-staff/permissions/*` and `/workshop-staff/employees/:id/*` —
 * scoped server-side to the JWT user's workshop.
 */

function buildQs(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const s = qs.toString();
    return s ? `?${s}` : '';
}

// ───────── Registry ─────────

/** Tree for a workshop-managed portal: 'workshop' | 'cashier' | 'technician'. */
export function getRegistry(portal = 'workshop') {
    return apiFetch(`/workshop-staff/permissions/registry${buildQs({ portal })}`);
}

// ───────── Roles ─────────

export function listRoles({ portal } = {}) {
    return apiFetch(`/workshop-staff/permissions/roles${buildQs({ portal })}`);
}

export function getRole(id) {
    return apiFetch(`/workshop-staff/permissions/roles/${encodeURIComponent(id)}`);
}

/** payload = { name, description?, portal, permissions: string[] } */
export function createRole(payload) {
    return apiFetch('/workshop-staff/permissions/roles', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/** payload = { name?, description?, permissions?: string[] } */
export function updateRole(id, payload) {
    return apiFetch(`/workshop-staff/permissions/roles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export function deleteRole(id) {
    return apiFetch(`/workshop-staff/permissions/roles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}

// ───────── Employee portal access ─────────

/**
 * Grant or change an employee's portal access.
 *   portal: 'workshop' | 'cashier' | 'technician'
 *   roleId: string (must be a role in this workshop with matching portal) or null
 *   password: optional new password (min 6 chars); omit/blank to keep current
 */
export function grantPortalAccess(employeeUserId, payload) {
    return apiFetch(
        `/workshop-staff/employees/${encodeURIComponent(employeeUserId)}/portal-access`,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        },
    );
}

// ───────── Per-employee permission overrides ─────────

export function getEmployeePermissions(employeeUserId) {
    return apiFetch(
        `/workshop-staff/employees/${encodeURIComponent(employeeUserId)}/permissions`,
    );
}

export function setEmployeePermissions(employeeUserId, codes) {
    return apiFetch(
        `/workshop-staff/employees/${encodeURIComponent(employeeUserId)}/permissions`,
        {
            method: 'PUT',
            body: JSON.stringify({ codes: Array.isArray(codes) ? codes : [] }),
        },
    );
}

export function clearEmployeePermissions(employeeUserId) {
    return apiFetch(
        `/workshop-staff/employees/${encodeURIComponent(employeeUserId)}/permissions`,
        { method: 'DELETE' },
    );
}
