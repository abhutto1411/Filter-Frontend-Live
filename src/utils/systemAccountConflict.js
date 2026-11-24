/**
 * Central helper for HTTP 409 SYSTEM_ACCOUNT_CODE_CONFLICT.
 * Callers open SystemAccountConflictDialog and retry with the same idempotency key.
 */

export const SYSTEM_ACCOUNT_CODE_CONFLICT = 'SYSTEM_ACCOUNT_CODE_CONFLICT';

const COA_PERMISSION = 'workshop.accounting.chart-of-accounts.coa';

/** Mirrors BE write gate on POST /accounts/system-accounts/resolve (owner or CoA write). */
export function canResolveSystemAccountConflict({ hasPermission, user } = {}) {
    const type = String(user?.userType || '');
    if (type === 'workshop_owner' || type === 'platform_admin') return true;
    if (typeof hasPermission !== 'function') return false;
    return ['create', 'edit', 'approve'].some((s) => hasPermission(`${COA_PERMISSION}.${s}`));
}

export function isSystemAccountConflict(err) {
    const code = String(
        err?.code || err?.response?.code || err?.response?.error?.code || '',
    ).trim();
    return code === SYSTEM_ACCOUNT_CODE_CONFLICT;
}

/** Normalise conflict payload from apiFetch error (response body or top-level fields). */
export function parseSystemAccountConflict(err) {
    const body =
        err?.response && typeof err.response === 'object' && !Array.isArray(err.response)
            ? err.response
            : err && typeof err === 'object'
              ? err
              : {};
    return {
        code: SYSTEM_ACCOUNT_CODE_CONFLICT,
        role: body.role != null ? String(body.role) : '',
        roleLabel: body.roleLabel != null ? String(body.roleLabel) : '',
        preferredCode: body.preferredCode != null ? String(body.preferredCode) : '',
        roleType: body.roleType != null ? String(body.roleType) : '',
        roleSubType: body.roleSubType != null ? String(body.roleSubType) : '',
        suggestedCode: body.suggestedCode != null ? String(body.suggestedCode) : '',
        /** false for per-entity leaves (1001-C*, 1250-E*, '-G'…): rename the other account instead. */
        resolvable: body.resolvable !== false,
        conflictingAccount:
            body.conflictingAccount && typeof body.conflictingAccount === 'object'
                ? body.conflictingAccount
                : null,
    };
}

/**
 * Returns true when the error was a system-account conflict (caller should open the dialog).
 * @param {Function} [onConflict] — optional sync hook with normalised payload
 */
export function handleSystemAccountConflict(err, opts = {}) {
    if (!isSystemAccountConflict(err)) return false;
    const payload = parseSystemAccountConflict(err);
    // Accept handleSystemAccountConflict(err, retry) or (err, { onConflict, retry }).
    const o = typeof opts === 'function' ? { retry: opts } : opts || {};
    o.onConflict?.(payload, o.retry);
    return true;
}

/** Account type for the code band of a conflict (role type, else first digit of the preferred code). */
export function systemAccountConflictType(conflict) {
    const t = String(conflict?.roleType || '').toUpperCase();
    if (t) return t;
    const d = String(conflict?.preferredCode || '').trim().charAt(0);
    return { 1: 'ASSET', 2: 'LIABILITY', 3: 'EQUITY', 4: 'INCOME', 5: 'EXPENSE', 6: 'EXPENSE', 7: 'EXPENSE' }[d] || 'ASSET';
}

/** First conflict from GET /accounts/system-accounts/conflicts that matches the 409 (role, else code). */
export function pickSystemAccountConflictDetails(list, conflict) {
    const rows = Array.isArray(list) ? list : Array.isArray(list?.items) ? list.items : Array.isArray(list?.conflicts) ? list.conflicts : [];
    if (!rows.length) return null;
    const role = String(conflict?.role || '');
    const code = String(conflict?.preferredCode || conflict?.conflictingAccount?.code || '');
    return (
      (role && rows.find((r) => String(r.role) === role)) ||
      (code && rows.find((r) => String(r.preferredCode) === code)) ||
      rows.find((r) => String(r.role) === 'LOCKER_COLLECTION_EXPENSE_CLEARING') ||
      rows[0]
    );
}

/** Fill fields missing from a 409 payload (older API) from a conflicts-list row. */
export function mergeSystemAccountConflict(base, extra) {
    if (!extra) return base;
    const out = { ...base };
    for (const k of ['role', 'roleLabel', 'preferredCode', 'roleType', 'roleSubType', 'suggestedCode']) {
      if (!out[k] && extra[k]) out[k] = String(extra[k]);
    }
    if (!out.conflictingAccount?.name && extra.conflictingAccount) out.conflictingAccount = extra.conflictingAccount;
    if (extra.resolvable === false) out.resolvable = false;
    return out;
}
