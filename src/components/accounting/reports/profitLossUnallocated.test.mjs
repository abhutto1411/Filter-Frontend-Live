import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  incVatAuditSequence,
  incVatDisplayRows,
  sumBranchAndUnallocated,
} from './profitLossRows.js';

const fixture = {
  netIncome: 63377.83,
  unallocated: { netIncome: 294822.96 },
  purchasesInPeriod: {
    exVat: 147398,
    vat: 22110.09,
    incVat: 169508.09,
  },
  incVatView: {
    netRevenueExVat: 274805.1,
    outputVatOnSales: 41379.93,
    returnsVat: 159.84,
    netOutputVat: 41220.09,
    netRevenueIncVat: 316025.19,
    cogsExVat: 156877.55,
    cogsVat: 23532.05,
    cogsIncVat: 180409.6,
    grossProfitExVat: 117927.55,
    grossProfitIncVat: 135615.59,
    inputVatRecoverable: 22104.33,
    netVatPayable: 19115.76,
    purchaseInputVatRate: 0.15,
    purchaseInputVatRatePct: 15,
    purchaseRateWindow: 'period',
    vatSource: { revenue: 'ledger', cogs: 'purchase_rate' },
  },
};

test('ws3 br5 Sep: branch net + unallocated = workshop net', () => {
  const s = sumBranchAndUnallocated(fixture);
  assert.equal(s.branchNet, 63377.83);
  assert.equal(s.unallocatedNet, 294822.96);
  assert.equal(s.total, 358200.79);
});

test('Inc-VAT audit sequence matches staging fixture order', () => {
  const seq = incVatAuditSequence(fixture.incVatView);
  assert.deepEqual(seq, [
    274805.1,
    41379.93,
    159.84,
    41220.09,
    316025.19,
    180409.6,
    135615.59,
    19115.76,
  ]);
});

test('pl.incVatView.note exists in EN and AR', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '../../../utils/accountingI18n.js'), 'utf8');
  const hits = src.match(/'pl\.incVatView\.note':/g) || [];
  assert.ok(hits.length >= 2, `expected EN+AR note keys, got ${hits.length}`);
  assert.match(src, /Inc-VAT figures are for reference only/);
  assert.doesNotMatch(
    readFileSync(join(here, 'profitLossRows.js'), 'utf8'),
    /1\.15/,
  );
});

test('COGS VAT cell and rate label come from API fields', () => {
  const rows = incVatDisplayRows(fixture.incVatView, fixture);
  const cogs = rows.find((r) => r.key === 'cogs');
  assert.equal(cogs.vat, 23532.05);
  assert.equal(cogs.pct, '15.00');
  assert.equal(cogs.labelKey, 'pl.incVatView.row.cogsPeriod');
});
