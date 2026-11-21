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
  statementDefaultFrom,
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

test('opening row shows a non-zero advance balance carried from before the range', () => {
  const rows = withOpeningRow(
    [{ id: '1', date: '2026-02-01', source: 'payroll' }],
    500,
    '2026-01-01',
  );
  assert.equal(rows[0].isOpening, true);
  assert.equal(rows[0].balance, 500);
  assert.equal(rows.length, 2);
});

test('summary advancesGiven / recovered become cards', () => {
  const ids = mapStatementCards({
    opening: 100,
    summary: { advancesGiven: '250.00', recovered: '50.00' },
  }).map((c) => c.id);
  assert.ok(ids.includes('opening'));
  assert.ok(ids.includes('given'));
  assert.ok(ids.includes('recovered'));
});

test('default statement range starts on 1 January of the current year', () => {
  assert.equal(statementDefaultFrom('2026-11-18'), '2026-01-01');
  assert.equal(statementDefaultFrom(''), '');
});
