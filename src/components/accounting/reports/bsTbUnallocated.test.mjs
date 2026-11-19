import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listMissingBsTbFields,
  pickBsUnallocatedBalance,
  pickTbUnallocatedBalance,
  reportRowFlags,
  tbLeafDebitCredit,
} from '../../../utils/accountingI18n.js';

test('ws3 br21 BS: difference shown 0.00 with unallocated', () => {
  const br21 = {
    isBalanced: false,
    difference: -33050,
    unallocated: { assets: 0, liabilities: 0, equity: -33050 },
    differenceWithUnallocated: 0,
    isBalancedWithUnallocated: true,
  };
  const badge = pickBsUnallocatedBalance(br21, { branchSelected: true });
  assert.equal(badge.usedUnallocated, true);
  assert.equal(badge.isBalanced, true);
  assert.equal(Number(badge.difference).toFixed(2), '0.00');
  assert.deepEqual(listMissingBsTbFields(br21, { kind: 'bs', branchSelected: true }), []);
});

test('TB Jul fixture 2200-E231 inactive and Dr = Cr', () => {
  const rows = [
    { code: '1000', periodDebit: 1704.45, periodCredit: 0 },
    { code: '2200-E169', isInactive: true, periodDebit: 82.07, periodCredit: 0 },
    { code: '2200-E231', isInactive: true, periodDebit: 0, periodCredit: 1153.79 },
    { code: '2200-E290', isInactive: true, periodDebit: 0, periodCredit: 225.86 },
    { code: '2200-E292', isInactive: true, periodDebit: 0, periodCredit: 324.8 },
    { code: '3000', periodDebit: 0, periodCredit: 82.07 },
  ];
  const e231 = rows.find((r) => r.code === '2200-E231');
  const flags = reportRowFlags(e231);
  assert.equal(flags.inactive, true);
  assert.equal(flags.shownBecauseBalance, false);
  const totals = tbLeafDebitCredit(rows);
  assert.equal(totals.debit, 1786.52);
  assert.equal(totals.credit, 1786.52);
  assert.equal(totals.equal, true);
  const tb = {
    isBalanced: true,
    difference: 0,
    isBalancedWithUnallocated: true,
    unallocated: { periodDebit: 0, periodCredit: 0 },
    accounts: rows,
  };
  assert.equal(pickTbUnallocatedBalance(tb, { branchSelected: true }).isBalanced, true);
});

test('old staging shape lists missing unallocated fields and keeps old difference', () => {
  const oldBs = { isBalanced: false, difference: -33050 };
  const badge = pickBsUnallocatedBalance(oldBs, { branchSelected: true });
  assert.equal(badge.usedUnallocated, false);
  assert.equal(badge.difference, -33050);
  assert.deepEqual(listMissingBsTbFields(oldBs, { kind: 'bs', branchSelected: true }), [
    'unallocated',
    'differenceWithUnallocated',
  ]);
  assert.deepEqual(listMissingBsTbFields({ isBalanced: false }, { kind: 'tb', branchSelected: true }), [
    'unallocated',
    'isBalancedWithUnallocated',
  ]);
});
