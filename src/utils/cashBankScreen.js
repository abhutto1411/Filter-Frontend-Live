/**
 * Pure helpers for Cash & Bank screen (mockup 13 / P-A21B).
 */

export const CASH_BANK_PAGE_SIZE = 25;

/** Register classes for filter / KPI / table (frontend-derived). */
export const CASH_BANK_REGISTER_CLASSES = [
  'CASH_ON_HAND',
  'CASHIER_TILL',
  'PETTY_WALLET',
  'LOCKER',
  'BANK',
  'OTHER',
];

/** Display figure: prefer API `balance`, never treat stored-only as display. */
export function displayCashBankBalance(row) {
  if (row == null) return 0;
  const n = Number(row.balance);
  if (Number.isFinite(n)) return n;
  return 0;
}

/**
 * Source chip rule:
 * - gl → 'gl' (From ledger)
 * - shared_coa → 'shared_coa' (Shared account)
 * - stored / missing → null (no chip)
 */
export function cashBankBalanceSourceChip(balanceSource) {
  const s = String(balanceSource || '').trim();
  if (s === 'gl') return 'gl';
  if (s === 'shared_coa') return 'shared_coa';
  return null;
}

/**
 * Secondary shared-COA rows keep stored `balance` while the primary (lowest id)
 * holds the GL figure. Exclude them from KPI sums so the GL is not double-counted.
 */
export function isSharedCoaSecondary(row) {
  return String(row?.balanceSource || '') === 'shared_coa';
}

/** Rows that contribute to KPI sums (exclude shared_coa secondaries). */
export function accountsForBalanceSum(accounts) {
  return (accounts || []).filter((a) => a && !isSharedCoaSecondary(a));
}

/** COA code from explicit field or leading token of `coaLink` (`1001-C5 · Name`). */
export function extractCashBankCoaCode(account) {
  if (!account) return '';
  if (account.coaCode != null && String(account.coaCode).trim() !== '') {
    return String(account.coaCode).trim();
  }
  const link = String(account.coaLink || '').trim();
  if (!link || link === '—') return '';
  const m = link.match(/^([^\s·]+)/);
  return m ? m[1].trim() : '';
}

function normalizeApiType(account) {
  const raw = String(account?.apiType || account?.type || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (raw === 'PETTY' || raw === 'PETTYCASH') return 'PETTY_CASH';
  if (raw === 'CASH' || raw === 'BANK' || raw === 'PETTY_CASH') return raw;
  // UI labels from normalizeWorkshopCashBankRow
  const ui = String(account?.type || '').trim();
  if (ui === 'Bank') return 'BANK';
  if (ui === 'Petty Cash') return 'PETTY_CASH';
  if (ui === 'Cash') return 'CASH';
  return raw;
}

/**
 * Derive register class for cards / Type filter / table.
 *
 * Rules (kind first, then COA code pattern, else OTHER):
 * - BANK: apiType BANK
 * - CASHIER_TILL: kind SYSTEM_CASHIER_TILL; fallback code /^1001-C/i
 * - PETTY_WALLET: kind SYSTEM_PETTY_CASH_WALLET, or apiType PETTY_CASH;
 *   fallback code /^1003-C/i (not bare 1003)
 * - LOCKER: kind SYSTEM_LOCKER_VAULT; fallback code exactly 1004
 * - CASH_ON_HAND: remaining OPERATING (or unset) CASH — branch cash on hand
 * - OTHER: anything else
 *
 * Note: branch Cash On Hand often uses COA `1003`; wallets use `1003-C*`.
 * Never classify by the `1003` prefix alone.
 */
export function cashBankRegisterClass(account) {
  if (!account) return 'OTHER';
  const kind = String(account.kind || '').trim();
  const apiType = normalizeApiType(account);
  const code = extractCashBankCoaCode(account);

  if (apiType === 'BANK') return 'BANK';

  if (kind === 'SYSTEM_CASHIER_TILL') return 'CASHIER_TILL';
  if (kind === 'SYSTEM_PETTY_CASH_WALLET') return 'PETTY_WALLET';
  if (kind === 'SYSTEM_LOCKER_VAULT') return 'LOCKER';

  if (apiType === 'PETTY_CASH') return 'PETTY_WALLET';

  // Code fallbacks only when kind did not already classify.
  if (/^1001-C/i.test(code)) return 'CASHIER_TILL';
  if (/^1003-C/i.test(code)) return 'PETTY_WALLET';
  if (code === '1004') return 'LOCKER';

  if (apiType === 'CASH') {
    if (!kind || kind === 'OPERATING') return 'CASH_ON_HAND';
  }

  return 'OTHER';
}

/** Normalize API account for UI (additive fields). */
export function mapCashBankAccountFromApi(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = String(raw.kind || 'OPERATING');
  const apiType = String(raw.type || 'CASH').toUpperCase();
  const balance = Number(raw.balance != null ? raw.balance : Number.NaN);
  const storedBalance = Number(
    raw.storedBalance != null
      ? raw.storedBalance
      : raw.currentBalance != null
        ? raw.currentBalance
        : 0,
  );
  const glRaw = raw.glBalance;
  const glBalance =
    glRaw === null || glRaw === undefined
      ? null
      : Number.isFinite(Number(glRaw))
        ? Number(glRaw)
        : null;
  const sharedCoaWith = Array.isArray(raw.sharedCoaWith)
    ? raw.sharedCoaWith.map((id) => String(id))
    : [];
  const coaCode =
    raw.coaAccount?.code != null
      ? String(raw.coaAccount.code)
      : raw.coaCode != null
        ? String(raw.coaCode)
        : '';
  const row = {
    id: String(raw.id),
    name: raw.name || '',
    apiType,
    typeUi:
      apiType === 'BANK'
        ? 'Bank'
        : apiType === 'PETTY_CASH'
          ? 'Petty Cash'
          : 'Cash',
    branchId: raw.branchId != null ? String(raw.branchId) : '',
    branchName: raw.branch?.name ?? '',
    kind,
    isSystem: kind !== 'OPERATING',
    coaAccountId:
      raw.coaAccountId != null
        ? String(raw.coaAccountId)
        : raw.coaAccount?.id != null
          ? String(raw.coaAccount.id)
          : '',
    coaCode,
    coaLink: raw.coaAccount
      ? `${raw.coaAccount.code} · ${raw.coaAccount.name}`
      : '—',
    openingBalance: Number(raw.openingBalance ?? 0),
    currentBalance: Number(raw.currentBalance ?? 0),
    balance: Number.isFinite(balance) ? balance : 0,
    storedBalance: Number.isFinite(storedBalance) ? storedBalance : 0,
    glBalance,
    balanceSource: String(raw.balanceSource || 'stored'),
    sharedCoaWith,
    status: raw.status || 'active',
    allowNegativeBalance: raw.allowNegativeBalance === true,
    linkedPosTerminals: Array.isArray(raw.linkedPosTerminals)
      ? raw.linkedPosTerminals
      : [],
    _raw: raw,
  };
  row.registerClass = cashBankRegisterClass(row);
  return row;
}

function sumBalances(rows) {
  return rows.reduce((s, a) => s + displayCashBankBalance(a), 0);
}

/**
 * KPI cards from the APPLIED filtered account list.
 * - 0 → []
 * - 1–3 → one card per row (name + SAR balance + registerClass)
 * - >3 → one total per class that has ≥1 contributing row (shared_coa excluded)
 *   Order: Cash on hand, Cashier tills, Petty wallets, Locker, Bank, Other
 */
export function buildCashBankSummaryCards(filteredAccounts) {
  const list = Array.isArray(filteredAccounts) ? filteredAccounts : [];
  const rows = list.filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  if (rows.length <= 3) {
    return rows.map((a) => {
      const bal = displayCashBankBalance(a);
      const registerClass = cashBankRegisterClass(a);
      return {
        key: `acct-${a.id}`,
        kind: 'account',
        accountId: a.id,
        label: a.name,
        registerClass,
        typeKey: registerClass,
        typeLabel: registerClass,
        balance: bal,
        negative: bal < 0,
      };
    });
  }

  const forSum = accountsForBalanceSum(rows);
  const cards = [];
  for (const cls of CASH_BANK_REGISTER_CLASSES) {
    const typeRows = forSum.filter((a) => cashBankRegisterClass(a) === cls);
    if (typeRows.length === 0) continue;
    const balance = sumBalances(typeRows);
    cards.push({
      key: `total-${cls}`,
      kind: 'total',
      typeKey: cls,
      registerClass: cls,
      balance,
      accountCount: typeRows.length,
      negative: balance < 0,
    });
  }
  return cards;
}

export function shouldShowUnreconciledCard(summaryOrMeta) {
  const n = summaryOrMeta?.unreconciledCount;
  return Number.isFinite(Number(n));
}

/**
 * Client filter for Accounts tab (applied only on Apply).
 * `filters.type` is a register class (CASH_ON_HAND, …) or ALL.
 */
export function filterCashBankAccounts(accounts, filters = {}) {
  const q = String(filters.search || '')
    .trim()
    .toLowerCase();
  const registerClass = String(filters.type || filters.registerClass || '')
    .trim()
    .toUpperCase();
  const branchId = String(filters.branchId || '').trim();
  return (accounts || []).filter((a) => {
    if (!a) return false;
    if (registerClass && registerClass !== 'ALL') {
      if (cashBankRegisterClass(a) !== registerClass) return false;
    }
    if (branchId) {
      const rowBranch = String(a.branchId || '').trim();
      if (rowBranch && rowBranch !== branchId) return false;
    }
    if (q) {
      const hay = `${a.name || ''} ${a.branchName || a.branch || ''} ${a.coaLink || ''} ${a.id}`
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function pageCashBankRows(rows, { page = 1, pageSize = CASH_BANK_PAGE_SIZE } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const size = Math.max(1, Number(pageSize) || CASH_BANK_PAGE_SIZE);
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const offset = (current - 1) * size;
  return {
    rows: list.slice(offset, offset + size),
    total,
    page: current,
    pageCount,
    pageSize: size,
    offset,
  };
}

/**
 * Reconcile tab UI mode (P-A21C).
 * @returns {'no-access'|'pick-bank'|'loading'|'error'|'no-draft'|'draft'}
 */
export function reconcileUiState({
  hasBank,
  canView,
  loading,
  error,
  state,
} = {}) {
  if (!canView) return 'no-access';
  if (!hasBank) return 'pick-bank';
  if (loading) return 'loading';
  if (error) return 'error';
  if (state?.draft) return 'draft';
  return 'no-draft';
}

/**
 * Map API error → i18n key + params.
 * Reads `err.code` / `err.response.data` (and extra fields attached by recon API helpers).
 */
export function reconcileErrorKey(err) {
  const data =
    err?.response?.data && typeof err.response.data === 'object'
      ? err.response.data
      : err && typeof err === 'object'
        ? err
        : {};
  const code = String(data?.code || err?.code || '')
    .trim()
    .toUpperCase();
  const differenceRaw =
    data?.difference != null ? data.difference : err?.difference;
  const primaryRegisterId = String(
    data?.primaryRegisterId ?? err?.primaryRegisterId ?? '',
  ).trim();

  switch (code) {
    case 'RECONCILE_NOT_BANK':
      return { key: 'cb.recon.err.notBank', params: {} };
    case 'RECONCILE_SHARED_COA':
      return {
        key: 'cb.recon.err.sharedCoa',
        params: { primaryRegisterId },
      };
    case 'RECONCILE_DIFFERENCE_NOT_ZERO': {
      const formatted = formatMoneyString(
        differenceRaw != null ? String(differenceRaw) : '0.00',
      ).text;
      return {
        key: 'cb.recon.err.diffNotZero',
        params: { difference: formatted },
      };
    }
    case 'RECONCILE_NO_ITEMS':
      return { key: 'cb.recon.err.noItems', params: {} };
    case 'RECONCILE_DATE_BEFORE_LAST':
      return { key: 'cb.recon.err.dateBeforeLast', params: {} };
    case 'RECONCILE_DATE_IN_FUTURE':
      return { key: 'cb.recon.err.dateInFuture', params: {} };
    case 'RECONCILE_BUSY':
      return { key: 'cb.recon.err.busy', params: {} };
    case 'RECONCILE_LINE_ALREADY_CLEARED':
      return { key: 'cb.recon.err.lineCleared', params: {} };
    case 'RECONCILE_LINE_INELIGIBLE':
      return { key: 'cb.recon.err.lineIneligible', params: {} };
    case 'RECONCILE_UNDO_ONLY_LATEST':
      return { key: 'cb.recon.err.undoOnlyLatest', params: {} };
    case 'RECONCILE_UNDO_REASON':
      return { key: 'cb.recon.err.undoReason', params: {} };
    case 'RECONCILE_NO_DRAFT':
      return { key: 'cb.recon.err.noDraft', params: {} };
    default:
      return {
        key: 'cb.recon.err.generic',
        params: {
          message: String(err?.message || data?.message || 'Request failed'),
        },
      };
  }
}

/**
 * Finish enabled only when server difference is exactly the string "0.00"
 * and tickedCount is an integer ≥ 1.
 */
export function isReconcileFinishEnabled(summary) {
  if (!summary || typeof summary !== 'object') return false;
  if (summary.difference !== '0.00') return false;
  if (!Number.isInteger(summary.tickedCount)) return false;
  return summary.tickedCount >= 1;
}

/**
 * String-only money display (Western digits, commas, 2 dp). Never Number/parseFloat.
 * @returns {{ text: string, isNegative: boolean }}
 */
export function formatMoneyString(str) {
  const raw = String(str ?? '').trim();
  const isNegative = raw.startsWith('-');
  let body = isNegative ? raw.slice(1) : raw;
  body = body.replace(/,/g, '').trim();
  if (body === '' || !/^\d+(\.\d*)?$/.test(body)) {
    return { text: '0.00', isNegative: false };
  }
  const dot = body.indexOf('.');
  let intPart = dot === -1 ? body : body.slice(0, dot);
  let frac = dot === -1 ? '' : body.slice(dot + 1);
  intPart = intPart.replace(/^0+(?=\d)/, '') || '0';
  if (frac.length === 0) frac = '00';
  else if (frac.length === 1) frac = `${frac}0`;
  else frac = frac.slice(0, 2);

  let grouped = '';
  for (let i = intPart.length - 1, n = 0; i >= 0; i -= 1, n += 1) {
    if (n > 0 && n % 3 === 0) grouped = `,${grouped}`;
    grouped = `${intPart[i]}${grouped}`;
  }
  const text = `${isNegative ? '-' : ''}${grouped}.${frac}`;
  return { text, isNegative };
}

/** Journal line ids on the page whose ticked flag differs from `ticked`. */
export function pageTickIds(items, ticked) {
  const want = Boolean(ticked);
  return (items || [])
    .filter((it) => Boolean(it?.ticked) !== want)
    .map((it) => String(it.journalLineId));
}

/** Shared-COA hint: resolve peer ids to names from the account list. */
export function sharedCoaPeerNames(sharedCoaWith, accounts) {
  const ids = Array.isArray(sharedCoaWith) ? sharedCoaWith.map(String) : [];
  if (!ids.length) return [];
  const byId = new Map((accounts || []).map((a) => [String(a.id), a.name || a.id]));
  return ids.map((id) => byId.get(id) || id);
}

/** True if any loaded row classifies as OTHER (for optional Type dropdown entry). */
export function hasOtherRegisterClass(accounts) {
  return (accounts || []).some((a) => cashBankRegisterClass(a) === 'OTHER');
}

/** i18n key for a register class (filter / cards / table Type column). */
export function cashBankRegisterClassLabelKey(registerClass) {
  switch (String(registerClass || '').trim()) {
    case 'CASH_ON_HAND':
      return 'cb.type.cashOnHand';
    case 'CASHIER_TILL':
      return 'cb.type.cashierTills';
    case 'PETTY_WALLET':
      return 'cb.type.pettyWallets';
    case 'LOCKER':
      return 'cb.type.locker';
    case 'BANK':
      return 'cb.type.bank';
    case 'OTHER':
      return 'cb.type.other';
    default:
      return 'cb.type.other';
  }
}
