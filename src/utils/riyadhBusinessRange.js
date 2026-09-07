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

/**
 * Standard query params for workshop analytics / dashboard / KPI proof APIs.
 * Always Asia/Riyadh wall → UTC ISO (+ clientTimeZone hint).
 */
export function workshopAdminRangeQueryParams(rangeFromLocal, rangeToLocal) {
    const iso = riyadhRangeToApiIso(rangeFromLocal, rangeToLocal);
    return {
        startDate: iso.startDate,
        endDate: iso.endDate,
        dateFrom: iso.dateFrom,
        dateTo: iso.dateTo,
        clientTimeZone: BUSINESS_TIMEZONE,
    };
}

/** POS monitoring style `from` / `to` ISO bounds (Asia/Riyadh wall). */
export function workshopAdminFromToQueryParams(rangeFromLocal, rangeToLocal) {
    const iso = riyadhRangeToApiIso(rangeFromLocal, rangeToLocal);
    return { from: iso.startDate, to: iso.endDate };
}

/**
 * Convert one datetime-local (or calendar day / ISO) field to a UTC ISO string
 * for APIs that take independent dateFrom/dateTo (Discounts, Sales Returns, etc.).
 * Empty input → ''.
 */
export function riyadhBoundToApiIso(raw, edge = 'start') {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const wall = edge === 'end' ? `${s}T23:59:59` : `${s}T00:00:00`;
        return riyadhWallToUtcDate(wall).toISOString();
    }
    // Already an absolute ISO with zone / Z — keep as-is.
    if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) throw new Error(`Invalid datetime: ${raw}`);
        return d.toISOString();
    }
    return riyadhWallToUtcDate(s).toISOString();
}

/** Epoch ms string for commission APIs — Asia/Riyadh wall, not browser local. */
export function riyadhDatetimeLocalToEpochMs(local) {
    const s = String(local || '').trim();
    if (!s) return '';
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return '';
    const d = riyadhWallToUtcDate(s);
    if (Number.isNaN(d.getTime())) return '';
    return String(d.getTime());
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

function isDateTimeBoundLocal(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return false;
    return s.includes('T') || /\d{2}:\d{2}/.test(s);
}

/**
 * Map P&L datetime-local (Asia/Riyadh wall) to inclusive journal calendar
 * `YYYY-MM-DD` bounds matching backend `resolveJournalDateFilterBounds`
 * period mode (half-open datetime → inclusive DATE span).
 * @deprecated Prefer {@link riyadhPlRangeToLedgerQueryParams} so same-day
 * P&L drill-downs keep exact times (instant) instead of whole calendar days.
 */
export function riyadhPlRangeToLedgerCalendarDates(rangeFromLocal, rangeToLocal) {
    const fromRaw = String(rangeFromLocal || '').trim();
    const toRaw = String(rangeToLocal || '').trim();
    if (!fromRaw && !toRaw) return { dateFrom: '', dateTo: '' };

    if (!isDateTimeBoundLocal(fromRaw) && !isDateTimeBoundLocal(toRaw)) {
        return {
            dateFrom: fromRaw.slice(0, 10) || '',
            dateTo: toRaw.slice(0, 10) || '',
        };
    }

    const dateFrom = fromRaw ? fromRaw.slice(0, 10) : '';
    let dateTo = '';
    if (toRaw) {
        const endExclusive = riyadhWallToUtcDate(toRaw);
        dateTo = toRiyadhDateISO(new Date(endExclusive.getTime() - 1));
    }
    return { dateFrom, dateTo };
}

/**
 * P&L → ledger drill-down query params.
 * Same-day datetime ranges keep Asia/Riyadh wall-clock `YYYY-MM-DDTHH:mm`
 * (exact P&L From/To). Calendar-only ranges stay `YYYY-MM-DD`.
 * Do not convert to UTC ISO in the URL — `+` / `Z` encoding is easy to lose
 * and the ledger inputs expect datetime-local values.
 */
export function riyadhPlRangeToLedgerQueryParams(rangeFromLocal, rangeToLocal) {
    const fromRaw = String(rangeFromLocal || '').trim();
    const toRaw = String(rangeToLocal || '').trim();
    if (!fromRaw && !toRaw) return { dateFrom: '', dateTo: '' };

    if (!isDateTimeBoundLocal(fromRaw) && !isDateTimeBoundLocal(toRaw)) {
        return {
            dateFrom: fromRaw.slice(0, 10) || '',
            dateTo: toRaw.slice(0, 10) || '',
        };
    }

    const trimWall = (raw) => {
        const s = String(raw || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // datetime-local or ISO → Riyadh wall for the filter control / URL
        if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
            return toRiyadhDatetimeLocalValue(new Date(s)) || s.slice(0, 16);
        }
        return s.slice(0, 16);
    };

    return {
        dateFrom: trimWall(fromRaw),
        dateTo: trimWall(toRaw),
    };
}

/** True when a ledger/API bound includes a time (ISO or datetime-local). */
export function isLedgerDateTimeBound(raw) {
    return isDateTimeBoundLocal(raw);
}

/**
 * Normalize URL/API date bound for `<input type="date|datetime-local" />`.
 * Calendar days stay `YYYY-MM-DD`; instants become Riyadh `YYYY-MM-DDTHH:mm`.
 */
export function toLedgerFilterControlValue(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    try {
        if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
            return toRiyadhDatetimeLocalValue(new Date(s));
        }
        if (s.includes('T')) {
            return toRiyadhDatetimeLocalValue(riyadhWallToUtcDate(s));
        }
    } catch {
        /* fall through */
    }
    return s.slice(0, 16);
}

/**
 * Convert ledger filter control value → API dateFrom/dateTo.
 * Calendar day stays as-is; datetime-local → UTC ISO (Asia/Riyadh wall).
 */
export function toLedgerApiDateParam(raw) {
    const s = String(raw || '').trim();
    if (!s) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return riyadhBoundToApiIso(s, 'start');
}

export { pad2 };
