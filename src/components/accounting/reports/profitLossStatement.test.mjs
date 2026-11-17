import test from 'node:test';
import assert from 'node:assert/strict';
import * as rowsMod from './profitLossRows.js';
import {
  attachDetailProofKeys,
  buildPlReconRows,
  buildPlStatementRows,
  incVatDisplayRows,
  money2Str,
  plExportRows,
  showLegacyBackendHint,
  simplePlStepsNet,
  statementCellProofKey,
} from './profitLossRows.js';
import { buildProofHref } from './reportProofLinks.js';

function amounts(model, key) {
  return model.rows.find((r) => r.key === key)?.amounts;
}

const k2Pl = {
  netRevenue: 274805.1,
  totalRevenue: 275870.78,
  totalCOGS: 156877.55,
  grossProfit: 117927.55,
  totalOperatingExpenses: 54584.72,
  totalOtherIncome: 35,
  totalOtherExpenses: 0,
  netIncome: 63377.83,
  salesReturns: { amount: 1065.68 },
  discounts: { id: 'discounts', name: 'Discounts', amount: 0, source: 'ledger' },
  returnsVat: { amount: 159.84 },
  unallocated: {
    revenue: 0,
    costOfGoodsSold: -294822.96,
    grossProfit: 294822.96,
    operatingExpenses: 0,
    otherIncome: 0,
    otherExpenses: 0,
    netIncome: 294822.96,
  },
  cashOverShort: {
    net: 35,
    byBranch: { 5: 10 },
    unallocatedNet: 25,
  },
  comparison: {
    netRevenue: 200000,
    totalCOGS: 100000,
    grossProfit: 100000,
    totalOperatingExpenses: 40000,
    totalOtherIncome: 10,
    totalOtherExpenses: 0,
    netIncome: 60010,
    unallocated: {
      revenue: 0,
      costOfGoodsSold: -1000,
      grossProfit: 1000,
      operatingExpenses: 0,
      otherIncome: 0,
      otherExpenses: 0,
      netIncome: 1000,
    },
  },
  purchasesInPeriod: {
    exVat: 147398,
    vat: 22110.09,
    incVat: 169508.09,
    source: 'purchase_documents',
    label: 'info',
  },
  incVatView: {
    grossSalesExVat: 275870.78,
    outputVatOnSales: 41379.93,
    grossSalesIncVat: 317250.71,
    lessReturnsExVat: 1065.68,
    lessReturnsVat: 159.84,
    lessReturnsIncVat: 1225.52,
    netRevenueExVat: 274805.1,
    netOutputVat: 41220.09,
    netRevenueIncVat: 316025.19,
    cogsExVat: 156877.55,
    cogsVat: 23532.05,
    cogsIncVat: 180409.6,
    grossProfitExVat: 117927.55,
    grossProfitIncVat: 135615.59,
    inputVatRecoverable: 22104.33,
    netVatPayable: 19115.76,
    purchaseInputVatRatePct: 15,
    purchaseRateWindow: 'period',
    returnsVat: 159.84,
  },
};

test('ws3 br5 Sep: branch + unallocated statement', () => {
  const model = buildPlStatementRows(
    {
      netRevenue: 274805.1,
      totalCOGS: 156877.55,
      grossProfit: 117927.55,
      totalOperatingExpenses: 54584.72,
      totalOtherIncome: 35,
      totalOtherExpenses: 0,
      netIncome: 63377.83,
      unallocated: {
        revenue: 0,
        costOfGoodsSold: -294822.96,
        grossProfit: 294822.96,
        operatingExpenses: 0,
        otherIncome: 0,
        otherExpenses: 0,
        netIncome: 294822.96,
      },
    },
    { branchSelected: true },
  );
  assert.equal(model.columns.length, 2);
  assert.equal(model.columns[1].key, 'unallocated');
  assert.deepEqual(amounts(model, 'income'), { branch: 274805.1, unallocated: 0 });
  assert.deepEqual(amounts(model, 'cogs'), {
    branch: 156877.55,
    unallocated: -294822.96,
  });
  assert.deepEqual(amounts(model, 'grossProfit'), {
    branch: 117927.55,
    unallocated: 294822.96,
  });
  assert.deepEqual(amounts(model, 'opex'), { branch: 54584.72, unallocated: 0 });
  assert.deepEqual(amounts(model, 'otherIncome'), { branch: 35, unallocated: 0 });
  assert.equal(
    model.rows.some((r) => r.key === 'otherExpenses'),
    false,
  );
  assert.deepEqual(amounts(model, 'netIncome'), {
    branch: 63377.83,
    unallocated: 294822.96,
  });
});

test('K-2: statement labels, API unallocated GP, compare columns', () => {
  const model = buildPlStatementRows(k2Pl, {
    branchSelected: true,
    branchId: '5',
    compareMode: 'previous_period',
  });
  assert.deepEqual(
    model.rows.map((r) => r.label),
    [
      'Income (net revenue)',
      'Cost of goods sold (5000, 7001)',
      'Gross profit',
      'Operating expenses',
      'Other income',
      'Cash count difference (over/short)',
      'Net income',
    ],
  );
  assert.deepEqual(
    model.columns.map((c) => c.key),
    ['branch', 'compare', 'unallocated', 'compareUnallocated'],
  );
  assert.equal(amounts(model, 'grossProfit').unallocated, 294822.96);
  assert.equal(amounts(model, 'income').compare, 200000);
  assert.equal(amounts(model, 'grossProfit').compareUnallocated, 1000);
});

test('unallocated GP is taken from API, not subtracted on the client', () => {
  const model = buildPlStatementRows(
    {
      netRevenue: 10,
      totalCOGS: 4,
      grossProfit: 6,
      unallocated: {
        revenue: 100,
        costOfGoodsSold: 1,
        grossProfit: 294822.96,
        netIncome: 99,
      },
    },
    { branchSelected: true },
  );
  assert.equal(amounts(model, 'grossProfit').unallocated, 294822.96);
});

test('K-2 reconciliation has 6 rows including Less discounts 0.00', () => {
  const recon = buildPlReconRows(k2Pl);
  assert.deepEqual(
    recon.map((r) => [r.label, r.value]),
    [
      ['Revenue after returns', 274805.1],
      ['Add back sales returns', 1065.68],
      ['Gross sales', 275870.78],
      ['Less discounts', 0],
      ['Net revenue', 274805.1],
      ['Returns VAT (reversed on sales returns)', 159.84],
    ],
  );
});

test('K-2 Inc-VAT 8 rows use API figures only', () => {
  const rows = incVatDisplayRows(k2Pl.incVatView, k2Pl);
  assert.equal(rows.length, 8);
  assert.deepEqual(
    rows.map((r) => r.key),
    [
      'grossSales',
      'lessReturns',
      'netRevenue',
      'purchases',
      'cogs',
      'grossProfit',
      'inputVat',
      'netVatPayable',
    ],
  );
  assert.equal(rows[0].incVat, 317250.71);
  assert.equal(rows[1].incVat, -1225.52);
  assert.equal(rows[2].incVat, 316025.19);
  assert.equal(rows[3].incVat, 169508.09);
  assert.equal(rows[4].incVat, 180409.6);
  assert.equal(rows[5].incVat, 135615.59);
  assert.equal(rows[6].vat, 22104.33);
  assert.equal(rows[7].vat, 19115.76);
  assert.equal(rows[4].exVat, 156877.55);
  assert.equal(rows[4].vat, 23532.05);
  assert.equal(rows[1].exVat, -1065.68);
  assert.equal(rows[1].vat, -159.84);
});

test('cash row never repeats one value across columns', () => {
  const model = buildPlStatementRows(k2Pl, {
    branchSelected: true,
    branchId: '5',
  });
  const cash = amounts(model, 'cashOverShort');
  assert.equal(cash.branch, 10);
  assert.equal(cash.unallocated, 25);
  assert.notEqual(cash.branch, cash.unallocated);
  assert.notEqual(cash.branch, 35);
  assert.notEqual(cash.unallocated, 35);

  const split = buildPlStatementRows(
    {
      netRevenue: 3,
      totalCOGS: 0,
      grossProfit: 3,
      totalOperatingExpenses: 0,
      totalOtherIncome: 0,
      totalOtherExpenses: 0,
      netIncome: 3,
      branchColumns: [
        { key: '5', name: 'Branch 5' },
        { key: '6', name: 'Branch 6' },
      ],
      revenue: [{ amountsByBranch: { 5: 1, 6: 2 } }],
      cashOverShort: { net: 35, byBranch: { 5: 10, 6: 25 } },
    },
    { branchSelected: false },
  );
  const cashSplit = amounts(split, 'cashOverShort');
  assert.equal(cashSplit['5'], 10);
  assert.equal(cashSplit['6'], 25);
  assert.equal(cashSplit.total, 35);
  assert.notEqual(cashSplit['5'], cashSplit['6']);
});

test('old staging response hides blocks and has no field-name banner', () => {
  const staging = {
    netRevenue: 61.74,
    totalCOGS: 25,
    grossProfit: 36.74,
    totalOperatingExpenses: 67.34,
    totalOtherIncome: 0,
    totalOtherExpenses: 0,
    netIncome: -30.6,
  };
  assert.equal(showLegacyBackendHint(staging), true);
  assert.equal(showLegacyBackendHint(k2Pl), false);
  const model = buildPlStatementRows(staging, { branchSelected: false });
  assert.equal(
    model.columns.some((c) => c.key === 'unallocated'),
    false,
  );
  assert.deepEqual(incVatDisplayRows(staging.incVatView, staging), []);
  assert.equal(buildPlReconRows(staging).some((r) => r.key === 'lessDiscounts'), false);
});

test('listMissingPlFields is no longer exported', () => {
  assert.equal('listMissingPlFields' in rowsMod, false);
});

test('ws3 Nov 1-5 all-branches staging shape', () => {
  const model = buildPlStatementRows(
    {
      netRevenue: 61.74,
      totalCOGS: 25,
      grossProfit: 36.74,
      totalOperatingExpenses: 67.34,
      totalOtherIncome: 0,
      totalOtherExpenses: 0,
      netIncome: -30.6,
    },
    { branchSelected: false },
  );
  assert.equal(model.columns.length, 1);
  assert.equal(model.columns[0].key, 'total');
  assert.deepEqual(
    model.rows.map((r) => [r.key, r.amounts.total]),
    [
      ['income', 61.74],
      ['cogs', 25],
      ['grossProfit', 36.74],
      ['opex', 67.34],
      ['otherIncome', 0],
      ['netIncome', -30.6],
    ],
  );
});

test('Nov post-RF-04 shape shows other expenses and hides cash 0', () => {
  const model = buildPlStatementRows(
    {
      netRevenue: 61.74,
      totalCOGS: 25,
      grossProfit: 36.74,
      totalOperatingExpenses: 67.34,
      totalOtherIncome: 25,
      totalOtherExpenses: 25,
      netIncome: -30.6,
      cashOverShort: { net: 0 },
    },
    { branchSelected: false },
  );
  assert.equal(amounts(model, 'netIncome').total, -30.6);
  assert.equal(amounts(model, 'otherExpenses').total, 25);
  assert.equal(
    model.rows.some((r) => r.key === 'cashOverShort'),
    false,
  );
});

test('missing fields never produce NaN', () => {
  const model = buildPlStatementRows({}, { branchSelected: false });
  const nums = model.rows.flatMap((r) => Object.values(r.amounts || {}));
  assert.equal(
    nums.some((n) => typeof n === 'number' && Number.isNaN(n)),
    false,
  );
});

test('comparison column hides when comparison is null', () => {
  const model = buildPlStatementRows(
    { ...k2Pl, comparison: null },
    { branchSelected: true, branchId: '5', compareMode: 'previous_period' },
  );
  assert.equal(
    model.columns.some((c) => c.key === 'compare'),
    false,
  );
});

test('every rendered row has a proofKey and href keeps filters', () => {
  const model = buildPlStatementRows(k2Pl, {
    branchSelected: true,
    branchId: '5',
    compareMode: 'previous_period',
  });
  for (const row of model.rows) {
    assert.ok(row.proofKey, `missing proofKey on ${row.key}`);
  }
  const recon = buildPlReconRows(k2Pl).filter((r) => r.key !== 'lessDiscounts');
  for (const row of recon) {
    assert.ok(row.proofKey, `missing proofKey on recon ${row.key}`);
  }
  const incVat = incVatDisplayRows(k2Pl.incVatView, k2Pl);
  for (const row of incVat) {
    assert.ok(row.proofKey, `missing proofKey on incVat ${row.key}`);
    assert.ok(row.proofKeys, `missing proofKeys on incVat ${row.key}`);
  }
  const href = buildProofHref({
    report: 'pl',
    key: model.rows.find((r) => r.key === 'netIncome').proofKey,
    filters: {
      dateFrom: '2026-11-01',
      dateTo: '2026-11-05',
      branchId: '5',
      basis: 'accrual',
    },
    column: 'total',
    backHref: '/workshop/accounting/profit-loss?dateFrom=2026-11-01&dateTo=2026-11-05&branchId=5',
  });
  assert.ok(href.includes('dateFrom=2026-11-01'));
  assert.ok(href.includes('dateTo=2026-11-05'));
  assert.ok(href.includes('branchId=5'));
  assert.ok(href.includes('key=pl.netIncome'));
  assert.equal(statementCellProofKey('grossProfit', 'unallocated'), 'pl.unallocated.grossProfit');
  assert.equal(statementCellProofKey('income', 'compare'), 'pl.comparison.netRevenue');
  const detail = attachDetailProofKeys({
    rows: [
      { kind: 'line', key: 'rev:42', label: 'Sales' },
      { kind: 'net', key: 'net', label: 'Net' },
    ],
  });
  assert.equal(detail.rows[0].proofKey, 'account:42');
  assert.equal(detail.rows[1].proofKey, 'pl.netIncome');
});

const nov11 = {
  netRevenue: 220.86,
  totalCOGS: 133.64,
  grossProfit: 87.22,
  totalOperatingExpenses: 24.13,
  totalOtherIncome: 0,
  totalOtherExpenses: 0,
  netIncome: 67.09,
  cashOverShort: {
    net: 4,
    direction: 'over',
    accounts: [
      { code: '1150', net: -76 },
      { code: '1151', net: 80 },
    ],
  },
  comparison: {
    netRevenue: 200,
    totalCOGS: 100,
    grossProfit: 100,
    totalOperatingExpenses: 40,
    totalOtherIncome: 0,
    totalOtherExpenses: 0,
    netIncome: 64,
    cashOverShort: { net: 4 },
  },
};

test('F2-B1 11 Nov: steps add to net 67.09; compare cash is 4; export has cash row', () => {
  assert.equal(simplePlStepsNet(nov11), 67.09);
  const model = buildPlStatementRows(nov11, { compareMode: 'previous_period' });
  const cash = model.rows.find((r) => r.key === 'cashOverShort');
  assert.equal(cash.amounts.compare, 4);
  assert.equal(cash.amounts.total, 4);
  const net = model.rows.find((r) => r.key === 'netIncome');
  const cmpSum =
    (model.rows.find((r) => r.key === 'grossProfit')?.amounts.compare || 0) -
    (model.rows.find((r) => r.key === 'opex')?.amounts.compare || 0) +
    (model.rows.find((r) => r.key === 'otherIncome')?.amounts.compare || 0) -
    (model.rows.find((r) => r.key === 'otherExpenses')?.amounts.compare || 0) +
    (cash.amounts.compare || 0);
  assert.equal(Number(cmpSum.toFixed(2)), net.amounts.compare);
  const exp = plExportRows(nov11);
  assert.ok(exp.some((r) => r.section === 'cashOverShort' && r.amount === '4.00'));
  assert.equal(exp[exp.length - 1].section, 'netIncome');
  assert.equal(exp[exp.length - 1].amount, '67.09');
  assert.equal(exp.length, 10);
  for (const row of exp) {
    assert.match(String(row.amount), /^-?\d+\.\d{2}$/);
  }
});

test('W7 June float 54345.350000000006 exports as 54345.35', () => {
  assert.equal(money2Str(54345.350000000006), '54345.35');
});

