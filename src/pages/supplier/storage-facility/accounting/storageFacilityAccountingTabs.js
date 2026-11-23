/** Shared accounting tab order for storage brand hub + shell. */
export const STORAGE_BRAND_ACCOUNTING_TABS = [
    { id: 'acct_accounts', label: 'Account categories' },
    { id: 'acct_cash', label: 'Cash & Bank' },
    { id: 'acct_hub', label: 'Transaction Hub' },
    { id: 'acct_log_pay', label: 'Payments log' },
    { id: 'acct_log_rcpt', label: 'Receipts log' },
    { id: 'acct_log_je', label: 'Journal log' },
    { id: '_reports_divider', type: 'divider' },
    { id: 'acct_tb', label: 'Trial balance' },
    { id: 'acct_pl', label: 'Income statement' },
    { id: 'acct_bs', label: 'Balance sheet' },
];

export function isStorageAccountingTab(id) {
    return STORAGE_BRAND_ACCOUNTING_TABS.some((t) => t.id === id);
}
