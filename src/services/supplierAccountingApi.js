import { apiFetch } from './api';

/**
 * Frontend API client for the supplier-scoped accounting module (parallel to
 * `accountsApi.js` for workshops). All requests are JWT-authenticated and run
 * under `/supplier/accounting/*` on the backend, scoped by `req.user.supplier.supplierId`.
 */

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

const BASE = '/supplier/accounting';

/** `SuccessResponseInterceptor` wraps arrays as `{ success: true, data: [...] }`. */
export function unwrapSupplierAccountingList(res) {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.accounts)) return res.accounts;
    return [];
}

// ---------------------------------------------------------------------------
// Chart of Accounts
// ---------------------------------------------------------------------------

export const getSupplierAccounts = (params = {}) =>
    apiFetch(withQuery(`${BASE}/accounts`, { ...params, _t: Date.now() }));

export const getSupplierAccountsTree = (params = {}) =>
    apiFetch(withQuery(`${BASE}/accounts/tree`, { ...params, _t: Date.now() }));

export const getSupplierAccountById = (id) =>
    apiFetch(`${BASE}/accounts/${encodeURIComponent(id)}`);

export const getSupplierAccountLedger = (id, params = {}) =>
    apiFetch(
        withQuery(`${BASE}/accounts/${encodeURIComponent(id)}/ledger`, {
            ...params,
            _t: Date.now(),
        }),
    );

export const createSupplierAccount = (body) =>
    apiFetch(`${BASE}/accounts`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateSupplierAccount = (id, body) =>
    apiFetch(`${BASE}/accounts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const deleteSupplierAccount = (id) =>
    apiFetch(`${BASE}/accounts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });

export const listSupplierPartyOpenings = (params = {}) =>
    apiFetch(withQuery(`${BASE}/party-openings`, { ...params, _t: Date.now() }));

export const upsertSupplierPartyOpening = (body) =>
    apiFetch(`${BASE}/party-openings`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });

// ---------------------------------------------------------------------------
// Transaction Hub
// ---------------------------------------------------------------------------

export const postSupplierPayment = (body) =>
    apiFetch(`${BASE}/hub/payments`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const postSupplierReceipt = (body) =>
    apiFetch(`${BASE}/hub/receipts`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const postSupplierGeneralJournal = (body) =>
    apiFetch(`${BASE}/hub/journals`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export const listSupplierPayments = (params = {}) =>
    apiFetch(withQuery(`${BASE}/logs/payments`, { ...params, _t: Date.now() }));

export const listSupplierReceipts = (params = {}) =>
    apiFetch(withQuery(`${BASE}/logs/receipts`, { ...params, _t: Date.now() }));

export const listSupplierGeneralJournals = (params = {}) =>
    apiFetch(withQuery(`${BASE}/logs/journals`, { ...params, _t: Date.now() }));

export const listSupplierJournalsAll = (params = {}) =>
    apiFetch(withQuery(`${BASE}/logs/all`, { ...params, _t: Date.now() }));

export const getSupplierJournalById = (id) =>
    apiFetch(`${BASE}/journals/${encodeURIComponent(id)}`);

export const updateSupplierJournal = (id, body) =>
    apiFetch(`${BASE}/journals/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const voidSupplierJournal = (id) =>
    apiFetch(`${BASE}/journals/${encodeURIComponent(id)}/void`, {
        method: 'PATCH',
    });

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const getSupplierTrialBalance = (params = {}) =>
    apiFetch(
        withQuery(`${BASE}/reports/trial-balance`, {
            ...params,
            _t: Date.now(),
        }),
    );

export const getSupplierPnl = (params = {}) =>
    apiFetch(withQuery(`${BASE}/reports/pl`, { ...params, _t: Date.now() }));

export const getSupplierBalanceSheet = (params = {}) =>
    apiFetch(
        withQuery(`${BASE}/reports/balance-sheet`, {
            ...params,
            _t: Date.now(),
        }),
    );

export const getSupplierCashFlow = (params = {}) =>
    apiFetch(
        withQuery(`${BASE}/reports/cash-flow`, {
            ...params,
            _t: Date.now(),
        }),
    );

export const getSupplierVatReport = (params = {}) =>
    apiFetch(
        withQuery(`${BASE}/reports/vat`, {
            ...params,
            _t: Date.now(),
        }),
    );

// ---------------------------------------------------------------------------
// Inventory drill-down
// ---------------------------------------------------------------------------

export const getSupplierProductMovements = (supplierProductId, params = {}) =>
    apiFetch(
        withQuery(
            `${BASE}/inventory/products/${encodeURIComponent(
                supplierProductId,
            )}/movements`,
            { ...params, _t: Date.now() },
        ),
    );

// ---------------------------------------------------------------------------
// Bank and Cash Accounts / Receipts / Payments / Quotes
// ---------------------------------------------------------------------------

export const listSupplierCashAccounts = () =>
    apiFetch(withQuery(`${BASE}/cash-accounts`, { _t: Date.now() }));

export const createSupplierCashAccount = (body) =>
    apiFetch(`${BASE}/cash-accounts`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const listSupplierReceiptsRegister = (params = {}) =>
    apiFetch(withQuery(`${BASE}/receipts`, { ...params, _t: Date.now() }));

export const createSupplierReceiptRegister = (body) =>
    apiFetch(`${BASE}/receipts`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const listSupplierPaymentsRegister = (params = {}) =>
    apiFetch(withQuery(`${BASE}/payments`, { ...params, _t: Date.now() }));

export const createSupplierPaymentRegister = (body) =>
    apiFetch(`${BASE}/payments`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const listSupplierOpenSalesInvoices = (params = {}) =>
    apiFetch(withQuery(`${BASE}/open-sales-invoices`, { ...params, _t: Date.now() }));

export const listSupplierOpenPurchases = () =>
    apiFetch(withQuery(`${BASE}/open-purchases`, { _t: Date.now() }));

export const listSupplierSalesQuotes = () =>
    apiFetch(withQuery(`${BASE}/quotes`, { _t: Date.now() }));

export const getSupplierSalesQuote = (id) =>
    apiFetch(`${BASE}/quotes/${encodeURIComponent(id)}`);

export const createSupplierSalesQuote = (body) =>
    apiFetch(`${BASE}/quotes`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateSupplierSalesQuoteStatus = (id, status) =>
    apiFetch(`${BASE}/quotes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });

export const sendSupplierSalesQuote = (id) =>
    apiFetch(`${BASE}/quotes/${encodeURIComponent(id)}/send`, {
        method: 'POST',
    });

export const acceptSupplierSalesQuote = (id) =>
    apiFetch(`${BASE}/quotes/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
    });

export const rejectSupplierSalesQuote = (id) =>
    apiFetch(`${BASE}/quotes/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
    });

export const copySupplierSalesQuoteToInvoice = (id) =>
    apiFetch(`${BASE}/quotes/${encodeURIComponent(id)}/copy-to-invoice`, {
        method: 'POST',
    });
