/**
 * P-A14C — display helpers for platform expenses / IC report (mockup 15).
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

export function emptyIcReportFilters() {
  return { workshopId: '', from: '', to: '' };
}

export function buildIcReportQuery(filters, page = 1) {
  const f = filters || emptyIcReportFilters();
  const params = { page: String(page), pageSize: '25' };
  if (f.workshopId) params.workshopIds = [f.workshopId];
  if (f.from) params.from = f.from;
  if (f.to) params.to = f.to;
  return params;
}

/** Map report.summary[] → table rows (hide fields that are missing). */
export function mapIcSummaryRows(summary) {
  if (!Array.isArray(summary)) return [];
  return summary
    .map((row) => {
      if (!row || row.workshopId == null) return null;
      const paid =
        row.expensesPaidForHq != null
          ? String(row.expensesPaidForHq)
          : row.paidForHq != null
            ? String(row.paidForHq)
            : null;
      const settled =
        row.settlements != null
          ? String(row.settlements)
          : row.settled != null
            ? String(row.settled)
            : null;
      const balance =
        row.closing != null
          ? String(row.closing)
          : row.balance != null
            ? String(row.balance)
            : null;
      return {
        workshopId: String(row.workshopId),
        workshopName: row.workshopName || row.workshopCode || String(row.workshopId),
        paidForHq: paid,
        settled,
        balance,
        difference: row.difference != null ? String(row.difference) : null,
        canSettle:
          balance != null &&
          Number(String(balance).replace(/,/g, '')) > 0,
      };
    })
    .filter(Boolean);
}

export function previewBookLines(opts) {
  const amount = formatSarLatn(opts.amount);
  const register = opts.paidFromLabel || '—';
  const workshop = opts.workshopLabel || 'workshop';
  return {
    workshopLine: `Workshop books: Dr Receivable from Platform HQ ${amount} / Cr ${register} ${amount}.`,
    platformLine: `Platform books (auto): Dr Expense / Cr Liability to ${workshop}.`,
  };
}

/** Settlement amount must be > 0 and ≤ open balance (display gate; API still authoritative). */
export function validateSettlementAmount(amountRaw, balanceRaw) {
  const a = Number(String(amountRaw ?? '').replace(/,/g, ''));
  const b = Number(String(balanceRaw ?? '').replace(/,/g, ''));
  if (!Number.isFinite(a) || a <= 0) {
    return { ok: false, code: 'AMOUNT_INVALID' };
  }
  if (Number.isFinite(b) && a > b + 1e-9) {
    return { ok: false, code: 'SETTLEMENT_EXCEEDS_BALANCE' };
  }
  return { ok: true };
}

export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
