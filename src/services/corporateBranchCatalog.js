/**
 * Corporate booking — branch catalog for selected departments (JWT).
 * GET /corporate/bookings/catalog?branchId=<id>&departmentIds=1,2,3
 * `departmentIds` = comma-separated (required when calling).
 *
 * Response: { success, branchId, departmentIds, products[], services[] }
 * Each line: itemType (product | service), id, name, sku, unit, departmentId,
 * departmentName, price, workshopProductId?, workshopServiceId?
 */
import { apiFetch } from './api';
import { toCatalogPickerRow } from './corporateMasterCatalogSearch';

/**
 * Map API catalog line → shape consumed by `toCatalogPickerRow` / booking `handleAddCatalogRow`.
 * `id` is the catalog service/product id sent as serviceId / productId on POST /corporate/bookings.
 */
function bookingCatalogLineToRaw(row, fallbackItemType) {
    const itemType = String(row?.itemType ?? fallbackItemType ?? 'product').toLowerCase() === 'service' ? 'service' : 'product';
    const id = row?.id != null ? String(row.id) : '';
    const departmentId = row?.departmentId != null ? String(row.departmentId) : '';
    const price = Number(row?.unitPrice ?? row?.price ?? 0);
    const standardPrice = Number(row?.standardPrice ?? row?.salePrice ?? 0);
    return {
        ...row,
        itemType,
        id,
        productId: itemType === 'product' ? id : undefined,
        serviceId: itemType === 'service' ? id : undefined,
        name: row?.name ?? '—',
        sku: row?.sku ?? '',
        unit: row?.unit ?? '',
        departmentId,
        departmentName: row?.departmentName ?? row?.department_name,
        salePrice: Number.isFinite(price) ? price : 0,
        standardPrice: Number.isFinite(standardPrice) ? standardPrice : 0,
        isCorporateQuotedPrice: row?.isCorporateQuotedPrice === true,
    };
}

/**
 * @param {string|number} branchId
 * @param {{ departmentIds?: string[], signal?: AbortSignal }} opts — `departmentIds` required (non-empty) per API.
 */
export async function fetchCorporateBranchCatalogPickerRows(branchId, { departmentIds = [], signal } = {}) {
    if (branchId == null || String(branchId).trim() === '') return [];
    const ids = (departmentIds || []).map(String).filter(Boolean);
    if (!ids.length) return [];

    const qs = new URLSearchParams();
    qs.set('branchId', String(branchId));
    qs.set('departmentIds', ids.join(','));

    const data = await apiFetch(`/corporate/bookings/catalog?${qs.toString()}`, { signal });
    const root = data?.data && typeof data.data === 'object' ? data.data : data;
    const products = Array.isArray(root?.products) ? root.products : [];
    const services = Array.isArray(root?.services) ? root.services : [];

    const out = [];
    products.forEach((row) => {
        out.push(toCatalogPickerRow(bookingCatalogLineToRaw(row, 'product')));
    });
    services.forEach((row) => {
        out.push(toCatalogPickerRow(bookingCatalogLineToRaw(row, 'service')));
    });
    return out;
}
