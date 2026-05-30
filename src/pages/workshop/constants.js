import {
    LayoutDashboard, Users, Layers, Package, ShoppingCart, ClipboardCheck,
    Truck, BarChart3, Building2, CheckCircle, CheckCircle2, PlayCircle,
    Store, Shield, Globe, Landmark, Banknote, Monitor, TicketPercent, Briefcase,
    Archive, Lock, Wallet
} from 'lucide-react';

export const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'workshop.dashboard.view' },
    { id: 'employees', label: 'Employees', icon: Users, permission: 'workshop.employees.view' },
    { id: 'departments', label: 'View Inventory and Departments', icon: Layers, permission: 'workshop.departments.view' },
    { id: 'catalog-new', label: 'Master Catalog', icon: Package, permission: 'workshop.catalog.view' },
    { id: 'inventory', label: 'Manage Inventory', icon: Archive, permission: 'workshop.inventory.view' },
    { id: 'purchases', label: 'Purchase Invoices', icon: ShoppingCart, permission: 'workshop.purchases.view' },
    { id: 'approvals', label: 'Approvals Queue', icon: ClipboardCheck, permission: 'workshop.approvals.view', badge: true },
    { id: 'suppliers', label: 'Suppliers & Purchases', icon: Truck, permission: 'workshop.suppliers.view' },
    { id: 'affiliated-suppliers', label: 'Filter Affiliated Suppliers', icon: Truck, permission: 'workshop.affiliated-suppliers.view' },
    { id: 'non-affiliated-suppliers', label: 'Non-Affiliated Suppliers', icon: Truck, permission: 'workshop.non-affiliated-suppliers.view' },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, permission: 'workshop.reports.view' },
    { id: 'pos-monitoring', label: 'POS Monitoring', icon: Monitor, permission: 'workshop.pos-monitoring.view' },

    // Added from main branch
    { id: 'locker-management', label: 'Locker Management', icon: Lock, permission: 'workshop.locker-management.view' },
    { id: 'my-petty-cash', label: 'My Petty Cash', icon: Wallet, permission: 'workshop.my-petty-cash.view' },

    { id: 'promo-codes', label: 'Promo Codes', icon: TicketPercent, permission: 'workshop.promo-codes.view' },
    { id: 'corporate-management', label: 'Corporate Management', icon: Briefcase, permission: 'workshop.corporate-management.view' },
    { id: 'commissions', label: 'Commissions', icon: Banknote, permission: 'workshop.commissions.view' },

    {
        id: 'accounting',
        label: 'Accounting',
        icon: Landmark,

        // Parent visible if any child permission exists
        subItems: [
            { id: 'acc-chart', label: 'Chart of Accounts', permission: 'workshop.accounting.chart-of-accounts.view' },
            { id: 'acc-cash', label: 'Cash & Bank', permission: 'workshop.accounting.cash-bank.view' },
            { id: 'acc-transactions', label: 'Transactions', permission: 'workshop.accounting.transactions.view' },
            { id: 'acc-journal', label: 'Journal Entries', permission: 'workshop.accounting.journal-entries.view' },
            { id: 'acc-expenses', label: 'Expenses', permission: 'workshop.accounting.expenses.view' },
            { id: 'acc-receipts', label: 'Receipts', permission: 'workshop.accounting.receipts.view' },
            { id: 'acc-payments', label: 'Payments', permission: 'workshop.accounting.payments.view' },
            { id: 'acc-advances', label: 'Advances', permission: 'workshop.accounting.advances.view' },

            // Added from main branch
            { id: 'acc-payroll', label: 'Payroll Run', permission: 'workshop.accounting.payroll.view' },
            { id: 'acc-approvals', label: 'Approval Limits', permission: 'workshop.accounting.approval-limits.view' },

            { id: 'acc-ledger', label: 'Ledger', permission: 'workshop.accounting.ledger.view' },
        ],
    },

    { id: 'branches', label: 'Branches & Access', icon: Building2, permission: 'workshop.branches.view' },
];


export const MOCK_BRANCHES = ['Petromin Services', 'Main Branch — Riyadh', 'North Branch — Jeddah', 'East Branch — Dammam'];
export const MOCK_BRANCHES_FULL = [
    { id: 'b1', name: 'Petromin Services', code: 'PM-001', address: 'Industrial Area, Riyadh', phone: '+966 11 234 5678', email: 'contact@petromin.com', vat_id: '300111222333001', cr_no: '1010111222', contact_person: 'Ahmed Al-Rashid', status: 'active' },
    { id: 'b2', name: 'Main Branch — Riyadh', code: 'RYD-001', address: 'King Fahd Rd, Riyadh', phone: '+966 11 456 7890', email: 'riyadh@filtercars.com', vat_id: '300111222333002', cr_no: '1010222333', contact_person: 'Ahmad Al-Rashid', status: 'active' },
    { id: 'b3', name: 'North Branch — Jeddah', code: 'JED-001', address: 'Al Madinah Rd, Jeddah', phone: '+966 12 345 6789', email: 'jeddah@filtercars.com', vat_id: '300111222333003', cr_no: '1010333444', contact_person: 'Mohammed Hassan', status: 'active' },
    { id: 'b4', name: 'East Branch — Dammam', code: 'DMM-001', address: 'Prince Faisal St, Dammam', phone: '+966 13 456 7890', email: 'dammam@filtercars.com', vat_id: '300111222333004', cr_no: '1010444555', contact_person: 'Khalid Ibrahim', status: 'active' },
];
export const MOCK_ROLE_PERMISSIONS = [
    { id: 1, role_name: 'branch_admin_b2', permissions: ['pos', 'employees', 'approvals', 'reports'], description: 'Branch Admin: Ahmad Al-Rashid (ahmad@filtercars.com) — Main Branch — Riyadh' },
    { id: 2, role_name: 'branch_admin_b3', permissions: ['pos', 'departments', 'suppliers'], description: 'Branch Admin: Mohammed Hassan (mohammed@filtercars.com) — North Branch — Jeddah' },
];

export const MOCK_EMPLOYEES = [
    { id: 1, name: 'Ahmad Al-Rashid', role: 'technician', branch: 'Main Branch — Riyadh', phone: '0551112233', email: 'ahmad@filtercars.com', status: 'active', workshop_duty: true, oncall_available: false, commission_percent: 10, basic_salary: 4500 },
    { id: 2, name: 'Mohammed Hassan', role: 'technician', branch: 'North Branch — Jeddah', phone: '0554445566', email: 'mohammed@filtercars.com', status: 'active', workshop_duty: false, oncall_available: true, commission_percent: 8, basic_salary: 4200 },
    { id: 3, name: 'Khalid Ibrahim', role: 'cashier', branch: 'Main Branch — Riyadh', phone: '0557778899', email: 'khalid@filtercars.com', status: 'active', workshop_duty: false, oncall_available: false, commission_percent: 0 },
    { id: 4, name: 'Omar Suleiman', role: 'technician', branch: 'East Branch — Dammam', phone: '0552223344', email: 'omar@filtercars.com', status: 'inactive', workshop_duty: false, oncall_available: false, commission_percent: 12, basic_salary: 5000 },
];

export const MOCK_DEPARTMENTS = [
    { id: 'd1', name: 'Lubrication', branch_id: 'b1', status: 'active' },
    { id: 'd2', name: 'Brakes', branch_id: 'b1', status: 'active' },
    { id: 'd3', name: 'Filters', branch_id: 'b1', status: 'active' },
    { id: 'd4', name: 'Tires', branch_id: 'b1', status: 'active' },
    { id: 'd5', name: 'Electrical', branch_id: 'b1', status: 'active' },
];

export const MOCK_PRODUCTS = [
    { id: 1, name: 'Engine Oil Change — Full Synthetic', dept: 'Lubrication', department_ids: ['d1'], type: 'service', sale_price: 180, purchase_price: 120, stock_qty: 48, critical_level: 20, reorder_level: 30, unit: 'piece', sku: 'LUB-001', category_id: 'c1' },
    { id: 2, name: 'Brake Pad Replacement (Front)', dept: 'Brakes', department_ids: ['d2'], type: 'service', sale_price: 350, purchase_price: 220, stock_qty: 6, critical_level: 10, reorder_level: 15, unit: 'piece', sku: 'BRK-002', category_id: 'c2' },
    { id: 3, name: 'Air Filter', dept: 'Filters', department_ids: ['d3'], type: 'product', sale_price: 75, purchase_price: 45, stock_qty: 30, critical_level: 15, reorder_level: 20, unit: 'piece', sku: 'FLT-003', category_id: 'c3' },
    { id: 4, name: 'Tire Rotation', dept: 'Tires', department_ids: ['d4'], type: 'service', sale_price: 120, purchase_price: 0, stock_qty: 999, critical_level: 0, reorder_level: 0, unit: 'service', sku: 'TIR-004', category_id: 'c4' },
    { id: 5, name: 'Battery Replacement', dept: 'Electrical', department_ids: ['d5'], type: 'service', sale_price: 420, purchase_price: 280, stock_qty: 7, critical_level: 5, reorder_level: 8, unit: 'piece', sku: 'ELC-005', category_id: 'c5' },
];

export const MOCK_CATEGORIES = [{ id: 'c1', name: 'Lubricants' }, { id: 'c2', name: 'Brake Parts' }, { id: 'c3', name: 'Filters' }, { id: 'c4', name: 'Tires' }, { id: 'c5', name: 'Electrical' }];
export const UNIT_OPTIONS = ['piece', 'liter', 'kg', 'box', 'carton', 'drum', 'service'];

export const MOCK_CATALOG_ITEMS = [
    { id: 1, product_name: 'Engine Oil 5W-30 Full Synthetic 4L', category: 'Lubricants', supplier_id: 's1', supplier_name: 'Gulf Lubricants Co.', sale_price: 85, unit: 'piece', min_order_qty: 1, stock_qty: 120, image_url: '', description: 'Premium full synthetic engine oil' },
    { id: 2, product_name: 'Brake Pads Set (Front)', category: 'Brake Parts', supplier_id: 's2', supplier_name: 'Al-Jazeera Auto Parts', sale_price: 220, unit: 'set', min_order_qty: 1, stock_qty: 24, image_url: '', description: '' },
    { id: 3, product_name: 'Oil Filter Universal', category: 'Filters', supplier_id: 's2', supplier_name: 'Al-Jazeera Auto Parts', sale_price: 22, unit: 'piece', min_order_qty: 2, stock_qty: 0, image_url: '', description: '' },
    { id: 4, product_name: 'Air Filter Cabin', category: 'Filters', supplier_id: 's2', supplier_name: 'Al-Jazeera Auto Parts', sale_price: 45, unit: 'piece', min_order_qty: 1, stock_qty: 18, image_url: '', description: '' },
    { id: 5, product_name: 'Car Battery 12V 60Ah', category: 'Electrical', supplier_id: 's3', supplier_name: 'Saudi Tire Trading', sale_price: 280, unit: 'piece', min_order_qty: 1, stock_qty: 12, image_url: '', description: '' },
    { id: 6, product_name: 'Coolant Concentrate 5L', category: 'Fluids', supplier_id: 's1', supplier_name: 'Gulf Lubricants Co.', sale_price: 65, unit: 'liter', min_order_qty: 1, stock_qty: 36, image_url: '', description: '' },
];
export const MOCK_SUPPLIERS_CATALOG = [
    { id: 's1', name: 'Gulf Lubricants Co.' },
    { id: 's2', name: 'Al-Jazeera Auto Parts' },
    { id: 's3', name: 'Saudi Tire Trading' },
];

export const PI_INVENTORY_ITEMS = [
    { id: 1, name: 'Engine Oil 5W-30 Full Synthetic 4L', price: 85, unit: 'piece', type: 'Stock' },
    { id: 2, name: 'Brake Pads Set (Front)', price: 220, unit: 'set', type: 'Stock' },
    { id: 3, name: 'Oil Filter Universal', price: 22, unit: 'piece', type: 'Stock' },
    { id: 4, name: 'Air Filter Cabin', price: 45, unit: 'piece', type: 'Stock' },
    { id: 5, name: 'Car Battery 12V 60Ah', price: 280, unit: 'piece', type: 'Stock' },
    { id: 6, name: 'Coolant Concentrate 5L', price: 65, unit: 'liter', type: 'Stock' },
    { id: 7, name: 'Oil Change Service', price: 120, unit: 'service', type: 'Service' },
    { id: 8, name: 'Brake Pad Replacement', price: 350, unit: 'service', type: 'Service' },
];
export const PI_ACCOUNT_OPTIONS = [
    { code: '5100', name: 'Cost of Goods Sold' },
    { code: '6100', name: 'Rent Expense' },
    { code: '6200', name: 'Utilities Expense' },
    { code: '1410', name: 'Inventory Asset' },
    { code: '4100', name: 'Sales Revenue' },
];
export const PI_TAXES = [
    { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
    { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
];

export const MOCK_APPROVALS_PENDING = [
    { id: 1, approval_type: 'purchase', amount: 3200, submitted_by_name: 'Ahmad Al-Rashid', created_date: '2026-03-10T09:15:00', description: 'Purchase Request — Castrol Engine Oil (×20 L)' },
    { id: 2, approval_type: 'advance', amount: 1500, submitted_by_name: 'Mohammed Hassan', created_date: '2026-03-09T14:30:00', description: 'Advance request for travel' },
    { id: 3, approval_type: 'expense', amount: 450, submitted_by_name: 'Khalid Ibrahim', created_date: '2026-03-08T11:45:00', description: 'Office Supplies - Stationary' },
];

export const MOCK_SUPPLIERS = [
    { id: 1, name: 'Al-Jazeera Auto Parts', category: 'Parts', vatId: '300123456789001', crNumber: '1010123456', contactPerson: 'Faisal Al-Zahrani', phone: '+966 12 345 6789', email: 'orders@aljazeera.com', address: 'Industrial Area, Riyadh', bankName: 'Al Rajhi Bank', bankIban: 'SA1234567890123456789012', status: 'active' },
    { id: 2, name: 'Gulf Lubricants Co.', category: 'Lubricants', vatId: '300123456789002', crNumber: '1010987654', contactPerson: 'Ahmed Mansour', phone: '+966 12 987 6543', email: 'sales@gulflubricants.com', address: 'Dammam Port', bankName: 'SNB', bankIban: 'SA9876543210987654321098', status: 'active' },
    { id: 3, name: 'Saudi Tire Trading', category: 'Tires', vatId: '300123456789003', crNumber: '1010555555', contactPerson: 'Omar Abdullah', phone: '+966 11 456 7890', email: 'info@sauditire.com', address: 'Jeddah Industrial', bankName: 'Al Rajhi Bank', bankIban: 'SA1122334455667788990011', status: 'active' },
];

export const MOCK_ORDERS = [
    { id: 1, order_number: 'ORD-2026-0142', customer_name: 'Safa Al-Makkah Corp', vehicle_plate: 'ABC 1234', department_name: 'Brakes', grand_total: 850, commission_amount: 85, workflow_status: 'assigned_pending_acceptance', items: [{ product_name: 'Brake Pad Replacement', quantity: 1, total: 850 }] },
    { id: 2, order_number: 'ORD-2026-0138', customer_name: 'Walk-in', vehicle_plate: 'XYZ 5678', department_name: 'Lubrication', grand_total: 320, commission_amount: 32, workflow_status: 'task_in_progress', items: [{ product_name: 'Engine Oil Change', quantity: 1, total: 180 }, { product_name: 'Air Filter', quantity: 1, total: 75 }, { product_name: 'Tire Rotation', quantity: 1, total: 65 }] },
];

export const WORKFLOW_CONFIG = {
    assigned_pending_acceptance: { label: 'Assigned — Waiting Acceptance', badgeClass: 'ws-badge--yellow', action: { label: 'Accept Order', icon: CheckCircle2, btnClass: 'ws-workflow-btn--accept', next: 'accepted_by_technician' } },
    accepted_by_technician:      { label: 'Accepted — Ready to Start', badgeClass: 'ws-badge--blue', action: { label: 'Start Task', icon: PlayCircle, btnClass: 'ws-workflow-btn--start', next: 'task_in_progress' } },
    task_in_progress:             { label: 'Task In-Progress', badgeClass: 'ws-badge--purple', action: { label: 'Mark Task Completed', icon: CheckCircle2, btnClass: 'ws-workflow-btn--complete', next: 'task_completed_by_technician' } },
    task_completed_by_technician: { label: 'Completed — Awaiting Cashier', badgeClass: 'ws-badge--green', action: null },
    invoice_generated:            { label: 'Invoice Generated ✓', badgeClass: 'ws-badge--gray', action: null },
};

export const BORDER_MAP = { assigned_pending_acceptance: 'ws-border-yellow', accepted_by_technician: 'ws-border-blue', task_in_progress: 'ws-border-purple', task_completed_by_technician: 'ws-border-green', invoice_generated: 'ws-border-gray' };

export const ROLE_OPTIONS = [
    'cashier',
    'staff',
    'technician',
    'supervisor',
    'manager',
    'team_leader',
    // Locker portal users — workshop-wide (no branch), auto-approved, sign in
    // via /locker/login. Created from the same Employees form.
    'locker_supervisor',
    'locker_collector',
];

// commissionType is a free-form string on the BE, but the FE sends a fixed
// vocabulary. Each option carries a `label` for display and a `value` for the
// API payload. Helpers below normalize legacy display labels into the new
// canonical values so existing rows keep working when prefilled.
export const COMMISSION_TYPE_OPTIONS = [
    { value: 'percent_of_revenue', label: '% of Revenue' },
    { value: 'percent_of_service', label: '% of Service' },
    { value: 'percent_of_profit',  label: '% of Profit' },
    { value: 'fixed',              label: 'Fixed per Order' },
];

const COMMISSION_TYPE_LEGACY_MAP = {
    '% of revenue': 'percent_of_revenue',
    '% of service': 'percent_of_service',
    '% of profit': 'percent_of_profit',
    'fixed per order': 'fixed',
    fixed: 'fixed',
    revenue: 'percent_of_revenue',
    service: 'percent_of_service',
    profit: 'percent_of_profit',
};

export function normalizeCommissionType(raw) {
    if (!raw) return 'percent_of_revenue';
    const s = String(raw).trim();
    if (!s) return 'percent_of_revenue';
    const lower = s.toLowerCase();
    return COMMISSION_TYPE_LEGACY_MAP[lower] || s;
}

export const MOCK_BRANCHES_REPORTS = [{ id: 'b1', name: 'Petromin Services' }, { id: 'b2', name: 'Main Branch — Riyadh' }, { id: 'b3', name: 'North Branch — Jeddah' }];
export const MOCK_SALES_BY_BRANCH = [
    { branch: 'Petromin Services', total: 45800, count: 142 },
    { branch: 'Main Branch — Riyadh', total: 52100, count: 168 },
    { branch: 'North Branch — Jeddah', total: 34900, count: 112 },
];
export const MOCK_APPROVALS_HIST = [
    { id: 1, approval_type: 'purchase', amount: 3200, submitted_by_name: 'Ahmad Al-Rashid', created_date: '2026-03-10T09:15:00', status: 'pending' },
    { id: 2, approval_type: 'advance', amount: 1500, submitted_by_name: 'Mohammed Hassan', created_date: '2026-03-09T14:30:00', status: 'pending' },
    { id: 3, approval_type: 'expense', amount: 450, submitted_by_name: 'Khalid Ibrahim', created_date: '2026-03-08T11:45:00', status: 'pending' },
    { id: 101, approval_type: 'purchase', amount: 4200, submitted_by_name: 'warehouse_mgr', created_date: '2026-03-07', status: 'approved' },
    { id: 201, approval_type: 'expense', amount: 320, submitted_by_name: 'sales_rep', created_date: '2026-03-06', status: 'rejected' },
];
export const MOCK_EXPENSES = [
    { id: 1, category: 'Stationary', total_amount: 450, description: 'Office supplies', status: 'approved', expense_date: '2026-03-08' },
    { id: 2, category: 'Utilities', total_amount: 1200, description: 'Monthly electricity', status: 'pending', expense_date: '2026-03-07' },
];

export const BRANCH_PERMISSIONS = [
    { key: 'pos', label: 'POS / Sales', icon: Store },
    { key: 'employees', label: 'Employee Management', icon: Users },
    { key: 'departments', label: 'Dept & Products', icon: Building2 },
    { key: 'approvals', label: 'Approvals Queue', icon: CheckCircle },
    { key: 'suppliers', label: 'Suppliers & Purchases', icon: Shield },
    { key: 'reports', label: 'Reports & Analytics', icon: Globe },
];

export const MOCK_SUPPLIER_REPORTS = [
    { supplier: 'Al-Jazeera Auto Parts', volume: 14500, expenses: 8000, pending: 2500, status: 'Active' },
    { supplier: 'Gulf Lubricants Co.', volume: 22000, expenses: 15000, pending: 0, status: 'Active' },
    { supplier: 'Saudi Tire Trading', volume: 45000, expenses: 32000, pending: 12000, status: 'Active' }
];

export const MOCK_TECHNICIAN_REPORTS = [
    { name: 'Ahmad Al-Rashid', branch: 'Main Branch — Riyadh', jobs: 42, revenue: 12500, efficiency: '95%' },
    { name: 'Mohammed Hassan', branch: 'North Branch — Jeddah', jobs: 38, revenue: 11200, efficiency: '88%' },
    { name: 'Omar Suleiman', branch: 'East Branch — Dammam', jobs: 25, revenue: 8400, efficiency: '91%' }
];

export const MOCK_PRODUCT_SALES_REPORTS = [
    { product: 'Engine Oil 5W-30', category: 'Lubricants', qty_sold: 145, revenue: 12325 },
    { product: 'Brake Pads Set (Front)', category: 'Brake Parts', qty_sold: 84, revenue: 18480 },
    { product: 'Car Battery 12V 60Ah', category: 'Electrical', qty_sold: 32, revenue: 8960 },
    { product: 'Air Filter Cabin', category: 'Filters', qty_sold: 112, revenue: 5040 }
];
