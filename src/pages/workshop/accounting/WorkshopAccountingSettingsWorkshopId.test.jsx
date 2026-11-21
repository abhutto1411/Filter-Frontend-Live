/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const getAccountingSettings = vi.fn();
const patchAccountingSettings = vi.fn();

vi.mock('../../../services/accountingSettingsApi', () => ({
  getAccountingSettings: (...a) => getAccountingSettings(...a),
  patchAccountingSettings: (...a) => patchAccountingSettings(...a),
}));
vi.mock('../../../services/booksHealthApi', () => ({
  getBooksHealthSummary: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../services/staffAppApi', () => ({
  getStaffAppSettings: vi.fn().mockResolvedValue({ settings: {} }),
  updateStaffAppSettings: vi.fn(),
}));
vi.mock('../../../services/workshopStaffApi', () => ({
  getWorkshopBranches: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    user: { userType: 'platform_admin', type: 'admin' },
  }),
}));

import WorkshopAccountingSettingsPage from './WorkshopAccountingSettingsPage';

describe('WorkshopAccountingSettingsPage workshopId (B1)', () => {
  beforeEach(() => {
    getAccountingSettings.mockResolvedValue({
      startDate: '2026-06-01',
      lockedUpTo: null,
      cutoverEnabled: false,
      basis: 'accrual',
      allowNegativeCashBank: false,
      allowNegativeCashBankByBranch: {},
      headingReclassOpen: false,
      headingReclassEffectiveOpen: false,
      history: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('passes workshopId on getAccountingSettings', async () => {
    render(
      <MemoryRouter initialEntries={['/?tab=basis']}>
        <WorkshopAccountingSettingsPage locale="en" workshopId="42" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(getAccountingSettings).toHaveBeenCalledWith({ workshopId: '42' }),
    );
    expect(screen.getByTestId('heading-reclass-controls')).toBeTruthy();
  });
});
