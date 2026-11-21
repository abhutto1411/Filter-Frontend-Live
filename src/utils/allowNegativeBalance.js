/** CORPORATE-FIX-02-COMPLETE-2. Mirrors allow-negative-permission.ts. */

export const CASH_BANK_PERMISSION = 'workshop.accounting.cash-bank';

export function isSuperAdminPrincipal(user) {
    return user?.type === 'admin' || user?.userType === 'platform_admin';
}

/** Real platform Super Admin bypass — mirrors AuthContext.userHas / RequirePermissionGuard. */
export function isPlatformSuperAdmin(user) {
    return (
        user?.userType === 'platform_admin' &&
        user?.permissionSource !== 'override' &&
        (!user?.role || user?.role?.isSystem)
    );
}

const NEVER_EDIT = new Set([
    'cashier_user',
    'technician_user',
    'supplier_user',
    'marketing_user',
    'referrer_user',
    'corporate_user',
]);

export function canEditAllowNegative({ user, isHq, hasPermission } = {}) {
    if (NEVER_EDIT.has(user?.userType)) return false;
    if (isSuperAdminPrincipal(user)) return true;
    if (isHq) return false;
    if (user?.userType === 'workshop_owner') return true;
    if (typeof hasPermission !== 'function') return false;
    return (
        hasPermission(`${CASH_BANK_PERMISSION}.edit`) ||
        hasPermission(`${CASH_BANK_PERMISSION}.create`) ||
        hasPermission(`${CASH_BANK_PERMISSION}.approve`) ||
        hasPermission(CASH_BANK_PERMISSION)
    );
}

export function permissionTooltipKey() {
    return 'cb.neg.onlyAdmin';
}

/**
 * OFF → request ON → confirm with reason → ON.
 * Cancel returns to the previous value.
 */
export function reduceAllowNegative(state, event) {
    const current = {
        on: state?.on === true,
        pending: state?.pending === 'on' || state?.pending === 'off' ? state.pending : null,
        reason: String(state?.reason ?? ''),
    };
    if (event?.type === 'request-on') {
        if (current.on || !event.canChange) return current;
        return { on: false, pending: 'on', reason: '' };
    }
    if (event?.type === 'request-off') {
        if (!current.on || !event.canChange) return current;
        return { on: true, pending: 'off', reason: '' };
    }
    if (event?.type === 'reason') {
        if (!current.pending) return current;
        return { ...current, reason: String(event.reason ?? '') };
    }
    if (event?.type === 'cancel') {
        return { on: current.on, pending: null, reason: '' };
    }
    if (event?.type === 'confirm') {
        const reason = current.reason.trim();
        if (!current.pending || reason.length < 3 || reason.length > 300) return current;
        return { on: current.pending === 'on', pending: null, reason: '' };
    }
    if (event?.type === 'saved') {
        return { on: event.on === true, pending: null, reason: '' };
    }
    return current;
}

export function buildAllowNegativePatch({ allowNegativeBalance, reason } = {}) {
    return {
        allowNegativeBalance: allowNegativeBalance === true,
        reason: String(reason ?? '').trim(),
    };
}

export function reasonAcceptable(reason) {
    const r = String(reason ?? '').trim();
    return r.length >= 3 && r.length <= 300;
}
