/** @vitest-environment jsdom */
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const here = dirname(fileURLToPath(import.meta.url));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      name: 'Test Sup',
      userType: 'locker_supervisor',
      role: 'supervisor',
      lockerPortalRole: 'supervisor',
      branchId: '2',
      branchName: 'Br 2',
    },
    logout: vi.fn(),
  }),
}));

vi.mock('../services/api', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    branches: [
      { id: 2, name: 'Br 2' },
      { id: 3, name: 'Br 3' },
    ],
    assignedBranchId: 2,
  }),
}));

vi.mock('../services/authApi', () => ({
  lockerLogout: vi.fn(),
}));

vi.mock('./locker/LockerDashboard', () => ({
  default: () => <div data-testid="locker-dash" />,
}));
vi.mock('./locker/PendingRequests', () => ({
  default: () => <div data-testid="locker-pending" />,
}));
vi.mock('./locker/CollectibleCash', () => ({
  default: () => <div data-testid="locker-collectible" />,
}));
vi.mock('./locker/RecordCollection', () => ({
  default: () => <div data-testid="locker-record" />,
}));
vi.mock('./locker/ApprovalsScreen', () => ({
  default: () => <div data-testid="locker-approvals" />,
}));
vi.mock('./locker/CollectionsHistory', () => ({
  default: () => <div data-testid="locker-history" />,
}));
vi.mock('./locker/DifferencesReport', () => ({
  default: () => <div data-testid="locker-differences" />,
}));
vi.mock('./locker/DepositToBank', () => ({
  default: () => <div data-testid="locker-deposit" />,
}));
vi.mock('./locker/IssuePettyCash', () => ({
  default: () => <div data-testid="locker-issue-pc" />,
}));
vi.mock('./locker/PettyCashIssueLog', () => ({
  default: () => <div data-testid="locker-pc-log" />,
}));
vi.mock('./locker/LockerExpenses', () => ({
  default: () => <div data-testid="locker-expenses" />,
}));
vi.mock('./locker/VaultVouchers', () => ({
  default: () => <div data-testid="locker-vault" />,
}));
vi.mock('./locker/TransactionLog', () => ({
  default: () => <div data-testid="locker-tx-log" />,
}));
vi.mock('./workshop/accounting/WorkshopOfficerWalletPage', () => ({
  default: () => <div data-testid="locker-wallet" />,
}));
vi.mock('../components/locker/LockerNotificationBell', () => ({
  default: () => <div data-testid="locker-bell" />,
}));
vi.mock('./workshop/Workshop.css', () => ({}));

import LockerLayout from './LockerLayout';

afterEach(cleanup);

describe('LockerLayout render (TDZ guard)', () => {
  it('renders /locker/dashboard without TDZ and shows Br 2 in topbar', async () => {
    render(
      <MemoryRouter initialEntries={['/locker/dashboard']}>
        <LockerLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('locker-dash')).toBeTruthy();
    await waitFor(() => {
      expect(document.body.textContent).toContain('Br 2');
    });
  });

  it('renders /locker/collectible without throw and keeps All Branches', async () => {
    render(
      <MemoryRouter initialEntries={['/locker/collectible']}>
        <LockerLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('locker-collectible')).toBeTruthy();
    await waitFor(() => {
      const opt = Array.from(document.querySelectorAll('option')).find(
        (o) => o.value === 'all' || /all branches/i.test(o.textContent || ''),
      );
      expect(opt).toBeTruthy();
    });
  });

  it('static guard: activeTab → activeBranches → selectedBranchName (activeBranches.find)', () => {
    const src = readFileSync(join(here, 'LockerLayout.jsx'), 'utf8');
    expect(src.indexOf('const activeBranches')).toBeGreaterThan(-1);
    expect(src.indexOf('activeBranches.find(')).toBeGreaterThan(-1);
    expect(src.indexOf('const activeBranches')).toBeLessThan(
      src.indexOf('activeBranches.find('),
    );
    expect(src.indexOf('const activeTab')).toBeLessThan(
      src.indexOf('const activeBranches'),
    );
  });
});
