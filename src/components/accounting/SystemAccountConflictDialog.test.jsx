/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiFetch = vi.fn();

vi.mock('../../services/api', () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

import SystemAccountConflictDialog from './SystemAccountConflictDialog';

const conflict = {
  role: 'LOCKER_COLLECTION_EXPENSE_CLEARING',
  roleLabel: 'Collection expense claims — pending approval',
  preferredCode: '1156',
  roleType: 'ASSET',
  roleSubType: 'CURRENT',
  suggestedCode: '1158',
  conflictingAccount: { name: 'Zad Al Sharq Food Products Company', type: 'ASSET', code: '1156' },
};

describe('SystemAccountConflictDialog', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (path) => {
      if (String(path).includes('/accounts/next-code')) {
        const u = new URL(`http://x${path}`);
        const check = u.searchParams.get('check');
        if (!check) return { code: '1158', suggestedCode: '1158', available: true, reason: null };
        if (check === '1157') return { code: check, available: false, reason: 'taken' };
        return { code: check, available: true, reason: null };
      }
      if (String(path).includes('/accounts/system-accounts/conflicts')) {
        return [{ ...conflict }];
      }
      if (String(path).includes('/accounts/system-accounts/resolve')) {
        return { success: true, accountId: '9', code: '1158' };
      }
      throw new Error(`unexpected ${path}`);
    });
  });

  afterEach(cleanup);

  it('renders conflict copy and resolves on confirm', async () => {
    const onResolved = vi.fn();
    const onClose = vi.fn();
    render(
      <SystemAccountConflictDialog
        open
        conflict={conflict}
        locale="en"
        canWriteCoa
        onClose={onClose}
        onResolved={onResolved}
      />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/System account code conflict/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Create system account|Resolve/i }));
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    const resolveCall = apiFetch.mock.calls.find((c) => String(c[0]).includes('/resolve'));
    expect(JSON.parse(resolveCall[1].body)).toEqual({ role: 'LOCKER_COLLECTION_EXPENSE_CLEARING', code: '1158' });
    await waitFor(() => expect(apiFetch.mock.calls.some((c) => String(c[0]).includes('next-code'))).toBe(true));
    const check = apiFetch.mock.calls.find((c) => String(c[0]).includes('next-code'));
    expect(String(check[0])).toContain('type=ASSET');
    expect(String(check[0])).toContain('near=1156');
  });

  it('shows the conflicting account and blocks a taken code', async () => {
    render(<SystemAccountConflictDialog open conflict={conflict} locale="en" canWriteCoa onClose={() => {}} />);
    expect(screen.getByText(/Zad Al Sharq/)).toBeTruthy();
    const input = screen.getByLabelText(/New system account code/i);
    expect(input.value).toBe('1158');
    fireEvent.change(input, { target: { value: '1157' } });
    await waitFor(() => expect(screen.getByTestId('sys-acct-code-check').textContent).toMatch(/already used/));
    expect(screen.getByRole('button', { name: /Create system account/i }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Use suggested/i }));
    expect(input.value).toBe('1158');
  });

  it('without CoA write permission: read-only "ask the owner" and no confirm button', () => {
    render(<SystemAccountConflictDialog open conflict={conflict} locale="en" canWriteCoa={false} onClose={() => {}} />);
    expect(screen.getByText(/Ask the owner.accountant/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Create system account/i })).toBeNull();
  });

  it('Arabic renders RTL', () => {
    render(<SystemAccountConflictDialog open conflict={conflict} locale="ar" canWriteCoa onClose={() => {}} />);
    expect(screen.getByRole('dialog').firstChild.style.direction).toBe('rtl');
  });

  it('screenshot case: 409 with only the code → loads details, shows the holder account, pre-fills the suggestion, resolves with the role', async () => {
    const onResolved = vi.fn();
    render(
      <SystemAccountConflictDialog
        open
        conflict={{ code: 'SYSTEM_ACCOUNT_CODE_CONFLICT', role: '', preferredCode: '', suggestedCode: '', conflictingAccount: null }}
        locale="en"
        canWriteCoa
        onClose={() => {}}
        onResolved={onResolved}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('sys-acct-conflict-holder').textContent).toMatch(/1156 — Zad Al Sharq Food Products Company/),
    );
    expect(screen.getByTestId('sys-acct-conflict-needs').textContent).toMatch(/Collection expense claims — pending approval/);
    expect(screen.getByTestId('sys-acct-conflict-needs').textContent).toMatch(/1156/);
    const input = screen.getByLabelText(/New system account code/i);
    await waitFor(() => expect(input.value).toBe('1158'));
    expect(screen.getByTestId('sys-acct-use-suggested').textContent).toMatch(/1158/);
    await waitFor(() => expect(screen.getByRole('button', { name: /Create system account/i }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /Create system account/i }));
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    const resolveCall = apiFetch.mock.calls.find((c) => String(c[0]).includes('/resolve'));
    expect(JSON.parse(resolveCall[1].body)).toEqual({ role: 'LOCKER_COLLECTION_EXPENSE_CLEARING', code: '1158' });
  });

  it('no suggestion in the payload → "Use suggested" fetches the next free code and fills it', async () => {
    render(<SystemAccountConflictDialog open conflict={{ ...conflict, suggestedCode: '' }} locale="en" canWriteCoa onClose={() => {}} />);
    const input = screen.getByLabelText(/New system account code/i);
    await waitFor(() => expect(input.value).toBe('1158'));
    fireEvent.change(input, { target: { value: '1190' } });
    expect(input.value).toBe('1190');
    fireEvent.click(screen.getByTestId('sys-acct-use-suggested'));
    await waitFor(() => expect(input.value).toBe('1158'));
    const sugg = apiFetch.mock.calls.filter((c) => String(c[0]).includes('next-code') && !String(c[0]).includes('check='));
    expect(sugg.length).toBeGreaterThan(0);
    expect(String(sugg[0][0])).toContain('near=1156');
  });

  it('typing keeps digits only', () => {
    render(<SystemAccountConflictDialog open conflict={conflict} locale="en" canWriteCoa onClose={() => {}} />);
    const input = screen.getByLabelText(/New system account code/i);
    fireEvent.change(input, { target: { value: '11a9-9' } });
    expect(input.value).toBe('1199');
  });
});
