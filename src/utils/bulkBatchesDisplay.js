/**
 * P-A18D — display helpers for Transaction batches list (N2) + batch result (30).
 * Money: format API decimal strings; display sums use integer halalas only.
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

export function sumMoneyStrings(values) {
  let h = 0;
  for (const v of values || []) {
    const n = Number(String(v ?? '').replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    h += Math.round(n * 100);
  }
  return (h / 100).toFixed(2);
}

/** Map N2 list API → summary cards (hide card if field missing). */
export function mapBatchListSummary(summary) {
  if (!summary || typeof summary !== 'object') return [];
  const cards = [];
  if (summary.batches != null) {
    cards.push({ id: 'batches', value: summary.batches });
  }
  if (summary.drafts != null) {
    cards.push({ id: 'drafts', value: summary.drafts });
  }
  if (summary.posted != null) {
    cards.push({ id: 'posted', value: summary.posted });
  }
  if (summary.reversed != null) {
    cards.push({ id: 'reversed', value: summary.reversed });
  }
  if (summary.totalPostedOut != null || summary.totalPostedIn != null) {
    cards.push({
      id: 'totalPosted',
      out: summary.totalPostedOut != null ? String(summary.totalPostedOut) : null,
      in: summary.totalPostedIn != null ? String(summary.totalPostedIn) : null,
    });
  }
  return cards;
}

/**
 * Status chip model for a list row.
 * @returns {{ kind: string, errorCount?: number, import?: boolean }}
 */
export function batchStatusChip(item) {
  const status = String(item?.status || '').toLowerCase();
  const errors = Number(item?.errorCount || 0);
  const source = String(item?.source || '').toLowerCase();
  if (status === 'posted') return { kind: 'posted' };
  if (status === 'reversed') return { kind: 'reversed' };
  if (status === 'partially_posted') return { kind: 'partial', errorCount: errors };
  if (status === 'draft' || status === 'draft_import') {
    if (source === 'import' || status === 'draft_import') {
      return { kind: 'draft_import', errorCount: errors };
    }
    return { kind: 'draft', errorCount: errors };
  }
  return { kind: status || 'draft', errorCount: errors };
}

export function batchListAction(item) {
  const status = String(item?.status || '').toLowerCase();
  if (status === 'draft' || status === 'draft_import' || status === 'partially_posted') {
    return item?.canContinue === false ? 'open' : 'continue';
  }
  return 'open';
}

export function pageRangeLabel(page, pageSize, total) {
  const p = Math.max(Number(page) || 1, 1);
  const size = Math.max(Number(pageSize) || 25, 1);
  const t = Math.max(Number(total) || 0, 0);
  if (t === 0) return { from: 0, to: 0, total: 0 };
  const from = (p - 1) * size + 1;
  const to = Math.min(p * size, t);
  return { from, to, total: t };
}

/** Result page: count transfers / journals from row list (not money). */
export function deriveBatchResultCounts(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let transfers = 0;
  const journalIds = new Set();
  let posted = 0;
  for (const r of list) {
    if (String(r.state || '').toLowerCase() === 'posted') posted += 1;
    if (String(r.type || '').toLowerCase() === 'transfer') transfers += 1;
    if (r.journalId != null && r.journalId !== '') {
      journalIds.add(String(r.journalId));
    }
  }
  return {
    postedRows: posted || list.filter((r) => String(r.state).toLowerCase() !== 'error').length,
    transfers,
    journals: journalIds.size,
  };
}

export function rowPartyLabel(row) {
  const p = row?.payload || {};
  const name = String(p.payeeName || '').trim();
  const type = String(p.payeeType || '').trim();
  if (name && type) return `${name} (${type})`;
  return name || type || '—';
}

export function rowAmountDisplay(row) {
  const p = row?.payload || {};
  if (p.amount != null && p.amount !== '') return String(p.amount);
  if (p.debit != null && Number(p.debit) > 0) return String(p.debit);
  if (p.credit != null && Number(p.credit) > 0) return String(p.credit);
  return '0.00';
}

/** Build simple Dr/Cr text from payload when API has no preview lines. */
export function rowDrCrHint(row) {
  const p = row?.payload || {};
  const type = String(row?.type || p.type || '').toLowerCase();
  const amt = rowAmountDisplay(row);
  if (type === 'journal') {
    const dr = p.debit != null && p.debit !== '' ? `Dr ${p.debit}` : '';
    const cr = p.credit != null && p.credit !== '' ? `Cr ${p.credit}` : '';
    return [dr, cr].filter(Boolean).join(' / ') || '—';
  }
  if (type === 'receipt') return `Dr register / Cr ${amt}`;
  if (type === 'transfer') return `Dr to / Cr from ${amt}`;
  return `Dr ${amt} / Cr register`;
}

export function truncateIdempotencyKey(key) {
  const s = String(key || '');
  if (s.length <= 8) return s || '—';
  return `…${s.slice(-4)}`;
}

export function emptyBatchListFilters() {
  return {
    search: '',
    status: '',
    type: '',
    createdBy: '',
    from: '',
    to: '',
  };
}

export function buildBatchListQuery(filters, page = 1, pageSize = 25) {
  const q = {
    page,
    pageSize,
  };
  const f = filters || {};
  if (f.search) q.search = f.search;
  if (f.status) q.status = f.status;
  if (f.type) q.type = f.type;
  if (f.createdBy) q.createdBy = f.createdBy;
  if (f.from) q.from = f.from;
  if (f.to) q.to = f.to;
  if (f.branchId && f.branchId !== 'all') q.branchId = f.branchId;
  return q;
}
