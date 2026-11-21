/** P-A12H2 — payroll run / payslip display helpers (no money maths beyond display). */

export const PAYROLL_RUN_PAGE_SIZE = 25;

export function formatSarLatn(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function currentPeriodYmd() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function lastDayOfPeriodYmd(period) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || '').trim());
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return '';
  const last = new Date(Date.UTC(y, mo, 0));
  return `${m[1]}-${m[2]}-${String(last.getUTCDate()).padStart(2, '0')}`;
}

export function parsePayrollPath(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean);
  // /workshop/accounting/advances/payroll/slip/:id
  // /workshop/accounting/advances/payroll/:period
  const i = parts.indexOf('advances');
  if (i < 0 || parts[i + 1] !== 'payroll') return { kind: 'none' };
  if (parts[i + 2] === 'slip' && parts[i + 3]) {
    return { kind: 'slip', slipId: parts[i + 3] };
  }
  if (parts[i + 2] && /^\d{4}-\d{2}$/.test(parts[i + 2])) {
    return { kind: 'run', period: parts[i + 2] };
  }
  return { kind: 'none' };
}

export function slicePage(items, page, pageSize = PAYROLL_RUN_PAGE_SIZE) {
  const rows = Array.isArray(items) ? items : [];
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || PAYROLL_RUN_PAGE_SIZE);
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

/** Client display validation only — server remains source of truth. */
export function recoveryExceedsMax(recovery, outstanding) {
  const r = Number(recovery);
  const o = Number(outstanding);
  if (!Number.isFinite(r)) return true;
  if (!Number.isFinite(o)) return false;
  return r > o + 0.001;
}

export function mapRunSummaryCards(run) {
  const slips = Array.isArray(run?.slips) ? run.slips : [];
  const sumField = (key) => {
    if (run?.totals && run.totals[key] != null) return run.totals[key];
    if (run?.[key] != null && key !== 'status') return run[key];
    // Display sum of API slip fields only (integer halvallas).
    return (
      slips.reduce((acc, s) => {
        const n = Number(s?.[key]);
        return Number.isFinite(n) ? acc + Math.round(n * 100) : acc;
      }, 0) / 100
    );
  };
  return [
    { id: 'employees', value: run?.employeeCount ?? slips.length },
    { id: 'gross', value: sumField('gross') },
    { id: 'recovery', value: sumField('advanceRecovery') },
    { id: 'penalties', value: sumField('penalties') },
    { id: 'net', value: sumField('net') },
    { id: 'status', value: run?.status || 'draft' },
  ];
}

/** "0.00" when known zero; "—" only when the API omitted the field. */
export function formatOutstandingCell(value) {
  if (value == null || value === '') {
    return { text: '—', unknown: true };
  }
  return { text: formatSarLatn(value), unknown: false };
}

/** Unwrap interceptor / axios / { data: { items } } staff-search payloads. */
export function unwrapPayrollStaffSearchPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.list)) return payload.list;
  return [];
}

export async function loadPayrollStaffHits(searchFn, params, alreadyIds) {
  const res = await searchFn(params);
  return mapPayrollStaffSearchOptions(res, { alreadyIds });
}

export function mapPayrollStaffSearchOptions(payload, { alreadyIds } = {}) {
  const rows = unwrapPayrollStaffSearchPayload(payload);
  const taken = new Set((alreadyIds || []).map(String));
  return rows.map((r) => {
    const userId = String(r.userId || r.id || r.employeeUserId || '');
    const already = Boolean(r.alreadyInRun) || taken.has(userId);
    const inactive = Boolean(r.inactive);
    const subtitle =
      r.subtitle ||
      [r.role, r.branchName || r.branch].filter(Boolean).join(' · ');
    return {
      id: userId,
      userId,
      label: r.label || r.name || r.displayName || userId,
      subtitle,
      inactive,
      alreadyInRun: already,
      disabled: already,
      trailing: already ? 'already in run' : inactive ? 'Inactive' : 'Active',
    };
  });
}

/** Client display check — server still recomputes. Amounts as strings. */
export function validateDraftSlipEdits(slip, ed = {}) {
  const money = (v) => {
    if (v == null || v === '') return { ok: true, n: 0 };
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return { ok: false, code: 'PAYROLL_AMOUNT_NEGATIVE' };
    return { ok: true, n: Math.round((n + Number.EPSILON) * 100) / 100 };
  };
  const basic = money(ed.basic ?? slip.basic);
  const allowances = money(ed.allowances ?? slip.allowances);
  const bonus = money(ed.bonus ?? slip.bonus);
  const commission = money(ed.commission ?? slip.commission);
  const recovery = money(ed.recovery ?? slip.advanceRecovery);
  const penalties = money(ed.penalties ?? slip.penalties);
  for (const part of [basic, allowances, bonus, commission, recovery, penalties]) {
    if (!part.ok) return part;
  }
  const gross = basic.n + allowances.n + bonus.n + commission.n;
  const outstanding = slip.outstandingAdvance ?? slip.outstanding;
  if (outstanding != null && recovery.n > Number(outstanding) + 0.001) {
    return { ok: false, code: 'PAYROLL_RECOVERY_EXCEEDS_OUTSTANDING' };
  }
  if (recovery.n > gross + 0.001) {
    return { ok: false, code: 'PAYROLL_RECOVERY_EXCEEDS_GROSS' };
  }
  if (penalties.n > gross + 0.001) {
    return { ok: false, code: 'PAYROLL_PENALTIES_EXCEED_GROSS' };
  }
  const net = Math.round((gross - recovery.n - penalties.n) * 100) / 100;
  if (net < 0) return { ok: false, code: 'PAYROLL_NET_NEGATIVE' };
  const remarks = String(ed.remarks ?? ed.notes ?? slip.remarks ?? slip.notes ?? '');
  if (remarks.length > 500) return { ok: false, code: 'PAYROLL_REMARKS_TOO_LONG' };
  if (slip.inactive && !remarks.trim()) {
    return { ok: false, code: 'PAYROLL_INACTIVE_REMARK_REQUIRED' };
  }
  const master = slip.masterBasic;
  if (
    master != null &&
    Math.abs(basic.n - Number(master)) > 0.005 &&
    !remarks.trim()
  ) {
    return { ok: false, code: 'PAYROLL_BASIC_REMARK_REQUIRED' };
  }
  return {
    ok: true,
    basic: basic.n.toFixed(2),
    allowances: allowances.n.toFixed(2),
    bonus: bonus.n.toFixed(2),
    commission: commission.n.toFixed(2),
    advanceRecovery: recovery.n.toFixed(2),
    penalties: penalties.n.toFixed(2),
    net: net.toFixed(2),
    remarks,
  };
}

export function filterSlips(slips, { employeeQ, branchId }) {
  let rows = Array.isArray(slips) ? slips : [];
  const q = String(employeeQ || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter((s) =>
      [s.employeeName, s.employeeUserId, s.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
  if (branchId && branchId !== 'all' && rows.some((s) => s.branchId != null)) {
    rows = rows.filter((s) => String(s.branchId) === String(branchId));
  }
  return rows;
}

export function formatAccrualPreviewLines(preview) {
  if (!preview) return [];
  if (Array.isArray(preview.lines)) return preview.lines;
  if (typeof preview === 'string' && preview.trim()) return [preview];
  if (Array.isArray(preview)) return preview;
  return [];
}

export function payslipEarningsRows(slip) {
  if (!slip) return [];
  const rows = [
    { key: 'basic', value: slip.basic },
    { key: 'allowances', value: slip.allowances },
    { key: 'bonus', value: slip.bonus },
    { key: 'commission', value: slip.commission },
    { key: 'gross', value: slip.gross, bold: true },
  ];
  return rows.filter((r) => r.value != null);
}

export function payslipDeductionRows(slip) {
  if (!slip) return [];
  const paidLabel = slip.paidLabel || null;
  const rows = [
    { key: 'recovery', value: slip.advanceRecovery },
    { key: 'penalties', value: slip.penalties },
    { key: 'net', value: slip.net, bold: true },
  ];
  if (slip.paidAmount != null) {
    rows.push({
      key: 'paid',
      value: slip.paidAmount,
      label: paidLabel || undefined,
    });
  }
  if (slip.balance != null) {
    rows.push({ key: 'balance', value: slip.balance });
  } else if (slip.net != null && slip.paidAmount != null) {
    // Balance from API fields only when both present (display).
    const bal =
      Math.round((Number(slip.net) - Number(slip.paidAmount)) * 100) / 100;
    if (Number.isFinite(bal)) rows.push({ key: 'balance', value: bal });
  }
  return rows.filter((r) => r.value != null);
}

export function arabicMonthLabel(period) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  if (!m) return String(period || '');
  const names = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];
  const idx = Number(m[2]) - 1;
  return `${names[idx] || m[2]} ${m[1]}`;
}

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

export function payrollErrorI18nKey(err) {
  const code = String(err?.code || err?.response?.code || '').trim();
  const msg = String(err?.message || err?.response?.message || '');
  if (
    code === 'PAYROLL_RUN_NOT_FOUND' ||
    /Payroll run not found/i.test(msg)
  ) {
    return 'pr.err.notFound';
  }
  if (isPrismaClientNoise(err)) return 'pr.err.unavailable';
  const map = {
    PAYROLL_RUN_EXISTS: 'pr.err.exists',
    PAYROLL_NOT_DRAFT: 'pr.err.notDraft',
    PAYROLL_NO_SLIPS: 'pr.err.noSlips',
    PAYROLL_SLIP_EXISTS: 'pr.err.slipExists',
    PAYROLL_NO_USER: 'pr.err.noUser',
    PAYROLL_PERIOD_INVALID: 'pr.err.periodInvalid',
    PAYROLL_PERIOD_LOCKED: 'pr.err.locked',
    PAYROLL_RECOVERY_EXCEEDS_OUTSTANDING: 'pr.err.recoveryMax',
    PAYROLL_RECOVERY_EXCEEDS_GROSS: 'pr.err.recoveryMax',
    PAYROLL_INACTIVE_REMARK_REQUIRED: 'pr.err.inactiveRemark',
    PAYROLL_AMOUNT_NEGATIVE: 'pr.err.amountNegative',
    PAYROLL_PENALTIES_EXCEED_GROSS: 'pr.err.penaltiesGross',
    PAYROLL_NET_NEGATIVE: 'pr.err.netNegative',
    PAYROLL_BASIC_REMARK_REQUIRED: 'pr.err.basicRemark',
    PAYROLL_REMARKS_TOO_LONG: 'pr.err.remarksLong',
    PAYROLL_PAYOUT_LEGACY_ACCOUNT: 'pr.err.payoutLegacy',
    PAYROLL_SHEET_NOT_READY: 'pr.sheet.availableAfter',
    PAYROLL_SHEET_TOTALS_MISMATCH: 'pr.sheet.err.totals',
    PAYROLL_SHEET_ROW_NET_MISMATCH: 'pr.sheet.err.row',
    ADVANCE_SHEET_NOT_PAID: 'pr.sheet.err.advUnpaid',
    ADVANCE_SHEET_EMPTY: 'pr.sheet.err.advEmpty',
    ADVANCE_SHEET_TOTALS_MISMATCH: 'pr.sheet.err.advTotals',
    ADVANCE_SHEET_LEGACY_PAID_FROM: 'pr.sheet.err.legacy',
  };
  return map[code] || null;
}

/**
 * Run to open for a period + topbar branch: the exact branch run first, then the
 * all-branches run (branchId null / scope 'all'), never a reversed run.
 */
export function pickPayrollRun(items, { period, branchId } = {}) {
  const list = Array.isArray(items) ? items : [];
  const active = list.filter((r) => r && r.period === period && r.status !== 'reversed');
  const wantBranch = branchId && branchId !== 'all' ? String(branchId) : '';
  const exact = wantBranch ? active.find((r) => String(r.branchId || '') === wantBranch) : null;
  const allBranches = active.find((r) => r.branchId == null || r.scope === 'all') || null;
  return exact || allBranches || active[0] || null;
}
