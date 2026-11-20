/**
 * Pure helpers for Accounting → Suppliers & bills (P-A13B / mockup 12).
 * Money stays as API decimal strings — format only; display sums use integer halalas.
 */

export const SUPPLIERS_AP_PAGE_SIZE = 25;

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

/** Sum API decimal strings via integer halalas (display only). */
export function sumMoneyStrings(values) {
  let halalas = 0;
  for (const v of values || []) {
    if (v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    halalas += Math.round(n * 100);
  }
  return (halalas / 100).toFixed(2);
}

export function overdueFromAgeing(ageing) {
  if (!ageing || typeof ageing !== 'object') return null;
  return sumMoneyStrings([
    ageing.d1_30,
    ageing.d31_60,
    ageing.d61_90,
    ageing.d90_plus,
  ]);
}

export function openBillsFromAgeing(ageing) {
  if (!ageing || typeof ageing !== 'object') return null;
  return sumMoneyStrings([
    ageing.current,
    ageing.d1_30,
    ageing.d31_60,
    ageing.d61_90,
    ageing.d90_plus,
  ]);
}

export function mapApSummaryCards(summary, { affiliatedTotal } = {}) {
  const s = summary && typeof summary === 'object' ? summary : {};
  return {
    suppliers: s.suppliersCount != null ? String(s.suppliersCount) : null,
    affiliated:
      affiliatedTotal != null
        ? String(affiliatedTotal)
        : s.affiliatedCount != null
          ? String(s.affiliatedCount)
          : null,
    openBills: openBillsFromAgeing(s.ageing),
    overdue: overdueFromAgeing(s.ageing),
  };
}

export function typeChipKind(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'affiliated') return 'affiliated';
  if (t === 'local' || t === 'non-affiliated' || t === 'non_affiliated') {
    return 'local';
  }
  return 'other';
}

export function filtersFromSearchParams(sp) {
  const get = (k) => (sp?.get ? sp.get(k) : sp?.[k]) || '';
  const typeRaw = String(get('type') || 'all').toLowerCase();
  const type =
    typeRaw === 'affiliated' || typeRaw === 'local' ? typeRaw : 'all';
  return {
    search: String(get('search') || get('q') || '').trim(),
    type,
    from: String(get('from') || '').trim(),
    to: String(get('to') || '').trim(),
    asOf: String(get('asOf') || '').trim(),
    page: Math.max(1, Number(get('page')) || 1),
    supplierType: String(get('supplierType') || '').trim().toLowerCase(),
    supplierId: String(get('supplierId') || '').trim(),
    highlightRef: String(get('highlightRef') || '').trim(),
  };
}

export function searchParamsFromFilters(filters) {
  const f = filters || {};
  const out = {};
  if (f.search) out.search = f.search;
  if (f.type && f.type !== 'all') out.type = f.type;
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  if (f.asOf) out.asOf = f.asOf;
  const page = Math.max(1, Number(f.page) || 1);
  if (page > 1) out.page = String(page);
  if (f.supplierType) out.supplierType = f.supplierType;
  if (f.supplierId) out.supplierId = f.supplierId;
  if (f.highlightRef) out.highlightRef = f.highlightRef;
  return out;
}

export function buildApListQuery(filters) {
  const f = filters || {};
  const q = {
    page: Math.max(1, Number(f.page) || 1),
    pageSize: SUPPLIERS_AP_PAGE_SIZE,
  };
  if (f.type && f.type !== 'all') q.type = f.type;
  if (f.search) q.search = f.search;
  if (f.asOf) q.asOf = f.asOf;
  else if (f.to) q.asOf = f.to;
  return q;
}

export function buildStatementQuery(filters) {
  const f = filters || {};
  const q = {
    page: Math.max(1, Number(f.stmtPage) || 1),
    pageSize: SUPPLIERS_AP_PAGE_SIZE,
  };
  if (f.from) q.from = f.from;
  if (f.to) q.to = f.to;
  return q;
}

export function showingRange(page, pageSize, total) {
  const size = Math.max(1, Number(pageSize) || SUPPLIERS_AP_PAGE_SIZE);
  const t = Math.max(0, Number(total) || 0);
  if (t === 0) return { from: 0, to: 0, total: 0 };
  const p = Math.max(1, Number(page) || 1);
  return {
    from: (p - 1) * size + 1,
    to: Math.min(p * size, t),
    total: t,
  };
}

export function hasDrift(drift) {
  if (drift == null || drift === '') return false;
  const n = Number(drift);
  return Number.isFinite(n) && Math.abs(n) >= 0.005;
}

export function formatDocLabel(row) {
  if (!row || typeof row !== 'object') return '—';
  if (row.journalNumber) return String(row.journalNumber);
  if (row.source && row.sourceId) return `${row.source} #${row.sourceId}`;
  if (row.description) return String(row.description).slice(0, 40);
  return '—';
}
