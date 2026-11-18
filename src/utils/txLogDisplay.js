/** P-A12J — Receipts / Payments log display helpers. */

export const TX_LOG_PAGE_SIZE = 25;

export function formatSarLatn(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatBusinessDate(value) {
  if (!value) return '—';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/** Normalize API sourceType → filter/chip key. */
export function mapTxSourceKey(row) {
  const raw = String(row?.source || row?.sourceType || row?.type || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'other';
  if (raw === 'pos_invoice' || raw === 'invoice') return 'invoice';
  if (raw.includes('employee_repayment') || raw.includes('employee repayment') || raw === 'repayment') {
    return 'employee_repayment';
  }
  if (raw.includes('corporate') || raw.includes('fleet')) return 'corporate';
  if (raw.includes('payroll_payout') || raw === 'payroll') return 'payroll_payout';
  if (raw.includes('global_advance') || raw === 'advance' || raw.includes('petty_cash_salary')) {
    return 'global_advance';
  }
  if (raw.includes('supplier')) return 'supplier_payment';
  if (raw.includes('cash_bank') || raw === 'receipt' || raw === 'payment') return 'transactions';
  return raw.replace(/\s+/g, '_');
}

export const RECEIPT_SOURCE_OPTIONS = [
  'all',
  'invoice',
  'employee_repayment',
  'corporate',
  'transactions',
  'other',
];

export const PAYMENT_SOURCE_OPTIONS = [
  'all',
  'payroll_payout',
  'global_advance',
  'supplier_payment',
  'transactions',
  'other',
];

/**
 * Summary cards from API payload. Only include optional cards when fields exist
 * (never invent monthly/cash splits from the current page).
 */
export function mapTxSummaryCards(direction, payload = {}) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const summary = p.summary && typeof p.summary === 'object' ? p.summary : {};
  const total = p.total != null ? Number(p.total) : undefined;
  const totalAmount = p.totalAmount != null ? Number(p.totalAmount) : undefined;
  const pick = (...keys) => {
    for (const k of keys) {
      if (summary[k] != null) return summary[k];
      if (p[k] != null && k !== 'total' && k !== 'totalAmount' && k !== 'items') return p[k];
    }
    return undefined;
  };

  if (direction === 'in') {
    const cards = [
      { id: 'count', value: total ?? 0 },
      { id: 'total', value: totalAmount ?? 0 },
    ];
    const cash = pick('cashTotal', 'cashAmount', 'cash');
    if (cash != null) cards.push({ id: 'cash', value: cash });
    const repay = pick('employeeRepayments', 'employeeRepaymentTotal', 'repayments');
    if (repay != null) cards.push({ id: 'repayments', value: repay });
    return cards;
  }

  const cards = [
    { id: 'count', value: total ?? 0 },
    { id: 'total', value: totalAmount ?? 0 },
  ];
  const payroll = pick('payrollPayouts', 'payrollPayoutTotal', 'payrollTotal');
  if (payroll != null) cards.push({ id: 'payroll', value: payroll });
  const advances = pick('advancesTotal', 'globalAdvances', 'advances');
  if (advances != null) cards.push({ id: 'advances', value: advances });
  return cards;
}

/** Party label: From (receipts) / To (payments). */
export function mapTxPartyLabel(row, direction) {
  if (!row) return '—';
  if (direction === 'in') {
    return (
      row.fromName ||
      row.partyName ||
      row.counterpartyName ||
      row.customerName ||
      row.employeeName ||
      row.description ||
      '—'
    );
  }
  return (
    row.toName ||
    row.partyName ||
    row.counterpartyName ||
    row.employeeName ||
    row.supplierName ||
    row.description ||
    '—'
  );
}

export function mapTxAccountDr(row) {
  if (!row) return '—';
  if (row.accountDr) return String(row.accountDr);
  const code = row.account?.coaCode || row.coaCode;
  if (code) return String(code);
  if (row.account?.name) return String(row.account.name);
  return '—';
}

/**
 * Link target for mockup Link column.
 * @returns {{ kind: string, href?: string, openInvoice?: boolean } | null}
 */
export function mapTxLink(row) {
  if (!row) return null;
  const sk = mapTxSourceKey(row);
  const empId = row.employeeUserId || row.employeeId || row.partyUserId || null;
  const slipId = row.payslipId || row.slipId || null;
  const supplierId = row.supplierId || null;
  const corpId = row.corporateAccountId || row.corporateId || null;

  if (sk === 'invoice' || row.sourceType === 'pos_invoice') {
    return { kind: 'invoice', openInvoice: true };
  }
  if (sk === 'employee_repayment' || sk === 'global_advance' || sk === 'payroll_payout') {
    if (slipId && sk === 'payroll_payout') {
      return {
        kind: 'payslip',
        href: `/workshop/accounting/advances/payroll/slip/${encodeURIComponent(slipId)}`,
      };
    }
    if (empId) {
      return {
        kind: 'statement',
        href: `/workshop/accounting/advances?tab=statement&employee=${encodeURIComponent(empId)}`,
      };
    }
    return { kind: 'statement', href: '/workshop/accounting/advances?tab=statement' };
  }
  if (sk === 'supplier_payment' && supplierId) {
    return {
      kind: 'supplier',
      href: `/workshop/accounting/suppliers/local/${encodeURIComponent(supplierId)}`,
    };
  }
  if (sk === 'supplier_payment') {
    return { kind: 'supplier', href: '/workshop/accounting/suppliers' };
  }
  if (sk === 'corporate' && corpId) {
    return {
      kind: 'ar',
      href: `/admin/accounting/corporate-ar/${encodeURIComponent(corpId)}`,
    };
  }
  if (sk === 'corporate') {
    return { kind: 'ar', href: '/admin/accounting/corporate-ar' };
  }
  return null;
}

export function filterRowsBySource(rows, sourceKey) {
  const list = Array.isArray(rows) ? rows : [];
  if (!sourceKey || sourceKey === 'all') return list;
  return list.filter((r) => mapTxSourceKey(r) === sourceKey);
}
