import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPickerSelection,
  buildLedgerPickerOptions,
  findEmployeeChildAccount,
  formatBusinessDate,
  formatSarLatn,
  mapLedgerLineAccount,
  mapLedgerLineRef,
  mapLedgerLineSource,
  mapLedgerSummaryCards,
} from './ledgerDisplay.js';

test('format helpers', () => {
  assert.equal(formatSarLatn(4340), '4,340.00');
  assert.equal(formatBusinessDate('2027-01-05T12:00:00.000Z'), '2027-01-05');
});

test('cards + employee child', () => {
  const cards = mapLedgerSummaryCards({ opening: 0, debit: 4340, credit: 4340, closing: 0 });
  assert.equal(cards.length, 4);
  assert.equal(cards[1].id, 'debit');
  const acct = findEmployeeChildAccount(
    [{ id: '1', code: '1250-E9' }, { id: '2', code: '1250' }],
    '1250',
    '9',
  );
  assert.equal(acct.id, '1');
});

test('picker options include employee + apply', () => {
  const opts = buildLedgerPickerOptions({
    accounts: [
      { id: '10', code: '1250', name: 'Advances' },
      { id: '11', code: '1250-E3', name: 'Adv Emp' },
      { id: '20', code: '1110', name: 'AR Corp' },
    ],
    employees: [{ id: '3', name: 'Tech 1' }],
    corpCustomers: [{ id: '9', name: 'Fleet' }],
    t: (k) => k,
  });
  assert.ok(opts.some((o) => o.id === 'emp:3:1250'));
  assert.ok(opts.some((o) => o.id === 'corp:9'));
  const applied = applyPickerSelection(opts.find((o) => o.id === 'emp:3:1250'));
  assert.equal(applied.accountId, '11');
});

test('line mappers', () => {
  assert.equal(mapLedgerLineRef({ entryNumber: 'ADV-1' }), 'ADV-1');
  assert.equal(mapLedgerLineAccount({ accountCode: '1250-E' }), '1250-E');
  assert.equal(mapLedgerLineSource({ source: 'global_advance' }), 'global_advance');
});
