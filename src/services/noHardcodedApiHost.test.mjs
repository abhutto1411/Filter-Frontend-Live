/**
 * Run: node --test src/services/noHardcodedApiHost.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..');
const ALLOW_PREFIX = [
  path.join('services', 'apiBaseUrl'),
  path.join('services', 'noHardcodedApiHost'),
];

/** API base URL literals only (not marketing/legal website links). */
const FORBIDDEN =
  /https?:\/\/[^\s'"`]*(?:railway\.app|filtercarservices\.com|localhost:3000)/i;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      walk(full, out);
      continue;
    }
    if (!/\.(js|jsx)$/.test(ent.name)) continue; // skip *.test.mjs
    out.push(full);
  }
  return out;
}

describe('no hardcoded API host in src', () => {
  it('forbids API origin literals outside apiBaseUrl.js', () => {
    const hits = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file);
      if (ALLOW_PREFIX.some((p) => rel.startsWith(p))) continue;
      const text = fs.readFileSync(file, 'utf8');
      // Ignore pure documentation comments that name origins without assigning BASE_URL.
      if (!FORBIDDEN.test(text)) continue;
      // Legal/marketing site URLs (non-API) are out of scope for this guard.
      if (
        /filtercarservices\.com\/(privacy|terms|account)/i.test(text) &&
        !/BASE_URL|VITE_API|apiFetch|axios/i.test(text)
      ) {
        continue;
      }
      hits.push(rel.replace(/\\/g, '/'));
    }
    assert.deepEqual(
      hits,
      [],
      `Hard-coded API hosts found in:\n${hits.join('\n')}`,
    );
  });

  it('DOCUMENTED_API_ORIGINS only in apiBaseUrl.js (D2)', () => {
    const hits = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file).replace(/\\/g, '/');
      if (ALLOW_PREFIX.some((p) => rel.startsWith(p.replace(/\\/g, '/')))) {
        continue;
      }
      if (rel === 'services/apiBaseUrl.js') continue;
      const text = fs.readFileSync(file, 'utf8');
      if (/DOCUMENTED_API_ORIGINS/.test(text)) hits.push(rel);
    }
    assert.deepEqual(hits, []);
  });
});
