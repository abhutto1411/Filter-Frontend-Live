import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
import {
  DAR_V6_PROOF_PATH,
  DAR_V6_UNAVAILABLE,
  allowlistedProofApiHref,
  allowlistedSourceHref,
  buildRequestKey,
  classifyDarError,
  formatDarErrorDetail,
  formatExactDecimal,
  formatMetricValue,
  formatOwnerScopeLine,
  formatRiyadhDateClock,
  formatRiyadhExclusiveWindow,
  sessionChipLabel,
  sessionOpenedGroupLabel,
  sessionSelectedChipLabel,
  parseIdList,
  pruneStaleSessionIds,
  sessionsForSelectedBranches,
  readOwnedSearch,
  shouldSyncDarUrl,
  todayRiyadhYmd,
  validateReportPayload,
  isStaleRequest,
  serializeDarQuery,
  wrapProofHref,
  writeOwnedSearch,
  DAR_V6_SECTION_TABS,
  readDarSectionTab,
} from './dailyActivityFormat.js';

function emptyReport(overrides = {}) {
  return {
    schemaVersion: 'dar.v6',
    meta: { verificationStatus: 'partial', snapshotToken: 'tok', from: '2026-11-06', to: '2026-11-06' },
    filters: { actorSourceAvailable: false, sessions: [] },
    kpis: {},
    summary: { net: { key: 'summary.net', value: null, status: 'unavailable' } },
    departments: [],
    sessions: {},
    money: {},
    operations: [],
    technicians: {},
    coverage: [],
    reconciliation: [],
    ...overrides,
  };
}

test('null and unavailable format as em dash, not 0', () => {
  assert.equal(formatExactDecimal(null), DAR_V6_UNAVAILABLE);
  assert.equal(formatExactDecimal(''), DAR_V6_UNAVAILABLE);
  assert.equal(
    formatMetricValue({ value: null, status: 'unavailable', kind: 'money' }),
    DAR_V6_UNAVAILABLE,
  );
  assert.equal(formatExactDecimal('0.00'), '0.00');
  assert.equal(formatExactDecimal('0'), '0.00');
});

test('groups huge decimals without Number coercion and keeps quantity precision', () => {
  assert.equal(formatExactDecimal('123456789012345.67'), '123,456,789,012,345.67');
  assert.equal(formatExactDecimal('-80.00'), '-80.00');
  assert.equal(formatExactDecimal('12.250', { kind: 'quantity' }), '12.250');
  assert.notEqual(formatExactDecimal('26170.00'), '26,170');
  assert.equal(formatExactDecimal('26170.00'), '26,170.00');
});

test('owned URL state does not invent sessions and serializes All as omitted', () => {
  const q = {
    from: '2026-11-06',
    to: '2026-11-06',
    branchIds: ['10', '11'],
    sessionIds: [],
    actorSource: 'all',
  };
  const params = writeOwnedSearch(q);
  assert.equal(params.get('from'), '2026-11-06');
  assert.equal(params.get('branchIds'), '10,11');
  assert.equal(params.get('sessionIds'), null);
  assert.equal(params.get('actorSource'), null);
  const back = readOwnedSearch(params);
  assert.deepEqual(back.branchIds, ['10', '11']);
  assert.deepEqual(back.sessionIds, []);
  assert.equal(shouldSyncDarUrl('/workshop/daily-activity'), true);
  assert.equal(shouldSyncDarUrl('/workshop/reports'), false);
});

test('rejects SQL-looking id lists and prunes stale sessions after branch change', () => {
  assert.deepEqual(parseIdList('1; DROP TABLE invoices'), []);
  assert.deepEqual(parseIdList('10,10,11'), ['10', '11']);
  const pruned = pruneStaleSessionIds(['101', '999'], [{ id: '101' }]);
  assert.deepEqual(pruned.ids, ['101']);
  assert.equal(pruned.cleared, true);
  const scoped = sessionsForSelectedBranches(
    [
      { id: '1', branchId: '5' },
      { id: '2', branchId: '14' },
      { id: '3', branchId: '5' },
    ],
    ['5'],
  );
  assert.deepEqual(
    scoped.map((s) => s.id),
    ['1', '3'],
  );
  const prunedBranch = pruneStaleSessionIds(
    ['1', '2'],
    [
      { id: '1', branchId: '5' },
      { id: '2', branchId: '14' },
    ],
    ['5'],
  );
  assert.deepEqual(prunedBranch.ids, ['1']);
  assert.equal(prunedBranch.cleared, true);
  assert.equal(sessionsForSelectedBranches([{ id: '9', branchId: '5' }], []).length, 1);
});

test('race discard and request key stay stable for the same filters', () => {
  const a = { from: '2026-11-06', to: '2026-11-06', branchIds: ['1'], sessionIds: [], actorSource: 'all' };
  const b = { ...a, to: '2026-11-07' };
  assert.equal(buildRequestKey(a), buildRequestKey({ ...a }));
  assert.equal(isStaleRequest(buildRequestKey(a), buildRequestKey(b)), true);
  assert.equal(isStaleRequest(buildRequestKey(a), buildRequestKey(a)), false);
});

test('contract validation and 404/409 classification', () => {
  assert.equal(validateReportPayload(emptyReport()).ok, true);
  assert.equal(validateReportPayload({ schemaVersion: 'dar.v2' }).code, 'BACKEND_UPDATE_REQUIRED');
  assert.equal(classifyDarError({ status: 404 }).kind, 'backend');
  assert.equal(classifyDarError({ status: 409, code: 'REPORT_SNAPSHOT_CHANGED' }).kind, 'snapshot');
  assert.equal(classifyDarError({ status: 403 }).kind, 'forbidden');
  assert.equal(classifyDarError({ status: 500 }).kind, 'unknown');
  assert.equal(classifyDarError({ status: 400, code: 'DAR_RANGE_TOO_LARGE' }).kind, 'invalid');
  assert.equal(
    formatDarErrorDetail({
      status: 400,
      code: 'DAR_RANGE_TOO_LARGE',
      message: 'Range is 62 inclusive days; max is 31',
    }),
    'HTTP 400 · DAR_RANGE_TOO_LARGE · Range is 62 inclusive days; max is 31',
  );
  assert.equal(
    formatDarErrorDetail({
      status: 500,
      message: 'The column `global_advances.workshop_id` does not exist in the current database.',
    }),
    'HTTP 500 · The column `global_advances.workshop_id` does not exist in the current database.',
  );
});

test('MetricLink wraps BE proof href on the full-screen FE route', () => {
  const href = wrapProofHref({
    key: 'summary.net',
    proof: {
      metricKey: 'summary.net',
      href: '/workshop-staff/reports/daily-activity/v6/proof?metricKey=summary.net&snapshotToken=abc',
    },
  });
  assert.equal(
    href,
    `${DAR_V6_PROOF_PATH}?metricKey=summary.net&snapshotToken=abc`,
  );
  assert.ok(!href.includes('26170'));
  assert.equal(allowlistedProofApiHref('https://other.host/workshop-staff/reports/daily-activity/v6/proof'), '');
  assert.equal(allowlistedSourceHref('/tmp/passwd'), '');
  const fallback = wrapProofHref(
    { key: 'summary.net', proof: { metricKey: 'summary.net', href: '/evil' } },
    { snapshotToken: 'tok', from: '2026-11-06', to: '2026-11-06', branchIds: ['1'] },
  );
  assert.equal(fallback.startsWith(DAR_V6_PROOF_PATH), true);
  assert.equal(new URLSearchParams(fallback.split('?')[1]).get('metricKey'), 'summary.net');
  assert.equal(new URLSearchParams(fallback.split('?')[1]).get('branchIds'), '1');
});

test('API query names stay on the inspected contract', () => {
  const qs = serializeDarQuery({
    from: '2026-11-06',
    to: '2026-11-06',
    branchIds: ['1', '2'],
    sessionIds: ['101'],
    actorSource: 'all',
  });
  const parsed = new URLSearchParams(qs);
  assert.equal(parsed.get('from'), '2026-11-06');
  assert.equal(parsed.get('to'), '2026-11-06');
  assert.equal(parsed.get('branchIds'), '1,2');
  assert.equal(parsed.get('sessionIds'), '101');
  assert.equal(parsed.get('actorSource'), null);
  assert.equal(parsed.get('asOf'), null);
  const withAsOf = serializeDarQuery({
    from: '2026-09-06',
    to: '2026-09-06',
    snapshotToken: 'tok',
    asOf: '2026-09-06T08:00:00.000Z',
  });
  assert.equal(new URLSearchParams(withAsOf).get('asOf'), '2026-09-06T08:00:00.000Z');
});

test('owner scope line uses Riyadh labels, not raw ISO Z windows', () => {
  const line = formatOwnerScopeLine(
    { from: '2026-09-06', to: '2026-09-06' },
    'en',
  );
  assert.equal(line, '06 Sep 2026 · Asia/Riyadh (UTC+3)');
  assert.equal(line.includes('2026-09-06T'), false);
  const window = formatRiyadhExclusiveWindow(
    '2026-09-06T05:00:00.000Z',
    '2026-09-07T21:00:00.000Z',
  );
  assert.match(window, /end exclusive/);
  assert.equal(window.includes('2026-09-06T05:00:00.000Z'), false);
  assert.match(window, /06 Sept? 2026 08:00/);
});

test('session chips show opening DATE + TIME in Asia/Riyadh and never infer it from the id', () => {
  const overnight = {
    id: '1562',
    cashierName: 'Fatima',
    branchId: '5',
    openedAt: '2026-09-08T14:11:29.525Z',
    closedAt: '2026-09-09T00:05:21.842Z',
    status: 'closed',
  };
  const chip = sessionSelectedChipLabel(overnight, 'en');
  const full = sessionChipLabel(overnight, 'en');
  const group = sessionOpenedGroupLabel(overnight, 'en');
  const open = formatRiyadhDateClock(overnight.openedAt, 'en');
  assert.match(open, /08 Sept? 2026 17:11/);
  assert.match(chip, /1562/);
  assert.match(chip, /08 Sept? 2026 17:11/);
  assert.equal(chip.includes('17:11'), true);
  assert.equal(chip.includes('tooltip'), false);
  assert.match(full, /08 Sept? 2026 17:11/);
  assert.match(full, /09 Sept? 2026 03:05/);
  assert.match(full, /Asia\/Riyadh/);
  assert.match(group, /08 Sept? 2026/);
  assert.equal(full.includes('1562-09-08'), false);
});

test('today Riyadh is a YMD and does not use a fabricated wireframe date as default fixture', () => {
  const today = todayRiyadhYmd(new Date('2026-11-06T01:30:00.000Z'));
  assert.equal(today, '2026-11-06');
  assert.notEqual(today, '2026-09-14');
});

test('disk daily-activity.css still contains owner chrome selectors', () => {
  const css = readFileSync(join(here, 'daily-activity.css'), 'utf8');
  assert.ok(css.length > 10000, `css too small: ${css.length}`);
  for (const sel of [
    '.dar-v6 {',
    '.dar-v6-filters',
    '.dar-v6-field',
    '.dar-v6-kpis',
    '.dar-v6-table',
    '.dar-v6-jump',
    '.dar-v6-verify-overlay',
    '.dar-v6-verify-panel',
    '.dar-v6-fold',
    '.dar-v6-scope-groups',
    '.dar-v6-scope-tag',
  ]) {
    assert.ok(css.includes(sel), sel);
  }
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
});

test('section hash maps to 00–04 tabs; missing hash is Accumulated', () => {
  assert.deepEqual(
    DAR_V6_SECTION_TABS.map((tab) => tab.id),
    ['accumulated', 'depts', 'sessions', 'finance', 'operations'],
  );
  assert.equal(readDarSectionTab(''), 'accumulated');
  assert.equal(readDarSectionTab('#accumulated'), 'accumulated');
  assert.equal(readDarSectionTab('#sessions'), 'sessions');
  assert.equal(readDarSectionTab('sessions'), 'sessions');
  assert.equal(readDarSectionTab('#finance'), 'finance');
  assert.equal(readDarSectionTab('#operations'), 'operations');
  assert.equal(readDarSectionTab('#technicians'), 'operations');
  assert.equal(readDarSectionTab('#coverage'), 'operations');
  assert.equal(readDarSectionTab('#unknown'), 'accumulated');
});
