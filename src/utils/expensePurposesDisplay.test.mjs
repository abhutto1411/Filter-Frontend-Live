import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterPurposesByRole,
  filterPurposesBySearch,
  isOtherPurpose,
  mapPurposeRoleCards,
  purposeNeedsVatFields,
  slicePage,
  topPurposeChips,
} from './expensePurposesDisplay.js';

const sample = [
  {
    id: '1',
    code: 'fuel',
    nameEn: 'Fuel',
    nameAr: 'وقود',
    roles: ['cashier', 'staff'],
    sort: 10,
    vatMode: 'ask',
  },
  {
    id: '2',
    code: 'tools',
    nameEn: 'Small tools',
    roles: ['purchaser'],
    sort: 20,
    vatMode: 'none',
  },
  {
    id: '3',
    code: 'other_not_sure',
    nameEn: 'Other / not sure',
    isOther: true,
    roles: ['cashier', 'purchaser', 'staff', 'locker'],
    sort: 9000,
    vatMode: 'ask',
  },
];

test('mapPurposeRoleCards counts roles and other', () => {
  assert.deepEqual(mapPurposeRoleCards(sample), {
    cashier: 1,
    purchaser: 1,
    staff: 1,
    other: 1,
  });
});

test('filterPurposesByRole keeps Other always', () => {
  const r = filterPurposesByRole(sample, 'purchaser');
  assert.equal(r.length, 2);
  assert.ok(r.some((x) => x.code === 'tools'));
  assert.ok(r.some((x) => isOtherPurpose(x)));
});

test('filterPurposesBySearch matches EN/AR', () => {
  assert.equal(filterPurposesBySearch(sample, 'وقود', 'ar').length, 1);
  assert.equal(filterPurposesBySearch(sample, 'fuel').length, 1);
});

test('slicePage paginates', () => {
  const page = slicePage(sample, 1, 2);
  assert.equal(page.items.length, 2);
  assert.equal(page.total, 3);
  assert.equal(page.from, 1);
  assert.equal(page.to, 2);
});

test('topPurposeChips respects sort and limit', () => {
  const chips = topPurposeChips(sample, 2);
  assert.equal(chips.length, 2);
  assert.equal(chips[0].code, 'fuel');
});

test('purposeNeedsVatFields', () => {
  assert.equal(purposeNeedsVatFields(sample[0]), true);
  assert.equal(purposeNeedsVatFields(sample[1]), false);
});
