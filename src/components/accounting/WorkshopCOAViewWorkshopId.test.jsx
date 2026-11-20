/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const getAccounts = vi.fn();
const getAccountsTree = vi.fn();
const getAccountsBranches = vi.fn();
const getHeadingDirectBalances = vi.fn();
const getAccountingSettings = vi.fn();
const listCoaAccounts = vi.fn();

const authState = {
  user: {
    userType: 'platform_admin',
    type: 'admin',
    role: null,
    permissionSource: 'none',
  },
};

vi.mock('../../services/accountsApi', () => ({
  deleteAccount: vi.fn(),
  getAccounts: (...a) => getAccounts(...a),
  getAccountsBranches: (...a) => getAccountsBranches(...a),
  getAccountsTree: (...a) => getAccountsTree(...a),
  getBalanceSheet: vi.fn(),
  getPLReport: vi.fn(),
  getTrialBalance: vi.fn(),
}));
vi.mock('../../services/workshopAccountingApi', () => ({
  listCoaAccounts: (...a) => listCoaAccounts(...a),
  adjustWorkshopCoaAccount: vi.fn(),
  getHeadingDirectBalances: (...a) => getHeadingDirectBalances(...a),
  reclassHeadingAccount: vi.fn(),
}));
vi.mock('../../services/accountingSettingsApi', () => ({
  getAccountingSettings: (...a) => getAccountingSettings(...a),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: authState.user, hasPermission: () => true }),
}));
vi.mock('../../services/workshopStaffApi', () => ({
  filterPortalVisibleBranches: (list) => list || [],
}));

import WorkshopCOAView from './WorkshopCOAView';

describe('WorkshopCOAView workshopId wiring (mounted)', () => {
  beforeEach(() => {
    authState.user = {
      userType: 'platform_admin',
      type: 'admin',
      role: null,
      permissionSource: 'none',
    };
    getAccounts.mockResolvedValue([
      {
        id: '1010',
        code: '1010',
        name: 'Cash heading',
        type: 'ASSET',
        isHeading: true,
        hasChildren: true,
        closingDebit: 5,
        closingCredit: 0,
      },
      {
        id: '1010-G',
        code: '1010-G',
        name: 'Cash G',
        type: 'ASSET',
        isHeading: false,
        hasChildren: false,
        closingDebit: 0,
        closingCredit: 0,
      },
    ]);
    getAccountsTree.mockResolvedValue([
      {
        id: '1010',
        code: '1010',
        name: 'Cash heading',
        type: 'ASSET',
        isHeading: true,
        children: [
          {
            id: '1010-G',
            code: '1010-G',
            name: 'Cash G',
            type: 'ASSET',
            children: [],
          },
        ],
      },
    ]);
    getAccountsBranches.mockResolvedValue([]);
    getHeadingDirectBalances.mockResolvedValue({
      buckets: [{ headingId: '1010', directBalance: '5.00' }],
      effectiveOpen: true,
    });
    getAccountingSettings.mockResolvedValue({
      headingReclassEffectiveOpen: true,
      startDate: '2026-01-01',
      lockedUpTo: null,
    });
    listCoaAccounts.mockResolvedValue({ accounts: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('passes workshopId to accounts/settings/heading APIs', async () => {
    render(
      <MemoryRouter>
        <WorkshopCOAView locale="en" workshopId="42" headingReclassOnly />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getAccounts).toHaveBeenCalled());
    expect(getAccounts.mock.calls[0][0]).toEqual(
      expect.objectContaining({ workshopId: '42' }),
    );
    expect(getAccountsTree.mock.calls[0][0]).toEqual(
      expect.objectContaining({ workshopId: '42' }),
    );
    await waitFor(() => expect(getHeadingDirectBalances).toHaveBeenCalled());
    expect(getHeadingDirectBalances.mock.calls[0][0]).toEqual(
      expect.objectContaining({ workshopId: '42' }),
    );
    expect(getAccountingSettings.mock.calls[0][0]).toEqual(
      expect.objectContaining({ workshopId: '42' }),
    );
  });

  it('shows Reclassify for platform Super Admin when open; hides for limited admin', async () => {
    render(
      <MemoryRouter>
        <WorkshopCOAView locale="en" workshopId="42" headingReclassOnly />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Reclassify/i })).toBeTruthy(),
    );
    cleanup();

    authState.user = {
      userType: 'platform_admin',
      type: 'admin',
      role: { isSystem: false, name: 'Limited' },
    };
    getHeadingDirectBalances.mockClear();
    getAccountingSettings.mockClear();
    render(
      <MemoryRouter>
        <WorkshopCOAView locale="en" workshopId="42" headingReclassOnly />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getAccounts).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Reclassify/i })).toBeNull();
  });
});
