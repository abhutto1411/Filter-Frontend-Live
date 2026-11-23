/** P-A12H3 — employee advance & salary statement display helpers. */

export const STATEMENT_PAGE_SIZE = 25;

export function formatSarLatn(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function slicePage(items, page, pageSize = STATEMENT_PAGE_SIZE) {
  const rows = Array.isArray(items) ? rowsOrEmpty(items) : [];
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || STATEMENT_PAGE_SIZE);
  const start = (p - 1) * size;
  return {
    page: p,
    pageSize: size,
    total: rows.length,
    items: rows.slice(start, start + size),
    from: rows.length ? start + 1 : 0,
    to: Math.min(rows.length, start + size),
  };
}

function rowsOrEmpty(items) {
  return Array.isArray(items) ? items : [];
}

/** Map journal source/type → mockup Source chip key. */
export function mapStatementSourceKey(row) {
  const s = String(row?.source || row?.type || '').toLowerCase();
  if (row?.isOpening || s === 'opening') return 'opening';
  if (s.includes('petty_cash') || s.includes('pos') || s.includes('cashier')) return 'pos';
  if (s.includes('payroll_accrual') || s === 'payroll' || s.includes('salary_payable')) {
    return 'payroll';
  }
  if (s.includes('payroll_payout') || s.includes('payout') || s.includes('salary_paid')) {
    return 'payout';
  }
  if (s.includes('global_advance') || s.includes('admin') || s.includes('advance')) {
    return 'admin';
  }
  if (s.includes('transaction') || s.includes('manual') || s.includes('journal')) {
    return 'transactions';
  }
  if (s) return 'transactions';
  return 'admin';
}

export function accountLabel(code) {
  const c = String(code || '');
  if (c.startsWith('1250')) return c.includes('-E') ? '1250-E' : '1250-E';
  if (c.startsWith('2250')) return '2250-E';
  if (c.startsWith('2200-ER')) return '2200-ER';
  if (c.startsWith('2200')) return '2200-E';
  return c || '';
}

export function balanceSuffixKey(row) {
  if (row?.balanceKind === 'payable' || row?.balanceSuffix === 'payable') return 'payable';
  if (row?.balanceKind === 'adv' || row?.balanceSuffix === 'adv') return 'adv';
  const code = String(row?.accountCode || row?.account || '');
  if (code.startsWith('2250')) return 'payable';
  if (code.startsWith('1250')) return 'adv';
  return null;
}

/** Cards: only include when API provides the field (undefined → omit). */
export function mapStatementCards(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const summary = p.summary && typeof p.summary === 'object' ? p.summary : {};
  const pick = (...keys) => {
    for (const k of keys) {
      if (p[k] != null) return p[k];
      if (summary[k] != null) return summary[k];
    }
    return undefined;
  };
  const defs = [
    { id: 'opening', keys: ['opening', 'openingBalance'] },
    { id: 'given', keys: ['advancesGiven', 'advancesGivenInPeriod', 'given'] },
    { id: 'recovered', keys: ['recovered', 'advancesRecovered', 'recoveredInPeriod'] },
    { id: 'payable', keys: ['salaryPayable', 'salariesPayable', 'payable2250'] },
    { id: 'commission', keys: ['commissionPayable', 'payable2200'] },
    { id: 'closing', keys: ['closingAdvance', 'closingBalance', 'closing'] },
  ];
  const cards = [];
  for (const d of defs) {
    let value = pick(...d.keys);
    if (value === undefined && d.id === 'opening' && p.opening != null) value = p.opening;
    if (value === undefined && d.id === 'closing') {
      const items = Array.isArray(p.items) ? p.items : [];
      if (items.length && items[items.length - 1]?.balance != null && p.closing == null) {
        // Do not invent closing from last page row when server-paged — only if total fits one page.
        if (Number(p.total) === items.length && Number(p.page) === 1) {
          value = items[items.length - 1].balance;
        }
      }
    }
    if (value === undefined) continue;
    cards.push({ id: d.id, value });
  }
  return cards;
}

export function mapStatementItems(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.rows)
      ? payload.rows
      : Array.isArray(payload)
        ? payload
        : [];
  return items.map((r, i) => ({
    id: String(r.id || `${r.date || ''}-${r.ref || i}-${r.accountCode || ''}`),
    date: r.date ? String(r.date).slice(0, 10) : '—',
    ref: r.ref || r.reference || r.entryNumber || null,
    source: r.source,
    type: r.type,
    isOpening: Boolean(r.isOpening),
    accountCode: r.accountCode || r.account || '',
    narration: r.narration || r.description || r.memo || '',
    debit: r.debit,
    credit: r.credit,
    balance: r.balance,
    balanceKind: r.balanceKind || r.balanceSuffix || null,
    linkKind: r.linkKind || null,
    linkId: r.linkId || r.slipId || r.journalId || null,
    payslipId: r.payslipId || r.slipId || null,
    journalId: r.journalId || null,
    walletUserId: r.walletUserId || null,
  }));
}

/** Prepend Opening row when API opening is present and first row is not already opening. */
export function withOpeningRow(items, opening, fromDate) {
  const rows = Array.isArray(items) ? [...items] : [];
  if (opening == null) return rows;
  if (rows[0]?.isOpening || mapStatementSourceKey(rows[0] || {}) === 'opening') return rows;
  rows.unshift({
    id: 'opening',
    date: fromDate || '—',
    ref: null,
    source: 'opening',
    type: 'opening',
    isOpening: true,
    accountCode: '',
    narration: '',
    debit: null,
    credit: null,
    balance: opening,
    balanceKind: null,
  });
  return rows;
}

export function refHref(row) {
  if (!row) return null;
  if (row.payslipId || row.linkKind === 'payslip') {
    const id = row.payslipId || row.linkId;
    if (id) return `/workshop/accounting/advances/payroll/slip/${encodeURIComponent(id)}`;
  }
  if (row.journalId || row.linkKind === 'journal') {
    const id = row.journalId || row.linkId;
    if (id) return `/workshop/accounting/journal-entries?highlight=${encodeURIComponent(id)}`;
  }
  if (row.walletUserId || row.linkKind === 'wallet') {
    const id = row.walletUserId || row.linkId;
    if (id) return `/workshop/accounting/petty-cash?userId=${encodeURIComponent(id)}`;
  }
  return null;
}

/** Employee statement default range start: 1 January of the (Riyadh) current year. */
export function statementDefaultFrom(todayYmd) {
  const s = String(todayYmd || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(0, 4)}-01-01` : '';
}
