import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mapAccessColumn,
  mapEmployeeToAccessRow,
  buildRolesAccessSummary,
  filterAccessRows,
  slicePage,
  hasAnyAccountingAccess,
  RECONCILE_CODES,
} from './accountingRolesAccessDisplay.js';

describe('accountingRolesAccessDisplay (P-A10C)', () => {
  it('RECONCILE_CODES are the two known codes', () => {
    assert.deepEqual(RECONCILE_CODES, [
      'workshop.accounting.cash-bank.reconcile.view',
      'workshop.accounting.cash-bank.reconcile.manage',
    ]);
  });

  it('mapAccessColumn: owner gets all checks', () => {
    const ctx = { roleName: 'Owner', userType: 'workshop_owner' };
    assert.equal(mapAccessColumn('read', [], ctx).kind, 'check');
    assert.equal(mapAccessColumn('write', [], ctx).kind, 'check');
    assert.equal(mapAccessColumn('admin', [], ctx).kind, 'check');
    assert.equal(mapAccessColumn('payroll', [], ctx).kind, 'check');
  });

  it('mapAccessColumn: view-only reports', () => {
    const codes = ['workshop.accounting.ledger.view'];
    assert.equal(mapAccessColumn('read', codes, {}).kind, 'check');
    assert.equal(mapAccessColumn('write', codes, {}).kind, 'dash');
    assert.equal(mapAccessColumn('admin', codes, {}).kind, 'dash');
  });

  it('mapAccessColumn: payroll read only', () => {
    const codes = ['workshop.accounting.advances.view'];
    assert.equal(mapAccessColumn('payroll', codes, {}).kind, 'text');
    assert.equal(mapAccessColumn('payroll', codes, {}).text, 'read only');
  });

  it('mapAccessColumn: reconcile.manage counts as admin', () => {
    const codes = ['workshop.accounting.cash-bank.reconcile.manage'];
    assert.equal(mapAccessColumn('admin', codes, {}).kind, 'check');
  });

  it('mapEmployeeToAccessRow marks cashier without accounting as posOnly', () => {
    const row = mapEmployeeToAccessRow({
      id: '1',
      name: 'Cashier 4',
      role: 'cashier',
      userType: 'cashier',
      permissionRole: { id: '9', name: 'Cashier', permissions: [] },
    });
    assert.equal(row.posOnly, true);
    assert.equal(row.actionKey, 'posOnly');
    assert.equal(row.hasAccounting, false);
  });

  it('mapEmployeeToAccessRow accountant with codes', () => {
    const row = mapEmployeeToAccessRow({
      id: '2',
      name: 'Sara',
      userType: 'portal_user',
      permissionRole: {
        id: '3',
        name: 'Accountant',
        permissions: [
          'workshop.accounting.chart-of-accounts.view',
          'workshop.accounting.payments.create',
          'workshop.accounting.payments.approve',
        ],
      },
    });
    assert.equal(row.isAccountant, true);
    assert.equal(row.hasAccounting, true);
    assert.equal(row.read.kind, 'check');
    assert.equal(row.write.kind, 'check');
  });

  it('buildRolesAccessSummary + filter + slicePage', () => {
    const rows = [
      mapEmployeeToAccessRow({
        id: '1',
        name: 'A',
        permissionRole: {
          name: 'Accountant',
          permissions: ['workshop.accounting.ledger.view'],
        },
      }),
      mapEmployeeToAccessRow({
        id: '2',
        name: 'B',
        role: 'cashier',
        userType: 'cashier',
        permissionRole: { name: 'Cashier', permissions: [] },
      }),
    ];
    const sum = buildRolesAccessSummary(rows);
    assert.equal(sum.withAccounting, 1);
    assert.equal(sum.accountants, 1);
    assert.equal(sum.cashierTech, 1);
    assert.equal(sum.blockedAttempts, null);

    const filtered = filterAccessRows(rows, { role: 'accountant' });
    assert.equal(filtered.length, 1);

    const page = slicePage(rows, 1, 25);
    assert.equal(page.total, 2);
    assert.equal(page.from, 1);
  });

  it('hasAnyAccountingAccess', () => {
    assert.equal(hasAnyAccountingAccess(['workshop.branches.view']), false);
    assert.equal(
      hasAnyAccountingAccess(['workshop.accounting.cash-bank.view']),
      true,
    );
  });
});
