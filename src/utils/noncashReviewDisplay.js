/**
 * P-A20B — display helpers for non-cash purchase review (mockups 34–35).
 * Money: format API decimal strings; preview VAT uses integer halalas only.
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

export function emptyNoncashQueueFilters() {
  return {
    supplierId: '',
    branchId: '',
    submittedByUserId: '',
    status: 'pending',
    q: '',
    from: '',
    to: '',
    possibleDuplicate: '',
  };
}

export function buildNoncashQueueQuery(filters, page = 1) {
  const f = filters || emptyNoncashQueueFilters();
  const params = { page: String(page) };
  if (f.supplierId) params.supplierId = f.supplierId;
  if (f.branchId) params.branchId = f.branchId;
  if (f.submittedByUserId) params.submittedByUserId = f.submittedByUserId;
  if (f.status) params.status = f.status;
  if (f.q) params.q = f.q;
  if (f.from) params.from = f.from;
  if (f.to) params.to = f.to;
  if (f.possibleDuplicate) params.possibleDuplicate = f.possibleDuplicate;
  return params;
}

/** Map list API summary → cards (hide when field missing). */
export function mapNoncashQueueSummary(summary) {
  if (!summary || typeof summary !== 'object') return [];
  const cards = [];
  if (summary.pendingCount != null || summary.pendingAmount != null) {
    cards.push({
      id: 'pending',
      count: summary.pendingCount,
      amount: summary.pendingAmount != null ? String(summary.pendingAmount) : null,
    });
  }
  if (summary.approvedThisMonth != null || summary.approvedThisMonthAmount != null) {
    cards.push({
      id: 'approvedMonth',
      count: summary.approvedThisMonth,
      amount:
        summary.approvedThisMonthAmount != null
          ? String(summary.approvedThisMonthAmount)
          : null,
    });
  }
  if (summary.duplicates != null) {
    cards.push({ id: 'duplicates', count: summary.duplicates });
  }
  if (summary.suppliersWithOpenBills != null) {
    cards.push({
      id: 'openBills',
      count: summary.suppliersWithOpenBills,
    });
  }
  return cards;
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

/**
 * Inclusive VAT preview from gross (display only; integer halalas).
 * ratePercent from workshop (default 15).
 */
/** Integer halalas from a decimal string — no IEEE Number rounding of money. */
export function moneyHalalas(raw) {
  const s = String(raw ?? '').replace(/,/g, '').trim();
  if (!s) return 0;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const m = /^(\d+)(?:\.(\d*))?$/.exec(body);
  if (!m) return 0;
  const whole = m[1] || '0';
  const frac = ((m[2] || '') + '00').slice(0, 2);
  const h = Number(whole) * 100 + Number(frac);
  return neg ? -h : h;
}

export function halalasToMoney(h) {
  const n = Number(h) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${(abs / 100).toFixed(2)}`;
}

export function previewInclusiveVat(grossRaw, ratePercent = 15) {
  const grossH = moneyHalalas(grossRaw);
  if (grossH <= 0) {
    return { net: '0.00', vat: '0.00', gross: '0.00' };
  }
  const r = Number(ratePercent) || 15;
  if (r <= 0) {
    const s = halalasToMoney(grossH);
    return { net: s, vat: '0.00', gross: s };
  }
  const netH = Math.round(grossH / (1 + r / 100));
  const vatH = grossH - netH;
  return {
    net: halalasToMoney(netH),
    vat: halalasToMoney(vatH),
    gross: halalasToMoney(grossH),
  };
}

export function photoCountFromItem(item) {
  if (item?.photoCount != null) return Number(item.photoCount) || 0;
  if (Array.isArray(item?.photos)) return item.photos.length;
  if (item?.proofUrl) {
    try {
      const p = JSON.parse(item.proofUrl);
      if (Array.isArray(p)) return p.length;
    } catch {
      /* single */
    }
    return 1;
  }
  return 0;
}

export function statusChipKind(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  if (s === 'reversed') return 'reversed';
  return 'pending';
}
