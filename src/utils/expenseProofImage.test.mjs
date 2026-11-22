import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compressExpenseProofFile } from './expenseProofImage.js';

test('accept string has no heic or gif', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    join(here, '../components/accounting/ExpenseProofPicker.jsx'),
    'utf8',
  );
  const m = src.match(/EXPENSE_PROOF_ACCEPT\s*=\s*'([^']+)'/);
  assert.ok(m);
  assert.equal(/heic|heif|gif/i.test(m[1]), false);
  assert.ok(m[1].includes('image/jpeg'));
});

test('fake {name:a.HEIC, type:\'\'} rejects with PROOF_HEIC_UNSUPPORTED', async () => {
  await assert.rejects(
    () => compressExpenseProofFile({ name: 'a.HEIC', type: '' }),
    (err) => {
      assert.equal(err.code, 'PROOF_HEIC_UNSUPPORTED');
      return true;
    },
  );
});
