import { 
    LayoutDashboard, Users, History, DollarSign, Wallet, 
    Settings, PieChart, FileText, BookOpen, UserCircle, 
    TrendingUp, Clock, CheckCircle, UserPlus, History as HistoryIcon,
    FileSpreadsheet, CreditCard
} from 'lucide-react';

export const MOCK_USER = {
    name: "Mohammed Al-Rashidi",
    id: "FR-001",
    category: "FRANCHISE",
    avatar: "MA",
    email: "mohammed@example.com"
};

export const RM_NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'referrers', label: 'Referrers', icon: Users },
    { id: 'referrals', label: 'Referrals', icon: History },
    { id: 'commissions', label: 'Commissions', icon: DollarSign },
    { id: 'payouts', label: 'Payouts', icon: Wallet },
];

export const ACCOUNTING_ITEMS = [
    { id: 'coa', label: 'Chart of Accounts', icon: FileSpreadsheet },
    { id: 'journal_entries', label: 'Journal Entries', icon: FileText },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
];

export const SYSTEM_ITEMS = [
    { id: 'settings', label: 'Settings', icon: Settings },
];

export const MOCK_STATS = {
    activeReferrers: 3,
    totalReferrals: 4,
    pendingReview: 2,
    commissionExpense: 0,
    outstandingPayable: 2750
};

export const MOCK_REFERRALS = [
    { id: 'rfl-1', customerName: 'Alice Johnson', phone: '+111111111', referrer: 'AutoMax Franchise', serviceType: 'Full Service', amount: 5000, status: 'Approved', commission: 500, commStatus: 'matured' },
    { id: 'rfl-2', customerName: 'Bob Smith', phone: '+222222222', referrer: 'Heet Corp Ltd', serviceType: 'Oil Change', amount: 1500, status: 'Approved', commission: 200, commStatus: 'paid' },
    { id: 'rfl-3', customerName: 'Carol Davis', phone: '+333333333', referrer: 'AutoMax Franchise', serviceType: 'Brake Service', amount: 3000, status: 'Under Review', commission: null, commStatus: null },
    { id: 'rfl-4', customerName: 'David Lee', phone: '+444444444', referrer: 'James Wilson', serviceType: 'Tire Replacement', amount: 2000, status: 'Submitted', commission: null, commStatus: null },
];

export const MOCK_REFERRERS = [
    { id: 'FR-001', name: 'AutoMax Franchise', email: 'automax@example.com', type: 'Franchise', commission: '10%', earned: 2500, paid: 1500, available: 1000, status: 'Active' },
    { id: 'CR-001', name: 'Fleet Corp Ltd', email: 'fleet@example.com', type: 'Corporate', commission: '$200', earned: 1000, paid: 200, available: 800, status: 'Active' },
    { id: 'IR-001', name: 'James Wilson', email: 'james@example.com', type: 'Individual', commission: '5%', earned: 750, paid: 500, available: 250, status: 'Active' },
];

export const MOCK_JOURNAL_ENTRIES = [
    { id: 'je-1', label: 'Commission for referral rfl-1 - AutoMax Franchise', date: '2025-03-12', dr: 500, cr: 500 },
    { id: 'je-2', label: 'Commission for referral rfl-2 - Fleet Corp Ltd', date: '2025-03-10', dr: 200, cr: 200 },
];

export const MOCK_COMMISSIONS = [
    { id: 'rfl-1', referral: 'rfl-1', referrer: 'AutoMax Franchise', service: 'Full Service', serviceAmt: 5000, commission: 500, status: 'Matured', date: '2025-03-12' },
    { id: 'rfl-2', referral: 'rfl-2', referrer: 'Fleet Corp Ltd', service: 'Oil Change', serviceAmt: 1500, commission: 200, status: 'Paid', date: '2025-03-10' },
];


export const MOCK_PAYOUTS = [];

export const MOCK_ACCOUNTS = {
    assets: [
        { code: '1010', name: 'Cash', system: true, balance: 100000 },
        { code: '1020', name: 'Bank Account', system: true, balance: 500000 },
        { code: '1030', name: 'POS / Payment Gateway', system: true, balance: 500000 },
    ],
    liabilities: [
        { code: '2110', name: 'Commission Payable - AutoMax Franchise', system: false, balance: 1500 },
        { code: '2111', name: 'Commission Payable - Fleet Corp Ltd', system: false, balance: 1000 },
        { code: '2112', name: 'Commission Payable - James Wilson', system: false, balance: 250 },
    ],
    expenses: [
        { code: '5100', name: 'Referrer Commission Expense', system: true, balance: 0 },
    ]
};

export const MOCK_JOURNAL_DETAILED = [
    {
        id: 'je-1', date: '2025-03-12', ref: 'rfl-1',
        description: 'Commission for referral rfl-1 - AutoMax Franchise',
        lines: [
            { account: 'Referrer Commission Expense', dr: 500, cr: 0 },
            { account: 'Commission Payable - AutoMax Franchise', dr: 0, cr: 500 },
        ]
    },
    {
        id: 'je-2', date: '2025-03-10', ref: 'rfl-2',
        description: 'Commission for referral rfl-2 - Fleet Corp Ltd',
        lines: [
            { account: 'Referrer Commission Expense', dr: 200, cr: 0 },
            { account: 'Commission Payable - Fleet Corp Ltd', dr: 0, cr: 200 },
        ]
    }
];

export const MOCK_LEDGER = [
    { date: '2025-03-12', account: 'Referrer Commission Expense', ref: 'rfl-1', narration: 'Commission for referral rfl-1', dr: 500, cr: 0, balance: 500 },
    { date: '2025-03-12', account: 'Commission Payable - AutoMax Franchise', ref: 'rfl-1', narration: 'Commission for referral rfl-1', dr: 0, cr: 500, balance: 500 },
    { date: '2025-03-10', account: 'Referrer Commission Expense', ref: 'rfl-2', narration: 'Commission for referral rfl-2', dr: 200, cr: 0, balance: 700 },
    { date: '2025-03-10', account: 'Commission Payable - Fleet Corp Ltd', ref: 'rfl-2', narration: 'Commission for referral rfl-2', dr: 0, cr: 200, balance: 200 },
];
