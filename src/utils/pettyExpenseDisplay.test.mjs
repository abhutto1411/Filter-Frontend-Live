import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterExpenseRowsByType,
  formatBusinessDate,
  formatSarLatn,
  isAdvanceExpenseRow,
  mapExpenseTypeKind,
  mapPettyExpenseCards,
  TYPE_FILTER_ADVANCES,
  TYPE_FILTER_EXPENSES,
} from './pettyExpenseDisplay.js';

test('format helpers', () => {
  assert.equal(formatSarLatn(8420), '8,420.00');
  assert.equal(formatBusinessDate('2027-01-12T10:00:00.000Z'), '2027-01-12');
});

test('advance detection + type filter', () => {
  const adv = { category: { id: 'salary_advance', name: 'Salary advance' }, amount: 500 };
  const exp = { category: { id: '1', name: 'Spare parts' }, amount: 1900 };
  assert.equal(isAdvanceExpenseRow(adv), true);
  assert.equal(mapExpenseTypeKind(adv), 'advance');
  assert.equal(mapExpenseTypeKind(exp), 'expense');
  assert.equal(filterExpenseRowsByType([adv, exp], TYPE_FILTER_EXPENSES).length, 1);
  assert.equal(filterExpenseRowsByType([adv, exp], TYPE_FILTER_ADVANCES).length, 1);
});

test('cards only from API summary (no fake page sum)', () => {
  assert.equal(mapPettyExpenseCards({ total: 10, totalAmount: 9999 }).length, 0);
  const cards = mapPettyExpenseCards({
    summary: {
      expenseTotal: 8420,
      advanceTotal: 1600,
      pendingCount: 3,
      holdersCount: 11,
    },
  });
  assert.equal(cards.length, 4);
  assert.equal(cards.find((c) => c.id === 'expenses')?.value, 8420);
});
