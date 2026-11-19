/**
 * Part 0: DevApiBadge.jsx must parse (no duplicate shouldShowDevApiBadge).
 * Run: node --test src/components/devApiBadgeModule.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('DevApiBadge.jsx module parse', () => {
  it('esbuild.transform succeeds (no duplicate declaration)', async () => {
    const src = fs.readFileSync(path.join(__dirname, 'DevApiBadge.jsx'), 'utf8');
    const result = await esbuild.transform(src, {
      loader: 'jsx',
      sourcefile: 'DevApiBadge.jsx',
    });
    assert.ok(result.code);
    assert.equal(
      (src.match(/export function shouldShowDevApiBadge/g) || []).length,
      0,
    );
  });
});
