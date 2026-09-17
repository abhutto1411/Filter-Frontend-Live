import { apiFetch } from './api';

function qs(params = {}) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        sp.set(k, String(v));
    });
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export function advancedReportsParams({
    workshopId,
    branchId,
    categoryId,
    mainFrom,
    mainTo,
    prevFrom,
    prevTo,
    reportType,
    departmentId,
    compareDepartmentId,
    productId,
    itemTypes,
    includeProducts,
    includeServices,
    metric,
    period,
    entityId,
    entityType,
    limit,
} = {}) {
    let resolvedItemTypes = itemTypes;
    if (!resolvedItemTypes && (includeProducts != null || includeServices != null)) {
        const parts = [];
        if (includeProducts !== false) parts.push('product');
        if (includeServices !== false) parts.push('service');
        resolvedItemTypes = parts.join(',') || 'product,service';
    }
    return {
        ...(workshopId ? { workshopId } : {}),
        ...(branchId && branchId !== 'all' ? { branchId } : {}),
        ...(categoryId && categoryId !== 'all' ? { categoryId } : {}),
        ...(mainFrom ? { mainFrom } : {}),
        ...(mainTo ? { mainTo } : {}),
        ...(prevFrom ? { prevFrom } : {}),
        ...(prevTo ? { prevTo } : {}),
        ...(reportType ? { reportType } : {}),
        ...(departmentId && departmentId !== 'all' ? { departmentId } : {}),
        ...(compareDepartmentId && compareDepartmentId !== 'all'
            ? { compareDepartmentId }
            : {}),
        ...(productId ? { productId } : {}),
        ...(resolvedItemTypes ? { itemTypes: resolvedItemTypes } : {}),
        ...(metric ? { metric } : {}),
        ...(period ? { period } : {}),
        ...(entityId ? { entityId } : {}),
        ...(entityType ? { entityType } : {}),
        ...(limit ? { limit } : {}),
    };
}

/** @param {'workshop'|'admin'} portal */
function base(portal) {
    return portal === 'admin'
        ? '/super-admin/advanced-reports'
        : '/workshop-staff/advanced-reports';
}

export async function getAdvancedReportFilterOptions(portal, params = {}) {
    return apiFetch(`${base(portal)}/filter-options${qs(params)}`);
}

export async function getAdvancedReport(portal, params = {}) {
    return apiFetch(`${base(portal)}${qs(params)}`);
}

export async function getAdvancedReportDrilldown(portal, params = {}) {
    return apiFetch(`${base(portal)}/drilldown${qs(params)}`);
}
