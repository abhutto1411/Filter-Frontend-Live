import { apiFetch } from './api';
import { qs } from './workshopStaffApi';

/**
 * Build the standard query for /super-admin/sales-reports/* endpoints.
 * `workshopId` is required (server returns 400 otherwise). Branch handling:
 * pass `branchId` for a single branch, or omit branch / pass allBranches=true
 * to cover every active branch of the selected workshop.
 *
 * Sends both snake_case and camelCase variants of date / technician keys for
 * DTO compatibility, plus the client's IANA time zone so the Daily Sales
 * buckets render in the admin's wall-clock.
 *
 * @param {string|number} workshopId  super-admin must always select a workshop first
 * @param {string|number|'all'|''|null|undefined} branchId  empty/'all' → all branches
 * @param {{ startDate?: string, endDate?: string, technicianId?: string }} opts
 */
export function adminSalesReportsParams(workshopId, branchId, opts = {}) {
    const { startDate = '', endDate = '', technicianId = '' } = opts;
    const q = { workshopId: String(workshopId ?? '') };
    if (branchId == null || branchId === '' || branchId === 'all') {
        q.allBranches = true;
    } else {
        q.branchId = String(branchId);
        q.branch_id = String(branchId);
    }
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
            q.client_time_zone = tz;
            q.clientTimeZone = tz;
        }
    } catch (_) {
        /* ignore */
    }
    if (startDate) {
        q.start_date = startDate;
        q.startDate = startDate;
    }
    if (endDate) {
        q.end_date = endDate;
        q.endDate = endDate;
    }
    if (technicianId != null && String(technicianId) !== '') {
        const tid = String(technicianId);
        q.technician_id = tid;
        q.employee_id = tid;
    }
    return q;
}

const BASE = '/super-admin/sales-reports';

export const getAdminSalesAnalytics = (params = {}, options = {}) =>
    apiFetch(`${BASE}/analytics${qs(params)}`, options);

export const getAdminSalesByTechnician = (params = {}, options = {}) =>
    apiFetch(`${BASE}/by-technician${qs(params)}`, options);

export const getAdminSalesByCustomer = (params = {}, options = {}) =>
    apiFetch(`${BASE}/by-customer${qs(params)}`, options);

export const getAdminSalesByProduct = (params = {}, options = {}) =>
    apiFetch(`${BASE}/by-product${qs(params)}`, options);

export const getAdminSalesByDepartment = (params = {}, options = {}) =>
    apiFetch(`${BASE}/by-department${qs(params)}`, options);

export const getAdminSalesByCategory = (params = {}, options = {}) =>
    apiFetch(`${BASE}/by-category${qs(params)}`, options);

export const getAdminSalesByBranch = (params = {}, options = {}) =>
    apiFetch(`${BASE}/by-branch${qs(params)}`, options);

export const getAdminSalesByCashier = (params = {}, options = {}) =>
    apiFetch(`${BASE}/by-cashier${qs(params)}`, options);

export const getAdminSalesDailyDetails = (date, params = {}, options = {}) =>
    apiFetch(
        `${BASE}/daily-sales/${encodeURIComponent(String(date))}/details${qs(params)}`,
        options,
    );

export const getAdminSalesByTechnicianDetails = (id, params = {}, options = {}) =>
    apiFetch(
        `${BASE}/by-technician/${encodeURIComponent(String(id))}/details${qs(params)}`,
        options,
    );

export const getAdminSalesByCustomerDetails = (id, params = {}, options = {}) =>
    apiFetch(
        `${BASE}/by-customer/${encodeURIComponent(String(id))}/details${qs(params)}`,
        options,
    );

export const getAdminSalesByProductDetails = (id, params = {}, options = {}) =>
    apiFetch(
        `${BASE}/by-product/${encodeURIComponent(String(id))}/details${qs(params)}`,
        options,
    );

export const getAdminSalesByDepartmentDetails = (id, params = {}, options = {}) =>
    apiFetch(
        `${BASE}/by-department/${encodeURIComponent(String(id))}/details${qs(params)}`,
        options,
    );

export const getAdminSalesByCategoryDetails = (id, params = {}, options = {}) =>
    apiFetch(
        `${BASE}/by-category/${encodeURIComponent(String(id))}/details${qs(params)}`,
        options,
    );

export const getAdminSalesByBranchDetails = (id, params = {}, options = {}) =>
    apiFetch(
        `${BASE}/by-branch/${encodeURIComponent(String(id))}/details${qs(params)}`,
        options,
    );

export const getAdminSalesByCashierDetails = (id, params = {}, options = {}) =>
    apiFetch(
        `${BASE}/by-cashier/${encodeURIComponent(String(id))}/details${qs(params)}`,
        options,
    );

export const getAdminSalesRecentOrders = (params = {}, options = {}) =>
    apiFetch(`${BASE}/recent-orders${qs(params)}`, options);

export const getAdminSalesRecentOpenOrderDetails = (salesOrderId, params = {}, options = {}) =>
    apiFetch(
        `${BASE}/recent-orders/open-order/${encodeURIComponent(String(salesOrderId))}/details${qs(params)}`,
        options,
    );

export const getAdminSalesRecentOrderDetails = (invoiceId, params = {}, options = {}) =>
    apiFetch(
        `${BASE}/recent-orders/${encodeURIComponent(String(invoiceId))}/details${qs(params)}`,
        options,
    );
