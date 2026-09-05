/** Storage brand portal permission keys (must match backend). */
export const SF_PERMISSIONS = [
    { key: 'products.view', label: 'View products & stock' },
    { key: 'products.manage', label: 'Add / edit products' },
    { key: 'movements.record', label: 'Record stock movements' },
    { key: 'transfers.create', label: 'Stock transfers' },
    { key: 'invoices.create', label: 'Create & post invoices' },
    { key: 'customers.manage', label: 'Customers (AR)' },
    { key: 'suppliers.manage', label: 'Suppliers (AP)' },
    { key: 'locations.manage', label: 'Inventory locations' },
    { key: 'sales.view', label: 'View sales' },
    { key: 'sales_reps.manage', label: 'Sales representatives' },
    { key: 'accounting.hub', label: 'Transaction hub (payments / receipts / journal)' },
    { key: 'accounting.accounts', label: 'Account categories & chart' },
    { key: 'accounting.cash_bank', label: 'Cash & bank registers' },
    { key: 'accounting.logs', label: 'Accounting logs' },
];

export const SF_DEFAULT_OPERATOR_PERMISSIONS = SF_PERMISSIONS.map((p) => p.key);

export const SF_ADMIN_PERMISSIONS = [...SF_DEFAULT_OPERATOR_PERMISSIONS];
