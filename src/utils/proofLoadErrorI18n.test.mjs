import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { awT } from './adminWalletsI18n.js';

const here = dirname(fileURLToPath(import.meta.url));

test('proof load errors do not render e?.message; proof.loadFailed EN≠AR', () => {
  const thumb = readFileSync(
    join(here, '../components/accounting/ExpenseProofThumbnail.jsx'),
    'utf8',
  );
  const approvals = readFileSync(
    join(here, '../pages/workshop/WorkshopApprovals.jsx'),
    'utf8',
  );
  assert.doesNotMatch(thumb, /setLoadErr\(e\?\.message/);
  assert.match(thumb, /setLoadErr\(t\('proof\.loadFailed'\)\)/);
  assert.doesNotMatch(
    approvals,
    /setViewProof\(\{ url: '', loading: false, error: e\?\.message/,
  );
  assert.match(approvals, /error: t\('proof\.error'\)/);

  const en = awT('en', 'proof.loadFailed');
  const ar = awT('ar', 'proof.loadFailed');
  assert.notEqual(en, 'proof.loadFailed');
  assert.notEqual(ar, 'proof.loadFailed');
  assert.notEqual(en, ar);
  assert.equal(en, 'Could not load the proof. Try again.');
  assert.equal(ar, 'تعذّر تحميل الإثبات. حاول مرة أخرى.');
  assert.doesNotMatch(en, /SAR|ر\.س|\uFDFC/);
  assert.doesNotMatch(ar, /SAR|ر\.س|\uFDFC/);
});
