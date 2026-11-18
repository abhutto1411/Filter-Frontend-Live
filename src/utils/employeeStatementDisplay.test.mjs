import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountLabel,
  balanceSuffixKey,
  formatSarLatn,
  mapStatementCards,
  mapStatementItems,
  mapStatementSourceKey,
  refHref,
  slicePage,
  withOpeningRow,
} from './employeeStatementDisplay.js';

test('formatSarLatn + slice', () => {
  assert.equal(formatSarLatn(1200), '1,200.00');
  assert.equal(slicePage([1, 2, 3, 4], 1, 2).items.length, 2);
});

test('source + account + balance suffix', () => {
  assert.equal(mapStatementSourceKey({ source: 'petty_cash_salary_advance' }), 'pos');
  assert.equal(mapStatementSourceKey({ source: 'payroll_accrual' }), 'payroll');
  assert.equal(accountLabel('1250-E42'), '1250-E');
  assert.equal(balanceSuffixKey({ accountCode: '2250-E1' }), 'payable');
  assert.equal(balanceSuffixKey({ accountCode: '1250-E1' }), 'adv');
});

test('cards omit missing; opening always when present', () => {
  const cards = mapStatementCards({ opening: 0, items: [] });
  assert.ok(cards.some((c) => c.id === 'opening'));
  assert.ok(!cards.some((c) => c.id === 'given'));
});

test('items + opening row + ref href', () => {
  const items = mapStatementItems({
    items: [{ date: '2027-01-05', ref: 'JE-1', source: 'admin', accountCode: '1250-E1', debit: 100, balance: 100 }],
  });
  const withOpen = withOpeningRow(items, 0, '2026-12-01');
  assert.equal(withOpen[0].isOpening, true);
  assert.equal(withOpen.length, 2);
  assert.match(refHref({ payslipId: '9' }), /payroll\/slip\/9/);
});
