/**
 * Super Admin page access — fail-closed.
 *
 * Unknown sidebar items and routes resolve to `<path>.view`. Custom roles
 * only get that code if it exists in the backend catalog AND was granted.
 * Super Admin (system) still bypasses via AuthContext.hasPermission.
 */

export const ADMIN_TOP_VIEW_PERMISSION = {
    dashboard: 'dashboard.view',
    'filter-connect': 'filter-connect.view',
    approvals: 'approvals.view',
    'zone-management': 'zone-management.view',
    'tier-management': 'tier-management.view',
    'tax-codes': 'tax-codes.view',
    'legal-pages': 'legal-pages.view',
    'mobile-app-menu': 'mobile-app-menu.view',
    marketing: 'marketing.view',
    permissions: 'permissions.view',
    'admin-wallets': 'admin-wallets.view',
    chat: 'chat.view',
    'demo-invoices': 'demo-invoices.view',
    suppliers: 'suppliers.view',
    'storage-facility': 'storage-facility.view',
    employees: 'employees.view',
    branches: 'branches.view',
    workshop: 'workshop.view',
    'staff-app': 'workshop.staff-app.overview.view',
    accounting: 'accounting.monitor.view',
    'softpos-settlement': 'softpos-settlement.view',
};

/** Nested routes whose view code is not `${parent}.${sub}.view`. */
export const ADMIN_NESTED_VIEW_PERMISSION = {
    'inventory.master-catalog': 'inventory.master-catalog.view',
    'inventory.stock-movements': 'inventory.stock-movements.view',
    'inventory.units-of-measure': 'inventory.units-of-measure.view',
    'customers.all-customers': 'customers.all-customers.view',
    'customers.corporate-billing': 'customers.corporate-billing.view',
    'sales.sales-reports': 'sales.sales-reports.view',
    'sales.advanced-reports': 'sales.advanced-reports.view',
    'sales.sales-orders': 'sales.sales-orders.view',
    'sales.workshop-sales': 'sales.workshop-sales.view',
    'sales.suppliers-warehouse-sales': 'sales.suppliers-warehouse-sales.view',
    'sales.corporate-transactions': 'sales.corporate-transactions.view',
    'sales.sales-returns': 'sales.sales-returns.view',
    'sales.receipts': 'sales.receipts.view',
    'accounting.chart-of-accounts': 'accounting.chart-of-accounts.view',
    'accounting.trial-balance': 'accounting.chart-of-accounts.trial-balance.view',
    'accounting.pl': 'accounting.chart-of-accounts.profit-loss.view',
    'accounting.balance-sheet': 'accounting.chart-of-accounts.balance-sheet.view',
    'accounting.ledger': 'accounting.ledger.view',
    'accounting.journal-entries': 'accounting.journal-entries.view',
    'accounting.payments': 'accounting.payments.view',
    'accounting.receipts': 'accounting.payments.view',
    'accounting.activity': 'accounting.monitor.view',
    'accounting.commissions': 'accounting.commissions.view',
    'accounting.cash-bank': 'accounting.cash-bank.view',
    'accounting.transactions': 'accounting.transactions.view',
    'accounting.expenses': 'accounting.expenses.view',
    'accounting.advances': 'accounting.advances.view',
    'accounting.payroll': 'accounting.advances.view',
    'accounting.referral-commissions-rm': 'accounting.referral-commissions-rm.view',
    'accounting.corporate-ar': 'accounting.monitor.view',
    'accounting.bnpl-settlement': 'accounting.settlement.view',
};

export function adminViewPermissionForNav(parentPath, subPath) {
    if (!parentPath) return 'dashboard.view';
    if (parentPath === 'my-wallet') return null;
    if (subPath) {
        const nestedKey = `${parentPath}.${subPath}`;
        return ADMIN_NESTED_VIEW_PERMISSION[nestedKey] || `${nestedKey}.view`;
    }
    return ADMIN_TOP_VIEW_PERMISSION[parentPath] || `${parentPath}.view`;
}

export function canVisitAdminPath(pathname, { user, hasPermission }) {
    if (typeof hasPermission !== 'function') return false;

    const rest = String(pathname || '').replace(/^\/admin\/?/, '');
    const parts = rest.split('/').filter(Boolean);
    const [a, b] = parts;

    if (!a) return hasPermission('dashboard.view');
    if (a === 'my-wallet') return Boolean(user?.walletEnabled);

    // Approvals list + per-request screens (/admin/approvals/:entityType/:id?action=…)
    // share approvals.view. Per-type approve/reject is enforced on the page/API,
    // not by inventing nested codes like approvals.admin_wallet_expense_request.view.
    if (a === 'approvals') return hasPermission('approvals.view');

    if (a === 'marketing') return hasPermission('marketing.view');
    if (a === 'staff-app') return hasPermission('workshop.staff-app.overview.view');
    if (a === 'softpos-settlement') return hasPermission('softpos-settlement.view');
    if (a === 'permissions') return hasPermission('permissions.view');
    if (a === 'inventory') {
        return hasPermission(adminViewPermissionForNav('inventory', b || 'master-catalog'));
    }
    if (a === 'customers') {
        return hasPermission(adminViewPermissionForNav('customers', b || 'all-customers'));
    }
    if (a === 'sales') {
        const sub = b || 'workshop-sales';
        if (sub === 'advanced-reports') {
            return (
                hasPermission('sales.advanced-reports.view')
                || hasPermission('sales.sales-reports.view')
            );
        }
        return hasPermission(adminViewPermissionForNav('sales', sub));
    }
    if (a === 'accounting') {
        if (!b) {
            return (
                hasPermission('accounting.chart-of-accounts.view')
                || hasPermission('accounting.monitor.view')
                || hasPermission('accounting.hq.view')
            );
        }
        return hasPermission(adminViewPermissionForNav('accounting', b));
    }

    return hasPermission(adminViewPermissionForNav(a, b));
}
