/**
 * Pure helpers for Locker Cash in Transit screens (P-A19B / mockups 31, 32).
 * Money values stay as API numbers/strings — format only; FIFO selection
 * sums use integer halalas so display totals match selected rows.
 */

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
}) {
  const countedH = toHalalas(countedAmount);
  const expectedH = toHalalas(expectedAmount);
  const diffH = countedH - expectedH; // negative = shortage
  const lines = [];
  const destLabel =
    destination === 'bank' ? bankLabel : `${vaultCode} Locker Vault Cash`;
  if (countedH > 0) {
    lines.push({ account: destLabel, dr: fromHalalas(countedH), cr: null });
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
    balanced: drTotal === crTotal && drTotal > 0,
  };
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
export function emptyPreview(previewError = null) {
  return {
    journals: [],
    flatLines: [],
    balanced: false,
    lineCount: 0,
    previewError,
  };
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
 * Journal preview for Record collection (mockup 33).
 * Journal 1: Dr CIT officer or vault / Cr till. Journal 2 (if receiveIntoVaultNow): Dr vault / Cr CIT.
 * Display-only from received amount + account labels — no invented totals.
 */
export function buildCollectionRecordJournalPreview({
  receivedAmount,
  expectedAmount,
  debitCode,
  debitName,
  officerCode,
  officerName = '',
  tillCode = '1001-C',
  tillName = '',
  vaultCode = '1004',
  receiveIntoVaultNow = false,
  blocked = false,
} = {}) {
  if (blocked) {
    return emptyPreview('LOCKER_CIT_NOT_PROVISIONED');
  }
  const receivedH = toHalalas(receivedAmount);
  const expectedH =
    expectedAmount == null || expectedAmount === ''
      ? receivedH
      : toHalalas(expectedAmount);
  const code = debitCode || officerCode;
  if (receivedH <= 0 || !code) {
    return emptyPreview();
  }
  const received = fromHalalas(receivedH);
  const expected = fromHalalas(expectedH);
  const diffH = receivedH - expectedH;
  const vaultDebit =
    String(code).trim() === String(vaultCode).trim() ||
    String(code).trim() === '1004';
  const debitLabel = vaultDebit
    ? `${code} ${debitName || 'Locker Vault Cash'}`
    : `${code} Cash in Transit${officerName ? ` — ${officerName}` : debitName ? ` — ${debitName}` : ''}`;
  const tillLabel = `${tillCode} Till${tillName ? ` — ${tillName}` : ''}`;
  const pickupLines = [];
  pickupLines.push({ account: debitLabel, dr: received, cr: null });
  if (diffH < 0) {
    pickupLines.push({
      account: '1153 Locker Collection Variance',
      dr: fromHalalas(-diffH),
      cr: null,
    });
  }
  pickupLines.push({ account: tillLabel, dr: null, cr: expected });
  if (diffH > 0) {
    pickupLines.push({
      account: '1153 Locker Collection Variance',
      dr: null,
      cr: fromHalalas(diffH),
    });
  }
  const journals = [{ journalNo: 1, lines: pickupLines }];
  if (receiveIntoVaultNow && !vaultDebit) {
    journals.push({
      journalNo: 2,
      lines: [
        { account: `${vaultCode} Locker Vault Cash`, dr: received, cr: null },
        { account: debitLabel, dr: null, cr: received },
      ],
    });
  }
  let dr = 0;
  let cr = 0;
  for (const j of journals) {
    for (const line of j.lines) {
      dr += toHalalas(line.dr);
      cr += toHalalas(line.cr);
    }
  }
  return {
    journals,
    flatLines: journals.flatMap((j) =>
      j.lines.map((line) => ({ journalNo: j.journalNo, ...line })),
    ),
    balanced: dr === cr && dr > 0,
    lineCount: journals.reduce((n, j) => n + j.lines.length, 0),
    previewError: null,
  };
}

/** Map approvals API rows → table display fields (hide missing). */
export function mapVarianceApprovalRows(approvals) {
  const list = Array.isArray(approvals) ? approvals : [];
  return list.map((a) => {
    const kind = String(a?.kind || 'collection').toLowerCase();
    return {
      id: String(a?.id ?? ''),
      kind,
      kindBadge: citApprovalKindBadge(kind),
      ref:
        a?.referenceCode != null
          ? String(a.referenceCode)
          : a?.ref != null
            ? String(a.ref)
            : a?.handoverId && kind === 'handover'
              ? `HO-${a.handoverId}`
              : a?.id != null
                ? String(a.id)
                : null,
      officerName: a?.officerName != null ? String(a.officerName) : null,
      difference: a?.difference != null ? String(a.difference) : null,
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
