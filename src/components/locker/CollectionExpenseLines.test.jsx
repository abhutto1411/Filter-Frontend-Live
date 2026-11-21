/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

vi.mock('./ExpenseAccountCombobox', () => ({
  default: ({ value, onChange, id }) => (
    <input
      data-testid={id || 'expense-account'}
      aria-label="record.expense.account"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

vi.mock('./useCollectionExpenseMeta', () => ({
  default: () => ({
    vatPercent: 15,
    vatInputAccount: { code: '1310', name: 'VAT Input (Receivable)' },
    clearing: null,
  }),
}));

vi.mock('../../utils/expenseProofImage', () => ({
  compressExpenseProofFile: vi.fn(async (f) => ({
    dataUrl: 'data:image/jpeg;base64,xx',
    name: f?.name || 'r.jpg',
  })),
}));

import CollectionExpenseLines from './CollectionExpenseLines';
import { newExpenseLine } from '../../pages/locker/recordCollectionHelpers';

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);

function Harness({ initial, onLines, branches }) {
  const [lines, setLines] = useState(initial || [newExpenseLine()]);
  onLines?.(lines);
  return (
    <CollectionExpenseLines
      t={t}
      locale="en"
      lines={lines}
      setLines={setLines}
      branches={branches || [
        { id: 2, name: 'Br 2' },
        { id: 3, name: 'Br 3' },
      ]}
    />
  );
}

afterEach(cleanup);

describe('CollectionExpenseLines (account card)', () => {
  it('renders expense account + gross/vat and optional receipt', () => {
    render(<Harness />);
    expect(screen.getByTestId('collection-expense-lines')).toBeTruthy();
    expect(screen.getByLabelText('record.expense.account')).toBeTruthy();
    expect(screen.getByLabelText('record.expense.grossLabel').getAttribute('type')).toBe(
      'text',
    );
    expect(screen.getByLabelText(/record.expense.vatLabel .*"rate":"15"/)).toBeTruthy();
    // Inc. VAT is the default amount type
    expect(screen.getByTestId('rc-exp-vat-mode-inc-0').getAttribute('aria-checked')).toBe('true');
  });

  it('sanitizes gross to 2 decimals and updates the total', () => {
    let latest = [];
    render(<Harness onLines={(l) => { latest = l; }} />);
    fireEvent.change(screen.getByLabelText('record.expense.grossLabel'), {
      target: { value: '12.345' },
    });
    expect(latest[0].amount).toBe('12.34');
    expect(latest[0].gross).toBe('12.34');
    expect(screen.getByTestId('expense-lines-total').textContent).toBe('12.34');
  });

  it('adds up to 10 lines, then shows the max hint; remove works', () => {
    let latest = [];
    render(<Harness onLines={(l) => { latest = l; }} />);
    for (let i = 0; i < 9; i += 1) fireEvent.click(screen.getByText('record.expense.add'));
    expect(latest).toHaveLength(10);
    expect(screen.queryByText('record.expense.add')).toBeNull();
    expect(screen.getByText('record.expense.maxLines {"n":10}')).toBeTruthy();
    const removeBtns = screen.getAllByRole('button').filter((b) =>
      /remove/i.test(b.getAttribute('aria-label') || b.textContent || ''),
    );
    expect(removeBtns.length).toBeGreaterThan(0);
    fireEvent.click(removeBtns[0]);
    expect(latest).toHaveLength(9);
  });

  it('stores expenseAccountId from the combobox', () => {
    let latest = [];
    render(<Harness onLines={(l) => { latest = l; }} />);
    fireEvent.change(screen.getByLabelText('record.expense.account'), {
      target: { value: '42' },
    });
    expect(String(latest[0].expenseAccountId)).toBe('42');
  });

  const amountInput = () => screen.getByLabelText('record.expense.grossLabel');
  const vatInput = () => screen.getByLabelText(/record.expense.vatLabel/);

  it('Inc. VAT: 115 → gross 115.00 / VAT 15.00; summary net + VAT = total; not claimable without VAT no.', () => {
    let latest = [];
    render(<Harness onLines={(l) => { latest = l; }} />);
    fireEvent.change(amountInput(), { target: { value: '115' } });
    expect(latest[0].gross).toBe('115.00');
    expect(latest[0].vat).toBe('15.00');
    expect(vatInput().value).toBe('15.00');
    const sum = screen.getByTestId('rc-exp-vat-summary-0').textContent;
    expect(sum).toContain('100.00');
    expect(sum).toContain('15.00');
    expect(sum).toContain('115.00');
    expect(screen.getByTestId('rc-exp-vat-status-0').textContent).toContain('record.expense.vatNotClaimableLine');
  });

  it('valid supplier VAT number makes the VAT claimable (to 1310); invalid one shows an error', () => {
    render(<Harness />);
    fireEvent.change(amountInput(), { target: { value: '115' } });
    const vatNo = screen.getByLabelText('record.expense.vatNumber');
    fireEvent.change(vatNo, { target: { value: '12345' } });
    expect(vatNo.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(vatNo, { target: { value: '300000000000003' } });
    expect(vatNo.getAttribute('aria-invalid')).toBeNull();
    const status = screen.getByTestId('rc-exp-vat-status-0').textContent;
    expect(status).toContain('record.expense.vatClaimable');
    expect(status).toContain('1310 VAT Input (Receivable)');
    expect(status).toContain('"net":"100.00"');
  });

  it('Exc. VAT: amount 115 is the net → VAT 17.25, gross 132.25', () => {
    let latest = [];
    render(<Harness onLines={(l) => { latest = l; }} />);
    fireEvent.change(amountInput(), { target: { value: '115' } });
    fireEvent.click(screen.getByTestId('rc-exp-vat-mode-exc-0'));
    expect(latest[0].amountMode).toBe('exc');
    expect(latest[0].vat).toBe('17.25');
    expect(latest[0].gross).toBe('132.25');
    expect(screen.getByTestId('expense-lines-total').textContent).toBe('132.25');
  });

  it('No VAT: VAT 0.00 and locked, VAT number / bill fields hidden', () => {
    let latest = [];
    render(<Harness onLines={(l) => { latest = l; }} />);
    fireEvent.change(amountInput(), { target: { value: '50' } });
    fireEvent.click(screen.getByTestId('rc-exp-vat-mode-none-0'));
    expect(latest[0].vat).toBe('0.00');
    expect(latest[0].gross).toBe('50.00');
    expect(vatInput().disabled).toBe(true);
    expect(screen.queryByLabelText('record.expense.vatNumber')).toBeNull();
    expect(screen.queryByTestId('rc-exp-vat-status-0')).toBeNull();
  });

  it('hand-typed VAT above the VAT inside the total is flagged (7.00 with VAT 1.50)', () => {
    render(<Harness />);
    fireEvent.change(amountInput(), { target: { value: '7' } });
    expect(vatInput().value).toBe('0.91');
    fireEvent.change(vatInput(), { target: { value: '1.5' } });
    expect(screen.getByText('record.expense.errVatTooHigh')).toBeTruthy();
  });
});
