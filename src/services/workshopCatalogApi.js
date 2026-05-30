import { apiFetch } from './api';

function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v != null && v !== '' && String(v) !== 'undefined') p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

/** Maps page/pageSize to limit/offset for backends that ignore page-based params. */
function pagedQueryFields(page, pageSize) {
    const pg = page != null ? Number(page) : NaN;
    const ps = pageSize != null ? Number(pageSize) : NaN;
    if (!Number.isFinite(pg) || !Number.isFinite(ps) || pg < 1 || ps < 1) return {};
    const offset = (pg - 1) * ps;
    return {
        page: pg,
        pageSize: ps,
        size: ps,
        limit: ps,
        offset,
    };
}

// ─── Browse master catalog (workshop JWT) ───────────────────────────────────
// Same global rows as super-admin departments / categories / products / services tables.
// GET /workshop-catalog/catalog/* is a read-only, workshop-safe projection (filters,
// pagination, adoption flags)—not a separate product list. Do not call /super-admin/* here.
//
// `listScope=master` (default on these helpers): asks for full master-table browse for adoption.
//
// Optional `branchId`: affects `inBranch` and branch validation on each row only—it does NOT
// change which master rows are returned. Omit for full browse; pass when the UI needs
// branch-specific badges or adopt flows.
//
// `inWorkshop` / `inBranch` reflect active adoption only (isActive on workshop_* / branch_* links;
// soft-disabled adoptions should not appear as “in catalog” for that workshop/branch).
//
// Writes: POST /workshop-catalog/... and POST /workshop-catalog/branches/... (adoption/link rows).
const DEFAULT_CATALOG_LIST_SCOPE = 'master';

export const getCatalogDepartments = ({ branchId, listScope = DEFAULT_CATALOG_LIST_SCOPE, signal } = {}) =>
    apiFetch(`/workshop-catalog/catalog/departments${qs({ branchId, listScope })}`, { signal });

export const getCatalogCategories = ({ departmentId, type, branchId, listScope = DEFAULT_CATALOG_LIST_SCOPE, signal } = {}) =>
    apiFetch(`/workshop-catalog/catalog/categories${qs({ departmentId, type, branchId, listScope })}`, { signal });

/** Master units of measure (same registry as super-admin inventory UOM). Optional until BE exposes the route. */
export const getCatalogUnitsOfMeasure = ({ branchId, listScope = DEFAULT_CATALOG_LIST_SCOPE, signal } = {}) =>
    apiFetch(`/workshop-catalog/catalog/units-of-measure${qs({ branchId, listScope })}`, { signal });

/**
 * Workshop submits a request to add a new product to the master catalog (super-admin approval queue).
 * Body shape is best-effort across BE versions; adjust when the contract is finalized.
 */
export const submitCatalogProductRequest = (body) =>
    apiFetch('/workshop-catalog/catalog/product-requests', { method: 'POST', body: JSON.stringify(body) });

/** Each row includes `createdAt` (ISO-8601); backend lists newest first (`createdAt` desc). */
export const getCatalogProducts = ({ departmentId, categoryId, q, page, pageSize, branchId, listScope = DEFAULT_CATALOG_LIST_SCOPE, signal } = {}) =>
    apiFetch(
        `/workshop-catalog/catalog/products${qs({
            departmentId,
            categoryId,
            q,
            ...pagedQueryFields(page, pageSize),
            branchId,
            listScope,
        })}`,
        { signal },
    );

/** Each row includes `createdAt` (ISO-8601); backend lists newest first (`createdAt` desc). */
export const getCatalogServices = ({ departmentId, categoryId, q, page, pageSize, branchId, listScope = DEFAULT_CATALOG_LIST_SCOPE, signal } = {}) =>
    apiFetch(
        `/workshop-catalog/catalog/services${qs({
            departmentId,
            categoryId,
            q,
            ...pagedQueryFields(page, pageSize),
            branchId,
            listScope,
        })}`,
        { signal },
    );

// ─── Browse what's already adopted in my workshop ────────────────────────────
// Every row now includes `branches: [{ id, name }]` and `branchNames: string[]`
// listing every branch in the workshop that's currently holding the item.

/** Optional `branchId`: when set, only items adopted for that branch (workshop JWT). */
export const getMyDepartments = ({ branchId, signal } = {}) =>
    apiFetch(`/workshop-catalog/my/departments${qs({ branchId })}`, { signal });

export const getMyCategories = ({ departmentId, type, branchId, signal } = {}) =>
    apiFetch(`/workshop-catalog/my/categories${qs({ departmentId, type, branchId })}`, { signal });

export const getMyProducts = ({ departmentId, categoryId, isActive, branchId, signal } = {}) =>
    apiFetch(`/workshop-catalog/my/products${qs({ departmentId, categoryId, isActive, branchId })}`, { signal });

export const getMyServices = ({ departmentId, categoryId, isActive, branchId, signal } = {}) =>
    apiFetch(`/workshop-catalog/my/services${qs({ departmentId, categoryId, isActive, branchId })}`, { signal });

// ─── Adopt (auto-adds missing parents) ───────────────────────────────────────

/** body: { departmentIds, categorySelections?: [{ departmentId, categoryIds: string[] | "all" }] } */
export const adoptDepartments = (body) =>
    apiFetch('/workshop-catalog/departments', { method: 'POST', body: JSON.stringify(body) });

/** body: { categoryIds }  — parent departments auto-added. */
export const adoptCategories = (body) =>
    apiFetch('/workshop-catalog/categories', { method: 'POST', body: JSON.stringify(body) });

/** body: { items: [{ productId, openingQty?, criticalStockPoint?, salePriceOverride? }] } */
export const adoptProducts = (body) =>
    apiFetch('/workshop-catalog/products', { method: 'POST', body: JSON.stringify(body) });

/** body: { items: [{ serviceId, sellingPriceOverride?, isPriceEditable? }] } */
export const adoptServices = (body) =>
    apiFetch('/workshop-catalog/services', { method: 'POST', body: JSON.stringify(body) });

// ─── Preview (no writes) ─────────────────────────────────────────────────────

/** body: { productIds }  → { missing: { departments, categories } } */
export const previewProductDeps = (body) =>
    apiFetch('/workshop-catalog/products/preview-dependencies', { method: 'POST', body: JSON.stringify(body) });

/** body: { serviceIds } → { missing: { departments, categories } } */
export const previewServiceDeps = (body) =>
    apiFetch('/workshop-catalog/services/preview-dependencies', { method: 'POST', body: JSON.stringify(body) });

// ─── Per-branch adoption ─────────────────────────────────────────────────────
// `branchIds` is optional in every body. If omitted, the backend resolves it
// to every active branch in the workshop. Adopting a category auto-adopts the
// parent department; adopting a product/service auto-adopts both parent
// department and category — all to the same branches.
//
// Response shape:
// {
//   success,
//   added: {
//     departments: [{ branchId, branchName, itemId, itemName, kind: 'department' }],
//     categories:  [...],
//     products:    [...],
//     services:    [...],
//   },
//   skipped: [{ kind, branchId, itemId, reason }]
// }

/** body: { branchIds?, departmentIds, categorySelections? } */
export const adoptDepartmentsToBranches = (body) =>
    apiFetch('/workshop-catalog/branches/departments', { method: 'POST', body: JSON.stringify(body) });

/** body: { branchIds?, categoryIds } */
export const adoptCategoriesToBranches = (body) =>
    apiFetch('/workshop-catalog/branches/categories', { method: 'POST', body: JSON.stringify(body) });

/** body: { branchIds?, items: [{ productId, openingQty?, criticalStockPoint?, salePriceOverride? }] } */
export const adoptProductsToBranches = (body) =>
    apiFetch('/workshop-catalog/branches/products', { method: 'POST', body: JSON.stringify(body) });

/** body: { branchIds?, items: [{ serviceId, sellingPriceOverride?, isPriceEditable? }] } */
export const adoptServicesToBranches = (body) =>
    apiFetch('/workshop-catalog/branches/services', { method: 'POST', body: JSON.stringify(body) });

// ─── Per-branch listing ──────────────────────────────────────────────────────

export const getBranchDepartments = (branchId, { signal } = {}) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/departments`, { signal });

export const getBranchCategories = (branchId, { type, departmentId, signal } = {}) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/categories${qs({ type, departmentId })}`, { signal });

/**
 * Catalog-service flat lists (workshop-catalog). Prefer workshop-staff branch products/services
 * for portal reads — see `getWorkshopStaffBranchProducts` / `getWorkshopStaffBranchServices`.
 * Each row: branch-effective *BeforeVat; nested product/service snapshot.
 */
export const getBranchProducts = (branchId, { signal } = {}) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/products`, { signal });

export const getBranchServices = (branchId, { signal } = {}) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/services`, { signal });

// ─── Per-branch removal ──────────────────────────────────────────────────────
// Returns `{ success, message, removedFromWorkshop }`. `removedFromWorkshop`
// is true if this branch was the last one holding the item, in which case the
// row is also dropped from the workshop union.

export const removeBranchDepartment = (branchId, departmentId) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/departments/${departmentId}`, { method: 'DELETE' });

export const removeBranchCategory = (branchId, categoryId) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/categories/${categoryId}`, { method: 'DELETE' });

export const removeBranchProduct = (branchId, productId) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/products/${productId}`, { method: 'DELETE' });

/**
 * Patch fields on the workshop branch product link (`WorkshopProduct`: @@unique(workshopId, branchId, productId)).
 *
 * `PATCH /workshop-catalog/branches/:branchId/products/:productId`
 * - JwtAuthGuard (same as other workshop-catalog/branches routes).
 * - Optional query: `?workshopId=` (same as list / inventory-adjustments) when JWT workshop scope needs override.
 * - Body: `criticalStockPoint` (finite, ≥ 0; 0 = no threshold). Alias `critical_stock_point` if camelCase omitted.
 * - 200: `{ success: true, data: { branchId, productId, criticalStockPoint } }` (global interceptor leaves it unchanged).
 * - 404: product not adopted on branch (e.g. Prisma P2025) — message e.g. "Product is not adopted by this branch".
 */
export const patchBranchProduct = (branchId, productId, body, { workshopId, signal } = {}) =>
    apiFetch(
        `/workshop-catalog/branches/${encodeURIComponent(branchId)}/products/${encodeURIComponent(productId)}${qs({ workshopId })}`,
        { method: 'PATCH', body: JSON.stringify(body), signal },
    );

export const removeBranchService = (branchId, serviceId) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/services/${serviceId}`, { method: 'DELETE' });

// ─── Workshop-wide adoption removal (all branches / workshop_products | workshop_services) ──
/** @returns {{ success?: boolean, removedIds?: string[], failed?: Array<{ id: string, reason: string }> }} */
export const removeWorkshopProduct = (productId) =>
    apiFetch(`/workshop-staff/workshop-products/${encodeURIComponent(String(productId))}`, {
        method: 'DELETE',
    });

/** Body must be non-empty. @returns bulk response shape above. */
export const removeWorkshopProductsBulk = (productIds) =>
    apiFetch('/workshop-staff/workshop-products/bulk-remove', {
        method: 'POST',
        body: JSON.stringify({ productIds: (productIds || []).map(String).filter(Boolean) }),
    });

export const removeWorkshopService = (serviceId) =>
    apiFetch(`/workshop-staff/workshop-services/${encodeURIComponent(String(serviceId))}`, {
        method: 'DELETE',
    });

export const removeWorkshopServicesBulk = (serviceIds) =>
    apiFetch('/workshop-staff/workshop-services/bulk-remove', {
        method: 'POST',
        body: JSON.stringify({ serviceIds: (serviceIds || []).map(String).filter(Boolean) }),
    });
