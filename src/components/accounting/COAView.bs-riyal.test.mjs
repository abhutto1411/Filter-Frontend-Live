import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('COAView BS block uses fmtAmt not fmtMoney/SAR', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'COAView.jsx'), 'utf8');
  const start = src.indexOf('const b = bsData ||');
  assert.ok(start >= 0, 'missing const b = bsData ||');
  const end = src.indexOf('const modalTitle', start);
  assert.ok(end > start, 'missing const modalTitle after BS block');
  const block = src.slice(start, end);
  const n = (block.match(/fmtAmt\(/g) || []).length;
  assert.ok(n >= 10, `expected >= 10 fmtAmt( in BS block, got ${n}`);
  assert.doesNotMatch(block, /fmtMoney\(/);
  assert.doesNotMatch(block, /SAR/);
});
