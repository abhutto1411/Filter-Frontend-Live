/**
 * Workshop setting: pay a person's profile % when no commission rule matches.
 * Default is off. Platform (admin) mode may view it and must not change it.
 */

/** @returns {boolean} true only for a workshop user with rules.edit, never for platform admin mode. */
export function canEditCommissionProfileFallback({ adminMode = false, hasEditPermission = false } = {}) {
    if (adminMode) return false;
    return Boolean(hasEditPermission);
}

/** PATCH body. Anything other than true is sent as false (the default). */
export function commissionProfileFallbackPatchBody(enabled) {
    return { commissionProfileFallback: enabled === true };
}

/**
 * Read GET/PATCH `{ commissionProfileFallback, updatedAt, updatedByUserId }`.
 * Missing or non-true values stay off.
 */
export function readCommissionProfileSettings(res) {
    const wrapped = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
        ? res.data
        : res;
    const row = wrapped && typeof wrapped === 'object' ? wrapped : {};
    const updatedAt = row.updatedAt == null || String(row.updatedAt).trim() === '' ? null : String(row.updatedAt);
    const updatedByUserId = row.updatedByUserId == null || String(row.updatedByUserId).trim() === ''
        ? null
        : String(row.updatedByUserId);
    return {
        commissionProfileFallback: row.commissionProfileFallback === true,
        updatedAt,
        updatedByUserId,
    };
}

/** Asia/Riyadh display for "last changed". Empty when there is no timestamp. */
export function formatProfileFallbackChangedAt(iso, locale = 'en') {
    if (iso == null || String(iso).trim() === '') return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}
