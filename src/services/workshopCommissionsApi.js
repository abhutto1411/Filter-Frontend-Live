import { apiFetch } from './api';
import { qs, workshopStaffListScopeQuery } from './workshopStaffApi';

/**
 * Workshop JWT — commission KPIs for the current scope.
 * Query: branchId **or** allBranches=true (see {@link workshopStaffListScopeQuery});
 * optional startDate, endDate (ISO YYYY-MM-DD).
 */
export const getWorkshopCommissionsSummary = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/commissions/summary${qs(params)}`, options);

/** Pending accrued totals grouped by employee (chips row). Same query contract as summary. */
export const getWorkshopCommissionsPendingByEmployee = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/commissions/pending-by-employee${qs(params)}`, options);

/**
 * Paginated commission lines. Query: list scope + optional status, employeeId, startDate, endDate,
 * limit, offset (or page/pageSize — backend may accept either).
 */
export const getWorkshopCommissionsList = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/commissions${qs(params)}`, options);

/** Staff with at least one commission line in scope (filter dropdown). */
export const getWorkshopCommissionsEmployees = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/commissions/employees${qs(params)}`, options);

/** Cash/bank payout sources (COA). When not all branches, pass branchId from scope. */
export const getWorkshopCommissionsPayoutAccounts = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/commissions/payout-accounts${qs(params)}`, options);

/**
 * Mark lines paid and post journal. Body camelCase (snake_case also accepted server-side).
 * @param {{ commissionLineIds: string[], payoutAccountId: string, notes?: string }} body
 */
export const postWorkshopCommissionsPayout = (body) =>
    apiFetch('/workshop-staff/commissions/payout', {
        method: 'POST',
        body: JSON.stringify(body),
    });

/** Commission Rules — workshop-scoped CRUD via /workshop-staff/commissions/rules. */
export const getWorkshopCommissionRules = (search = '') =>
    apiFetch(`/workshop-staff/commissions/rules${search ? `?search=${encodeURIComponent(search)}` : ''}`);

export const createWorkshopCommissionRule = (body) =>
    apiFetch('/workshop-staff/commissions/rules', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateWorkshopCommissionRule = (id, body) =>
    apiFetch(`/workshop-staff/commissions/rules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const deleteWorkshopCommissionRule = (id) =>
    apiFetch(`/workshop-staff/commissions/rules/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });

export const getWorkshopCommissionRuleServices = () =>
    apiFetch('/workshop-staff/commissions/rule-services');

/** Merge branch / all-branches rule with arbitrary extra query params. */
export function workshopCommissionsScopeParams(selectedBranchId, extra = {}) {
    const scope = {
        ...workshopStaffListScopeQuery(selectedBranchId),
        ...extra,
    };
    // Some workshop-staff handlers read snake_case query only.
    if (scope.branchId != null && scope.branchId !== '') {
        scope.branch_id = scope.branchId;
    }
    return scope;
}
