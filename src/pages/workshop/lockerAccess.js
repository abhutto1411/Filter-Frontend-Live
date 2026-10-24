import {
    LayoutDashboard,
    Gauge,
    Clock,
    DollarSign,
    AlertTriangle,
    Send,
    Coins,
    ClipboardList,
    Receipt,
    BookOpen,
    History,
    FileText,
    Users,
    Wallet,
} from 'lucide-react';

/** Mirrors backend `LOCKER_PERMISSIONS` (filter_backend/src/locker/locker-access.ts). */
export const LOCKER_PAGE_PERMISSION = 'workshop.locker-management.view';

export const LOCKER_ACTION_PERMISSIONS = {
    'collections.view': 'workshop.locker-management.collections.view',
    'collections.record': 'workshop.locker-management.collections.create',
    'collections.assign': 'workshop.locker-management.collections.edit',
    'approvals.view': 'workshop.locker-management.approvals.view',
    'approvals.decide': 'workshop.locker-management.approvals.edit',
    'deposits.view': 'workshop.locker-management.bank-deposits.view',
    'deposits.create': 'workshop.locker-management.bank-deposits.create',
    'pettyCash.view': 'workshop.locker-management.petty-cash.view',
    'pettyCash.issue': 'workshop.locker-management.petty-cash.create',
    'pettyCash.decide': 'workshop.locker-management.petty-cash.edit',
    'expenses.view': 'workshop.locker-management.expenses.view',
    'expenses.create': 'workshop.locker-management.expenses.create',
    'expenses.decide': 'workshop.locker-management.expenses.edit',
    'reports.view': 'workshop.locker-management.reports.view',
    'vaultVouchers.view': 'workshop.locker-management.vault-vouchers.view',
    'vaultVouchers.create': 'workshop.locker-management.vault-vouchers.create',
    'vaultVouchers.decide': 'workshop.locker-management.vault-vouchers.edit',
};

/**
 * Workshop Admin → Locker Management tabs (Overview + the supervisor portal order).
 * A tab is visible when the user holds any of `anyOf` (empty = page access only).
 */
export const LOCKER_WORKSPACE_TABS = [
    { id: 'overview', icon: LayoutDashboard, anyOf: [] },
    { id: 'dashboard', icon: Gauge, anyOf: [] },
    { id: 'pending', icon: Clock, anyOf: ['collections.view'] },
    { id: 'record', icon: DollarSign, anyOf: ['collections.record'] },
    { id: 'approvals', icon: AlertTriangle, anyOf: ['approvals.view', 'approvals.decide'] },
    { id: 'deposit_to_bank', icon: Send, anyOf: ['deposits.view', 'deposits.create'] },
    { id: 'issue_petty_cash', icon: Coins, anyOf: ['pettyCash.view', 'pettyCash.issue'] },
    { id: 'petty_cash_issue_log', icon: ClipboardList, anyOf: ['pettyCash.view', 'pettyCash.issue'] },
    {
        id: 'expenses',
        icon: Receipt,
        anyOf: ['expenses.view', 'expenses.create', 'expenses.decide'],
    },
    {
        id: 'vault_vouchers',
        icon: Wallet,
        anyOf: ['vaultVouchers.view', 'vaultVouchers.create', 'vaultVouchers.decide'],
    },
    { id: 'transaction_log', icon: BookOpen, anyOf: ['reports.view'] },
    { id: 'history', icon: History, anyOf: ['reports.view'] },
    { id: 'differences', icon: FileText, anyOf: ['reports.view'] },
    { id: 'team', icon: Users, anyOf: [] },
];

export function isWorkshopOwner(user) {
    return String(user?.userType || '').toLowerCase() === 'workshop_owner';
}

/**
 * Returns `can(action)` for the locker pages. The workshop owner (head of the
 * company) can do everything; other staff follow their role's locker codes.
 */
export function buildLockerCan(user, hasPermission) {
    if (isWorkshopOwner(user)) return () => true;
    return (action) => {
        const code = LOCKER_ACTION_PERMISSIONS[action];
        if (!code) return false;
        return Boolean(hasPermission?.(code));
    };
}

export function buildLockerCanOpenTab(can) {
    return (tabId) => {
        const tab = LOCKER_WORKSPACE_TABS.find((x) => x.id === tabId);
        if (!tab) return false;
        return tab.anyOf.length === 0 || tab.anyOf.some((action) => can(action));
    };
}
