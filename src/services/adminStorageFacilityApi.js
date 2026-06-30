import { apiFetch } from './api';

function withQuery(path, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

function baseFor(supplierId) {
    return `/super-admin/storage-facility/${encodeURIComponent(String(supplierId))}`;
}

/** Super-admin storage facility API — always scoped to a supplier id. */
export function createAdminStorageFacilityApi(supplierId) {
    const base = baseFor(supplierId);

    return {
        listStorageBrands: () => apiFetch(`${base}/brands`),

        createStorageBrand: (body) =>
            apiFetch(`${base}/brands`, { method: 'POST', body: JSON.stringify(body) }),

        updateStorageBrand: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            }),

        getStorageBrandSummary: (brandId) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/summary`),

        listStorageBrandUsers: (brandId) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/users`),

        createStorageBrandUser: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/users`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        listStorageProducts: (brandId) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/products`),

        createStorageProduct: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/products`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateStorageProduct: (brandId, productId, body) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/products/${encodeURIComponent(productId)}`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        setStorageProductCatalogMap: (brandId, productId, body) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/products/${encodeURIComponent(productId)}/catalog-map`,
                { method: 'PUT', body: JSON.stringify(body) },
            ),

        deleteStorageProduct: (brandId, productId) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/products/${encodeURIComponent(productId)}`,
                { method: 'DELETE' },
            ),

        listStorageUomProfiles: (brandId) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/uom-profiles`),

        createStorageUomProfile: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/uom-profiles`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateStorageUomProfile: (brandId, profileId, body) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/uom-profiles/${encodeURIComponent(profileId)}`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        deleteStorageUomProfile: (brandId, profileId) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/uom-profiles/${encodeURIComponent(profileId)}`,
                { method: 'DELETE' },
            ),

        applyStorageProductUom: (brandId, productId, body) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/products/${encodeURIComponent(productId)}/uom`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        getStorageProductTimeline: (brandId, productId, params = {}) =>
            apiFetch(
                withQuery(
                    `${base}/brands/${encodeURIComponent(brandId)}/products/${encodeURIComponent(productId)}/timeline`,
                    params,
                ),
            ),

        listStorageAuditLog: (brandId, params = {}) =>
            apiFetch(withQuery(`${base}/brands/${encodeURIComponent(brandId)}/audit`, params)),

        listStorageMovements: (brandId, params = {}) =>
            apiFetch(withQuery(`${base}/brands/${encodeURIComponent(brandId)}/movements`, params)),

        postStorageMovement: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/movements`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        postStorageBulkMovements: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/movements/bulk`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        listStorageLocations: (brandId) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/locations`),

        createStorageLocation: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/locations`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateStorageLocation: (brandId, locationId, body) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/locations/${encodeURIComponent(locationId)}`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        deleteStorageLocation: (brandId, locationId) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/locations/${encodeURIComponent(locationId)}`,
                { method: 'DELETE' },
            ),

        listStorageTransfers: (brandId) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/transfers`),

        listStorageSalesReps: (brandId) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/sales-reps`),

        createStorageSalesRep: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/sales-reps`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateStorageSalesRep: (brandId, salesRepId, body) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/sales-reps/${encodeURIComponent(salesRepId)}`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        deleteStorageSalesRep: (brandId, salesRepId) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/sales-reps/${encodeURIComponent(salesRepId)}`,
                { method: 'DELETE' },
            ),

        listStorageSales: (brandId) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/sales`),

        getStorageSalesRepPerformance: (brandId, params = {}) =>
            apiFetch(
                withQuery(
                    `${base}/brands/${encodeURIComponent(brandId)}/sales-rep-performance`,
                    params,
                ),
            ),

        listStorageSalesRepTargets: (brandId, salesRepId) =>
            apiFetch(
                withQuery(
                    `${base}/brands/${encodeURIComponent(brandId)}/sales-rep-targets`,
                    salesRepId ? { salesRepId } : {},
                ),
            ),

        createStorageSalesRepTarget: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/sales-rep-targets`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateStorageSalesRepTarget: (brandId, targetId, body) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/sales-rep-targets/${encodeURIComponent(targetId)}`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        deleteStorageSalesRepTarget: (brandId, targetId) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/sales-rep-targets/${encodeURIComponent(targetId)}`,
                { method: 'DELETE' },
            ),

        listStorageInvoices: (brandId, params = {}) =>
            apiFetch(
                withQuery(`${base}/brands/${encodeURIComponent(brandId)}/invoices`, params),
            ),

        createStorageInvoice: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/invoices`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        postStorageInvoice: (brandId, invoiceId) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/invoices/${encodeURIComponent(invoiceId)}/post`,
                { method: 'POST' },
            ),

        recordStorageInvoicePayment: (brandId, invoiceId, body) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/invoices/${encodeURIComponent(invoiceId)}/payments`,
                { method: 'POST', body: JSON.stringify(body) },
            ),

        getStorageBrandAr: (brandId) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/ar`),

        listStorageCustomers: (brandId, params = {}) =>
            apiFetch(
                withQuery(`${base}/brands/${encodeURIComponent(brandId)}/customers`, params),
            ),

        listStorageSuppliers: (brandId, params = {}) =>
            apiFetch(
                withQuery(`${base}/brands/${encodeURIComponent(brandId)}/suppliers`, params),
            ),

        createStorageSupplier: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/suppliers`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateStorageSupplier: (brandId, storageSupplierId, body) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/suppliers/${encodeURIComponent(storageSupplierId)}`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        createStorageCustomer: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/customers`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        updateStorageCustomer: (brandId, customerId, body) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/customers/${encodeURIComponent(customerId)}`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        getStorageCustomer: (brandId, customerId) =>
            apiFetch(
                `${base}/brands/${encodeURIComponent(brandId)}/customers/${encodeURIComponent(customerId)}`,
            ),

        createStorageTransfer: (brandId, body) =>
            apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/transfers`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        searchWarehouseProductsForMap: (q, params = {}) =>
            apiFetch(withQuery(`${base}/warehouse-products`, { q, ...params })),
    };
}
