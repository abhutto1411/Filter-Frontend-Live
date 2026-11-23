/**
 * P-A14D — display helpers for HQ linked journals (mockup 16).
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

export function emptyLjFilters() {
  return { search: '', workshopId: '' };
}

export function buildLjReportQuery(filters, page = 1) {
  const f = filters || emptyLjFilters();
  const params = { page: String(page), pageSize: '25' };
  if (f.search) params.search = String(f.search).trim();
  if (f.workshopId) params.workshopIds = [String(f.workshopId)];
  return params;
}

/** Map report.items[] → list rows (hide fields that are missing). */
export function mapIcListRows(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((row) => {
      if (!row || row.ref == null) return null;
      return {
        ref: String(row.ref),
        date: row.date != null ? String(row.date).slice(0, 10) : null,
        workshopId: row.workshopId != null ? String(row.workshopId) : null,
        workshopName:
          row.workshopName || row.workshopCode || row.workshopId || null,
        amount: row.amount != null ? String(row.amount) : null,
        status: row.status != null ? String(row.status) : null,
        workshopJournalNumber:
          row.workshopJournalNumber != null
            ? String(row.workshopJournalNumber)
            : null,
        hqJournalNumber:
          row.hqJournalNumber != null ? String(row.hqJournalNumber) : null,
        workshopJournalId:
          row.workshopJournalId != null ? String(row.workshopJournalId) : null,
        hqJournalId: row.hqJournalId != null ? String(row.hqJournalId) : null,
        kind: row.kind != null ? String(row.kind) : null,
      };
    })
    .filter(Boolean);
}

/**
 * Card values for the selected IC row.
 * bothSides: 'posted' | 'missing' | 'partial'
 */
export function buildLinkedCards(row) {
  if (!row) {
    return {
      reference: null,
      amount: null,
      bothSides: 'missing',
      linkedCount: 0,
      hqJournalNumber: null,
      workshopJournalNumber: null,
    };
  }
  const hq = Boolean(row.hqJournalNumber || row.hqJournalId);
  const ws = Boolean(row.workshopJournalNumber || row.workshopJournalId);
  let bothSides = 'missing';
  if (hq && ws) bothSides = 'posted';
  else if (hq || ws) bothSides = 'partial';
  return {
    reference: row.ref || null,
    amount: row.amount != null ? String(row.amount) : null,
    bothSides,
    linkedCount: (hq ? 1 : 0) + (ws ? 1 : 0),
    hqJournalNumber: row.hqJournalNumber || null,
    workshopJournalNumber: row.workshopJournalNumber || null,
  };
}

export function mapJournalLines(entry) {
  const lines = Array.isArray(entry?.lines) ? entry.lines : [];
  return lines.map((line, i) => {
    const code = line.accountCode != null ? String(line.accountCode) : '';
    const name = line.accountName != null ? String(line.accountName) : '';
    const account =
      code && name ? `${code} ${name}` : name || code || line.accountId || '—';
    return {
      id: line.id != null ? String(line.id) : `line-${i}`,
      account,
      debit: line.debit != null ? String(line.debit) : '0',
      credit: line.credit != null ? String(line.credit) : '0',
    };
  });
}

export function slicePage(rows, page = 1, pageSize = 25) {
  const list = Array.isArray(rows) ? rows : [];
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || 25);
  const start = (p - 1) * size;
  return {
    page: p,
    pageSize: size,
    total: list.length,
    items: list.slice(start, start + size),
  };
}

/** Prefer exact entryNumber match from listJournalEntries response. */
export function pickJournalByNumber(entries, entryNumber) {
  if (!Array.isArray(entries) || !entryNumber) return null;
  const want = String(entryNumber);
  const exact = entries.find(
    (e) => e && (e.entryNumber === want || String(e.id) === want),
  );
  return exact || entries[0] || null;
}
