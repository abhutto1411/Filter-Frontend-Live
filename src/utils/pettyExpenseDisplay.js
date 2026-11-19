/** P-A12M — Petty cash expenses log display helpers. */

export const PETTY_EXPENSE_PAGE_SIZE = 25;

export const TYPE_FILTER_ALL = 'all';
export const TYPE_FILTER_EXPENSES = 'expenses';
export const TYPE_FILTER_ADVANCES = 'advances';

export function formatSarLatn(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatBusinessDate(value) {
  if (!value) return '—';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/** True when row is a salary advance (not an operating expense). */
export function isAdvanceExpenseRow(row) {
  if (!row) return false;
  if (row.isAdvance === true || row.kind === 'advance' || row.payToType === 'salary_advance') {
    return true;
  }
  const catId = String(row.category?.id || '').toLowerCase();
  const catName = String(row.category?.name || row.purpose || '').toLowerCase();
  if (catId === 'salary_advance' || catId.includes('advance')) return true;
  if (catName.includes('salary advance') || catName === 'advance') return true;
  return false;
}

export function mapExpenseTypeKind(row) {
  return isAdvanceExpenseRow(row) ? 'advance' : 'expense';
}

export function filterExpenseRowsByType(rows, typeFilter) {
  const list = Array.isArray(rows) ? rows : [];
  if (!typeFilter || typeFilter === TYPE_FILTER_ALL) return list;
  if (typeFilter === TYPE_FILTER_ADVANCES) return list.filter(isAdvanceExpenseRow);
  if (typeFilter === TYPE_FILTER_EXPENSES) return list.filter((r) => !isAdvanceExpenseRow(r));
  return list;
}

/** Method filter uses `source` until a dedicated method field exists. */
export function filterExpenseRowsByMethod(rows, method) {
  const list = Array.isArray(rows) ? rows : [];
  if (!method || method === 'all') return list;
  const m = String(method).toLowerCase();
  return list.filter((r) => String(r.source || '').toLowerCase() === m);
}

/**
 * Summary cards from API only — never invent expense totals by summing the page.
 * Advances must not appear in the Expenses card (use dedicated fields).
 */
export function mapPettyExpenseCards(payload = {}) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const summary = p.summary && typeof p.summary === 'object' ? p.summary : {};
  const pick = (...keys) => {
    for (const k of keys) {
      if (summary[k] != null) return summary[k];
      if (p[k] != null && k !== 'items' && k !== 'total' && k !== 'totalAmount') return p[k];
    }
    return undefined;
  };

  const cards = [];
  const expenses = pick('expenseTotal', 'expensesTotal', 'operatingExpenseTotal');
  if (expenses != null) cards.push({ id: 'expenses', value: expenses, money: true });

  const advances = pick('advanceTotal', 'salaryAdvanceTotal', 'advancesTotal');
  if (advances != null) cards.push({ id: 'advances', value: advances, money: true });

  const pending = pick('pendingCount', 'pending');
  if (pending != null) cards.push({ id: 'pending', value: pending, money: false });

  const holders = pick('holdersCount', 'holderCount', 'holders');
  if (holders != null) cards.push({ id: 'holders', value: holders, money: false });

  return cards;
}

export function mapExpenseHolder(row) {
  return row?.holderName || row?.requestedBy?.name || row?.requestedBy?.email || '—';
}

export function mapExpensePurpose(row) {
  return row?.purpose || row?.category?.name || '—';
}

export function mapExpenseEmployee(row) {
  return (
    row?.employeeName ||
    row?.payToEmployeeName ||
    row?.beneficiaryName ||
    row?.employee?.name ||
    null
  );
}

export function mapExpenseRef(row) {
  return row?.reference || row?.requestNumber || row?.id || '—';
}

export function mapExpenseVat(row) {
  if (row?.vatAmount != null) return row.vatAmount;
  if (row?.vat != null) return row.vat;
  if (row?.vatSar != null) return row.vatSar;
  return undefined;
}

export const METHOD_OPTIONS = [
  { id: 'all', labelKey: 'opt.allMethods' },
  { id: 'petty_cash', labelKey: 'method.pettyCash' },
  { id: 'admin_wallet', labelKey: 'method.adminWallet' },
  { id: 'locker', labelKey: 'method.locker' },
];
