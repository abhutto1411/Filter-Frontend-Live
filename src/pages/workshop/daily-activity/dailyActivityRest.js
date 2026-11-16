/**
 * Sessions / money / operations / technicians / coverage view models.
 * Format API strings only. Do not invert O/S, sum stock+money, or balance technicians.
 */

import { formatExactDecimal, formatMetricValue, isUnavailableMetric } from './dailyActivityFormat.js';
import { darT } from './dailyActivityI18n.js';

function pushMetric(into, m) {
  if (m && typeof m === 'object' && m.key && m.proof) into.push(m);
}

/** Exact API sign. No Number(), no inverse reconciliation. */
export function signedOsTone(metric) {
  if (!metric || isUnavailableMetric(metric) || metric.value == null) return 'unavailable';
  const raw = String(metric.value).trim().replace(/,/g, '');
  if (raw === '' || raw === '—') return 'unavailable';
  if (raw.startsWith('-')) return 'short';
  if (/^0+(\.0+)?$/.test(raw)) return 'balanced';
  return 'over';
}

/** Tag kind for signed cash O/S. Null/zero → no direction tag. */
export function osTagKind(metric) {
  const tone = signedOsTone(metric);
  if (tone === 'short' || tone === 'over') return tone;
  return null;
}

export function collectRestMetrics(report) {
  const metrics = [];
  const s = report?.sessions || {};
  const t = s.totals || {};
  ['closed', 'open', 'balanced', 'withVariance', 'cashOverShort', 'allMethodsOverShort'].forEach((k) =>
    pushMetric(metrics, t[k]),
  );
  for (const row of s.rows || []) {
    pushMetric(metrics, row.expected);
    pushMetric(metrics, row.counted);
    pushMetric(metrics, row.overShort);
    for (const method of row.methods || []) {
      pushMetric(metrics, method.expected);
      pushMetric(metrics, method.counted);
      pushMetric(metrics, method.overShort);
    }
  }
  const money = report?.money || {};
  pushMetric(metrics, money.petty?.total);
  pushMetric(metrics, money.petty?.entries);
  for (const p of money.petty?.byPurpose || []) {
    pushMetric(metrics, p.amount);
    pushMetric(metrics, p.entries);
  }
  pushMetric(metrics, money.nonCash?.net);
  pushMetric(metrics, money.nonCash?.vat);
  pushMetric(metrics, money.nonCash?.gross);
  pushMetric(metrics, money.nonCash?.entries);
  pushMetric(metrics, money.advances?.amount);
  pushMetric(metrics, money.advances?.entries);
  pushMetric(metrics, money.replenishment?.amount);
  pushMetric(metrics, money.replenishment?.entries);
  for (const p of money.purchases || []) {
    ['entries', 'net', 'vat', 'gross', 'paid', 'balance'].forEach((k) => pushMetric(metrics, p[k]));
  }
  for (const op of report?.operations || []) {
    pushMetric(metrics, op.entries);
    pushMetric(metrics, op.amount);
    for (const q of op.qtyByUom || []) pushMetric(metrics, q);
    for (const src of op.bySource || []) {
      pushMetric(metrics, src.amount);
      pushMetric(metrics, src.entries);
    }
  }
  const tech = report?.technicians || {};
  for (const row of tech.rows || []) {
    [
      'jobsCompleted',
      'assignmentsCompleted',
      'attributedRevenue',
      'commissionAttributed',
      'avgDurationHours',
      'avgRespondMinutes',
    ].forEach((k) => pushMetric(metrics, row[k]));
  }
  for (const m of Object.values(tech.totals || {})) pushMetric(metrics, m);
  for (const row of report?.coverage || []) {
    pushMetric(metrics, row.amount);
    pushMetric(metrics, row.entries);
  }
  for (const row of report?.reconciliation || []) pushMetric(metrics, row.difference);
  return metrics;
}

export function restDisplaysMatchApi(report) {
  const mismatches = [];
  for (const metric of collectRestMetrics(report)) {
    const shown = formatMetricValue(metric);
    const expected =
      metric.value == null || metric.status === 'unavailable'
        ? '—'
        : formatExactDecimal(metric.value, { kind: metric.kind || 'money' });
    if (shown !== expected) mismatches.push({ key: metric.key, shown, expected });
  }
  return mismatches;
}

export function sessionRows(report) {
  return Array.isArray(report?.sessions?.rows) ? report.sessions.rows : [];
}

export function moneyPurchases(report) {
  return Array.isArray(report?.money?.purchases) ? report.money.purchases : [];
}

export function operationRows(report) {
  return Array.isArray(report?.operations) ? report.operations : [];
}

export function technicianRows(report) {
  return Array.isArray(report?.technicians?.rows) ? report.technicians.rows : [];
}

export function coverageRows(report) {
  return Array.isArray(report?.coverage) ? report.coverage : [];
}

/** Owner-facing coverage copy. Does not relabel unavailable as complete. */
export function ownerCoverageCopy(row, locale = 'en') {
  const code = row?.code || '';
  const rawStatus = String(row?.status || '').toLowerCase();
  const statusKey = `cov.status.${rawStatus}`;
  const statusText = darT(locale, statusKey);
  const whyKey = `cov.why.${code}`;
  const mappedWhy = darT(locale, whyKey);
  const why =
    mappedWhy === whyKey ? darT(locale, 'cov.why.generic') : mappedWhy;
  return {
    code,
    label: locale === 'ar' ? row?.labelAr || row?.labelEn || code : row?.labelEn || row?.labelAr || code,
    status: statusText === statusKey ? row?.status || '' : statusText,
    rawStatus,
    why,
    technical: row?.reason || '',
  };
}
