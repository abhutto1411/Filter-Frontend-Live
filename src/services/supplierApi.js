import { apiFetch, BASE_URL } from './api';

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

// Dashboard
export const getSupplierDashboard = () => apiFetch('/supplier/dashboard');
export const getSupplierPurchaseOrders = (params = {}) =>
    apiFetch(withQuery('/supplier/purchase-orders', params));
export const getSupplierReceivables = () => apiFetch('/supplier/receivables');

/** Approved Filter workshops (multi-select source for affiliated list). */
export const getSupplierFinancePlatformWorkshops = () =>
    apiFetch('/supplier/finance/platform-workshops');
/** Tracked branches + workshop-only pins; AR per branch or whole workshop. */
export const listSupplierAffiliatedWorkshops = () =>
    apiFetch('/supplier/finance/affiliated-workshops');
/** @param body {{ workshopIds?: string[], branchIds?: string[] }} */
export const bulkAddSupplierAffiliatedWorkshops = (body) =>
    apiFetch('/supplier/finance/affiliated-workshops/bulk', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const removeSupplierAffiliatedBranch = (branchId) =>
    apiFetch(
        `/supplier/finance/affiliated-branches/${encodeURIComponent(branchId)}`,
        { method: 'DELETE' },
    );
/** @param body {{ isActive: boolean }} */
export const patchSupplierAffiliatedBranchActive = (branchId, body) =>
    apiFetch(`/supplier/finance/affiliated-branches/${encodeURIComponent(branchId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
/** Workshop with no branches only */
export const removeSupplierAffiliatedWorkshop = (workshopId) =>
    apiFetch(
        `/supplier/finance/affiliated-workshops/${encodeURIComponent(workshopId)}`,
        { method: 'DELETE' },
    );
/** @param body {{ isActive: boolean }} */
export const patchSupplierAffiliatedWorkshopActive = (workshopId, body) =>
    apiFetch(`/supplier/finance/affiliated-workshops/${encodeURIComponent(workshopId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const getSupplierAffiliatedBranchTransactions = (branchId, params = {}) =>
    apiFetch(
        withQuery(
            `/supplier/finance/affiliated-branches/${encodeURIComponent(branchId)}/transactions`,
            params,
        ),
    );
export const getSupplierAffiliatedWorkshopTransactions = (
    workshopId,
    params = {},
) =>
    apiFetch(
        withQuery(
            `/supplier/finance/affiliated-workshops/${encodeURIComponent(workshopId)}/transactions`,
            params,
        ),
    );

/** Manual non-affiliated parties + ledger. */
export const listSupplierExternalParties = () =>
    apiFetch('/supplier/finance/external-parties');
export const createSupplierExternalParty = (body) =>
    apiFetch('/supplier/finance/external-parties', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const updateSupplierExternalParty = (partyId, body) =>
    apiFetch(`/supplier/finance/external-parties/${encodeURIComponent(partyId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deactivateSupplierExternalParty = (partyId) =>
    apiFetch(`/supplier/finance/external-parties/${encodeURIComponent(partyId)}`, {
        method: 'DELETE',
    });
export const addSupplierExternalPartyLedger = (partyId, body) =>
    apiFetch(
        `/supplier/finance/external-parties/${encodeURIComponent(partyId)}/ledger`,
        { method: 'POST', body: JSON.stringify(body) },
    );
export const getSupplierExternalPartyTransactions = (partyId, params = {}) =>
    apiFetch(
        withQuery(
            `/supplier/finance/external-parties/${encodeURIComponent(partyId)}/transactions`,
            params,
        ),
    );
export const getSupplierReportsQuickSummary = () =>
    apiFetch('/supplier/reports/quick-summary');
export const getSupplierProfile = () => apiFetch('/supplier/profile');

// Products / catalog
export const listSupplierProducts = (params = {}, fetchOptions = {}) =>
    apiFetch(withQuery('/supplier/products', params), fetchOptions);

/** Paginate `/supplier/products` until exhausted (for bulk catalog import / dedupe maps). */
export async function fetchAllSupplierProducts({ status = 'all', pageSize = 2000, signal } = {}) {
    const out = [];
    let offset = 0;
    const limit = pageSize;
    while (true) {
        const res = await listSupplierProducts(
            { status, limit, offset },
            signal ? { signal } : {},
        );
        const batch = Array.isArray(res?.products)
            ? res.products
            : Array.isArray(res)
              ? res
              : [];
        out.push(...batch);
        if (batch.length < limit) break;
        offset += limit;
    }
    return out;
}
export const listSupplierMasterCatalogProducts = ({ branchId, signal } = {}) =>
    apiFetch(withQuery('/supplier/products/master-catalog', { branchId }), { signal });
export const createSupplierProductRequest = (body) =>
    apiFetch('/supplier/product-requests', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const listSupplierProductRequests = (params = {}) =>
    apiFetch(withQuery('/supplier/product-requests', params));
export const getSupplierProduct = (productId) =>
    apiFetch(`/supplier/products/${productId}`);
export const createSupplierProduct = (body) =>
    apiFetch('/supplier/products', { method: 'POST', body: JSON.stringify(body) });
export const updateSupplierProduct = (productId, body) =>
    apiFetch(`/supplier/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteSupplierProduct = (productId) =>
    apiFetch(`/supplier/products/${productId}`, {
        method: 'DELETE',
    });
export const getSupplierProductCategories = () =>
    apiFetch('/supplier/product-categories');
export const getSupplierUnits = () => apiFetch('/supplier/units');

// Locations / stock
export const getSupplierLocations = () => apiFetch('/supplier/locations');
export const createSupplierLocation = (body) =>
    apiFetch('/supplier/locations', { method: 'POST', body: JSON.stringify(body) });
export const getSupplierInventoryStockBalances = (params = {}) =>
    apiFetch(withQuery('/supplier/inventory/stock-balances', params));
export const getSupplierStockVisibilityScreen = (params = {}) =>
    apiFetch(withQuery('/supplier/stock-visibility/screen', params));
export const getSupplierCriticalStockSummary = () =>
    apiFetch('/supplier/stock-visibility/critical-summary');
/** Workshop branches (linked to this supplier) with catalog products at/below critical stock */
export const getSupplierWorkshopCriticalStockAlerts = () =>
    apiFetch('/supplier/workshops/critical-stock-alerts');
export const getSupplierStockVisibility = (params = {}) =>
    apiFetch(withQuery('/supplier/stock-visibility', params));
export const setSupplierStock = (body) =>
    apiFetch('/supplier/stock', { method: 'POST', body: JSON.stringify(body) });
export const createSupplierStockOrder = (body) =>
    apiFetch('/supplier/stock/order', { method: 'POST', body: JSON.stringify(body) });

// Promo banners
export const getSupplierPromoBannersSummary = () =>
    apiFetch('/supplier/promo-banners/summary');
export const listSupplierPromoBanners = (params = {}) =>
    apiFetch(withQuery('/supplier/promo-banners', params));
export const getSupplierPromoBanner = (id) => apiFetch(`/supplier/promo-banners/${id}`);
export const createSupplierPromoBanner = (body) =>
    apiFetch('/supplier/promo-banners', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const updateSupplierPromoBannerStatus = (id, body) =>
    apiFetch(`/supplier/promo-banners/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const updateSupplierPromoBanner = (id, body) =>
    apiFetch(`/supplier/promo-banners/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

// Purchase orders
export const getSupplierPurchaseOrder = (id) =>
    apiFetch(`/supplier/purchase-orders/${encodeURIComponent(id)}`);
export const acceptSupplierPurchaseOrder = (id) =>
    apiFetch(`/supplier/purchase-orders/${encodeURIComponent(id)}/accept`, { method: 'PATCH' });
export const rejectSupplierPurchaseOrder = (id, body) =>
    apiFetch(`/supplier/purchase-orders/${encodeURIComponent(id)}/reject`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deliverSupplierPurchaseOrder = (id, body) =>
    apiFetch(`/supplier/purchase-orders/${encodeURIComponent(id)}/deliver`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const updateSupplierPurchaseOrderStatus = (id, body) =>
    apiFetch(`/supplier/purchase-orders/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

// Invoices / payments / payables
export const createSupplierInvoice = (body) =>
    apiFetch('/supplier/invoices', { method: 'POST', body: JSON.stringify(body) });
export const listSupplierInvoices = (params = {}) =>
    apiFetch(withQuery('/supplier/invoices', params));
/** Workshop branches linked to this supplier (sales invoice `branchId` dropdown). */
export const getSupplierSalesInvoiceCustomerBranches = () =>
    apiFetch('/supplier/invoices/customer-branches');
export const getSupplierInvoice = (id) => apiFetch(`/supplier/invoices/${id}`);
export const updateSupplierInvoice = (id, body) =>
    apiFetch(`/supplier/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
/** Mark sales invoice paid (records receipt) or unpaid (clears payments) — see backend PATCH .../payment-status */
export const patchSupplierInvoicePaymentStatus = (id, body) =>
    apiFetch(`/supplier/invoices/${id}/payment-status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteSupplierInvoice = (id) =>
    apiFetch(`/supplier/invoices/${id}`, { method: 'DELETE' });
export const getSupplierInvoicePdfData = (id) =>
    apiFetch(`/supplier/invoices/${id}/pdf`);
/** List goods returns / credits against a sales invoice (audit trail). */
export const listSupplierInvoiceReturns = (invoiceId) =>
    apiFetch(`/supplier/invoices/${encodeURIComponent(invoiceId)}/returns`);
/** Create a return (reduces collectable AR; stored + supplier_transaction_history). */
export const createSupplierInvoiceReturn = (invoiceId, body) =>
    apiFetch(`/supplier/invoices/${encodeURIComponent(invoiceId)}/returns`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const remindSupplierInvoice = (id) =>
    apiFetch(`/supplier/invoices/${id}/remind`, { method: 'POST' });
export const recordSupplierPayment = (body) =>
    apiFetch('/supplier/payments', { method: 'POST', body: JSON.stringify(body) });
export const listSupplierPayments = (params = {}) =>
    apiFetch(withQuery('/supplier/payments', params));
export const createSupplierPayable = (body) =>
    apiFetch('/supplier/payables', { method: 'POST', body: JSON.stringify(body) });
export const listSupplierPayables = (params = {}) =>
    apiFetch(withQuery('/supplier/payables', params));
export const getSupplierPayable = (id) => apiFetch(`/supplier/payables/${id}`);
export const updateSupplierPayable = (id, body) =>
    apiFetch(`/supplier/payables/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteSupplierPayable = (id) =>
    apiFetch(`/supplier/payables/${id}`, { method: 'DELETE' });

// Super suppliers (upstream vendors you buy inventory from)
export const listSupplierSuperSuppliers = () => apiFetch('/supplier/super-suppliers');
export const createSupplierSuperSupplier = (body) =>
    apiFetch('/supplier/super-suppliers', { method: 'POST', body: JSON.stringify(body) });
export const updateSupplierSuperSupplier = (id, body) =>
    apiFetch(`/supplier/super-suppliers/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const listSupplierSuperSupplierPurchases = (params = {}) =>
    apiFetch(withQuery('/supplier/super-supplier-purchases', params));
export const createSupplierSuperSupplierPurchase = (body) =>
    apiFetch('/supplier/super-supplier-purchases', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const getSupplierSuperSupplierPurchase = (id) =>
    apiFetch(`/supplier/super-supplier-purchases/${encodeURIComponent(String(id))}`);
export const updateSupplierSuperSupplierPurchase = (id, body) =>
    apiFetch(`/supplier/super-supplier-purchases/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const listSupplierSuperSupplierAudit = (params = {}) =>
    apiFetch(withQuery('/supplier/super-supplier-audit', params));

// Workshop purchase invoices (workshop submits → supplier reviews / stock on approve)
export const listSupplierWorkshopPurchaseInvoices = (params = {}) =>
    apiFetch(withQuery('/supplier/workshop-purchase-invoices', params));
export const getSupplierWorkshopPurchaseInvoice = (id) =>
    apiFetch(`/supplier/workshop-purchase-invoices/${encodeURIComponent(String(id))}`);
export const updateSupplierWorkshopPurchaseInvoice = (id, body) =>
    apiFetch(`/supplier/workshop-purchase-invoices/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const approveSupplierWorkshopPurchaseInvoice = (id) =>
    apiFetch(`/supplier/workshop-purchase-invoices/${encodeURIComponent(String(id))}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
export const rejectSupplierWorkshopPurchaseInvoice = (id, body) =>
    apiFetch(`/supplier/workshop-purchase-invoices/${encodeURIComponent(String(id))}/reject`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
    });
/** Fulfillment chain after approve: processing → ready_to_dispatch → on_the_way → delivered */
export const patchSupplierWorkshopPurchaseInvoiceStatus = (id, body) =>
    apiFetch(`/supplier/workshop-purchase-invoices/${encodeURIComponent(String(id))}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body || {}),
    });

/** Download PDF for a payable (GET /supplier/payables/:id/pdf). Returns blob + suggested filename from Content-Disposition when present. */
export async function downloadSupplierPayablePdf(id) {
    const token = localStorage.getItem('filter_auth_token');
    const res = await fetch(`${BASE_URL}/supplier/payables/${encodeURIComponent(id)}/pdf`, {
        method: 'GET',
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'application/pdf,*/*',
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `PDF request failed: ${res.status}`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd);
    const filename = m ? decodeURIComponent(m[1].trim()) : `payable-${id}.pdf`;
    return { blob, filename };
}

// Expenses
export const getSupplierExpenseCategories = () =>
    apiFetch('/supplier/expense-categories');
export const createSupplierExpenseCategory = (body) =>
    apiFetch('/supplier/expense-categories', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const createSupplierExpense = (body) =>
    apiFetch('/supplier/expenses', { method: 'POST', body: JSON.stringify(body) });
export const listSupplierExpenses = (params = {}) =>
    apiFetch(withQuery('/supplier/expenses', params));
export const getSupplierExpense = (id) => apiFetch(`/supplier/expenses/${id}`);
export const updateSupplierExpense = (id, body) =>
    apiFetch(`/supplier/expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteSupplierExpense = (id) =>
    apiFetch(`/supplier/expenses/${id}`, { method: 'DELETE' });
export const getSupplierExpensesSummary = () =>
    apiFetch('/supplier/expenses/summary');
export const getSupplierExpensesStats = () => apiFetch('/supplier/expenses/stats');
export const getSupplierAccountingReport = () =>
    apiFetch('/supplier/reports/accounting');
export const getSupplierAccountingScreen = (params = {}) =>
    apiFetch(withQuery('/supplier/reports/accounting/screen', params));

/**
 * Merge rollups from the accounting report root (`summary`, `expenses.stats`) when
 * `chartOfAccounts.rollups` is missing, stale, or zero so COA KPIs match the Expenses tab.
 */
function mergeSupplierCoaRollups(report, embedded) {
    const baseline =
        embedded && typeof embedded === 'object' && embedded.rollups && typeof embedded.rollups === 'object'
            ? embedded.rollups
            : {};
    const summary = report?.summary || {};
    const expStats = report?.expenses?.stats || {};

    const expenseRecords = Array.isArray(embedded?.expenseRecords) ? embedded.expenseRecords : [];
    const lineSum = expenseRecords.reduce(
        (s, e) => s + Number(e.totalAmount ?? e.amount ?? 0),
        0,
    );
    const expenseByCategory = Array.isArray(embedded?.expenseByCategory) ? embedded.expenseByCategory : [];
    const catSum = expenseByCategory.reduce((s, e) => s + Number(e.totalAmount ?? 0), 0);

    const fromReport = Number(expStats.totalExpenses ?? summary.totalExpenses ?? 0);
    const rollupExp = Number(baseline.expenseAmountTotal);
    const expenseAmountTotal = rollupExp || fromReport || lineSum || catSum;

    return {
        currencyCode: baseline.currencyCode ?? embedded?.currencyCode ?? report?.currencyCode ?? 'SAR',
        accountsReceivable: Number(baseline.accountsReceivable ?? summary.totalAR ?? 0),
        accountsPayable: Number(baseline.accountsPayable ?? summary.totalAP ?? 0),
        expenseRecordsTotal: Number(
            baseline.expenseRecordsTotal ?? expStats.totalRecords ?? expenseRecords.length ?? 0,
        ),
        expenseAmountTotal,
        expensesPaid: Number(baseline.expensesPaid ?? expStats.paid ?? 0),
        expensesPendingApproval: Number(baseline.expensesPendingApproval ?? expStats.pendingApproval ?? 0),
        paymentsReceivedTotal: Number(baseline.paymentsReceivedTotal ?? 0),
        paymentsReceivedCount: Number(baseline.paymentsReceivedCount ?? 0),
        superSupplierPurchasesTotal: Number(baseline.superSupplierPurchasesTotal ?? 0),
        superSupplierPurchaseCount: Number(baseline.superSupplierPurchaseCount ?? 0),
        workshopPurchaseInvoicesTotal: Number(baseline.workshopPurchaseInvoicesTotal ?? 0),
        workshopPurchaseInvoiceCount: Number(baseline.workshopPurchaseInvoiceCount ?? 0),
    };
}

/**
 * Chart of accounts for supplier portal: prefers `chartOfAccounts` on
 * `GET /supplier/reports/accounting` (works on older deployed APIs once that
 * handler is updated). Falls back to cash/bank accounts + summary AR/AP only.
 */
export async function getSupplierChartOfAccounts() {
    const report = await getSupplierAccountingReport();
    const embedded = report?.chartOfAccounts;
    if (embedded && Array.isArray(embedded.ledgerAccounts)) {
        const rollups = mergeSupplierCoaRollups(report, embedded);
        return {
            success: true,
            ...embedded,
            currencyCode: embedded.currencyCode || report.currencyCode || 'SAR',
            ledgerAccounts: embedded.ledgerAccounts,
            memoAccounts: Array.isArray(embedded.memoAccounts) ? embedded.memoAccounts : [],
            rollups,
        };
    }
    const cur = report?.currencyCode || 'SAR';
    const s = report?.summary || {};
    const totalAR = Number(s.totalAR ?? 0);
    const totalAP = Number(s.totalAP ?? 0);
    const cb = report?.cashBank;
    let ledgerFromCash = [];
    if (cb && typeof cb === 'object') {
        const arr = Array.isArray(cb.accounts) ? cb.accounts : [];
        ledgerFromCash = arr.map((a) => ({
            id: String(a.id ?? ''),
            name: a.name ?? '—',
            accountType: a.accountType ?? '—',
            refId: null,
            openingBalance: Number(a.openingBalance ?? 0),
            balance: Number(a.balance ?? a.openingBalance ?? 0),
        }));
    }
    const rollups = mergeSupplierCoaRollups(report, embedded && typeof embedded === 'object' ? embedded : null);
    return {
        success: true,
        currencyCode: cur,
        ledgerAccounts: ledgerFromCash,
        memoAccounts: [
            {
                id: 'memo_ar',
                name: 'Accounts receivable (open sales invoices)',
                accountType: 'memo_ar',
                balance: totalAR,
            },
            {
                id: 'memo_ap',
                name: 'Accounts payable (creditors / payables)',
                accountType: 'memo_ap',
                balance: totalAP,
            },
        ],
        rollups,
    };
}

// Staff
export const listSupplierStaff = (params = {}) =>
    apiFetch(withQuery('/supplier/staff', params));
export const createSupplierStaff = (body) =>
    apiFetch('/supplier/staff', { method: 'POST', body: JSON.stringify(body) });
export const updateSupplierStaff = (id, body) =>
    apiFetch(`/supplier/staff/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const patchSupplierStaffDutyStatus = (id, body) =>
    apiFetch(`/supplier/staff/${id}/duty-status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteSupplierStaff = (id) =>
    apiFetch(`/supplier/staff/${id}`, { method: 'DELETE' });

// Cash/Bank accounts + ledger
export const listSupplierCashBankAccounts = () =>
    apiFetch('/supplier/cash-bank/accounts');
export const createSupplierCashBankAccount = (body) =>
    apiFetch('/supplier/cash-bank/accounts', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const updateSupplierCashBankAccount = (id, body) =>
    apiFetch(`/supplier/cash-bank/accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const listSupplierCashBankLedger = (params = {}) =>
    apiFetch(withQuery('/supplier/cash-bank/ledger', params));
export const createSupplierCashBankLedgerEntry = (body) =>
    apiFetch('/supplier/cash-bank/ledger', {
        method: 'POST',
        body: JSON.stringify(body),
    });

// Profile / auth
export const updateSupplierProfile = (body) =>
    apiFetch('/supplier/profile', { method: 'PATCH', body: JSON.stringify(body) });
export const changeSupplierPassword = (body) =>
    apiFetch('/supplier/change-password', {
        method: 'POST',
        body: JSON.stringify(body),
    });
