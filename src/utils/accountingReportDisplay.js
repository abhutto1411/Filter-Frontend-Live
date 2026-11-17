/**
 * Pure helpers for TB / P&L / Balance Sheet report display (P-A5B).
 * Amounts from the API are already signed; do not recompute totals except
 * section OWN-amount sums (integer halalas).
 */

/** Display amount: headings use rolledAmount; leaves use own amount. */
export function bsLineDisplayAmount(row) {
  if (!row) return 0;
  if (row.isHeading) {
    const rolled = Number(row.rolledAmount);
    if (Number.isFinite(rolled)) return rolled;
  }
  return Number(row.amount || 0);
}

/** Section subtotal from OWN amounts only (never rolled headings). */
export function sumOwnAmounts(rows) {
  let halalas = 0;
  for (const row of rows || []) {
    const n = Number(row?.amount || 0);
    if (!Number.isFinite(n)) continue;
    halalas += Math.round(n * 100);
  }
  return halalas / 100;
}

export function isLegacyHeadingDirectRow(row) {
  if (!row) return false;
  const id = String(row.id || '');
  if (id.endsWith(':direct')) return true;
  return String(row.name || '') === 'Posted to heading (legacy)';
}

export function formatBooksStartDisplay(ymd) {
  const s = String(ymd || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export const BS_WARNING_BANNER_STYLE = {
  background: '#FEF3C7',
  color: '#92400E',
  padding: '10px 12px',
  borderRadius: 8,
  margin: '0 0 12px',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  maxWidth: '100%',
};

/**
 * Balanced badge copy from API fields (never recompute difference).
 * @returns {{ kind: 'balanced'|'out'|'branchNote'|'notApplicable', textKey: string, vars?: object }}
 */
export function balanceSheetBadge(report, { isBranchScoped = false } = {}) {
  if (!report) {
    return { kind: 'balanced', textKey: 'bs.badge.balanced' };
  }
  const warns = Array.isArray(report.warnings) ? report.warnings : [];
  if (warns.includes('bs.beforeBooksStart')) {
    return { kind: 'notApplicable', textKey: 'bs.badge.notApplicable' };
  }
  if (report.isBalanced) {
    return { kind: 'balanced', textKey: 'bs.badge.balanced' };
  }
  const diff = Number(report.difference || 0);
  const abs = Math.abs(diff);
  if (isBranchScoped) {
    return {
      kind: 'branchNote',
      textKey: 'bs.badge.branchNote',
      vars: { n: abs.toFixed(2) },
    };
  }
  return {
    kind: 'out',
    textKey: 'bs.badge.outOfBalance',
    vars: { n: abs.toFixed(2) },
  };
}

export function bsWarningMessages(report) {
  const date = formatBooksStartDisplay(report?.booksStartDate);
  const warns = Array.isArray(report?.warnings) ? report.warnings : [];
  const out = [];
  if (warns.includes('bs.beforeBooksStart')) {
    out.push({ key: 'bs.beforeBooksStart', vars: { date } });
  }
  if (warns.includes('bs.noOpeningBalance')) {
    out.push({ key: 'bs.noOpeningBalance', vars: { date } });
  }
  return out;
}

export function trialBalanceBadge(report) {
  if (!report || report.isBalanced) {
    return { kind: 'balanced', textKey: 'tb.balanced' };
  }
  return { kind: 'out', textKey: 'tb.unbalanced' };
}

/** Display-only P&L margin % (net / income). Returns null when income is 0. */
export function plMarginPercent(netIncome, income) {
  const inc = Number(income);
  const net = Number(netIncome);
  if (!Number.isFinite(inc) || inc === 0) return null;
  if (!Number.isFinite(net)) return null;
  return Math.round((net / inc) * 1000) / 10;
}

/** Count leaf vs heading rows (for summary cards; no amount math). */
export function countLeafAndHeading(rows) {
  let leaf = 0;
  let heading = 0;
  for (const row of rows || []) {
    if (row?.isHeading || row?.hasChildren) heading += 1;
    else leaf += 1;
  }
  return { leaf, heading, total: leaf + heading };
}

/** Client-side page slice (25 per page default). */
export function slicePage(rows, offset = 0, pageSize = 25) {
  const list = Array.isArray(rows) ? rows : [];
  const size = Math.max(1, Number(pageSize) || 25);
  const start = Math.max(0, Number(offset) || 0);
  return {
    rows: list.slice(start, start + size),
    total: list.length,
    offset: start,
    pageSize: size,
  };
}

/** P-A5T row fields shown by the Opening / Debit / Credit / Closing layout. */
export const TB_PERIOD_ROW_FIELDS = [
  'openingDebit',
  'openingCredit',
  'periodDebit',
  'periodCredit',
  'closingDebit',
  'closingCredit',
];

/** P-A5T report-level totals matching TB_PERIOD_ROW_FIELDS (server-computed). */
export const TB_PERIOD_TOTAL_FIELDS = [
  'totalOpeningDebit',
  'totalOpeningCredit',
  'totalPeriodDebit',
  'totalPeriodCredit',
  'totalClosingDebit',
  'totalClosingCredit',
];

/**
 * True when TB API rows expose all six P-A5T fields (single code path, decided
 * by field presence). Older backends (no fields) keep the legacy two columns.
 */
export function trialBalanceHasPeriodColumns(accounts) {
  const sample = (accounts || []).find((a) => a && typeof a === 'object');
  if (!sample) return false;
  return TB_PERIOD_ROW_FIELDS.every((f) => sample[f] != null);
}

/**
 * Report totals for the six period columns exactly as the server sent them
 * (no client maths). A missing total is `null` so the UI can show a dash.
 */
export function trialBalanceColumnTotals(report) {
  const out = {};
  for (const f of TB_PERIOD_TOTAL_FIELDS) {
    const v = report ? report[f] : null;
    out[f] = v == null || v === '' ? null : v;
  }
  return out;
}

/** Escape text for print HTML (no document.write of raw API strings). */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Print via a temporary iframe + srcdoc (no document.write).
 * @param {string} title
 * @param {string} bodyHtml already-escaped or trusted markup with escaped text nodes
 */
export function printReportHtml(title, bodyHtml) {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', String(title || 'print'));
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(
    title,
  )}</title><style>body{font-family:Poppins,sans-serif;margin:24px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;font-size:12px}.total{font-weight:700}@media print{body{margin:0}}</style></head><body>${bodyHtml}</body></html>`;
  iframe.srcdoc = doc;
  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(cleanup, 1000);
    }
  };
}

export function isReportRangeInvalidError(err) {
  if (!err) return false;
  if (String(err.code || '') === 'REPORT_RANGE_INVALID') return true;
  const msg = String(err.message || '');
  return msg.includes('REPORT_RANGE_INVALID');
}

/** Prisma / PG diagnostic text must never be shown as a business P&L error. */
export function isRawSqlDiagnosticMessage(message) {
  const msg = String(message || '');
  return /prisma|42883|operator does not exist|invalid.*query|raw query|pg_catalog/i.test(
    msg,
  );
}

export function newPlLoadCorrelation() {
  return `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Loading / error / verified-empty / data are mutually exclusive.
 * Returns a translated business message; correlation belongs in logs.
 */
export function sanitizePlLoadError(err, t, correlation) {
  if (isReportRangeInvalidError(err)) {
    return { message: t('pl.rangeInvalid'), correlation: correlation || null };
  }
  const raw = String(err?.message || '');
  const message = t('pl.loadFailed');
  return { message, correlation: correlation || null, diagnostic: raw };
}

export function plPageViewState({ loading, err, pl }) {
  if (loading) return 'loading';
  if (err) return 'error';
  if (!pl) return 'empty';
  return 'data';
}

/**
 * P&L revenue reconciliation display numbers from the API payload.
 * Revenue lines are already net of returns; totalRevenue is gross.
 * Section total "Revenue after returns" = sum of revenue line amounts (halalas).
 * Gross / returns / discounts / net come from server fields (not recomputed).
 *
 * @param {{
 *   revenue?: Array<{ amount?: number|string }>,
 *   totalRevenue?: number|string,
 *   salesReturns?: { amount?: number|string },
 *   discounts?: { amount?: number|string },
 *   discountsAmount?: number|string,
 *   netRevenue?: number|string,
 *   returnsVat?: { amount?: number|string },
 * }} pl
 */
export function plRevenueReconciliation(pl) {
  const revenue = Array.isArray(pl?.revenue) ? pl.revenue : [];
  let afterHalalas = 0;
  for (const row of revenue) {
    const n = Number(row?.amount || 0);
    if (!Number.isFinite(n)) continue;
    afterHalalas += Math.round(n * 100);
  }
  const revenueAfterReturns = afterHalalas / 100;
  const salesReturns = Number(pl?.salesReturns?.amount ?? 0);
  const discounts = Number(pl?.discounts?.amount ?? pl?.discountsAmount ?? 0);
  const grossSales = Number(pl?.totalRevenue ?? 0);
  const netRevenue =
    pl?.netRevenue != null && pl.netRevenue !== ''
      ? Number(pl.netRevenue)
      : Number((grossSales - salesReturns - discounts).toFixed(2));
  const returnsVat = Number(pl?.returnsVat?.amount ?? 0);
  return {
    revenueAfterReturns,
    salesReturns: Number.isFinite(salesReturns) ? salesReturns : 0,
    discounts: Number.isFinite(discounts) ? discounts : 0,
    grossSales: Number.isFinite(grossSales) ? grossSales : 0,
    netRevenue: Number.isFinite(netRevenue) ? netRevenue : 0,
    returnsVat: Number.isFinite(returnsVat) ? returnsVat : 0,
  };
}
