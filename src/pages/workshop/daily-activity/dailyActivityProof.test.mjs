import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DAR_V6_PROOF_PATH,
  DAR_V6_UNAVAILABLE,
  allowlistedProofApiHref,
  allowlistedSourceHref,
  classifyDarError,
  formatMetricValue,
  wrapProofHref,
} from './dailyActivityFormat.js';
import { darT } from './dailyActivityI18n.js';
import {
  captureReopenIntentFromSearch,
  nextProofSearch,
  proofFullResultDisplay,
  readProofSearch,
  reportHrefFromProofQuery,
  resetReopenIntentForTests,
  safeDarReturnHash,
  takeReopenIntent,
  validateProofPayload,
  wrapOperandProofHref,
} from './dailyActivityProof.js';
import { collectDepartmentMetrics } from './dailyActivityDepartments.js';
import { collectRestMetrics } from './dailyActivityRest.js';
import { collectSummaryMetrics } from './dailyActivitySummary.js';

const FORBIDDEN = ['26170', '26,170', '30095.50', '30,095.50', '13429.29', '13,429.29', '-60.00'];
const here = dirname(fileURLToPath(import.meta.url));

function unitProof(overrides = {}) {
  return {
    schemaVersion: 'dar.v6.proof',
    metric: {
      key: 'summary.net',
      value: null,
      kind: 'money',
      unit: 'SAR',
      status: 'unavailable',
      scope: 'period',
      source: 'dar.v6.net',
      reason: 'Net is null while Commissions Due (or any required operand) is unavailable.',
      proof: {
        metricKey: 'summary.net',
        href: '/workshop-staff/reports/daily-activity/v6/proof?metricKey=summary.net&snapshotToken=UNIT-TEST-ONLY-not-a-live-token',
      },
    },
    snapshotToken: 'UNIT-TEST-ONLY-not-a-live-token',
    reducer: 'formula',
    rows: [],
    nextCursor: null,
    fullResult: {
      rowCount: {
        key: 'summary.net.fullResult.rowCount',
        value: '0',
        kind: 'count',
        unit: 'count',
        status: 'ok',
        scope: 'period',
        source: 'dar.v6.net',
        reason: 'UNIT-TEST-ONLY',
        proof: { metricKey: 'summary.net', href: '/workshop-staff/reports/daily-activity/v6/proof?metricKey=summary.net' },
      },
      reconciledValue: null,
      difference: null,
    },
    derivation: {
      expression:
        'salesInclVat − purchase_invoices − non_cash − petty − other_purchases − other_expenses − commissions_due − advances − other_external_outflows',
      operands: [
        {
          label: 'commissions_due',
          value: null,
          proofHref:
            '/workshop-staff/reports/daily-activity/v6/proof?metricKey=summary.deductions.commissions_due.amount',
        },
      ],
    },
    coverage: {
      complete: false,
      reasons: ['Commissions Due blocked — no due_date'],
    },
    ...overrides,
  };
}

function unitRowsProof() {
  return unitProof({
    metric: {
      key: 'money.petty.total',
      value: '12.00',
      kind: 'money',
      unit: 'SAR',
      status: 'ok',
      scope: 'period',
      source: 'dar.v6.petty',
      reason: 'UNIT-TEST-ONLY',
      proof: {
        metricKey: 'money.petty.total',
        href: '/workshop-staff/reports/daily-activity/v6/proof?metricKey=money.petty.total&snapshotToken=UNIT-TEST-ONLY-not-a-live-token',
      },
    },
    reducer: 'sum',
    rows: [
      {
        id: 'src-1',
        canonicalEventKey: 'petty:9',
        sourceType: 'petty_expense',
        sourceId: '9',
        businessDate: '2026-11-06',
        recordedAt: '2026-11-06T10:00:00.000Z',
        branchId: '1',
        actor: 'web',
        reference: 'PETTY-9',
        quantity: null,
        uom: null,
        net: '12.00',
        vat: '0.00',
        gross: '12.00',
        contribution: '12.00',
        included: true,
        reason: 'in scope',
        journalId: null,
        journalStatus: 'unposted',
        journalNote: 'No active posted journal was found for this document under the authorized workshop.',
        authorizedSourceHref: '/workshop/petty-cash/9',
      },
      {
        id: 'src-2',
        canonicalEventKey: 'petty:10',
        sourceType: 'petty_expense',
        sourceId: '10',
        businessDate: '2026-11-06',
        recordedAt: null,
        branchId: '1',
        actor: 'web',
        reference: 'PETTY-10',
        quantity: null,
        uom: null,
        net: '5.00',
        vat: '0.00',
        gross: '5.00',
        contribution: '5.00',
        included: false,
        reason: 'outside selected period',
        journalId: null,
        journalStatus: 'unposted',
        journalNote: 'No active posted journal was found for this document under the authorized workshop.',
        authorizedSourceHref: 'https://evil.example/steal',
      },
    ],
    nextCursor: 'cursor-2',
    fullResult: {
      rowCount: {
        key: 'money.petty.total.fullResult.rowCount',
        value: '1',
        kind: 'count',
        unit: 'count',
        status: 'ok',
        scope: 'period',
        source: 'dar.v6.petty',
        reason: 'UNIT-TEST-ONLY',
        proof: { metricKey: 'money.petty.total', href: '/workshop-staff/reports/daily-activity/v6/proof?metricKey=money.petty.total' },
      },
      reconciledValue: '12.00',
      difference: '0.00',
    },
  });
}

test('allowlist rejects schemes, hosts, and non-proof paths', () => {
  assert.equal(allowlistedProofApiHref('javascript:alert(1)'), '');
  assert.equal(allowlistedProofApiHref('https://evil.example/workshop-staff/reports/daily-activity/v6/proof'), '');
  assert.equal(allowlistedProofApiHref('//evil.example/x'), '');
  assert.equal(allowlistedProofApiHref('/admin/secrets'), '');
  assert.equal(allowlistedProofApiHref('/workshop-staff/reports/daily-activity/v6/proof/extra'), '');
  assert.equal(
    allowlistedProofApiHref('/workshop-staff/reports/daily-activity/v6/proof?metricKey=summary.net'),
    '/workshop-staff/reports/daily-activity/v6/proof?metricKey=summary.net',
  );
  assert.equal(allowlistedSourceHref('https://evil.example/doc'), '');
  assert.equal(allowlistedSourceHref('javascript:void(0)'), '');
  assert.equal(allowlistedSourceHref('/workshop/petty-cash/9'), '/workshop/petty-cash/9');
  const rejected = wrapProofHref({
    key: 'summary.net',
    proof: { metricKey: 'summary.net', href: 'javascript:alert(1)' },
  }, { snapshotToken: 'UNIT-TEST-ONLY-not-a-live-token', from: '2026-11-06', to: '2026-11-06' });
  assert.equal(rejected.startsWith(DAR_V6_PROOF_PATH), true);
  assert.equal(rejected.includes('javascript'), false);
  assert.equal(wrapOperandProofHref('https://evil.example/x'), '');
});

test('proof URL keeps scope + snapshotToken + asOf and pagination does not drop them', () => {
  const q = readProofSearch(
    'metricKey=money.petty.total&snapshotToken=UNIT-TEST-ONLY-not-a-live-token&asOf=2026-09-09T08:00:00.000Z&from=2026-11-06&to=2026-11-06&branchIds=1&sessionIds=101',
  );
  assert.equal(q.metricKey, 'money.petty.total');
  assert.equal(q.snapshotToken, 'UNIT-TEST-ONLY-not-a-live-token');
  assert.equal(q.asOf, '2026-09-09T08:00:00.000Z');
  assert.deepEqual(q.branchIds, ['1']);
  const next = nextProofSearch(
    'metricKey=money.petty.total&snapshotToken=UNIT-TEST-ONLY-not-a-live-token&asOf=2026-09-09T08:00:00.000Z&from=2026-11-06&to=2026-11-06',
    'cursor-2',
  );
  assert.equal(next.get('metricKey'), 'money.petty.total');
  assert.equal(next.get('snapshotToken'), 'UNIT-TEST-ONLY-not-a-live-token');
  assert.equal(next.get('asOf'), '2026-09-09T08:00:00.000Z');
  assert.equal(next.get('cursor'), 'cursor-2');
  assert.equal(next.get('from'), '2026-11-06');
  const back = reportHrefFromProofQuery(q, { hash: 'depts' });
  assert.equal(back.startsWith('/workshop/daily-activity?'), true);
  assert.equal(back.includes('snapshotToken'), false);
  assert.equal(back.includes('reopenProof'), false);
  assert.equal(back.includes('#depts'), true);
  const refresh = reportHrefFromProofQuery(q, {
    reopen: true,
    reopenMetricKey: q.metricKey,
    clickedValue: '12.00',
    hash: 'depts',
  });
  assert.equal(refresh.includes('reopenProof=money.petty.total'), true);
  assert.equal(refresh.includes('proofClicked=12.00'), true);
  const wrapped = wrapProofHref(
    {
      key: 'operations.customer_receipts.amount',
      proof: {
        metricKey: 'operations.customer_receipts.amount',
        href: '/workshop-staff/reports/daily-activity/v6/proof?metricKey=operations.customer_receipts.amount&snapshotToken=tok&asOf=2026-09-09T08:00:00.000Z&from=2026-09-09&to=2026-09-09&branchIds=5&actorSource=all',
      },
    },
    {},
  );
  assert.match(wrapped, /asOf=2026-09-09T08%3A00%3A00\.000Z|asOf=2026-09-09T08:00:00\.000Z/);
  assert.match(wrapped, /snapshotToken=tok/);
});

test('validate proof schema and classify 400/401/403/409', () => {
  assert.equal(validateProofPayload(unitProof()).ok, true);
  assert.equal(validateProofPayload({ schemaVersion: 'dar.v2' }).code, 'BACKEND_UPDATE_REQUIRED');
  assert.equal(validateProofPayload({ schemaVersion: 'dar.v6.proof' }).ok, false);
  assert.equal(classifyDarError({ status: 400, code: 'METRIC_UNKNOWN' }).kind, 'invalid');
  assert.equal(classifyDarError({ status: 401 }).kind, 'forbidden');
  assert.equal(classifyDarError({ status: 403 }).kind, 'forbidden');
  assert.equal(classifyDarError({ status: 409, code: 'REPORT_SNAPSHOT_CHANGED' }).kind, 'snapshot');
  assert.equal(classifyDarError({ status: 409, code: 'REPORT_SNAPSHOT_CHANGED' }).code, 'REPORT_SNAPSHOT_CHANGED');
});

test('null / zero / unknown stay exact and fullResult is not an FE row sum', () => {
  const net = unitProof();
  const rows = unitRowsProof();
  assert.equal(formatMetricValue(net.metric), DAR_V6_UNAVAILABLE);
  assert.equal(formatMetricValue(rows.metric), '12.00');
  const netFull = proofFullResultDisplay(net);
  assert.equal(netFull.reconciledValue, DAR_V6_UNAVAILABLE);
  assert.equal(netFull.rowCount, '0');
  const rowFull = proofFullResultDisplay(rows);
  assert.equal(rowFull.reconciledValue, '12.00');
  assert.equal(rowFull.rowCount, '1');
  assert.equal(rowFull.difference, '0.00');
  const pageGross = ['12.00', '5.00'];
  assert.notEqual(rowFull.reconciledValue, '17.00');
  assert.notEqual(pageGross.join('+'), rowFull.reconciledValue);
  assert.equal(rows.rows[0].journalId, null);
  assert.equal(rows.rows[0].journalStatus || 'unposted', 'unposted');
  assert.equal(allowlistedSourceHref(rows.rows[1].authorizedSourceHref), '');
});

test('user-facing EN/AR proof copy omits phase / personal / function sign-off notes', () => {
  const banned =
    /PHASE-20|Phase 03|phase 09|buildLineBucketSql|Yellow badge|Asif clears|Independent SQL signed for authorized Sep-6/i;
  for (const locale of ['en', 'ar']) {
    for (const key of [
      'proof.journal.posted',
      'proof.journal.unposted',
      'proof.journal.reversed',
      'proof.journal.ambiguous',
      'proof.journal.posted_after_asof',
      'proof.journal.not_queried',
      'proof.journal.unavailable',
      'cov.why.live_sql',
      'verification.partial',
      'proof.refreshHint',
    ]) {
      assert.equal(banned.test(darT(locale, key)), false, `${locale}:${key}`);
    }
  }
  assert.ok(darT('en', 'proof.journal.unposted').includes('Not posted'));
  assert.ok(darT('en', 'proof.journal.not_queried').toLowerCase().includes('not checked'));
});

test('screen Metric renderers are MetricLink anchors to the proof route', () => {
  const sections = readFileSync(join(here, 'DailyActivitySections.jsx'), 'utf8');
  const rest = readFileSync(join(here, 'DailyActivityRest.jsx'), 'utf8');
  const page = readFileSync(join(here, 'DailyActivityProofPage.jsx'), 'utf8');
  const combined = `${sections}\n${rest}`;
  const links = combined.match(/<MetricLink\b/g) || [];
  assert.ok(links.length >= 50, `expected ≥50 MetricLink, got ${links.length}`);
  assert.match(sections, /<Link[\s\S]*className="dar-v6-metric"/);
  const withoutVerify = combined.replace(
    /export function DailyActivityVerifyPanel[\s\S]*?(?=\nexport function )/,
    '',
  );
  assert.doesNotMatch(withoutVerify, /role="dialog"|<dialog\b/);
  assert.match(sections, /DailyActivityVerifyPanel/);
  assert.match(sections, /createPortal\(node, document.body\)/);
  assert.match(sections, /className="dar-v6-fold"/);
  assert.match(sections, /aria-expanded=\{expanded\}/);
  assert.match(sections, /foldable && expanded/);
  assert.doesNotMatch(sections, /showGrades && \(row\.grades \|\| \[\]\)\.map/);
  assert.match(sections, /dar-v6-verify-overlay[\s\S]*role="dialog"/);
  assert.doesNotMatch(page, /createPortal|role="dialog"|<dialog\b|drawer/i);
  const formatCalls = combined.match(/formatMetricValue\(/g) || [];
  assert.equal(formatCalls.length, 1);
  assert.match(page, /fetchDailyActivityV6Proof/);
  assert.match(page, /REPORT_SNAPSHOT_CHANGED|proof\.snapshotChanged|errorKind === 'snapshot'/);
  assert.match(page, /fullResult/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
});

test('collected report metrics wrap only to the allowlisted FE proof path', () => {
  const report = {
    kpis: { sales: { exVat: { key: 'kpis.sales.exVat', proof: { href: '/workshop-staff/reports/daily-activity/v6/proof?metricKey=kpis.sales.exVat' } } } },
    summary: { net: { key: 'summary.net', proof: { href: 'javascript:alert(1)', metricKey: 'summary.net' } } },
    departments: [],
    sessions: { totals: { cashOverShort: { key: 'sessions.totals.cashOverShort', proof: { href: '/workshop-staff/reports/daily-activity/v6/proof?metricKey=sessions.totals.cashOverShort' } } } },
    money: {},
    operations: [],
    technicians: {},
    coverage: [],
    reconciliation: [],
  };
  const all = [
    ...collectSummaryMetrics(report),
    ...collectDepartmentMetrics(report),
    ...collectRestMetrics(report),
  ];
  assert.ok(all.length >= 2);
  for (const m of all) {
    const href = wrapProofHref(m, { snapshotToken: 'tok', from: '2026-11-06', to: '2026-11-06' });
    assert.equal(href.startsWith(DAR_V6_PROOF_PATH), true);
    assert.equal(href.includes('javascript'), false);
    assert.equal(href.includes('http'), false);
  }
});

test('EN and AR proof copy differ while numbers stay identical', () => {
  const proof = unitRowsProof();
  const full = proofFullResultDisplay(proof);
  assert.notEqual(darT('en', 'proof.title'), darT('ar', 'proof.title'));
  assert.ok(darT('en', 'proof.snapshotChanged').includes('snapshot'));
  assert.ok(darT('ar', 'proof.journalMissing').includes('غير متاحة') || darT('ar', 'proof.journalMissing').includes('حالة'));
  assert.equal(full.reconciledValue, '12.00');
  assert.equal(formatMetricValue(proof.metric), formatMetricValue(proof.metric));
});

test('Back helper defaults to ordinary DAR navigation despite query.metricKey', () => {
  resetReopenIntentForTests();
  const q = readProofSearch(
    'metricKey=operations.customer_receipts.amount&snapshotToken=tok&asOf=2026-09-09T08:00:00.000Z&from=2026-09-09&to=2026-09-09&branchIds=5&sessionIds=101&actorSource=pos',
  );
  const back = reportHrefFromProofQuery(q, { hash: 'operations' });
  assert.equal(back.includes('reopenProof'), false);
  assert.equal(back.includes('proofClicked'), false);
  assert.equal(back.includes('metricKey'), false);
  assert.equal(back.includes('from=2026-09-09'), true);
  assert.equal(back.includes('to=2026-09-09'), true);
  assert.equal(back.includes('branchIds=5'), true);
  assert.equal(back.includes('sessionIds=101'), true);
  assert.equal(back.includes('actorSource=pos'), true);
  assert.equal(back.endsWith('#operations'), true);
  assert.equal(safeDarReturnHash('https://evil.example/#depts'), '');
  assert.equal(safeDarReturnHash('depts'), 'depts');
  const withExternalIgnored = reportHrefFromProofQuery(q, {
    hash: 'depts',
    returnTo: 'https://evil.example/phish',
  });
  assert.equal(withExternalIgnored.startsWith('/workshop/daily-activity'), true);
  assert.equal(withExternalIgnored.includes('evil'), false);
  assert.equal(withExternalIgnored.includes('reopenProof'), false);
});

test('explicit Refresh reopens once; Back after consume does not bounce', () => {
  resetReopenIntentForTests();
  const q = {
    from: '2026-09-09',
    to: '2026-09-09',
    branchIds: ['5'],
    sessionIds: [],
    actorSource: 'all',
    metricKey: 'kpi.sales.exVat',
  };
  const refresh = reportHrefFromProofQuery(q, {
    reopen: true,
    reopenMetricKey: 'kpi.sales.exVat',
    clickedValue: '9884.53',
    hash: 'depts',
  });
  assert.match(refresh, /reopenProof=kpi\.sales\.exVat/);
  assert.match(refresh, /proofClicked=9884\.53/);
  assert.match(refresh, /#depts$/);

  const params = new URLSearchParams(refresh.slice(refresh.indexOf('?') + 1).replace(/#.*$/, ''));
  assert.equal(captureReopenIntentFromSearch(params), true);
  assert.equal(captureReopenIntentFromSearch(params), true);
  const first = takeReopenIntent();
  assert.equal(first?.metricKey, 'kpi.sales.exVat');
  assert.equal(first?.clicked, '9884.53');
  const second = takeReopenIntent();
  assert.equal(second, null);

  const backAfter = reportHrefFromProofQuery(q, { hash: 'depts' });
  assert.equal(backAfter.includes('reopenProof'), false);
  assert.equal(captureReopenIntentFromSearch(new URLSearchParams(backAfter.split('?')[1] || '')), false);
  assert.equal(takeReopenIntent(), null);
});

test('ProofPage source separates Back/breadcrumb from Refresh reopen', () => {
  const src = readFileSync(join(here, 'DailyActivityProofPage.jsx'), 'utf8');
  assert.match(src, /backHref/);
  assert.match(src, /refreshHref/);
  assert.match(src, /reopen:\s*true/);
  assert.equal(/to=\{reportHref\}/.test(src), false);
  assert.match(src, /to=\{backHref\}/);
  assert.match(src, /to=\{refreshHref\}/);
  assert.match(src, /safeDarReturnHash\(query\.returnTab\)/);
  assert.equal(/const returnHash = 'depts'/.test(src), false);
  const page = readFileSync(join(here, 'DailyActivityPage.jsx'), 'utf8');
  assert.match(page, /takeReopenIntent/);
  assert.match(page, /captureReopenIntentFromSearch/);
  assert.equal(/reopenProofRef/.test(page), false);
});

test('proof href carries returnTab / sourceFingerprint / clickedValue for all five tabs', () => {
  for (const tab of ['accumulated', 'depts', 'sessions', 'finance', 'operations']) {
    const href = wrapProofHref(
      { key: 'kpi.sales.exVat', value: '10.00', proof: { metricKey: 'kpi.sales.exVat' } },
      {
        from: '2026-09-09',
        to: '2026-09-09',
        snapshotToken: 'tok',
        asOf: '2026-09-09T21:00:00.000Z',
        sourceFingerprint: 'fp1',
        returnTab: tab,
      },
    );
    assert.match(href, new RegExp(`returnTab=${tab}`));
    assert.match(href, /sourceFingerprint=fp1/);
    assert.match(href, /clickedValue=10\.00/);
    const q = readProofSearch(href.slice(href.indexOf('?') + 1));
    assert.equal(q.returnTab, tab);
    const back = reportHrefFromProofQuery(q, { hash: q.returnTab });
    assert.equal(back.endsWith(`#${tab}`), true);
  }
});

test('write UNIT-TEST-ONLY EN/AR proof HTML artifacts', () => {
  const net = unitProof();
  const rows = unitRowsProof();
  const outDir = process.env.DAR_FE_ARTIFACT_DIR
    || join(here, '..', '..', '..', '..', '..', '_AUTO-REPORTS', 'RF-DAR-V6-FE', 'artifacts');
  mkdirSync(outDir, { recursive: true });
  const html = (locale) => `<!DOCTYPE html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><title>UNIT-TEST-ONLY proof ${locale}</title>
<style>body{font:13px Poppins,Arial,sans-serif;background:#F5F5F7;padding:20px}.banner{background:#fff1c9;padding:10px;font-weight:700}a{color:inherit}</style></head><body>
<p class="banner">UNIT-TEST-ONLY · not live money · not K-10 EXAMPLE · full-screen routed proof</p>
<h1>${darT(locale, 'proof.title')}</h1>
<p>${darT(locale, 'proof.noFeSum')}</p>
<p>${darT(locale, 'proof.metric')} <a href="${wrapProofHref(net.metric)}">${net.metric.key}</a> = ${formatMetricValue(net.metric)}</p>
<p>${darT(locale, 'proof.fullResult')} ${proofFullResultDisplay(net).reconciledValue} · ${darT(locale, 'proof.rowCount')} ${proofFullResultDisplay(net).rowCount}</p>
<p>${darT(locale, 'proof.derivation')} <code>${net.derivation.expression}</code></p>
<p>${darT(locale, 'proof.snapshotChanged')}</p>
<p>${darT(locale, 'money.petty')} ${formatMetricValue(rows.metric)} ${darT(locale, 'proof.reconciled')} ${proofFullResultDisplay(rows).reconciledValue} ${darT(locale, 'proof.journalMissing')}</p>
<p>${darT(locale, 'proof.included')} 12.00 · ${darT(locale, 'proof.excluded')} 5.00 · ${darT(locale, 'proof.noFeSum')}</p>
</body></html>`;
  writeFileSync(join(outDir, 'phase-15-proof-en.html'), html('en'), 'utf8');
  writeFileSync(join(outDir, 'phase-15-proof-ar.html'), html('ar'), 'utf8');
  assert.equal(html('en').includes('—'), true);
  assert.equal(html('en').includes('12.00'), true);
  assert.equal(html('ar').includes('12.00'), true);
  assert.equal(/modal|drawer|dialog/i.test(html('en')), false);
  for (const banned of FORBIDDEN) {
    assert.equal(html('en').includes(banned), false, banned);
    assert.equal(html('ar').includes(banned), false, banned);
  }
});
