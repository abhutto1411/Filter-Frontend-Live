import test from 'node:test';
import assert from 'node:assert/strict';
import {
    activityChartRows,
    chartUnknownNotZero,
    coerceDashboardGrain,
    dashboardAllowedGrains,
    dashboardContextKey,
    dashboardSeriesQueryParams,
    formatDashBucketLabel,
    isSeriesContextMatch,
    lowStockPanelState,
    salesChartRows,
    seriesHasBasis,
    shouldSkipHiddenRefresh,
    isLiveDashboardRange,
    sumFinite,
} from './workshopDashboardSeries.js';
import { kpiSummaryQueryParams } from './workshopDashboardScope.js';

test('hourly grain is only valid for short instant windows', () => {
    const hour = dashboardAllowedGrains({
        startIso: '2026-09-01T00:00:00.000+03:00',
        endIso: '2026-09-02T00:00:00.000+03:00',
        instantWindow: true,
    });
    assert.deepEqual(hour, ['hourly', 'daily', 'monthly']);
    const month = dashboardAllowedGrains({
        startIso: '2026-09-01T00:00:00.000+03:00',
        endIso: '2026-10-01T00:00:00.000+03:00',
        instantWindow: true,
    });
    assert.deepEqual(month, ['daily', 'monthly']);
    const calendarDay = dashboardAllowedGrains({
        startIso: '2026-09-01T00:00:00.000+03:00',
        endIso: '2026-09-02T00:00:00.000+03:00',
        instantWindow: false,
    });
    assert.equal(calendarDay.includes('hourly'), false);
});

test('coerceDashboardGrain never keeps an invalid grain', () => {
    assert.equal(coerceDashboardGrain('hourly', ['daily', 'monthly']), 'daily');
    assert.equal(coerceDashboardGrain('daily', ['daily', 'monthly']), 'daily');
    assert.equal(coerceDashboardGrain('weekly', ['monthly']), 'monthly');
});

test('series query never serializes basis; kpi-summary still omits it', () => {
    const q = dashboardSeriesQueryParams({
        rangeParams: { startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-30T20:59:59.000Z' },
        branchId: '10',
        grain: 'daily',
        compare: 'previous',
        basis: 'cash',
    });
    assert.equal(q.grain, 'daily');
    assert.equal(q.branchId, '10');
    assert.equal(q.compare, 'previous');
    assert.equal(seriesHasBasis(q), false);
    const kpi = kpiSummaryQueryParams({
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        branchId: '10',
        basis: 'cash',
    });
    assert.equal(Object.prototype.hasOwnProperty.call(kpi, 'basis'), false);
});

test('unknown chart values are null, not zero', () => {
    assert.equal(chartUnknownNotZero(null), null);
    assert.equal(chartUnknownNotZero(undefined), null);
    assert.equal(chartUnknownNotZero(''), null);
    assert.equal(chartUnknownNotZero('x'), null);
    assert.equal(chartUnknownNotZero(0), 0);
    assert.equal(chartUnknownNotZero(4), 4);
});

test('sales chart rows keep incomplete buckets as null and sum finite only', () => {
    const rows = salesChartRows(
        [
            { key: '2026-09-01', netExVat: 100, netIncVat: 115, previousNetExVat: 80, grossExVat: 100, returnsExVat: 0 },
            { key: '2026-09-02', netExVat: null, netIncVat: null, previousNetExVat: null, grossExVat: null, returnsExVat: null },
        ],
        'daily',
        'en',
        'ex',
    );
    assert.equal(rows[0].current, 100);
    assert.equal(rows[1].current, null);
    assert.equal(sumFinite(rows.map((r) => r.current)), 100);
});

test('activity chart uses jobCount, not invoices', () => {
    const rows = activityChartRows(
        [{ key: '2026-09-01T00:00:00', jobCount: 2, previousJobCount: 1 }],
        'hourly',
        'en',
    );
    assert.equal(rows[0].current, 2);
    assert.equal(rows[0].previous, 1);
});

test('bucket labels format in Asia/Riyadh independent of key parsing', () => {
    const daily = formatDashBucketLabel('2026-09-01', 'daily', 'en');
    assert.match(daily, /Sep/);
    const monthly = formatDashBucketLabel('2026-09', 'monthly', 'en');
    assert.match(monthly, /2026/);
    assert.equal(formatDashBucketLabel('2026-09-01T08:00:00', 'hourly', 'en'), '08:00');
});

test('hidden-tab refresh is skipped; mixed branch/date payloads are rejected', () => {
    assert.equal(shouldSkipHiddenRefresh('hidden'), true);
    assert.equal(shouldSkipHiddenRefresh('visible'), false);
    assert.equal(
        isSeriesContextMatch(
            { branchId: '10', grain: 'daily', rangeStart: 'a', rangeEnd: 'b' },
            { branchId: '11', grain: 'daily', rangeStart: 'a', rangeEnd: 'b' },
        ),
        false,
    );
    assert.equal(
        isSeriesContextMatch(
            { branchId: '10', grain: 'daily', rangeStart: 'a', rangeEnd: 'b' },
            { branchId: '10', grain: 'daily', rangeStart: 'a', rangeEnd: 'b' },
        ),
        true,
    );
    assert.equal(
        isSeriesContextMatch(
            { branchId: '10', grain: 'daily', compare: 'previous', rangeStart: 'a', rangeEnd: 'b' },
            { branchId: '10', grain: 'daily', compare: 'none', rangeStart: 'a', rangeEnd: 'b' },
        ),
        false,
    );
});

test('low-stock missing is not healthy; empty array is verified empty', () => {
    assert.equal(lowStockPanelState({ loading: true, items: null, contextMatch: true }), 'loading');
    assert.equal(lowStockPanelState({ error: true, items: [], contextMatch: true }), 'error');
    assert.equal(lowStockPanelState({ unauthorized: true, items: [], contextMatch: true }), 'unauthorized');
    assert.equal(lowStockPanelState({ items: undefined, contextMatch: true }), 'unavailable');
    assert.equal(lowStockPanelState({ items: [], contextMatch: true }), 'empty');
    assert.equal(lowStockPanelState({ items: [{ id: 1 }], contextMatch: true }), 'rows');
    assert.equal(lowStockPanelState({ items: [{ id: 1 }], contextMatch: false, loading: false }), 'stale');
    assert.equal(
        dashboardContextKey({ branchId: 'all', rangeFrom: 'a', rangeTo: 'b', grain: 'daily', compare: 'previous' }),
        dashboardContextKey({ branchId: '', rangeFrom: 'a', rangeTo: 'b', grain: 'daily', compare: 'previous' }),
    );
});

test('isLiveDashboardRange: only ranges ending today or later keep auto-refresh', () => {
    assert.equal(isLiveDashboardRange('2026-11-20', '2026-11-20'), true);
    assert.equal(isLiveDashboardRange('2026-11-30', '2026-11-20'), true);
    assert.equal(isLiveDashboardRange('2026-09-21', '2026-11-20'), false);
    assert.equal(isLiveDashboardRange('2026-11-19', '2026-11-20'), false);
    // Unknown end → keep the previous behaviour (refresh).
    assert.equal(isLiveDashboardRange('', '2026-11-20'), true);
    assert.equal(isLiveDashboardRange(undefined, '2026-11-20'), true);
});
