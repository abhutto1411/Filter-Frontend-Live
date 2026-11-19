/**
 * Department detail view models. Format API strings only.
 * Do not regex-classify, rank, sum Top5, or compute Black Oil / margin.
 */

import { pickLocalized, proofFallbackFromReport } from './dailyActivitySummary.js';
import {
  formatExactDecimal,
  formatMetricValue,
} from './dailyActivityFormat.js';

export function formatQtyMetric(metric) {
  const shown = formatMetricValue(metric);
  const unit = metric?.unit && metric.unit !== 'count' && metric.unit !== 'SAR' ? metric.unit : '';
  if (shown === '—' || !unit) return shown;
  return `${shown} ${unit}`;
}

export function qtyFragments(measures) {
  const list = Array.isArray(measures?.qtyByUom) ? measures.qtyByUom : [];
  return list.map((m) => ({
    metric: m,
    display: formatQtyMetric(m),
  }));
}

function collectMeasures(measures, into) {
  if (!measures) return;
  for (const q of measures.qtyByUom || []) into.push(q);
  if (measures.revenue) {
    into.push(measures.revenue.exVat, measures.revenue.vat, measures.revenue.inclVat);
  }
  into.push(measures.cost, measures.marginAmount, measures.marginPct);
}

export function collectDepartmentMetrics(report) {
  const metrics = [];
  const push = (m) => {
    if (m && typeof m === 'object' && m.key && m.proof) metrics.push(m);
  };
  const walkMeasures = (measures) => {
    const bag = [];
    collectMeasures(measures, bag);
    bag.forEach(push);
  };
  for (const dept of report?.departments || []) {
    push(dept.totals?.jobsOpened);
    push(dept.totals?.jobsCompleted);
    push(dept.totals?.jobsInProgress);
    push(dept.totals?.jobsCancelled);
    walkMeasures(dept.totals?.measures);
    walkMeasures(dept.products?.totals);
    for (const bucket of dept.products?.buckets || []) {
      walkMeasures(bucket.measures);
      for (const grade of bucket.grades || []) walkMeasures(grade.measures);
    }
    for (const row of dept.products?.top5 || []) walkMeasures(row.measures);
    walkMeasures(dept.services?.totals);
    for (const group of dept.services?.groups || []) {
      walkMeasures(group.measures);
      for (const row of group.top5 || []) walkMeasures(row.measures);
    }
    walkMeasures(dept.unallocated);
    if (dept.blackOilBridge) {
      push(dept.blackOilBridge.excluding);
      push(dept.blackOilBridge.blackOil);
      push(dept.blackOilBridge.including);
    }
  }
  for (const row of report?.reconciliation || []) push(row.difference);
  return metrics;
}

export function departmentDisplaysMatchApi(report) {
  const mismatches = [];
  for (const metric of collectDepartmentMetrics(report)) {
    const shown = formatMetricValue(metric);
    const expected =
      metric.value == null || metric.status === 'unavailable'
        ? '—'
        : formatExactDecimal(metric.value, { kind: metric.kind || 'money' });
    if (shown !== expected) mismatches.push({ key: metric.key, shown, expected });
  }
  return mismatches;
}

export function compareDepartmentsByRevenue(a, b) {
  const cents = (metric) => {
    if (!metric || metric.value == null) return null;
    const raw = String(metric.value).trim();
    if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
    const neg = raw.startsWith('-');
    const [whole, frac = ''] = raw.replace('-', '').split('.');
    const padded = (frac + '00').slice(0, 2);
    const value = BigInt(whole || '0') * 100n + BigInt(padded);
    return neg ? -value : value;
  };
  const av = cents(a?.totals?.measures?.revenue?.exVat);
  const bv = cents(b?.totals?.measures?.revenue?.exVat);
  if (av == null && bv == null) {
    const aid = String(a?.id ?? '');
    const bid = String(b?.id ?? '');
    return aid < bid ? -1 : aid > bid ? 1 : 0;
  }
  if (av == null) return 1;
  if (bv == null) return -1;
  if (av !== bv) return av > bv ? -1 : 1;
  const aid = String(a?.id ?? '');
  const bid = String(b?.id ?? '');
  return aid < bid ? -1 : aid > bid ? 1 : 0;
}

export function buildDepartmentViews(report, locale = 'en') {
  const list = Array.isArray(report?.departments) ? report.departments : [];
  const ordered = [...list].sort(compareDepartmentsByRevenue);
  return ordered.map((dept, index) => ({
    id: String(dept.id),
    index,
    label: pickLocalized(dept, locale),
    totals: dept.totals || {},
    productCostCoverage: dept.productCostCoverage || null,
    products: {
      totals: dept.products?.totals || null,
      buckets: Array.isArray(dept.products?.buckets) ? dept.products.buckets : [],
      top5: Array.isArray(dept.products?.top5) ? dept.products.top5 : [],
      top5Coverage: dept.products?.top5Coverage || null,
    },
    services: {
      totals: dept.services?.totals || null,
      groups: Array.isArray(dept.services?.groups) ? dept.services.groups : [],
    },
    unallocated: dept.unallocated || null,
    blackOilBridge: dept.blackOilBridge || null,
  }));
}

export function formatTop5CoverageNote(coverage, locale, t) {
  if (!coverage) return '';
  const sold = coverage.soldItemCount ?? 0;
  const shown = coverage.shownCount ?? 0;
  if (!coverage.truncated) {
    return t('dept.top5Complete').replace('{sold}', String(sold));
  }
  return t('dept.top5Remainder')
    .replace('{shown}', String(shown))
    .replace('{sold}', String(sold))
    .replace('{shownAmt}', formatMetricValue(coverage.shownExVat))
    .replace('{remainAmt}', formatMetricValue(coverage.remainderExVat))
    .replace('{remainCount}', String(coverage.remainderItemCount ?? 0));
}

export function buildReconciliationNotes(report) {
  return (report?.reconciliation || []).filter((row) => row && row.code);
}

export { proofFallbackFromReport };
