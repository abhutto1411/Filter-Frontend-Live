/**
 * Pure helpers for Accounting → Roles & access (P-A10C / mockup 36).
 * Maps permission codes → matrix cells. No money maths.
 */

export const ACC_ROLES_PAGE_SIZE = 25;

const ACC_PREFIX = 'workshop.accounting.';

/** Reconcile codes that must appear in the matrix (often unassigned). */
export const RECONCILE_CODES = [
  'workshop.accounting.cash-bank.reconcile.view',
  'workshop.accounting.cash-bank.reconcile.manage',
];

const ADMIN_ROLE_NAMES = new Set([
  'accountant',
  'admin',
  'workshop_owner',
  'owner',
]);

const PRIVILEGED_ROLE_NAMES = new Set([
  ...ADMIN_ROLE_NAMES,
  'manager',
  'workshop_manager',
]);

export function normalizePermissionCodes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((c) => String(c || '').trim()).filter(Boolean);
  }
  if (typeof raw === 'object') {
    return Object.keys(raw)
      .filter((k) => raw[k])
      .map((k) => String(k).trim())
      .filter(Boolean);
  }
  return [];
}

export function isAccountingCode(code) {
  return String(code || '').startsWith(ACC_PREFIX);
}

export function hasAnyAccountingAccess(codes) {
  return normalizePermissionCodes(codes).some(isAccountingCode);
}

function roleNameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function isCashierOrTechnicianRole(roleName, userType, employeeType) {
  const blob = [roleName, userType, employeeType]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
  return (
    /\bcashier\b/.test(blob) ||
    /\btechnician\b/.test(blob) ||
    /\bstaff\b/.test(blob) && !/\bportal\b/.test(blob)
  );
}

export function isAccountantRoleName(roleName) {
  const k = roleNameKey(roleName);
  return k === 'accountant' || k.includes('accountant');
}

export function isOwnerRoleName(roleName, userType) {
  const k = roleNameKey(roleName);
  const ut = String(userType || '').toLowerCase();
  return (
    k === 'owner' ||
    k === 'workshop_owner' ||
    ut === 'workshop_owner' ||
    ut === 'owner'
  );
}

/**
 * Cell value for one matrix column.
 * Returns { kind: 'check'|'dash'|'text', text? } for rendering.
 */
export function mapAccessColumn(column, codes, ctx = {}) {
  const set = new Set(normalizePermissionCodes(codes));
  const role = roleNameKey(ctx.roleName);
  const privileged =
    PRIVILEGED_ROLE_NAMES.has(role) || isOwnerRoleName(ctx.roleName, ctx.userType);
  const adminRole =
    ADMIN_ROLE_NAMES.has(role) || isOwnerRoleName(ctx.roleName, ctx.userType);

  if (ctx.posOnly) {
    return { kind: 'dash' };
  }

  if (column === 'read') {
    if (privileged) return { kind: 'check' };
    if (set.has('workshop.accounting.cash-bank.reconcile.view') && !hasReadReports(set)) {
      // reconcile view alone is not full reports — still count as read-ish check if any view
    }
    if (hasReadReports(set) || hasAnyAccountingView(set)) return { kind: 'check' };
    if (/\blocker\b/.test(role)) return { kind: 'text', text: 'locker' };
    return { kind: 'dash' };
  }

  if (column === 'write') {
    if (privileged) return { kind: 'check' };
    if (hasWriteCodes(set)) return { kind: 'check' };
    if (/\blocker\b/.test(role)) return { kind: 'text', text: 'receive / deposit' };
    return { kind: 'dash' };
  }

  if (column === 'admin') {
    if (adminRole) return { kind: 'check' };
    if (hasAdminCodes(set)) return { kind: 'check' };
    return { kind: 'dash' };
  }

  if (column === 'payroll') {
    if (adminRole || privileged) return { kind: 'check' };
    const advView = set.has('workshop.accounting.advances.view');
    const advWrite =
      set.has('workshop.accounting.advances.create') ||
      set.has('workshop.accounting.advances.approve');
    const payView = set.has('workshop.accounting.payroll.view');
    const payWrite =
      set.has('workshop.accounting.payroll.create') ||
      set.has('workshop.accounting.payroll.approve');
    if ((advWrite || payWrite) && (advView || payView || advWrite || payWrite)) {
      if (!advWrite && !payWrite && (advView || payView)) {
        return { kind: 'text', text: 'read only' };
      }
      return { kind: 'check' };
    }
    if (advView || payView) return { kind: 'text', text: 'read only' };
    return { kind: 'dash' };
  }

  return { kind: 'dash' };
}

function hasAnyAccountingView(set) {
  for (const c of set) {
    if (isAccountingCode(c) && (c.endsWith('.view') || c.endsWith('.export'))) {
      return true;
    }
  }
  return false;
}

function hasReadReports(set) {
  const keys = [
    'workshop.accounting.chart-of-accounts.view',
    'workshop.accounting.chart-of-accounts.trial-balance.view',
    'workshop.accounting.chart-of-accounts.profit-loss.view',
    'workshop.accounting.chart-of-accounts.balance-sheet.view',
    'workshop.accounting.ledger.view',
  ];
  return keys.some((k) => set.has(k));
}

function hasWriteCodes(set) {
  for (const c of set) {
    if (!isAccountingCode(c)) continue;
    if (
      c.endsWith('.create') ||
      c.endsWith('.edit') ||
      c.endsWith('.approve') ||
      c.endsWith('.manage')
    ) {
      return true;
    }
  }
  return false;
}

function hasAdminCodes(set) {
  // Reverse / unlock / lock / reconcile manage / JE approve as proxy for admin
  if (set.has('workshop.accounting.cash-bank.reconcile.manage')) return true;
  if (set.has('workshop.accounting.journal-entries.create')) {
    // create alone is write; admin needs approve-like
  }
  for (const c of set) {
    if (
      isAccountingCode(c) &&
      (c.endsWith('.approve') || c.includes('period') || c.includes('unlock'))
    ) {
      return true;
    }
  }
  return false;
}

export function mapEmployeeToAccessRow(emp, rolePermsById = new Map()) {
  const roleObj = emp?.permissionRole;
  const roleId = roleObj?.id != null ? String(roleObj.id) : '';
  const roleName =
    roleObj?.name ||
    emp?.role ||
    emp?.userType ||
    emp?.employeeType ||
    '—';
  let codes = normalizePermissionCodes(roleObj?.permissions);
  if (!codes.length && roleId && rolePermsById.has(roleId)) {
    codes = normalizePermissionCodes(rolePermsById.get(roleId));
  }
  if (!codes.length && Array.isArray(emp?.effectiveCodes)) {
    codes = normalizePermissionCodes(emp.effectiveCodes);
  }

  const posOnly = isCashierOrTechnicianRole(
    roleName,
    emp?.userType,
    emp?.employeeType || emp?.role,
  ) && !hasAnyAccountingAccess(codes) && !isOwnerRoleName(roleName, emp?.userType);

  const ctx = {
    roleName,
    userType: emp?.userType,
    posOnly,
  };

  const branchIds = Array.isArray(emp?.effectiveBranchIds)
    ? emp.effectiveBranchIds.map(String)
    : [];

  let workshopScopeKey = 'thisWorkshop';
  if (posOnly) workshopScopeKey = 'posOnly';
  else if (/\blocker\b/i.test(String(roleName))) workshopScopeKey = 'lockerOnly';
  else if (branchIds.length > 0) workshopScopeKey = 'branches';

  return {
    id: String(emp?.userId || emp?.id || ''),
    name: emp?.name || emp?.email || '—',
    email: emp?.email || '',
    roleName: String(roleName),
    roleId,
    workshopScopeKey,
    branchIds,
    codes,
    hasAccounting: hasAnyAccountingAccess(codes) || isOwnerRoleName(roleName, emp?.userType) || isAccountantRoleName(roleName),
    isAccountant: isAccountantRoleName(roleName),
    isCashierTech: posOnly,
    posOnly,
    read: mapAccessColumn('read', codes, ctx),
    write: mapAccessColumn('write', codes, ctx),
    admin: mapAccessColumn('admin', codes, ctx),
    payroll: mapAccessColumn('payroll', codes, ctx),
    actionKey: posOnly ? 'posOnly' : 'edit',
    missingReconcile: RECONCILE_CODES.filter((c) => !codes.includes(c)),
  };
}

export function buildRolesAccessSummary(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    withAccounting: list.filter((r) => r.hasAccounting).length,
    accountants: list.filter((r) => r.isAccountant).length,
    cashierTech: list.filter((r) => r.isCashierTech).length,
    // Blocked attempts needs backend — always null here
    blockedAttempts: null,
  };
}

export function filterAccessRows(rows, filters = {}) {
  let list = Array.isArray(rows) ? rows : [];
  const userQ = String(filters.userId || filters.user || '').trim();
  const roleQ = String(filters.role || '').trim().toLowerCase();
  const branchQ = String(filters.branchId || '').trim();

  if (userQ && userQ !== 'all') {
    list = list.filter(
      (r) =>
        String(r.id) === userQ ||
        String(r.name).toLowerCase().includes(userQ.toLowerCase()),
    );
  }
  if (roleQ && roleQ !== 'all') {
    list = list.filter((r) => String(r.roleName).toLowerCase().includes(roleQ));
  }
  if (branchQ && branchQ !== 'all') {
    list = list.filter(
      (r) =>
        r.workshopScopeKey === 'thisWorkshop' ||
        (Array.isArray(r.branchIds) && r.branchIds.includes(branchQ)),
    );
  }
  return list;
}

export function slicePage(rows, page, pageSize = ACC_ROLES_PAGE_SIZE) {
  const list = Array.isArray(rows) ? rows : [];
  const size = Math.max(1, Number(pageSize) || ACC_ROLES_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(list.length / size) || 1);
  const current = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const start = (current - 1) * size;
  return {
    rows: list.slice(start, start + size),
    page: current,
    pageCount,
    total: list.length,
    from: list.length === 0 ? 0 : start + 1,
    to: Math.min(list.length, start + size),
  };
}

/** Roles that have zero members with reconcile codes — for Needs-backend note. */
export function rolesMissingReconcile(roles) {
  const list = Array.isArray(roles) ? roles : [];
  return list.filter((r) => {
    const codes = normalizePermissionCodes(r?.permissions);
    return RECONCILE_CODES.some((c) => !codes.includes(c));
  });
}
