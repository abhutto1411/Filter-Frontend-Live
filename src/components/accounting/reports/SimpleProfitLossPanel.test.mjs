import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlStatementRows, simplePlDeptAdjustment, simplePlStepsNet } from './profitLossRows.js';

const here = dirname(fileURLToPath(import.meta.url));

test('simple P&L panel has five steps, Open, RiyalIcon, no SAR text', () => {
  const src = readFileSync(join(here, 'SimpleProfitLossPanel.jsx'), 'utf8');
  assert.match(src, /step\.sales/);
  assert.match(src, /step\.cogs/);
  assert.match(src, /step\.expenses/);
  assert.match(src, /step\.cash/);
  assert.match(src, /step\.net/);
  assert.match(src, /report\.pl\.simple\.open/);
  assert.match(src, /RiyalIcon/);
  assert.doesNotMatch(src, /SAR /);
});

test('statement cash row sits after other expenses and is not a footnote', () => {
  const model = buildPlStatementRows(
    {
      netRevenue: 220.86,
      totalCOGS: 133.64,
      grossProfit: 87.22,
      totalOperatingExpenses: 24.13,
      totalOtherIncome: 0,
      totalOtherExpenses: 1,
      netIncome: 67.09,
      cashOverShort: {
        net: 4,
        direction: 'over',
        accounts: [
          { code: '1150', net: -76 },
          { code: '1151', net: 80 },
        ],
      },
    },
    { branchSelected: false },
  );
  const keys = model.rows.map((r) => r.key);
  assert.ok(keys.indexOf('otherExpenses') < keys.indexOf('cashOverShort'));
  assert.ok(keys.indexOf('cashOverShort') < keys.indexOf('netIncome'));
  const cash = model.rows.find((r) => r.key === 'cashOverShort');
  assert.equal(cash.kind, 'line');
  assert.equal(cash.direction, 'over');
  assert.equal(cash.label, 'Cash count difference (over/short)');
});

test('F2-C1 five steps add to pl.netIncome 67.09; June arithmetic documented', () => {
  assert.equal(
    simplePlStepsNet({
      grossProfit: 87.22,
      totalOperatingExpenses: 24.13,
      totalOtherIncome: 0,
      totalOtherExpenses: 0,
      cashOverShort: { net: 4 },
    }),
    67.09,
  );
  const src = readFileSync(join(here, 'SimpleProfitLossPanel.jsx'), 'utf8');
  assert.match(src, /deptSubtotal/);
  assert.match(src, /lessAdjustmentsInfo/);
  assert.match(src, /unpostedInvoices/);
  assert.match(src, /accountantItems\.map/);
  assert.match(src, /splitBilingualName/);
  assert.match(src, /bdi/);
  assert.doesNotMatch(src, /pl\?\.totalRevenue/);
  assert.match(src, /simplePlStepsNet/);
  assert.match(src, /simplePlDeptAdjustment/);
  assert.match(src, /keptPer100\.midLoss/);
});

test('F3-6.2 rendered steps add to pl.netIncome; outside 4000/4010 uses netRevenue + returns + discounts − deptLines', () => {
  const nov11 = {
    netRevenue: 220.86,
    totalCOGS: 133.64,
    grossProfit: 87.22,
    totalOperatingExpenses: 24.13,
    totalOtherIncome: 0,
    totalOtherExpenses: 0,
    netIncome: 67.09,
    cashOverShort: { net: 4 },
  };
  assert.equal(simplePlStepsNet(nov11), 67.09);
  const src = readFileSync(join(here, 'SimpleProfitLossPanel.jsx'), 'utf8');
  assert.match(src, /simplePlStepsNet\(pl\)/);
  const outside = {
    netRevenue: 230.86,
    salesReturns: { amount: 10 },
    discounts: { amount: 5 },
    departmentBridge: { deptLinesTotal: 220.86, invoiceAdjustments: 0 },
  };
  assert.equal(simplePlDeptAdjustment(outside), 25);
  assert.equal(230.86 + 10 + 5 - 220.86, 25);
});
