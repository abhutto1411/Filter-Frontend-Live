/**
 * Saudi business timezone helpers for accounting / reports datetime ranges.
 * Wall-clock values are always Asia/Riyadh (UTC+3, no DST) — not the browser TZ.
 */

export const BUSINESS_TIMEZONE = 'Asia/Riyadh';
/** Fixed offset used when building ISO strings from datetime-local values. */
export const RIYADH_OFFSET = '+03:00';

function pad2(n) {
    return String(n).padStart(2, '0');
}

/**
 * Format an instant as `YYYY-MM-DDTHH:mm` in Asia/Riyadh for `<input type="datetime-local" />`.
 */
export function toRiyadhDatetimeLocalValue(d = new Date()) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: BUSINESS_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const year = get('year');
    const month = get('month');
    const day = get('day');
    let hour = get('hour');
    if (hour === '24') hour = '00';
    const minute = get('minute');
    if (!year || !month || !day || hour == null || minute == null) return '';
    return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** Riyadh calendar `YYYY-MM-DD` for an instant. */
export function toRiyadhDateISO(d = new Date()) {
    return toRiyadhDatetimeLocalValue(d).slice(0, 10);
}

/** Start of current Riyadh month at 00:00 — `YYYY-MM-DDTHH:mm`. */
export function riyadhStartOfMonthDatetimeLocal(d = new Date()) {
    const day = toRiyadhDateISO(d);
    if (!day) return '';
    return `${day.slice(0, 8)}01T00:00`;
}

/**
 * Default P&L / Reports-style window in Riyadh:
 * start of month 00:00 → tomorrow 00:00 (half-open through end of today).
 */
export function defaultRiyadhReportRangeDatetimeLocal(d = new Date()) {
    const start = riyadhStartOfMonthDatetimeLocal(d);
    const today = toRiyadhDateISO(d);
    if (!start || !today) return { start: '', end: '' };
    const todayStartUtc = riyadhWallToUtcDate(`${today}T00:00`);
    const tomorrowStartUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);
    const endDay = toRiyadhDateISO(tomorrowStartUtc);
    return { start, end: `${endDay}T00:00` };
}

/**
 * Parse `YYYY-MM-DDTHH:mm` (or with seconds) as Asia/Riyadh wall clock → UTC Date.
 */
export function riyadhWallToUtcDate(wall) {
    const s = String(wall || '').trim();
    const m = s.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (!m) {
        const fallback = new Date(s);
        if (Number.isNaN(fallback.getTime())) {
            throw new Error(`Invalid datetime: ${wall}`);
        }
        return fallback;
    }
    const [, ys, ms, ds, hh = '00', mm = '00', ss = '00'] = m;
    return new Date(
        `${ys}-${ms}-${ds}T${hh}:${mm}:${ss}${RIYADH_OFFSET}`,
    );
}

/** API ISO strings for report endpoints (P&L, analytics, etc.). */
export function riyadhRangeToApiIso(rangeFromLocal, rangeToLocal) {
    const s = riyadhWallToUtcDate(rangeFromLocal);
    const e = riyadhWallToUtcDate(rangeToLocal);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
        throw new Error('Invalid date/time range.');
    }
    if (s.getTime() > e.getTime()) {
        throw new Error('Start must be on or before end.');
    }
    return { startDate: s.toISOString(), endDate: e.toISOString(), dateFrom: s.toISOString(), dateTo: e.toISOString() };
}

export function fmtRiyadhRangeLabel(wall) {
    const s = String(wall || '').trim();
    if (!s) return '—';
    if (s.includes('T')) {
        const [d, t] = s.split('T');
        return `${d} ${t.slice(0, 5)} (Asia/Riyadh)`;
    }
    return `${s} (Asia/Riyadh)`;
}

export { pad2 };
