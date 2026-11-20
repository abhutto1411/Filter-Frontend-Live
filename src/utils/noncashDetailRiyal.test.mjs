import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('non-cash detail wraps every formatSarLatn in bdi + RiyalIcon (6 sites)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    join(here, '../pages/workshop/accounting/WorkshopNoncashPurchaseDetailPage.jsx'),
    'utf8',
  );
  assert.match(src, /import RiyalIcon from '\.\.\/\.\.\/\.\.\/components\/RiyalIcon'/);
  const calls = src.match(/formatSarLatn\(/g) || [];
  assert.equal(calls.length, 6, `expected 6 formatSarLatn( calls, got ${calls.length}`);
  const lines = src.split(/\r?\n/);
  const hit = lines.filter((ln) => ln.includes('formatSarLatn('));
  assert.equal(hit.length, 6);
  for (const ln of hit) {
    assert.match(ln, /<bdi dir="ltr">\{formatSarLatn\(/);
    assert.match(ln, /<RiyalIcon/);
  }
});
