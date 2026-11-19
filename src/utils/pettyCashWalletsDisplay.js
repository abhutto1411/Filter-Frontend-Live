/** P-A12F — display helpers only; no money maths beyond integer-halala display sums. */

export const PETTY_CASH_WALLETS_PAGE_SIZE = 25;

export function formatSarLatn(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Balance after a fund approval (string/number in → string out). */
export function balanceAfterFundApproval(currentBalance, amount) {
  const cur = Number(currentBalance);
  const amt = Number(amount);
  const a = Number.isFinite(cur) ? Math.round(cur * 100) : 0;
  const b = Number.isFinite(amt) ? Math.round(amt * 100) : 0;
  return ((a + b) / 100).toFixed(2);
}

/** Balance after spending an expense amount (display preview only). */
export function balanceAfterExpense(currentBalance, amount) {
  const cur = Number(currentBalance);
  const amt = Number(amount);
  const a = Number.isFinite(cur) ? Math.round(cur * 100) : 0;
  const b = Number.isFinite(amt) ? Math.round(amt * 100) : 0;
  return ((a - b) / 100).toFixed(2);
}

/** Holder class from workshop/locker role strings. */
export function resolveHolderWalletClass(role) {
  const r = String(role || '')
    .trim()
    .toLowerCase();
  if (r === 'cashier') return 'CASHIER';
  if (r === 'purchaser' || r === 'outdoor_purchaser') return 'PURCHASER';
  return 'STAFF';
}

/** How much of the fund first clears a negative payable (halalas). */
export function clearsPayableAmount(currentBalance, amount) {
  const cur = Number(currentBalance);
  const amt = Number(amount);
  if (!(cur < 0) || !(amt > 0)) return '0.00';
  const need = Math.round(Math.abs(cur) * 100);
  const have = Math.round(amt * 100);
  return (Math.min(need, have) / 100).toFixed(2);
}

export function formatPayableToLabel(holderName, locale = 'en') {
  const name = String(holderName || '').trim() || '—';
  if (String(locale).toLowerCase().startsWith('ar')) {
    return `مستحق لـ ${name}`;
  }
  return `Payable to ${name}`;
}

export function mapPettyCashCashierBlockedMessage(locale = 'en') {
  if (String(locale).toLowerCase().startsWith('ar')) {
    return 'عهدة الكاشير لا يمكن أن تقل عن 0. اطلب تمويلاً أولاً.';
  }
  return 'Cashier petty cash cannot go below 0. Ask for a fund request first.';
}

/** Map API error body → user message (EN/AR). */
export function mapPettyCashApiError(err, locale = 'en') {
  const code =
    err?.code ||
    err?.response?.data?.code ||
    (typeof err?.response?.data === 'object' ? err.response.data.code : null) ||
    (typeof err?.message === 'object' ? err.message?.code : null);
  if (
    code === 'PETTY_CASH_CASHIER_NEGATIVE_BLOCKED' ||
    String(err?.message || '').includes('PETTY_CASH_CASHIER_NEGATIVE_BLOCKED')
  ) {
    return mapPettyCashCashierBlockedMessage(locale);
  }
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  if (typeof err?.response?.data?.message === 'string') {
    return err.response.data.message;
  }
  return mapPettyCashCashierBlockedMessage(locale);
}

export function isNegativeClosing(closing) {
  return Number(closing) < -0.0001;
}

export function slicePage(items, page, pageSize = PETTY_CASH_WALLETS_PAGE_SIZE) {
  const rows = Array.isArray(items) ? items : [];
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || PETTY_CASH_WALLETS_PAGE_SIZE);
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

/** Filter locker vault + operating cash/bank; never 1005-O* Cash in Transit. */
export function filterPayFromRegisters(accounts) {
  const rows = Array.isArray(accounts) ? accounts : [];
  return rows.filter((a) => {
    const kind = String(a.kind || a.registerKind || '').toUpperCase();
    const code = String(a.coaCode || a.coaAccount?.code || a.code || '');
    if (code.startsWith('1005')) return false;
    if (kind === 'SYSTEM_LOCKER_VAULT') return true;
    if (kind === 'OPERATING' || !kind) {
      const type = String(a.type || '').toUpperCase();
      // K14: never PETTY_CASH wallets or tills as company pay-from.
      return type === 'CASH' || type === 'BANK';
    }
    return false;
  });
}

export function payFromOptionLabel(account, t) {
  const kind = String(account.kind || '').toUpperCase();
  const name = account.name || account.label || `#${account.id}`;
  const branch = account.branchName || account.branch?.name || '';
  if (kind === 'SYSTEM_LOCKER_VAULT') {
    return t
      ? t('pcw.payFrom.locker', { branch: branch || name })
      : `Locker cash wallet (${branch || name})`;
  }
  return t
    ? t('pcw.payFrom.admin', { name })
    : `Admin transfer: ${name}`;
}

export function fundSourceForRegister(account) {
  const kind = String(account?.kind || '').toUpperCase();
  return kind === 'SYSTEM_LOCKER_VAULT' ? 'locker' : 'admin_transfer';
}
