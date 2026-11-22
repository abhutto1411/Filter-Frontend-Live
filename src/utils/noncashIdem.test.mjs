import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

test('newIdemKey is called at least 7 times (mount, 3 errors, 3 successes)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    join(here, '../pages/workshop/accounting/WorkshopNoncashPurchaseDetailPage.jsx'),
    'utf8',
  );
  const calls = src.match(/newIdemKey\(/g) || [];
  assert.ok(calls.length >= 7, `expected >= 7 newIdemKey() calls, got ${calls.length}`);
});
