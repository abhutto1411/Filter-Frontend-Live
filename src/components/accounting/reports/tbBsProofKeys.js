/**
 * TB / BS proof-key map (RF-20-BE registry). Pure — no React.
 */

export const TB_TOTAL_DEBIT = 'tb.totalDebit';
export const TB_TOTAL_CREDIT = 'tb.totalCredit';
export const TB_DIFFERENCE = 'tb.difference';

export const BS_SECTION_PROOF_KEYS = {
  totalAssets: 'bs.totalAssets',
  totalLiabilities: 'bs.totalLiabilities',
  totalEquity: 'bs.totalEquity',
  currentYearEarnings: 'bs.currentYearEarnings',
  totalLiabilitiesAndEquity: 'bs.totalLiabilitiesAndEquity',
  difference: 'bs.difference',
};

export const BS_UNALLOCATED_PROOF_KEYS = {
  assets: 'bs.unallocated.assets',
  liabilities: 'bs.unallocated.liabilities',
  equity: 'bs.unallocated.equity',
};

function accountId(row) {
  if (row == null) return '';
  if (typeof row === 'string' || typeof row === 'number' || typeof row === 'bigint') {
    return String(row);
  }
  const id = row.id ?? row.accountId;
  return id == null || id === '' ? '' : String(id);
}

/** Opening / period Dr / period Cr / closing keys for one TB row (parent or leaf). */
export function tbRowProofKeys(row) {
  const id = accountId(row);
  if (!id) {
    return { opening: null, debit: null, credit: null, closing: null };
  }
  return {
    opening: `tb.opening:${id}`,
    debit: `tb.debit:${id}`,
    credit: `tb.credit:${id}`,
    closing: `tb.closing:${id}`,
  };
}

/** Footer / card keys. Period totals have registry keys; opening/closing footers do not. */
export function tbTotalsProofKeys() {
  return {
    totalOpeningDebit: null,
    totalOpeningCredit: null,
    totalPeriodDebit: TB_TOTAL_DEBIT,
    totalPeriodCredit: TB_TOTAL_CREDIT,
    totalClosingDebit: null,
    totalClosingCredit: null,
    totalDebits: TB_TOTAL_DEBIT,
    totalCredits: TB_TOTAL_CREDIT,
    difference: TB_DIFFERENCE,
  };
}

/**
 * Unallocated / HQ TB row — no `tb.unallocated.*` registry key.
 * Period + closing use totals with `column=unallocated`.
 */
export function tbUnallocatedProofKeys() {
  return {
    periodDebit: TB_TOTAL_DEBIT,
    periodCredit: TB_TOTAL_CREDIT,
    closingDebit: TB_TOTAL_DEBIT,
    closingCredit: TB_TOTAL_CREDIT,
  };
}

export function tbUnallocatedColumn() {
  return 'unallocated';
}

export function bsAccountProofKey(row) {
  const id = accountId(row);
  if (!id) return null;
  if (id === 'current-year-earnings' || id === 'currentYearEarnings') {
    return BS_SECTION_PROOF_KEYS.currentYearEarnings;
  }
  return `account:${id}`;
}

export function bsSectionProofKey(section) {
  return BS_SECTION_PROOF_KEYS[section] || null;
}

export function bsUnallocatedProofKey(field) {
  return BS_UNALLOCATED_PROOF_KEYS[field] || null;
}

/** Every amount cell a TB table would render for these rows. */
export function collectTbRenderedProofKeys(accounts = []) {
  const keys = [];
  for (const row of accounts) {
    const k = tbRowProofKeys(row);
    if (k.opening) keys.push(k.opening, k.debit, k.credit, k.closing);
  }
  keys.push(TB_TOTAL_DEBIT, TB_TOTAL_CREDIT, TB_DIFFERENCE);
  return keys;
}

/** Every amount cell a BS statement would render for these lines. */
export function collectBsRenderedProofKeys(report = {}) {
  const keys = [];
  const bags = [
    ...(report.assets?.current || []),
    ...(report.assets?.fixed || []),
    ...(report.assets?.other || []),
    ...(report.liabilities?.current || []),
    ...(report.liabilities?.longTerm || []),
    ...(report.liabilities?.other || []),
    ...(report.equity?.accounts || []),
  ];
  for (const row of bags) {
    const k = bsAccountProofKey(row);
    if (k) keys.push(k);
  }
  keys.push(
    BS_SECTION_PROOF_KEYS.totalAssets,
    BS_SECTION_PROOF_KEYS.totalLiabilities,
    BS_SECTION_PROOF_KEYS.totalEquity,
    BS_SECTION_PROOF_KEYS.totalLiabilitiesAndEquity,
    BS_SECTION_PROOF_KEYS.currentYearEarnings,
    BS_SECTION_PROOF_KEYS.difference,
    BS_UNALLOCATED_PROOF_KEYS.assets,
    BS_UNALLOCATED_PROOF_KEYS.liabilities,
    BS_UNALLOCATED_PROOF_KEYS.equity,
  );
  return keys;
}

/** Dashboard KPIs that map to a proof key (RF-20-FE-B §4). */
export const DASHBOARD_KPI_PROOF = {
  sales: { report: 'pl', key: 'pl.netRevenue' },
  income: { report: 'pl', key: 'pl.netRevenue' },
  netProfit: { report: 'pl', key: 'pl.netIncome' },
  grossMargin: { report: 'pl', key: 'pl.grossProfit' },
};
