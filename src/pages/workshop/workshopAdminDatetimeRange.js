/**
 * Shared Asia/Riyadh datetime-local range for Workshop Admin portal.
 * When the user Applies a range on Dashboard / P&L / Reports / POS Monitoring,
 * other workshop screens pick up the same From/To.
 *
 * Values are `YYYY-MM-DDTHH:mm` (datetime-local), never browser-local ISO.
 */

export const WORKSHOP_ADMIN_DATETIME_RANGE_KEY = 'workshop-admin-datetime-range-v1';

function isDatetimeLocal(v) {
    const s = String(v || '').trim();
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s);
}

/**
 * @returns {{ dateFrom: string, dateTo: string } | null}
 */
export function loadWorkshopAdminDatetimeRange() {
    try {
        const raw = sessionStorage.getItem(WORKSHOP_ADMIN_DATETIME_RANGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const dateFrom = String(parsed?.dateFrom || '').trim();
        const dateTo = String(parsed?.dateTo || '').trim();
        if (!isDatetimeLocal(dateFrom) || !isDatetimeLocal(dateTo)) return null;
        return { dateFrom, dateTo };
    } catch {
        return null;
    }
}

/**
 * Persist an applied workshop datetime range for other screens.
 * Pass empty/null to clear.
 */
export function saveWorkshopAdminDatetimeRange(range) {
    try {
        const dateFrom = String(range?.dateFrom || '').trim();
        const dateTo = String(range?.dateTo || '').trim();
        if (!dateFrom || !dateTo) {
            sessionStorage.removeItem(WORKSHOP_ADMIN_DATETIME_RANGE_KEY);
            return;
        }
        if (!isDatetimeLocal(dateFrom) || !isDatetimeLocal(dateTo)) return;
        sessionStorage.setItem(
            WORKSHOP_ADMIN_DATETIME_RANGE_KEY,
            JSON.stringify({ dateFrom, dateTo }),
        );
    } catch {
        /* ignore quota / private mode */
    }
}

export function clearWorkshopAdminDatetimeRange() {
    try {
        sessionStorage.removeItem(WORKSHOP_ADMIN_DATETIME_RANGE_KEY);
    } catch {
        /* ignore */
    }
}
