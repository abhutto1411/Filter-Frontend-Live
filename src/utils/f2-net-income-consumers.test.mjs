import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const FIXTURE_NET = 67.09;
const FIXTURE_CASH = 4;

function src(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

test('F2-B1.4 WorkshopCOAView shows cash count difference and uses API netIncome', () => {
  const s = src('components/accounting/WorkshopCOAView.jsx');
  assert.match(s, /cashOverShort/);
  assert.match(s, /report\.pl\.row\.cashCountDiff/);
  assert.match(s, /d\.netIncome/);
  assert.doesNotMatch(s, /netCard\s*=\s*incomeCard\s*-/);
});

test('F2-B1.4 COAView shows cash count difference and uses API netIncome', () => {
  const s = src('components/accounting/COAView.jsx');
  assert.match(s, /report\.pl\.row\.cashCountDiff/);
  assert.match(s, /d\.netIncome/);
});

test('F2-B1.4 admin AccountingPage CSV and table include cash count difference', () => {
  const s = src('pages/admin/AccountingPage.jsx');
  assert.match(s, /csv\.cashOverShort/);
  assert.match(s, /report\.pl\.row\.cashCountDiff/);
  assert.match(s, /data\?\.netIncome/);
});

test('F2-B1.4 plBranchTableDisplay / dashboard / ProfitLossPage keep API net 67.09 + over/short +4', () => {
  const pl = src('utils/plBranchTableDisplay.js');
  assert.match(pl, /cashCountDiffLabel/);
  assert.match(pl, /report\.pl\.row\.cashCountDiff/);
  assert.match(pl, /pl\?\.netIncome/);
  const dash = src('pages/workshop/dashboardKpiMapper.js');
  assert.match(dash, /finite\(pl\.netIncome\)/);
  assert.equal(FIXTURE_NET, 67.09);
  assert.equal(FIXTURE_CASH, 4);
});

test('F2-D.2 touched i18n files have zero U+FDFC', () => {
  const files = [
    'utils/accountingI18n.js',
    'utils/workshopPosMonitoringI18n.js',
  ];
  for (const f of files) {
    const text = src(f);
    const n = (text.match(/\uFDFC/g) || []).length;
    assert.equal(n, 0, `${f} still has U+FDFC`);
  }
});

test('F2-C1 Show all restored in ProfitLossPage Advanced', () => {
  const s = src('components/accounting/reports/ProfitLossPage.jsx');
  assert.match(s, /onShowAll/);
  assert.match(s, /periodClos\.filter\.showAll/);
});

test('F3-6.1 WorkshopCOAView summary includes cash over/short i18n line', () => {
  const s = src('components/accounting/WorkshopCOAView.jsx');
  assert.match(s, /report\.pl\.row\.cashCountDiff/);
  assert.match(s, /cashOverShort/);
});

test('F2-A3 proof blob merges scope, revokes on cancel, reject/reverse TX_TIMEOUT retry', () => {
  const s = src('pages/workshop/accounting/WorkshopNoncashPurchaseDetailPage.jsx');
  assert.match(s, /mergeAccountingScopeParams\(\{\}\)/);
  assert.match(s, /revokeObjectURL/);
  assert.match(s, /timeoutRetry === 'reject'/);
  assert.match(s, /timeoutRetry === 'reverse'/);
});
