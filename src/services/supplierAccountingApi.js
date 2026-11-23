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

export const getSupplierHubNextReference = (kind, count) =>
    apiFetch(withQuery(`${BASE}/hub/next-reference`, { kind, count }));

export const checkSupplierHubReferenceExists = (reference, excludeJournalId) =>
    apiFetch(
        withQuery(`${BASE}/hub/reference-exists`, {
            reference,
            excludeJournalId,
        }),
    );

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

/** SP-13 — reverse a posted manual journal (posts an opposite JE linked to it). */
export const reverseSupplierJournal = (id, body = {}) =>
    apiFetch(`${BASE}/journals/${encodeURIComponent(id)}/reverse`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

/** SP-13 — audit trail of one journal. */
export const getSupplierJournalAudit = (id) =>
    apiFetch(`${BASE}/journals/${encodeURIComponent(id)}/audit`, { method: 'GET' });

/** SP-13 — day book (posted lines on a date / range). */
export const getSupplierDayBook = (params = {}) =>
    apiFetch(withQuery(`${BASE}/reports/day-book`, { ...params, _t: Date.now() }));

/** SP-14 — period close state (lock date, fiscal years, history). */
export const getSupplierPeriodClose = () =>
    apiFetch(withQuery(`${BASE}/period-close`, { _t: Date.now() }));

/** SP-14 — year-end close preview (read-only). */
export const previewSupplierYearEndClose = (params = {}) =>
    apiFetch(withQuery(`${BASE}/period-close/preview`, { ...params, _t: Date.now() }));

/** SP-14 — post the year-end closing journal + lock. */
export const postSupplierYearEndClose = (body) =>
    apiFetch(`${BASE}/period-close/year-end`, { method: 'POST', body: JSON.stringify(body) });

/** SP-14 — reopen the latest closed fiscal year. */
export const reopenSupplierFiscalYear = (id, body) =>
    apiFetch(`${BASE}/period-close/fiscal-years/${encodeURIComponent(id)}/reopen`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

/** SP-14 — set / clear the lock date. */
export const setSupplierLockDate = (body) =>
    apiFetch(`${BASE}/period-close/lock-date`, { method: 'PUT', body: JSON.stringify(body) });

/** SP-15 — inventory valuation (qty × moving average) vs GL 1200. Read-only. */
export const getSupplierInventoryValuation = (params = {}) => {
    // departmentId / categoryId ('none' = unassigned), dateFrom / dateTo (Riyadh YYYY-MM-DD).
    const q = { _t: Date.now() };
    for (const k of ['departmentId', 'categoryId', 'dateFrom', 'dateTo']) {
        if (params[k]) q[k] = params[k];
    }
    return apiFetch(withQuery(`${BASE}/reports/inventory-valuation`, q));
};

/** SP-15 — per-SKU stock ledger with running qty / value. Read-only. */
export const getSupplierProductStockLedger = (supplierProductId, params = {}) =>
    apiFetch(
        withQuery(`${BASE}/inventory/products/${encodeURIComponent(supplierProductId)}/stock-ledger`, {
            ...params,
            _t: Date.now(),
        }),
    );

/** SP-19 — journals behind one document (read-only; for document journal chips). */
export const getSupplierJournalsBySource = (sources, sourceId) =>
    apiFetch(
        withQuery(`${BASE}/journals/by-source`, {
            source: Array.isArray(sources) ? sources.join(',') : String(sources || ''),
            sourceId: String(sourceId ?? ''),
            _t: Date.now(),
        }),
    );

export const deleteSupplierJournal = (id) =>
    apiFetch(`${BASE}/journals/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const getSupplierArApRecon = () =>
    apiFetch(withQuery(`${BASE}/reports/ar-ap-recon`, { _t: Date.now() }));

export const getSupplierTrialBalance = (params = {}) =>
    apiFetch(
        withQuery(`${BASE}/reports/trial-balance`, {
            ...params,
            _t: Date.now(),
        }),
    );

/** SP-11 — cash / bank book (per account + combined running). */
export const getSupplierCashBook = (params = {}) =>
    apiFetch(withQuery(`${BASE}/reports/cash-book`, { ...params, _t: Date.now() }));

/** SP-10 — aged receivables (1100 + 1110) / payables (2000) as of `asOf`. */
export const getSupplierArAging = (params = {}) =>
    apiFetch(withQuery(`${BASE}/reports/ar-aging`, { ...params, _t: Date.now() }));

export const getSupplierApAging = (params = {}) =>
    apiFetch(withQuery(`${BASE}/reports/ap-aging`, { ...params, _t: Date.now() }));

/** SP-09 — General Ledger summary (one row per posting account). */
export const getSupplierGeneralLedger = (params = {}) =>
    apiFetch(
        withQuery(`${BASE}/reports/general-ledger`, {
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

export const updateSupplierReceiptRegister = (id, body) =>
    apiFetch(`${BASE}/receipts/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const listSupplierPaymentsRegister = (params = {}) =>
    apiFetch(withQuery(`${BASE}/payments`, { ...params, _t: Date.now() }));

export const createSupplierPaymentRegister = (body) =>
    apiFetch(`${BASE}/payments`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateSupplierPaymentRegister = (id, body) =>
    apiFetch(`${BASE}/payments/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
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

export const updateSupplierSalesQuote = (id, body) =>
    apiFetch(`${BASE}/quotes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
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
