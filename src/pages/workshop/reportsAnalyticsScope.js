/**
 * Reports & Analytics applied date/time scope (Asia/Riyadh).
 * Pure helpers for node --test — no React, no API.
 */
import {
    addCalendarDaysYmd,
    BUSINESS_TIMEZONE,
    inclusiveCalendarRangeToDatetimeLocal,
    reportsRangeQueryParams,
    riyadhStartOfMonthDatetimeLocal,
    toRiyadhDateISO,
} from '../../utils/riyadhBusinessRange.js';

export const REPORTS_TIMEZONE = BUSINESS_TIMEZONE;
export const REPORTS_PRESETS = Object.freeze([
    'today',
    'yesterday',
    'last_7',
    'mtd',
    'custom',
]);
export const REPORTS_TIME_MODES = Object.freeze(['full_day', 'custom_time']);
export const REPORTS_DRAWER_CLOSE_KEY = 'Escape';
export const REPORTS_SCOPE_PARAM = Object.freeze({
    from: 'dateFrom',
    to: 'dateTo',
    kind: 'rangeKind',
    timeMode: 'timeMode',
    preset: 'preset',
});

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function ymdOf(raw) {
    return String(raw || '').trim().slice(0, 10);
}

function wallOf(raw) {
    const s = String(raw || '').trim();
    if (WALL.test(s)) return s.slice(0, 16);
    if (YMD.test(s.slice(0, 10))) return `${s.slice(0, 10)}T00:00`;
    return '';
}

export function reportsTodayYmd(now = new Date()) {
    return toRiyadhDateISO(now);
}

/** Inclusive calendar From/To for a named preset. Custom is not resolved here. */
export function inclusiveYmdForPreset(preset, now = new Date()) {
    const today = reportsTodayYmd(now);
    if (!today) return { dateFrom: '', dateTo: '' };
    if (preset === 'yesterday') {
        const y = addCalendarDaysYmd(today, -1);
        return { dateFrom: y, dateTo: y };
    }
    if (preset === 'last_7') {
        return { dateFrom: addCalendarDaysYmd(today, -6), dateTo: today };
    }
    if (preset === 'mtd') {
        const start = riyadhStartOfMonthDatetimeLocal(now).slice(0, 10);
        return { dateFrom: start, dateTo: today };
    }
    return { dateFrom: today, dateTo: today };
}

export function detectReportsPreset(dateFrom, dateTo, timeMode, now = new Date()) {
    if (timeMode === 'custom_time') return 'custom';
    const from = ymdOf(dateFrom);
    const to = ymdOf(dateTo);
    for (const preset of ['today', 'yesterday', 'last_7', 'mtd']) {
        const p = inclusiveYmdForPreset(preset, now);
        if (p.dateFrom === from && p.dateTo === to) return preset;
    }
    return 'custom';
}

/**
 * Full-day inclusive end date → next local midnight exclusive (datetime-local).
 * Never 23:59:59.
 */
export function fullDayEndExclusiveLocal(inclusiveToYmd) {
    const day = ymdOf(inclusiveToYmd);
    if (!YMD.test(day)) return '';
    return `${addCalendarDaysYmd(day, 1)}T00:00`;
}

export function fullDayStartLocal(inclusiveFromYmd) {
    const day = ymdOf(inclusiveFromYmd);
    if (!YMD.test(day)) return '';
    return `${day}T00:00`;
}

export function createReportsScope({
    preset = 'today',
    timeMode = 'full_day',
    dateFrom,
    dateTo,
    fromLocal,
    toLocal,
    now = new Date(),
} = {}) {
    const mode = timeMode === 'custom_time' ? 'custom_time' : 'full_day';
    if (mode === 'full_day') {
        const resolved =
            preset && preset !== 'custom'
                ? inclusiveYmdForPreset(preset, now)
                : { dateFrom: ymdOf(dateFrom), dateTo: ymdOf(dateTo) };
        const from = resolved.dateFrom || ymdOf(dateFrom);
        const to = resolved.dateTo || ymdOf(dateTo);
        return {
            preset: detectReportsPreset(from, to, 'full_day', now),
            timeMode: 'full_day',
            rangeKind: 'calendar',
            dateFrom: from,
            dateTo: to,
            fromLocal: fullDayStartLocal(from),
            toLocal: fullDayStartLocal(to),
            timezone: REPORTS_TIMEZONE,
        };
    }
    const fromW = wallOf(fromLocal || dateFrom);
    const toW = wallOf(toLocal || dateTo);
    return {
        preset: 'custom',
        timeMode: 'custom_time',
        rangeKind: 'precise',
        dateFrom: ymdOf(fromW),
        dateTo: ymdOf(toW),
        fromLocal: fromW,
        toLocal: toW,
        timezone: REPORTS_TIMEZONE,
    };
}

export function defaultReportsTodayScope(now = new Date()) {
    return createReportsScope({ preset: 'today', timeMode: 'full_day', now });
}

export function validateReportsScope(scope) {
    const s = scope && typeof scope === 'object' ? scope : {};
    if (s.timeMode === 'custom_time') {
        if (!s.fromLocal || !s.toLocal) {
            return { ok: false, code: 'invalid' };
        }
        try {
            reportsRangeQueryParams(s.fromLocal, s.toLocal, 'precise');
        } catch (err) {
            return {
                ok: false,
                code: err?.code === 'REPORT_RANGE_INVALID' ? 'equalMidnight' : 'invalid',
                error: err,
            };
        }
        return { ok: true };
    }
    const from = ymdOf(s.dateFrom);
    const to = ymdOf(s.dateTo);
    if (!YMD.test(from) || !YMD.test(to)) {
        return { ok: false, code: 'invalid' };
    }
    if (to < from) {
        return { ok: false, code: 'startAfterEnd' };
    }
    try {
        reportsRangeQueryParams(from, to, 'calendar');
    } catch (err) {
        return { ok: false, code: 'invalid', error: err };
    }
    return { ok: true };
}

/** Query params actually sent to GET /workshop-staff/reports-analytics. */
export function reportsScopeToApiParams(scope) {
    const v = validateReportsScope(scope);
    if (!v.ok) {
        const err = v.error || new Error('Invalid date/time range.');
        throw err;
    }
    if (scope.timeMode === 'custom_time') {
        return reportsRangeQueryParams(scope.fromLocal, scope.toLocal, 'precise');
    }
    return reportsRangeQueryParams(scope.dateFrom, scope.dateTo, 'calendar');
}

/** Half-open datetime-local window for shared workshop-admin session range. */
export function reportsScopeToSharedDatetime(scope) {
    if (!scope) return { dateFrom: '', dateTo: '' };
    if (scope.timeMode === 'custom_time') {
        return { dateFrom: scope.fromLocal, dateTo: scope.toLocal };
    }
    return inclusiveCalendarRangeToDatetimeLocal(scope.dateFrom, scope.dateTo);
}

export function scopesEqual(a, b) {
    if (!a || !b) return false;
    return (
        a.timeMode === b.timeMode &&
        a.rangeKind === b.rangeKind &&
        a.dateFrom === b.dateFrom &&
        a.dateTo === b.dateTo &&
        a.fromLocal === b.fromLocal &&
        a.toLocal === b.toLocal
    );
}

export function cancelReportsDraft(applied) {
    return applied ? { ...applied } : defaultReportsTodayScope();
}

export function resetReportsScope(now = new Date()) {
    return defaultReportsTodayScope(now);
}

export function applyReportsDraft(draft) {
    const v = validateReportsScope(draft);
    if (!v.ok) return { ok: false, code: v.code, error: v.error };
    const applied = createReportsScope(draft);
    return { ok: true, applied };
}

export function appliedReportsRequestKey({
    workshopId = '',
    branchId = '',
    scope,
    costBasis = '',
    generation = '',
} = {}) {
    const s = scope && typeof scope === 'object' ? scope : {};
    return [
        workshopId || '',
        branchId || 'all',
        s.timeMode || '',
        s.rangeKind || '',
        s.dateFrom || '',
        s.dateTo || '',
        s.fromLocal || '',
        s.toLocal || '',
        s.timezone || REPORTS_TIMEZONE,
        costBasis || '',
        generation === 0 || generation ? String(generation) : '',
    ].join('|');
}

export function isStaleReportsResponse(appliedKey, responseKey) {
    if (!appliedKey || !responseKey) return true;
    return appliedKey !== responseKey;
}

/**
 * All Branches = authorized branches only (layout already filters).
 * A concrete id not in the authorized list is unauthorized.
 */
export function isAuthorizedReportsBranch(selectedBranchId, branches) {
    if (selectedBranchId == null || selectedBranchId === '' || selectedBranchId === 'all') {
        return true;
    }
    const id = String(selectedBranchId);
    const list = Array.isArray(branches) ? branches : [];
    return list.some((b) => String(b?.id) === id);
}

export function parseReportsScopeFromSearchParams(searchParams, now = new Date()) {
    const get = (k) => {
        if (!searchParams) return '';
        if (typeof searchParams.get === 'function') return String(searchParams.get(k) || '').trim();
        return String(searchParams[k] || '').trim();
    };
    const from = get(REPORTS_SCOPE_PARAM.from);
    const to = get(REPORTS_SCOPE_PARAM.to);
    if (!from || !to) return null;
    const timeModeRaw = get(REPORTS_SCOPE_PARAM.timeMode);
    const kindRaw = get(REPORTS_SCOPE_PARAM.kind);
    const hasTime = WALL.test(from) || WALL.test(to) || from.includes('T') || to.includes('T');
    const timeMode =
        timeModeRaw === 'custom_time' || kindRaw === 'precise' || (hasTime && timeModeRaw !== 'full_day')
            ? 'custom_time'
            : 'full_day';
    const presetRaw = get(REPORTS_SCOPE_PARAM.preset);
    if (timeMode === 'custom_time') {
        return createReportsScope({
            preset: 'custom',
            timeMode: 'custom_time',
            fromLocal: wallOf(from),
            toLocal: wallOf(to),
            now,
        });
    }
    const preset = REPORTS_PRESETS.includes(presetRaw) ? presetRaw : 'custom';
    return createReportsScope({
        preset,
        timeMode: 'full_day',
        dateFrom: ymdOf(from),
        dateTo: ymdOf(to),
        now,
    });
}

export function writeReportsScopeToSearchParams(searchParams, scope) {
    const next = new URLSearchParams(searchParams || '');
    if (!scope) return next;
    next.set(REPORTS_SCOPE_PARAM.preset, scope.preset || 'custom');
    next.set(REPORTS_SCOPE_PARAM.timeMode, scope.timeMode || 'full_day');
    next.set(REPORTS_SCOPE_PARAM.kind, scope.rangeKind || 'calendar');
    if (scope.timeMode === 'custom_time') {
        next.set(REPORTS_SCOPE_PARAM.from, scope.fromLocal);
        next.set(REPORTS_SCOPE_PARAM.to, scope.toLocal);
    } else {
        next.set(REPORTS_SCOPE_PARAM.from, scope.dateFrom);
        next.set(REPORTS_SCOPE_PARAM.to, scope.dateTo);
    }
    return next;
}

/**
 * Inventory valuation is period-end / DATE as-of (kpi_window.stock_as_of).
 * Precise/custom-time requests do not get midday stock precision.
 */
export function describeStockMeasureScope({ requestedTimeMode, requestedRangeKind, kpiWindow } = {}) {
    const requestedIntraday =
        requestedTimeMode === 'custom_time' || requestedRangeKind === 'precise';
    const asOf = kpiWindow?.stockAsOf || kpiWindow?.endDate || null;
    return {
        requested: requestedIntraday ? 'intraday' : 'end_of_day',
        actual: 'end_of_day',
        asOf,
        timezone: kpiWindow?.timeZone || REPORTS_TIMEZONE,
        intradayUnsupported: requestedIntraday,
        matchesRequest: !requestedIntraday,
    };
}

export function reportsScopeLabel(scope, { branchLabel } = {}) {
    if (!scope) return '';
    const tz = scope.timezone || REPORTS_TIMEZONE;
    if (scope.timeMode === 'custom_time') {
        const bits = [`${scope.fromLocal} → ${scope.toLocal}`, tz];
        if (branchLabel) bits.push(branchLabel);
        return bits.join(' · ');
    }
    const bits = [
        scope.dateFrom === scope.dateTo
            ? scope.dateFrom
            : `${scope.dateFrom} → ${scope.dateTo}`,
        tz,
        'full day',
    ];
    if (branchLabel) bits.push(branchLabel);
    return bits.join(' · ');
}
