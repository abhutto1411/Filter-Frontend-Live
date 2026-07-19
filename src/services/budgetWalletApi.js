import { apiFetch } from './api';

function buildQs(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const s = qs.toString();
    return s ? `?${s}` : '';
}

/** List budget wallet accounts (scoped). */
export function listBudgetWalletAccounts({ scopeType, workshopId, branchId, status, search } = {}) {
    return apiFetch(
        `/super-admin/budget-wallets/accounts${buildQs({ scopeType, workshopId, branchId, status, search })}`,
    );
}

/** Scoped active accounts for the fund/expense approval modal. */
export function listBudgetWalletAccountsForApproval({ workshopId, branchId } = {}) {
    return apiFetch(
        `/super-admin/budget-wallets/accounts/for-approval${buildQs({ workshopId, branchId })}`,
    );
}

/** payload = { name, code?, description?, scopeType, workshopId?, branchId?, initialBudget } */
export function createBudgetWalletAccount(payload) {
    return apiFetch('/super-admin/budget-wallets/accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/** payload = { name?, code?, description?, status?, adjustmentAmount?, adjustmentReason? } */
export function updateBudgetWalletAccount(id, payload) {
    return apiFetch(`/super-admin/budget-wallets/accounts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export function getBudgetWalletAccount(id) {
    return apiFetch(`/super-admin/budget-wallets/accounts/${encodeURIComponent(id)}`);
}

export function listBudgetWalletTransactions(id, { limit, offset } = {}) {
    return apiFetch(
        `/super-admin/budget-wallets/accounts/${encodeURIComponent(id)}/transactions${buildQs({ limit, offset })}`,
    );
}
