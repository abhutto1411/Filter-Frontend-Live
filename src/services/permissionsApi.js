import { apiFetch } from './api';

/**
 * Roles & Permissions API client — backed by `/super-admin/permissions/*`
 * (Phase 1: data + endpoints only; enforcement is deferred).
 *
 * All IDs are BigInt on the server → strings on the wire. Keep them as strings.
 *
 * Conventional response shape:
 *   getRegistry → { success, portal, tree, flatCodes }
 *   listRoles   → { success, roles: [...] }
 *   listUsers   → { success, users: [...] }
 *   createX     → { success, ...createdEntity }
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

/** Permission tree for a given portal — used to render the matrix UI. */
export function getRegistry(portal = 'super_admin') {
    return apiFetch(`/super-admin/permissions/registry${buildQs({ portal })}`);
}

// ───────── Roles ─────────

export function listRoles({ portal, workshopId } = {}) {
    return apiFetch(
        `/super-admin/permissions/roles${buildQs({ portal, workshopId })}`,
    );
}

export function getRole(id) {
    return apiFetch(`/super-admin/permissions/roles/${encodeURIComponent(id)}`);
}

/** payload = { name, description?, portal, workshopId?, permissions: string[] } */
export function createRole(payload) {
    return apiFetch('/super-admin/permissions/roles', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/** payload = { name?, description?, permissions?: string[] (full replacement) } */
export function updateRole(id, payload) {
    return apiFetch(`/super-admin/permissions/roles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export function deleteRole(id) {
    return apiFetch(`/super-admin/permissions/roles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}

// ───────── Users ─────────

export function listUsers({ search, portal } = {}) {
    return apiFetch(
        `/super-admin/permissions/users${buildQs({ search, portal })}`,
    );
}

/**
 * payload = {
 *   name, email, password, mobile?,
 *   isSuperAdmin: bool,
 *   workshopId?, branchId?, workshopRole?,   // required when isSuperAdmin = false
 *   roleId
 * }
 */
export function createUser(payload) {
    return apiFetch('/super-admin/permissions/users', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/**
 * Update a user — reassign role and optionally move them to a different
 * workshop / branch.
 *
 *   roleId      — string id, or null to clear the assignment
 *   workshopId  — optional; omit to keep current, null to clear, string id to set
 *   branchId    — optional; omit to keep current, null to clear, string id to set
 */
export function assignRoleToUser(userId, roleId, opts = {}) {
    const body = {
        roleId: roleId == null ? null : String(roleId),
    };
    if (Object.prototype.hasOwnProperty.call(opts, 'workshopId')) {
        body.workshopId = opts.workshopId == null ? null : String(opts.workshopId);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'branchId')) {
        body.branchId = opts.branchId == null ? null : String(opts.branchId);
    }
    return apiFetch(
        `/super-admin/permissions/users/${encodeURIComponent(userId)}/role`,
        {
            method: 'PATCH',
            body: JSON.stringify(body),
        },
    );
}

// ───────── Per-user permission overrides ─────────

/**
 * Get a user's effective permissions + which codes come from their role
 * vs override. Response shape:
 *   { success, effectiveCodes: string[], roleCodes: string[],
 *     source: 'override' | 'role' | 'none', hasOverride: boolean }
 */
export function getUserPermissions(userId) {
    return apiFetch(
        `/super-admin/permissions/users/${encodeURIComponent(userId)}/permissions`,
    );
}

/**
 * Override a user's permissions with a hand-picked list. Replaces any
 * existing override. Pass `codes = []` to clear the override (user reverts
 * to role defaults).
 */
export function setUserPermissions(userId, codes) {
    return apiFetch(
        `/super-admin/permissions/users/${encodeURIComponent(userId)}/permissions`,
        {
            method: 'PUT',
            body: JSON.stringify({ codes: Array.isArray(codes) ? codes : [] }),
        },
    );
}

/** Clear the user's override so they fall back to their role's defaults. */
export function clearUserPermissions(userId) {
    return apiFetch(
        `/super-admin/permissions/users/${encodeURIComponent(userId)}/permissions`,
        { method: 'DELETE' },
    );
}

// ───────── Maintenance ─────────

/** Idempotent — re-runs the Super Admin permission seeder. Safe to call repeatedly. */
export function reseed() {
    return apiFetch('/super-admin/permissions/reseed', { method: 'POST' });
}
