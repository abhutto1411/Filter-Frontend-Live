import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatMetricValue, wrapProofHref } from './dailyActivityFormat.js';
import { darT } from './dailyActivityI18n.js';
import {
  DAR_V6_DEDUCTION_ORDER,
  buildKpiCards,
  buildSummaryView,
  collectSummaryMetrics,
  metricDisplaysMatchApi,
  orderDeductions,
} from './dailyActivitySummary.js';

const FORBIDDEN_WIREFRAME = ['26170', '26,170', '30095.50', '30,095.50', '13429.29', '13,429.29'];

function metric(key, value, extras = {}) {
  const unavailable = value == null;
  return {
    key,
    value,
    kind: extras.kind || 'money',
    unit: extras.unit || (extras.kind === 'count' ? 'count' : 'SAR'),
    status: extras.status || (unavailable ? 'unavailable' : 'partial'),
    scope: extras.scope || 'period',
    source: extras.source || 'dar.v6.unit-test-only',
    reason: extras.reason ?? (unavailable ? 'UNIT-TEST-ONLY · unavailable operand' : null),
    proof: {
      metricKey: key,
      href: `/workshop-staff/reports/daily-activity/v6/proof?metricKey=${encodeURIComponent(key)}&snapshotToken=unit-test-only`,
    },
  };
}

/** UNIT-TEST-ONLY. Not live money. Not the 14 Sep / K-10 EXAMPLE figures. */
function unitTestOnlyReport() {
  return {
    schemaVersion: 'dar.v6',
    meta: {
      verificationStatus: 'partial',
      snapshotToken: 'unit-test-only',
      from: '2026-11-06',
      to: '2026-11-06',
      timeZone: 'Asia/Riyadh',
    },
    filters: { actorSourceAvailable: false, sessions: [] },
    kpis: {
      sales: {
        exVat: metric('kpi.sales.exVat', '100.00', { scope: 'session_windows' }),
        vat: metric('kpi.sales.vat', '15.00', { scope: 'session_windows' }),
        inclVat: metric('kpi.sales.inclVat', '115.00', { scope: 'session_windows' }),
      },
      jobsCompleted: metric('kpi.jobsCompleted', '2', { kind: 'count', unit: 'count' }),
      discounts: metric('kpi.discounts', null, {
        scope: 'session_windows',
        reason: 'Discount inputs not supplied. — is not zero.',
      }),
      cashOverShort: metric('kpi.cashOverShort', '0.00', { scope: 'full_shift' }),
      petty: metric('kpi.petty', '10.00'),
      purchases: metric('kpi.purchases', '20.00'),
    },
    summary: {
      byDepartment: [
        {
          id: 'dept-a',
          labelEn: 'Unit Test Dept A',
          labelAr: 'قسم اختبار أ',
          sales: {
            exVat: metric('summary.byDepartment.dept-a.sales.exVat', '100.00', {
              scope: 'session_windows',
            }),
            vat: metric('summary.byDepartment.dept-a.sales.vat', '15.00', {
              scope: 'session_windows',
            }),
            inclVat: metric('summary.byDepartment.dept-a.sales.inclVat', '115.00', {
              scope: 'session_windows',
            }),
          },
        },
      ],
      salesTotal: {
        exVat: metric('summary.salesTotal.exVat', '100.00', { scope: 'session_windows' }),
        vat: metric('summary.salesTotal.vat', '15.00', { scope: 'session_windows' }),
        inclVat: metric('summary.salesTotal.inclVat', '115.00', { scope: 'session_windows' }),
      },
      deductions: [
        {
          code: 'advances',
          labelEn: 'Salary advances · external outflow',
          labelAr: 'سلف الرواتب',
          amount: metric('summary.deductions.advances.amount', '5.00'),
          entries: metric('summary.deductions.advances.entries', '1', { kind: 'count' }),
        },
        {
          code: 'petty',
          labelEn: 'Petty cash expenses',
          labelAr: 'مصروفات النثرية',
          amount: metric('summary.deductions.petty.amount', '10.00'),
          entries: metric('summary.deductions.petty.entries', '1', { kind: 'count' }),
        },
        {
          code: 'purchase_invoices',
          labelEn: 'Purchase invoices · affiliated + local',
          labelAr: 'فواتير المشتريات',
          amount: metric('summary.deductions.purchase_invoices.amount', '20.00'),
          entries: metric('summary.deductions.purchase_invoices.entries', '1', { kind: 'count' }),
        },
        {
          code: 'commissions_due',
          labelEn: 'Commissions Due · selected period payable',
          labelAr: 'العمولات المستحقة للفترة المحددة',
          amount: metric('summary.deductions.commissions_due.amount', null, {
            reason: 'No due_date. Selected DAR range payable stays unavailable.',
          }),
          entries: metric('summary.deductions.commissions_due.entries', null, {
            kind: 'count',
            reason: 'No due_date.',
          }),
        },
      ],
      knownDeductions: metric('summary.knownDeductions', '35.00', {
        reason: 'Known-deduction subtotal from API. Incomplete.',
      }),
      remainderBeforeUnknowns: metric('summary.remainderBeforeUnknowns', '80.00', {
        reason: 'Not Net. Remainder before unknowns from API.',
      }),
      net: metric('summary.net', null, {
        reason: 'Net is null while Commissions Due is unavailable.',
      }),
      exclusions: [
        {
          code: 'fund_replenishment',
          labelEn: 'Fund replenishment · internal transfer',
          labelAr: 'تعزيز الصندوق · تحويل داخلي',
          amount: metric('summary.exclusions.fund_replenishment.amount', '5.00'),
          entries: metric('summary.exclusions.fund_replenishment.entries', '1', {
            kind: 'count',
          }),
        },
      ],
      completeness: {
        complete: false,
        reasons: ['UNIT-TEST-ONLY · Commissions Due unavailable → Net null.'],
      },
    },
    departments: [],
    sessions: {},
    money: {},
    operations: [],
    technicians: {},
    coverage: [
      {
        code: 'commissions_payable',
        labelEn: 'Commissions Due',
        labelAr: 'العمولات المستحقة',
        status: 'unavailable',
        reason: 'No due_date.',
        amount: metric('coverage.commissions_payable.amount', null),
        entries: metric('coverage.commissions_payable.entries', null, { kind: 'count' }),
      },
    ],
    reconciliation: [],
  };
}

function emptyDayReport() {
  const r = unitTestOnlyReport();
  r.kpis.sales = {
    exVat: metric('kpi.sales.exVat', '0.00', { scope: 'session_windows' }),
    vat: metric('kpi.sales.vat', '0.00', { scope: 'session_windows' }),
    inclVat: metric('kpi.sales.inclVat', '0.00', { scope: 'session_windows' }),
  };
  r.summary.byDepartment = [];
  r.summary.salesTotal = {
    exVat: metric('summary.salesTotal.exVat', '0.00', { scope: 'session_windows' }),
    vat: metric('summary.salesTotal.vat', '0.00', { scope: 'session_windows' }),
    inclVat: metric('summary.salesTotal.inclVat', '0.00', { scope: 'session_windows' }),
  };
  r.summary.deductions = [
    {
      code: 'commissions_due',
      labelEn: 'Commissions Due · selected period payable',
      labelAr: 'العمولات المستحقة للفترة المحددة',
      amount: metric('summary.deductions.commissions_due.amount', null),
      entries: metric('summary.deductions.commissions_due.entries', null, { kind: 'count' }),
    },
  ];
  r.summary.knownDeductions = metric('summary.knownDeductions', null);
  r.summary.remainderBeforeUnknowns = metric('summary.remainderBeforeUnknowns', null, {
    reason: 'Not Net.',
  });
  r.summary.net = metric('summary.net', null, {
    reason: 'Net is null while Commissions Due is unavailable.',
  });
  return r;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderParityHtml(report, locale) {
  const cards = buildKpiCards(report, locale);
  const view = buildSummaryView(report, locale);
  const t = (k) => darT(locale, k);
  const link = (m) => {
    const shown = formatMetricValue(m);
    const href = wrapProofHref(m, { snapshotToken: report.meta?.snapshotToken });
    return `<a class="num" href="${escapeHtml(href)}">${escapeHtml(shown)}</a>`;
  };
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"/>
<title>UNIT-TEST-ONLY · DAR v6 KPI/summary ${locale}</title>
<style>
body{font:13px/1.5 Arial,sans-serif;background:#eef3f5;color:#243c4c;margin:0;padding:20px}
.banner{background:#fff1c9;border:1px solid #eddbab;padding:10px 12px;margin-bottom:14px;font-weight:700}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
.kpi{background:#fff;border:1px solid #dce5ea;border-radius:8px;padding:12px}
.kpi.accent{border-top:3px solid #087f83}
.kpi label{display:block;font-size:10px;color:#6b7d8b;font-weight:700}
.kpi strong{display:block;font-size:22px}
table{width:100%;border-collapse:collapse;background:#fff;margin:12px 0}
th,td{padding:8px;border-bottom:1px solid #e9eff2;text-align:end}
th:first-child,td:first-child{text-align:start}
.vatsummary,.summarybottom{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.vatsummary>div,.summarybottom>div{background:#eef6f6;padding:11px}
.summarybottom .net{background:#123248;color:#fff}
.n{direction:ltr;unicode-bidi:isolate}
</style></head><body>
<p class="banner">UNIT-TEST-ONLY · presentation fixture · not live money · not K-10 EXAMPLE</p>
<div class="kpis">${cards
    .map(
      (c) =>
        `<article class="kpi${c.id === 'salesEx' ? ' accent' : ''}"><label>${escapeHtml(
          c.label,
        )}</label><strong class="n" title="${escapeHtml(c.hint || '')}">${link(
          c.metric,
        )}</strong></article>`,
    )
    .join('')}</div>
<section class="accumulated">
<h2 title="${escapeHtml(t('summary.caption'))}">${escapeHtml(t('summary.title'))}</h2>
<table><thead><tr><th>${escapeHtml(t('summary.dept'))}</th><th>${escapeHtml(
    t('summary.ex'),
  )}</th><th>${escapeHtml(t('summary.inc'))}</th></tr></thead><tbody>
${
  view.departments.length
    ? view.departments
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.label)}</td><td class="n">${link(row.exVat)}</td><td class="n">${link(
              row.inclVat,
            )}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="3">${escapeHtml(t('summary.emptyDepts'))}</td></tr>`
}
<tr class="total"><td>${escapeHtml(t('summary.total'))}</td><td class="n">${link(
    view.salesTotal.exVat,
  )}</td><td class="n">${link(view.salesTotal.inclVat)}</td></tr>
</tbody></table>
<div class="vatsummary">
<div>${escapeHtml(t('summary.ex'))}<b class="n">${link(view.salesTotal.exVat)}</b></div>
<div>${escapeHtml(t('summary.vatCard'))}<b class="n">${link(view.salesTotal.vat)}</b></div>
<div>${escapeHtml(t('summary.inclStart'))}<b class="n">${link(view.salesTotal.inclVat)}</b></div>
</div>
<table><thead><tr><th>${escapeHtml(t('summary.deductions'))}</th><th>${escapeHtml(
    t('summary.amount'),
  )}</th><th>${escapeHtml(t('summary.entries'))}</th></tr></thead><tbody>
${view.deductions
  .map(
    (d) =>
      `<tr><td title="${escapeHtml(d.payableNote || d.amount?.reason || '')}">${escapeHtml(
        d.label,
      )}</td><td class="n">${link(d.amount)}</td><td class="n">${link(d.entries)}</td></tr>`,
  )
  .join('')}
</tbody></table>
<div class="summarybottom">
<div><label title="${escapeHtml(t('summary.formula'))}">${escapeHtml(t('summary.known'))}</label><b class="n">${link(view.knownDeductions)}</b></div>
<div><label title="${escapeHtml(t('summary.remainderNotNet'))}">${escapeHtml(t('summary.remainder'))}</label><b class="n">${link(
    view.remainderBeforeUnknowns,
  )}</b></div>
<div class="net"><label title="${escapeHtml(t('summary.formula'))}">${escapeHtml(t('summary.net'))}</label><b class="n">${link(view.net)}</b></div>
</div>
</section>
</body></html>`;
}

test('UNIT-TEST-ONLY fixture never uses K-10 / 14 Sep EXAMPLE money', () => {
  const blob = JSON.stringify(unitTestOnlyReport());
  for (const banned of FORBIDDEN_WIREFRAME) {
    assert.equal(blob.includes(banned), false, banned);
  }
});

test('deduction order follows contract; missing codes are not invented', () => {
  const report = unitTestOnlyReport();
  const ordered = orderDeductions(report.summary.deductions).map((d) => d.code);
  assert.deepEqual(ordered, ['purchase_invoices', 'petty', 'commissions_due', 'advances']);
  const view = buildSummaryView(report, 'en');
  assert.deepEqual(
    view.deductions.map((d) => d.code),
    ordered,
  );
  const present = new Set(ordered);
  for (const code of DAR_V6_DEDUCTION_ORDER) {
    if (!present.has(code)) {
      assert.equal(
        view.deductions.some((d) => d.code === code),
        false,
      );
    }
  }
});

test('null Net stays — and is not the remainder', () => {
  const report = unitTestOnlyReport();
  const view = buildSummaryView(report, 'en');
  assert.equal(formatMetricValue(view.net), '—');
  assert.equal(view.netIsUnavailable, true);
  assert.equal(formatMetricValue(view.remainderBeforeUnknowns), '80.00');
  assert.equal(formatMetricValue(view.knownDeductions), '35.00');
  assert.notEqual(formatMetricValue(view.net), formatMetricValue(view.remainderBeforeUnknowns));
  assert.match(view.deductions.find((d) => d.code === 'commissions_due').payableNote, /payable/i);
});

test('authorized 0.00 stays 0.00; empty departments are not invented', () => {
  const report = emptyDayReport();
  const cards = buildKpiCards(report, 'en');
  assert.equal(cards[0].display, '0.00');
  const view = buildSummaryView(report, 'en');
  assert.deepEqual(view.departments, []);
  assert.equal(formatMetricValue(view.salesTotal.exVat), '0.00');
  assert.equal(formatMetricValue(view.net), '—');
  assert.equal(formatMetricValue(view.remainderBeforeUnknowns), '—');
});

test('KPI + summary displays equal API strings; every metric has proof', () => {
  const report = unitTestOnlyReport();
  const mismatches = metricDisplaysMatchApi(report);
  assert.deepEqual(mismatches, []);
  const metrics = collectSummaryMetrics(report);
  assert.ok(metrics.length >= 20);
  for (const m of metrics) {
    assert.ok(m.key);
    assert.ok(m.proof?.href);
    assert.ok(wrapProofHref(m).includes('/workshop/daily-activity/proof'));
  }
  const cards = buildKpiCards(report, 'en');
  assert.equal(cards[0].display, '100.00');
  assert.equal(cards[1].display, '2');
  assert.equal(cards[2].display, '—');
  assert.equal(cards[3].display, '0.00');
  assert.equal(cards[4].display, '10.00');
  assert.equal(cards[5].display, '20.00');
});

test('EN and AR render the same API numbers with localized labels', () => {
  const report = unitTestOnlyReport();
  const enCards = buildKpiCards(report, 'en');
  const arCards = buildKpiCards(report, 'ar');
  assert.deepEqual(
    enCards.map((c) => c.display),
    arCards.map((c) => c.display),
  );
  assert.notEqual(enCards[0].label, arCards[0].label);
  const en = buildSummaryView(report, 'en');
  const ar = buildSummaryView(report, 'ar');
  assert.equal(formatMetricValue(en.salesTotal.inclVat), formatMetricValue(ar.salesTotal.inclVat));
  assert.equal(formatMetricValue(en.net), '—');
  assert.equal(formatMetricValue(ar.net), '—');
  assert.notEqual(en.departments[0].label, ar.departments[0].label);
  assert.notEqual(en.formula, ar.formula);
  assert.match(en.residual, /not accounting profit/i);
  assert.ok(ar.residual.includes('ربح'));
});

test('write UNIT-TEST-ONLY EN/AR HTML artifacts for screenshot parity', () => {
  const report = unitTestOnlyReport();
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = process.env.DAR_FE_ARTIFACT_DIR || join(
    here,
    '..',
    '..',
    '..',
    '..',
    '..',
    '_AUTO-REPORTS',
    'RF-DAR-V6-FE',
    'artifacts',
  );
  mkdirSync(outDir, { recursive: true });
  const en = renderParityHtml(report, 'en');
  const ar = renderParityHtml(report, 'ar');
  writeFileSync(join(outDir, 'phase-12-kpi-summary-en.html'), en, 'utf8');
  writeFileSync(join(outDir, 'phase-12-kpi-summary-ar.html'), ar, 'utf8');
  assert.equal(en.includes('100.00'), true);
  assert.equal(ar.includes('100.00'), true);
  assert.equal(en.includes('—'), true);
  assert.equal(ar.includes('—'), true);
  assert.equal(en.includes('UNIT-TEST-ONLY'), true);
  assert.equal(ar.includes('dir="rtl"'), true);
  for (const banned of FORBIDDEN_WIREFRAME) {
    assert.equal(en.includes(banned), false, banned);
    assert.equal(ar.includes(banned), false, banned);
  }
});
