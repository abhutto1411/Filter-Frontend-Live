/**
 * P-A18C — CSV/Excel import helpers for bulk batch preview (mockup 29).
 * Money: parse to decimal strings; display sums use integer halalas only.
 */

import {
  emptyBatchRow,
  formatHalalas,
  mapTypeToken,
  parseMoneyToHalalas,
} from './bulkTransactionGrid.js';

/** Template column keys (mockup 29). */
export const IMPORT_TEMPLATE_COLUMNS = [
  'type',
  'date',
  'reference',
  'party_type',
  'party',
  'employee_purpose',
  'account_code',
  'pay_from',
  'transfer_to',
  'je_group',
  'description',
  'debit',
  'credit',
  'amount',
  'vat_code',
];

/** Fields the user can map a file column onto. */
export const IMPORT_TARGET_FIELDS = [
  { id: '', labelKey: 'imp.map.skip' },
  { id: 'type', labelKey: 'imp.map.type' },
  { id: 'date', labelKey: 'imp.map.date' },
  { id: 'reference', labelKey: 'imp.map.reference' },
  { id: 'party_type', labelKey: 'imp.map.partyType' },
  { id: 'party', labelKey: 'imp.map.party' },
  { id: 'employee_purpose', labelKey: 'imp.map.purpose' },
  { id: 'account_code', labelKey: 'imp.map.account' },
  { id: 'pay_from', labelKey: 'imp.map.payFrom' },
  { id: 'transfer_to', labelKey: 'imp.map.transferTo' },
  { id: 'je_group', labelKey: 'imp.map.jeGroup' },
  { id: 'description', labelKey: 'imp.map.description' },
  { id: 'debit', labelKey: 'imp.map.debit' },
  { id: 'credit', labelKey: 'imp.map.credit' },
  { id: 'amount', labelKey: 'imp.map.amount' },
  { id: 'vat_code', labelKey: 'imp.map.vat' },
];

const HEADER_ALIASES = {
  type: ['type', 'نوع', 'tx type', 'transaction type'],
  date: ['date', 'التاريخ', 'تاريخ', 'txn date', 'transaction date'],
  reference: ['reference', 'ref', 'مرجع', 'invoice', 'رقم'],
  party_type: [
    'party_type',
    'party type',
    'payeetype',
    'payee_type',
    'نوع الطرف',
  ],
  party: [
    'party',
    'supplier',
    'customer',
    'payee',
    'payeename',
    'payee_name',
    'المورد',
    'العميل',
    'الطرف',
  ],
  employee_purpose: [
    'employee_purpose',
    'employee purpose',
    'purpose',
    'غرض',
    'غرض الموظف',
  ],
  account_code: [
    'account_code',
    'account',
    'account code',
    'gl',
    'coa',
    'الحساب',
    'رمز الحساب',
  ],
  pay_from: [
    'pay_from',
    'pay from',
    'paid from',
    'register',
    'cashbankaccountid',
    'من الصندوق',
    'الصندوق',
  ],
  transfer_to: [
    'transfer_to',
    'transfer to',
    'to',
    'tocashbankaccountid',
    'إلى',
  ],
  je_group: ['je_group', 'je group', 'journal group', 'journalgroup', 'مجموعة'],
  description: ['description', 'memo', 'desc', 'الوصف', 'بيان'],
  debit: ['debit', 'dr', 'مدين'],
  credit: ['credit', 'cr', 'دائن'],
  amount: ['amount', 'gross', 'المبلغ', 'قيمة'],
  vat_code: ['vat_code', 'vat', 'vat code', 'vatcode', 'ضريبة'],
};

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

export function columnMapStorageKey(userId) {
  return `filter-bulk-csv-colmap:${userId || 'u'}`;
}

/** Arabic-Indic / Eastern Arabic digits → Western. */
export function toWesternDigits(raw) {
  return String(raw ?? '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Parse amount with dot decimal only (after Western digit convert).
 * Accepts "1,250.50" or "1250.5".
 */
export function parseImportNumber(raw) {
  let s = toWesternDigits(raw).trim();
  if (!s) return null;
  // Dot decimal only. Reject European "1.250,50"; allow "1,250.50".
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) return null;
    s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    if (!/^-?\d{1,3}(,\d{3})+$/.test(s)) return null;
    s = s.replace(/,/g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return (Math.round(n * 100) / 100).toFixed(2);
}

/**
 * Dates: YYYY-MM-DD, DD/MM/YYYY, Excel serial (days since 1899-12-30).
 */
export function parseImportDate(raw) {
  if (raw == null || raw === '') return { ymd: null, sampleFrom: '' };
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ymd = excelSerialToYmd(raw);
    return { ymd, sampleFrom: String(raw) };
  }
  const s0 = toWesternDigits(raw).trim();
  if (!s0) return { ymd: null, sampleFrom: '' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(s0)) {
    return { ymd: s0, sampleFrom: s0 };
  }
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s0);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    const ymd = `${yyyy}-${mm}-${dd}`;
    return { ymd, sampleFrom: s0 };
  }
  // Excel serial as string
  if (/^\d+(\.\d+)?$/.test(s0)) {
    const n = Number(s0);
    if (n > 20000 && n < 80000) {
      const ymd = excelSerialToYmd(n);
      return { ymd, sampleFrom: s0 };
    }
  }
  return { ymd: null, sampleFrom: s0 };
}

export function excelSerialToYmd(serial) {
  const n = Math.floor(Number(serial));
  if (!Number.isFinite(n)) return null;
  // Excel epoch 1899-12-30 UTC
  const ms = Date.UTC(1899, 11, 30) + n * 86400000;
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normHeader(h) {
  return toWesternDigits(h)
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Auto-match a file header to a target field id (or ''). */
export function autoMapHeader(header) {
  const n = normHeader(header);
  if (!n) return '';
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const a of aliases) {
      if (n === normHeader(a) || n.includes(normHeader(a))) {
        return field;
      }
    }
  }
  // exact template key
  if (IMPORT_TEMPLATE_COLUMNS.includes(n.replace(/ /g, '_'))) {
    return n.replace(/ /g, '_');
  }
  return '';
}

export function buildInitialColumnMap(headers, remembered = {}) {
  const map = {};
  const used = new Set();
  for (const h of headers) {
    const key = String(h);
    if (remembered[key] != null && remembered[key] !== undefined) {
      map[key] = remembered[key];
      if (remembered[key]) used.add(remembered[key]);
      continue;
    }
    const auto = autoMapHeader(key);
    if (auto && !used.has(auto)) {
      map[key] = auto;
      used.add(auto);
    } else {
      map[key] = '';
    }
  }
  return map;
}

/** Sample cell → display "raw → normalized" for date/amount. */
export function mappingSample(fileCol, targetField, sampleRaw) {
  if (!targetField || sampleRaw == null || sampleRaw === '') return '—';
  const raw = String(sampleRaw);
  if (targetField === 'date') {
    const { ymd, sampleFrom } = parseImportDate(sampleRaw);
    if (ymd && sampleFrom !== ymd) return `${sampleFrom} → ${ymd}`;
    return ymd || raw;
  }
  if (
    targetField === 'amount' ||
    targetField === 'debit' ||
    targetField === 'credit'
  ) {
    const n = parseImportNumber(sampleRaw);
    if (n && n !== raw.replace(/,/g, '')) return `${raw} → ${n}`;
    return n || raw;
  }
  return raw;
}

/**
 * Find duplicate rows inside the file (same type+date+party+amount+account).
 * Returns Set of 0-based data row indexes that are duplicates of an earlier row.
 */
export function findDuplicateRowIndexes(mappedRows) {
  const seen = new Map();
  const dups = new Set();
  mappedRows.forEach((r, i) => {
    const key = [
      r.type || '',
      r.date || '',
      r.party || r.payeeName || '',
      r.amount || '',
      r.account_code || r.accountId || '',
    ].join('|');
    if (!r.amount && !r.debit && !r.credit) return;
    if (seen.has(key)) {
      dups.add(i);
    } else {
      seen.set(key, i);
    }
  });
  return dups;
}

/** Parse CSV text into { headers, rows: string[][] }. First non-empty line = header. */
export function parseCsvText(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const grid = [];
  for (const line of lines) {
    if (!line.trim() && grid.length === 0) continue;
    grid.push(parseCsvLine(line));
  }
  while (grid.length && grid[grid.length - 1].every((c) => !String(c).trim())) {
    grid.pop();
  }
  if (!grid.length) return { headers: [], rows: [] };
  const headers = grid[0].map((h) => String(h ?? '').trim());
  const rows = grid.slice(1).filter((r) => r.some((c) => String(c ?? '').trim()));
  return { headers, rows };
}

function parseCsvLine(line) {
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
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Apply column map to one data row → intermediate mapped object. */
export function applyColumnMap(headers, cells, columnMap) {
  const out = {};
  headers.forEach((h, i) => {
    const target = columnMap[h];
    if (!target) return;
    out[target] = cells[i] != null ? cells[i] : '';
  });
  return out;
}

function mapPartyType(raw) {
  const s = toWesternDigits(raw).trim().toLowerCase();
  if (!s) return '';
  if (['supplier', 'مورد', 'suppliers'].includes(s)) return 'Supplier';
  if (['customer', 'عميل', 'customers'].includes(s)) return 'Customer';
  if (['employee', 'موظف', 'staff'].includes(s)) return 'Employee';
  if (['other', 'أخرى', 'اخر'].includes(s)) return 'Other';
  if (['platformhq', 'platform hq', 'hq'].includes(s)) return 'PlatformHQ';
  // Title-case passthrough if already valid
  const titled = s.charAt(0).toUpperCase() + s.slice(1);
  if (['Supplier', 'Customer', 'Employee', 'Other', 'PlatformHQ'].includes(titled)) {
    return titled;
  }
  return titled;
}

function mapPurpose(raw) {
  const s = toWesternDigits(raw).trim().toLowerCase();
  if (s === 'advance' || s === 'سلفة') return 'advance';
  if (
    s === 'salary_payable' ||
    s === 'salary' ||
    s === 'راتب' ||
    s === 'salary payable'
  ) {
    return 'salary_payable';
  }
  return s || '';
}

/**
 * Resolve account / register / party lookups.
 * Ambiguous or missing → error message on row (client).
 */
export function resolveLookupId(list, raw, { codeKeys = ['code'], nameKeys = ['name', 'label'] } = {}) {
  const q = toWesternDigits(raw).trim();
  if (!q) return { id: '', label: '', error: null };
  const ql = q.toLowerCase();
  const matches = (list || []).filter((item) => {
    for (const k of codeKeys) {
      if (item[k] != null && String(item[k]).trim().toLowerCase() === ql) return true;
    }
    for (const k of nameKeys) {
      if (item[k] != null && String(item[k]).trim().toLowerCase() === ql) return true;
    }
    return false;
  });
  if (matches.length === 1) {
    const m = matches[0];
    const label =
      m.label ||
      m.name ||
      [m.code, m.name].filter(Boolean).join(' ') ||
      String(m.id);
    return { id: String(m.id), label, error: null };
  }
  if (matches.length > 1) {
    return { id: '', label: q, error: 'ambiguous' };
  }
  // partial name contains
  const partial = (list || []).filter((item) => {
    for (const k of nameKeys) {
      const v = item[k] != null ? String(item[k]).toLowerCase() : '';
      if (v && (v.includes(ql) || ql.includes(v))) return true;
    }
    return false;
  });
  if (partial.length === 1) {
    const m = partial[0];
    return {
      id: String(m.id),
      label: m.label || m.name || String(m.id),
      error: null,
    };
  }
  if (partial.length > 1) {
    return { id: '', label: q, error: 'ambiguous' };
  }
  return { id: '', label: q, error: 'not_found' };
}

/**
 * Build batch grid rows from mapped file rows + lookups.
 */
export function buildBatchRowsFromImport(mappedRows, lookups = {}) {
  const {
    coa = [],
    registers = [],
    suppliers = [],
    customers = [],
    employees = [],
  } = lookups;
  const dups = findDuplicateRowIndexes(mappedRows);

  return mappedRows.map((m, idx) => {
    const clientIssues = [];
    const type =
      mapTypeToken(m.type) ||
      (String(m.type || '').trim() ? null : 'payment');
    if (m.type && !mapTypeToken(m.type) && !type) {
      clientIssues.push({
        code: 'IMPORT_TYPE',
        message: `Unknown type '${m.type}'`,
      });
    }
    const { ymd } = parseImportDate(m.date);
    if (m.date && !ymd) {
      clientIssues.push({ code: 'IMPORT_DATE', message: `Bad date '${m.date}'` });
    }
    const amount = m.amount != null && m.amount !== '' ? parseImportNumber(m.amount) : '';
    if (m.amount != null && String(m.amount).trim() && amount == null) {
      clientIssues.push({
        code: 'IMPORT_AMOUNT',
        message: `Bad amount '${m.amount}'`,
      });
    }
    const debit = m.debit != null && m.debit !== '' ? parseImportNumber(m.debit) : '';
    const credit =
      m.credit != null && m.credit !== '' ? parseImportNumber(m.credit) : '';

    const payeeType = mapPartyType(m.party_type);
    let payeeId = '';
    let payeeName = String(m.party || '').trim();
    if (payeeName) {
      let pool = [];
      if (payeeType === 'Supplier') pool = suppliers;
      else if (payeeType === 'Customer') pool = customers;
      else if (payeeType === 'Employee') pool = employees;
      else pool = [...suppliers, ...customers, ...employees];
      const res = resolveLookupId(pool, payeeName, {
        codeKeys: ['code', 'phone', 'id'],
        nameKeys: ['name', 'label', 'displayName'],
      });
      if (res.error === 'ambiguous') {
        clientIssues.push({
          code: 'IMPORT_PARTY_AMBIGUOUS',
          message: `Choose the exact party for '${payeeName}'`,
        });
      } else if (res.error === 'not_found') {
        // keep name — BE may still accept payeeName without id
        payeeName = res.label;
      } else {
        payeeId = res.id;
        payeeName = res.label || payeeName;
      }
    }

    let accountId = '';
    let accountLabel = String(m.account_code || '').trim();
    if (accountLabel) {
      const res = resolveLookupId(coa, accountLabel, {
        codeKeys: ['code', 'accountCode'],
        nameKeys: ['name', 'label', 'accountName'],
      });
      if (res.error === 'ambiguous' || res.error === 'not_found') {
        clientIssues.push({
          code: 'IMPORT_ACCOUNT',
          message: `Account '${accountLabel}' not found: choose the exact account`,
        });
      } else {
        accountId = res.id;
        accountLabel = res.label;
      }
    }

    let cashBankAccountId = '';
    let payFromLabel = String(m.pay_from || '').trim();
    if (payFromLabel) {
      const res = resolveLookupId(registers, payFromLabel, {
        codeKeys: ['code', 'accountCode'],
        nameKeys: ['name', 'label', 'displayName'],
      });
      if (res.error) {
        clientIssues.push({
          code: 'IMPORT_REGISTER',
          message: `Register '${payFromLabel}' not found: choose the exact register`,
        });
      } else {
        cashBankAccountId = res.id;
        payFromLabel = res.label;
      }
    }

    let toCashBankAccountId = '';
    let transferToLabel = String(m.transfer_to || '').trim();
    if (transferToLabel) {
      const res = resolveLookupId(registers, transferToLabel, {
        codeKeys: ['code', 'accountCode'],
        nameKeys: ['name', 'label', 'displayName'],
      });
      if (res.error) {
        clientIssues.push({
          code: 'IMPORT_REGISTER_TO',
          message: `Register '${transferToLabel}' not found: choose the exact register`,
        });
      } else {
        toCashBankAccountId = res.id;
        transferToLabel = res.label;
      }
    }

    if (dups.has(idx)) {
      clientIssues.push({
        code: 'BATCH_ROW_POSSIBLE_DUPLICATE',
        message: `Same as an earlier row in this file (possible duplicate)`,
        severity: 'warning',
      });
    }

    const vatRaw = String(m.vat_code || 'NONE').trim().toUpperCase() || 'NONE';
    const vatCode = ['NONE', 'S15', 'Z0', 'EX'].includes(vatRaw) ? vatRaw : 'NONE';

    const row = emptyBatchRow({
      type: type || 'payment',
      date: ymd || '',
      reference: String(m.reference || '').trim(),
      payeeType: payeeType || '',
      payeeId,
      payeeName,
      employeePurpose: mapPurpose(m.employee_purpose),
      accountId,
      cashBankAccountId,
      toCashBankAccountId,
      journalGroup: String(m.je_group || '').trim(),
      description: String(m.description || '').trim(),
      debit: debit || '',
      credit: credit || '',
      amount: amount || '',
      vatCode,
    });

    const warnings = clientIssues.filter(
      (e) => e.severity === 'warning' || e.code === 'BATCH_ROW_POSSIBLE_DUPLICATE',
    );
    const errors = clientIssues.filter(
      (e) => e.severity !== 'warning' && e.code !== 'BATCH_ROW_POSSIBLE_DUPLICATE',
    );

    let _state = 'valid';
    if (errors.length) _state = 'error';
    else if (warnings.length) _state = 'warning';

    return {
      ...row,
      _accountLabel: accountLabel,
      _payFromLabel: payFromLabel,
      _transferToLabel: transferToLabel,
      _errors: errors,
      _warnings: warnings,
      _state,
      _lineNo: idx + 1,
    };
  });
}

export function summarizeImportPreview(rows) {
  let valid = 0;
  let warnings = 0;
  let errors = 0;
  let totalOutH = 0;
  for (const r of rows || []) {
    if (r._state === 'error') errors += 1;
    else if (r._state === 'warning') warnings += 1;
    else valid += 1;
    if (r.type === 'payment' || r.type === 'transfer') {
      totalOutH += parseMoneyToHalalas(r.amount) || 0;
    }
  }
  return {
    valid,
    warnings,
    errors,
    totalOut: formatHalalas(totalOutH),
    count: (rows || []).length,
  };
}

export function pageSlice(rows, page, pageSize = 25) {
  const p = Math.max(Number(page) || 1, 1);
  const size = Math.max(Number(pageSize) || 25, 1);
  const total = rows.length;
  const pages = Math.max(Math.ceil(total / size), 1);
  const from = total === 0 ? 0 : (p - 1) * size + 1;
  const to = Math.min(p * size, total);
  return {
    page: Math.min(p, pages),
    pages,
    from,
    to,
    total,
    rows: rows.slice((Math.min(p, pages) - 1) * size, Math.min(p, pages) * size),
  };
}

export function downloadImportTemplateCsv() {
  const header = `${IMPORT_TEMPLATE_COLUMNS.join(',')}\n`;
  const sample =
    'payment,2026-10-01,INV-1,Supplier,Example Oils Co.,,2010-S,Cash - Branch A,,,Oct fuel,,2300.00,S15\n';
  const blob = new Blob([header + sample], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk-transactions-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
