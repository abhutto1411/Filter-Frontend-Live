import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsvString } from './csvDownload.js';
import { money2Str, plExportRows } from '../components/accounting/reports/profitLossRows.js';
import { accT } from './accountingI18n.js';

test('CSV starts with BOM and uses CRLF', () => {
  const csv = buildCsvString([['Period', '01/11/2026']], ['Account', 'Total'], [['Net', '67.09']]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('\r\n'));
});

test('11 Nov fixture last line is Net income,67.09 EN and AR', () => {
  const pl = {
    netRevenue: 220.86,
    salesReturns: { amount: 0 },
    discounts: { amount: 0 },
    totalCOGS: 133.64,
    grossProfit: 87.22,
    totalOperatingExpenses: 24.13,
    totalOtherIncome: 0,
    totalOtherExpenses: 0,
    cashOverShort: { net: 4 },
    netIncome: 67.09,
  };
  const rows = plExportRows(pl).map((r) => [accT('en', `csv.${r.section}`), r.amount]);
  const en = buildCsvString([], ['Account', 'Total'], rows);
  assert.ok(en.includes('Net income,67.09'));
  const arRows = plExportRows(pl).map((r) => [accT('ar', `csv.${r.section}`), r.amount]);
  const ar = buildCsvString([], ['Account', 'Total'], arRows);
  assert.ok(ar.includes('صافي الدخل,67.09'));
  for (const r of plExportRows(pl)) {
    assert.match(String(r.amount), /^-?\d+\.\d{2}$/);
  }
});

test('June float 54345.350000000006 is 54345.35', () => {
  assert.equal(money2Str(54345.350000000006), '54345.35');
});
