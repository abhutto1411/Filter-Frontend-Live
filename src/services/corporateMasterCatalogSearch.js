/**
 * Corporate master catalog search (GET /corporate/master-catalog/search).
 * Shared by quotation flow and booking flow.
 */
import { apiFetch } from './api';

export const CORPORATE_MASTER_CATALOG_SEARCH_MIN_LEN = 2;
export const CORPORATE_MASTER_CATALOG_SEARCH_DEBOUNCE_MS = 320;
export const CORPORATE_MASTER_CATALOG_SEARCH_LIMIT = 30;

export function pickCatalogItemType(item) {
    const t = String(item?.itemType ?? item?.type ?? '').toLowerCase();
    if (t === 'service') return 'service';
    if (t === 'product') return 'product';
    if (item?.serviceId != null || item?.service_id != null) return 'service';
    return 'product';
}

export function catalogRowId(raw, itemType) {
    if (String(raw?.id ?? '').trim() !== '') return String(raw.id).trim();
    if (itemType === 'service') return String(raw.serviceId ?? raw.service_id ?? '').trim();
    return String(raw.productId ?? raw.product_id ?? '').trim();
}

export function toCatalogPickerRow(raw) {
    const itemType = pickCatalogItemType(raw);
    const id = catalogRowId(raw, itemType);
    const name = raw.name ?? raw.title ?? '—';
    const salePrice = parseFloat(raw.salePrice ?? raw.sale_price ?? raw.price ?? 0) || 0;
    const minC = raw.minPriceCorporate ?? raw.min_price_corporate;
    const maxC = raw.maxPriceCorporate ?? raw.max_price_corporate;
    const minNum = minC != null && minC !== '' ? Number(minC) : null;
    const maxNum = maxC != null && maxC !== '' ? Number(maxC) : null;
    const departmentId =
        raw.departmentId != null && String(raw.departmentId).trim() !== ''
            ? String(raw.departmentId).trim()
            : raw.department_id != null && String(raw.department_id).trim() !== ''
              ? String(raw.department_id).trim()
              : '';
    return {
        itemType,
        id,
        name,
        sku: raw.sku ?? '',
        unit: raw.unit ?? raw.uom ?? raw.unitOfMeasurement ?? '',
        departmentName: raw.departmentName ?? raw.department_name ?? '',
        categoryName: raw.categoryName ?? raw.category_name ?? '',
        departmentId,
        salePrice,
        salePriceExcludingVat: raw.salePriceExcludingVat ?? raw.sale_price_excluding_vat,
        minPriceCorporate: Number.isFinite(minNum) ? minNum : null,
        maxPriceCorporate: Number.isFinite(maxNum) ? maxNum : null,
        _raw: raw,
    };
}

/** GET /corporate/master-catalog/search — prefers `{ success, items: [...] }`. */
export function normalizeMasterCatalogSearchResponse(data) {
    if (!data) return [];
    const root = data.data != null && typeof data.data === 'object' ? data.data : data;
    if (Array.isArray(root.items)) {
        return root.items.map((row) => toCatalogPickerRow(row));
    }
    if (Array.isArray(root)) {
        return root.map((row) => toCatalogPickerRow(row));
    }
    const products = root.products || root.product || [];
    const services = root.services || root.service || [];
    const out = [];
    (Array.isArray(products) ? products : []).forEach((p) => out.push(toCatalogPickerRow({ ...p, itemType: 'product' })));
    (Array.isArray(services) ? services : []).forEach((s) => out.push(toCatalogPickerRow({ ...s, itemType: 'service' })));
    return out;
}

export async function fetchCorporateMasterCatalogSearch({ query, type = '', limit = CORPORATE_MASTER_CATALOG_SEARCH_LIMIT, signal } = {}) {
    const qs = new URLSearchParams();
    qs.set('query', query);
    qs.set('limit', String(Math.min(100, limit)));
    if (type === 'product' || type === 'service') qs.set('type', type);
    const data = await apiFetch(`/corporate/master-catalog/search?${qs.toString()}`, { signal });
    return normalizeMasterCatalogSearchResponse(data);
}
