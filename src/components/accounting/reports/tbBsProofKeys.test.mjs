import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProofHref } from './reportProofLinks.js';
import {
  BS_SECTION_PROOF_KEYS,
  DASHBOARD_KPI_PROOF,
  bsAccountProofKey,
  bsSectionProofKey,
  bsUnallocatedProofKey,
  collectBsRenderedProofKeys,
  collectTbRenderedProofKeys,
  tbRowProofKeys,
  tbTotalsProofKeys,
  tbUnallocatedProofKeys,
} from './tbBsProofKeys.js';

const tbAccounts = [
  { id: '10', code: '1000', isHeading: true },
  { id: '11', code: '1100' },
];

const bsReport = {
  assets: {
    current: [{ id: '21', name: 'Cash' }],
    fixed: [{ id: '22', name: 'Equipment' }],
    other: [],
    totalAssets: 100,
  },
  liabilities: {
    current: [{ id: '31', name: 'AP' }],
    longTerm: [],
    other: [],
    totalLiabilities: 40,
  },
  equity: {
    accounts: [
      { id: '41', name: 'Capital' },
      { id: 'current-year-earnings', name: 'Current year earnings' },
    ],
    totalEquity: 60,
  },
  totalLiabilitiesAndEquity: 100,
  difference: 0,
  unallocated: { assets: 0, liabilities: 0, equity: 0 },
};

test('every TB rendered row/column has a proof key', () => {
  const keys = collectTbRenderedProofKeys(tbAccounts);
  assert.ok(keys.includes('tb.opening:10'));
  assert.ok(keys.includes('tb.debit:10'));
  assert.ok(keys.includes('tb.credit:10'));
  assert.ok(keys.includes('tb.closing:10'));
  assert.ok(keys.includes('tb.opening:11'));
  assert.ok(keys.includes('tb.debit:11'));
  assert.ok(keys.includes('tb.credit:11'));
  assert.ok(keys.includes('tb.closing:11'));
  assert.ok(keys.includes('tb.totalDebit'));
  assert.ok(keys.includes('tb.totalCredit'));
  assert.ok(keys.includes('tb.difference'));
  for (const row of tbAccounts) {
    const k = tbRowProofKeys(row);
    assert.ok(k.opening && k.debit && k.credit && k.closing);
  }
  const totals = tbTotalsProofKeys();
  assert.equal(totals.totalPeriodDebit, 'tb.totalDebit');
  assert.equal(totals.totalPeriodCredit, 'tb.totalCredit');
  assert.equal(totals.difference, 'tb.difference');
  const u = tbUnallocatedProofKeys();
  assert.equal(u.periodDebit, 'tb.totalDebit');
  assert.equal(u.periodCredit, 'tb.totalCredit');
});

test('every BS rendered row/column has a proof key', () => {
  const keys = collectBsRenderedProofKeys(bsReport);
  assert.ok(keys.includes('account:21'));
  assert.ok(keys.includes('account:22'));
  assert.ok(keys.includes('account:31'));
  assert.ok(keys.includes('account:41'));
  assert.ok(keys.includes('bs.currentYearEarnings'));
  assert.ok(keys.includes('bs.totalAssets'));
  assert.ok(keys.includes('bs.totalLiabilities'));
  assert.ok(keys.includes('bs.totalEquity'));
  assert.ok(keys.includes('bs.totalLiabilitiesAndEquity'));
  assert.ok(keys.includes('bs.difference'));
  assert.ok(keys.includes('bs.unallocated.assets'));
  assert.equal(bsAccountProofKey({ id: '21' }), 'account:21');
  assert.equal(bsAccountProofKey({ id: 'current-year-earnings' }), 'bs.currentYearEarnings');
  assert.equal(bsSectionProofKey('totalAssets'), BS_SECTION_PROOF_KEYS.totalAssets);
  assert.equal(bsUnallocatedProofKey('equity'), 'bs.unallocated.equity');
});

test('TB/BS proof hrefs carry period and branch filters', () => {
  const tbHref = buildProofHref({
    report: 'tb',
    key: 'tb.closing:11',
    filters: { dateFrom: '2026-11-01', dateTo: '2026-11-05', branchId: '5' },
    column: 'total',
    backHref: '/workshop/accounting/trial-balance?dateFrom=2026-11-01&dateTo=2026-11-05&branchId=5',
  });
  assert.ok(tbHref.includes('report=tb'));
  assert.ok(tbHref.includes('key=tb.closing%3A11') || tbHref.includes('key=tb.closing:11'));
  assert.ok(tbHref.includes('dateFrom=2026-11-01'));
  assert.ok(tbHref.includes('dateTo=2026-11-05'));
  assert.ok(tbHref.includes('branchId=5'));

  const bsHref = buildProofHref({
    report: 'bs',
    key: 'bs.totalAssets',
    filters: { dateTo: '2026-11-05', branchId: '5' },
    backHref: '/workshop/accounting/balance-sheet?asOf=2026-11-05&branchId=5',
  });
  assert.ok(bsHref.includes('report=bs'));
  assert.ok(bsHref.includes('key=bs.totalAssets'));
  assert.ok(bsHref.includes('dateTo=2026-11-05'));
  assert.ok(bsHref.includes('branchId=5'));
  assert.equal(bsHref.includes('dateFrom='), false);
});

test('dashboard revenue / net income / gross profit map to proof keys', () => {
  assert.equal(DASHBOARD_KPI_PROOF.sales.key, 'pl.netRevenue');
  assert.equal(DASHBOARD_KPI_PROOF.netProfit.key, 'pl.netIncome');
  assert.equal(DASHBOARD_KPI_PROOF.grossMargin.key, 'pl.grossProfit');
  assert.equal(DASHBOARD_KPI_PROOF.expenses, undefined);
});
