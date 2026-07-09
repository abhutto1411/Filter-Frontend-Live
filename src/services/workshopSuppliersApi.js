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

// ---- Affiliated suppliers --------------------------------------------------

export const listAffiliatedSuppliers = (params = {}) =>
    apiFetch(withQuery('/workshop-suppliers/affiliated', params));

export const listAvailableAffiliatedSuppliers = (params = {}) =>
    apiFetch(withQuery('/workshop-suppliers/affiliated/available', params));

export const addAffiliatedSuppliers = (body) =>
    apiFetch('/workshop-suppliers/affiliated', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateAffiliatedSupplier = (workshopSupplierId, body) =>
    apiFetch(`/workshop-suppliers/affiliated/${encodeURIComponent(workshopSupplierId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

// ---- Non-affiliated (local) suppliers -------------------------------------

export const listLocalSuppliers = (params = {}) =>
    apiFetch(withQuery('/workshop-suppliers/local', params));

export const getLocalSupplier = (id) =>
    apiFetch(`/workshop-suppliers/local/${encodeURIComponent(id)}`);

export const createLocalSupplier = (body) =>
    apiFetch('/workshop-suppliers/local', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateLocalSupplier = (id, body) =>
    apiFetch(`/workshop-suppliers/local/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

// ---- Local supplier purchase invoices -------------------------------------

/** All local (non-affiliated) PIs for the workshop — optional branchId filter. */
export const listAllLocalSupplierPurchaseInvoices = (params = {}) =>
    apiFetch(withQuery('/workshop-suppliers/local/purchase-invoices', params));

export const getWorkshopLocalPurchaseInvoice = (invoiceId) =>
    apiFetch(
        `/workshop-suppliers/local/purchase-invoices/${encodeURIComponent(String(invoiceId))}`,
    );

export const patchWorkshopLocalPurchaseInvoice = (invoiceId, body) =>
    apiFetch(
        `/workshop-suppliers/local/purchase-invoices/${encodeURIComponent(String(invoiceId))}`,
        { method: 'PATCH', body: JSON.stringify(body ?? {}) },
    );

export const createLocalSupplierPurchaseInvoice = (localSupplierId, body) =>
    apiFetch(
        `/workshop-suppliers/local/${encodeURIComponent(localSupplierId)}/purchase-invoices`,
        { method: 'POST', body: JSON.stringify(body) },
    );

export const listLocalSupplierPurchaseInvoices = (localSupplierId, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-suppliers/local/${encodeURIComponent(localSupplierId)}/purchase-invoices`,
            params,
        ),
    );

// ---- Ledger ---------------------------------------------------------------

/** type = 'affiliated' | 'local'. id is suppliers.id (affiliated) or workshop_local_suppliers.id (local). */
export const getSupplierLedger = (type, id, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-suppliers/${encodeURIComponent(type)}/${encodeURIComponent(id)}/ledger`,
            params,
        ),
    );
