import { apiFetch } from './api';
import { mergeAccountingScopeBody } from '../utils/accountingWorkshopScope';
import { workshopStaffListScopeQuery } from './workshopStaffApi';

/** Build query string for commission endpoints — never merge HQ accounting scope (avoids wrong workshopId). */
function commissionsQs(params = {}) {
    const scope = { ...(params || {}) };
    if (scope.allBranches === true) scope.allBranches = 'true';
    if (scope.branchId != null && scope.branchId !== '') {
        scope.branch_id = String(scope.branchId);
    }
    if (scope.workshopId != null && String(scope.workshopId).trim() !== '') {
        scope.workshop_id = String(scope.workshopId);
    }
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(scope)) {
        if (v != null && v !== '' && String(v) !== 'undefined') {
            p.set(k, String(v));
        }
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

/**
 * Workshop JWT — commission KPIs for the current scope.
 * Query: branchId **or** allBranches=true (see {@link workshopStaffListScopeQuery});
 * optional startDate, endDate (ISO YYYY-MM-DD).
 */
export const getWorkshopCommissionsSummary = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/commissions/summary${commissionsQs(params)}`, options);

/** Pending accrued totals grouped by employee (chips row). Same query contract as summary. */
export const getWorkshopCommissionsPendingByEmployee = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/commissions/pending-by-employee${commissionsQs(params)}`, options);

/**
 * Paginated commission lines. Query: list scope + optional status, employeeId, startDate, endDate,
 * page, pageSize (defaults: page 1, pageSize 25).
 */
export const getWorkshopCommissionsList = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/commissions${commissionsQs(params)}`, options);

/** Staff with at least one commission line in scope (filter dropdown). */
export const getWorkshopCommissionsEmployees = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/commissions/employees${commissionsQs(params)}`, options);

/** Cash/bank payout sources (COA). When not all branches, pass branchId from scope. */
export const getWorkshopCommissionsPayoutAccounts = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/commissions/payout-accounts${commissionsQs(params)}`, options);

/**
 * Mark lines paid and post journal. Body camelCase (snake_case also accepted server-side).
 * @param {{ commissionLineIds: string[], payoutAccountId: string, notes?: string, workshopId?: string }} body
 */
export const postWorkshopCommissionsPayout = (body) =>
    apiFetch('/workshop-staff/commissions/payout', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
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
    if (extra.workshopId != null && String(extra.workshopId).trim() !== '') {
        scope.workshopId = String(extra.workshopId);
    }
    if (scope.allBranches === true) {
        scope.allBranches = 'true';
    }
    // Some workshop-staff handlers read snake_case query only.
    if (scope.branchId != null && scope.branchId !== '') {
        scope.branch_id = scope.branchId;
    }
    return scope;
}
