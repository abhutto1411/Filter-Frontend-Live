import { apiFetch } from './api';

function unwrapReference(res) {
    if (!res || typeof res !== 'object') return '';
    return String(res.reference ?? res.ref ?? '').trim();
}

/** Supplier sales invoice — SI-### */
export const getNextSupplierSalesInvoiceReference = (options = {}) =>
    apiFetch('/supplier/invoices/next-reference', options).then(unwrapReference);

/** Supplier super-supplier purchase — PI-### */
export const getNextSupplierPurchaseInvoiceReference = (options = {}) =>
    apiFetch('/supplier/super-supplier-purchases/next-reference', options).then(
        unwrapReference,
    );

/** Workshop purchase invoice — PI-### (optional branchId) */
export const getNextWorkshopPurchaseInvoiceReference = (params = {}, options = {}) => {
    const query = new URLSearchParams();
    if (params.branchId != null && params.branchId !== '' && params.branchId !== 'all') {
        query.set('branchId', String(params.branchId));
    }
    const qs = query.toString();
    const path = qs
        ? `/workshop-staff/supplier-purchase-invoices/next-reference?${qs}`
        : '/workshop-staff/supplier-purchase-invoices/next-reference';
    return apiFetch(path, options).then(unwrapReference);
};
