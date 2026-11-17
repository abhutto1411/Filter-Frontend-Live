/**
 * Pure helpers for P&L mockup 08 (P-A17B): branch columns + basis display.
 * Money values come from the API — format only; no client re-totals of money
 * except integer-halala display sums when the API omits a combined cell.
 */

/** Western digits always (latn), even when UI locale is ar. */
export function formatAccountingNumber(value, { fractionDigits = 2 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    numberingSystem: 'latn',
  }).format(n);
}

export function formatSarLatn(value) {
  const body = formatAccountingNumber(value, { fractionDigits: 2 });
  if (body === '—') return body;
  return `SAR ${body}`;
}

/**
 * @param {object|null|undefined} pl — GET /accounts/reports/pl payload
 * @param {{
 *   showCombined?: boolean,
 *   unassignedLabel?: string,
 *   combinedLabel?: string,
 *   incomeLabel?: string,
 *   expensesLabel?: string,
 *   netProfitLabel?: string,
 *   cashCountDiffLabel?: string,
 * }} opts
 */
export function buildPlBranchTableModel(pl, opts = {}) {
  const showCombined = opts.showCombined !== false;
  const unassignedLabel = opts.unassignedLabel || 'Unassigned branch';
  const combinedLabel = opts.combinedLabel || 'Combined';
  const incomeLabel = opts.incomeLabel || 'Income';
  const expensesLabel = opts.expensesLabel || 'Expenses';
  const netProfitLabel = opts.netProfitLabel || 'Net profit';
  const cashCountDiffLabel = opts.cashCountDiffLabel || '';

  const hasBreakdown =
    pl?.breakdown === 'branch' && Array.isArray(pl?.branchColumns);

  const branchColumns = hasBreakdown
    ? pl.branchColumns
        .map((c) => ({
          key: String(c.key),
          name:
            c.key === 'unassigned' || c.branchId == null
              ? unassignedLabel
              : String(c.name || c.key),
        }))
        .filter((c) => {
          // Hide Unassigned when all amounts for that key are zero across lines.
          if (c.key !== 'unassigned' && c.key !== 'null') return true;
          return branchKeyHasNonZero(pl, c.key);
        })
    : [];

  const columns = [
    ...branchColumns,
    ...(showCombined || !hasBreakdown
      ? [{ key: '__combined', name: combinedLabel }]
      : []),
  ];

  const rows = [];

  const pushSection = (label) => {
    rows.push({
      kind: 'section',
      key: `sec:${label}`,
      label,
      amounts: Object.fromEntries(columns.map((c) => [c.key, null])),
    });
  };

  const pushLine = (line, prefix) => {
    if (!line) return;
    const amounts = {};
    for (const col of columns) {
      if (col.key === '__combined') {
        amounts[col.key] = Number(line.amount ?? 0);
      } else {
        const by = line.amountsByBranch || {};
        amounts[col.key] =
          by[col.key] != null ? Number(by[col.key]) : null;
      }
    }
    rows.push({
      kind: 'line',
      key: `${prefix}:${line.id || line.code || line.name}`,
      label: line.name || line.code || '—',
      code: line.code || '',
      amounts,
    });
  };

  pushSection(incomeLabel);
  for (const line of pl?.revenue || []) pushLine(line, 'rev');
  for (const line of pl?.otherIncome || []) pushLine(line, 'oi');

  pushSection(expensesLabel);
  for (const line of pl?.costOfGoodsSold || []) pushLine(line, 'cogs');
  for (const line of pl?.operatingExpenses || []) pushLine(line, 'opex');
  for (const line of pl?.otherExpenses || []) pushLine(line, 'oe');
  if (pl?.cashOverShort && typeof pl.cashOverShort === 'object') {
    pushLine(
      {
        id: 'cashOverShort',
        name: cashCountDiffLabel || 'report.pl.row.cashCountDiff',
        amount: pl.cashOverShort.net,
        amountsByBranch: pl.cashOverShort.byBranch || {},
      },
      'cash',
    );
  }

  const netAmounts = {};
  for (const col of columns) {
    if (col.key === '__combined') {
      netAmounts[col.key] = Number(pl?.netIncome ?? 0);
    } else {
      const by = pl?.netIncomeByBranch || {};
      netAmounts[col.key] =
        by[col.key] != null ? Number(by[col.key]) : null;
    }
  }
  rows.push({
    kind: 'net',
    key: 'net',
    label: netProfitLabel,
    amounts: netAmounts,
  });

  const income = Number(pl?.netRevenue ?? pl?.totalRevenue ?? 0);
  const expenses = Number(
    (
      Number(pl?.totalCOGS || 0) +
      Number(pl?.totalOperatingExpenses || 0) +
      Number(pl?.totalOtherExpenses || 0)
    ).toFixed(2),
  );
  const cashOverShort = Number(pl?.cashOverShort?.net ?? 0);
  const otherIncome = Number(pl?.totalOtherIncome ?? 0);
  const net = Number(pl?.netIncome ?? 0);
  const margin =
    income !== 0 && Number.isFinite(income)
      ? Number(((net / income) * 100).toFixed(1))
      : null;

  return {
    hasBreakdown: Boolean(hasBreakdown),
    columns,
    rows,
    cards: { income, expenses, otherIncome, cashOverShort, net, margin },
    basis: pl?.basis || null,
    basisNote: typeof pl?.basisNote === 'string' ? pl.basisNote : '',
    basisWarnings: Array.isArray(pl?.basisWarnings) ? pl.basisWarnings : [],
  };
}

function branchKeyHasNonZero(pl, key) {
  const bags = [
    ...(pl?.revenue || []),
    ...(pl?.otherIncome || []),
    ...(pl?.costOfGoodsSold || []),
    ...(pl?.operatingExpenses || []),
    ...(pl?.otherExpenses || []),
  ];
  for (const line of bags) {
    const v = Number(line?.amountsByBranch?.[key] ?? 0);
    if (Math.abs(v) >= 0.005) return true;
  }
  const net = Number(pl?.netIncomeByBranch?.[key] ?? 0);
  return Math.abs(net) >= 0.005;
}
