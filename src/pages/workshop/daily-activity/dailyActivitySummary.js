/**
 * KPI + Accumulated Summary view models. Format API strings only.
 * Never add/subtract/VAT/Net. Do not invent department or deduction rows.
 */

import { darT } from './dailyActivityI18n.js';
import {
  formatExactDecimal,
  formatMetricValue,
  isUnavailableMetric,
  wrapProofHref,
} from './dailyActivityFormat.js';
import { safeDarReturnHash } from './dailyActivityProof.js';

/** Contract / BE builder order. Missing codes are omitted, not invented. */
export const DAR_V6_DEDUCTION_ORDER = [
  'purchase_invoices',
  'non_cash',
  'petty',
  'other_purchases',
  'other_expenses',
  'commissions_due',
  'advances',
  'other_external_outflows',
];

export function pickLocalized(row, locale, enKey = 'labelEn', arKey = 'labelAr') {
  if (!row) return '';
  if (locale === 'ar') return row[arKey] || row[enKey] || row.label || '';
  return row[enKey] || row[arKey] || row.label || '';
}

export function proofFallbackFromReport(report, returnTab = 'depts') {
  const tab = safeDarReturnHash(returnTab) || 'depts';
  return {
    snapshotToken: report?.meta?.snapshotToken,
    sourceFingerprint: report?.meta?.sourceFingerprint,
    asOf: report?.meta?.asOf,
    from: report?.meta?.from,
    to: report?.meta?.to,
    branchIds: report?.meta?.selectedBranchIds || [],
    sessionIds: report?.meta?.selectedSessionIds || [],
    actorSource: report?.filters?.actorSource || 'all',
    returnTab: tab,
  };
}

export function orderDeductions(deductions) {
  const list = Array.isArray(deductions) ? deductions.filter((d) => d && d.code) : [];
  const rank = new Map(DAR_V6_DEDUCTION_ORDER.map((code, i) => [code, i]));
  return [...list].sort((a, b) => {
    const ia = rank.has(a.code) ? rank.get(a.code) : 1000;
    const ib = rank.has(b.code) ? rank.get(b.code) : 1000;
    if (ia !== ib) return ia - ib;
    return String(a.code).localeCompare(String(b.code));
  });
}

function card(id, label, metric, hint) {
  return {
    id,
    label,
    metric: metric || null,
    display: formatMetricValue(metric),
    unavailable: isUnavailableMetric(metric),
    reason: metric?.reason || null,
    href: metric ? wrapProofHref(metric) : '',
    hint: hint || null,
    scope: metric?.scope || null,
  };
}

export function buildKpiCards(report, locale = 'en') {
  const t = (k) => darT(locale, k);
  const k = report?.kpis || {};
  return [
    card('salesEx', t('kpi.salesEx'), k.sales?.exVat, t('kpi.salesExHint')),
    card('jobs', t('kpi.jobs'), k.jobsCompleted, t('kpi.jobsHint')),
    card('discounts', t('kpi.discounts'), k.discounts, t('kpi.discountsHint')),
    card('cashOs', t('kpi.cashOs'), k.cashOverShort, t('kpi.cashOsHint')),
    card('petty', t('kpi.petty'), k.petty, t('kpi.pettyHint')),
    card('purchases', t('kpi.purchases'), k.purchases, t('kpi.purchasesHint')),
  ];
}

export function buildSummaryView(report, locale = 'en') {
  const t = (k) => darT(locale, k);
  const s = report?.summary || {};
  const departments = Array.isArray(s.byDepartment) ? s.byDepartment : [];
  const deductions = orderDeductions(s.deductions);
  const exclusions = Array.isArray(s.exclusions) ? s.exclusions : [];
  const reasons = Array.isArray(s.completeness?.reasons) ? s.completeness.reasons : [];
  return {
    departments: departments.map((row) => ({
      id: String(row.id),
      label: pickLocalized(row, locale),
      exVat: row.sales?.exVat || null,
      inclVat: row.sales?.inclVat || null,
    })),
    salesTotal: {
      exVat: s.salesTotal?.exVat || null,
      vat: s.salesTotal?.vat || null,
      inclVat: s.salesTotal?.inclVat || null,
    },
    deductions: deductions.map((d) => ({
      code: d.code,
      label: pickLocalized(d, locale),
      payableNote: d.code === 'commissions_due' ? t('summary.payablePeriod') : null,
      amount: d.amount || null,
      entries: d.entries || null,
    })),
    knownDeductions: s.knownDeductions || null,
    remainderBeforeUnknowns: s.remainderBeforeUnknowns || null,
    net: s.net || null,
    netIsUnavailable: isUnavailableMetric(s.net),
    exclusions: exclusions.map((ex) => ({
      code: ex.code,
      label: pickLocalized(ex, locale),
      amount: ex.amount || null,
      entries: ex.entries || null,
    })),
    completenessComplete: Boolean(s.completeness?.complete),
    completenessReasons: reasons,
    formula: t('summary.formula'),
    residual: t('summary.residual'),
    remainderNotNet: t('summary.remainderNotNet'),
    purchasesNotCash: t('summary.purchasesNotCash'),
  };
}

/** Every numerical Metric the KPI + summary sections must link. */
export function collectSummaryMetrics(report) {
  const metrics = [];
  const push = (m) => {
    if (m && typeof m === 'object' && m.key && m.proof) metrics.push(m);
  };
  const k = report?.kpis || {};
  push(k.sales?.exVat);
  push(k.sales?.vat);
  push(k.sales?.inclVat);
  push(k.jobsCompleted);
  push(k.discounts);
  push(k.cashOverShort);
  push(k.petty);
  push(k.purchases);
  const s = report?.summary || {};
  for (const row of s.byDepartment || []) {
    push(row.sales?.exVat);
    push(row.sales?.vat);
    push(row.sales?.inclVat);
  }
  push(s.salesTotal?.exVat);
  push(s.salesTotal?.vat);
  push(s.salesTotal?.inclVat);
  for (const d of s.deductions || []) {
    push(d.amount);
    push(d.entries);
  }
  push(s.knownDeductions);
  push(s.remainderBeforeUnknowns);
  push(s.net);
  for (const ex of s.exclusions || []) {
    push(ex.amount);
    push(ex.entries);
  }
  for (const row of report?.coverage || []) {
    push(row.amount);
    push(row.entries);
  }
  return metrics;
}

export function metricDisplaysMatchApi(report) {
  const mismatches = [];
  for (const metric of collectSummaryMetrics(report)) {
    const shown = formatMetricValue(metric);
    const expected =
      metric.value == null || metric.status === 'unavailable'
        ? '—'
        : formatExactDecimal(metric.value, { kind: metric.kind || 'money' });
    if (shown !== expected) {
      mismatches.push({ key: metric.key, shown, expected });
    }
  }
  return mismatches;
}
