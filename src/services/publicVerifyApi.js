import { apiFetch } from './api';
import { buildReceivedQtyByInvoiceItemIdPayload } from '../utils/receivedQtyPayload';

export { buildReceivedQtyByInvoiceItemIdPayload };

/**
 * Public (no login) workshop purchase invoice verification — backend must allow unauthenticated GET.
 * Response shape from SuccessResponseInterceptor: { success, verified, source, ... }.
 */
export function getPublicWorkshopPurchaseInvoiceVerify(id) {
    if (id == null || id === '') {
        return Promise.reject(new Error('Missing invoice id'));
    }
    return apiFetch(`/public/workshop-purchase-invoices/${encodeURIComponent(String(id))}`);
}

export function getPublicWorkshopPurchaseInvoiceReceivePreview(id) {
    if (id == null || id === '') {
        return Promise.reject(new Error('Missing invoice id'));
    }
    return apiFetch(`/public/workshop-purchase-invoices/${encodeURIComponent(String(id))}/receive-preview`);
}

/**
 * Public QR receive for workshop purchase invoice — password required.
 * Delegates to linked supplier sales invoice when present.
 */
export function publicReceiveWorkshopPurchaseInvoiceWithPassword(id, password, opts = {}) {
    if (id == null || id === '') {
        return Promise.reject(new Error('Missing invoice id'));
    }
    if (!password || String(password).trim() === '') {
        return Promise.reject(new Error('Password is required'));
    }
    const body = {
        password: String(password),
        ...(opts.criticalStockByProductId && Object.keys(opts.criticalStockByProductId).length > 0
            ? { criticalStockByProductId: opts.criticalStockByProductId }
            : {}),
        ...(opts.receivedQtyByInvoiceItemId &&
        Object.keys(opts.receivedQtyByInvoiceItemId).length > 0
            ? { receivedQtyByInvoiceItemId: opts.receivedQtyByInvoiceItemId }
            : {}),
    };
    return apiFetch(
        `/public/workshop-purchase-invoices/${encodeURIComponent(String(id))}/receive-with-password`,
        {
            method: 'POST',
            body: JSON.stringify(body),
        },
    );
}

/** Public supplier→workshop sales invoice (AR) — no login. */
export function getPublicSupplierSalesInvoiceVerify(id) {
    if (id == null || id === '') {
        return Promise.reject(new Error('Missing invoice id'));
    }
    return apiFetch(`/public/supplier-sales-invoices/${encodeURIComponent(String(id))}`);
}

/** Public: products not yet on branch catalog (before marking received). */
export function getPublicSupplierSalesInvoiceReceivePreview(id) {
    if (id == null || id === '') {
        return Promise.reject(new Error('Missing invoice id'));
    }
    return apiFetch(`/public/supplier-sales-invoices/${encodeURIComponent(String(id))}/receive-preview`);
}

/**
 * Public QR receive flow: workshop scans the invoice QR, types either the
 * branch login password OR the workshop owner/admin password. On success the
 * backend marks the invoice received and applies branch inventory. Idempotent.
 * @param {string} id
 * @param {string} password
 * @param {{ criticalStockByProductId?: Record<string, number>, receivedQtyByInvoiceItemId?: Record<string, number> }} [opts]
 */
export function publicReceiveSupplierSalesInvoiceWithPassword(id, password, opts = {}) {
    if (id == null || id === '') {
        return Promise.reject(new Error('Missing invoice id'));
    }
    if (!password || String(password).trim() === '') {
        return Promise.reject(new Error('Password is required'));
    }
    const body = {
        password: String(password),
        ...(opts.criticalStockByProductId && Object.keys(opts.criticalStockByProductId).length > 0
            ? { criticalStockByProductId: opts.criticalStockByProductId }
            : {}),
        ...(opts.receivedQtyByInvoiceItemId &&
        Object.keys(opts.receivedQtyByInvoiceItemId).length > 0
            ? { receivedQtyByInvoiceItemId: opts.receivedQtyByInvoiceItemId }
            : {}),
    };
    return apiFetch(
        `/public/supplier-sales-invoices/${encodeURIComponent(String(id))}/receive-with-password`,
        {
            method: 'POST',
            body: JSON.stringify(body),
        },
    );
}

export function getPublicAffiliatedPurchaseReturnVerify(qrToken) {
    if (!qrToken || String(qrToken).trim() === '') {
        return Promise.reject(new Error('Missing QR token'));
    }
    return apiFetch(
        `/public/affiliated-purchase-returns/${encodeURIComponent(String(qrToken))}`,
    );
}

export function publicConfirmAffiliatedPurchaseReturnWithPassword(qrToken, password) {
    if (!qrToken || String(qrToken).trim() === '') {
        return Promise.reject(new Error('Missing QR token'));
    }
    if (!password || String(password).trim() === '') {
        return Promise.reject(new Error('Password is required'));
    }
    return apiFetch(
        `/public/affiliated-purchase-returns/${encodeURIComponent(String(qrToken))}/confirm`,
        {
            method: 'POST',
            body: JSON.stringify({ password: String(password) }),
        },
    );
}

/** Public super-supplier purchase bill (upstream vendor) — no login. */
export function getPublicSuperSupplierPurchaseVerify(id) {
    if (id == null || id === '') {
        return Promise.reject(new Error('Missing purchase id'));
    }
    return apiFetch(`/public/super-supplier-purchases/${encodeURIComponent(String(id))}`);
}
