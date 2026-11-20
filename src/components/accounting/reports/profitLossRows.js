/**
 * Pure P&L view mappers (RF-14C). Numbers come from the API only.
 */

export function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** gp − opex + oi − oe + cashOverShort. Must equal API netIncome to the halala. */
export function simplePlStepsNet(pl) {
  const gp = Number(round2(pl?.grossProfit) ?? 0);
  const opex = Number(round2(pl?.totalOperatingExpenses) ?? 0);
  const oi = Number(round2(pl?.totalOtherIncome) ?? 0);
  const oe = Number(round2(pl?.totalOtherExpenses) ?? 0);
  const cash = Number(round2(pl?.cashOverShort?.net) ?? 0);
  return round2(gp - opex + oi - oe + cash);
}

/**
 * Adjustment so department lines + returns + discounts land on netRevenue,
 * including revenue posted outside 4000/4010.
 */
export function simplePlDeptAdjustment(pl) {
  const netSales = Number(round2(pl?.netRevenue) ?? 0);
  const returns = Math.abs(Number(round2(pl?.salesReturns?.amount) ?? 0));
  const discounts = Math.abs(Number(round2(pl?.discounts?.amount) ?? 0));
  const deptLinesTotal = round2(pl?.departmentBridge?.deptLinesTotal);
  if (deptLinesTotal == null) {
    return round2(pl?.departmentBridge?.invoiceAdjustments);
  }
  return round2(netSales + returns + discounts - deptLinesTotal);
}

export function money2Str(x) {
  const n = round2(x);
  return (n == null ? 0 : n).toFixed(2);
}

export function plExportRows(pl) {
  return [
    { section: 'revenue', amount: money2Str(pl?.netRevenue) },
    { section: 'salesReturns', amount: money2Str(pl?.salesReturns?.amount) },
    { section: 'discounts', amount: money2Str(pl?.discounts?.amount) },
    { section: 'cogs', amount: money2Str(pl?.totalCOGS) },
    { section: 'grossProfit', amount: money2Str(pl?.grossProfit) },
    { section: 'opex', amount: money2Str(pl?.totalOperatingExpenses) },
    { section: 'otherIncome', amount: money2Str(pl?.totalOtherIncome) },
    { section: 'otherExpenses', amount: money2Str(pl?.totalOtherExpenses) },
    { section: 'cashOverShort', amount: money2Str(pl?.cashOverShort?.net) },
    { section: 'netIncome', amount: money2Str(pl?.netIncome) },
  ];
}

function isNonZero(n) {
  const x = round2(n);
  return x != null && x !== 0;
}

function signed(n) {
  const x = round2(n);
  if (x == null) return null;
  return round2(-x);
}

/** Branch net + Unallocated/HQ net (simple sum of two API figures). */
export function sumBranchAndUnallocated(pl) {
  const branchNet = round2(pl?.netIncome);
  const unallocatedNet = round2(pl?.unallocated?.netIncome);
  if (branchNet == null || unallocatedNet == null) return null;
  return {
    branchNet,
    unallocatedNet,
    total: round2(branchNet + unallocatedNet),
  };
}

export function incVatAuditSequence(incVatView) {
  if (!incVatView || typeof incVatView !== 'object') return [];
  const v = incVatView;
  return [
    v.netRevenueExVat,
    v.outputVatOnSales,
    v.returnsVat,
    v.netOutputVat,
    v.netRevenueIncVat,
    v.cogsIncVat,
    v.grossProfitIncVat,
    v.netVatPayable,
  ].map((n) => Number(n));
}

export function showLegacyBackendHint(pl) {
  if (!pl || typeof pl !== 'object') return false;
  return pl.incVatView == null && pl.unallocated == null && pl.cashOverShort == null;
}

function sumLinesByBranch(lines, colKey) {
  if (!Array.isArray(lines)) return null;
  let any = false;
  let s = 0;
  for (const line of lines) {
    const raw = line?.amountsByBranch?.[colKey];
    if (raw == null) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    any = true;
    s += n;
  }
  return any ? round2(s) : null;
}

function bucketsHaveBranchAmounts(pl) {
  const buckets = [
    pl?.revenue,
    pl?.costOfGoodsSold,
    pl?.operatingExpenses,
    pl?.otherIncome,
    pl?.otherExpenses,
  ];
  return buckets.some(
    (lines) =>
      Array.isArray(lines) && lines.some((l) => l && l.amountsByBranch),
  );
}

function cashForColumn(pl, colKey, branchId) {
  const cos = pl?.cashOverShort;
  if (!cos || typeof cos !== 'object') return null;
  if (colKey === 'unallocated') return round2(cos.unallocatedNet);
  if (colKey === 'compareUnallocated') {
    return round2(pl?.comparison?.unallocated?.cashOverShortNet);
  }
  if (colKey === 'compare') return round2(pl?.comparison?.cashOverShort?.net);
  if (colKey === 'branch') {
    const by = cos.byBranch;
    if (by && branchId != null && by[String(branchId)] != null) {
      return round2(by[String(branchId)]);
    }
    return round2(cos.net);
  }
  if (colKey === 'total') return round2(cos.net);
  if (cos.byBranch && cos.byBranch[colKey] != null) {
    return round2(cos.byBranch[colKey]);
  }
  return null;
}

/** Backend proof-key registry (RF-20-BE) — one key per statement row. */
export const STATEMENT_ROW_PROOF_KEYS = {
  income: 'pl.netRevenue',
  cogs: 'pl.cogs',
  grossProfit: 'pl.grossProfit',
  opex: 'pl.opex',
  otherIncome: 'pl.otherIncome',
  cashOverShort: 'pl.cashOverShort',
  otherExpenses: 'pl.otherExpenses',
  netIncome: 'pl.netIncome',
};

const STATEMENT_COL_PROOF_KEYS = {
  income: {
    unallocated: 'pl.unallocated.revenue',
    compare: 'pl.comparison.netRevenue',
    compareUnallocated: 'pl.unallocated.revenue',
  },
  cogs: {
    unallocated: 'pl.unallocated.cogs',
    compare: 'pl.comparison.totalCOGS',
    compareUnallocated: 'pl.unallocated.cogs',
  },
  grossProfit: {
    unallocated: 'pl.unallocated.grossProfit',
    compare: 'pl.comparison.grossProfit',
    compareUnallocated: 'pl.unallocated.grossProfit',
  },
  opex: { compare: 'pl.comparison.totalOperatingExpenses' },
  otherIncome: { compare: 'pl.comparison.totalOtherIncome' },
  otherExpenses: { compare: 'pl.comparison.totalOtherExpenses' },
  netIncome: {
    unallocated: 'pl.unallocated.netIncome',
    compare: 'pl.comparison.netIncome',
    compareUnallocated: 'pl.unallocated.netIncome',
  },
};

const RECON_PROOF_KEYS = {
  revenueAfterReturns: 'pl.netRevenue',
  addBackSalesReturns: 'pl.salesReturns',
  grossSales: 'pl.revenue',
  lessDiscounts: null,
  netRevenue: 'pl.netRevenue',
  returnsVat: 'pl.incVat.returnsVat',
};

const INC_VAT_CELL_PROOF_KEYS = {
  grossSales: {
    exVat: 'pl.incVat.grossSalesExVat',
    vat: 'pl.incVat.outputVatOnSales',
    incVat: 'pl.incVat.grossSalesIncVat',
  },
  lessReturns: {
    exVat: 'pl.incVat.lessReturnsExVat',
    vat: 'pl.incVat.lessReturnsVat',
    incVat: 'pl.incVat.lessReturnsIncVat',
  },
  netRevenue: {
    exVat: 'pl.incVat.netRevenueExVat',
    vat: 'pl.incVat.netOutputVat',
    incVat: 'pl.incVat.netRevenueIncVat',
  },
  purchases: {
    exVat: 'purchases.period',
    vat: 'purchases.period',
    incVat: 'purchases.period',
  },
  cogs: {
    exVat: 'pl.incVat.cogsExVat',
    vat: 'pl.incVat.cogsVat',
    incVat: 'pl.incVat.cogsIncVat',
  },
  grossProfit: {
    exVat: 'pl.incVat.grossProfitExVat',
    vat: null,
    incVat: 'pl.incVat.grossProfitIncVat',
  },
  inputVat: {
    exVat: null,
    vat: 'pl.incVat.inputVatRecoverable',
    incVat: null,
  },
  netVatPayable: {
    exVat: null,
    vat: 'pl.incVat.netVatPayable',
    incVat: null,
  },
};

export function statementRowProofKey(rowKey) {
  return STATEMENT_ROW_PROOF_KEYS[rowKey] || null;
}

/** Proof key for one statement cell (compare / unallocated override the row key). */
export function statementCellProofKey(rowKey, colKey) {
  const overrides = STATEMENT_COL_PROOF_KEYS[rowKey] || {};
  if (colKey && overrides[colKey]) return overrides[colKey];
  return statementRowProofKey(rowKey);
}

function accountIdFromDetailKey(key) {
  const rest = String(key || '').split(':').slice(1).join(':');
  if (!rest) return null;
  if (/^\d+$/.test(rest) || /^[0-9a-f]{8}-[0-9a-f-]{19,}$/i.test(rest)) return rest;
  return null;
}

/** Attach `account:<id>` / `pl.netIncome` on collapsed account-detail rows. */
export function attachDetailProofKeys(model) {
  if (!model || !Array.isArray(model.rows)) return model;
  const rows = model.rows.map((row) => {
    if (row.kind === 'section') return { ...row, proofKey: null };
    if (row.kind === 'net') return { ...row, proofKey: 'pl.netIncome' };
    const id = accountIdFromDetailKey(row.key);
    return { ...row, proofKey: id ? `account:${id}` : null };
  });
  return { ...model, rows };
}

/**
 * K-2 summary statement. Unallocated GP is the API field, never subtracted here.
 */
export function buildPlStatementRows(
  pl,
  { branchSelected, branchId, compareMode } = {},
) {
  const p = pl && typeof pl === 'object' ? pl : {};
  const u = p.unallocated && typeof p.unallocated === 'object' ? p.unallocated : null;
  const cmp = p.comparison && typeof p.comparison === 'object' ? p.comparison : null;
  const showCompare = Boolean(compareMode && cmp);
  const showUnallocated = Boolean(branchSelected && u);
  const cmpU =
    showCompare && cmp.unallocated && typeof cmp.unallocated === 'object'
      ? cmp.unallocated
      : null;

  const columns = [];
  if (branchSelected) {
    columns.push({
      key: 'branch',
      nameKey: 'report.pl.col.branchId',
      headerKind: 'branch',
    });
    if (showCompare) {
      columns.push({
        key: 'compare',
        nameKey:
          compareMode === 'previous_year'
            ? 'report.pl.compare.previous_year'
            : 'report.pl.compare.previous_period',
      });
    }
    if (showUnallocated) {
      columns.push({ key: 'unallocated', nameKey: 'report.pl.col.unallocated' });
    }
    if (cmpU) {
      columns.push({
        key: 'compareUnallocated',
        nameKey: 'report.pl.col.unallocatedCompare',
      });
    }
  } else {
    const canSplit =
      Array.isArray(p.branchColumns) &&
      p.branchColumns.length > 0 &&
      bucketsHaveBranchAmounts(p);
    if (canSplit) {
      for (const c of p.branchColumns) {
        columns.push({
          key: String(c.key),
          headerKind: 'named',
          name: c.name || String(c.key),
        });
      }
    }
    columns.push({ key: 'total', nameKey: 'report.pl.col.total' });
    if (showCompare) {
      columns.push({
        key: 'compare',
        nameKey:
          compareMode === 'previous_year'
            ? 'report.pl.compare.previous_year'
            : 'report.pl.compare.previous_period',
      });
    }
  }

  const amountMap = (primary, unalloc, compareVal, compareUnalloc) => {
    const amounts = {};
    for (const col of columns) {
      if (col.key === 'branch' || col.key === 'total') amounts[col.key] = round2(primary);
      else if (col.key === 'unallocated') amounts[col.key] = round2(unalloc);
      else if (col.key === 'compare') amounts[col.key] = round2(compareVal);
      else if (col.key === 'compareUnallocated') amounts[col.key] = round2(compareUnalloc);
      else {
        amounts[col.key] = null;
      }
    }
    return amounts;
  };

  const fillBranchSplit = (amounts, bucketLines, netByBranch, kind) => {
    for (const col of columns) {
      if (col.key === 'total' || col.key === 'branch' || col.key === 'compare') continue;
      if (col.key === 'unallocated' || col.key === 'compareUnallocated') continue;
      if (kind === 'net' && netByBranch && netByBranch[col.key] != null) {
        amounts[col.key] = round2(netByBranch[col.key]);
      } else if (kind !== 'gross') {
        amounts[col.key] = sumLinesByBranch(bucketLines, col.key);
      }
    }
  };

  const otherExpPrimary = round2(p.totalOtherExpenses);
  const otherExpU = showUnallocated ? round2(u.otherExpenses) : null;
  const otherExpCmp = showCompare ? round2(cmp.totalOtherExpenses) : null;
  const showOtherExpenses =
    isNonZero(otherExpPrimary) || isNonZero(otherExpU) || isNonZero(otherExpCmp);

  const mk = (key, kind, labelKey, extra) => {
    const amounts = amountMap(
      extra.primary,
      extra.unalloc,
      extra.compare,
      extra.compareUnalloc,
    );
    fillBranchSplit(amounts, extra.lines, extra.netByBranch, extra.splitKind);
    return {
      key,
      kind,
      labelKey,
      leadKey: extra.leadKey,
      restKey: extra.restKey,
      label: extra.label,
      amounts,
      proofKey: extra.proofKey || statementRowProofKey(key),
    };
  };

  const rows = [
    mk('income', 'line', 'report.pl.row.income', {
      primary: p.netRevenue,
      unalloc: u?.revenue,
      compare: cmp?.netRevenue,
      compareUnalloc: cmpU?.revenue,
      lines: p.revenue,
      leadKey: 'report.pl.row.incomeLead',
      restKey: 'report.pl.row.incomeRest',
      label: 'Income (net revenue)',
      splitKind: 'line',
      proofKey: 'pl.netRevenue',
    }),
    mk('cogs', 'line', 'report.pl.row.cogs', {
      primary: p.totalCOGS,
      unalloc: u?.costOfGoodsSold,
      compare: cmp?.totalCOGS,
      compareUnalloc: cmpU?.costOfGoodsSold,
      lines: p.costOfGoodsSold,
      label: 'Cost of goods sold (5000, 7001)',
      splitKind: 'line',
      proofKey: 'pl.cogs',
    }),
    mk('grossProfit', 'emphasis', 'report.pl.row.grossProfit', {
      primary: p.grossProfit,
      unalloc: u?.grossProfit,
      compare: cmp?.grossProfit,
      compareUnalloc: cmpU?.grossProfit,
      label: 'Gross profit',
      splitKind: 'gross',
      proofKey: 'pl.grossProfit',
    }),
    mk('opex', 'line', 'report.pl.row.opex', {
      primary: p.totalOperatingExpenses,
      unalloc: u?.operatingExpenses,
      compare: cmp?.totalOperatingExpenses,
      compareUnalloc: cmpU?.operatingExpenses,
      lines: p.operatingExpenses,
      label: 'Operating expenses',
      splitKind: 'line',
      proofKey: 'pl.opex',
    }),
    mk('otherIncome', 'line', 'report.pl.row.otherIncome', {
      primary: p.totalOtherIncome,
      unalloc: u?.otherIncome,
      compare: cmp?.totalOtherIncome,
      compareUnalloc: cmpU?.otherIncome,
      lines: p.otherIncome,
      label: 'Other income',
      splitKind: 'line',
      proofKey: 'pl.otherIncome',
    }),
  ];

  if (showOtherExpenses) {
    rows.push(
      mk('otherExpenses', 'line', 'report.pl.row.otherExpenses', {
        primary: p.totalOtherExpenses,
        unalloc: u?.otherExpenses,
        compare: cmp?.totalOtherExpenses,
        compareUnalloc: cmpU?.otherExpenses,
        lines: p.otherExpenses,
        label: 'Other expenses',
        splitKind: 'line',
        proofKey: 'pl.otherExpenses',
      }),
    );
  }

  const cashAmounts = {};
  let cashAny = false;
  for (const col of columns) {
    const v = cashForColumn(p, col.key, branchId);
    cashAmounts[col.key] = v;
    if (isNonZero(v)) cashAny = true;
  }
  if (cashAny) {
    const net = round2(p.cashOverShort?.net);
    const direction =
      p.cashOverShort?.direction ||
      (net == null || Math.abs(net) < 0.005 ? 'balanced' : net > 0 ? 'over' : 'short');
    rows.push({
      key: 'cashOverShort',
      kind: 'line',
      labelKey: 'report.pl.row.cashCountDiff',
      label: 'Cash count difference (over/short)',
      amounts: cashAmounts,
      proofKey: 'pl.cashOverShort',
      direction,
      detailLines: Array.isArray(p.cashOverShort?.accounts)
        ? p.cashOverShort.accounts
        : [],
    });
  }

  rows.push(
    mk('netIncome', 'tot', 'report.pl.row.netIncome', {
      primary: p.netIncome,
      unalloc: u?.netIncome,
      compare: cmp?.netIncome,
      compareUnalloc: cmpU?.netIncome,
      netByBranch: p.netIncomeByBranch,
      label: 'Net income',
      splitKind: 'net',
      proofKey: 'pl.netIncome',
    }),
  );

  return { columns, rows, showUnallocated };
}

export function buildPlReconRows(pl) {
  if (!pl || typeof pl !== 'object') return [];
  const bridge = pl.documentBridge && typeof pl.documentBridge === 'object' && !pl.documentBridge.error
    ? pl.documentBridge
    : null;
  const postedReturns = pl.salesReturns?.amount;
  const postedDiscounts = pl.discounts?.amount;
  const rows = [
    {
      key: 'revenueAfterReturns',
      labelKey: 'pl.revenueAfterReturns',
      label: 'Revenue after returns',
      value: pl.netRevenue,
      proofKey: RECON_PROOF_KEYS.revenueAfterReturns,
    },
    {
      key: 'addBackSalesReturns',
      labelKey: 'pl.addBackSalesReturns',
      label: 'Add back sales returns',
      value: postedReturns,
      hide: pl.salesReturns == null && !bridge,
      noteKey: bridge ? 'pl.returnsPostedVsDocument' : null,
      noteVars: bridge
        ? {
            posted: round2(bridge.postedReturnsExVat) ?? 0,
            docs: round2(bridge.completedReturnsExVat) ?? 0,
            count: bridge.completedReturnsCount ?? 0,
            unposted: bridge.completedReturnsUnpostedCount ?? 0,
          }
        : null,
      proofKey: RECON_PROOF_KEYS.addBackSalesReturns,
    },
    {
      key: 'grossSales',
      labelKey: 'pl.grossSales',
      label: 'Gross sales',
      value: pl.totalRevenue,
      proofKey: RECON_PROOF_KEYS.grossSales,
    },
    {
      key: 'lessDiscounts',
      labelKey: 'pl.lessDiscounts',
      label: 'Less discounts',
      value: postedDiscounts,
      hide: pl.discounts == null && !bridge,
      noteKey: bridge ? 'pl.discountsGlVsDocument' : null,
      noteVars: bridge
        ? {
            gl: round2(bridge.postedDiscountsExVat) ?? 0,
            docs: round2(bridge.documentDiscountsExVat) ?? 0,
            line: round2(bridge.documentDiscountLine) ?? 0,
            invoice: round2(bridge.documentDiscountInvoice) ?? 0,
            promo: round2(bridge.documentDiscountPromo) ?? 0,
          }
        : null,
      proofKey: RECON_PROOF_KEYS.lessDiscounts,
    },
    {
      key: 'netRevenue',
      labelKey: 'pl.netRevenue',
      label: 'Net revenue',
      value: pl.netRevenue,
      tot: true,
      proofKey: RECON_PROOF_KEYS.netRevenue,
    },
    {
      key: 'returnsVat',
      labelKey: 'pl.returnsVat',
      label: 'Returns VAT (reversed on sales returns)',
      value: pl.returnsVat?.amount,
      hide: pl.returnsVat == null,
      proofKey: RECON_PROOF_KEYS.returnsVat,
    },
  ];
  return rows.filter((r) => !r.hide);
}

export function buildPlDocumentBridgeRows(pl) {
  const b = pl?.documentBridge;
  if (!b || typeof b !== 'object' || b.error || b.calendarGrossExVat == null) return [];
  return [
    {
      key: 'calendarGross',
      labelKey: 'pl.bridge.calendarGross',
      value: b.calendarGrossExVat,
      noteKey: 'pl.bridge.invoiceCount',
      noteVars: { n: b.calendarInvoiceCount ?? 0 },
    },
    {
      key: 'completedReturns',
      labelKey: 'pl.bridge.completedReturns',
      value: b.completedReturnsExVat,
      sign: '−',
      noteKey: 'pl.bridge.returnCount',
      noteVars: { n: b.completedReturnsCount ?? 0, unposted: b.completedReturnsUnpostedCount ?? 0 },
    },
    {
      key: 'documentNet',
      labelKey: 'pl.bridge.documentNet',
      value: b.documentNetExVat,
      tot: true,
    },
    {
      key: 'missingJournals',
      labelKey: 'pl.bridge.missingJournals',
      value: b.missingInvoiceJournalExVat,
      sign: '−',
      noteKey: 'pl.bridge.missingCount',
      noteVars: { n: b.missingInvoiceJournalCount ?? 0 },
    },
    {
      key: 'returnsNotInGl',
      labelKey: 'pl.bridge.returnsNotInGl',
      value: b.completedReturnsExVat,
      sign: '+',
    },
    {
      key: 'postedIncome',
      labelKey: 'pl.bridge.postedIncome',
      value: b.postedIncomeExVat,
      tot: true,
    },
    ...(b.issuedAtNetExVat != null
      ? [
          {
            key: 'issuedAtNet',
            labelKey: 'pl.bridge.issuedAtNet',
            value: b.issuedAtNetExVat,
            noteKey: 'pl.bridge.issuedAtClock',
          },
          {
            key: 'clockGap',
            labelKey: 'pl.bridge.clockGap',
            value: b.clockGapExVat,
            noteKey: 'pl.bridge.clockGapNote',
          },
        ]
      : []),
  ];
}

export function incVatDisplayRows(incVatView, pl) {
  if (!incVatView || typeof incVatView !== 'object') return [];
  const v = incVatView;
  const pct =
    v.purchaseInputVatRatePct != null && Number.isFinite(Number(v.purchaseInputVatRatePct))
      ? Number(v.purchaseInputVatRatePct).toFixed(2)
      : null;
  const window = v.purchaseRateWindow;
  const rows = [
    {
      key: 'grossSales',
      labelKey: 'pl.incVatView.row.grossSales',
      label: 'Gross sales',
      exVat: v.grossSalesExVat,
      vat: v.outputVatOnSales,
      incVat: v.grossSalesIncVat,
      proofKeys: INC_VAT_CELL_PROOF_KEYS.grossSales,
      proofKey: INC_VAT_CELL_PROOF_KEYS.grossSales.incVat,
    },
    {
      key: 'lessReturns',
      labelKey: 'pl.incVatView.row.lessReturns',
      label: 'Less sales returns',
      exVat: signed(v.lessReturnsExVat),
      vat: signed(v.lessReturnsVat),
      incVat: signed(v.lessReturnsIncVat),
      proofKeys: INC_VAT_CELL_PROOF_KEYS.lessReturns,
      proofKey: INC_VAT_CELL_PROOF_KEYS.lessReturns.incVat,
    },
    {
      key: 'netRevenue',
      labelKey: 'pl.incVatView.row.netRevenue',
      label: 'Net revenue',
      exVat: v.netRevenueExVat,
      vat: v.netOutputVat,
      vatNote: true,
      incVat: v.netRevenueIncVat,
      tot: true,
      proofKeys: INC_VAT_CELL_PROOF_KEYS.netRevenue,
      proofKey: INC_VAT_CELL_PROOF_KEYS.netRevenue.incVat,
    },
  ];
  const purch = pl?.purchasesInPeriod;
  if (purch && typeof purch === 'object') {
    rows.push({
      key: 'purchases',
      labelKey: 'pl.incVatView.row.purchases',
      label: 'Purchases in period (info)',
      exVat: purch.exVat,
      vat: purch.vat,
      incVat: purch.incVat,
      proofKeys: INC_VAT_CELL_PROOF_KEYS.purchases,
      proofKey: INC_VAT_CELL_PROOF_KEYS.purchases.incVat,
    });
  }
  let cogsLabelKey = 'pl.incVatView.row.cogsPeriod';
  if (window === 'trailing_12m') cogsLabelKey = 'pl.incVatView.row.cogsTrailing';
  if (window === 'flat_15') cogsLabelKey = 'pl.incVatView.row.cogsFlat';
  rows.push({
    key: 'cogs',
    labelKey: cogsLabelKey,
    label: `COGS (input VAT rate ${pct ?? ''}% of period purchases)`,
    pct,
    exVat: v.cogsExVat,
    vat: v.cogsVat,
    incVat: v.cogsIncVat,
    proofKeys: INC_VAT_CELL_PROOF_KEYS.cogs,
    proofKey: INC_VAT_CELL_PROOF_KEYS.cogs.incVat,
  });
  rows.push({
    key: 'grossProfit',
    labelKey: 'pl.incVatView.row.grossProfit',
    label: 'Gross profit',
    exVat: v.grossProfitExVat,
    vat: null,
    incVat: v.grossProfitIncVat,
    tot: true,
    proofKeys: INC_VAT_CELL_PROOF_KEYS.grossProfit,
    proofKey: INC_VAT_CELL_PROOF_KEYS.grossProfit.incVat,
  });
  rows.push({
    key: 'inputVat',
    labelKey: 'pl.incVatView.row.inputVat',
    label: 'Input VAT recoverable (1310)',
    exVat: null,
    vat: v.inputVatRecoverable,
    incVat: null,
    proofKeys: INC_VAT_CELL_PROOF_KEYS.inputVat,
    proofKey: INC_VAT_CELL_PROOF_KEYS.inputVat.vat,
  });
  rows.push({
    key: 'netVatPayable',
    labelKey: 'pl.incVatView.row.netVatPayable',
    label: 'Net VAT payable to ZATCA',
    exVat: null,
    vat: v.netVatPayable,
    incVat: null,
    tot: true,
    proofKeys: INC_VAT_CELL_PROOF_KEYS.netVatPayable,
    proofKey: INC_VAT_CELL_PROOF_KEYS.netVatPayable.vat,
  });
  return rows;
}

/**
 * When a branch is selected and `unallocated` is present, append the
 * Unallocated / HQ amount column. Amounts are matched by account code.
 */
export function withUnallocatedColumn(model, pl, { branchSelected, columnLabel }) {
  if (!branchSelected || !pl?.unallocated || !model) {
    return { ...model, showUnallocated: false };
  }
  const u = pl.unallocated;
  const byCode = new Map(
    (Array.isArray(u.lines) ? u.lines : []).map((line) => [
      String(line.code || ''),
      Number(line.amount),
    ]),
  );
  const col = { key: '__unallocated', name: columnLabel || 'Unallocated / HQ' };
  const columns = [...(model.columns || []), col];
  const rows = (model.rows || []).map((row) => {
    if (row.kind === 'section') {
      return { ...row, amounts: { ...(row.amounts || {}), __unallocated: null } };
    }
    if (row.kind === 'net') {
      return {
        ...row,
        amounts: { ...(row.amounts || {}), __unallocated: Number(u.netIncome) },
      };
    }
    const code = row.code ? String(row.code) : '';
    const amt = code && byCode.has(code) ? byCode.get(code) : null;
    return { ...row, amounts: { ...(row.amounts || {}), __unallocated: amt } };
  });
  return { ...model, columns, rows, showUnallocated: true };
}
