/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/workshopAccountingApi', () => ({ listMyExpensePurposes: vi.fn() }));
import { listMyExpensePurposes } from '../../services/workshopAccountingApi';
import CollectionExpenseLines from './CollectionExpenseLines';
import { newExpenseLine } from '../../pages/locker/recordCollectionHelpers';

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);

function Harness({ initial, onLines }) {
    const [lines, setLines] = useState(initial || [newExpenseLine()]);
    onLines?.(lines);
    return <CollectionExpenseLines t={t} lines={lines} setLines={setLines} />;
}

describe('CollectionExpenseLines', () => {
    beforeEach(() => {
        listMyExpensePurposes.mockReset();
        listMyExpensePurposes.mockResolvedValue([{ id: 3, name_en: 'Fuel', name_ar: 'وقود' }]);
    });
    afterEach(cleanup);

    it('renders a labelled card with all BE fields and no native number spinner', async () => {
        render(<Harness />);
        await waitFor(() => expect(listMyExpensePurposes).toHaveBeenCalledTimes(1));
        expect(screen.getByText('record.expense.lineTitle {"n":1}')).toBeTruthy();
        for (const label of [
            'record.expense.description',
            'record.expense.grossLabel',
            'record.expense.vatLabel',
            'record.expense.supplierVat',
            'record.expense.billNo',
        ]) {
            const el = screen.getByLabelText(label);
            expect(el.getAttribute('type')).toBe('text');
        }
        expect(screen.getByLabelText('record.expense.grossLabel').getAttribute('inputmode')).toBe('decimal');
        expect(screen.getByText('record.expense.receiptAttach')).toBeTruthy();
        // Remove is disabled while only one line exists
        expect(screen.getByLabelText('record.expense.removeAria {"n":1}').disabled).toBe(true);
    });

    it('sanitizes gross to 2 decimals and updates the total', () => {
        let latest = [];
        render(<Harness onLines={(l) => { latest = l; }} />);
        fireEvent.change(screen.getByLabelText('record.expense.grossLabel'), { target: { value: '12.345' } });
        expect(latest[0].gross).toBe('12.34');
        expect(screen.getByTestId('expense-lines-total').textContent).toBe('12.34');
    });

    it('adds up to 10 lines, then shows the max hint; remove works per line', () => {
        let latest = [];
        render(<Harness onLines={(l) => { latest = l; }} />);
        for (let i = 0; i < 9; i += 1) fireEvent.click(screen.getByText('record.expense.add'));
        expect(latest).toHaveLength(10);
        expect(screen.queryByText('record.expense.add')).toBeNull();
        expect(screen.getByText('record.expense.maxLines {"n":10}')).toBeTruthy();
        fireEvent.click(screen.getByLabelText('record.expense.removeAria {"n":2}'));
        expect(latest).toHaveLength(9);
    });

    it('shows a VAT-number error for an invalid supplier VAT number and a hint for VAT without one', () => {
        render(<Harness />);
        fireEvent.change(screen.getByLabelText('record.expense.vatLabel'), { target: { value: '15' } });
        expect(screen.getByText('record.expense.vatNotClaimable')).toBeTruthy();
        fireEvent.change(screen.getByLabelText('record.expense.supplierVat'), { target: { value: '123' } });
        expect(screen.getByLabelText('record.expense.supplierVat').getAttribute('aria-invalid')).toBe('true');
    });

    it('purpose list failure keeps the form usable with a hint', async () => {
        listMyExpensePurposes.mockRejectedValueOnce(Object.assign(new Error('no'), { status: 403 }));
        render(<Harness />);
        await waitFor(() => expect(screen.getByText('record.expense.purposeUnavailable')).toBeTruthy());
        expect(screen.getByLabelText('record.expense.grossLabel').disabled).toBe(false);
    });
});

describe('CollectionExpenseLines purpose list states', () => {
    afterEach(cleanup);

    it('empty purpose list shows a set-up hint (not just "No matches") and Reload refetches', async () => {
        listMyExpensePurposes.mockReset();
        listMyExpensePurposes
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 4, name_en: 'Fuel', name_ar: '' }]);
        render(<Harness />);
        await waitFor(() =>
            expect(screen.getByTestId('expense-purpose-hint').textContent).toContain(
                'record.expense.purposeEmpty',
            ),
        );
        // purpose stays optional: gross is still editable
        expect(screen.getByLabelText('record.expense.grossLabel').disabled).toBe(false);
        fireEvent.click(screen.getByText('record.expense.purposeRetry'));
        await waitFor(() => expect(listMyExpensePurposes).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByTestId('expense-purpose-hint')).toBeNull());
    });

    it('accepts an { items } response shape', async () => {
        listMyExpensePurposes.mockReset();
        listMyExpensePurposes.mockResolvedValueOnce({ items: [{ id: 5, name_en: 'Parking' }] });
        render(<Harness />);
        await waitFor(() => expect(listMyExpensePurposes).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByTestId('expense-purpose-hint')).toBeNull());
    });
});