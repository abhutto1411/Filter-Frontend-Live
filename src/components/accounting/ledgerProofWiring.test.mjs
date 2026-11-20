import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

test('ExpenseProofThumbnail passes a third argument to getLedgerLineProofBlob', () => {
  const src = readFileSync(join(here, 'ExpenseProofThumbnail.jsx'), 'utf8');
  assert.match(
    src,
    /getLedgerLineProofBlob\(accountId,\s*proofLineId,\s*proofParams\)/,
  );
});

test('MonitorAccountLedgerPage passes accountId= and proofParams= to ProfessionalLedgerStatementDocument', () => {
  const src = readFileSync(
    join(here, '../../pages/admin/MonitorAccountLedgerPage.jsx'),
    'utf8',
  );
  assert.match(src, /<ProfessionalLedgerStatementDocument/);
  assert.match(src, /accountId=\{!isSupplier \? accountId : undefined\}/);
  assert.match(src, /proofParams=\{/);
});
