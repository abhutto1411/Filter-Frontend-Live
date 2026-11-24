import test from 'node:test';
import assert from 'node:assert/strict';
import {
    REPORTS_DRAWER_CLOSE_KEY,
    REPORTS_TIMEZONE,
    applyReportsDraft,
    appliedReportsRequestKey,
    cancelReportsDraft,
    createReportsScope,
    defaultReportsTodayScope,
    describeStockMeasureScope,
    detectReportsPreset,
    fullDayEndExclusiveLocal,
    isAuthorizedReportsBranch,
    isStaleReportsResponse,
    parseReportsScopeFromSearchParams,
    reportsScopeToApiParams,
    resetReportsScope,
    scopesEqual,
    validateReportsScope,
    writeReportsScopeToSearchParams,
} from './reportsAnalyticsScope.js';

const NOON_RIYADH = new Date('2026-11-09T09:00:00Z'); // 12:00 Asia/Riyadh

test('default is Riyadh calendar today 00:00→next midnight, not rolling 24h', () => {
    const s = defaultReportsTodayScope(NOON_RIYADH);
    assert.equal(s.preset, 'today');
    assert.equal(s.timeMode, 'full_day');
    assert.equal(s.rangeKind, 'calendar');
    assert.equal(s.dateFrom, '2026-11-09');
    assert.equal(s.dateTo, '2026-11-09');
    assert.equal(s.fromLocal, '2026-11-09T00:00');
    assert.equal(s.toLocal, '2026-11-09T00:00');
    assert.equal(s.timezone, 'Asia/Riyadh');
    const api = reportsScopeToApiParams(s);
    assert.equal(api.rangeKind, 'calendar_day');
    assert.equal(api.dateFrom, '2026-11-09');
    assert.equal(api.dateTo, '2026-11-09');
    assert.equal(api.clientTimeZone, 'Asia/Riyadh');
    assert.equal(s.fromLocal.endsWith('T12:00'), false);
});

test('full-day inclusive end becomes next local midnight exclusive, not 23:59:59', () => {
    assert.equal(fullDayEndExclusiveLocal('2026-11-08'), '2026-11-09T00:00');
    assert.ok(!fullDayEndExclusiveLocal('2026-11-08').includes('23:59'));
});

test('presets: yesterday, last 7 calendar days, month to date', () => {
    const y = createReportsScope({ preset: 'yesterday', now: NOON_RIYADH });
    assert.equal(y.dateFrom, '2026-11-08');
    assert.equal(y.dateTo, '2026-11-08');
    const week = createReportsScope({ preset: 'last_7', now: NOON_RIYADH });
    assert.equal(week.dateFrom, '2026-11-03');
    assert.equal(week.dateTo, '2026-11-09');
    const mtd = createReportsScope({ preset: 'mtd', now: NOON_RIYADH });
    assert.equal(mtd.dateFrom, '2026-11-01');
    assert.equal(mtd.dateTo, '2026-11-09');
    assert.equal(detectReportsPreset('2026-11-01', '2026-11-09', 'full_day', NOON_RIYADH), 'mtd');
});

test('custom time requires start < end and transports precise ISO', () => {
    const bad = validateReportsScope({
        timeMode: 'custom_time',
        fromLocal: '2026-11-09T12:00',
        toLocal: '2026-11-09T08:00',
    });
    assert.equal(bad.ok, false);
    const equal = validateReportsScope({
        timeMode: 'custom_time',
        fromLocal: '2026-11-09T00:00',
        toLocal: '2026-11-09T00:00',
    });
    assert.equal(equal.ok, false);
    assert.equal(equal.code, 'equalMidnight');
    const ok = createReportsScope({
        timeMode: 'custom_time',
        fromLocal: '2026-11-09T00:00',
        toLocal: '2026-11-09T01:00',
        now: NOON_RIYADH,
    });
    const api = reportsScopeToApiParams(ok);
    assert.equal(api.rangeKind, 'precise_instant');
    assert.equal(api.startDate, '2026-11-08T21:00:00.000Z');
    assert.equal(api.endDate, '2026-11-08T22:00:00.000Z');
    assert.equal(api.dateFrom, undefined);
});

test('Apply is atomic; Cancel restores applied; Reset returns Today/Full day', () => {
    const applied = defaultReportsTodayScope(NOON_RIYADH);
    const draft = createReportsScope({ preset: 'yesterday', now: NOON_RIYADH });
    assert.equal(scopesEqual(applied, draft), false);
    const appliedResult = applyReportsDraft(draft);
    assert.equal(appliedResult.ok, true);
    assert.equal(appliedResult.applied.preset, 'yesterday');
    const cancelled = cancelReportsDraft(applied);
    assert.equal(cancelled.preset, 'today');
    assert.equal(cancelled.dateFrom, '2026-11-09');
    const reset = resetReportsScope(NOON_RIYADH);
    assert.equal(reset.preset, 'today');
    assert.equal(reset.timeMode, 'full_day');
    const rejected = applyReportsDraft({
        timeMode: 'custom_time',
        fromLocal: '2026-11-09T00:00',
        toLocal: '2026-11-09T00:00',
    });
    assert.equal(rejected.ok, false);
});

test('URL is applied source of truth; missing URL is not all-time', () => {
    const params = writeReportsScopeToSearchParams(new URLSearchParams('costBasis=latest_purchase'), createReportsScope({
        preset: 'last_7',
        now: NOON_RIYADH,
    }));
    assert.equal(params.get('dateFrom'), '2026-11-03');
    assert.equal(params.get('dateTo'), '2026-11-09');
    assert.equal(params.get('preset'), 'last_7');
    assert.equal(params.get('timeMode'), 'full_day');
    assert.equal(params.get('costBasis'), 'latest_purchase');
    const parsed = parseReportsScopeFromSearchParams(params, NOON_RIYADH);
    assert.equal(parsed.preset, 'last_7');
    assert.equal(parseReportsScopeFromSearchParams(new URLSearchParams(''), NOON_RIYADH), null);
});

test('unauthorized concrete branch is rejected; All Branches is allowed', () => {
    const branches = [{ id: '15', name: 'A' }, { id: '16', name: 'B' }];
    assert.equal(isAuthorizedReportsBranch('all', branches), true);
    assert.equal(isAuthorizedReportsBranch('15', branches), true);
    assert.equal(isAuthorizedReportsBranch('99', branches), false);
});

test('stale response key is suppressed; request key includes workshop/branch/range/tz', () => {
    const scope = defaultReportsTodayScope(NOON_RIYADH);
    const a = appliedReportsRequestKey({
        workshopId: 'w1',
        branchId: 'all',
        scope,
        costBasis: 'latest_purchase',
        generation: 1,
    });
    const b = appliedReportsRequestKey({
        workshopId: 'w1',
        branchId: 'all',
        scope,
        costBasis: 'latest_purchase',
        generation: 2,
    });
    assert.equal(isStaleReportsResponse(a, b), true);
    assert.equal(isStaleReportsResponse(a, a), false);
    assert.match(a, /Asia\/Riyadh/);
    assert.match(a, /w1/);
});

test('stock requested custom-time vs actual DATE as-of is unsupported midday', () => {
    const d = describeStockMeasureScope({
        requestedTimeMode: 'custom_time',
        requestedRangeKind: 'precise',
        kpiWindow: { stockAsOf: '2026-11-09', timeZone: REPORTS_TIMEZONE },
    });
    assert.equal(d.requested, 'intraday');
    assert.equal(d.actual, 'end_of_day');
    assert.equal(d.intradayUnsupported, true);
    assert.equal(d.asOf, '2026-11-09');
    const full = describeStockMeasureScope({
        requestedTimeMode: 'full_day',
        requestedRangeKind: 'calendar',
        kpiWindow: { stockAsOf: '2026-11-09' },
    });
    assert.equal(full.matchesRequest, true);
    assert.equal(full.intradayUnsupported, false);
});

test('drawer close key is Escape', () => {
    assert.equal(REPORTS_DRAWER_CLOSE_KEY, 'Escape');
});
