import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatMetricValue, wrapProofHref } from './dailyActivityFormat.js';
import { darT } from './dailyActivityI18n.js';
import {
  collectRestMetrics,
  osTagKind,
  ownerCoverageCopy,
  restDisplaysMatchApi,
  sessionRows,
  signedOsTone,
} from './dailyActivityRest.js';

const FORBIDDEN = ['26170', '26,170', '-60.00', '16086.21', '16,086.21', '13429.29'];

function metric(key, value, extras = {}) {
  const unavailable = value == null;
  return {
    key,
    value,
    kind: extras.kind || 'money',
    unit: extras.unit || (extras.kind === 'count' ? 'count' : extras.kind === 'quantity' ? extras.unit || 'pcs' : extras.kind === 'duration' ? extras.unit || 'hour' : 'SAR'),
    status: extras.status || (unavailable ? 'unavailable' : 'partial'),
    scope: extras.scope || 'period',
    source: extras.source || 'dar.v6.unit-test-only',
    reason: extras.reason ?? (unavailable ? 'UNIT-TEST-ONLY · unavailable' : null),
    proof: {
      metricKey: key,
      href: `/workshop-staff/reports/daily-activity/v6/proof?metricKey=${encodeURIComponent(key)}`,
    },
  };
}

/** UNIT-TEST-ONLY. Not 14 Sep / K-10 EXAMPLE money. */
function unitRestReport() {
  return {
    schemaVersion: 'dar.v6',
    meta: { snapshotToken: 'unit-test-only', from: '2026-11-06', to: '2026-11-06' },
    sessions: {
      totals: {
        closed: metric('sessions.totals.closed', '2', { kind: 'count', scope: 'full_shift' }),
        open: metric('sessions.totals.open', '1', { kind: 'count', scope: 'full_shift' }),
        balanced: metric('sessions.totals.balanced', '1', { kind: 'count', scope: 'full_shift' }),
        withVariance: metric('sessions.totals.withVariance', '1', { kind: 'count', scope: 'full_shift' }),
        cashOverShort: metric('sessions.totals.cashOverShort', '-8.00', { scope: 'full_shift' }),
        allMethodsOverShort: metric('sessions.totals.allMethodsOverShort', '3.00', { scope: 'full_shift' }),
      },
      rows: [
        {
          id: '101',
          branchId: '10',
          cashierName: 'Unit Cashier A',
          openedAt: '2026-11-06T05:00:00.000Z',
          closedAt: '2026-11-06T15:00:00.000Z',
          status: 'closed',
          hasClosing: true,
          closingBasis: 'full_shift',
          expected: metric('sessions.rows.101.expected', '50.00', { scope: 'full_shift' }),
          counted: metric('sessions.rows.101.counted', '42.00', { scope: 'full_shift' }),
          overShort: metric('sessions.rows.101.overShort', '-8.00', { scope: 'full_shift' }),
          methods: [
            {
              method: 'cash',
              expected: metric('sessions.rows.101.methods.cash.expected', '50.00', { scope: 'full_shift' }),
              counted: metric('sessions.rows.101.methods.cash.counted', '42.00', { scope: 'full_shift' }),
              overShort: metric('sessions.rows.101.methods.cash.overShort', '-8.00', { scope: 'full_shift' }),
            },
          ],
        },
        {
          id: '102',
          branchId: '10',
          cashierName: 'Unit Cashier B',
          openedAt: '2026-11-06T15:00:00.000Z',
          closedAt: null,
          status: 'open',
          hasClosing: false,
          closingBasis: 'full_shift',
          expected: metric('sessions.rows.102.expected', null, { scope: 'full_shift' }),
          counted: metric('sessions.rows.102.counted', null, { scope: 'full_shift' }),
          overShort: metric('sessions.rows.102.overShort', null, { scope: 'full_shift' }),
          methods: [],
        },
      ],
    },
    money: {
      petty: {
        total: metric('money.petty.total', '12.00'),
        entries: metric('money.petty.entries', '2', { kind: 'count' }),
        byPurpose: [
          {
            id: 'fuel',
            labelEn: 'Fuel',
            labelAr: 'وقود',
            amount: metric('money.petty.byPurpose.fuel.amount', '12.00'),
            entries: metric('money.petty.byPurpose.fuel.entries', '2', { kind: 'count' }),
          },
        ],
      },
      nonCash: {
        net: metric('money.nonCash.net', null),
        vat: metric('money.nonCash.vat', null),
        gross: metric('money.nonCash.gross', null),
        entries: metric('money.nonCash.entries', null, { kind: 'count' }),
      },
      advances: {
        amount: metric('money.advances.amount', '5.00'),
        entries: metric('money.advances.entries', '1', { kind: 'count' }),
      },
      replenishment: {
        amount: metric('money.replenishment.amount', '9.00'),
        entries: metric('money.replenishment.entries', '1', { kind: 'count' }),
      },
      purchases: [
        {
          relationship: 'affiliated',
          entries: metric('money.purchases.affiliated.entries', '1', { kind: 'count' }),
          net: metric('money.purchases.affiliated.net', '40.00'),
          vat: metric('money.purchases.affiliated.vat', '6.00'),
          gross: metric('money.purchases.affiliated.gross', '46.00'),
          paid: metric('money.purchases.affiliated.paid', '0.00'),
          balance: metric('money.purchases.affiliated.balance', '46.00'),
        },
      ],
    },
    operations: [
      {
        code: 'prior_invoice_collections',
        labelEn: 'Prior-invoice collections',
        labelAr: 'تحصيل فواتير سابقة',
        treatment: 'Subset of receipts',
        entries: metric('operations.prior_invoice_collections.entries', '1', { kind: 'count' }),
        amount: metric('operations.prior_invoice_collections.amount', '11.00'),
        qtyByUom: [],
        bySource: [
          {
            source: 'web',
            amount: metric('operations.prior_invoice_collections.bySource.web.amount', '11.00'),
            entries: metric('operations.prior_invoice_collections.bySource.web.entries', '1', { kind: 'count' }),
          },
        ],
      },
      {
        code: 'stock_adjustments',
        labelEn: 'Stock adjustments',
        labelAr: 'تسويات المخزون',
        treatment: 'Movement source of truth',
        entries: metric('operations.stock_adjustments.entries', '1', { kind: 'count' }),
        amount: metric('operations.stock_adjustments.amount', null),
        qtyByUom: [
          metric('operations.stock_adjustments.qty.L', '-2.000', { kind: 'quantity', unit: 'L' }),
        ],
        bySource: [],
      },
    ],
    technicians: {
      attributionBasis: 'UNIT-TEST-ONLY basis · not Commissions Due',
      rows: [
        {
          id: 't1',
          name: 'Tech A',
          jobsCompleted: metric('technicians.rows.t1.jobsCompleted', '1', { kind: 'count' }),
          assignmentsCompleted: metric('technicians.rows.t1.assignmentsCompleted', '2', { kind: 'count' }),
          attributedRevenue: metric('technicians.rows.t1.attributedRevenue', '15.00'),
          commissionAttributed: metric('technicians.rows.t1.commissionAttributed', null),
          avgDurationHours: metric('technicians.rows.t1.avgDurationHours', '1.50', { kind: 'duration', unit: 'hour' }),
          avgRespondMinutes: metric('technicians.rows.t1.avgRespondMinutes', null, { kind: 'duration', unit: 'minute' }),
        },
      ],
      totals: {
        jobsCompleted: metric('technicians.totals.jobsCompleted', '1', { kind: 'count' }),
        attributedRevenue: metric('technicians.totals.attributedRevenue', '15.00'),
        commissionAttributed: metric('technicians.totals.commissionAttributed', null),
      },
    },
    coverage: [
      {
        code: 'commissions_payable',
        labelEn: 'Commissions Due',
        labelAr: 'العمولات المستحقة',
        status: 'unavailable',
        reason: 'No due_date',
        amount: metric('coverage.commissions_payable.amount', null),
        entries: metric('coverage.commissions_payable.entries', null, { kind: 'count' }),
      },
    ],
    reconciliation: [
      {
        code: 'net_identity',
        status: 'unavailable',
        difference: metric('reconciliation.net_identity.difference', null),
      },
    ],
  };
}

test('UNIT-TEST-ONLY rest fixture avoids K-10 EXAMPLE money', () => {
  const blob = JSON.stringify(unitRestReport());
  for (const banned of FORBIDDEN) assert.equal(blob.includes(banned), false, banned);
});

test('O/S tone uses the API signed string and never inverts', () => {
  assert.equal(signedOsTone(metric('a', '-8.00')), 'short');
  assert.equal(signedOsTone(metric('b', '3.00')), 'over');
  assert.equal(signedOsTone(metric('c', '0.00')), 'balanced');
  assert.equal(signedOsTone(metric('d', null)), 'unavailable');
  assert.equal(signedOsTone(null), 'unavailable');
  assert.equal(signedOsTone({ value: null }), 'unavailable');
  assert.equal(formatMetricValue(metric('a', '-8.00')), '-8.00');
  assert.notEqual(formatMetricValue(metric('a', '-8.00')), '8.00');
});

test('Short/Over tags follow the signed API result; zero and null stay untagged', () => {
  assert.equal(osTagKind(metric('a', '-8.00')), 'short');
  assert.equal(osTagKind(metric('b', '3.00')), 'over');
  assert.equal(osTagKind(metric('c', '0.00')), null);
  assert.equal(osTagKind(metric('d', null)), null);
  assert.equal(osTagKind(metric('e', '0')), null);
  assert.equal(osTagKind(null), null);
  assert.equal(darT('en', 'os.short'), 'Short');
  assert.equal(darT('en', 'os.over'), 'Over');
  assert.equal(darT('ar', 'os.short'), 'عجز');
  assert.equal(darT('ar', 'os.over'), 'زيادة');
  assert.notEqual(darT('en', 'os.short'), darT('ar', 'os.short'));
});

test('open session counted/O/S stay — and are not treated as balanced', () => {
  const open = sessionRows(unitRestReport())[1];
  assert.equal(open.status, 'open');
  assert.equal(formatMetricValue(open.counted), '—');
  assert.equal(formatMetricValue(open.overShort), '—');
  assert.equal(signedOsTone(open.overShort), 'unavailable');
  assert.equal(osTagKind(open.overShort), null);
  assert.equal(open.closingBasis, 'full_shift');
});

test('rest displays equal API strings; stock qty is not mixed into money; coverage nulls stay linked', () => {
  const report = unitRestReport();
  assert.deepEqual(restDisplaysMatchApi(report), []);
  const metrics = collectRestMetrics(report);
  assert.ok(metrics.length >= 20);
  for (const m of metrics) {
    assert.ok(m.key);
    assert.ok(m.proof?.href);
    assert.ok(wrapProofHref(m).includes('/workshop/daily-activity/proof'));
  }
  const stockQty = metrics.find((m) => m.key.includes('stock_adjustments.qty'));
  const stockAmt = metrics.find((m) => m.key === 'operations.stock_adjustments.amount');
  assert.equal(formatMetricValue(stockQty), '-2.000');
  assert.equal(formatMetricValue(stockAmt), '—');
  const due = metrics.find((m) => m.key === 'coverage.commissions_payable.amount');
  assert.equal(formatMetricValue(due), '—');
});

test('owner coverage copy stays honest and does not relabel unavailable as complete', () => {
  const copy = ownerCoverageCopy(
    {
      code: 'advance_workshop_id_column',
      labelEn: 'Global advances',
      status: 'unavailable',
      reason: 'global_advances.workshop_id missing',
    },
    'en',
  );
  assert.equal(copy.status, 'Unavailable');
  assert.notEqual(copy.status.toLowerCase(), 'complete');
  assert.match(copy.why, /not a zero/i);
  assert.equal(copy.technical.includes('workshop_id'), true);
});

test('technician attribution is not forced to equal session or purchase totals', () => {
  const report = unitRestReport();
  const techRev = formatMetricValue(report.technicians.totals.attributedRevenue);
  const petty = formatMetricValue(report.money.petty.total);
  const cashOs = formatMetricValue(report.sessions.totals.cashOverShort);
  assert.equal(techRev, '15.00');
  assert.notEqual(techRev, petty);
  assert.notEqual(techRev, cashOs);
  assert.equal(formatMetricValue(report.technicians.rows[0].commissionAttributed), '—');
});

test('EN and AR keep the same rest-section numbers', () => {
  const report = unitRestReport();
  assert.equal(formatMetricValue(report.sessions.totals.cashOverShort), formatMetricValue(report.sessions.totals.cashOverShort));
  assert.notEqual(darT('en', 'sess.cashOs'), darT('ar', 'sess.cashOs'));
  assert.ok(darT('en', 'money.period').includes('Session'));
  assert.ok(darT('ar', 'money.replenish').includes('داخلي'));
});

test('write UNIT-TEST-ONLY EN/AR rest HTML artifacts', () => {
  const report = unitRestReport();
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = process.env.DAR_FE_ARTIFACT_DIR
    || join(here, '..', '..', '..', '..', '..', '_AUTO-REPORTS', 'RF-DAR-V6-FE', 'artifacts');
  mkdirSync(outDir, { recursive: true });
  const html = (locale) => `<!DOCTYPE html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><title>UNIT-TEST-ONLY rest ${locale}</title>
<style>body{font:13px Poppins,Arial,sans-serif;background:#F5F5F7;padding:20px}.banner{background:#fff1c9;padding:10px;font-weight:700}.short{color:#b4493c}.over{color:#087d68}</style></head><body>
<p class="banner">UNIT-TEST-ONLY · not live money · not K-10 EXAMPLE</p>
<p>${darT(locale, 'sess.section')} cash <span class="short">${formatMetricValue(report.sessions.totals.cashOverShort)}</span> <span class="ostag">${darT(locale, 'os.short')}</span> all <span class="over">${formatMetricValue(report.sessions.totals.allMethodsOverShort)}</span> <span class="ostag">${darT(locale, 'os.over')}</span></p>
<p>open counted ${formatMetricValue(report.sessions.rows[1].counted)} · ${darT(locale, 'sess.openNull')}</p>
<p>${darT(locale, 'money.period')} petty ${formatMetricValue(report.money.petty.total)} purchases gross ${formatMetricValue(report.money.purchases[0].gross)}</p>
<p>stock qty ${formatMetricValue(report.operations[1].qtyByUom[0])} ${report.operations[1].qtyByUom[0].unit} amount ${formatMetricValue(report.operations[1].amount)}</p>
<p>tech ${formatMetricValue(report.technicians.totals.attributedRevenue)} comm ${formatMetricValue(report.technicians.totals.commissionAttributed)}</p>
<p>coverage ${formatMetricValue(report.coverage[0].amount)}</p>
</body></html>`;
  writeFileSync(join(outDir, 'phase-14-rest-en.html'), html('en'), 'utf8');
  writeFileSync(join(outDir, 'phase-14-rest-ar.html'), html('ar'), 'utf8');
  assert.equal(html('en').includes('-8.00'), true);
  assert.equal(html('ar').includes('-8.00'), true);
  for (const banned of FORBIDDEN) {
    assert.equal(html('en').includes(banned), false, banned);
  }
});

test('selected-sales copy is simple EN/AR and does not expose internals', () => {
  const keys = [
    'ops.selectedSales',
    'ops.tendersCaption',
    'ops.allReceipts',
    'ops.receiptsIncluded',
    'ops.invoiceDateDetails',
    'ops.other',
  ];
  for (const key of keys) {
    assert.notEqual(darT('en', key), key);
    assert.notEqual(darT('ar', key), key);
    assert.notEqual(darT('en', key), darT('ar', key));
    assert.equal(/id bridge|date subset|buildTender|phase-0/i.test(darT('en', key)), false);
    assert.equal(/id bridge/i.test(darT('ar', key)), false);
  }
  assert.match(darT('en', 'ops.tendersCaption'), /incl\. VAT/i);
  assert.match(darT('ar', 'ops.tendersCaption'), /شامل الضريبة/);
});
