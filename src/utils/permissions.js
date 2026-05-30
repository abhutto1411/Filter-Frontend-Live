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
    { path: '/admin/tier-management',  permission: 'tier-management.view' },
    { path: '/admin/tax-codes',        permission: 'tax-codes.view' },
    { path: '/admin/marketing',        permission: 'marketing.view' },
    { path: '/admin/permissions',      permission: 'permissions.view' },
    // OPERATIONS (sub-items: redirect to their parent route — InventoryPage handles default sub-tab)
    { path: '/admin/inventory/master-catalog',   permission: 'inventory.master-catalog.view' },
    { path: '/admin/inventory/stock-movements',  permission: 'inventory.stock-movements.view' },
    { path: '/admin/inventory/units-of-measure', permission: 'inventory.units-of-measure.view' },
    { path: '/admin/customers/all-customers',    permission: 'customers.all-customers.view' },
    { path: '/admin/customers/corporate-billing', permission: 'customers.corporate-billing.view' },
    { path: '/admin/suppliers', permission: 'suppliers.view' },
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

/**
 * Compute the URL the user should land on after login (admin portal).
 *
 * Uses the same bootstrap rules as `hasPermission`:
 *   - platform_admin without role / with system role → /admin/dashboard
 *   - any user without permissions field → /admin/dashboard (legacy)
 *   - otherwise pick the first sidebar item their role permits
 *   - fallback: /admin/dashboard
 */
export function firstVisibleAdminPath(user) {
    if (!user) return '/admin/dashboard';
    const codes = Array.isArray(user.permissions) ? new Set(user.permissions) : null;

    // Bootstrap bypass — same as AuthContext.userHas
    if (user.userType === 'platform_admin' && (!user.role || user.role?.isSystem)) {
        return '/admin/dashboard';
    }
    if (!codes || codes.size === 0) return '/admin/dashboard';

    const match = ADMIN_SIDEBAR_ORDER.find((entry) =>
        entry.permission ? codes.has(entry.permission) : true,
    );
    return match?.path ?? '/admin/dashboard';
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
