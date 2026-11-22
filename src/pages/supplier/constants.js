import {
    LayoutDashboard, Package, ShoppingCart, Warehouse, Users,
    FileText, BookOpen, Landmark, FileSpreadsheet,
    Receipt, ClipboardList,
    Factory,
    UserCircle2,
    PieChart,
    Boxes,
    MessageCircle,
    RotateCcw,
    Settings,
    Scale,
    Wallet,
} from 'lucide-react';

export const NAV_GROUPS = [
    { label: 'MAIN', items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'platform-chat', label: 'Chat', icon: MessageCircle },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'employees', label: 'Staff & Roles', icon: Users },
        { id: 'staff_app', label: 'Staff App Management', icon: UserCircle2 },
    ]},
    { label: 'OPERATIONS', items: [
        { id: 'catalog', label: 'Inbound', icon: Package },
        { id: 'stock', label: 'Stock', icon: Warehouse },
        { id: 'order_queue', label: 'Outbound', icon: ShoppingCart },
        { id: 'stock_alerts', label: 'Counts', icon: ClipboardList },
    ]},
    { label: 'STORAGE FACILITY', items: [
        { id: 'storage_facility', label: 'Storage facility (not warehouse)', icon: Boxes },
    ]},
    { label: 'SALES', items: [
        { id: 'affiliated_workshops', label: 'Affiliated Filter workshops', icon: Factory },
        { id: 'nonaffiliated_customers', label: 'Non-affiliated customers / workshops', icon: UserCircle2 },
        { id: 'sales_quotes', label: 'Sales Quotes', icon: ClipboardList },
        { id: 'sales_invoices', label: 'Sales Invoices', icon: FileText },
        { id: 'sales_returns', label: 'Sales Returns', icon: Receipt },
    ]},
    { label: 'PURCHASES', items: [
        { id: 'purchase_invoices', label: 'Purchase Invoices', icon: ShoppingCart },
        { id: 'debit_notes', label: 'Debit Notes', icon: RotateCcw },
        { id: 'workshop_purchase_invoices', label: 'Workshop purchases', icon: ClipboardList },
    ]},
    { label: 'CASH', items: [
        { id: 'cash_accounts', label: 'Bank and Cash Accounts', icon: Landmark },
        { id: 'receipts', label: 'Receipts', icon: Receipt },
        { id: 'payments', label: 'Payments', icon: Landmark },
        // SP-21: single Expenses entry (SupplierExpenses; legacy accounting/expenses redirects here)
        { id: 'expenses', label: 'Expenses', icon: Wallet },
    ]},
    { label: 'ACCOUNTING', items: [
        {
            id: 'accounting',
            label: 'Accounting',
            icon: BookOpen,
            subItems: [
                { id: 'accounting_coa', label: 'Chart of Accounts', icon: FileSpreadsheet },
                { id: 'accounting_journals', label: 'Journal Entries', icon: FileText },
                { id: 'accounting_vat', label: 'VAT', icon: Receipt },
                { id: 'accounting_reports_tb', label: 'Trial Balance', icon: BookOpen },
                { id: 'accounting_reports_pl', label: 'Profit & Loss', icon: PieChart },
                { id: 'accounting_reports_bs', label: 'Balance Sheet', icon: FileSpreadsheet },
                { id: 'accounting_reports_cf', label: 'Cash Flow', icon: Landmark },
                { id: 'accounting_reports_ar_ap', label: 'AR – AP', icon: Scale },
            ],
        },
    ]},
];

