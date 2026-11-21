/**
 * Pure helpers for VAT return mockup 11 (P-A26B).
 * Money from API only — halala integer sums when deriving card totals from row list.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function formatVatLatn(value, { fractionDigits = 2 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    numberingSystem: 'latn',
  }).format(n);
}

export function formatVatSar(value) {
  const body = formatVatLatn(value);
  return body === '—' ? body : `SAR ${body}`;
}

/** List recent quarters as YYYY-Qn for the combo (current year ±1). */
export function listVatQuarterOptions(asOfYmd) {
  const s = String(asOfYmd || '').slice(0, 10);
  const base = YMD.test(s) ? s : new Date().toISOString().slice(0, 10);
  const year = Number(base.slice(0, 4));
  const month = Number(base.slice(5, 7));
  const currentQ = Math.ceil(month / 3);
  const opts = [];
  for (let y = year + 1; y >= year - 1; y--) {
    for (let q = 4; q >= 1; q--) {
      if (y > year || (y === year && q > currentQ)) continue;
      const startM = (q - 1) * 3 + 1;
      const endM = startM + 2;
      const names = [
        'Jan–Mar',
        'Apr–Jun',
        'Jul–Sep',
        'Oct–Dec',
      ];
      opts.push({
        value: `${y}-Q${q}`,
        label: `Q${q} ${y} (${names[q - 1]})`,
        fromYmd: `${y}-${String(startM).padStart(2, '0')}-01`,
        toYmd: lastDayOfMonthYmd(y, endM),
      });
    }
  }
  return opts;
}

function lastDayOfMonthYmd(year, month1to12) {
  const last = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function defaultVatQuarterValue(asOfYmd) {
  const s = String(asOfYmd || '').slice(0, 10);
  const base = YMD.test(s) ? s : new Date().toISOString().slice(0, 10);
  const year = Number(base.slice(0, 4));
  const month = Number(base.slice(5, 7)) || 1;
  const currentQ = Math.ceil(month / 3);
  return `${year}-Q${currentQ}`;
}

function halalaSum(nums) {
  let h = 0;
  for (const n of nums) {
    const v = Number(n);
    if (!Number.isFinite(v)) continue;
    h += Math.round(v * 100);
  }
  return h / 100;
}

/**
 * Build cards + summary box rows from optional vat-return summary and/or legacy vat rows.
 * @returns {{
 *   cards: { outputVat: number|null, inputVat: number|null, netPayable: number|null, billsWithoutVatNo: number|null },
 *   boxes: Array<{ box: string, descriptionKey: string, amount: number|null, vat: number|null, optional?: boolean, isTotal?: boolean }>,
 *   source: 'vat-return'|'rows'|'mixed'|'empty',
 *   boxMappingNote: boolean,
 *   glTieOut: null|{ outputCode: string, inputCode: string }
 * }}
 */
export function buildVatReturnViewModel({ summary, rowReport } = {}) {
  const rows = Array.isArray(rowReport?.rows) ? rowReport.rows : [];
  const totals = rowReport?.totals || null;

  let outputVat = null;
  let inputVat = null;
  let netPayable = null;
  let billsWithoutVatNo = null;
  let source = 'empty';
  let boxMappingNote = true;

  if (summary && typeof summary === 'object') {
    if (summary.outputVat != null) outputVat = Number(summary.outputVat);
    if (summary.inputVat != null) inputVat = Number(summary.inputVat);
    if (summary.netPayable != null) netPayable = Number(summary.netPayable);
    else if (outputVat != null && inputVat != null) {
      netPayable = Number((outputVat - inputVat).toFixed(2));
    }
    if (summary.billsWithoutVatNo != null) {
      billsWithoutVatNo = Number(summary.billsWithoutVatNo);
    } else if (summary.billsWithoutVatNumber != null) {
      billsWithoutVatNo = Number(summary.billsWithoutVatNumber);
    }
    source = 'vat-return';
  }

  if (totals) {
    if (outputVat == null && totals.totalVatOutput != null) {
      outputVat = Number(totals.totalVatOutput);
      source = source === 'vat-return' ? 'mixed' : 'rows';
    }
    if (inputVat == null && totals.totalVatInput != null) {
      inputVat = Number(totals.totalVatInput);
      source = source === 'vat-return' ? 'mixed' : 'rows';
    }
    if (netPayable == null) {
      if (totals.payableToZatca != null) netPayable = Number(totals.payableToZatca);
      else if (totals.periodNetChange != null) netPayable = Number(totals.periodNetChange);
      else if (outputVat != null && inputVat != null) {
        netPayable = Number((outputVat - inputVat).toFixed(2));
      }
    }
  } else if (rows.length && outputVat == null) {
    outputVat = halalaSum(rows.map((r) => r.vatOutput));
    inputVat = halalaSum(rows.map((r) => r.vatInput));
    netPayable = Number((outputVat - inputVat).toFixed(2));
    source = 'rows';
  }

  const saleAmount =
    totals?.totalSaleInclVat != null
      ? Number(totals.totalSaleInclVat)
      : rows.length
        ? halalaSum(rows.map((r) => r.saleInclVat))
        : null;
  const purchaseAmount =
    totals?.totalPurchaseInclVat != null
      ? Number(totals.totalPurchaseInclVat)
      : rows.length
        ? halalaSum(rows.map((r) => r.purchaseInclVat))
        : null;

  const boxes = [
    {
      box: '1',
      descriptionKey: 'vatReturn.box.sales',
      amount: saleAmount,
      vat: outputVat,
    },
    {
      box: '7',
      descriptionKey: 'vatReturn.box.purchases',
      amount: purchaseAmount,
      vat: inputVat,
    },
    {
      box: '—',
      descriptionKey: 'vatReturn.box.purchasesNoVat',
      amount:
        summary?.purchasesWithoutVatAmount != null
          ? Number(summary.purchasesWithoutVatAmount)
          : null,
      vat: 0,
      optional: true,
    },
    {
      box: '',
      descriptionKey: 'vatReturn.box.netDue',
      amount: null,
      vat: netPayable,
      isTotal: true,
    },
  ];

  // True box mapping from API would set boxes[] — until then keep derived note.
  if (Array.isArray(summary?.boxes) && summary.boxes.length) {
    boxMappingNote = false;
  }

  const glTieOut =
    summary?.accounts?.outputVat?.code || summary?.accounts?.inputVat?.code
      ? {
          outputCode: String(summary.accounts?.outputVat?.code || '2100'),
          inputCode: String(summary.accounts?.inputVat?.code || '1310'),
        }
      : rowReport?.vatPayableAccount
        ? {
            outputCode: String(rowReport.vatPayableAccount.code || '2100'),
            inputCode: '1310',
          }
        : null;

  return {
    cards: {
      outputVat,
      inputVat,
      netPayable,
      billsWithoutVatNo,
    },
    boxes,
    source,
    boxMappingNote,
    glTieOut,
  };
}

/** Split detail rows into output vs input for tabs. */
export function splitVatDetailRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    output: list.filter((r) => Number(r?.vatOutput || 0) !== 0 || Number(r?.saleInclVat || 0) !== 0),
    input: list.filter(
      (r) => Number(r?.vatInput || 0) !== 0 || Number(r?.purchaseInclVat || 0) !== 0,
    ),
  };
}
