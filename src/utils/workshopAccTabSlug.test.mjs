import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WORKSHOP_ACC_TAB_SLUG, workshopAccountingPath } from './workshopAccTabSlug.js';

/** Mirrors `NAV_ITEMS` Accounting subItems in `pages/workshop/constants.js`. */
const ACCOUNTING_TAB_IDS = [
  'acc-books-health',
  'acc-settings',
  'acc-roles',
  'acc-chart',
  'acc-profit-loss',
  'acc-balance-sheet',
  'acc-trial-balance',
  'acc-period-closings',
  'acc-cash',
  'acc-ledger',
  'acc-vat',
  'acc-cashier-variance',
  'acc-suppliers',
  'acc-noncash',
  'acc-platform-expenses',
  'acc-transactions',
  'acc-journal',
  'acc-audit-log',
  'acc-receipts',
  'acc-payments',
  'acc-expense-purposes',
  'acc-petty-wallets',
  'acc-expenses',
  'acc-locker-cit',
  'acc-advances',
  'acc-approvals',
];

const EXPECTED_SLUG = {
  'acc-books-health': 'books-health',
  'acc-settings': 'settings',
  'acc-roles': 'roles-access',
  'acc-chart': 'chart-of-accounts',
  'acc-profit-loss': 'profit-loss',
  'acc-balance-sheet': 'balance-sheet',
  'acc-trial-balance': 'trial-balance',
  'acc-period-closings': 'period-closings',
  'acc-cash': 'cash-bank',
  'acc-ledger': 'ledger',
  'acc-vat': 'vat',
  'acc-cashier-variance': 'cashier-variance',
  'acc-suppliers': 'suppliers',
  'acc-noncash': 'noncash-purchases',
  'acc-platform-expenses': 'platform-expenses',
  'acc-transactions': 'transactions',
  'acc-journal': 'journal-entries',
  'acc-audit-log': 'audit-log',
  'acc-receipts': 'receipts',
  'acc-payments': 'payments',
  'acc-expense-purposes': 'expense-purposes',
  'acc-petty-wallets': 'petty-cash',
  'acc-expenses': 'expenses',
  'acc-locker-cit': 'locker-cash-in-transit',
  'acc-advances': 'advances',
  'acc-approvals': 'approvals',
};

/** Permission codes used by those sidebar entries (constants.js). */
const EXPECTED_PERMISSION = {
  'acc-books-health': 'workshop.accounting.chart-of-accounts.view',
  'acc-settings': 'workshop.accounting.chart-of-accounts.view',
  'acc-roles': 'workshop.branches.view',
  'acc-chart': 'workshop.accounting.chart-of-accounts.view',
  'acc-profit-loss': 'workshop.accounting.chart-of-accounts.view',
  'acc-balance-sheet': 'workshop.accounting.chart-of-accounts.view',
  'acc-trial-balance': 'workshop.accounting.chart-of-accounts.view',
  'acc-period-closings': 'workshop.accounting.chart-of-accounts.view',
  'acc-cash': 'workshop.accounting.cash-bank.view',
  'acc-ledger': 'workshop.accounting.ledger.view',
  'acc-vat': 'workshop.accounting.ledger.view',
  'acc-cashier-variance': 'workshop.pos-monitoring.view',
  'acc-suppliers': 'workshop.suppliers.view',
  'acc-noncash': 'workshop.approvals.view',
  'acc-platform-expenses': 'workshop.accounting.transactions.view',
  'acc-transactions': 'workshop.accounting.transactions.view',
  'acc-journal': 'workshop.accounting.journal-entries.view',
  'acc-audit-log': 'workshop.logs.view',
  'acc-receipts': 'workshop.accounting.receipts.view',
  'acc-payments': 'workshop.accounting.payments.view',
  'acc-expense-purposes': 'workshop.accounting.expenses.view',
  'acc-petty-wallets': 'workshop.accounting.expenses.view',
  'acc-expenses': 'workshop.accounting.expenses.view',
  'acc-locker-cit': 'workshop.locker-management.view',
  'acc-advances': 'workshop.accounting.advances.view',
  'acc-approvals': 'workshop.accounting.approval-limits.view',
};

describe('WORKSHOP_ACC_TAB_SLUG', () => {
  it('resolves all accounting tab ids including locker CIT', () => {
    assert.ok(ACCOUNTING_TAB_IDS.length >= 15);
    for (const id of ACCOUNTING_TAB_IDS) {
      assert.equal(WORKSHOP_ACC_TAB_SLUG[id], EXPECTED_SLUG[id], id);
      assert.equal(
        workshopAccountingPath(id),
        `/workshop/accounting/${EXPECTED_SLUG[id]}`,
        id,
      );
      assert.ok(EXPECTED_PERMISSION[id], `permission mapping for ${id}`);
    }
    assert.equal(Object.keys(WORKSHOP_ACC_TAB_SLUG).length, ACCOUNTING_TAB_IDS.length);
  });
});
