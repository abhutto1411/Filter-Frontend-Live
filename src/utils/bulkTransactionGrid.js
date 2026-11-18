/**
 * P-A18B — pure helpers for the bulk transactions grid (mockup 28).
 * Money: decimal strings / integer-halala display sums only.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function money2str(n) {
  if (n == null || n === '') return '0.00';
  const num = Number(String(n).replace(/,/g, ''));
  if (!Number.isFinite(num)) return '0.00';
  return (Math.round(num * 100) / 100).toFixed(2);
}

export function parseMoneyToHalalas(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function formatHalalas(h) {
  const n = Number(h) || 0;
  const sign = n < 0 ? '-' : '';
  return `${sign}${(Math.abs(n) / 100).toFixed(2)}`;
}

/** Inclusive S15: net = round2(gross/1.15), vat = gross − net (workshop rate default 15). */
export function splitInclusiveVat(grossRaw, vatPercent = 15) {
  const grossH = parseMoneyToHalalas(grossRaw);
  if (grossH == null || grossH <= 0) {
    return { net: '0.00', vat: '0.00', gross: '0.00' };
  }
  const r = Number(vatPercent) || 15;
  const gross = grossH / 100;
  if (r <= 0) {
    return { net: money2str(gross), vat: '0.00', gross: money2str(gross) };
  }
  const net = Math.round((gross / (1 + r / 100)) * 100) / 100;
  const vat = Math.round((gross - net) * 100) / 100;
  return { net: money2str(net), vat: money2str(vat), gross: money2str(gross) };
}

export function emptyBatchRow(overrides = {}) {
  return {
    clientRowId:
      overrides.clientRowId ||
      `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'payment',
    date: '',
    reference: '',
    payeeType: '',
    payeeId: '',
    payeeName: '',
    employeePurpose: '',
    accountId: '',
    cashBankAccountId: '',
    toCashBankAccountId: '',
    journalGroup: '',
    debit: '',
    credit: '',
    amount: '',
    vatCode: 'NONE',
    vatAmount: '',
    supplierVatNo: '',
    description: '',
    attachmentUrl: '',
    branchId: '',
    ...overrides,
  };
}

/**
 * Parse TSV/CSV paste (Excel). Handles quoted fields and Arabic text.
 * Returns array of string[] rows.
 */
export function parsePasteBlock(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!raw.trim()) return [];
  const lines = raw.split('\n').filter((l, i, arr) => !(i === arr.length - 1 && l === ''));
  return lines.map((line) => parseDelimitedLine(line));
}

function parseDelimitedLine(line) {
  const delim = line.includes('\t') ? '\t' : ',';
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const TYPE_ALIASES = {
  p: 'payment',
  payment: 'payment',
  pe: 'payment',
  r: 'receipt',
  receipt: 'receipt',
  rv: 'receipt',
  t: 'transfer',
  transfer: 'transfer',
  tr: 'transfer',
  j: 'journal',
  journal: 'journal',
  je: 'journal',
};

export function mapTypeToken(raw) {
  const k = String(raw || '')
    .trim()
    .toLowerCase();
  return TYPE_ALIASES[k] || null;
}

/** Map pasted cells starting at column index into a row patch. */
export function mapPasteCellsToRowPatch(cells, startCol = 0) {
  const cols = [
    'type',
    'date',
    'reference',
    'payeeName',
    'accountId',
    'cashBankAccountId',
    'toCashBankAccountId',
    'journalGroup',
    'description',
    'amount',
    'debit',
    'credit',
    'vatCode',
    'vatAmount',
  ];
  const patch = {};
  for (let i = 0; i < cells.length; i += 1) {
    const key = cols[startCol + i];
    if (!key) break;
    const v = String(cells[i] ?? '').trim();
    if (!v) continue;
    if (key === 'type') {
      const t = mapTypeToken(v);
      if (t) patch.type = t;
      else patch._typeError = v;
    } else if (key === 'amount' || key === 'debit' || key === 'credit' || key === 'vatAmount') {
      const h = parseMoneyToHalalas(v);
      patch[key] = h == null ? v : formatHalalas(h);
      if (h == null) patch[`_${key}Error`] = true;
    } else if (key === 'vatCode') {
      const u = v.toUpperCase();
      patch.vatCode = ['NONE', 'S15', 'Z0', 'EX'].includes(u) ? u : 'NONE';
    } else {
      patch[key] = v;
    }
  }
  return patch;
}

/** Client-side row issues (before / alongside server validate). */
export function clientValidateRow(row, ctx = {}) {
  const errors = [];
  const warnings = [];
  const type = row.type || 'payment';
  if (!YMD.test(String(row.date || ''))) {
    errors.push({ field: 'date', code: 'BATCH_ROW_AMOUNT_INVALID', message: 'date' });
  } else if (ctx.todayYmd && row.date > ctx.todayYmd) {
    warnings.push({ field: 'date', code: 'BATCH_ROW_FUTURE_DATE', message: 'future' });
  }
  if (type === 'payment' || type === 'receipt' || type === 'transfer') {
    const h = parseMoneyToHalalas(row.amount);
    if (h == null || h <= 0) {
      errors.push({ field: 'amount', code: 'BATCH_ROW_AMOUNT_INVALID', message: 'amount' });
    }
    if (!row.cashBankAccountId) {
      errors.push({
        field: 'cashBankAccountId',
        code: 'BATCH_ROW_REGISTER_REQUIRED',
        message: 'register',
      });
    }
  }
  if (type === 'transfer') {
    if (!row.toCashBankAccountId) {
      errors.push({
        field: 'toCashBankAccountId',
        code: 'BATCH_ROW_REGISTER_REQUIRED',
        message: 'to',
      });
    } else if (String(row.cashBankAccountId) === String(row.toCashBankAccountId)) {
      errors.push({
        field: 'toCashBankAccountId',
        code: 'BATCH_ROW_TRANSFER_SAME_REGISTER',
        message: 'same',
      });
    }
  }
  if (type === 'journal') {
    const dr = parseMoneyToHalalas(row.debit) || 0;
    const cr = parseMoneyToHalalas(row.credit) || 0;
    if (dr <= 0 && cr <= 0) {
      errors.push({ field: 'debit', code: 'BATCH_ROW_AMOUNT_INVALID', message: 'drcr' });
    }
    if (dr > 0 && cr > 0) {
      errors.push({ field: 'debit', code: 'BATCH_ROW_AMOUNT_INVALID', message: 'both' });
    }
    if (!row.accountId) {
      errors.push({ field: 'accountId', code: 'BATCH_ROW_AMOUNT_INVALID', message: 'account' });
    }
  }
  if (
    (type === 'payment' || type === 'receipt') &&
    String(row.payeeType || '').toLowerCase() === 'employee' &&
    row.employeePurpose !== 'advance' &&
    row.employeePurpose !== 'salary_payable'
  ) {
    errors.push({
      field: 'employeePurpose',
      code: 'BATCH_ROW_EMPLOYEE_PURPOSE_REQUIRED',
      message: 'purpose',
    });
  }
  if (String(row.payeeType || '') === 'PlatformHQ') {
    errors.push({
      field: 'payeeType',
      code: 'BATCH_ROW_HQ_SIDE_INVALID',
      message: 'hq',
    });
  }
  if (
    (type === 'payment' || type === 'receipt') &&
    row.vatCode === 'S15' &&
    !String(row.supplierVatNo || '').trim()
  ) {
    warnings.push({
      field: 'supplierVatNo',
      code: 'BATCH_ROW_VAT_NOT_CLAIMABLE',
      message: 'vat',
    });
  }
  const state = errors.length ? 'error' : warnings.length ? 'warning' : 'valid';
  return { state, errors, warnings };
}

export function journalGroupsBalanced(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (r.type !== 'journal') continue;
    const g = Number(r.journalGroup || 0);
    const bucket = groups.get(g) || { dr: 0, cr: 0 };
    bucket.dr += parseMoneyToHalalas(r.debit) || 0;
    bucket.cr += parseMoneyToHalalas(r.credit) || 0;
    groups.set(g, bucket);
  }
  const unbalanced = [];
  for (const [g, b] of groups) {
    if (b.dr !== b.cr) unbalanced.push(g);
  }
  return { balanced: unbalanced.length === 0, unbalanced };
}

export function computeGridTotals(rows) {
  let totalIn = 0;
  let totalOut = 0;
  let transfers = 0;
  let journalDr = 0;
  let journalCr = 0;
  let valid = 0;
  let warnings = 0;
  let errors = 0;
  for (const r of rows) {
    const st = r._state || clientValidateRow(r).state;
    if (st === 'error') errors += 1;
    else if (st === 'warning') warnings += 1;
    else valid += 1;
    const amt = parseMoneyToHalalas(r.amount) || 0;
    if (r.type === 'receipt') totalIn += amt;
    if (r.type === 'payment') totalOut += amt;
    if (r.type === 'transfer') {
      transfers += amt;
      totalOut += amt;
    }
    if (r.type === 'journal') {
      journalDr += parseMoneyToHalalas(r.debit) || 0;
      journalCr += parseMoneyToHalalas(r.credit) || 0;
    }
  }
  return {
    count: rows.length,
    valid,
    warnings,
    errors,
    totalIn: formatHalalas(totalIn),
    totalOut: formatHalalas(totalOut),
    transfers: formatHalalas(transfers),
    journalDebit: formatHalalas(journalDr),
    journalCredit: formatHalalas(journalCr),
    difference: formatHalalas(journalDr - journalCr),
  };
}

export function filterRowsByChip(rows, chip) {
  if (!chip || chip === 'all') return rows;
  return rows.filter((r) => {
    const st = r._state || clientValidateRow(r).state;
    if (chip === 'errors') return st === 'error';
    if (chip === 'warnings') return st === 'warning';
    if (chip === 'valid') return st === 'valid';
    return true;
  });
}

export function mergeServerValidation(rows, serverRows) {
  const byClient = new Map(
    (serverRows || []).map((s) => [String(s.clientRowId), s]),
  );
  return rows.map((r) => {
    const s = byClient.get(String(r.clientRowId));
    if (!s) return r;
    return {
      ...r,
      _state: s.state || r._state,
      _errors: s.errors || [],
      _warnings: s.warnings || [],
    };
  });
}

export function rowsToBatchDtoPayload(rows, header = {}) {
  return {
    workshopId: header.workshopId || undefined,
    branchId: header.branchId || undefined,
    memo: header.memo || undefined,
    version: header.version,
    rows: rows.map((r) => ({
      clientRowId: r.clientRowId,
      type: r.type,
      date: r.date,
      reference: r.reference || undefined,
      payeeType: r.payeeType || undefined,
      payeeId: r.payeeId || undefined,
      payeeName: r.payeeName || undefined,
      employeePurpose: r.employeePurpose || undefined,
      accountId: r.accountId || undefined,
      cashBankAccountId: r.cashBankAccountId || undefined,
      toCashBankAccountId: r.toCashBankAccountId || undefined,
      journalGroup:
        r.journalGroup !== '' && r.journalGroup != null
          ? Number(r.journalGroup)
          : undefined,
      debit: r.debit || undefined,
      credit: r.credit || undefined,
      amount: r.amount || undefined,
      vatCode: r.vatCode || undefined,
      vatAmount: r.vatAmount || undefined,
      supplierVatNo: r.supplierVatNo || undefined,
      description: r.description || undefined,
      attachmentUrl: r.attachmentUrl || undefined,
      branchId: r.branchId || undefined,
    })),
  };
}

export function downloadBatchTemplateCsv() {
  const header =
    'type,date,reference,payeeType,payeeName,accountId,cashBankAccountId,toCashBankAccountId,journalGroup,description,amount,debit,credit,vatCode,vatAmount,supplierVatNo\n';
  const sample =
    'payment,2026-11-04,INV-1,Supplier,Example Co,,,,,,5750,,,S15,750,\n';
  const blob = new Blob([header + sample], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk-transactions-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function todayYmdRiyadh(now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function localDraftStorageKey(userId, workshopId) {
  return `filter-bulk-tx-draft:${userId || 'u'}:${workshopId || 'w'}`;
}

export const BATCH_ERROR_I18N = {
  BATCH_ROW_EMPLOYEE_PURPOSE_REQUIRED: 'bulk.err.employeePurpose',
  BATCH_ROW_DATE_LOCKED: 'bulk.err.dateLocked',
  BATCH_ROW_VAT_NOT_CLAIMABLE: 'bulk.warn.vatNotClaimable',
  BATCH_ROW_POSSIBLE_DUPLICATE: 'bulk.warn.duplicate',
  BATCH_ROW_TRANSFER_SAME_REGISTER: 'bulk.err.sameRegister',
  BATCH_ROW_HQ_SIDE_INVALID: 'bulk.err.hq',
  BATCH_ROW_AMOUNT_INVALID: 'bulk.err.amount',
  BATCH_ROW_REGISTER_REQUIRED: 'bulk.err.register',
  BATCH_JOURNAL_GROUP_UNBALANCED: 'bulk.err.jeUnbalanced',
  BATCH_ROW_FUTURE_DATE: 'bulk.warn.futureDate',
  BATCH_ALREADY_POSTED: 'bulk.err.alreadyPosted',
};
