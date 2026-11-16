import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function src(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

test('F3-5 FE list/detail readers do not expect list data: proofUrl', () => {
  const approvals = src('pages/workshop/WorkshopApprovals.jsx');
  assert.match(approvals, /getPettyCashRequestProofBlob/);
  assert.match(approvals, /revokeObjectURL/);
  assert.doesNotMatch(approvals, /res\?\.proofUrl/);
  assert.match(approvals, /hasProof/);

  const thumb = src('components/accounting/ExpenseProofThumbnail.jsx');
  assert.match(thumb, /hasExpenseProof/);
  assert.match(thumb, /proof\.onFile/);

  const myPetty = src('pages/workshop/WorkshopMyPettyCash.jsx');
  assert.match(myPetty, /ExpenseProofThumbnail/);
});

test('F3-6.3 workshop P&L CSV is wired to plExportRows', () => {
  const page = src('components/accounting/reports/ProfitLossPage.jsx');
  assert.match(page, /plExportRows/);
  assert.match(page, /proof\.exportCsv/);
  assert.match(page, /downloadCsv/);
});

test('F3-6.4 EN/AR loss wording keys exist', () => {
  const i18n = src('utils/accountingI18n.js');
  assert.match(i18n, /keptPer100\.midLoss.: 'of sales you lost'/);
  assert.match(i18n, /keptPer100\.midLoss.: 'من المبيعات، خسرت'/);
});
