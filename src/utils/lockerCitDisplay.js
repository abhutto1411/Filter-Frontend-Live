/**
 * Pure helpers for Locker Cash in Transit screens (P-A19B / mockups 31, 32).
 * Money values stay as API numbers/strings — format only; FIFO selection
 * sums use integer halalas so display totals match selected rows.
 */
import { expenseVatTooHigh, isClaimableVatNumber } from './collectionExpenseVat.js';

export const LOCKER_CIT_PAGE_SIZE = 25;
export const LOCKER_CIT_AGING_OVER_DAYS = 3;

/** Western digits, 2 dp; returns '' for null/undefined/blank. */
export function formatCitMoneyLatn(raw) {
  if (raw == null || raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(n);
}

/** YYYY-MM-DD or YYYY-MM-DD HH:mm from ISO (slice only — no TZ convert). */
export function formatCitStamp(iso, withTime = false) {
  if (iso == null || iso === '') return '';
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    if (withTime && s.length >= 16) return s.slice(0, 16).replace('T', ' ');
    return s.slice(0, 10);
  }
  return s;
}

/**
 * Session open/close stamp in Asia/Riyadh, Gregorian, Latin digits.
 * Example: 2026-11-17T05:30:00Z → 17/11/2026 08:30 AM
 * @param {string|null|undefined} iso
 * @param {'en'|'ar'} lang
 */
export function formatRiyadhSessionStamp(iso, lang = 'en') {
  if (iso == null || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const locale =
    lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Riyadh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return formatCitStamp(iso, true) || '—';
  }
}

/** Alias — session stamps and business datetimes share the same Riyadh formatter. */
export function formatRiyadhDateTime(iso, lang = 'en') {
  return formatRiyadhSessionStamp(iso, lang);
}

/** Dropdown hint: branch · cashier · Open … → Close … */
export function formatCollectionSessionHint(row, lang = 'en') {
  const branch = row?.branchName || '—';
  const cashier = row?.cashierName || '—';
  const open = formatRiyadhSessionStamp(row?.sessionOpenedAt, lang);
  const close = formatRiyadhSessionStamp(row?.sessionClosedAt, lang);
  return `${branch} · ${cashier} · Open ${open} → Close ${close}`;
}

export function daysHeldTone(days) {
  const n = Number(days);
  if (!Number.isFinite(n)) return 'neutral';
  if (n > LOCKER_CIT_AGING_OVER_DAYS) return 'bad';
  if (n >= 2) return 'warn';
  return 'ok';
}

export function agingBucketLabel(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n < 0) return 'any';
  if (n <= 1) return '0-1';
  if (n <= 3) return '2-3';
  if (n <= 7) return '4-7';
  return '>7';
}

export function matchesAgingFilter(days, aging) {
  if (!aging || aging === 'any' || aging === 'all') return true;
  const bucket = agingBucketLabel(days);
  return bucket === aging;
}

/** Map GET /locker/cit/summary → card values (null = hide card/value). */
export function mapCitOverviewCards(summary, coverage) {
  const s = summary && typeof summary === 'object' ? summary : {};
  const cov = coverage && typeof coverage === 'object' ? coverage : {};
  const status = String(cov.status || s.coverageStatus || '');
  const asOf = s.asOfHoldings != null ? String(s.asOfHoldings) : null;
  const showHoldings =
    !status || status === 'complete' || status === 'verified_empty';
  const holdings = asOf != null ? asOf : s.totalInTransit != null ? String(s.totalInTransit) : null;
  return {
    vaultCash: s.vaultCash != null ? String(s.vaultCash) : null,
    totalInTransit: showHoldings ? holdings : null,
    officers: s.officers != null ? String(s.officers) : null,
    over3Days: s.over3Days != null ? String(s.over3Days) : null,
    over3DaysAmount: s.over3DaysAmount != null ? String(s.over3DaysAmount) : null,
    pendingVariances: s.pendingVariances != null ? String(s.pendingVariances) : null,
    coverageStatus: status || null,
  };
}

/** Map officer wallet payload → card values. */
export function mapOfficerWalletCards(wallet) {
  const w = wallet && typeof wallet === 'object' ? wallet : {};
  const open = Array.isArray(w.openCollections) ? w.openCollections : [];
  const oldest = open.reduce((max, row) => {
    const d = Number(row?.daysHeld);
    if (!Number.isFinite(d)) return max;
    return max == null ? d : Math.max(max, d);
  }, null);
  const handovers = Array.isArray(w.handovers) ? w.handovers : [];
  const monthPrefix = (() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  })();
  const handoversThisMonth =
    w.handoversThisMonth != null
      ? Number(w.handoversThisMonth)
      : handovers.filter((h) => String(h?.receivedAt || '').startsWith(monthPrefix)).length;

  const cov = String(w.coverage?.status || '');
  const asOf =
    cov === 'complete' || cov === 'verified_empty'
      ? w.custody?.closingHoldings
      : null;
  const balance =
    cov
      ? asOf != null
        ? String(asOf)
        : null
      : w.balance != null
        ? String(w.balance)
        : null;
  return {
    officerName: w.officer?.name || w.officer?.email || null,
    accountCode: w.accountCode != null ? String(w.accountCode) : null,
    balance,
    openCount: open.length,
    oldestDays: oldest,
    handoversThisMonth,
  };
}

function toHalalas(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromHalalas(h) {
  return h / 100;
}

/**
 * FIFO selection: collections must be oldest-first contiguous from the start
 * of the sorted (by collectedAt asc) list. Returns ordered selected ids + expected sum.
 */
export function fifoSelectCollections(openCollections, selectedIds) {
  const rows = Array.isArray(openCollections) ? openCollections.slice() : [];
  rows.sort((a, b) => {
    const ta = String(a?.collectedAt || '');
    const tb = String(b?.collectedAt || '');
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
  const want = new Set((selectedIds || []).map(String));
  const selected = [];
  let expectedHalalas = 0;
  let broken = false;
  for (let i = 0; i < rows.length; i += 1) {
    const id = String(rows[i].id);
    if (!want.has(id)) {
      if (selected.length > 0) {
        // later rows selected while an earlier gap exists → invalid FIFO
        for (let j = i + 1; j < rows.length; j += 1) {
          if (want.has(String(rows[j].id))) {
            broken = true;
            break;
          }
        }
      }
      break;
    }
    selected.push(rows[i]);
    expectedHalalas += toHalalas(rows[i].amount ?? rows[i].receivedAmount);
  }
  // If selection skips earlier rows entirely
  if (!broken && want.size > 0) {
    for (let i = 0; i < rows.length; i += 1) {
      if (want.has(String(rows[i].id))) {
        for (let j = 0; j < i; j += 1) {
          if (!want.has(String(rows[j].id))) {
            broken = true;
            break;
          }
        }
        break;
      }
    }
  }
  return {
    selected,
    selectedIds: selected.map((r) => String(r.id)),
    expectedAmount: fromHalalas(expectedHalalas),
    fifoValid: !broken && selected.length === want.size,
    sorted: rows,
  };
}

/** Toggle id under FIFO rule: clicking a row selects 0..index inclusive. */
export function fifoToggleThroughIndex(openCollections, index) {
  const rows = Array.isArray(openCollections) ? openCollections.slice() : [];
  rows.sort((a, b) => {
    const ta = String(a?.collectedAt || '');
    const tb = String(b?.collectedAt || '');
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
  if (index < 0 || index >= rows.length) return [];
  return rows.slice(0, index + 1).map((r) => String(r.id));
}

/**
 * Journal preview lines for receive panel (display only from counted/expected).
 * Returns { lines, balanced } — balanced when Dr total == Cr total (halalas).
 */
export function buildReceiveJournalPreview({
  destination = 'vault',
  countedAmount,
  expectedAmount,
  vaultCode = '1004',
  bankLabel = 'Bank',
  officerCode = '1005-O',
  officerName = '',
  /** Stage B "received with expenses": [{ gross, branchLabel, label }] → Dr clearing (pending). */
  expenses = [],
  clearingCode = null,
  clearingName = null,
  /** Shown when clearing account is not yet provisioned (never hard-code 1156). */
  clearingPendingLabel = 'Pending-expenses clearing (created on save)',
}) {
  const countedH = toHalalas(countedAmount);
  const expectedH = toHalalas(expectedAmount);
  const expList = Array.isArray(expenses) ? expenses : [];
  const expensesH = expList.reduce((s, e) => s + Math.max(0, toHalalas(e?.gross)), 0);
  const diffH = countedH + expensesH - expectedH; // negative = shortage
  const lines = [];
  const destLabel =
    destination === 'bank' ? bankLabel : `${vaultCode} Locker Vault Cash`;
  if (countedH > 0) {
    lines.push({
      account: destLabel,
      dr: fromHalalas(countedH),
      cr: null,
    });
  }
  for (const e of expList) {
    const h = toHalalas(e?.gross);
    if (h <= 0) continue;
    const clearingLabel =
      clearingCode || clearingName
        ? `${clearingCode || ''}${clearingCode && clearingName ? ' ' : ''}${clearingName || ''}`.trim()
        : clearingPendingLabel || 'Pending-expenses clearing (created on save)';
    lines.push({
      account: `${clearingLabel}${e?.label ? ` — ${e.label}` : ''}`,
      branchLabel: e?.branchLabel || '',
      dr: fromHalalas(h),
      cr: null,
      pending: true,
    });
  }
  if (diffH < 0) {
    lines.push({
      account: '1153 Locker Collection Variance',
      dr: fromHalalas(-diffH),
      cr: null,
    });
  }
  if (expectedH > 0) {
    const nameBit = officerName ? ` — ${officerName}` : '';
    lines.push({
      account: `${officerCode} Cash in Transit${nameBit}`,
      dr: null,
      cr: fromHalalas(expectedH),
    });
  }
  const drTotal = lines.reduce((s, l) => s + toHalalas(l.dr), 0);
  const crTotal = lines.reduce((s, l) => s + toHalalas(l.cr), 0);
  return {
    lines,
    difference: fromHalalas(diffH),
    expensesTotal: fromHalalas(expensesH),
    /** E5: counted + expenses above what the officer holds is never allowed. */
    aboveExpected: diffH > 0,
    balanced: diffH <= 0 && drTotal === crTotal && drTotal > 0,
  };
}

/** Distinct branches of the selected open CIT collections (Stage B expense branch picker). */
export function stageBBranchOptions(openCollections, selectedIds) {
  const want = new Set((selectedIds || []).map(String));
  const byId = new Map();
  for (const c of Array.isArray(openCollections) ? openCollections : []) {
    if (!want.has(String(c?.id))) continue;
    const id = c?.branchId != null ? String(c.branchId) : '';
    if (!id) continue;
    const prev = byId.get(id) || { id, label: c?.branchName || id, totalH: 0 };
    prev.totalH += toHalalas(c?.amount ?? c?.receivedAmount);
    byId.set(id, prev);
  }
  return [...byId.values()].sort((a, b) => b.totalH - a.totalH || a.id.localeCompare(b.id));
}

/** Validate Stage B expense lines → { ok, errorKey, index }. Mirrors BE normalizeCollectionExpenseLines. */
export function validateStageBExpenseLines(lines, vatPercent = 15) {
  const list = Array.isArray(lines) ? lines : [];
  if (list.length === 0) return { ok: false, errorKey: 'cit.receive.exp.errNone', index: -1 };
  if (list.length > 10) return { ok: false, errorKey: 'cit.receive.exp.errMax', index: -1 };
  for (let i = 0; i < list.length; i += 1) {
    const l = list[i] || {};
    const g = String(l.gross ?? '').trim();
    const v = String(l.vat ?? '').trim() || '0';
    if (!/^\d+(\.\d{1,2})?$/.test(g) || toHalalas(g) <= 0) {
      return { ok: false, errorKey: 'cit.receive.exp.errGross', index: i };
    }
    if (!/^\d+(\.\d{1,2})?$/.test(v) || toHalalas(v) > toHalalas(g)) {
      return { ok: false, errorKey: 'cit.receive.exp.errVat', index: i };
    }
    if (expenseVatTooHigh(l, vatPercent)) {
      return { ok: false, errorKey: 'cit.receive.exp.errVatTooHigh', index: i };
    }
    if (String(l.supplierVatNumber || '').trim() && !isClaimableVatNumber(l.supplierVatNumber)) {
      return { ok: false, errorKey: 'cit.receive.exp.errVatNumber', index: i };
    }
    if (!String(l.expenseAccountId || '').trim()) {
      return { ok: false, errorKey: 'cit.receive.exp.errAccount', index: i };
    }
  }
  return { ok: true, errorKey: null, index: -1 };
}

/** API body lines for POST /locker/cit/receive `expenses` (money as 2-dp strings). */
export function buildStageBExpensesPayload(lines) {
  return (Array.isArray(lines) ? lines : []).map((l) => {
    const proof = String(l?.proofUrl || '').trim();
    return {
      expenseAccountId: l?.expenseAccountId ? String(l.expenseAccountId) : undefined,
      category: String(l?.category || '').trim() || undefined,
      grossAmount: (toHalalas(l?.gross) / 100).toFixed(2),
      vatAmount: (toHalalas(l?.vat || 0) / 100).toFixed(2),
      proofUrl: proof || undefined,
      note: String(l?.note || l?.description || '').trim() || undefined,
      branchId: l?.branchId ? String(l.branchId) : undefined,
      billNo: String(l?.billNo || '').trim() || undefined,
      supplierVatNumber: String(l?.supplierVatNumber || '').trim() || undefined,
    };
  });
}

export function sliceCitPage(rows, page, pageSize = LOCKER_CIT_PAGE_SIZE) {
  const list = Array.isArray(rows) ? rows : [];
  const size = Math.max(1, Number(pageSize) || LOCKER_CIT_PAGE_SIZE);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / size) || 1);
  const p = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (p - 1) * size;
  return {
    rows: list.slice(start, start + size),
    page: p,
    pageSize: size,
    total,
    totalPages,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
  };
}

/** Default charge-to when rejecting a shortage (mirrors BE). */
export function defaultChargeToForApproval(row) {
  const kind = String(row?.kind || 'collection').toLowerCase();
  const diff = Number(row?.difference);
  const isShortage = Number.isFinite(diff) && diff < 0;
  if (!isShortage) return 'none';
  return kind === 'handover' ? 'officer' : 'cashier';
}

/**
 * Map locker CIT HTTP error codes to i18n keys.
 * 409 is not always a failed posting — identity/cap/policy stay distinct.
 */
export function isPrismaClientNoise(err) {
  const text = [
    err?.message,
    err?.response?.message,
    typeof err?.response === 'string' ? err.response : '',
  ]
    .filter(Boolean)
    .join('\n');
  return /Transaction not found|Invalid `db\.|PrismaClient|prisma\./i.test(
    String(text),
  );
}

export function lockerCitErrorI18nKey(err) {
  const code = String(err?.code || err?.response?.code || '').trim();
  if (
    code === 'LOCKER_CIT_NOT_PROVISIONED' ||
    code === 'LOCKER_CIT_OFFICER_NOT_FOUND'
  ) {
    return 'cit.err.notProvisioned';
  }
  if (
    code === 'LOCKER_CIT_NAMESPACE_COLLISION' ||
    code === 'LOCKER_CIT_ROLE_CONFLICT'
  ) {
    return 'cit.err.collision';
  }
  if (isPrismaClientNoise(err)) return 'cit.err.unavailable';
  if (code === 'LOCKER_CIT_POPULATION_CAP') return 'cit.err.populationCap';
  if (code === 'LOCKER_CIT_IDENTITY_REQUIRED') return 'cit.err.identity';
  if (
    code === 'LOCKER_CIT_IDEMPOTENCY_CONFLICT' ||
    code === 'LOCKER_COLLECTION_IDEMPOTENCY_CONFLICT'
  ) {
    return 'cit.err.idempotency';
  }
  if (
    code === 'LOCKER_CIT_FORBIDDEN' ||
    code === 'LOCKER_CIT_SELF_RECEIVE'
  ) {
    return 'cit.err.policy';
  }
  if (
    code === 'LOCKER_CIT_CLAIM_CONFLICT' ||
    code === 'LOCKER_CIT_CLAIM_MISMATCH'
  ) {
    return 'cit.err.busy';
  }
  if (
    code === 'ACCOUNT_ROLE_INSUFFICIENT' ||
    code === 'LOCKER_CIT_RECEIPT_FAILED'
  ) {
    return 'cit.err.receipt';
  }
  return null;
}

export function citResponseMatchesApplied(scope, applied) {
  if (!scope || typeof scope !== 'object' || !applied) return false;
  const from = String(applied.from || '').trim();
  const to = String(applied.to || '').trim();
  if (from && scope.fromYmd !== from) return false;
  if (to && scope.toYmd !== to) return false;
  const branch = String(applied.branchId || '').trim();
  const scopeBranch = String(scope.branchId || '').trim();
  if (branch && scopeBranch && branch !== scopeBranch) return false;
  const officer = String(applied.officerUserId || '').trim();
  const scopeOfficer = String(scope.officerUserId || '').trim();
  if (officer && scopeOfficer && officer !== scopeOfficer) return false;
  if (applied.generation && scope.generation !== String(applied.generation)) {
    return false;
  }
  return true;
}

export function citCoverageTone(status) {
  if (status === 'verified_empty' || status === 'complete') return 'ok';
  if (status === 'partial' || status === 'legacy_unclassified') return 'warn';
  if (status === 'unavailable' || status === 'error' || status === 'forbidden') {
    return 'bad';
  }
  return 'neutral';
}

/** Banner kind for POST /locker/record-collection — pickup vs receipt. */
export function collectionRecordBannerKind(res) {
  const receiptStatus = res?.receipt?.status || res?.collection?.receiptStatus;
  if (receiptStatus === 'failed') return 'receipt_failed';
  if (receiptStatus === 'skipped_policy') return 'pickup_cit';
  if (res?.collection?.status === 'pending_approval') return 'pickup_pending';
  if (receiptStatus === 'not_requested') return 'pickup_cit';
  return 'pickup_ok';
}

export function citApprovalKindBadge(kind) {
  const k = String(kind || '').toLowerCase();
  if (k === 'handover') return { key: 'handover', tone: 'warn' };
  if (k === 'collection' || k === 'pickup') return { key: 'pickup', tone: 'info' };
  return { key: 'unknown', tone: 'neutral' };
}

/** Stable empty journal preview — every early return uses a fresh object. */
export function emptyPreview(previewError = null, blocked = null) {
  return {
    journals: [],
    flatLines: [],
    balanced: false,
    lineCount: 0,
    blocked: blocked ?? null,
    previewError,
  };
}

const VARIANCE_CODE = '1153';
const VARIANCE_NAME = 'Locker Collection Variance';
const PENDING_EXP_CODE = '1156';
const PENDING_EXP_NAME = 'Pending collection expenses';

function previewBlocked(reasonKey, extra = {}) {
  // Relocate only helps when an operational account occupies the CIT code (collision);
  // a missing heading is fixed by Provision, not by relocate.
  const isCitCollision =
    reasonKey === 'LOCKER_CIT_NAMESPACE_COLLISION' ||
    reasonKey === 'LOCKER_CIT_ROLE_CONFLICT';
  return {
    reasonKey,
    params: extra.params && typeof extra.params === 'object' ? extra.params : {},
    actionKey: extra.actionKey !== undefined ? extra.actionKey : isCitCollision ? 'relocateCit' : null,
  };
}

function journalLine({ side, code, name, branchLabel, amountH }) {
  const amount = fromHalalas(amountH);
  return {
    side,
    code: code != null ? String(code) : '',
    name: name != null ? String(name) : '',
    branchLabel: branchLabel != null ? String(branchLabel) : '',
    amount,
  };
}

function lineAccountLabel(line) {
  const codeName = [line.code, line.name].filter(Boolean).join(' ').trim();
  return codeName || line.name || line.code || '';
}

function toFlatLine(journalNo, journalTitle, line) {
  return {
    journalNo,
    journalTitle,
    account: lineAccountLabel(line),
    side: line.side,
    code: line.code,
    name: line.name,
    branchLabel: line.branchLabel,
    amount: line.amount,
    dr: line.side === 'Dr' ? line.amount : null,
    cr: line.side === 'Cr' ? line.amount : null,
  };
}

function sumJournalHalalas(journals) {
  let dr = 0;
  let cr = 0;
  for (const j of journals) {
    for (const line of j.lines || []) {
      if (line.side === 'Dr') dr += toHalalas(line.amount);
      if (line.side === 'Cr') cr += toHalalas(line.amount);
    }
  }
  return { dr, cr };
}

/**
 * Map GET /locker/record-collection/context onto the debit account the
 * preview must show. Never invent `1005-O` when the leaf is missing.
 * flag OFF → 1004 Locker Vault Cash; flag ON → the returned leaf.
 */
export function collectionRecordDebitFromContext(ctx) {
  if (!ctx || ctx.citEnabled !== true) {
    return {
      debitCode: ctx?.debitAccount?.code || '1004',
      debitName: ctx?.debitAccount?.name || 'Locker Vault Cash',
      blocked: false,
      officerLeafStatus: null,
    };
  }
  const status = ctx.officerLeafStatus;
  if (status === 'missing' || status === 'conflict' || !ctx.debitAccount?.code) {
    return {
      debitCode: ctx.debitAccount?.code || null,
      debitName: ctx.debitAccount?.name || null,
      blocked: true,
      officerLeafStatus: status === 'conflict' ? 'conflict' : 'missing',
    };
  }
  return {
    debitCode: ctx.debitAccount.code,
    debitName: ctx.debitAccount.name || '',
    blocked: false,
    officerLeafStatus: 'ok',
  };
}

/**
 * Journal preview for Record collection (mockup 33 / §4.1).
 * JE1 pickup: Dr CIT or vault (received); Dr 1156 for pending expenses; Dr/Cr 1153; Cr till (expected).
 * Optional JE vault-receive; optional JE "on approval" when expenses present.
 * Accepts new `{ expected, received, … }` or legacy `{ expectedAmount, receivedAmount, officerCode, blocked }`.
 */
export function buildCollectionRecordJournalPreview(raw = {}) {
  const expectedRaw = raw.expected ?? raw.expectedAmount;
  const receivedRaw = raw.received ?? raw.receivedAmount;
  const officerName =
    (raw.officer && (raw.officer.name || raw.officer.label)) ||
    raw.officerName ||
  '';
  const citEnabled = raw.citEnabled === true;
  const vaultCode = raw.vaultCode != null ? String(raw.vaultCode) : '1004';
  const tillCode = raw.tillCode != null ? String(raw.tillCode) : '1001-C';
  const tillName = raw.tillName != null ? String(raw.tillName) : '';
  const receiveIntoVaultNow = Boolean(raw.receiveIntoVaultNow);
  const branchLabel =
    raw.branchLabel != null && raw.branchLabel !== ''
      ? String(raw.branchLabel)
      : raw.branch?.name != null
        ? String(raw.branch.name)
        : '';
  const expenses = Array.isArray(raw.expenses) ? raw.expenses : [];
  const debitCode =
    raw.debitCode || raw.citLeafCode || raw.officerCode || null;
  const debitName = raw.debitName || '';
  // Pending-expenses clearing (system role; 1156 unless resolved to another code) and input VAT.
  const clearingCode = raw.clearingCode ? String(raw.clearingCode) : PENDING_EXP_CODE;
  const clearingName = raw.clearingName ? String(raw.clearingName) : PENDING_EXP_NAME;
  const vatInputCode = raw.vatInputCode ? String(raw.vatInputCode) : '1310';
  const vatInputName = raw.vatInputName ? String(raw.vatInputName) : 'VAT Input (Receivable)';

  if (raw.blockReasonKey) {
    const blocked = previewBlocked(String(raw.blockReasonKey), raw);
    return emptyPreview(String(raw.blockReasonKey), blocked);
  }

  if (raw.blocked === true) {
    const key =
      raw.officerLeafStatus === 'conflict'
        ? 'LOCKER_CIT_NAMESPACE_COLLISION'
        : 'LOCKER_CIT_NOT_PROVISIONED';
    return emptyPreview(key, previewBlocked(key));
  }

  if (raw.periodLocked) {
    const key = 'PERIOD_LOCKED';
    const params =
      raw.periodDate != null && raw.periodDate !== ''
        ? { periodDate: String(raw.periodDate) }
        : {};
    return emptyPreview(key, previewBlocked(key, { params, actionKey: null }));
  }

  const receivedH = toHalalas(receivedRaw);
  const expectedH =
    expectedRaw == null || expectedRaw === ''
      ? receivedH
      : toHalalas(expectedRaw);
  const expensesH = expenses.reduce(
    (s, e) => s + toHalalas(e?.amount ?? e),
    0,
  );

  const amountEmpty = raw.amountEmpty === true || receivedH <= 0;
  if (amountEmpty) {
    return emptyPreview();
  }

  const officerOk =
    raw.officerSelected !== false && Boolean(debitCode);
  if (citEnabled && !officerOk) {
    const key = 'CHOOSE_OFFICER_AMOUNT';
    return emptyPreview(
      key,
      previewBlocked(key, { actionKey: null }),
    );
  }

  if (!debitCode) {
    return emptyPreview();
  }

  const vaultDebit =
    !citEnabled ||
    String(debitCode).trim() === String(vaultCode).trim() ||
    String(debitCode).trim() === '1004';

  if (
    receiveIntoVaultNow &&
    receivedH + expensesH > expectedH &&
    expectedH > 0
  ) {
    const key = 'LOCKER_CIT_COUNT_ABOVE_EXPECTED';
    return emptyPreview(key, previewBlocked(key, { actionKey: null }));
  }

  const debitDisplayName = vaultDebit
    ? debitName || 'Locker Vault Cash'
    : debitName || `Cash in Transit${officerName ? ` — ${officerName}` : ''}`;
  const tillDisplayName = tillName ? `Till — ${tillName}` : 'Till';
  const citBranch = vaultDebit ? '' : branchLabel;

  const pickupLines = [];
  pickupLines.push(
    journalLine({
      side: 'Dr',
      code: debitCode,
      name: debitDisplayName,
      branchLabel: citBranch,
      amountH: receivedH,
    }),
  );
  if (expensesH > 0) {
    pickupLines.push(
      journalLine({
        side: 'Dr',
        code: clearingCode,
        name: clearingName,
        branchLabel,
        amountH: expensesH,
      }),
    );
  }
  const diffH = receivedH + expensesH - expectedH;
  if (diffH < 0) {
    pickupLines.push(
      journalLine({
        side: 'Dr',
        code: VARIANCE_CODE,
        name: VARIANCE_NAME,
        branchLabel,
        amountH: -diffH,
      }),
    );
  } else if (diffH > 0) {
    pickupLines.push(
      journalLine({
        side: 'Cr',
        code: VARIANCE_CODE,
        name: VARIANCE_NAME,
        branchLabel,
        amountH: diffH,
      }),
    );
  }
  pickupLines.push(
    journalLine({
      side: 'Cr',
      code: tillCode,
      name: tillDisplayName,
      branchLabel,
      amountH: expectedH,
    }),
  );

  const journals = [
    {
      journalNo: 1,
      title: 'Pickup',
      source: 'locker_pickup',
      date: raw.date ?? null,
      lines: pickupLines,
    },
  ];

  let journalNo = 2;
  if (receiveIntoVaultNow && !vaultDebit && receivedH > 0) {
    journals.push({
      journalNo,
      title: 'Vault receive',
      source: 'locker_cit_receive',
      date: raw.date ?? null,
      lines: [
        journalLine({
          side: 'Dr',
          code: vaultCode,
          name: 'Locker Vault Cash',
          branchLabel: '',
          amountH: receivedH,
        }),
        journalLine({
          side: 'Cr',
          code: debitCode,
          name: debitDisplayName,
          branchLabel: citBranch,
          amountH: receivedH,
        }),
      ],
    });
    journalNo += 1;
  }

  if (expenses.length > 0) {
    // Approval: Dr chosen account (net when the VAT is claimable, else gross)
    // + Dr input VAT (only with a valid supplier VAT number) / Cr pending clearing (gross).
    const approvalLines = [];
    for (const e of expenses) {
      const lineBranch =
        e?.branchLabel != null && e.branchLabel !== '' ? String(e.branchLabel) : branchLabel;
      const grossH = toHalalas(e?.amount ?? e);
      const vatH = Math.max(0, toHalalas(e?.vatAmount ?? 0));
      const expenseH =
        e?.expenseAmount != null ? toHalalas(e.expenseAmount) : grossH - vatH;
      approvalLines.push(
        journalLine({
          side: 'Dr',
          code: e?.code != null && e.code !== '' ? String(e.code) : '—',
          name:
            e?.name != null && e.name !== ''
              ? String(e.name)
              : e?.description != null
                ? String(e.description)
                : 'Expense account',
          branchLabel: lineBranch,
          amountH: expenseH,
        }),
      );
      if (vatH > 0) {
        approvalLines.push(
          journalLine({
            side: 'Dr',
            code: vatInputCode,
            name: vatInputName,
            branchLabel: lineBranch,
            amountH: vatH,
          }),
        );
      }
    }
    approvalLines.push(
      journalLine({
        side: 'Cr',
        code: clearingCode,
        name: clearingName,
        branchLabel,
        amountH: expensesH,
      }),
    );
    journals.push({
      journalNo,
      title: 'on approval',
      source: 'locker_expense_clear',
      date: raw.date ?? null,
      lines: approvalLines,
    });
  }

  const flatLines = journals.flatMap((j) =>
    (j.lines || []).map((line) => toFlatLine(j.journalNo, j.title, line)),
  );
  const { dr, cr } = sumJournalHalalas(journals);

  return {
    journals,
    flatLines,
    balanced: dr === cr && dr > 0,
    lineCount: flatLines.length,
    blocked: null,
    previewError: null,
  };
}

function varianceApprovalRef(raw, kind) {
  if (raw?.referenceCode != null && String(raw.referenceCode).trim() !== '') {
    return String(raw.referenceCode);
  }
  if (raw?.ref != null && String(raw.ref).trim() !== '') {
    return String(raw.ref);
  }
  if (kind === 'handover' && raw?.handoverId != null) {
    return `HO-${raw.handoverId}`;
  }
  if (kind === 'collection' && raw?.requestId != null) {
    return `CCR-${raw.requestId}`;
  }
  const id = raw?.id;
  if (id != null && String(id).trim() !== '') {
    return `#${kind}-${id}`;
  }
  return null;
}

/** Map approvals API rows → table display fields (keeps full API row). */
/**
 * Collection expense claims (1156) are decided by the workshop admin through
 * /locker/expenses/:id/approve|reject, never through /locker/approve-difference
 * (that endpoint would treat the claim id as a collection id).
 */
export function isLockerExpenseClaimRow(row) {
  const kind = String(row?.kind || '').toLowerCase();
  const stage = String(row?.stage || '').toLowerCase();
  return kind === 'expense_claim' || stage === 'expense_claim';
}

export function mapVarianceApprovalRows(approvals) {
  const list = Array.isArray(approvals) ? approvals : [];
  return list.map((a) => {
    const kind = String(a?.kind || 'collection').toLowerCase();
    const stage = a?.stage != null ? String(a.stage) : null;
    const ref = varianceApprovalRef(a, kind);
    return {
      ...a,
      id: String(a?.id ?? ''),
      kind,
      stage,
      kindBadge: citApprovalKindBadge(kind),
      ref,
      officerName: a?.officerName != null ? String(a.officerName) : null,
      cashierName: a?.cashierName != null ? String(a.cashierName) : null,
      receiverName: a?.receiverName != null ? String(a.receiverName) : null,
      branchName: a?.branchName != null ? String(a.branchName) : null,
      branchNames: Array.isArray(a?.branchNames) ? a.branchNames : null,
      expected:
        a?.expected != null
          ? String(a.expected)
          : a?.expectedAmount != null
            ? String(a.expectedAmount)
            : null,
      actual:
        a?.actual != null
          ? String(a.actual)
          : a?.receivedAmount != null
            ? String(a.receivedAmount)
            : null,
      expensesTotal:
        a?.expensesTotal != null ? String(a.expensesTotal) : null,
      claimStage: a?.claimStage != null ? String(a.claimStage) : null,
      isExpenseClaim: kind === 'expense_claim' || stage === 'expense_claim',
      direction: a?.direction != null ? String(a.direction) : null,
      difference: a?.difference != null ? String(a.difference) : null,
      date: a?.date != null ? String(a.date) : a?.createdAt != null ? String(a.createdAt) : null,
      notes: a?.notes != null ? String(a.notes) : null,
      status: a?.status != null ? String(a.status) : null,
      posSessionNo:
        a?.posSessionNo != null ? String(a.posSessionNo) : null,
      defaultChargeTo: a?.defaultChargeTo || defaultChargeToForApproval(a),
      chargeOfficerLabel: a?.chargeOfficerLabel || a?.officerName || null,
      chargeCashierLabel: a?.chargeCashierLabel || a?.cashierName || null,
      raw: a,
    };
  });
}

/** Charge-to option list for reject panel. */
export function buildChargeToOptions(row) {
  const officer = row?.chargeOfficerLabel || row?.officerName || 'Officer';
  const cashier = row?.chargeCashierLabel || row?.cashierName || 'Cashier';
  return [
    { id: 'cashier', label: cashier },
    { id: 'officer', label: officer },
    { id: 'none', label: 'None' },
  ];
}


/** Relocate needs an audit reason of at least 5 characters (backend REASON_REQUIRED). */
export function isRelocateReasonValid(reason) {
  return String(reason ?? '').trim().length >= 5;
}

/** Normalise POST /locker/cit/namespace/relocate (dry-run or replay) for display. */
export function citRelocateDryRunView(res) {
  const r = res && typeof res === 'object' ? res : {};
  const c = r.colliding && typeof r.colliding === 'object' ? r.colliding : null;
  const bal = Number(c?.glBalance ?? 0);
  return {
    idempotent: r.idempotent === true,
    proposedCode: r.proposedHeadingCode != null ? String(r.proposedHeadingCode) : null,
    headingCode: r.heading?.code != null ? String(r.heading.code) : null,
    colliding: c
      ? {
          id: c.id != null ? String(c.id) : '',
          code: c.code != null ? String(c.code) : '',
          name: c.name != null ? String(c.name) : '',
          type: c.type != null ? String(c.type) : '',
          postedLineCount: Number(c.postedLineCount ?? 0),
          glBalance: (Number.isFinite(bal) ? bal : 0).toFixed(2),
        }
      : null,
    officers: Array.isArray(r.officersWouldGetLeaves)
      ? r.officersWouldGetLeaves.map((o) => ({
          officerUserId: String(o?.officerUserId ?? ''),
          code: String(o?.code ?? ''),
          name: o?.name != null ? String(o.name) : '',
        }))
      : [],
  };
}
