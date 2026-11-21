/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../services/lockerExpenseAccountsApi', () => ({
    listLockerExpenseAccounts: vi.fn(),
}));

import { listLockerExpenseAccounts } from '../../services/lockerExpenseAccountsApi';
import ExpenseAccountCombobox from './ExpenseAccountCombobox';
import { __resetExpenseAccountCache, mapExpenseAccountsToOptions } from './expenseAccountOptions';

const accounts = [
    { id: 4, code: '2100', name: 'Accrued Payables', type: 'LIABILITY' },
    { id: 1, code: '6110', name: 'Fuel', type: 'EXPENSE', isSystem: true },
    { id: 2, code: '6120', name: 'Maintenance', type: 'EXPENSE' },
    { id: 3, code: '7001', name: 'Water Purchases', type: 'EXPENSE', branchId: '9', branchName: 'Al Basateen' },
    { id: 5, code: '1001', name: 'Petty cash', type: 'ASSET', branchId: '2', branchName: 'Main' },
    // Must never be offered even if the server leaked them:
    { id: 50, code: '1156', name: 'Collection expense claims — pending approval', type: 'ASSET' },
    { id: 51, code: '1005-O10', name: 'Officer CIT', type: 'ASSET' },
];

describe('ExpenseAccountCombobox (Transactions-style CoA picker)', () => {
    beforeEach(() => {
        __resetExpenseAccountCache();
        listLockerExpenseAccounts.mockReset();
        listLockerExpenseAccounts.mockResolvedValue({
            accounts,
            clearing: { accountId: '50', code: '1156', name: 'Clearing' },
        });
    });

    afterEach(cleanup);

    function renderBox(props = {}) {
        const onChange = vi.fn();
        render(
            <ExpenseAccountCombobox
                id="exp-acct"
                value=""
                onChange={onChange}
                placeholder="Pick account"
                aria-label="Expense account"
                {...props}
            />,
        );
        return { onChange, input: screen.getByRole('combobox') };
    }

    it('loads the whole CoA once with all=1 and lists every type (not only EXPENSE)', async () => {
        const { input } = renderBox();
        await waitFor(() => expect(listLockerExpenseAccounts).toHaveBeenCalledWith({ all: 1 }));
        fireEvent.focus(input);
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(await screen.findByRole('option', { name: /2100 — Accrued Payables/ })).toBeTruthy();
        expect(screen.getByRole('option', { name: /1001 — Petty cash/ })).toBeTruthy();
        expect(screen.getByRole('option', { name: /6110 — Fuel/ })).toBeTruthy();
    });

    it('typing filters locally (no extra request) and a click sets the account id', async () => {
        const { onChange, input } = renderBox();
        await waitFor(() => expect(listLockerExpenseAccounts).toHaveBeenCalledTimes(1));
        const user = userEvent.setup();
        await user.click(input);
        await user.type(input, 'fuel');
        expect(input.value).toBe('fuel');
        await user.click(await screen.findByRole('option', { name: /6110 — Fuel/ }));
        await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0]).toBe('1'));
        expect(listLockerExpenseAccounts).toHaveBeenCalledTimes(1);
    });

    it('keyboard: type a code, ArrowDown/ArrowUp then Enter selects the highlighted match', async () => {
        const { onChange, input } = renderBox();
        await waitFor(() => expect(listLockerExpenseAccounts).toHaveBeenCalled());
        const user = userEvent.setup();
        await user.click(input);
        await user.type(input, '61');
        await screen.findByRole('option', { name: /6120 — Maintenance/ });
        await waitFor(() => expect(screen.queryByRole('option', { name: /7001/ })).toBeNull());
        await user.keyboard('{ArrowDown}{ArrowUp}{ArrowDown}{Enter}');
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(['1', '2']).toContain(onChange.mock.calls.at(-1)[0]);
    });

    it('excluded accounts (clearing, 1005-O) are never rendered; system badge shown', async () => {
        const { input } = renderBox();
        await waitFor(() => expect(listLockerExpenseAccounts).toHaveBeenCalled());
        fireEvent.focus(input);
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        await screen.findByRole('option', { name: /6120 — Maintenance/ });
        expect(screen.queryByRole('option', { name: /1156/ })).toBeNull();
        expect(screen.queryByRole('option', { name: /1005-O10/ })).toBeNull();
        expect(screen.getAllByTestId('exp-acct-system-badge')).toHaveLength(1);
    });

    it('shows the selected account label and caches across mounts (one request per session)', async () => {
        renderBox({ value: '3' });
        await waitFor(() => expect(screen.getByRole('combobox').value).toBe('7001 — Water Purchases'));
        cleanup();
        renderBox();
        await new Promise((r) => setTimeout(r, 30));
        expect(listLockerExpenseAccounts).toHaveBeenCalledTimes(1);
    });
});

describe('mapExpenseAccountsToOptions', () => {
    it('orders like the Transactions picker: this branch first, other branches after, code order', () => {
        const opts = mapExpenseAccountsToOptions(accounts.slice(0, 5), {
            branchId: '2',
            otherBranchesLabel: 'Other branches',
        });
        expect(opts.map((o) => o.label.split(' ')[0])).toEqual(['1001', '2100', '6110', '6120', '7001']);
        const water = opts.find((o) => o.id === '3');
        expect(water.subtitle).toBe('Other branches · Al Basateen');
        expect(opts.find((o) => o.id === '5').subtitle).toBe('ASSET · Main');
        expect(opts.find((o) => o.id === '4').subtitle).toBe('LIABILITY');
    });
});
