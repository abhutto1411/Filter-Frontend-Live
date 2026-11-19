/** P-A12H1 — display helpers for Payroll & advances (no money maths beyond halala display). */

export const PAYROLL_ADVANCES_PAGE_SIZE = 25;

export function formatSarLatn(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function currentMonthYmd() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Map legacy ?tab= values → mockup tabs. */
export function mapLegacyAdvancesTab(raw) {
  const t = String(raw || '').trim();
  if (!t) return 'overview';
  if (t === 'overview' || t === 'register' || t === 'payroll' || t === 'statement') {
    return t;
  }
  if (t === 'By Employee' || t === 'by-employee') return 'overview';
  if (t === 'Advances' || t === 'advances') return 'register';
  if (t === 'Salary' || t === 'salary' || t === 'payroll-runs') return 'payroll';
  if (t === 'Employee Ledger' || t === 'ledger') return 'statement';
  return 'overview';
}

export function slicePage(items, page, pageSize = PAYROLL_ADVANCES_PAGE_SIZE) {
  const rows = Array.isArray(items) ? items : [];
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || PAYROLL_ADVANCES_PAGE_SIZE);
  const start = (p - 1) * size;
  return {
    page: p,
    pageSize: size,
    total: rows.length,
    items: rows.slice(start, start + size),
    from: rows.length ? start + 1 : 0,
    to: Math.min(rows.length, start + size),
  };
}

export function sourceBadgeKey(source) {
  const s = String(source || '').toLowerCase();
  if (s === 'workshop_accounting' || s.includes('workshop_accounting')) return 'admin';
  if (s === 'transactions' || s.includes('transaction')) return 'transactions';
  if (s.includes('petty_cash') || s === 'pos' || s.includes('cashier')) return 'pos';
  if (s.includes('staff_app') || s === 'staff') return 'staff';
  if (s.includes('manual') || s === 'receipt' || s === 'payment') {
    return 'transactions';
  }
  if (s.includes('admin') || !s) return 'admin';
  return 'admin';
}

export function formatLastAdvanceLabel(row, locale = 'en') {
  if (!row) return '—';
  const date = row.lastAdvanceDate || row.date || row.lastAdvance?.date;
  const source = row.lastAdvanceSource || row.source || row.lastAdvance?.source;
  if (!date && !source) return '—';
  const d = date ? String(date).slice(0, 10) : '';
  const sk = sourceBadgeKey(source);
  const labels = {
    en: {
      admin: 'Workshop',
      pos: 'POS',
      staff: 'Staff app',
      transactions: 'Transactions',
    },
    ar: {
      admin: 'ورشة',
      pos: 'نقطة البيع',
      staff: 'تطبيق الموظف',
      transactions: 'قيود',
    },
  };
  const pack = String(locale).toLowerCase().startsWith('ar') ? labels.ar : labels.en;
  const src = pack[sk] || pack.admin;
  if (d && source) return `${d} ${src}`;
  return d || src || '—';
}

/** Name + role + branch so same-name people (three Tahas) stay distinct. */
export function staffDisambiguationLabel(e = {}) {
  const name = e.name || e.employeeName || '—';
  const role = e.employeeType || e.role || e.recordType || '';
  const branch =
    e.branchName ||
    e._branchName ||
    (e.branchId == null || e.branchId === '' ? 'Unassigned' : '');
  const bits = [role, branch].filter((x) => x && x !== '—');
  return bits.length ? `${name} (${bits.join(' · ')})` : name;
}

/** Map overview API → mockup Overview rows (pass-through fields when present). */
export function mapOverviewRows(overview) {
  let employees = [];
  if (Array.isArray(overview?.branches) && overview.branches.length) {
    employees = overview.branches.flatMap((b) =>
      (b.employees || []).map((e) => ({
        ...e,
        branchId: e.branchId ?? b.branchId ?? null,
        branchName: e.branchName || b.branchName || '—',
      })),
    );
  } else if (Array.isArray(overview?.employees)) {
    employees = overview.employees;
  } else if (Array.isArray(overview)) {
    employees = overview;
  }
  return employees.map((e) => ({
    key: String(e.staffKey || e.employeeId || e.userId || e.id),
    employeeId: e.userId || e.employeeId || e.id,
    employeeRecordId: e.employeeRecordId || e.recordId || e.employeeId || null,
    name: e.name || e.employeeName || '—',
    role: e.employeeType || e.role || e.recordType || '—',
    displayName: staffDisambiguationLabel({
      name: e.name || e.employeeName || '—',
      role: e.employeeType || e.role || e.recordType,
      branchName: e.branchName || e._branchName,
      branchId: e.branchId ?? null,
    }),
    commissionPayableSource: e.commissionPayableSource ?? null,
    branchId: e.branchId ?? null,
    branchName: e.branchName || e._branchName || '—',
    outstanding: e.outstandingBalance ?? e.outstanding ?? e.balance ?? null,
    lastAdvanceDate: e.lastAdvanceDate ?? e.latestAdvanceDate ?? e.latestDate ?? null,
    lastAdvanceSource: e.lastAdvanceSource ?? e.latestSource ?? null,
    lastRecovery: e.lastRecoveryDate ?? e.lastRecovery ?? null,
    salaryPayable: e.salaryPayable ?? e.payable2250 ?? null,
    commissionPayable: e.commissionPayable ?? e.payable2200 ?? null,
    advanceCount: e.advanceCount ?? null,
    totalPaid: e.totalPaid ?? null,
    isActive: e.isActive !== false && !e.inactive,
    inactive: Boolean(e.inactive) || e.isActive === false,
  }));
}

/**
 * Summary cards from stats (+ optional extras). Only include cards whose value
 * exists on the API payload (undefined → omit for "Needs backend").
 */
export function mapPayrollSummaryCards(stats = {}, extras = {}) {
  const s = stats && typeof stats === 'object' ? stats : {};
  const x = extras && typeof extras === 'object' ? extras : {};
  const pick = (keys) => {
    for (const k of keys) {
      if (s[k] != null) return s[k];
      if (x[k] != null) return x[k];
    }
    return undefined;
  };
  const defs = [
    { id: 'outstanding', keys: ['outstandingBalance', 'outstandingAdvances'] },
    // Monthly cards: only exact month fields (never reuse all-time totalAdvancesPaid).
    { id: 'givenMonth', keys: ['givenThisMonth', 'advancesGivenThisMonth'] },
    { id: 'recoveredMonth', keys: ['recoveredThisMonth', 'advancesRecoveredThisMonth'] },
    { id: 'salariesPayable', keys: ['salariesPayable', 'salaryPayableTotal', 'payable2250'] },
    { id: 'commissionPayable', keys: ['commissionPayable', 'commissionPayableTotal', 'payable2200'] },
    { id: 'paidMonth', keys: ['paidThisMonth', 'salariesPaidThisMonth'] },
    { id: 'empWithAdvance', keys: ['employeesWithAdvance', 'employeesWithOutstanding'] },
  ];
  return defs
    .map((d) => {
      const value = pick(d.keys);
      if (value === undefined) return null;
      return { id: d.id, value };
    })
    .filter(Boolean);
}

export function mapRegisterItems(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.list)
      ? payload.list
      : Array.isArray(payload)
        ? payload
        : [];
  return items.map((a) => ({
    id: String(a.id),
    date: a.date ? String(a.date).slice(0, 10) : '—',
    ref: a.ref || a.sourceId || a.id || '—',
    employeeId: a.employeeId,
    employeeName: a.employeeName || '—',
    amount: a.amount,
    balance: a.balance,
    source: a.source,
    status: a.status,
    cashierName: a.cashierName || a.cashier?.name || null,
    walletBalance: a.walletBalance ?? a.cashierWalletBalance ?? a.wallet?.balance ?? null,
    journalLabel: a.journalLabel || a.journalPreview || null,
    expenseRequestId: a.expenseRequestId || a.sourceId || null,
  }));
}

/** POS expense-request rows → register shape (pending approval). */
export function mapPosExpenseToRegister(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((r) => {
      const pay = String(r.payToType || r.pay_to_type || r.kind || '').toLowerCase();
      return (
        pay.includes('salary_advance') ||
        pay.includes('salary-advance') ||
        String(r.kind || '').toLowerCase() === 'salary_advance'
      );
    })
    .map((r) => ({
      id: `exp-${r.id}`,
      date: String(r.date || r.createdAt || '').slice(0, 10) || '—',
      ref: r.ref || r.requestNo || `EXP-${r.id}`,
      employeeId: r.payToUserId || r.employeeId,
      employeeName: r.payToName || r.employeeName || r.beneficiaryName || '—',
      amount: r.amount,
      balance: r.amount,
      source: 'petty_cash_salary_advance',
      status: r.status || 'pending',
      cashierName: r.requesterName || r.cashierName || r.createdByName || null,
      walletBalance: r.walletBalance ?? r.pettyCashBalance ?? null,
      journalLabel: null,
      expenseRequestId: r.id,
      _fromExpense: true,
    }));
}

export function filterOverviewRows(rows, { employeeQ, branchId, source, status, staffActive }) {
  let list = Array.isArray(rows) ? rows : [];
  const q = String(employeeQ || '').trim().toLowerCase();
  if (q) {
    list = list.filter((r) =>
      [r.name, r.role, r.branchName, r.key]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
  if (branchId && branchId !== 'all') {
    list = list.filter((r) => String(r.branchId) === String(branchId));
  }
  if (source && source !== 'all') {
    list = list.filter((r) => sourceBadgeKey(r.lastAdvanceSource) === source);
  }
  if (status && status !== 'all') {
    const want = String(status).toLowerCase();
    list = list.filter((r) => {
      const bal = Number(r.outstanding);
      if (want === 'outstanding') return bal > 0.0001;
      if (want === 'cleared') return !(bal > 0.0001);
      return true;
    });
  }
  const staff = String(staffActive || 'active').toLowerCase();
  if (staff === 'active') {
    list = list.filter((r) => !r.inactive);
  } else if (staff === 'inactive') {
    list = list.filter((r) => r.inactive);
  }
  return list;
}

export function isWalletTooLow(walletBalance, amount) {
  const w = Number(walletBalance);
  const a = Number(amount);
  if (!Number.isFinite(w) || !Number.isFinite(a)) return false;
  return a > w + 0.0001;
}
