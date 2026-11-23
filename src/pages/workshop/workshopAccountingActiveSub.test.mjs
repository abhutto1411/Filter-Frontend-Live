/**
 * Regression: Roles & access blank page when only activeTab=acc-roles is set
 * (WorkshopLayout has no :subTab route param).
 * Run: node --test src/pages/workshop/workshopAccountingActiveSub.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WORKSHOP_ACC_TAB_SLUG } from '../../utils/workshopAccTabSlug.js';

function resolveActiveSub(paramsSubTab, activeTab) {
  const raw =
    paramsSubTab ||
    (activeTab && WORKSHOP_ACC_TAB_SLUG[activeTab]) ||
    (activeTab ? activeTab.replace('acc-', '') : 'cash-bank');
  const mapping = {
    roles: 'roles-access',
    'roles-access': 'roles-access',
    'petty-wallets': 'petty-cash',
    'petty-cash': 'petty-cash',
    chart: 'chart-of-accounts',
    cash: 'cash-bank',
  };
  return mapping[raw] || raw;
}

describe('workshop accounting activeSub', () => {
  it('acc-roles (no params) → roles-access', () => {
    assert.equal(resolveActiveSub(undefined, 'acc-roles'), 'roles-access');
  });

  it('URL roles-access → roles-access', () => {
    assert.equal(resolveActiveSub('roles-access', 'acc-roles'), 'roles-access');
  });

  it('acc-petty-wallets → petty-cash', () => {
    assert.equal(resolveActiveSub(undefined, 'acc-petty-wallets'), 'petty-cash');
  });
});
