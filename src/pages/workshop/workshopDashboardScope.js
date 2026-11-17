/**
 * Dashboard branch + accounting-basis helpers. Pure — no React, no network.
 */

export const DASHBOARD_BASIS_KEY = 'workshop-dashboard-accounting-basis-v1';
export const PL_BASIS_KPI_KEYS = ['income', 'expenses', 'netProfit', 'grossMargin'];
export const BS_SNAPSHOT_KPI_KEYS = ['cashAndBank', 'accountsReceivable'];

export function parseAccountingBasis(raw) {
  return String(raw || '').trim().toLowerCase() === 'cash' ? 'cash' : 'accrual';
}

export function loadDashboardAccountingBasis() {
  try {
    if (typeof sessionStorage === 'undefined') return 'accrual';
    return parseAccountingBasis(sessionStorage.getItem(DASHBOARD_BASIS_KEY));
  } catch {
    return 'accrual';
  }
}

export function saveDashboardAccountingBasis(basis) {
  const next = parseAccountingBasis(basis);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(DASHBOARD_BASIS_KEY, next);
    }
  } catch {
    /* ignore quota */
  }
  return next;
}

/**
 * Authorized branch pick. Returns the string id, `'all'`, or `null` when the
 * value is outside the user's scope (caller must keep the previous selection).
 */
export function resolveAuthorizedBranchId(
  next,
  { branches = [], lockedId = null, allowAll = true } = {},
) {
  const lock = lockedId == null || lockedId === '' ? null : String(lockedId);
  if (lock) return lock;
  const raw = next == null ? '' : String(next);
  if (!raw || raw === 'all') return allowAll ? 'all' : null;
  const allowed = new Set((branches || []).map((b) => String(b?.id ?? '')).filter(Boolean));
  if (!allowed.has(raw)) return null;
  return raw;
}

/** kpi-summary whitelist is dateFrom/dateTo/branchId only — never `basis`. */
export function kpiSummaryQueryParams({ dateFrom, dateTo, branchId } = {}) {
  const q = {};
  if (dateFrom) q.dateFrom = String(dateFrom);
  if (dateTo) q.dateTo = String(dateTo);
  if (branchId && branchId !== 'all') q.branchId = String(branchId);
  return q;
}

export function plBasisQueryParams({ dateFrom, dateTo, branchId, basis } = {}) {
  const q = {
    dateFrom: dateFrom ? String(dateFrom) : undefined,
    dateTo: dateTo ? String(dateTo) : undefined,
    basis: parseAccountingBasis(basis),
    compare: 'previous_period',
  };
  if (branchId && branchId !== 'all') {
    q.branchId = String(branchId);
    q.branchIds = String(branchId);
  }
  return q;
}

export function unwrapPlPayload(res) {
  if (!res || typeof res !== 'object') return null;
  const root = res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : res;
  return root && typeof root === 'object' ? root : null;
}

/** kpi-summary may arrive as `{ cards }` or interceptor `{ data: { cards } }`. */
export function unwrapKpiSummary(res) {
  if (!res || typeof res !== 'object') return null;
  if (Array.isArray(res.cards)) return res;
  const nested = res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : null;
  if (nested && Array.isArray(nested.cards)) return nested;
  return null;
}

/** Monotonic load token so a slower response cannot restore a previous branch/basis. */
export function nextLoadGen(ref) {
  const cur = ref && typeof ref === 'object' ? Number(ref.current) || 0 : 0;
  const next = cur + 1;
  if (ref && typeof ref === 'object') ref.current = next;
  return next;
}

export function isStaleLoad(ref, gen) {
  return !ref || gen !== ref.current;
}
