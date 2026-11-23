import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isStaleLoad,
    kpiSummaryQueryParams,
    nextLoadGen,
    parseAccountingBasis,
    plBasisQueryParams,
    resolveAuthorizedBranchId,
    unwrapKpiSummary,
    unwrapPlPayload,
} from './workshopDashboardScope.js';
import {
    computeFixedComboMenuStyle,
    stepComboHighlightIdx,
} from '../../components/multiSelectMenuPlacement.js';

const branches = [
    { id: '10', name: 'K-10' },
    { id: 11, name: 'East' },
];

test('parseAccountingBasis only accepts cash; anything else is accrual', () => {
    assert.equal(parseAccountingBasis('cash'), 'cash');
    assert.equal(parseAccountingBasis('CASH'), 'cash');
    assert.equal(parseAccountingBasis('accrual'), 'accrual');
    assert.equal(parseAccountingBasis(''), 'accrual');
    assert.equal(parseAccountingBasis('invoice'), 'accrual');
});

test('resolveAuthorizedBranchId keeps All, authorized ids, and lock; rejects unknown', () => {
    assert.equal(resolveAuthorizedBranchId('all', { branches, allowAll: true }), 'all');
    assert.equal(resolveAuthorizedBranchId('10', { branches, allowAll: true }), '10');
    assert.equal(resolveAuthorizedBranchId(11, { branches, allowAll: true }), '11');
    assert.equal(resolveAuthorizedBranchId('99', { branches, allowAll: true }), null);
    assert.equal(resolveAuthorizedBranchId('all', { branches, allowAll: false }), null);
    assert.equal(
        resolveAuthorizedBranchId('11', { branches, lockedId: '10', allowAll: true }),
        '10',
    );
    assert.equal(
        resolveAuthorizedBranchId('all', { branches, lockedId: '10', allowAll: true }),
        '10',
    );
});

test('kpi-summary query never serializes basis', () => {
    const q = kpiSummaryQueryParams({
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        branchId: '10',
        basis: 'cash',
    });
    assert.deepEqual(q, {
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        branchId: '10',
    });
    assert.equal(Object.prototype.hasOwnProperty.call(q, 'basis'), false);
});

test('P&L cash query sends basis=cash and authorized branch only', () => {
    const q = plBasisQueryParams({
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        branchId: '10',
        basis: 'cash',
    });
    assert.equal(q.basis, 'cash');
    assert.equal(q.branchId, '10');
    assert.equal(q.compare, 'previous_period');
    const all = plBasisQueryParams({
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        branchId: 'all',
        basis: 'Cash',
    });
    assert.equal(all.basis, 'cash');
    assert.equal(all.branchId, undefined);
});

test('unwrapKpiSummary reads top-level or nested cards', () => {
    assert.equal(unwrapKpiSummary(null), null);
    assert.deepEqual(unwrapKpiSummary({ cards: [{ key: 'income' }] }), { cards: [{ key: 'income' }] });
    assert.deepEqual(
        unwrapKpiSummary({ data: { cards: [{ key: 'income' }] } }),
        { cards: [{ key: 'income' }] },
    );
    assert.equal(unwrapKpiSummary({ data: [1] }), null);
    assert.equal(unwrapKpiSummary({ success: true }), null);
});

test('unwrapPlPayload reads nested data and ignores arrays', () => {
    assert.equal(unwrapPlPayload(null), null);
    assert.deepEqual(unwrapPlPayload({ basis: 'cash', netIncome: 1 }), { basis: 'cash', netIncome: 1 });
    assert.deepEqual(unwrapPlPayload({ data: { basis: 'cash', netIncome: 2 } }), { basis: 'cash', netIncome: 2 });
    assert.deepEqual(unwrapPlPayload({ data: [1, 2] }), { data: [1, 2] });
});

test('stale dashboard loads are discarded after a newer gen', () => {
    const ref = { current: 0 };
    const first = nextLoadGen(ref);
    const second = nextLoadGen(ref);
    assert.equal(first, 1);
    assert.equal(second, 2);
    assert.equal(isStaleLoad(ref, first), true);
    assert.equal(isStaleLoad(ref, second), false);
});

test('combo menu stays on-screen near the viewport edge and keyboard highlight clamps', () => {
    const nearBottom = computeFixedComboMenuStyle(
        { left: 20, right: 180, top: 720, bottom: 756, width: 160 },
        { viewportWidth: 1280, viewportHeight: 800, menuMinWidth: 240 },
    );
    assert.equal(nearBottom.openUp, true);
    assert.equal(nearBottom.bottom > 0, true);
    const nearRight = computeFixedComboMenuStyle(
        { left: 1200, right: 1270, top: 80, bottom: 116, width: 70 },
        { viewportWidth: 1280, viewportHeight: 800, menuMinWidth: 240 },
    );
    assert.ok(nearRight.left + nearRight.width <= 1280 - 12);
    assert.equal(stepComboHighlightIdx(0, 1, 3), 1);
    assert.equal(stepComboHighlightIdx(2, 1, 3), 2);
    assert.equal(stepComboHighlightIdx(0, -1, 3), 0);
});
