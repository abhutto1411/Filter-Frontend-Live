/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const getAccountingSettings = vi.fn();
const patchAccountingSettings = vi.fn();
const getBooksHealthSummary = vi.fn();
const getStaffAppSettings = vi.fn();
const updateStaffAppSettings = vi.fn();
const getWorkshopBranches = vi.fn();

const authState = {
  user: {
    userType: 'platform_admin',
    type: 'admin',
    role: null,
    permissionSource: 'none',
  },
};

vi.mock('../../../services/accountingSettingsApi', () => ({
  getAccountingSettings: (...a) => getAccountingSettings(...a),
  patchAccountingSettings: (...a) => patchAccountingSettings(...a),
}));
vi.mock('../../../services/booksHealthApi', () => ({
  getBooksHealthSummary: (...a) => getBooksHealthSummary(...a),
}));
vi.mock('../../../services/staffAppApi', () => ({
  getStaffAppSettings: (...a) => getStaffAppSettings(...a),
  updateStaffAppSettings: (...a) => updateStaffAppSettings(...a),
}));
vi.mock('../../../services/workshopStaffApi', () => ({
  getWorkshopBranches: (...a) => getWorkshopBranches(...a),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    user: authState.user,
  }),
}));

import WorkshopAccountingSettingsPage from './WorkshopAccountingSettingsPage';

describe('WorkshopAccountingSettingsPage heading reclass controls', () => {
  beforeEach(() => {
    authState.user = {
      userType: 'platform_admin',
      type: 'admin',
      role: null,
      permissionSource: 'none',
    };
    getAccountingSettings.mockResolvedValue({
      startDate: '2026-06-01',
      lockedUpTo: null,
      cutoverEnabled: false,
      basis: 'accrual',
      allowNegativeCashBank: false,
      allowNegativeCashBankByBranch: {},
      headingReclassOpen: true,
      headingReclassEffectiveOpen: true,
      headingReclassExpiresAt: '2026-06-01T13:00:00.000Z',
      history: [],
    });
    getBooksHealthSummary.mockResolvedValue({});
    getStaffAppSettings.mockResolvedValue({ settings: {} });
    getWorkshopBranches.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows open/lock controls for Super Admin', async () => {
    render(
      <MemoryRouter initialEntries={['/?tab=basis']}>
        <WorkshopAccountingSettingsPage locale="en" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('heading-reclass-controls')).toBeTruthy(),
    );
    expect(screen.getByText(/Lock Heading Accounts/i)).toBeTruthy();
  });

  it('shows read-only status for non Super Admin', async () => {
    authState.user = { userType: 'workshop_owner', type: null };
    render(
      <MemoryRouter initialEntries={['/?tab=basis']}>
        <WorkshopAccountingSettingsPage locale="en" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('heading-reclass-controls')).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: /Lock Heading Accounts/i })).toBeNull();
    expect(screen.getByTestId('heading-reclass-status').textContent).toMatch(
      /Opened by user #|Heading adjustment is locked|Auto-locks at/i,
    );
  });
});
