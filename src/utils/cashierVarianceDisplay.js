/**
 * Pure helpers for Accounting → Cashier variance report (P-A11B / mockups 07, 07b).
 * Money values stay as API decimal strings — format only, never recompute totals.
 */

export const CASHIER_VARIANCE_PAGE_SIZE = 25;

export function parseCsvIds(raw) {
  if (raw == null || raw === '') return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(',');
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const s = String(x ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function csvFromIds(ids) {
  return (ids || []).map((x) => String(x).trim()).filter(Boolean).join(',');
}

/** Western digits, 2 dp; returns '' for null/undefined/blank. */
export function formatMoneyLatn(raw) {
  if (raw == null || raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(n);
}

export function formatSignedMoneyLatn(raw) {
  if (raw == null || raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  const abs = formatMoneyLatn(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `-${abs}`;
  return abs;
}

/** red bad / green ok / neutral for zero or invalid */
export function varianceTone(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return 'neutral';
  return n < 0 ? 'bad' : 'ok';
}

export function journalPostedLabel(row) {
  if (!row || typeof row !== 'object') return { kind: 'dash', text: '—' };
  const status = String(row.journalStatus || '').toLowerCase();
  if (status === 'queued') return { kind: 'queued', textKey: 'cv.queued' };
  if (status === 'posted') {
    const num = row.journalNumber || row.journalId;
    if (num) return { kind: 'posted', text: String(num), journalId: row.journalId || null };
    return { kind: 'posted', text: '—', journalId: row.journalId || null };
  }
  return { kind: 'dash', text: '—' };
}

export function mapSummaryCards(summary) {
  const s = summary && typeof summary === 'object' ? summary : {};
  return {
    sessions: s.sessionsCount != null ? String(s.sessionsCount) : null,
    shortages: s.totalShortage != null ? String(s.totalShortage) : null,
    overages: s.totalOverage != null ? String(s.totalOverage) : null,
    net: s.net != null ? String(s.net) : null,
    sessionsWithVariance:
      s.sessionsWithVariance != null ? String(s.sessionsWithVariance) : null,
  };
}

export function filtersFromSearchParams(sp) {
  const get = (k) => (sp?.get ? sp.get(k) : sp?.[k]) || '';
  return {
    branchIds: parseCsvIds(get('branchIds')),
    cashierIds: parseCsvIds(get('cashierIds')),
    from: String(get('from') || '').trim(),
    to: String(get('to') || '').trim(),
    openedFrom: String(get('openedFrom') || '').trim(),
    openedTo: String(get('openedTo') || '').trim(),
    closedFrom: String(get('closedFrom') || '').trim(),
    closedTo: String(get('closedTo') || '').trim(),
    type: ['shortage', 'overage', 'all'].includes(String(get('type') || '').toLowerCase())
      ? String(get('type')).toLowerCase()
      : 'all',
    page: Math.max(1, Number(get('page')) || 1),
  };
}

export function searchParamsFromFilters(filters, { keepEmpty = false } = {}) {
  const out = {};
  const f = filters || {};
  const branchCsv = csvFromIds(f.branchIds);
  const cashierCsv = csvFromIds(f.cashierIds);
  if (branchCsv || keepEmpty) out.branchIds = branchCsv;
  if (cashierCsv || keepEmpty) out.cashierIds = cashierCsv;
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  if (f.openedFrom) out.openedFrom = f.openedFrom;
  if (f.openedTo) out.openedTo = f.openedTo;
  if (f.closedFrom) out.closedFrom = f.closedFrom;
  if (f.closedTo) out.closedTo = f.closedTo;
  if (f.type && f.type !== 'all') out.type = f.type;
  const page = Math.max(1, Number(f.page) || 1);
  if (page > 1) out.page = String(page);
  return out;
}

export function buildApiQuery(filters) {
  const f = filters || {};
  const q = {};
  const branchCsv = csvFromIds(f.branchIds);
  const cashierCsv = csvFromIds(f.cashierIds);
  if (branchCsv) q.branchIds = branchCsv;
  if (cashierCsv) q.cashierIds = cashierCsv;
  if (f.from) q.from = f.from;
  if (f.to) q.to = f.to;
  if (f.openedFrom) q.openedFrom = f.openedFrom;
  if (f.openedTo) q.openedTo = f.openedTo;
  if (f.closedFrom) q.closedFrom = f.closedFrom;
  if (f.closedTo) q.closedTo = f.closedTo;
  if (f.type && f.type !== 'all') q.type = f.type;
  q.page = Math.max(1, Number(f.page) || 1);
  q.pageSize = CASHIER_VARIANCE_PAGE_SIZE;
  return q;
}

/** Format ISO / date-time for table: YYYY-MM-DD HH:mm (Western digits). */
export function formatSessionStamp(iso) {
  if (!iso) return '—';
  const s = String(iso);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return `${m[1]} ${m[2]}:${m[3]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s.slice(0, 16).replace('T', ' ');
}

export function showingRange(page, pageSize, total) {
  const size = Math.max(1, Number(pageSize) || CASHIER_VARIANCE_PAGE_SIZE);
  const t = Math.max(0, Number(total) || 0);
  if (t === 0) return { from: 0, to: 0, total: 0 };
  const p = Math.max(1, Number(page) || 1);
  const from = (p - 1) * size + 1;
  const to = Math.min(p * size, t);
  return { from, to, total: t };
}
