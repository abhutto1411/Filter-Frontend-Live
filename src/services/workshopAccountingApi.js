import { apiFetch } from './api';
import {
    mergeAccountingScopeBody,
    mergeAccountingScopeParams,
} from '../utils/accountingWorkshopScope';

function withQuery(path, params = {}) {
    const query = new URLSearchParams();
    Object.entries(mergeAccountingScopeParams(params)).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

// ---- Lookups --------------------------------------------------------------

export const listCashBankAccounts = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/lookups/cash-bank', params));

/** kind = 'payable_expense' | 'receivable_revenue' | 'all' */
export const listCoaAccounts = (kind = 'all', params = {}) =>
    apiFetch(withQuery('/workshop-accounting/lookups/coa', { kind, ...params }));

/** type = 'supplier' | 'employee' | 'customer' | 'other' */
export const listPayees = (type = 'supplier', params = {}) =>
    apiFetch(withQuery('/workshop-accounting/lookups/payees', { type, ...params }));

/** prefix = 'PE' | 'RV' — next voucher numbers for this workshop only. */
export const previewNextVouchers = (prefix = 'PE', count = 2) =>
    apiFetch(
        withQuery('/workshop-accounting/lookups/next-vouchers', {
            prefix,
            count,
        }),
    );

export const createPayments = (body) =>
    apiFetch('/workshop-accounting/payments', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

export const createReceipts = (body) =>
    apiFetch('/workshop-accounting/receipts', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

/** I2/I3 pending cash posts */
export const listPendingCashPosts = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/pending-cash-posts', params));

export const postPendingCashPost = (kind, id, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-accounting/pending-cash-posts/${encodeURIComponent(String(kind))}/${encodeURIComponent(String(id))}/post`,
            params,
        ),
        { method: 'POST' },
    );

export const createJournalEntry = (body) =>
    apiFetch('/workshop-accounting/journal-entries', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

// ---- Logs -----------------------------------------------------------------

export const listPayments = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/payments', params));

export const getPaymentsSummary = () =>
    apiFetch(withQuery('/workshop-accounting/payments/summary', {}));

export const listRecentPayments = (limit = 10) =>
    apiFetch(withQuery('/workshop-accounting/payments/recent', { limit }));

export const approvePayment = (id) =>
    apiFetch(withQuery(`/workshop-accounting/payments/${encodeURIComponent(id)}/approve`, {}), {
        method: 'PATCH',
    });

export const rejectPayment = (id) =>
    apiFetch(withQuery(`/workshop-accounting/payments/${encodeURIComponent(id)}/reject`, {}), {
        method: 'PATCH',
    });

export const getPayment = (id) =>
    apiFetch(withQuery(`/workshop-accounting/payments/${encodeURIComponent(id)}`, {}));

export const updatePayment = (id, body) =>
    apiFetch(withQuery(`/workshop-accounting/payments/${encodeURIComponent(id)}`, {}), {
        method: 'PATCH',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

export const voidPayment = (id) =>
    apiFetch(withQuery(`/workshop-accounting/payments/${encodeURIComponent(id)}/void`, {}), {
        method: 'POST',
    });

export const unvoidPayment = (id) =>
    apiFetch(withQuery(`/workshop-accounting/payments/${encodeURIComponent(id)}/unvoid`, {}), {
        method: 'POST',
    });

export const deletePayment = (id) =>
    apiFetch(withQuery(`/workshop-accounting/payments/${encodeURIComponent(id)}`, {}), {
        method: 'DELETE',
    });

export const listReceipts = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/receipts', params));

export const getReceiptsSummary = () =>
    apiFetch(withQuery('/workshop-accounting/receipts/summary', {}));

export const listRecentReceipts = (limit = 10) =>
    apiFetch(withQuery('/workshop-accounting/receipts/recent', { limit }));

export const approveReceipt = (id) =>
    apiFetch(withQuery(`/workshop-accounting/receipts/${encodeURIComponent(id)}/approve`, {}), {
        method: 'PATCH',
    });

export const rejectReceipt = (id) =>
    apiFetch(withQuery(`/workshop-accounting/receipts/${encodeURIComponent(id)}/reject`, {}), {
        method: 'PATCH',
    });

export const getReceipt = (id) =>
    apiFetch(withQuery(`/workshop-accounting/receipts/${encodeURIComponent(id)}`, {}));

export const updateReceipt = (id, body) =>
    apiFetch(withQuery(`/workshop-accounting/receipts/${encodeURIComponent(id)}`, {}), {
        method: 'PATCH',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

export const voidReceipt = (id) =>
    apiFetch(withQuery(`/workshop-accounting/receipts/${encodeURIComponent(id)}/void`, {}), {
        method: 'POST',
    });

export const unvoidReceipt = (id) =>
    apiFetch(withQuery(`/workshop-accounting/receipts/${encodeURIComponent(id)}/unvoid`, {}), {
        method: 'POST',
    });

export const deleteReceipt = (id) =>
    apiFetch(withQuery(`/workshop-accounting/receipts/${encodeURIComponent(id)}`, {}), {
        method: 'DELETE',
    });

export const listJournalEntries = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/journal-entries', params));

export const getJournalEntry = (id) =>
    apiFetch(withQuery(`/workshop-accounting/journal-entries/${encodeURIComponent(id)}`, {}));

export const updateJournalEntry = (id, body) =>
    apiFetch(withQuery(`/workshop-accounting/journal-entries/${encodeURIComponent(id)}`, {}), {
        method: 'PATCH',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

export const voidJournalEntry = (id) =>
    apiFetch(withQuery(`/workshop-accounting/journal-entries/${encodeURIComponent(id)}/void`, {}), {
        method: 'POST',
    });

export const unvoidJournalEntry = (id) =>
    apiFetch(withQuery(`/workshop-accounting/journal-entries/${encodeURIComponent(id)}/unvoid`, {}), {
        method: 'POST',
    });

export const deleteJournalEntry = (id) =>
    apiFetch(withQuery(`/workshop-accounting/journal-entries/${encodeURIComponent(id)}`, {}), {
        method: 'DELETE',
    });

/** P-A7A: reverse a posted journal (creates a new balancing entry). */
export const reverseJournalEntry = (id, body = {}) =>
    apiFetch(withQuery(`/workshop-accounting/journal-entries/${encodeURIComponent(id)}/reverse`, {}), {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

/** P-A7A: workshop accounting audit log (admin). */
export const listAccountingAuditLog = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/audit-log', params));

/** VAT Calculation — output (2100) vs input (1310), net ZATCA payable. */
export const getWorkshopVatReport = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/reports/vat', params));

/** P-A26: VAT return summary (quarter boxes / net payable). */
export const getWorkshopVatReturnSummary = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/reports/vat-return', params));

/** P-A11A/B: Cashier closing variance report (cash expected vs counted). */
export const getCashierVarianceReport = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/reports/cashier-variance', params));

/** P-A11A/B: branch lookup for variance filters (limit 20). */
export const lookupAccountingBranches = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/lookups/branches', params));

/** P-A11A/B: cashier lookup for variance filters (limit 20). */
export const lookupAccountingCashiers = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/lookups/cashiers', params));

/** P-A13A/B: AP list (affiliated / local) with ageing + drift. */
export const getSuppliersApReport = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/suppliers/ap', params));

/** P-A13A/B: supplier AP statement from GL. */
export const getSupplierApStatement = (type, id, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-accounting/suppliers/${encodeURIComponent(String(type))}/${encodeURIComponent(String(id))}/statement`,
            params,
        ),
    );

/** Period closing — snapshot + zero live COA balances. */
export const runWorkshopPeriodClose = (body = {}) =>
    apiFetch('/workshop-accounting/period-closes/run', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

export const listWorkshopPeriodCloses = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/period-closes', params));

export const getWorkshopPeriodClose = (id, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-accounting/period-closes/${encodeURIComponent(id)}`,
            params,
        ),
    );

export const downloadWorkshopPeriodCloseBackup = (id, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-accounting/period-closes/${encodeURIComponent(id)}/backup`,
            params,
        ),
    );

export const restoreWorkshopPeriodClose = (id, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-accounting/period-closes/${encodeURIComponent(id)}/restore`,
            params,
        ),
        { method: 'POST' },
    );

/** Signed +/− COA adjustment vs a user-picked contra account. */
export const adjustWorkshopCoaAccount = (accountId, body) =>
    apiFetch(
        `/workshop-accounting/accounts/${encodeURIComponent(String(accountId))}/adjust`,
        {
            method: 'POST',
            body: JSON.stringify(mergeAccountingScopeBody(body)),
        },
    );

/** P-A12A/C: expense purposes catalogue (admin). */
export const listExpensePurposesAdmin = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/expense-purposes', params));

export const createExpensePurposeAdmin = (body) =>
    apiFetch('/workshop-accounting/expense-purposes', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

export const patchExpensePurposeAdmin = (id, body) =>
    apiFetch(
        `/workshop-accounting/expense-purposes/${encodeURIComponent(String(id))}`,
        {
            method: 'PATCH',
            body: JSON.stringify(mergeAccountingScopeBody(body)),
        },
    );

/** P-A12B/C: review queue (Other / not sure on 6650). */
export const listExpenseReviewQueue = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/expense-review', params));

export const reclassExpenseReviewItem = (id, body) =>
    apiFetch(
        `/workshop-accounting/expense-review/${encodeURIComponent(String(id))}/reclass`,
        {
            method: 'POST',
            body: JSON.stringify(mergeAccountingScopeBody(body)),
        },
    );

/** Authenticated workshop user: purposes for their role (no CoA fields). */
export const listMyExpensePurposes = (params = {}) =>
    apiFetch(withQuery('/expense-purposes/mine', params));

/** P-A12E/F: petty cash wallet reports (GL). */
export const listPettyCashWalletsReport = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/petty-cash/wallets', params));

export const getPettyCashWalletStatement = (userId, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-accounting/petty-cash/wallets/${encodeURIComponent(String(userId))}/statement`,
            params,
        ),
    );

export const listPettyCashReconciliation = (params = {}) =>
    apiFetch(
        withQuery('/workshop-accounting/petty-cash/reconciliation', params),
    );

// ---- Bulk batches (P-A18A/B) ----------------------------------------------

export const validateAccountingBatch = (body) =>
    apiFetch('/workshop-accounting/batches/validate', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

export const createAccountingBatch = (body) =>
    apiFetch('/workshop-accounting/batches', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

export const updateAccountingBatch = (id, body) =>
    apiFetch(
        withQuery(`/workshop-accounting/batches/${encodeURIComponent(String(id))}`, {}),
        {
            method: 'PUT',
            body: JSON.stringify(mergeAccountingScopeBody(body)),
        },
    );

export const postAccountingBatch = (id, body) =>
    apiFetch(
        withQuery(
            `/workshop-accounting/batches/${encodeURIComponent(String(id))}/post`,
            {},
        ),
        {
            method: 'POST',
            body: JSON.stringify(mergeAccountingScopeBody(body)),
        },
    );

export const postAccountingBatchNow = (body) =>
    apiFetch('/workshop-accounting/batches/post-now', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

export const getAccountingBatch = (id) =>
    apiFetch(
        withQuery(`/workshop-accounting/batches/${encodeURIComponent(String(id))}`, {}),
    );

export const listAccountingBatches = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/batches', params));

export const reverseAccountingBatch = (id, body) =>
    apiFetch(
        withQuery(
            `/workshop-accounting/batches/${encodeURIComponent(String(id))}/reverse`,
            {},
        ),
        {
            method: 'POST',
            body: JSON.stringify(mergeAccountingScopeBody(body)),
        },
    );

export const reverseAccountingBatchRow = (id, lineNo, body) =>
    apiFetch(
        withQuery(
            `/workshop-accounting/batches/${encodeURIComponent(String(id))}/rows/${encodeURIComponent(String(lineNo))}/reverse`,
            {},
        ),
        {
            method: 'POST',
            body: JSON.stringify(mergeAccountingScopeBody(body)),
        },
    );
