/**
 * Workshop Accounting sidebar tab id → URL slug under `/workshop/accounting/`.
 * Kept free of React / lucide so node --test can import it.
 */
export const WORKSHOP_ACC_TAB_SLUG = {
  'acc-books-health': 'books-health',
  'acc-settings': 'settings',
  'acc-roles': 'roles-access',
  'acc-chart': 'chart-of-accounts',
  'acc-profit-loss': 'profit-loss',
  'acc-balance-sheet': 'balance-sheet',
  'acc-trial-balance': 'trial-balance',
  'acc-period-closings': 'period-closings',
  'acc-cash': 'cash-bank',
  'acc-transactions': 'transactions',
  'acc-journal': 'journal-entries',
  'acc-audit-log': 'audit-log',
  'acc-expenses': 'expenses',
  'acc-receipts': 'receipts',
  'acc-payments': 'payments',
  'acc-locker-cit': 'locker-cash-in-transit',
  'acc-advances': 'advances',
  'acc-approvals': 'approvals',
  'acc-ledger': 'ledger',
  'acc-vat': 'vat',
  'acc-cashier-variance': 'cashier-variance',
  'acc-suppliers': 'suppliers',
  'acc-noncash': 'noncash-purchases',
  'acc-platform-expenses': 'platform-expenses',
  'acc-expense-purposes': 'expense-purposes',
  'acc-petty-wallets': 'petty-cash',
};

/** `/workshop/accounting/<slug>` for an `acc-*` tab id. */
export function workshopAccountingPath(tabId) {
  const slug = WORKSHOP_ACC_TAB_SLUG[tabId] || 'cash-bank';
  return `/workshop/accounting/${slug}`;
}
