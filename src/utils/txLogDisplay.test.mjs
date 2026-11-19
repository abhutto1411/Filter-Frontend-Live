import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRowsBySource,
  formatBusinessDate,
  formatSarLatn,
  mapTxLink,
  mapTxSourceKey,
  mapTxSummaryCards,
} from './txLogDisplay.js';

test('format helpers', () => {
  assert.equal(formatSarLatn(182400), '182,400.00');
  assert.equal(formatBusinessDate('2027-01-09T12:00:00.000Z'), '2027-01-09');
});

test('mapTxSourceKey', () => {
  assert.equal(mapTxSourceKey({ sourceType: 'pos_invoice' }), 'invoice');
  assert.equal(mapTxSourceKey({ sourceType: 'payroll_payout' }), 'payroll_payout');
  assert.equal(mapTxSourceKey({ sourceType: 'global_advance' }), 'global_advance');
  assert.equal(mapTxSourceKey({ sourceType: 'employee_repayment' }), 'employee_repayment');
});

test('mapTxSummaryCards hides optional without API fields', () => {
  const inCards = mapTxSummaryCards('in', { total: 10, totalAmount: 100 });
  assert.equal(inCards.length, 2);
  assert.ok(!inCards.some((c) => c.id === 'cash'));
  const withCash = mapTxSummaryCards('in', {
    total: 10,
    totalAmount: 100,
    summary: { cashTotal: 50, employeeRepayments: 5 },
  });
  assert.equal(withCash.length, 4);
});

test('link + filter', () => {
  assert.equal(mapTxLink({ sourceType: 'pos_invoice' })?.kind, 'invoice');
  assert.match(
    mapTxLink({ sourceType: 'global_advance', employeeUserId: '9' })?.href || '',
    /statement/,
  );
  assert.equal(
    filterRowsBySource(
      [{ sourceType: 'pos_invoice' }, { sourceType: 'global_advance' }],
      'invoice',
    ).length,
    1,
  );
});
