/**
 * Shared Asia/Riyadh datetime-local range for Workshop Admin portal.
 * When the user Applies a range on Dashboard / P&L / Reports / POS Monitoring,
 * other workshop screens pick up the same From/To.
 *
 * Values are `YYYY-MM-DDTHH:mm` (datetime-local), never browser-local ISO.
 */
import {
    addCalendarDaysYmd,
    defaultRiyadhReportRangeDatetimeLocal,
    extendStaleWorkshopRangeToLiveEnd,
    toRiyadhDateISO,
} from '../../utils/riyadhBusinessRange.js';

export const WORKSHOP_ADMIN_DATETIME_RANGE_KEY = 'workshop-admin-datetime-range-v1';

function isDatetimeLocal(v) {
    const s = String(v || '').trim();
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s);
}

/**
 * A range that ran through the end of the day it was saved on ("live") keeps
 * running through the end of today, so journals posted today are never hidden
 * by a window applied yesterday. Deliberately historical ranges are unchanged.
 */
export function rollLiveRangeForward(range, savedDay, now = new Date()) {
    const dateFrom = String(range?.dateFrom || '').trim();
    const dateTo = String(range?.dateTo || '').trim();
    const today = toRiyadhDateISO(now);
    const liveEnd = defaultRiyadhReportRangeDatetimeLocal(now).end;
    if (!dateFrom || !dateTo || !today || !liveEnd) return { dateFrom, dateTo };
    if (!savedDay) return extendStaleWorkshopRangeToLiveEnd({ dateFrom, dateTo }, now);
    if (savedDay >= today) return { dateFrom, dateTo };
    const savedLiveEnd = `${addCalendarDaysYmd(savedDay, 1)}T00:00`;
    if (dateTo >= savedLiveEnd && dateTo < liveEnd) return { dateFrom, dateTo: liveEnd };
    return { dateFrom, dateTo };
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
        const savedDay = /^\d{4}-\d{2}-\d{2}$/.test(String(parsed?.savedDay || ''))
            ? parsed.savedDay
            : '';
        return rollLiveRangeForward({ dateFrom, dateTo }, savedDay);
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
            JSON.stringify({ dateFrom, dateTo, savedDay: toRiyadhDateISO(new Date()) }),
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
