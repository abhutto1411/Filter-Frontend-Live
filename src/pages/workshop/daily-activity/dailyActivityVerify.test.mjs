import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { darT } from './dailyActivityI18n.js';
import {
  buildVerifyQueryFromCaptured,
  sanitizeVerifyReason,
  serializeVerifyQuery,
  shouldAbortVerify,
  verifyErrorPayload,
  verifyStatusFromPayload,
} from './dailyActivityVerify.js';

const here = dirname(fileURLToPath(import.meta.url));

test('verify status machine binds to this snapshot and never invents matched', () => {
  assert.equal(verifyStatusFromPayload(null, 'tok'), 'unverified');
  assert.equal(
    verifyStatusFromPayload({ overallStatus: 'matched', snapshotToken: 'other' }, 'tok'),
    'stale',
  );
  assert.equal(
    verifyStatusFromPayload({ overallStatus: 'partial', snapshotToken: 'tok' }, 'tok'),
    'partial',
  );
  assert.equal(
    verifyStatusFromPayload({ overallStatus: 'matched', snapshotToken: 'tok' }, 'tok'),
    'matched',
  );
  assert.equal(verifyStatusFromPayload({ overallStatus: 'nope', snapshotToken: 'tok' }, 'tok'), 'error');
});

test('filter or snapshot change aborts in-flight verify', () => {
  assert.equal(shouldAbortVerify('a|snap-1', 'b|snap-1'), true);
  assert.equal(shouldAbortVerify('a|snap-1', 'a|snap-2'), true);
  assert.equal(shouldAbortVerify('a|snap-1', 'a|snap-1'), false);
  assert.equal(shouldAbortVerify('', 'a|snap-1'), false);
});

test('verify query serializes snapshot binding and omits empty fingerprint', () => {
  const q = serializeVerifyQuery({
    from: '2026-09-06',
    to: '2026-09-06',
    branchIds: ['5'],
    sessionIds: [],
    snapshotToken: 'snap',
  });
  assert.match(q, /from=2026-09-06/);
  assert.match(q, /branchIds=5/);
  assert.match(q, /snapshotToken=snap/);
  assert.equal(q.includes('sourceFingerprint'), false);
  const withFp = serializeVerifyQuery({
    from: '2026-09-06',
    to: '2026-09-06',
    snapshotToken: 'snap',
    sourceFingerprint: 'abc',
  });
  assert.match(withFp, /sourceFingerprint=abc/);
});

test('verify request echoes captured asOf; omitting asOf is the 409 foot-gun', () => {
  const applied = { from: '2026-09-06', to: '2026-09-06', branchIds: ['5'], sessionIds: [] };
  const captured = {
    meta: {
      snapshotToken: 'tok',
      asOf: '2026-09-06T08:00:00.000Z',
      sourceFingerprint: 'fp',
    },
  };
  const q = buildVerifyQueryFromCaptured(applied, captured);
  assert.equal(q.asOf, '2026-09-06T08:00:00.000Z');
  assert.equal(q.snapshotToken, 'tok');
  const qs = serializeVerifyQuery(q);
  assert.match(qs, /asOf=2026-09-06T08%3A00%3A00.000Z/);
  const missing = serializeVerifyQuery({ ...applied, snapshotToken: 'tok' });
  assert.equal(missing.includes('asOf'), false);
});

test('error payload stays empty of fake metrics and shows a safe snapshot reason', () => {
  const payload = verifyErrorPayload(
    { meta: { snapshotToken: 'tok' } },
    { status: 409, code: 'REPORT_SNAPSHOT_CHANGED', classified: { kind: 'snapshot', status: 409, code: 'REPORT_SNAPSHOT_CHANGED' } },
  );
  assert.equal(payload.overallStatus, 'error');
  assert.deepEqual(payload.metrics, []);
  assert.ok(payload.reasons.includes('snapshot'));
  assert.ok(payload.reasons.some((r) => /409/.test(r) && /REPORT_SNAPSHOT_CHANGED/.test(r)));
  assert.equal(sanitizeVerifyReason('Bearer abc snapshotToken=secret'), '');
});

test('verify panel source uses a body portal and renders error copy without inventing rows', () => {
  const sections = readFileSync(join(here, 'DailyActivitySections.jsx'), 'utf8');
  const css = readFileSync(join(here, 'daily-activity.css'), 'utf8');
  assert.ok(sections.includes('createPortal'));
  assert.ok(sections.includes('document.body'));
  assert.ok(sections.includes('modal-overlay'));
  assert.ok(sections.includes('verify.empty'));
  assert.ok(css.includes('z-index: 9999'));
  assert.equal(darT('en', 'verify.empty').includes('No metric rows'), true);
  assert.notEqual(darT('en', 'verify.empty'), darT('ar', 'verify.empty'));
});
