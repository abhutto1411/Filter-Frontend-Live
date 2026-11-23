/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({
  createAccount: vi.fn(async () => ({ id: '99' })),
  getAccountById: vi.fn(),
  getAccountTypesMeta: vi.fn(async () => ({
    detailTypesBySubtype: {
      OPERATING_EXPENSE: ['operating_expense', 'payroll_expense', 'rent', 'utilities', 'depreciation'],
      COST_OF_GOODS_SOLD: ['cogs'],
      OPERATING_REVENUE: ['sales', 'service_revenue'],
      CURRENT: ['cash', 'bank', 'accounts_receivable', 'inventory', 'prepaid', 'other_current_asset'],
    },
    liabilityCurrentDetailTypes: ['accounts_payable', 'vat_payable'],
  })),
  getAccounts: vi.fn(async () => [
    { id: '1', code: '6000', name: 'Operating expenses', type: 'EXPENSE', isHeader: true },
    { id: '2', code: '6100', name: 'Rent leaf', type: 'EXPENSE' },
    { id: '3', code: '4000', name: 'Revenue', type: 'INCOME', hasChildren: true },
  ]),
  getAccountsBranches: vi.fn(async () => [{ id: '5', name: 'Riyadh', isActive: true }]),
  getNextAccountCode: vi.fn(async ({ check }) =>
    check ? { code: check, available: check !== '6100', reason: check === '6100' ? 'taken' : null } : { code: '6450', suggestedCode: '6450' },
  ),
  updateAccount: vi.fn(),
}));
vi.mock('../../../services/accountsApi', () => api);
vi.mock('../../../services/workshopStaffApi', () => ({ filterPortalVisibleBranches: (b) => b }));

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

import WorkshopCoaAccountPage from './WorkshopCoaAccountPage';

function renderNew(url = '/workshop/accounting/chart-of-accounts/new') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/workshop/accounting/chart-of-accounts/new" element={<WorkshopCoaAccountPage locale="en" />} />
        <Route path="/workshop/accounting/chart-of-accounts" element={<p>COA list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WorkshopCoaAccountPage — New account (§3)', () => {
  beforeEach(() => Object.values(api).forEach((f) => f.mockClear?.()));
  afterEach(cleanup);

  it('main "New account" (no presets) offers all 5 types and lets INCOME / EXPENSE be picked', async () => {
    renderNew();
    for (const k of ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']) {
      expect(screen.getByTestId(`coa-type-${k}`)).toBeTruthy();
      expect(screen.getByTestId(`coa-type-${k}`).disabled).toBe(false);
    }
    fireEvent.click(screen.getByTestId('coa-type-EXPENSE'));
    expect(screen.getByTestId('coa-type-EXPENSE').getAttribute('aria-pressed')).toBe('true');
  });

  it('statement + normal balance are derived from the type', async () => {
    renderNew();
    expect(screen.getByTestId('coa-statement-badge').textContent).toMatch(/Balance Sheet/);
    fireEvent.click(screen.getByTestId('coa-type-INCOME'));
    expect(screen.getByTestId('coa-statement-badge').textContent).toMatch(/Income Statement/);
    expect(screen.getByDisplayValue('Credit')).toBeTruthy();
    fireEvent.click(screen.getByTestId('coa-type-EXPENSE'));
    expect(screen.getByDisplayValue('Debit')).toBeTruthy();
  });

  it('detail types follow the subtype; parent list = same-type headers only', async () => {
    renderNew();
    // EXPENSE → first subtype COST_OF_GOODS_SOLD → only the COGS detail type is offered.
    fireEvent.click(screen.getByTestId('coa-type-EXPENSE'));
    await waitFor(() => expect(document.getElementById('coa-acc-detail')).toBeTruthy());
    const detail = document.getElementById('coa-acc-detail');
    fireEvent.focus(detail);
    fireEvent.keyDown(detail, { key: 'ArrowDown' });
    const labels = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(labels.some((l) => /Cogs/i.test(l))).toBe(true);
    expect(labels.some((l) => /Rent/i.test(l))).toBe(false);
    fireEvent.keyDown(detail, { key: 'Escape' });
    await waitFor(() => expect(api.getAccounts).toHaveBeenCalled());
    const parent = document.getElementById('coa-acc-parent');
    fireEvent.focus(parent);
    fireEvent.keyDown(parent, { key: 'ArrowDown' });
    const parents = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(parents.some((l) => /6000 — Operating expenses/.test(l))).toBe(true);
    expect(parents.some((l) => /6100 — Rent leaf/.test(l))).toBe(false);
    expect(parents.some((l) => /4000 — Revenue/.test(l))).toBe(false);
  });

  it('Suggest calls next-code for the chosen type; a taken code is flagged live', async () => {
    renderNew();
    fireEvent.click(screen.getByTestId('coa-type-EXPENSE'));
    fireEvent.click(screen.getByRole('button', { name: /Suggest/i }));
    await waitFor(() => expect(screen.getByDisplayValue('6450')).toBeTruthy());
    expect(api.getNextAccountCode).toHaveBeenCalledWith(expect.objectContaining({ type: 'EXPENSE' }));
    fireEvent.change(document.getElementById('coa-acc-code'), { target: { value: '6100' } });
    await waitFor(() => expect(screen.getByText(/already used by another account/i)).toBeTruthy(), { timeout: 2000 });
  });

  it('branch defaults to workshop-wide (no branchId sent)', async () => {
    renderNew();
    expect(document.getElementById('coa-acc-branch').value).toBe('');
    fireEvent.change(document.getElementById('coa-acc-name'), { target: { value: 'Prepaid rent' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create/i }));
    await waitFor(() => expect(api.createAccount).toHaveBeenCalled());
    expect(api.createAccount.mock.calls[0][0].branchId).toBeUndefined();
  });
});
