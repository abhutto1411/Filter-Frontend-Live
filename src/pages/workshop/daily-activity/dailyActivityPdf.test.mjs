import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatMetricValue } from './dailyActivityFormat.js';
import { darT } from './dailyActivityI18n.js';
import {
  DAR_V6_PDF_ORIGIN_TEST,
  buildDailyActivityPdfHtml,
  buildDailyActivityPdfModel,
  canRenderDailyActivityPdf,
  chunkSessionRows,
  collectAllPdfMetrics,
  ownerPdfPageCount,
  pdfDisabledReason,
  proofLinksAreSafe,
  writeDailyActivityPdfDoc,
} from './dailyActivityPdf.js';
import { osTagKind } from './dailyActivityRest.js';

const FORBIDDEN = ['26170', '26,170', '30095.50', '30,095.50', '13429.29', '13,429.29', '-60.00'];
const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.DAR_FE_ARTIFACT_DIR
  || join(here, '..', '..', '..', '..', '..', '_AUTO-REPORTS', 'RF-DAR-V6-FE', 'artifacts');

function metric(key, value, extras = {}) {
  const unavailable = value == null;
  return {
    key,
    value,
    kind: extras.kind || 'money',
    unit: extras.unit || (extras.kind === 'count' ? 'count' : extras.kind === 'quantity' ? extras.unit || 'L' : 'SAR'),
    status: extras.status || (unavailable ? 'unavailable' : 'partial'),
    scope: extras.scope || 'period',
    source: extras.source || 'dar.v6.unit-test-only',
    reason: extras.reason ?? (unavailable ? 'UNIT-TEST-ONLY · unavailable' : null),
    proof: {
      metricKey: key,
      href: `/workshop-staff/reports/daily-activity/v6/proof?metricKey=${encodeURIComponent(key)}&snapshotToken=unit-test-only`,
    },
  };
}

function unitPdfReport() {
  return {
    schemaVersion: 'dar.v6',
    meta: {
      verificationStatus: 'partial',
      snapshotToken: 'unit-test-only',
      from: '2026-11-06',
      to: '2026-11-06',
      timeZone: 'Asia/Riyadh',
      generatedAt: '2026-11-06T08:00:00.000Z',
      asOf: '2026-11-06T08:00:00.000Z',
      selectedBranchIds: ['10'],
      selectedSessionIds: ['101', '102'],
      effectiveWindows: [
        { branchId: '10', start: '2026-11-06T05:00:00.000Z', endExclusive: '2026-11-06T15:00:00.000Z' },
      ],
    },
    filters: { actorSource: 'all', actorSourceAvailable: false, sessions: [] },
    kpis: {
      sales: {
        exVat: metric('kpi.sales.exVat', '100.00', { scope: 'session_windows' }),
        vat: metric('kpi.sales.vat', '15.00', { scope: 'session_windows' }),
        inclVat: metric('kpi.sales.inclVat', '115.00', { scope: 'session_windows' }),
      },
      jobsCompleted: metric('kpi.jobsCompleted', '2', { kind: 'count' }),
      discounts: metric('kpi.discounts', null),
      cashOverShort: metric('kpi.cashOverShort', '0.00', { scope: 'full_shift' }),
      petty: metric('kpi.petty', '12.00'),
      purchases: metric('kpi.purchases', '46.00'),
    },
    summary: {
      byDepartment: [
        {
          id: 'dept-a',
          labelEn: 'Unit Test Dept A',
          labelAr: 'قسم اختبار أ',
          sales: {
            exVat: metric('summary.byDepartment.dept-a.sales.exVat', '100.00'),
            vat: metric('summary.byDepartment.dept-a.sales.vat', '15.00'),
            inclVat: metric('summary.byDepartment.dept-a.sales.inclVat', '115.00'),
          },
        },
      ],
      salesTotal: {
        exVat: metric('summary.salesTotal.exVat', '100.00'),
        vat: metric('summary.salesTotal.vat', '15.00'),
        inclVat: metric('summary.salesTotal.inclVat', '115.00'),
      },
      deductions: [
        {
          code: 'purchase_invoices',
          labelEn: 'Purchase invoices',
          labelAr: 'فواتير المشتريات',
          amount: metric('summary.deductions.purchase_invoices.amount', '20.00'),
          entries: metric('summary.deductions.purchase_invoices.entries', '1', { kind: 'count' }),
        },
        {
          code: 'commissions_due',
          labelEn: 'Commissions Due',
          labelAr: 'العمولات المستحقة',
          amount: metric('summary.deductions.commissions_due.amount', null),
          entries: metric('summary.deductions.commissions_due.entries', null, { kind: 'count' }),
        },
      ],
      knownDeductions: metric('summary.knownDeductions', '20.00'),
      remainderBeforeUnknowns: metric('summary.remainderBeforeUnknowns', '80.00'),
      net: metric('summary.net', null, { reason: 'Net is null while Commissions Due is unavailable.' }),
      exclusions: [],
      completeness: { complete: false, reasons: ['Commissions Due unavailable'] },
    },
    departments: [
      {
        id: 'dept-a',
        labelEn: 'Unit Test Dept A',
        labelAr: 'قسم اختبار أ',
        totals: {
          jobsCompleted: metric('departments.dept-a.jobsCompleted', '2', { kind: 'count' }),
          measures: {
            revenue: { exVat: metric('departments.dept-a.revenue.exVat', '100.00') },
            cost: metric('departments.dept-a.cost', null),
            marginAmount: metric('departments.dept-a.margin', null),
            qtyByUom: [metric('departments.dept-a.qty.L', '4.000', { kind: 'quantity', unit: 'L' })],
          },
        },
        products: {
          buckets: [],
          top5: [
            {
              id: 'p1',
              labelEn: 'Unit oil',
              labelAr: 'زيت اختبار',
              measures: { revenue: { exVat: metric('departments.dept-a.top5.p1.exVat', '40.00') } },
            },
          ],
        },
        services: { groups: [] },
      },
    ],
    sessions: {
      totals: {
        cashOverShort: metric('sessions.totals.cashOverShort', '-8.00', { scope: 'full_shift' }),
        allMethodsOverShort: metric('sessions.totals.allMethodsOverShort', '3.00', { scope: 'full_shift' }),
      },
      rows: [
        {
          id: '101',
          cashierName: 'Unit Cashier A',
          branchId: '10',
          status: 'closed',
          openedAt: '2026-09-08T14:11:29.525Z',
          closedAt: '2026-09-09T00:05:21.842Z',
          closingBasis: 'full_shift',
          expected: metric('sessions.rows.101.expected', '50.00'),
          counted: metric('sessions.rows.101.counted', '42.00'),
          overShort: metric('sessions.rows.101.overShort', '-8.00'),
        },
        {
          id: '102',
          cashierName: 'Unit Cashier B',
          branchId: '10',
          status: 'open',
          closedAt: null,
          closingBasis: 'full_shift',
          expected: metric('sessions.rows.102.expected', null),
          counted: metric('sessions.rows.102.counted', null),
          overShort: metric('sessions.rows.102.overShort', null),
        },
      ],
    },
    money: {
      petty: { total: metric('money.petty.total', '12.00'), byPurpose: [] },
      nonCash: { gross: metric('money.nonCash.gross', null) },
      advances: { amount: metric('money.advances.amount', '5.00') },
      replenishment: { amount: metric('money.replenishment.amount', '5.00') },
      purchases: [
        {
          relationship: 'affiliated',
          entries: metric('money.purchases.0.entries', '1', { kind: 'count' }),
          net: metric('money.purchases.0.net', '40.00'),
          vat: metric('money.purchases.0.vat', '6.00'),
          gross: metric('money.purchases.0.gross', '46.00'),
          paid: metric('money.purchases.0.paid', '10.00'),
          balance: metric('money.purchases.0.balance', '36.00'),
        },
      ],
    },
    operations: [
      {
        code: 'stock_adjust',
        labelEn: 'Stock adjust',
        labelAr: 'تسوية مخزون',
        amount: metric('operations.0.amount', null),
        entries: metric('operations.0.entries', '1', { kind: 'count' }),
        qtyByUom: [metric('operations.0.qty.L', '-2.000', { kind: 'quantity', unit: 'L' })],
        treatment: 'qty_only',
      },
    ],
    technicians: {
      attributionBasis: 'completed_at',
      rows: [
        {
          name: 'Unit Tech',
          jobsCompleted: metric('technicians.0.jobs', '2', { kind: 'count' }),
          attributedRevenue: metric('technicians.0.rev', '15.00'),
          commissionAttributed: metric('technicians.0.comm', null),
        },
      ],
      totals: {},
    },
    coverage: [
      {
        code: 'commissions_payable',
        labelEn: 'Commissions Due',
        labelAr: 'العمولات المستحقة',
        status: 'unavailable',
        amount: metric('coverage.commissions_payable.amount', null),
        entries: metric('coverage.commissions_payable.entries', null, { kind: 'count' }),
      },
    ],
    reconciliation: [],
  };
}

function visibleHtml(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/href="[^"]*"/g, 'href=""')
    .replace(/title="[^"]*"/g, 'title=""');
}

function pdfArticles(html) {
  return String(html).match(/<article class="a4 dar-pdf-page"[\s\S]*?<\/article>/g) || [];
}

test('PDF export stays disabled without a captured snapshot', () => {
  assert.equal(canRenderDailyActivityPdf({ report: null }), false);
  assert.equal(canRenderDailyActivityPdf({ report: unitPdfReport(), stale: true }), false);
  assert.equal(canRenderDailyActivityPdf({ report: unitPdfReport(), errorKind: 'snapshot' }), false);
  assert.equal(canRenderDailyActivityPdf({ report: unitPdfReport(), loading: true }), false);
  assert.equal(
    canRenderDailyActivityPdf({
      report: { schemaVersion: 'dar.v6', meta: { from: '2026-11-06', to: '2026-11-06' } },
    }),
    false,
  );
  assert.equal(canRenderDailyActivityPdf({ report: unitPdfReport() }), true);
  assert.ok(pdfDisabledReason({ stale: true, locale: 'en' }).includes('stale'));
});

test('ready copy no longer mentions a later PDF phase', () => {
  assert.equal(darT('en', 'status.ready').toLowerCase().includes('later phase'), false);
  assert.equal(darT('ar', 'status.ready').toLowerCase().includes('later phase'), false);
  assert.equal(darT('en', 'verification.partial').includes('Independent SQL was not run'), false);
  assert.equal(darT('en', 'pdf.caution').includes('Independent SQL has not signed'), false);
  assert.equal(darT('en', 'status.ready').includes('PDF is a later'), false);
  assert.match(darT('en', 'status.ready'), /proof/i);
  assert.ok(darT('en', 'status.ready'));
  assert.ok(darT('ar', 'status.ready'));
  assert.notEqual(darT('en', 'status.ready'), darT('ar', 'status.ready'));
});

test('EN and AR PDF models keep the same API numbers and safe proof links', () => {
  const report = unitPdfReport();
  const en = buildDailyActivityPdfModel(report, 'en', DAR_V6_PDF_ORIGIN_TEST);
  const ar = buildDailyActivityPdfModel(report, 'ar', DAR_V6_PDF_ORIGIN_TEST);
  assert.equal(en.dir, 'ltr');
  assert.equal(ar.dir, 'rtl');
  assert.equal(formatMetricValue(en.summary.net), '—');
  assert.equal(formatMetricValue(ar.summary.net), '—');
  assert.equal(formatMetricValue(en.kpis.find((c) => c.id === 'cashOs').metric), '0.00');
  assert.equal(formatMetricValue(en.sessions.totals.cashOverShort), '-8.00');
  assert.notEqual(formatMetricValue(en.sessions.totals.cashOverShort), '8.00');
  assert.equal(en.preliminary, true);
  assert.equal(ar.preliminary, true);
  assert.ok(proofLinksAreSafe(en.metrics));
  assert.ok(proofLinksAreSafe(ar.metrics));
  assert.ok(en.metrics.some((l) => l.key === 'summary.net' && l.display === '—' && l.href.includes('metricKey=summary.net')));
  assert.ok(en.metrics.every((l) => l.href.startsWith(DAR_V6_PDF_ORIGIN_TEST)));
  assert.ok(en.metrics.every((l) => !/authorization|bearer |access_token/i.test(l.href)));
  assert.equal(en.metrics.length, ar.metrics.length);
  assert.deepEqual(
    en.metrics.map((l) => l.display),
    ar.metrics.map((l) => l.display),
  );
  assert.notEqual(darT('en', 'pdf.preliminary'), darT('ar', 'pdf.preliminary'));
});

test('owner HTML is FILTER branded A4 pages with sessions on page 2 and no proof dump', () => {
  const report = unitPdfReport();
  const { html: enHtml, model: en } = buildDailyActivityPdfHtml(report, 'en', DAR_V6_PDF_ORIGIN_TEST);
  const { html: arHtml } = buildDailyActivityPdfHtml(report, 'ar', DAR_V6_PDF_ORIGIN_TEST);
  assert.equal(ownerPdfPageCount(enHtml), 5);
  assert.equal(ownerPdfPageCount(arHtml), 5);
  const enPages = pdfArticles(enHtml);
  const arPages = pdfArticles(arHtml);
  assert.equal(enPages.length, 5);
  assert.match(enPages[0], /data-block="summary"/);
  assert.match(enPages[0], /Accumulated Summary/);
  assert.match(enPages[0], /Financial verify: not checked/);
  assert.match(enPages[1], /data-block="sessions"/);
  assert.match(enPages[1], /Cashier sessions &amp; closing/);
  assert.match(enPages[1], /08 Sept? 2026 17:11/);
  assert.match(enPages[1], /09 Sept? 2026 03:05/);
  assert.equal(enPages[1].includes('01 / Sales'), false);
  assert.equal(enPages[1].includes('Unit Test Dept A'), false);
  assert.match(arPages[0], /التحقق المالي: لم يُفحص/);
  assert.match(arPages[1], /جلسات الصندوق/);
  assert.equal(arPages[1].includes('01 /'), false);
  assert.match(enPages[2], /data-block="departments"/);
  assert.match(enPages[3], /data-block="finance"/);
  assert.match(enPages[4], /data-block="operations"/);
  assert.match(enHtml, /class="a4 dar-pdf-page"/);
  assert.match(enHtml, /class="pdflogo">FILTER/);
  assert.match(arHtml, /dir="rtl"/);
  assert.match(arHtml, /Noto Sans Arabic/);
  assert.match(enHtml, /href="https:\/\/app\.local\/workshop\/daily-activity\/proof/);
  assert.match(enHtml, />—</);
  assert.match(enHtml, /-8\.00/);
  assert.match(enHtml, /0\.00/);
  assert.match(arHtml, /-8\.00/);
  assert.equal(enHtml.includes('V6 · NOT FINANCIALLY VERIFIED'), false);
  assert.equal(arHtml.includes('غير مُتحقق ماليًا'), false);
  assert.equal(enHtml.includes('javascript:'), false);
  const visible = visibleHtml(enHtml);
  assert.equal(visible.includes('snapshotToken'), false);
  assert.equal(visible.includes('proof-index'), false);
  assert.equal(visible.includes('Proof links'), false);
  assert.equal(visible.includes('kpi.sales.exVat ='), false);
  assert.equal(visible.includes('summary.net ='), false);
  assert.equal(visible.includes('2026-11-06T05:00:00.000Z'), false);
  assert.ok(collectAllPdfMetrics(report).length >= 10);
  assert.equal(en.depts[0].products.top5[0].id, 'p1');
  for (const banned of FORBIDDEN) {
    assert.equal(enHtml.includes(banned), false, banned);
    assert.equal(arHtml.includes(banned), false, banned);
  }
});

test('PDF and screen owners do not dump reason/SQL/treatment essays in the body', () => {
  const report = unitPdfReport();
  const { html: enHtml } = buildDailyActivityPdfHtml(report, 'en', DAR_V6_PDF_ORIGIN_TEST);
  const { html: arHtml } = buildDailyActivityPdfHtml(report, 'ar', DAR_V6_PDF_ORIGIN_TEST);
  const visibleEn = visibleHtml(enHtml);
  const visibleAr = visibleHtml(arHtml);
  assert.equal(visibleEn.includes(darT('en', 'summary.caption')), false);
  assert.equal(visibleEn.includes(darT('en', 'sess.caption')), false);
  assert.equal(visibleEn.includes(darT('en', 'summary.formula')), false);
  assert.equal(visibleEn.includes('Independent SQL signed'), false);
  assert.equal(visibleEn.includes('UNIT-TEST-ONLY · unavailable'), false);
  assert.equal(visibleAr.includes(darT('ar', 'sess.caption')), false);
  assert.match(enHtml, /ostag-short/);
  assert.match(enHtml, />Short</);
  assert.match(arHtml, />عجز</);
  assert.equal(osTagKind(report.sessions.totals.cashOverShort), 'short');
  assert.equal(osTagKind(report.kpis.cashOverShort), null);
});

test('cash O/S tags: negative Short, positive Over, zero untagged, null em dash', () => {
  const report = unitPdfReport();
  report.kpis.cashOverShort = metric('kpi.cashOverShort', '-528.28', { scope: 'full_shift' });
  report.sessions.rows[0].overShort = metric('sessions.rows.101.overShort', '4.50');
  report.sessions.totals.allMethodsOverShort = metric('sessions.totals.allMethodsOverShort', '0.00', {
    scope: 'full_shift',
  });
  const { html } = buildDailyActivityPdfHtml(report, 'en', DAR_V6_PDF_ORIGIN_TEST);
  assert.match(html, /-528\.28/);
  assert.match(html, /ostag-short/);
  assert.match(html, /4\.50/);
  assert.match(html, /ostag-over/);
  assert.match(html, /0\.00/);
  const pages = pdfArticles(html);
  assert.match(pages[1], /Unit Cashier B/);
  assert.match(pages[1], />—</);
  assert.equal(osTagKind(report.sessions.rows[1].overShort), null);
  assert.equal(osTagKind(report.kpis.cashOverShort), 'short');
  assert.equal(osTagKind(report.sessions.rows[0].overShort), 'over');
  assert.equal(osTagKind(report.sessions.totals.allMethodsOverShort), null);
});

test('long cashier session lists stay on page 2 with overflow notice and keep every row', () => {
  const report = unitPdfReport();
  const extra = [];
  for (let i = 1; i <= 40; i += 1) {
    extra.push({
      id: `long-${i}`,
      cashierName: `Long Cashier ${String(i).padStart(2, '0')}`,
      branchId: '10',
      status: 'closed',
      expected: metric(`sessions.rows.long-${i}.expected`, '1.00'),
      counted: metric(`sessions.rows.long-${i}.counted`, '1.00'),
      overShort: metric(`sessions.rows.long-${i}.overShort`, '0.00'),
    });
  }
  report.sessions.rows = extra;
  const { html, model } = buildDailyActivityPdfHtml(report, 'en', DAR_V6_PDF_ORIGIN_TEST);
  assert.ok(model.sessChunks.length >= 2);
  assert.equal(chunkSessionRows(extra).flat().length, 40);
  assert.equal(ownerPdfPageCount(html), 5);
  const pages = pdfArticles(html);
  assert.match(pages[1], /data-block="sessions"/);
  assert.match(pages[1], /Cashier sessions &amp; closing/);
  assert.match(pages[1], /pdf-overflow/);
  assert.match(pages[1], /40/);
  assert.equal(pages[2].includes('data-block="sessions-cont"'), false);
  for (let i = 1; i <= 40; i += 1) {
    assert.ok(pages[1].includes(`Long Cashier ${String(i).padStart(2, '0')}`), `missing cashier ${i}`);
  }
  assert.equal(visibleHtml(html).includes('kpi.sales.exVat ='), false);
  assert.equal(html.includes('metricKey dump'), false);
});

test('long department lists stay on page 3 with overflow notice instead of extra pages', () => {
  const report = unitPdfReport();
  for (let i = 1; i <= 16; i += 1) {
    report.departments.push({
      id: `dept-extra-${i}`,
      labelEn: `Unit extra ${i}`,
      labelAr: `قسم إضافي ${i}`,
      totals: {
        measures: { revenue: { exVat: metric(`departments.extra.${i}.exVat`, '1.00') } },
      },
      products: { buckets: [], top5: [] },
      services: { groups: [] },
    });
  }
  const { html, model } = buildDailyActivityPdfHtml(report, 'en', DAR_V6_PDF_ORIGIN_TEST);
  assert.ok(model.deptChunks.length >= 3);
  assert.equal(ownerPdfPageCount(html), 5);
  const pages = pdfArticles(html);
  assert.match(pages[2], /data-block="departments"/);
  assert.match(pages[2], /pdf-overflow/);
  for (let i = 1; i <= 16; i += 1) {
    assert.ok(pages[2].includes(`Unit extra ${i}`), `missing dept ${i}`);
  }
  assert.equal(visibleHtml(html).includes('kpi.sales.exVat ='), false);
});

test('PDF verify strip binds to this snapshot and never fakes matched', () => {
  const report = unitPdfReport();
  const checked = buildDailyActivityPdfHtml(report, 'en', DAR_V6_PDF_ORIGIN_TEST, {
    overallStatus: 'partial',
    snapshotToken: 'unit-test-only',
    verificationTimestamp: '2026-11-06T08:01:00.000Z',
    sourceRevision: 'dar.v6.commissions-ledger-accrued',
  });
  assert.match(checked.html, /Partial/);
  assert.match(checked.html, /2026-11-06T08:01:00.000Z/);
  assert.equal(checked.html.includes('V6 · NOT FINANCIALLY VERIFIED'), false);
  const otherSnap = buildDailyActivityPdfHtml(report, 'en', DAR_V6_PDF_ORIGIN_TEST, {
    overallStatus: 'matched',
    snapshotToken: 'other-snapshot',
    verificationTimestamp: '2026-11-06T08:01:00.000Z',
  });
  assert.match(otherSnap.html, /Financial verify: not checked/);
  assert.equal(otherSnap.html.includes('Matched'), false);
});

test('owner screen source keeps field detail on hover instead of under-field essays', () => {
  const sections = readFileSync(join(here, 'DailyActivitySections.jsx'), 'utf8');
  const rest = readFileSync(join(here, 'DailyActivityRest.jsx'), 'utf8');
  const page = readFileSync(join(here, 'DailyActivityPage.jsx'), 'utf8');
  const css = readFileSync(join(here, 'daily-activity.css'), 'utf8');
  assert.ok(sections.includes('data-tip'));
  assert.ok(rest.includes('data-tip') || rest.includes('Tip '));
  assert.equal(sections.includes('<small>{c.hint}</small>'), false);
  assert.equal(sections.includes('d.payableNote || d.amount?.reason'), false);
  assert.ok(sections.includes('OsTaggedMetric'));
  assert.ok(rest.includes('OsTaggedMetric'));
  assert.equal(sections.includes('{t(\'filter.sessionsHint\')}</p>'), false);
  assert.ok(sections.includes('filter.sessionsHint'));
  assert.ok(sections.includes('role="tablist"'));
  assert.ok(sections.includes('href={`#${tab.id}`}'));
  assert.ok(page.includes('readDarSectionTab'));
  assert.ok(page.includes("activeTab === 'sessions'"));
  assert.equal(page.includes('<DailyActivityDepartments') && page.includes("activeTab === 'depts'"), true);
  assert.ok(css.includes('max-height: 88px'));
  assert.ok(css.includes('.dar-v6-field--combo .ms-combo__chips'));
  assert.ok(sections.includes('verify.action'));
  assert.ok(sections.includes('DailyActivityVerifyPanel'));
  assert.equal(sections.includes('V6 · NOT FINANCIALLY VERIFIED'), false);
  assert.ok(page.includes('fetchDailyActivityV6Verify'));
  assert.ok(page.includes('verifyAbortRef'));
  assert.ok(css.includes('dar-v6-verify-overlay'));
  assert.ok(css.includes('.dar-v6-tip'));
  assert.ok(css.includes('cursor: pointer'));
});

test('EN and AR exports keep the captured report even if draft dates change', () => {
  const captured = unitPdfReport();
  const draft = unitPdfReport();
  draft.meta.from = '2026-09-06';
  draft.meta.to = '2026-09-06';
  const en = buildDailyActivityPdfHtml(captured, 'en', DAR_V6_PDF_ORIGIN_TEST);
  const ar = buildDailyActivityPdfHtml(captured, 'ar', DAR_V6_PDF_ORIGIN_TEST);
  assert.match(en.html, /06 Nov 2026/);
  assert.match(ar.html, /نوفمبر 2026/);
  assert.equal(en.html.includes('2026-09-06'), false);
  assert.equal(ar.html.includes('2026-09-06'), false);
  assert.equal(ownerPdfPageCount(en.html), ownerPdfPageCount(ar.html));
});

test('PDF selected-sales block uses the same simple groups as the screen', () => {
  const report = unitPdfReport();
  report.operations = [
    {
      code: 'selected_sales_cash',
      group: 'selected_sales',
      labelEn: 'Cash',
      labelAr: 'نقد',
      amount: metric('operations.selected_sales_cash.amount', '10.00'),
      entries: metric('operations.selected_sales_cash.entries', '1', { kind: 'count' }),
    },
    {
      code: 'selected_sales_bank_transfer',
      group: 'selected_sales',
      labelEn: 'Bank transfer',
      labelAr: 'تحويل بنكي',
      amount: metric('operations.selected_sales_bank_transfer.amount', '4.00'),
      entries: metric('operations.selected_sales_bank_transfer.entries', '1', { kind: 'count' }),
    },
    {
      code: 'customer_receipts',
      group: 'receipts',
      labelEn: 'All receipts',
      labelAr: 'كل المقبوضات',
      amount: metric('operations.customer_receipts.amount', '20.00'),
      entries: metric('operations.customer_receipts.entries', '2', { kind: 'count' }),
    },
    {
      code: 'same_period_invoice_receipts',
      group: 'invoice_date',
      labelEn: 'Same-period invoice date',
      labelAr: 'تاريخ فاتورة الفترة',
      amount: metric('operations.same_period_invoice_receipts.amount', '8.00'),
      entries: metric('operations.same_period_invoice_receipts.entries', '1', { kind: 'count' }),
    },
  ];
  const { html: enHtml } = buildDailyActivityPdfHtml(report, 'en', DAR_V6_PDF_ORIGIN_TEST);
  const { html: arHtml } = buildDailyActivityPdfHtml(report, 'ar', DAR_V6_PDF_ORIGIN_TEST);
  const pages = pdfArticles(enHtml);
  assert.match(pages[4], /Selected sales/);
  assert.match(pages[4], /All receipts/);
  assert.match(pages[4], />Cash</);
  assert.match(pages[4], /Bank transfer/);
  assert.match(pages[4], /Invoice-date view/);
  assert.equal(pages[4].includes('ID bridge'), false);
  assert.match(arHtml, /المبيعات المحددة/);
  assert.match(arHtml, /كل المقبوضات/);
  const cashAt = pages[4].indexOf('>Cash<');
  const bankAt = pages[4].indexOf('>Bank transfer<');
  const receiptsAt = pages[4].indexOf(`<h3>${darT('en', 'ops.allReceipts')}</h3>`);
  assert.ok(cashAt >= 0 && bankAt > cashAt && receiptsAt > bankAt);
});

test('TEST-ONLY node writer is three pages with URI links and no metricKey dump', () => {
  const report = unitPdfReport();
  mkdirSync(outDir, { recursive: true });
  const { html: enHtml } = buildDailyActivityPdfHtml(report, 'en', DAR_V6_PDF_ORIGIN_TEST);
  const { html: arHtml } = buildDailyActivityPdfHtml(report, 'ar', DAR_V6_PDF_ORIGIN_TEST);
  writeFileSync(join(outDir, 'phase-25-dar-en.html'), enHtml, 'utf8');
  writeFileSync(join(outDir, 'phase-25-dar-ar.html'), arHtml, 'utf8');
  const en = writeDailyActivityPdfDoc(report, 'en', DAR_V6_PDF_ORIGIN_TEST);
  const ar = writeDailyActivityPdfDoc(report, 'ar', DAR_V6_PDF_ORIGIN_TEST);
  assert.equal(en.doc.getNumberOfPages(), 3);
  assert.equal(ar.doc.getNumberOfPages(), 3);
  const enBytes = en.doc.output('arraybuffer');
  const arBytes = ar.doc.output('arraybuffer');
  writeFileSync(join(outDir, 'phase-25-node-fallback-en.pdf'), Buffer.from(enBytes));
  writeFileSync(join(outDir, 'phase-25-node-fallback-ar.pdf'), Buffer.from(arBytes));
  const enRaw = Buffer.from(enBytes).toString('latin1');
  assert.match(enRaw, /\/URI\s*\(/);
  assert.match(enRaw, /daily-activity\/proof/);
  assert.match(enRaw, /summary.net/);
  assert.equal(/kpi\.sales\.exVat =/.test(enRaw), false);
  assert.equal(/authorization|bearer /i.test(enRaw), false);
  for (const banned of FORBIDDEN) {
    assert.equal(enRaw.includes(banned), false, banned);
  }
});
