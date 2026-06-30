import { NAV_ITEMS } from '../pages/workshop/constants';

/**
 * Pure helpers for the Roles & Permissions UI.
 *
 * Permission code format (matches backend): `<tabKey>.<action>`
 *   e.g. `sales.invoices.view`, `approvals.approve`, `permissions.create`.
 *
 * `userPermissions` is treated as a `Set<string>` (or array-like) of codes
 * resolved at login. While we're in Phase 1 the auth payload may not yet
 * carry this — `hasPermission` falls back to `true` so the UI doesn't lock
 * legacy super-admins out.
 */

/** Convert anything iterable / array-like to a Set of strings. */
export function toPermissionSet(input) {
    if (!input) return new Set();
    if (input instanceof Set) return input;
    if (Array.isArray(input)) return new Set(input.filter(Boolean).map(String));
    return new Set();
}

/**
 * Does the user have `code`?
 *
 * Bootstrap rules (mirror backend):
 *   • platform_admin userType → always true
 *   • userPermissions is `undefined` (not loaded yet / legacy session) → true
 *   • userPermissions is an empty Set (loaded, but no role) → true (Phase 1 legacy fallback)
 *   • Otherwise → membership test
 */
export function hasPermission(user, userPermissions, code) {
    if (!code) return true;
    if (user?.userType === 'platform_admin') return true;
    if (userPermissions === undefined || userPermissions === null) return true;
    const set = toPermissionSet(userPermissions);
    if (set.size === 0) return true; // legacy fallback during Phase 1
    return set.has(code);
}

/** Convenience — `canViewTab(user, perms, 'sales.invoices')` ⇢ `hasPermission(...'sales.invoices.view')` */
export function canViewTab(user, userPermissions, tabKey) {
    return hasPermission(user, userPermissions, `${tabKey}.view`);
}

/** Group a flat list of codes by tab — useful for rendering matrices. */
export function groupCodesByTab(codes) {
    const grouped = new Map();
    for (const code of codes || []) {
        const idx = String(code).lastIndexOf('.');
        if (idx <= 0) continue;
        const tab = code.slice(0, idx);
        const action = code.slice(idx + 1);
        if (!grouped.has(tab)) grouped.set(tab, new Set());
        grouped.get(tab).add(action);
    }
    return grouped;
}

/**
 * Compute the flat list of codes a role should have given an `actionsByTab`
 * map `{ [tabKey]: { [action]: boolean } }` — the shape used by the role
 * modal in PermissionsPage.
 */
export function flattenActionsByTab(actionsByTab) {
    const out = [];
    for (const tabKey of Object.keys(actionsByTab || {})) {
        const acts = actionsByTab[tabKey] || {};
        for (const action of Object.keys(acts)) {
            if (acts[action]) out.push(`${tabKey}.${action}`);
        }
    }
    return out;
}

/** Inverse of `flattenActionsByTab` — string[] → `{ [tabKey]: { [action]: true } }`. */
export function codesToActionsByTab(codes) {
    const out = {};
    for (const code of codes || []) {
        const idx = String(code).lastIndexOf('.');
        if (idx <= 0) continue;
        const tabKey = code.slice(0, idx);
        const action = code.slice(idx + 1);
        if (!out[tabKey]) out[tabKey] = {};
        out[tabKey][action] = true;
    }
    return out;
}

/**
 * Ordered list of admin sidebar paths matching `AdminLayout`'s NAV_CONFIG order.
 * Each entry: `{ path, permission }`. The first path the user is allowed to view
 * is what we redirect them to on login or when they hit `/admin` index.
 *
 * If a path has no `permission`, it's always visible (e.g., legacy ungated tabs).
 */
const ADMIN_SIDEBAR_ORDER = [
    // CONTROL
    { path: '/admin/dashboard',        permission: 'dashboard.view' },
    { path: '/admin/approvals',        permission: 'approvals.view' },
    { path: '/admin/zone-management',  permission: 'zone-management.view' },
    { path: '/admin/tax-codes',        permission: 'tax-codes.view' },
    { path: '/admin/marketing',        permission: 'marketing.view' },
    { path: '/admin/permissions',      permission: 'permissions.view' },
    { path: '/admin/admin-wallets',    permission: 'admin-wallets.view' },
    { path: '/admin/my-wallet', walletRequired: true },
    { path: '/admin/chat',             permission: 'chat.view' },
    { path: '/admin/demo-invoices',    permission: 'demo-invoices.view' },
    // OPERATIONS (sub-items: redirect to their parent route — InventoryPage handles default sub-tab)
    { path: '/admin/inventory/master-catalog',   permission: 'inventory.master-catalog.view' },
    { path: '/admin/inventory/stock-movements',  permission: 'inventory.stock-movements.view' },
    { path: '/admin/inventory/units-of-measure', permission: 'inventory.units-of-measure.view' },
    { path: '/admin/customers/all-customers',    permission: 'customers.all-customers.view' },
    { path: '/admin/customers/corporate-billing', permission: 'customers.corporate-billing.view' },
    { path: '/admin/suppliers', permission: 'suppliers.view' },
    { path: '/admin/storage-facility', permission: 'storage-facility.view' },
    { path: '/admin/employees', permission: 'employees.view' },
    { path: '/admin/branches',  permission: 'branches.view' },
    { path: '/admin/workshop',  permission: 'workshop.view' },
    // FINANCE
    { path: '/admin/sales/sales-reports',       permission: 'sales.sales-reports.view' },
    { path: '/admin/sales/sales-orders',        permission: 'sales.sales-orders.view' },
    { path: '/admin/sales/workshop-sales',      permission: 'sales.workshop-sales.view' },
    { path: '/admin/sales/suppliers-warehouse-sales', permission: 'sales.suppliers-warehouse-sales.view' },
    { path: '/admin/sales/corporate-transactions', permission: 'sales.corporate-transactions.view' },
    { path: '/admin/sales/receipts',            permission: 'sales.receipts.view' },
    { path: '/admin/accounting/chart-of-accounts',     permission: 'accounting.chart-of-accounts.view' },
    { path: '/admin/accounting/cash-bank',             permission: 'accounting.cash-bank.view' },
    { path: '/admin/accounting/commissions',           permission: 'accounting.commissions.view' },
    { path: '/admin/accounting/workshop-commissions', permission: 'accounting.commissions.view' },
    { path: '/admin/accounting/salary-payroll',       permission: 'accounting.commissions.view' },
    { path: '/admin/accounting/employee-ledger',     permission: 'accounting.commissions.view' },
    { path: '/admin/accounting/referral-commissions-rm', permission: 'accounting.referral-commissions-rm.view' },
    { path: '/admin/accounting/transactions',          permission: 'accounting.transactions.view' },
    { path: '/admin/accounting/journal-entries',       permission: 'accounting.journal-entries.view' },
    { path: '/admin/accounting/purchases',             permission: 'accounting.purchases.view' },
    { path: '/admin/accounting/expenses',              permission: 'accounting.expenses.view' },
    { path: '/admin/accounting/payments',              permission: 'accounting.payments.view' },
    { path: '/admin/accounting/advances',              permission: 'accounting.advances.view' },
    { path: '/admin/accounting/ledger',                permission: 'accounting.ledger.view' },
    { path: '/admin/softpos-settlement',               permission: 'softpos-settlement.view' },
];

function adminSidebarEntryAllowed(user, codes, entry) {
    if (entry.walletRequired) return Boolean(user?.walletEnabled);
    if (entry.permission) return codes.has(entry.permission);
    return true;
}

/**
 * Compute the URL the user should land on after login (admin portal).
 *
 * Uses the same bootstrap rules as `AuthContext.userHas`:
 *   - platform_admin without role / with system role → /admin/dashboard
 *   - any user without permissions field → /admin/dashboard (legacy)
 *   - user with no role assigned → /admin/dashboard (signup bootstrap)
 *   - otherwise pick the first sidebar item their role permits (never dashboard
 *     unless they have dashboard.view)
 */
export function firstVisibleAdminPath(user, options = {}) {
    if (!user) return '/admin/dashboard';

    if (user.userType === 'platform_admin' && (!user.role || user.role?.isSystem)) {
        return '/admin/dashboard';
    }

    const codes = Array.isArray(user.permissions) ? new Set(user.permissions) : null;
    if (!codes) return '/admin/dashboard';

    if (!user.role) return '/admin/dashboard';

    const excludePaths = new Set(
        (options.excludePaths ?? []).map((p) => String(p).replace(/\/$/, '')),
    );

    const match = ADMIN_SIDEBAR_ORDER.find(
        (entry) =>
            !excludePaths.has(entry.path) &&
            adminSidebarEntryAllowed(user, codes, entry),
    );
    if (match) return match.path;

    if (user.walletEnabled && !excludePaths.has('/admin/my-wallet')) {
        return '/admin/my-wallet';
    }

    return '/admin/permissions';
}

/** First admin route the user can open after leaving fullscreen chat (never /admin/chat). */
export function adminHomePathAfterChat(user) {
    return firstVisibleAdminPath(user, { excludePaths: ['/admin/chat'] });
}

const WORKSHOP_ACC_TAB_SLUG = {
    'acc-chart': 'chart-of-accounts',
    'acc-cash': 'cash-bank',
    'acc-transactions': 'transactions',
    'acc-journal': 'journal-entries',
    'acc-expenses': 'expenses',
    'acc-receipts': 'receipts',
    'acc-payments': 'payments',
    'acc-advances': 'advances',
    'acc-payroll': 'payroll',
    'acc-approvals': 'approvals',
    'acc-ledger': 'ledger',
};

const STAFF_APP_TAB_SLUG = {
    'sap-overview': 'overview',
    'sap-expenses': 'expenses',
    'sap-requests': 'requests',
    'sap-purchase-orders': 'purchase-orders',
    'sap-tasks': 'tasks',
    'sap-leave': 'leave',
    'sap-salary-advances': 'salary-advances',
    'sap-chat': 'chat',
    'sap-notifications': 'notifications',
    'sap-settings': 'settings',
};

/** Map a workshop sidebar tab id to its URL path. */
export function workshopTabToPath(tabId) {
    if (tabId.startsWith('acc-')) {
        const slug = WORKSHOP_ACC_TAB_SLUG[tabId] || 'cash-bank';
        return `/workshop/accounting/${slug}`;
    }
    if (tabId.startsWith('sap-')) {
        const slug = STAFF_APP_TAB_SLUG[tabId] || 'overview';
        return `/workshop/staff-app/${slug}`;
    }
    return `/workshop/${tabId}`;
}

function workshopUserCanAccessCode(user, codes, permission) {
    if (!permission) return true;
    if (!user) return false;
    if (user.userType === 'workshop_owner' && (!user.role || user.role?.isSystem)) {
        return true;
    }
    if (!codes) return true;
    if (!user.role) return true;
    if (codes.has(permission)) return true;
    if (permission === 'workshop.platform-chat.view' && codes.has('chat.view')) return true;
    if (permission === 'workshop.platform-chat.create' && codes.has('chat.create')) return true;
    return false;
}

function workshopNavItemAllowed(user, codes, item) {
    if (item.walletRequired) return Boolean(user?.walletEnabled);
    if (item.subItems?.length) return false;
    if (!item.permission) return true;
    return workshopUserCanAccessCode(user, codes, item.permission);
}

/**
 * Landing path after workshop login — first sidebar tab the user may view.
 * Mirrors `firstVisibleAdminPath` + `AuthContext.userHas` bootstrap rules.
 */
export function firstVisibleWorkshopPath(user) {
    if (!user) return '/workshop/dashboard';

    const codes = Array.isArray(user.permissions) ? new Set(user.permissions) : null;

    if (user.userType === 'workshop_owner' && (!user.role || user.role?.isSystem)) {
        return '/workshop/dashboard';
    }
    if (!codes || !user.role) return '/workshop/dashboard';

    for (const item of NAV_ITEMS) {
        if (item.subItems?.length) {
            const visibleSubs = item.subItems.filter((s) =>
                workshopUserCanAccessCode(user, codes, s.permission),
            );
            if (visibleSubs.length > 0) {
                return workshopTabToPath(visibleSubs[0].id);
            }
        } else if (workshopNavItemAllowed(user, codes, item)) {
            return workshopTabToPath(item.id);
        }
    }

    if (user.walletEnabled) {
        return '/workshop/my-wallet';
    }

    return null;
}

/** Safe navigate target after workshop login (never `/workshop/dashboard` unless allowed). */
export function workshopLandingPath(user) {
    return firstVisibleWorkshopPath(user) ?? '/workshop';
}

/** Portal-aware userType inference, mirrors backend `createUserWithRole`. */
export function userTypeForPortal(portal) {
    switch (portal) {
        case 'super_admin':
            return 'platform_admin';
        case 'workshop':
        case 'technician':
            return 'workshop_user';
        case 'cashier':
            return 'cashier_user';
        case 'corporate':
            return 'corporate_user';
        case 'supplier':
            return 'supplier_user';
        default:
            return 'workshop_user';
    }
}
