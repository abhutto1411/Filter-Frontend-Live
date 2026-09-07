export { adminSalesReportsParams } from './adminSalesReportsApi';
import { apiFetch } from './api';
import { qs } from './workshopStaffApi';

const BASE = '/super-admin-marketing-protal/sales-reports';

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
