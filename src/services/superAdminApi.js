import { apiFetch } from './api';

// Build query string — skips undefined/null/empty values
function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '' && String(v) !== 'undefined') p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export const getStats = () =>
    apiFetch('/super-admin/stats');

// ─── Master Catalog: Duplication Review ───────────────────────────────────────

export const getDuplicates = ({ entityType } = {}) =>
    apiFetch(`/super-admin/master-catalog/duplicates${qs({ entityType })}`);

export const ignoreDuplicate = ({ entityType, nameKey }) =>
    apiFetch('/super-admin/master-catalog/duplicates/ignore', {
        method: 'POST',
        body: JSON.stringify({ entityType, nameKey }),
    });

export const unignoreDuplicate = ({ entityType, nameKey }) =>
    apiFetch(`/super-admin/master-catalog/duplicates/ignore${qs({ entityType, nameKey })}`, {
        method: 'DELETE',
    });

/** Deletes one record from a duplicate group (uses underlying entity delete logic). */
export const deleteDuplicateItem = (entityType, id) =>
    apiFetch(`/super-admin/master-catalog/duplicates/${entityType}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });

// ─── Master Catalog: Product Requests ─────────────────────────────────────────

export const getProductRequestKpis = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/master-catalog/product-requests/kpis${qs({ workshopId })}`);

export const getProductRequests = ({ status, workshopId, limit, offset } = {}) =>
    apiFetch(`/super-admin/master-catalog/product-requests${qs({ status, workshopId, limit, offset })}`);

export const getProductRequest = (id) =>
    apiFetch(`/super-admin/master-catalog/product-requests/${encodeURIComponent(String(id))}`);

export const approveProductRequest = (id, payload) =>
    apiFetch(`/super-admin/master-catalog/product-requests/${encodeURIComponent(String(id))}/approve`, {
        method: 'PATCH',
        body: JSON.stringify(payload && typeof payload === 'object' ? payload : {}),
    });

export const rejectProductRequest = (id, reason) =>
    apiFetch(`/super-admin/master-catalog/product-requests/${encodeURIComponent(String(id))}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
    });

// ─── Master Catalog KPIs ──────────────────────────────────────────────────────

/**
 * Combined KPIs for the master catalog landing.
 * Shape: { products: { total, active, inactive }, services: {...},
 *          departments: {...}, categories: { total, byType: { product, service, expense } } }
 */
export const getMasterCatalogKpis = () =>
    apiFetch('/super-admin/master-catalog/kpis');

export const getMasterCatalogProductKpis = () =>
    apiFetch('/super-admin/master-catalog/kpis/products');

export const getMasterCatalogServiceKpis = () =>
    apiFetch('/super-admin/master-catalog/kpis/services');

export const getMasterCatalogDepartmentKpis = () =>
    apiFetch('/super-admin/master-catalog/kpis/departments');

export const getMasterCatalogCategoryKpis = () =>
    apiFetch('/super-admin/master-catalog/kpis/categories');

export const getDepartmentProducts = () =>
    apiFetch('/super-admin/master-catalog/departments/products');

export const getDepartmentServices = () =>
    apiFetch('/super-admin/master-catalog/departments/services');

// ─── Workshops ────────────────────────────────────────────────────────────────

export const getWorkshops = ({ status, limit, offset } = {}) =>
    apiFetch(`/super-admin/workshops${qs({ status, limit, offset })}`);

export const getWorkshopOptions = () =>
    apiFetch('/super-admin/workshops/options');

export const getWorkshop = (id) =>
    apiFetch(`/super-admin/workshops/${id}`);

export const createWorkshop = (body) =>
    apiFetch('/super-admin/workshops', { method: 'POST', body: JSON.stringify(body) });

/** Partial update — body fields optional (e.g. status, name, ownerName, mobile, email, address, taxId, crNumber, workshopCode, gpsLat, gpsLng). */
export const updateWorkshop = (id, body) =>
    apiFetch(`/super-admin/workshops/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

/** Shared DTO for workshop credential WhatsApp endpoints (Meta template + wa.me link). */
function buildWorkshopCredentialsWhatsappBody({
    workshopId,
    password,
    login_url,
    to,
    name,
    email,
    userId,
    templateName,
    languageCode,
} = {}) {
    const body = {
        workshopId: String(workshopId ?? '').trim(),
    };
    const pwd = password != null ? String(password) : '';
    if (pwd !== '') body.password = pwd;
    const addStr = (key, val) => {
        if (val == null) return;
        const s = String(val).trim();
        if (s === '') return;
        body[key] = key === 'to' ? s.replace(/\D/g, '') : s;
    };
    addStr('login_url', login_url);
    addStr('to', to);
    addStr('name', name);
    addStr('email', email);
    if (userId != null && String(userId).trim() !== '') body.userId = String(userId).trim();
    const tn = templateName != null && String(templateName).trim() !== '' ? String(templateName).trim() : '';
    const lc = languageCode != null && String(languageCode).trim() !== '' ? String(languageCode).trim() : '';
    if (tn) body.templateName = tn;
    if (lc) body.languageCode = lc;
    return body;
}

/**
 * Meta WhatsApp template — workshop portal credentials.
 * Recommended body: { workshopId, password } — backend fills to, name, email, login_url from workshop / owner (and env).
 * Omit password to let backend generate and persist (when supported). Optional overrides (omit when empty): login_url, to, name, email, userId, templateName, languageCode.
 */
export const postSuperAdminWhatsappWorkshopCredentials = (params = {}) =>
    apiFetch('/super-admin/whatsapp/templates/workshop-credentials', {
        method: 'POST',
        body: JSON.stringify(buildWorkshopCredentialsWhatsappBody(params)),
    });

/**
 * WhatsApp Web/App prefilled message (wa.me) — no Meta Cloud API env required.
 * Same body shape as Meta template call; response includes waMeUrl to open in a new tab.
 * Backend must register POST /super-admin/whatsapp/workshop-credentials-wa-me-link (otherwise Workshop page falls back to client-built wa.me from saved template + row phone on 404).
 */
export const postSuperAdminWhatsappWorkshopCredentialsWaMeLink = (params = {}) =>
    apiFetch('/super-admin/whatsapp/workshop-credentials-wa-me-link', {
        method: 'POST',
        body: JSON.stringify(buildWorkshopCredentialsWhatsappBody(params)),
    });

// ─── Corporate price quotations (Super Admin token) ─────────────────────────

/** List corporate price quotation lines (super-admin). */
export const getSuperAdminCorporatePriceQuotations = (params = {}) =>
    apiFetch(`/super-admin/corporate-price-quotations${qs(params)}`);

export const approveSuperAdminCorporatePriceQuotation = (id) =>
    apiFetch(`/super-admin/corporate-price-quotations/${encodeURIComponent(String(id))}/approve`, { method: 'POST' });

export const rejectSuperAdminCorporatePriceQuotation = (id, body) =>
    apiFetch(`/super-admin/corporate-price-quotations/${encodeURIComponent(String(id))}/reject`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

// ─── Branches ─────────────────────────────────────────────────────────────────

export const getBranches = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/branches${qs({ workshopId })}`);

export const getBranch = (id) =>
    apiFetch(`/super-admin/branches/${id}`);

export const createBranch = (body) =>
    apiFetch('/super-admin/branches', { method: 'POST', body: JSON.stringify(body) });

export const updateBranch = (id, body) =>
    apiFetch(`/super-admin/branches/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Inventory (super-admin): adopted products & stock movements ─────────────

/** Adopted products + stock for a workshop branch. Query: workshopId, branchId (required); optional search (same as catalog filter); limit default 50, max 200; offset. */
export const getSuperAdminInventoryProducts = ({ workshopId, branchId, search, limit, offset } = {}) =>
    apiFetch(`/super-admin/inventory/products${qs({ workshopId, branchId, search, limit, offset })}`);

/** Dedicated search — matches name/sku/brand case-insensitive. Same paginated envelope as list. workshopId & branchId required. */
export const searchSuperAdminInventoryProducts = ({ workshopId, branchId, q, limit, offset } = {}) =>
    apiFetch(`/super-admin/inventory/products/search${qs({ workshopId, branchId, q, limit, offset })}`);

/** Movement timeline for one product (workshop + branch). summary.* is global; entries are paginated. */
export const getSuperAdminInventoryProductMovements = (productId, { workshopId, branchId, from, to, limit, offset } = {}) =>
    apiFetch(
        `/super-admin/inventory/products/${encodeURIComponent(String(productId))}/movements${qs({
            workshopId,
            branchId,
            from,
            to,
            limit,
            offset,
        })}`,
    );

/**
 * Universal inventory ledger — global movement rows (workshop + branch on each row).
 * All query params optional. `from` / `to`: YYYY-MM-DD inclusive. `search`: name/sku/brand contains.
 * Backend default limit 50, max 200; `offset` default 0.
 * Response data: { entries[], total, limit, offset } — rows use kind, inQty, outQty, balanceAfter (per workshop+branch+product).
 */
export const getSuperAdminInventoryLedger = ({
    workshopId,
    branchId,
    productId,
    from,
    to,
    search,
    limit,
    offset,
} = {}) =>
    apiFetch(
        `/super-admin/inventory/ledger${qs({
            workshopId,
            branchId,
            productId,
            from,
            to,
            search,
            limit,
            offset,
        })}`,
    );

/** Branch starting stock (opening qty). Query: workshopId, branchId (required). Body: openingQty (required), previousOpeningQty (optional), syncCurrentQty (optional — default true sets branch on-hand = new opening + audit; false = opening field only), note (optional). */
export const patchSuperAdminInventoryProductStartingStock = (
    productId,
    { workshopId, branchId, openingQty, previousOpeningQty, syncCurrentQty, note } = {},
) => {
    const body = { openingQty };
    if (previousOpeningQty != null && !Number.isNaN(Number(previousOpeningQty))) {
        body.previousOpeningQty = Number(previousOpeningQty);
    }
    if (syncCurrentQty === false) body.syncCurrentQty = false;
    if (note != null && String(note).trim() !== '') body.note = String(note).trim();
    return apiFetch(
        `/super-admin/inventory/products/${encodeURIComponent(String(productId))}/starting-stock${qs({
            workshopId,
            branchId,
        })}`,
        { method: 'PATCH', body: JSON.stringify(body) },
    );
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const getUsers = ({ userType, workshopId, limit, offset } = {}) =>
    apiFetch(`/super-admin/users${qs({ userType, workshopId, limit, offset })}`);

export const getUser = (id) =>
    apiFetch(`/super-admin/users/${id}`);

export const updateUser = (id, body) =>
    apiFetch(`/super-admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const changeUserPassword = (id, newPassword) =>
    apiFetch(`/super-admin/users/${id}/password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
    });

export const setUserActive = (id, isActive) =>
    apiFetch(`/super-admin/users/${id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
    });

// ─── Technicians ──────────────────────────────────────────────────────────────

export const getTechnicians = ({ workshopId, branchId } = {}) =>
    apiFetch(`/super-admin/technicians${qs({ workshopId, branchId })}`);

export const getTechnician = (id) =>
    apiFetch(`/super-admin/technicians/${id}`);

export const createTechnician = (body) =>
    apiFetch('/super-admin/technicians', { method: 'POST', body: JSON.stringify(body) });

export const updateTechnician = (id, body) =>
    apiFetch(`/super-admin/technicians/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const getSuppliers = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/suppliers${qs({ workshopId })}`);

export const getSupplier = (id) =>
    apiFetch(`/super-admin/suppliers/${id}`);

export const createSupplier = (body) =>
    apiFetch('/super-admin/suppliers', { method: 'POST', body: JSON.stringify(body) });

export const updateSupplier = (id, body) =>
    apiFetch(`/super-admin/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Products ─────────────────────────────────────────────────────────────────

export const getProducts = ({ branchId, signal } = {}) =>
    apiFetch(`/super-admin/products${qs({ branchId })}`, { signal });

export const getProduct = (id) =>
    apiFetch(`/super-admin/products/${id}`);

export const createProduct = (body) =>
    apiFetch('/super-admin/products', { method: 'POST', body: JSON.stringify(body) });

/** PATCH body: flat fields only. `departmentId` is not supported (department fixed after create). `categoryId` is supported to move the product to another category. 200 = flat product (same shape as list/get), not `{ product }`. */
export const updateProduct = (id, body) =>
    apiFetch(`/super-admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

/** 200 `{ success, message }` when delete succeeds. 400 if in use — soft-delete with PATCH `{ isActive: false }`. */
export const deleteProduct = (id) =>
    apiFetch(`/super-admin/products/${id}`, { method: 'DELETE' });

/** Multipart CSV import; field name must be `file` (max 5MB, .csv). Logging lives in apiFetch. */
export const importProductsFromCsv = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/super-admin/products/import', {
        method: 'POST',
        body: formData,
    });
};

/** Same response shape as product import: created, skippedDuplicate, failed, vatWarningsCount, rowDetails, vatWarnings. Header must match Services.csv / SERVICE_CSV_CANONICAL_HEADERS. */
export const importServicesFromCsv = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/super-admin/services/import', {
        method: 'POST',
        body: formData,
    });
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const getCategories = ({ type, signal } = {}) =>
    apiFetch(`/super-admin/categories${qs({ type })}`, { signal });

export const createCategory = (body) =>
    apiFetch('/super-admin/categories', { method: 'POST', body: JSON.stringify(body) });

export const updateCategory = (id, body) =>
    apiFetch(`/super-admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteCategory = (id) =>
    apiFetch(`/super-admin/categories/${id}`, { method: 'DELETE' });

// ─── Cashiers ─────────────────────────────────────────────────────────────────

export const getCashiers = ({ workshopId, branchId } = {}) =>
    apiFetch(`/super-admin/cashiers${qs({ workshopId, branchId })}`);

export const getCashier = (id) =>
    apiFetch(`/super-admin/cashiers/${id}`);

export const createCashier = (body) =>
    apiFetch('/super-admin/cashiers', { method: 'POST', body: JSON.stringify(body) });

export const updateCashier = (id, body) =>
    apiFetch(`/super-admin/cashiers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Customers ────────────────────────────────────────────────────────────────

export const getCustomers = ({ workshopId, customerType } = {}) =>
    apiFetch(`/super-admin/customers${qs({ workshopId, customerType })}`);

export const getCustomerDetails = (id) =>
    apiFetch(`/super-admin/customers/${encodeURIComponent(String(id))}/details`);

export const updateCustomer = (id, body) =>
    apiFetch(`/super-admin/customers/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body && typeof body === 'object' ? body : {}),
    });

/** Direct corporate registration by super-admin (immediate active; no approval queue). */
export const createCorporateCustomerDirect = (body) =>
    apiFetch('/super-admin/corporate/register', { method: 'POST', body: JSON.stringify(body) });

// ─── Departments ──────────────────────────────────────────────────────────────

export const getDepartments = () =>
    apiFetch('/super-admin/departments');

export const createDepartment = (body) =>
    apiFetch('/super-admin/departments', { method: 'POST', body: JSON.stringify(body) });

export const updateDepartment = (id, body) =>
    apiFetch(`/super-admin/departments/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteDepartment = (id) =>
    apiFetch(`/super-admin/departments/${id}`, { method: 'DELETE' });

// ─── Tax Codes ────────────────────────────────────────────────────────────────

/** Tax config for Super Admin. First load can return { id: null, vatRate: 15, taxes: [], updatedAt: null }. */
export const getTaxCodesConfig = () =>
    apiFetch('/super-admin/tax-codes/config');

/** Replace-all save for tax config. Body: { vatRate, taxes: [{ name, percent, sortOrder?, isActive? }] }. */
export const saveTaxCodesConfig = (body) =>
    apiFetch('/super-admin/tax-codes/config', { method: 'PUT', body: JSON.stringify(body) });

// ─── Sales Orders ─────────────────────────────────────────────────────────────

export const getSalesOrders = ({
    workshopId,
    branchId,
    status,
    search,
    startDate,
    endDate,
    limit,
    offset,
} = {}) =>
    apiFetch(
        `/super-admin/sales-orders${qs({
            workshopId,
            branchId,
            status,
            search,
            startDate,
            endDate,
            limit,
            offset,
        })}`,
    );

export const getSalesOrder = (id) =>
    apiFetch(`/super-admin/sales-orders/${encodeURIComponent(String(id))}`);

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const getInvoices = ({
    workshopId,
    branchId,
    paymentStatus,
    search,
    startDate,
    endDate,
    limit,
    offset,
} = {}) =>
    apiFetch(
        `/super-admin/invoices${qs({
            workshopId,
            branchId,
            paymentStatus,
            search,
            startDate,
            endDate,
            limit,
            offset,
        })}`,
    );

export const getInvoice = (id) =>
    apiFetch(`/super-admin/invoices/${encodeURIComponent(String(id))}`);

// ─── Supplier Invoices (supplier → workshop sales / AR) ───────────────────────

export const getSupplierInvoices = ({
    workshopId,
    branchId,
    supplierId,
    status,
    workshopReviewStatus,
    search,
    startDate,
    endDate,
    limit,
    offset,
} = {}) =>
    apiFetch(
        `/super-admin/supplier-invoices${qs({
            workshopId,
            branchId,
            supplierId,
            status,
            workshopReviewStatus,
            search,
            startDate,
            endDate,
            limit,
            offset,
        })}`,
    );

export const getSupplierInvoice = (id) =>
    apiFetch(`/super-admin/supplier-invoices/${encodeURIComponent(String(id))}`);

export const getLocalSupplierInvoice = (id) =>
    apiFetch(`/super-admin/local-supplier-invoices/${encodeURIComponent(String(id))}`);

// ─── Corporate payment approvals (proof images) ───────────────────────────────

export const listCorporatePaymentApprovals = ({ status, corporateAccountId, limit, offset } = {}) =>
    apiFetch(`/super-admin/corporate-payment-approvals${qs({ status, corporateAccountId, limit, offset })}`);

export const getCorporatePaymentApproval = (id) =>
    apiFetch(`/super-admin/corporate-payment-approvals/${encodeURIComponent(String(id))}`);

export const approveCorporatePaymentApproval = (id) =>
    apiFetch(`/super-admin/corporate-payment-approvals/${encodeURIComponent(String(id))}/approve`, {
        method: 'POST',
    });

export const rejectCorporatePaymentApproval = (id, reason) =>
    apiFetch(`/super-admin/corporate-payment-approvals/${encodeURIComponent(String(id))}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });

/** Same bilingual simplified-tax-invoice shape used by the corporate portal modal. */
export const getSuperAdminInvoiceView = (id) =>
    apiFetch(`/super-admin/invoices/${encodeURIComponent(String(id))}/view`);

// ─── Services ─────────────────────────────────────────────────────────────────

/** Newest first (`createdAt` desc). Rows include `categoryId`, `categoryName`, `isPriceEditable`, `vatMode`, `createdAt` (ISO-8601), etc. */
export const getServices = () =>
    apiFetch('/super-admin/services');

export const createService = (body) =>
    apiFetch('/super-admin/services', { method: 'POST', body: JSON.stringify(body) });

export const updateService = (id, body) =>
    apiFetch(`/super-admin/services/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteService = (id) =>
    apiFetch(`/super-admin/services/${id}`, { method: 'DELETE' });

// ─── Corporate Registrations ──────────────────────────────────────────────────

export const getCorporateRegistrations = ({ status } = {}) =>
    apiFetch(`/super-admin/corporate-registrations${qs({ status })}`);

export const approveCorporateRegistration = (id) =>
    apiFetch(`/super-admin/corporate-registrations/${id}/approve`, { method: 'POST' });

export const rejectCorporateRegistration = (id, reason) =>
    apiFetch(`/super-admin/corporate-registrations/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });

// ─── Supplier Registrations ───────────────────────────────────────────────────

export const getSupplierRegistrations = () =>
    apiFetch('/super-admin/supplier/registrations');

export const approveSupplierRegistration = (requestId) =>
    apiFetch('/super-admin/supplier/registrations/approve', {
        method: 'POST',
        body: JSON.stringify({ requestId }),
    });

export const rejectSupplierRegistration = () =>
    apiFetch('/super-admin/supplier/registrations/reject', { method: 'POST' });

// ─── Banners ──────────────────────────────────────────────────────────────────

export const getBanners = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/banners${qs({ workshopId })}`);

export const createBanner = (body) =>
    apiFetch('/super-admin/banners', { method: 'POST', body: JSON.stringify(body) });
