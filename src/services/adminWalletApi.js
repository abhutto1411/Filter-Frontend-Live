import { apiFetch } from './api';

function buildQs(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const s = qs.toString();
    return s ? `?${s}` : '';
}

/** List platform admins with wallet assignment + balance. */
export function listAdminWallets({ search, walletOnly, limit, offset } = {}) {
    return apiFetch(
        `/super-admin/admin-wallets${buildQs({ search, walletOnly, limit, offset })}`,
    );
}

/** Wallet detail for one platform admin. */
export function getAdminWallet(userId) {
    return apiFetch(`/super-admin/admin-wallets/${encodeURIComponent(userId)}`);
}

/** Cash/bank registers for admin wallet fund approval (optional workshop scope). */
export function listAdminWalletCashAccounts({ workshopId, branchId } = {}) {
    return apiFetch(
        `/super-admin/admin-wallets/cash-accounts${buildQs({ workshopId, branchId })}`,
    );
}

/** Any user's wallet balance (workshop + platform admin wallet users). */
export function getRequesterWalletBalance(userId, currencyCode = 'SAR') {
    return apiFetch(
        `/super-admin/admin-wallets/requester-wallet-balance${buildQs({ userId, currencyCode })}`,
    );
}

/** Paginated transaction history for one platform admin wallet. */
export function listAdminWalletTransactions(userId, { limit, offset } = {}) {
    return apiFetch(
        `/super-admin/admin-wallets/${encodeURIComponent(userId)}/transactions${buildQs({ limit, offset })}`,
    );
}

// ───────── My Wallet (wallet-enabled platform admin) ─────────

export function createMyWalletApi(basePath) {
    const base = String(basePath).replace(/\/$/, '');
    return {
        getMyWallet: () => apiFetch(base),
        getMyWalletChatContact: () => apiFetch(`${base}/chat-contact`),
        listMyWalletTransactions: ({ limit, offset } = {}) =>
            apiFetch(`${base}/transactions${buildQs({ limit, offset })}`),
        listMyFundRequests: () => apiFetch(`${base}/fund-requests`),
        listMyWalletWorkshops: () => apiFetch(`${base}/workshops`),
        listMyWalletBranches: ({ workshopId } = {}) =>
            apiFetch(`${base}/branches${buildQs({ workshopId })}`),
        createMyFundRequest: (payload) =>
            apiFetch(`${base}/fund-requests`, {
                method: 'POST',
                body: JSON.stringify(payload),
            }),
        shareFundRequestInChat: (fundRequestId) =>
            apiFetch(
                `${base}/fund-requests/${encodeURIComponent(String(fundRequestId))}/share-in-chat`,
                { method: 'POST' },
            ),
        cancelMyFundRequest: (fundRequestId) =>
            apiFetch(
                `${base}/fund-requests/${encodeURIComponent(String(fundRequestId))}/cancel`,
                { method: 'POST' },
            ),
        recordMyWalletExpense: (payload) =>
            apiFetch(`${base}/expenses`, {
                method: 'POST',
                body: JSON.stringify(payload),
            }),
        listMyExpenseRequests: () => apiFetch(`${base}/expense-requests`),
        cancelMyExpenseRequest: (expenseRequestId) =>
            apiFetch(
                `${base}/expense-requests/${encodeURIComponent(String(expenseRequestId))}/cancel`,
                { method: 'POST' },
            ),
    };
}

export const adminMyWalletApi = createMyWalletApi('/super-admin/my-wallet');
export const workshopMyWalletApi = createMyWalletApi('/workshop-staff/my-wallet');

/** Pick admin vs workshop-staff my-wallet endpoints from session userType. */
export function myWalletApiForUser(user) {
    return user?.userType === 'platform_admin' ? adminMyWalletApi : workshopMyWalletApi;
}

export function getMyWallet() {
    return adminMyWalletApi.getMyWallet();
}

export function getMyWalletChatContact() {
    return adminMyWalletApi.getMyWalletChatContact();
}

export function listMyWalletTransactions({ limit, offset } = {}) {
    return adminMyWalletApi.listMyWalletTransactions({ limit, offset });
}

export function listMyFundRequests() {
    return adminMyWalletApi.listMyFundRequests();
}

export function listMyWalletWorkshops() {
    return adminMyWalletApi.listMyWalletWorkshops();
}

export function listMyWalletBranches({ workshopId } = {}) {
    return adminMyWalletApi.listMyWalletBranches({ workshopId });
}

/** payload = { amount, purpose, workshopId, branchId } */
export function createMyFundRequest(payload) {
    return adminMyWalletApi.createMyFundRequest(payload);
}

export function shareFundRequestInChat(fundRequestId) {
    return adminMyWalletApi.shareFundRequestInChat(fundRequestId);
}

export function cancelMyFundRequest(fundRequestId) {
    return adminMyWalletApi.cancelMyFundRequest(fundRequestId);
}

/** payload = { amount, description, vendorName?, expenseCategory, proofUrl, workshopId, branchId } */
export function recordMyWalletExpense(payload) {
    return adminMyWalletApi.recordMyWalletExpense(payload);
}

export function listMyExpenseRequests() {
    return adminMyWalletApi.listMyExpenseRequests();
}

export function cancelMyExpenseRequest(expenseRequestId) {
    return adminMyWalletApi.cancelMyExpenseRequest(expenseRequestId);
}
