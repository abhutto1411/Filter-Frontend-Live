/**
 * P-A15B — display helpers for opening balance / books cutover (mockup N1).
 * Format API decimals only; no client money maths beyond display.
 */

export function formatSarLatn(raw) {
  if (raw == null || raw === '') return '0.00';
  const n = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function emptyObFilters() {
  return { search: '', type: 'all', onlyDifferences: true };
}

export function buildObPreviewBody(opts) {
  const startDate = String(opts?.startDate || '').trim();
  const counts = opts?.counts || {};
  const filter = opts?.filter || emptyObFilters();
  const page = Math.max(1, Number(opts?.page) || 1);
  const body = {
    startDate,
    page: String(page),
    pageSize: '25',
    filter: {
      search: filter.search || undefined,
      type: filter.type && filter.type !== 'all' ? filter.type : undefined,
      onlyDifferences: filter.onlyDifferences ? 'true' : undefined,
    },
    counts: {
      cash: Array.isArray(counts.cash) ? counts.cash : [],
      bank: Array.isArray(counts.bank) ? counts.bank : [],
    },
  };
  if (
    counts.inventoryValue != null &&
    String(counts.inventoryValue).trim() !== ''
  ) {
    body.counts.inventoryValue = String(counts.inventoryValue).replace(/,/g, '');
  }
  return body;
}

export function mapObCards(preview) {
  if (!preview || typeof preview !== 'object') {
    return {
      startDate: null,
      accountsInPreview: null,
      totalDifference: null,
      status: null,
    };
  }
  return {
    startDate: preview.startDate != null ? String(preview.startDate) : null,
    accountsInPreview:
      preview.cards?.accountsInPreview != null
        ? String(preview.cards.accountsInPreview)
        : preview.total != null
          ? String(preview.total)
          : null,
    totalDifference:
      preview.cards?.totalDifferenceToOpeningEquity != null
        ? String(preview.cards.totalDifferenceToOpeningEquity)
        : null,
    status: preview.status != null ? String(preview.status) : null,
  };
}

export function mapObTableRows(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((row, i) => {
      if (!row) return null;
      return {
        id: row.accountId != null ? String(row.accountId) : `row-${i}`,
        accountId: row.accountId != null ? String(row.accountId) : null,
        code: row.code != null ? String(row.code) : '—',
        name: row.name != null ? String(row.name) : '—',
        type: row.type != null ? String(row.type) : '—',
        currentGl: row.currentGl != null ? String(row.currentGl) : null,
        proposed: row.proposed != null ? String(row.proposed) : null,
        difference: row.difference != null ? String(row.difference) : null,
        source: row.source != null ? String(row.source) : null,
        editable: Boolean(row.editable),
        isBalancing: row.source === 'balancing' || row.code === '3500',
      };
    })
    .filter(Boolean);
}

export function mapJournalPreviewLines(journalPreview) {
  const lines = Array.isArray(journalPreview?.lines)
    ? journalPreview.lines
    : [];
  return lines.map((l, i) => ({
    id: l.accountId != null ? String(l.accountId) : `je-${i}`,
    account: l.account != null ? String(l.account) : '—',
    debit: l.debit != null ? String(l.debit) : '0.00',
    credit: l.credit != null ? String(l.credit) : '0.00',
  }));
}

export function sourceLabelKey(source) {
  const s = String(source || '');
  if (s === 'counted_cash') return 'ob.src.countedCash';
  if (s === 'bank_statement') return 'ob.src.bank';
  if (s === 'stock_value') return 'ob.src.stock';
  if (s === 'reversal') return 'ob.src.reversal';
  if (s === 'balancing') return 'ob.src.balancing';
  if (s === 'advances') return 'ob.src.advances';
  if (s === 'salaries_payable') return 'ob.src.salaries';
  if (s === 'ar') return 'ob.src.ar';
  if (s === 'ap') return 'ob.src.ap';
  if (s === 'vat') return 'ob.src.vat';
  if (s === 'wallet') return 'ob.src.wallet';
  if (s === 'gl_carry') return 'ob.src.gl';
  return 'ob.src.other';
}

export function validatePostReason(reason) {
  const r = String(reason || '').trim();
  if (r.length < 5) return { ok: false, code: 'REASON_REQUIRED' };
  return { ok: true };
}

export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Map API/HTTP error codes to i18n keys (B4 / F3). */
export function obErrorCodeToKey(code) {
  const c = String(code || '').trim();
  const map = {
    INVALID_DATE: 'ob.err.invalidDate',
    START_DATE_NOT_SET: 'ob.err.startNotSet',
    START_DATE_MISMATCH: 'ob.err.startMismatch',
    PERIOD_LOCKED: 'ob.err.periodLocked',
    OPENING_ALREADY_POSTED: 'ob.err.alreadyPosted',
    NOT_LEAF: 'ob.err.notLeaf',
    NOT_ENTERABLE: 'ob.err.notEnterable',
    SUBLEDGER_CONTROL_MISMATCH: 'ob.err.subledgerMismatch',
    UNBALANCED_PREVIEW: 'ob.err.unbalanced',
    PREVIEW_STALE: 'ob.err.previewStale',
    FORBIDDEN: 'ob.err.forbiddenPost',
    OPENING_MANAGED_BY_OB: 'ob.err.managedByOb',
    DRAFT_STALE: 'ob.err.draftStale',
    REASON_REQUIRED: 'ob.err.reason',
    TX_TIMEOUT: 'ob.err.txTimeout',
    OB_SUBLEDGER_MISMATCH: 'ob.err.subledgerDiff',
    OB_EMPLOYEE_BREAKDOWN_REQUIRED: 'ob.err.employeeBreakdown',
    CIT_IN_TRANSIT: 'ob.err.citInTransit',
    PREVIEW_HASH_REQUIRED: 'ob.err.previewHashRequired',
    INVALID_AMOUNT: 'ob.err.invalidAmount',
    OPENING_NOT_POSTED: 'ob.err.openingNotPosted',
    OB_LEGACY_OPENING_AFTER_START: 'ob.err.legacyOpening',
    OB_LEGACY_OPENING_CHANGED: 'ob.err.legacyOpeningChanged',
    OB_LEGACY_NOT_REVERSIBLE: 'ob.err.legacyNotReversible',
  };
  return map[c] || 'ob.err.generic';
}

/**
 * Format an ISO draft-saved timestamp in the browser's local timezone.
 * Missing/invalid → '—'. Arabic locale keeps Latin digits (nu-latn).
 */
export function formatObSavedTime(iso, locale = 'en') {
  if (iso == null || String(iso).trim() === '') return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  const loc = String(locale || 'en').toLowerCase().startsWith('ar')
    ? 'ar-SA-u-nu-latn'
    : 'en-GB';
  try {
    return new Intl.DateTimeFormat(loc, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dt);
  } catch {
    return '—';
  }
}

/** YYYY-MM-DD → locale display (pure). Invalid → empty string. */
export function ymdToDisplay(ymd, locale = 'en') {
  const s = String(ymd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return '';
  // A2: Arabic must stay Gregorian (not Hijri) with Latin digits.
  const loc = String(locale || 'en').toLowerCase().startsWith('ar')
    ? 'ar-SA-u-ca-gregory-nu-latn'
    : 'en-GB';
  try {
    return new Intl.DateTimeFormat(loc, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  } catch {
    return s;
  }
}

/**
 * View-state machine for the opening-balance page.
 * loading | needsStart | error | empty | ready
 */
export function resolveObViewState({
  loading,
  needsStartDate,
  error,
  accounts,
} = {}) {
  if (loading) return 'loading';
  if (needsStartDate) return 'needsStart';
  if (error) return 'error';
  const n = Array.isArray(accounts) ? accounts.length : 0;
  if (n === 0) return 'empty';
  return 'ready';
}

/** Arabic letter normalisation for search (alef/hamza/taa marbuta/yaa + strip tashkeel). */
export function normalizeObSearchText(raw) {
  let s = String(raw || '').toLowerCase();
  s = s.replace(/[\u064B-\u065F\u0670]/g, ''); // tashkeel
  s = s.replace(/[أإآٱ]/g, 'ا');
  s = s.replace(/ة/g, 'ه');
  s = s.replace(/ى/g, 'ي');
  s = s.replace(/ؤ/g, 'و');
  s = s.replace(/ئ/g, 'ي');
  return s.trim();
}

/**
 * Rank COA suggestions: code prefix first, then name contains.
 * Top 20. Empty query → [].
 */
export function rankObAccountSuggestions(accounts, query, locale = 'en') {
  const q = normalizeObSearchText(query);
  if (!q) return [];
  const list = Array.isArray(accounts) ? accounts : [];
  const scored = [];
  for (const a of list) {
    const code = String(a.code || '');
    const name = String(a.name || '');
    const nameAr = a.nameAr != null ? String(a.nameAr) : '';
    const label =
      a.label != null
        ? String(a.label)
        : a.nameTranslated != null
          ? String(a.nameTranslated)
          : '';
    const codeN = normalizeObSearchText(code);
    const nameN = normalizeObSearchText(name);
    const nameArN = normalizeObSearchText(nameAr);
    const labelN = normalizeObSearchText(label);
    let rank = 0;
    if (codeN.startsWith(q)) rank = 1000 - codeN.length;
    else if (codeN.includes(q)) rank = 500;
    else if (nameN.includes(q) || nameArN.includes(q) || labelN.includes(q))
      rank = 100;
    else continue;
    scored.push({ account: a, rank, code, name });
  }
  scored.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.code.localeCompare(b.code);
  });
  void locale;
  return scored.slice(0, 20).map((s) => s.account);
}

/** Diff side tag for JE: asset increase = Dr; liability/equity increase = Cr. */
export function obDiffSide(type, delta) {
  const d = Number(String(delta ?? '0').replace(/,/g, ''));
  if (!Number.isFinite(d) || d === 0) return null;
  const typ = String(type || '').toLowerCase();
  const increase = d > 0;
  if (typ === 'asset') return increase ? 'Dr' : 'Cr';
  return increase ? 'Cr' : 'Dr';
}

/** True if workspace row allows direct opening input (OB-02 modes). */
export function isObRowEditable(account, status) {
  if (status === 'posted') return false;
  if (!account?.isLeaf) return false;
  const mode = String(account.mode || '');
  if (account.editable === true && mode !== 'party' && mode !== 'stock_count')
    return true;
  return mode === 'entry' || mode === 'carry';
}

/**
 * Parse CSV rows for party drill-down: code/id,amount.
 * Returns { ok:[{id,amount}], errors:[{line,message}] }.
 */
export function parseObPartyCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const ok = [];
  const errors = [];
  lines.forEach((line, i) => {
    const n = i + 1;
    if (/^(code|id)\b/i.test(line)) return; // header
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    if (parts.length < 2) {
      errors.push({ line: n, message: 'Expected id,amount' });
      return;
    }
    const id = parts[0].replace(/^"|"$/g, '');
    const amount = parts[1].replace(/,/g, '').replace(/^"|"$/g, '');
    if (!id) {
      errors.push({ line: n, message: 'Missing id' });
      return;
    }
    if (!/^-?\d+(\.\d{1,2})?$/.test(amount)) {
      errors.push({ line: n, message: 'Invalid amount' });
      return;
    }
    ok.push({ id, amount: Number(amount).toFixed(2) });
  });
  return { ok, errors };
}

/** Sum party opening amounts (control = Σ parties). */
export function sumObPartyTargets(partyMap) {
  let t = 0;
  for (const v of Object.values(partyMap || {})) {
    const n = Number(String(v).replace(/,/g, ''));
    if (Number.isFinite(n)) t += n;
  }
  return Number(t.toFixed(2));
}

/** Drawer tab ids for OB-02 drill-down. */
export const OB_DRAWER_TABS = [
  'walkin',
  'corporate',
  'ap_affiliated',
  'ap_local',
  'registers',
  'petty',
  'advances',
  'salaries',
  'vault',
];

/** Validate opening money input: 2 dp, no letters. */
export function validateObMoneyInput(raw) {
  const s = String(raw ?? '').trim().replace(/,/g, '');
  if (s === '') return { ok: false, code: 'empty' };
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return { ok: false, code: 'format' };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false, code: 'format' };
  return { ok: true, value: n.toFixed(2) };
}

/** Preview is usable for Post when hash matches current inputs fingerprint. */
export function obPreviewMatchesInputs(preview, fingerprint) {
  if (!preview?.previewHash) return false;
  return String(preview._inputFingerprint || '') === String(fingerprint || '');
}

export function buildObInputFingerprint(startDate, targets) {
  const keys = Object.keys(targets || {}).sort();
  const parts = keys.map((k) => `${k}=${String(targets[k] ?? '')}`);
  return `${String(startDate || '')}|${parts.join(';')}`;
}

/** Build a flat→tree structure for the account workspace list. */
export function buildObAccountTree(accounts) {
  const list = Array.isArray(accounts) ? accounts : [];
  const byId = new Map(list.map((a) => [String(a.accountId), { ...a, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const pid = node.parentId != null ? String(node.parentId) : null;
    if (pid && byId.has(pid)) byId.get(pid).children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes) => {
    nodes.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
    for (const n of nodes) sortRec(n.children || []);
  };
  sortRec(roots);
  return roots;
}

/** Filter workspace accounts for search / type / only-diff. */
export function filterObWorkspaceAccounts(accounts, filter = {}) {
  let out = Array.isArray(accounts) ? [...accounts] : [];
  const search = String(filter.search || '')
    .trim()
    .toLowerCase();
  if (search) {
    out = out.filter(
      (a) =>
        String(a.code || '')
          .toLowerCase()
          .includes(search) ||
        String(a.name || '')
          .toLowerCase()
          .includes(search) ||
        String(a.nameAr || '')
          .toLowerCase()
          .includes(search),
    );
  }
  const typ = String(filter.type || '')
    .trim()
    .toLowerCase();
  if (typ && typ !== 'all') {
    out = out.filter((a) => String(a.type || '').toLowerCase() === typ);
  }
  if (filter.onlyDifferences) {
    out = out.filter((a) => {
      const d = Number(String(a.delta ?? '0').replace(/,/g, ''));
      return Number.isFinite(d) && d !== 0;
    });
  }
  return out;
}

/** Totals bar from trueUp / preview payload. */
export function mapObTrueUpTotals(trueUp) {
  const tu = trueUp && typeof trueUp === 'object' ? trueUp : {};
  const plug = tu.plug != null ? String(tu.plug) : '0.00';
  const plugN = Number(plug);
  return {
    totalDebit: tu.totalDebit != null ? String(tu.totalDebit) : '0.00',
    totalCredit: tu.totalCredit != null ? String(tu.totalCredit) : '0.00',
    balanced: Boolean(tu.balanced),
    plug,
    plugSide: Number.isFinite(plugN) ? (plugN > 0 ? 'Cr' : plugN < 0 ? 'Dr' : '—') : '—',
    plugAbs: Number.isFinite(plugN) ? Math.abs(plugN).toFixed(2) : '0.00',
  };
}

/** Split cash-bank lookup into cash vs bank count rows for the API. */
export function splitCashBankCounts(accounts, amountById) {
  const cash = [];
  const bank = [];
  for (const a of accounts || []) {
    const id = String(a.id);
    const raw = amountById?.[id];
    if (raw == null || String(raw).trim() === '') continue;
    const amount = String(raw).replace(/,/g, '');
    const kind = String(a.kind || a.type || '').toUpperCase();
    const row = { cashBankAccountId: id, amount };
    if (kind.includes('BANK')) bank.push(row);
    else cash.push(row);
  }
  return { cash, bank };
}
