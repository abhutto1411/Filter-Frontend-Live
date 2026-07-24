/** Staff App Management — inner nav (single unified section for Flutter app admin). */
export const STAFF_APP_TAB_SLUG = {
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

/** Legacy staff-app slugs → restored top-level workshop routes */
export const STAFF_APP_LEGACY_ROUTE_REDIRECTS = {
    users: '/workshop/employees',
    approvals: '/workshop/approvals',
    wallets: '/workshop/my-petty-cash',
    'approval-limits': '/workshop/accounting/approvals',
};

export const STAFF_APP_SLUG_TO_TAB = Object.fromEntries(
    Object.entries(STAFF_APP_TAB_SLUG).map(([tab, slug]) => [slug, tab]),
);

export const STAFF_APP_NAV_ITEMS = [
    { id: 'sap-overview', label: 'Overview', permission: 'workshop.staff-app.overview.view' },
    { id: 'sap-expenses', label: 'Expenses', permission: 'workshop.staff-app.expenses.view' },
    { id: 'sap-requests', label: 'Requests', permission: 'workshop.staff-app.requests.view' },
    { id: 'sap-purchase-orders', label: 'Purchase Orders', permission: 'workshop.staff-app.purchase-orders.view' },
    { id: 'sap-tasks', label: 'Tasks', permission: 'workshop.staff-app.tasks.view' },
    { id: 'sap-leave', label: 'Leave', permission: 'workshop.staff-app.leave.view' },
    { id: 'sap-salary-advances', label: 'Salary & Advances', permission: 'workshop.staff-app.salary-advances.view' },
    { id: 'sap-chat', label: 'Chat', permission: 'workshop.staff-app.chat.view' },
    { id: 'sap-notifications', label: 'Notifications', permission: 'workshop.staff-app.notifications.view' },
    { id: 'sap-settings', label: 'App Settings', permission: 'workshop.staff-app.settings.view' },
];

/** Legacy permission codes still grant access when staff-app codes are not seeded yet. */
export const STAFF_APP_PERMISSION_FALLBACK = {
    'sap-overview': ['workshop.staff-app.overview.view', 'workshop.approvals.view', 'workshop.my-petty-cash.view'],
    'sap-expenses': ['workshop.staff-app.expenses.view', 'workshop.accounting.expenses.view', 'workshop.approvals.expense.view'],
    'sap-requests': ['workshop.staff-app.requests.view'],
    'sap-purchase-orders': ['workshop.staff-app.purchase-orders.view', 'workshop.purchases.view'],
    'sap-tasks': ['workshop.staff-app.tasks.view'],
    'sap-leave': ['workshop.staff-app.leave.view'],
    'sap-salary-advances': ['workshop.staff-app.salary-advances.view', 'workshop.accounting.advances.view'],
    'sap-chat': ['workshop.staff-app.chat.view'],
    'sap-notifications': ['workshop.staff-app.notifications.view'],
    'sap-settings': ['workshop.staff-app.settings.view'],
};
