/**
 * Part 0: every src JS/JSX file must parse (catches duplicate declarations).
 * Run: node --test src/fe-parse-all-changed.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(ent.name) && !ent.name.endsWith('.test.mjs')) {
      out.push(full);
    }
  }
  return out;
}

describe('FE parse-all src', () => {
  it('esbuild.transform every .js/.jsx under src', async () => {
    const files = walk(srcRoot);
    assert.ok(files.length > 50, `expected many files, got ${files.length}`);
    const failures = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const loader = f.endsWith('.jsx') ? 'jsx' : 'js';
      try {
        await esbuild.transform(src, {
          loader,
          sourcefile: path.relative(srcRoot, f),
        });
      } catch (err) {
        failures.push(`${path.relative(srcRoot, f)}: ${err.message}`);
      }
    }
    assert.deepEqual(failures, []);
  });
});
