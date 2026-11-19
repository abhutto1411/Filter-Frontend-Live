import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_PROOF_PATH,
  buildProofHref,
  proofColumnParam,
  readProofParams,
  shouldSyncReportUrl,
} from './reportProofLinks.js';

test('round-trip keeps report, key, filters, column, back', () => {
  const href = buildProofHref({
    report: 'pl',
    key: 'pl.grossProfit',
    filters: {
      dateFrom: '2026-11-01',
      dateTo: '2026-11-05',
      branchId: '5',
      basis: 'accrual',
      compare: 'previous_period',
    },
    column: 'total',
    backHref: '/workshop/accounting/profit-loss?dateFrom=2026-11-01&dateTo=2026-11-05&branchId=5',
  });
  assert.ok(href.startsWith(`${REPORT_PROOF_PATH}?`));
  const read = readProofParams(new URLSearchParams(href.split('?')[1]));
  assert.equal(read.report, 'pl');
  assert.equal(read.key, 'pl.grossProfit');
  assert.equal(read.dateFrom, '2026-11-01');
  assert.equal(read.dateTo, '2026-11-05');
  assert.equal(read.branchId, '5');
  assert.equal(read.column, 'total');
  assert.equal(read.basis, 'accrual');
  assert.equal(read.compare, 'previous_period');
  assert.equal(read.page, 1);
  assert.equal(
    read.back,
    '/workshop/accounting/profit-loss?dateFrom=2026-11-01&dateTo=2026-11-05&branchId=5',
  );
});

test('empty params are dropped', () => {
  const href = buildProofHref({
    report: 'pl',
    key: 'pl.cogs',
    filters: { dateFrom: '', dateTo: '  ', branchId: '', basis: null, compare: undefined },
    column: '',
    backHref: '',
  });
  assert.equal(href, `${REPORT_PROOF_PATH}?report=pl&key=pl.cogs`);
  assert.equal(href.includes('dateFrom'), false);
  assert.equal(href.includes('branchId'), false);
  assert.equal(href.includes('column'), false);
  assert.equal(href.includes('back='), false);
  assert.equal(href.includes('page='), false);
});

test('Arabic back URL survives encoding', () => {
  const backHref = '/workshop/accounting/profit-loss?branch=فرع-الرياض';
  const href = buildProofHref({
    report: 'pl',
    key: 'pl.netIncome',
    backHref,
  });
  const q = new URLSearchParams(href.split('?')[1]);
  assert.equal(q.get('back'), backHref);
  assert.equal(q.get('key'), 'pl.netIncome');
  const read = readProofParams(q);
  assert.equal(read.back, backHref);
});

test('shouldSyncReportUrl: own path true; period-closings and proof false', () => {
  assert.equal(
    shouldSyncReportUrl('/workshop/accounting/balance-sheet', '/accounting/balance-sheet'),
    true,
  );
  assert.equal(
    shouldSyncReportUrl('/workshop/accounting/trial-balance', '/accounting/trial-balance'),
    true,
  );
  assert.equal(
    shouldSyncReportUrl('/workshop/accounting/profit-loss', '/accounting/profit-loss'),
    true,
  );
  assert.equal(
    shouldSyncReportUrl('/workshop/accounting/period-closings', '/accounting/balance-sheet'),
    false,
  );
  assert.equal(
    shouldSyncReportUrl('/workshop/accounting/period-closings', '/accounting/trial-balance'),
    false,
  );
  assert.equal(
    shouldSyncReportUrl('/workshop/accounting/period-closings', '/accounting/profit-loss'),
    false,
  );
  assert.equal(
    shouldSyncReportUrl('/workshop/accounting/reports/proof', '/accounting/balance-sheet'),
    false,
  );
  assert.equal(
    shouldSyncReportUrl('/workshop/accounting/reports/proof', '/accounting/trial-balance'),
    false,
  );
  assert.equal(
    shouldSyncReportUrl('/workshop/accounting/reports/proof', '/accounting/profit-loss'),
    false,
  );
});

test('proofColumnParam maps statement columns', () => {
  assert.equal(proofColumnParam('total'), 'total');
  assert.equal(proofColumnParam('compare'), 'total');
  assert.equal(proofColumnParam('unallocated'), 'unallocated');
  assert.equal(proofColumnParam('__unallocated'), 'unallocated');
  assert.equal(proofColumnParam('branch', { branchId: '5' }), 'branch:5');
  assert.equal(proofColumnParam('12'), 'branch:12');
});
