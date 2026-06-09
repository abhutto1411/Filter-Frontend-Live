import {
    LayoutDashboard, Package, ShoppingCart, Warehouse, AlertTriangle, Users,
    FileText, CreditCard, DollarSign, BookOpen, Landmark, FileSpreadsheet,
    BadgeDollarSign, ArrowLeftRight, Receipt, UserPlus, Box, ClipboardList,
    Factory,
    UserCircle2,
    PieChart,
    Boxes,
} from 'lucide-react';

export const NAV_GROUPS = [
    { label: 'MAIN', items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]},
    { label: 'OPERATIONS', items: [
        { id: 'order_queue', label: 'Order Queue', icon: ShoppingCart },
        { id: 'catalog', label: 'Product Catalog', icon: Package },
        { id: 'stock', label: 'Stock Inventory', icon: Warehouse },
        { id: 'stock_alerts', label: 'Workshop Alerts', icon: AlertTriangle },
        { id: 'employees', label: 'Staff & Roles', icon: Users },
    ]},
    { label: 'STORAGE FACILITY', items: [
        { id: 'storage_facility', label: 'Storage brands', icon: Boxes },
    ]},
    { label: 'FINANCE', items: [
        { id: 'sales_invoices', label: 'Sales Invoices (AR)', icon: FileText },
        {
            id: 'affiliated_workshops',
            label: 'Affiliated Filter workshops',
            icon: Factory,
        },
        {
            id: 'nonaffiliated_customers',
            label: 'Non-affiliated customers / workshops',
            icon: UserCircle2,
        },
        { id: 'workshop_purchase_invoices', label: 'Workshop purchases', icon: ClipboardList },
        { id: 'purchase_invoices', label: 'Purchase Invoices (AP)', icon: ShoppingCart },
        { 
            id: 'accounting', 
            label: 'Accounting', 
            icon: Landmark,
            subItems: [
                { id: 'accounting_coa', label: 'Chart of Accounts', icon: FileSpreadsheet },
                { id: 'accounting_hub', label: 'Transaction Hub', icon: ArrowLeftRight },
                { id: 'accounting_logs_payments', label: 'Payments Log', icon: BadgeDollarSign },
                { id: 'accounting_logs_receipts', label: 'Receipts Log', icon: Receipt },
                { id: 'accounting_logs_journals', label: 'Journal Log', icon: FileText },
                { id: 'accounting_vat', label: 'VAT', icon: Receipt },
                { id: 'accounting_reports_tb', label: 'Trial Balance', icon: BookOpen },
                { id: 'accounting_reports_pl', label: 'Profit & Loss', icon: PieChart },
                { id: 'accounting_reports_bs', label: 'Balance Sheet', icon: FileSpreadsheet },
                { id: 'accounting_reports_cf', label: 'Cash Flow', icon: DollarSign },
            ]
        },
    ]},
];

export const MOCK_STOCK = [
    { id: 1, sku: 'LUB-001', name: 'Engine Oil — Full Synthetic 5W40', category: 'Lubricants', qty: 48, criticalLevel: 5, reorder: 20, unit: 'liter', price: 45 },
    { id: 2, sku: 'FLT-002', name: 'Oil Filter — Universal', category: 'Filters', qty: 6, criticalLevel: 3, reorder: 15, unit: 'pcs', price: 22 },
    { id: 3, sku: 'BRK-003', name: 'Brake Fluid DOT4', category: 'Fluids', qty: 24, criticalLevel: 5, reorder: 10, unit: 'liter', price: 28 },
    { id: 4, sku: 'TIR-004', name: 'Tire Sealant 500ml', category: 'Tires', qty: 3, criticalLevel: 2, reorder: 12, unit: 'pcs', price: 55 },
    { id: 5, sku: '-', name: 'Car Wash Normal - Small', category: 'Services', qty: 0, criticalLevel: 0, reorder: null, unit: 'service', price: 20 },
];

export const MOCK_STOCK_MOVEMENTS = [
    { id: 1, date: '2026-02-26', product: 'Full Oil Change Service', type: 'stock out', qty: 60, unit: 'service', before: 60, after: 0, reference: 'WS-143671', notes: '-' },
    { id: 2, date: '2026-02-26', product: 'Full Oil Change Service', type: 'stock out', qty: 60, unit: 'service', before: 0, after: 0, reference: 'WS-359394', notes: '-' },
    { id: 3, date: '2026-02-25', product: 'Mobil 1 Full Synthetic 5W-30', type: 'stock out', qty: 12, unit: 'liter', before: 200, after: 188, reference: 'WSI-747960', notes: '-' },
];

export const MOCK_ORDERS = [
    { id: 'ORD-2026-0142', branch: 'Main — Riyadh', items: 3, total: 'SAR 1,240', requested: '2026-03-10 09:12', status: 'pending_acceptance' },
    { id: 'ORD-2026-0138', branch: 'North — Jeddah', items: 1, total: 'SAR 450', requested: '2026-03-10 08:45', status: 'accepted' },
    { id: 'ORD-2026-0135', branch: 'East — Dammam', items: 5, total: 'SAR 3,200', requested: '2026-03-09 14:30', status: 'processing' },
    { id: 'ORD-2026-0132', branch: 'West — Yanbu', items: 2, total: 'SAR 890', requested: '2026-03-09 11:00', status: 'ready_to_dispatch' },
    { id: 'ORD-2026-0128', branch: 'South — Abha', items: 4, total: 'SAR 2,100', requested: '2026-03-08 16:20', status: 'dispatched' },
    { id: 'ORD-2026-0120', branch: 'Main — Riyadh', items: 1, total: 'SAR 320', requested: '2026-03-07 09:00', status: 'delivered' },
];

export const MOCK_ALERTS = [
    { id: 1, product: 'Oil Filter — Universal', branch: 'Main — Riyadh', current: 6, threshold: 15, severity: 'critical' },
    { id: 2, product: 'Tire Sealant 500ml', branch: 'East — Dammam', current: 3, threshold: 12, severity: 'critical' },
];

export const MOCK_SUPPLIER = { name: 'Gulf Warehouse — Riyadh', contact_person: 'Khalid Al-Otaibi', phone: '+966 55 123 4567', is_internal_warehouse: true };

export const MOCK_STAFF = [
    { id: 1, name: 'Ahmad Al-Rashid', role: 'Warehouse Manager', phone: '+966 55 111 2233', status: 'active' },
    { id: 2, name: 'Mohammed Hassan', role: 'Stock Controller', phone: '+966 55 444 5566', status: 'active' },
];

/** Branches this supplier/warehouse serves (for Profile) */
export const MOCK_SUPPLIER_BRANCHES = [
    { id: 'b1', name: 'Main — Riyadh', address: 'King Fahd Rd', status: 'active' },
    { id: 'b2', name: 'North — Jeddah', address: 'Al Madinah Rd', status: 'active' },
    { id: 'b3', name: 'East — Dammam', address: 'Prince Faisal St', status: 'active' },
];

/** Sidebar summary: AR total (workshops owe you) — used in SupplierLayout */
export const SUPPLIER_AR_SUMMARY = 48200;

/** Mock overdue AR (for dashboard alert when > 0) */
export const MOCK_OVERDUE_AR = 12500;

/** Promo/announcement banners for dashboard (reference pattern) */
export const PROMO_BANNERS = [
    { text: '📦 10% off on bulk orders above SAR 5,000 — Valid this month', gradient: 'linear-gradient(90deg, #2563EB, #1E40AF)' },
    { text: '🚚 Free delivery for orders above SAR 2,000 to Riyadh branches', gradient: 'linear-gradient(90deg, #059669, #047857)' },
    { text: '⚡ Priority dispatch for critical stock — Order now', gradient: 'linear-gradient(90deg, #D97706, #B45309)' },
];
