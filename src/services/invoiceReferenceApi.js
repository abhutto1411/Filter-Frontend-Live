import { apiFetch } from './api';

function unwrapReference(res) {
    if (!res || typeof res !== 'object') return '';
    return String(res.reference ?? res.ref ?? '').trim();
}

/** Supplier sales invoice — SI-### (next unused number in the global sequence) */
export const getNextSupplierSalesInvoiceReference = (options = {}) =>
    apiFetch('/supplier/invoices/next-reference', options)
        .catch((err) => {
            const msg = String(err?.message || '');
            if (!/cannot get|404|not found/i.test(msg)) throw err;
            return apiFetch('/supplier/next-sales-invoice-reference', options);
        })
        .then(unwrapReference);

/** Supplier super-supplier purchase — PI-### */
export const getNextSupplierPurchaseInvoiceReference = (options = {}) =>
    apiFetch('/supplier/super-supplier-purchases/next-reference', options).then(
        unwrapReference,
    );

/** Supplier super-supplier debit note — DN-### */
export const getNextSupplierDebitNoteReference = (options = {}) =>
    apiFetch('/supplier/super-supplier-debit-notes/next-reference', options).then(
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
