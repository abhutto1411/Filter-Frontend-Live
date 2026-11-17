import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatMetricValue, wrapProofHref } from './dailyActivityFormat.js';
import { darT } from './dailyActivityI18n.js';
import {
  buildDepartmentViews,
  collectDepartmentMetrics,
  compareDepartmentsByRevenue,
  departmentDisplaysMatchApi,
  formatQtyMetric,
} from './dailyActivityDepartments.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FORBIDDEN = ['26170', '26,170', '16820', '16,820', '30095.50', '13429.29'];

function metric(key, value, extras = {}) {
  const unavailable = value == null;
  return {
    key,
    value,
    kind: extras.kind || 'money',
    unit: extras.unit || (extras.kind === 'count' ? 'count' : extras.kind === 'quantity' ? extras.unit || 'L' : 'SAR'),
    status: extras.status || (unavailable ? 'unavailable' : 'partial'),
    scope: extras.scope || 'session_windows',
    source: extras.source || 'dar.v6.unit-test-only',
    reason: extras.reason ?? (unavailable ? 'UNIT-TEST-ONLY · unavailable' : extras.status === 'estimated' ? 'Catalog estimate' : null),
    proof: {
      metricKey: key,
      href: `/workshop-staff/reports/daily-activity/v6/proof?metricKey=${encodeURIComponent(key)}`,
    },
  };
}

function measures(prefix, revenue, qty) {
  return {
    qtyByUom: qty || [metric(`${prefix}.qty.L`, '4.000', { kind: 'quantity', unit: 'L' })],
    revenue: {
      exVat: metric(`${prefix}.revenue.exVat`, revenue),
      vat: metric(`${prefix}.revenue.vat`, null),
      inclVat: metric(`${prefix}.revenue.inclVat`, null),
    },
    cost: metric(`${prefix}.cost`, null, { status: 'estimated', reason: 'Catalog estimate' }),
    marginAmount: metric(`${prefix}.marginAmount`, null),
    marginPct: metric(`${prefix}.marginPct`, null, { kind: 'percent', unit: '%' }),
  };
}

function detail(id, en, ar, prefix, revenue, extras = {}) {
  return {
    id,
    code: extras.code,
    labelEn: en,
    labelAr: ar,
    measures: measures(prefix, revenue, extras.qty),
    mappingStatus: extras.mappingStatus || 'unmapped',
    isSubset: Boolean(extras.isSubset),
    grades: extras.grades || [],
    top5: extras.top5 || [],
  };
}

/** UNIT-TEST-ONLY. Not live. Not K-10 EXAMPLE money. */
function unitDeptReport() {
  return {
    schemaVersion: 'dar.v6',
    meta: { snapshotToken: 'unit-test-only', from: '2026-11-06', to: '2026-11-06' },
    departments: [
      {
        id: 'dept-a',
        labelEn: 'Unit Test Oil',
        labelAr: 'زيت اختبار',
        totals: {
          jobsOpened: metric('departments.dept-a.totals.jobsOpened', '3', { kind: 'count' }),
          jobsCompleted: metric('departments.dept-a.totals.jobsCompleted', '2', { kind: 'count' }),
          jobsInProgress: metric('departments.dept-a.totals.jobsInProgress', '1', { kind: 'count' }),
          jobsCancelled: metric('departments.dept-a.totals.jobsCancelled', '0', { kind: 'count' }),
          measures: measures('departments.dept-a.totals.measures', '80.00', [
            metric('departments.dept-a.totals.measures.qty.L', '4.000', { kind: 'quantity', unit: 'L' }),
            metric('departments.dept-a.totals.measures.qty.pcs', '1', { kind: 'quantity', unit: 'pcs' }),
          ]),
        },
        products: {
          totals: measures('departments.dept-a.products.totals', '70.00'),
          buckets: [
            {
              ...detail('oil', 'Oil Sale', 'مبيعات الزيت', 'departments.dept-a.products.buckets.oil', '50.00', {
                code: 'oil',
                grades: [
                  detail('10W30', '10W30', '10W30', 'departments.dept-a.products.buckets.oil.grades.10W30', '50.00', {
                    isSubset: true,
                    mappingStatus: 'unmapped',
                  }),
                ],
              }),
            },
            detail('black_oil', 'Black Oil Sales', 'مبيعات الزيت الأسود', 'departments.dept-a.products.buckets.black_oil', '20.00', {
              code: 'black_oil',
            }),
          ],
          top5: [
            detail('sku-b', 'SKU B', 'صنف ب', 'departments.dept-a.products.top5.sku-b', '40.00', { isSubset: true }),
            detail('sku-a', 'SKU A', 'صنف أ', 'departments.dept-a.products.top5.sku-a', '30.00', { isSubset: true }),
          ],
        },
        services: {
          totals: measures('departments.dept-a.services.totals', '10.00', [
            metric('departments.dept-a.services.totals.qty.services', '2', { kind: 'quantity', unit: 'services' }),
          ]),
          groups: [
            {
              ...detail('normal', 'Normal', 'عادي', 'departments.dept-a.services.groups.normal', '7.00', { code: 'normal' }),
              top5: [
                detail('svc-1', 'Normal small', 'عادي صغير', 'departments.dept-a.services.groups.normal.top5.svc-1', '7.00', {
                  isSubset: true,
                }),
              ],
            },
            {
              ...detail('vip', 'VIP', 'VIP', 'departments.dept-a.services.groups.vip', '3.00', { code: 'vip' }),
              top5: [],
            },
          ],
        },
        unallocated: measures('departments.dept-a.unallocated', null, []),
        blackOilBridge: {
          excluding: metric('departments.dept-a.blackOilBridge.excluding', '50.00'),
          blackOil: metric('departments.dept-a.blackOilBridge.blackOil', '20.00'),
          including: metric('departments.dept-a.blackOilBridge.including', '70.00'),
        },
      },
    ],
    reconciliation: [
      {
        code: 'sales_header_vs_leaf',
        status: 'unavailable',
        difference: metric('reconciliation.sales_header_vs_leaf.difference', null),
      },
    ],
  };
}

test('UNIT-TEST-ONLY department fixture avoids K-10 EXAMPLE money', () => {
  const blob = JSON.stringify(unitDeptReport());
  for (const banned of FORBIDDEN) assert.equal(blob.includes(banned), false, banned);
});

test('department views keep API order and do not invent buckets or rank Top5', () => {
  const views = buildDepartmentViews(unitDeptReport(), 'en');
  assert.equal(views.length, 1);
  assert.deepEqual(
    views[0].products.buckets.map((b) => b.code),
    ['oil', 'black_oil'],
  );
  assert.deepEqual(
    views[0].products.top5.map((r) => r.id),
    ['sku-b', 'sku-a'],
  );
  assert.equal(views[0].products.top5[0].isSubset, true);
  assert.deepEqual(
    views[0].services.groups.map((g) => g.code),
    ['normal', 'vip'],
  );
  const empty = buildDepartmentViews({ departments: [] }, 'en');
  assert.deepEqual(empty, []);
});

test('UOM fragments stay separate; null cost/margin stay —; Black Oil metrics are not added in FE', () => {
  const report = unitDeptReport();
  const views = buildDepartmentViews(report, 'en');
  const qty = views[0].totals.measures.qtyByUom;
  assert.equal(formatQtyMetric(qty[0]), '4.000 L');
  assert.equal(formatQtyMetric(qty[1]), '1 pcs');
  assert.equal(formatMetricValue(views[0].totals.measures.cost), '—');
  assert.equal(formatMetricValue(views[0].totals.measures.marginAmount), '—');
  const bridge = views[0].blackOilBridge;
  assert.equal(formatMetricValue(bridge.excluding), '50.00');
  assert.equal(formatMetricValue(bridge.blackOil), '20.00');
  assert.equal(formatMetricValue(bridge.including), '70.00');
  assert.notEqual(formatMetricValue(bridge.including), '—');
});

test('department displays equal API strings and every metric has proof', () => {
  const report = unitDeptReport();
  assert.deepEqual(departmentDisplaysMatchApi(report), []);
  const metrics = collectDepartmentMetrics(report);
  assert.ok(metrics.length >= 15);
  for (const m of metrics) {
    assert.ok(m.key);
    assert.ok(m.proof?.href);
    assert.ok(wrapProofHref(m).includes('/workshop/daily-activity/proof'));
  }
});

test('EN and AR keep the same department numbers', () => {
  const report = unitDeptReport();
  const en = buildDepartmentViews(report, 'en');
  const ar = buildDepartmentViews(report, 'ar');
  assert.notEqual(en[0].label, ar[0].label);
  assert.equal(
    formatMetricValue(en[0].totals.measures.revenue.exVat),
    formatMetricValue(ar[0].totals.measures.revenue.exVat),
  );
  assert.equal(darT('en', 'dept.estimated').includes('Reporting estimate'), true);
  assert.equal(darT('en', 'dept.estimated').includes('COGS'), true);
  assert.ok(darT('ar', 'dept.estimated').includes('تقدير'));
});

test('scoped CSS uses portal tokens and drops wireframe teal primary', () => {
  const css = readFileSync(join(HERE, 'daily-activity.css'), 'utf8');
  assert.equal(css.includes('#087f83'), false);
  assert.equal(css.includes('--color-primary'), true);
  assert.equal(/\.dar-v6\s*\{[^}]*max-width:\s*none/.test(css), true);
});

test('write UNIT-TEST-ONLY department HTML artifacts', () => {
  const report = unitDeptReport();
  const views = buildDepartmentViews(report, 'en');
  const outDir = process.env.DAR_FE_ARTIFACT_DIR
    || join(HERE, '..', '..', '..', '..', '..', '_AUTO-REPORTS', 'RF-DAR-V6-FE', 'artifacts');
  mkdirSync(outDir, { recursive: true });
  const html = (locale) => {
    const v = buildDepartmentViews(report, locale)[0];
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    return `<!DOCTYPE html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"/><title>UNIT-TEST-ONLY depts ${locale}</title>
<style>body{font:13px Poppins,Arial,sans-serif;background:#F5F5F7;padding:20px}.banner{background:#fff1c9;padding:10px;font-weight:700}.btn-portal{background:#FCC245;color:#111;border:0;padding:10px 20px;border-radius:10px}.ws-lang-btn.active{background:#FCC245;color:#111;border:1px solid #FCC245;border-radius:7px;padding:5px 10px}.ws-lang-btn{padding:5px 10px;border:1px solid #e2e8f0;border-radius:7px;background:#fff}section{background:#fff;border-top:4px solid #FCC245;padding:16px;margin-top:16px}</style></head><body>
<p class="banner">UNIT-TEST-ONLY · not live money · not K-10 EXAMPLE</p>
<div><button class="ws-lang-btn${locale === 'en' ? ' active' : ''}">EN</button> <button class="ws-lang-btn${locale === 'ar' ? ' active' : ''}">عربي</button> <button class="btn-portal">Apply</button></div>
<p>Sales ${formatMetricValue(v.totals.measures.revenue.exVat)} · jobs ${formatMetricValue(v.totals.jobsCompleted)} · cost ${formatMetricValue(v.totals.measures.cost)}</p>
<p>Top5 ${v.products.top5.map((r) => r.id).join(',')} · buckets ${v.products.buckets.map((b) => b.code).join(',')}</p>
<p>Bridge ${formatMetricValue(v.blackOilBridge.excluding)} / ${formatMetricValue(v.blackOilBridge.blackOil)} / ${formatMetricValue(v.blackOilBridge.including)}</p>
</body></html>`;
  };
  writeFileSync(join(outDir, 'phase-13-departments-en.html'), html('en'), 'utf8');
  writeFileSync(join(outDir, 'phase-13-departments-ar.html'), html('ar'), 'utf8');
  const chrome = (locale) => `<!DOCTYPE html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><title>UNIT-TEST-ONLY chrome ${locale}</title>
<style>
body{margin:0;background:#F5F5F7;font-family:Poppins,Arial,sans-serif;padding:24px}
.banner{background:#fff1c9;border:1px solid #eddbab;padding:10px;font-weight:700;margin-bottom:16px}
.ws-page-header{display:flex;justify-content:space-between;gap:12px;margin-bottom:20px}
.ws-lang-btn{padding:5px 10px;border:1px solid #e2e8f0;border-radius:7px;background:#fff}
.ws-lang-btn.active{background:#FCC245;border-color:#FCC245;color:#111}
.btn-portal{background:#FCC245;color:#111;border:none;padding:10px 20px;border-radius:10px;font-weight:600}
.btn-portal-outline{background:#fff;border:1px solid #E5E7EB;padding:10px 20px;border-radius:10px}
.filters{display:grid;grid-template-columns:1fr 1fr 1.4fr auto;gap:12px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:16px}
.ms-combo__field{min-height:44px;border:1px solid #e2e8f0;border-radius:10px;padding:8px;background:#fff}
.ms-combo__field--open{border-color:#FCC245;box-shadow:0 0 0 3px rgba(252,194,69,.18)}
.ms-combo__chip{background:#fff7ed;border:1px solid #fdba74;border-radius:999px;padding:3px 8px;font-size:12px}
label{display:block;font-size:10px;font-weight:700;color:#6B7280;margin-bottom:6px}
</style></head><body>
<p class="banner">UNIT-TEST-ONLY · portal chrome · not live money</p>
<header class="ws-page-header"><div><h1>${locale === 'ar' ? 'تقرير النشاط اليومي' : 'Daily Activity Report'}</h1></div>
<div><button class="ws-lang-btn${locale === 'en' ? ' active' : ''}">EN</button> <button class="ws-lang-btn${locale === 'ar' ? ' active' : ''}">عربي</button> <button class="btn-portal-outline" disabled>PDF</button></div></header>
<form class="filters">
<div><label>${locale === 'ar' ? 'من' : 'From'}</label><input type="date" value="2026-11-06"/></div>
<div><label>${locale === 'ar' ? 'الفرع' : 'Branch'}</label><div class="ms-combo__field ms-combo__field--open"><span class="ms-combo__chip">${locale === 'ar' ? 'كل الفروع المصرّح بها' : 'All authorized branches'}</span></div></div>
<div><label>${locale === 'ar' ? 'الجلسات' : 'Sessions'}</label><div class="ms-combo__field"><span class="ms-combo__chip">${locale === 'ar' ? 'الكل · دون تقييد' : 'All · unrestricted'}</span></div></div>
<button type="button" class="btn-portal">${locale === 'ar' ? 'تطبيق' : 'Apply'}</button>
</form>
</body></html>`;
  writeFileSync(join(outDir, 'phase-13-chrome-en.html'), chrome('en'), 'utf8');
  writeFileSync(join(outDir, 'phase-13-chrome-ar.html'), chrome('ar'), 'utf8');
  assert.equal(views[0].products.top5[0].id, 'sku-b');
});

function dept(id, exVat, labelEn, labelAr) {
  return {
    id,
    labelEn,
    labelAr,
    totals: {
      measures: {
        revenue: {
          exVat: exVat == null ? { value: null, status: 'unavailable' } : { value: exVat, status: 'estimated' },
        },
      },
    },
    products: { buckets: [], top5: [] },
    services: { groups: [] },
  };
}

test('departments sort by revenue ex-vat desc; nulls last; id tie; EN and AR match', () => {
  const report = {
    departments: [
      dept('b', '100', 'Bravo', 'باء'),
      dept('a', '1000', 'Alpha', 'ألف'),
      dept('c', '90', 'Charlie', 'جيم'),
      dept('d', '100.00', 'Delta', 'دال'),
      dept('e', null, 'Echo', 'هاء'),
      dept('f', '0', 'Foxtrot', 'فاء'),
      dept('g', '-5', 'Golf', 'جيم-س'),
    ],
  };
  const before = report.departments.map((row) => row.totals.measures.revenue.exVat.value);
  const en = buildDepartmentViews(report, 'en').map((row) => row.id);
  const ar = buildDepartmentViews(report, 'ar').map((row) => row.id);
  assert.deepEqual(en, ['a', 'b', 'd', 'c', 'f', 'g', 'e']);
  assert.deepEqual(ar, en);
  assert.deepEqual(
    report.departments.map((row) => row.totals.measures.revenue.exVat.value),
    before,
  );
  assert.equal(compareDepartmentsByRevenue(dept('z', '100', 'زيت', 'زيت'), dept('y', '100', 'Oil', 'Oil')), 1);
});
