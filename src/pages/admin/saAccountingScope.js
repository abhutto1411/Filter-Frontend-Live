export const SA_ACCOUNTING_SCOPE_KEY = 'sa-accounting-scope-v1';

export const HQ_WORKSHOP_TABS = [
    { path: 'cash-bank', label: 'Cash & Bank' },
    { path: 'transactions', label: 'Transactions' },
    { path: 'journal-entries', label: 'Journal Entries' },
    { path: 'expenses', label: 'Expenses' },
    { path: 'receipts', label: 'Receipts' },
    { path: 'payments', label: 'Payments' },
    { path: 'advances', label: 'Advances' },
    { path: 'payroll', label: 'Payroll Run' },
    { path: 'ledger', label: 'Ledger' },
];

/** HQ books: financial reports + full workshop accounting (editable). */
export const HQ_ACCOUNTING_TABS = [
    { path: 'chart-of-accounts', label: 'Chart of Accounts' },
    { path: 'trial-balance', label: 'Trial Balance' },
    { path: 'pl', label: 'Profit & Loss' },
    { path: 'balance-sheet', label: 'Balance Sheet' },
    { path: 'cash-bank', label: 'Cash & Bank' },
    { path: 'transactions', label: 'Transactions' },
    { path: 'journal-entries', label: 'Journal Entries' },
    { path: 'expenses', label: 'Expenses' },
    { path: 'receipts', label: 'Receipts' },
    { path: 'payments', label: 'Payments' },
    { path: 'advances', label: 'Advances' },
    { path: 'payroll', label: 'Payroll Run' },
    { path: 'ledger', label: 'Ledger' },
    { path: 'activity', label: 'Activity Log' },
    { path: 'commissions', label: 'Referral Commission' },
];

export const HQ_WORKSHOP_PAGE_TABS = new Set([
    'cash-bank',
    'transactions',
    'journal-entries',
    'expenses',
    'receipts',
    'payments',
    'advances',
    'payroll',
    'ledger',
]);

/** HQ financial reports + activity — need hqBooks scope on API calls. */
export const HQ_FINANCIAL_REPORT_TABS = new Set([
    'trial-balance',
    'pl',
    'balance-sheet',
    'activity',
]);

export function loadSaAccountingScope() {
    try {
        const raw = sessionStorage.getItem(SA_ACCOUNTING_SCOPE_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        /* ignore */
    }
    return { type: 'workshop', workshopId: '', branchId: '', supplierId: '', hqWorkshopId: '' };
}

export function isHqAccountingScope(scope) {
    return scope?.type === 'hq';
}
