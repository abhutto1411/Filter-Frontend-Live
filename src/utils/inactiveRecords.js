/** True for a product / service / staff row that is switched off. */
export function isInactiveRecord(row) {
    if (!row || typeof row !== 'object') return false;
    if (row.inactive === true) return true;
    if (row.isActive === false || row.is_active === false) return true;
    return String(row.status ?? '').toLowerCase() === 'inactive';
}

/**
 * Data-entry pickers: inactive rows stay out of the open list and only appear
 * for a typed search, after the active matches. `keep` (e.g. the current
 * selection) is never hidden.
 */
export function inactiveLastWhenSearching(list, { searching, isInactive = isInactiveRecord, keep } = {}) {
    const rows = Array.isArray(list) ? list : [];
    if (!searching) return rows.filter((r) => !isInactive(r) || (keep && keep(r)));
    const active = [];
    const inactive = [];
    for (const r of rows) (isInactive(r) ? inactive : active).push(r);
    return active.concat(inactive);
}

export function inactiveLabel(locale) {
    const lang =
        locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    return String(lang).toLowerCase().startsWith('ar') ? 'غير نشط' : 'Inactive';
}
