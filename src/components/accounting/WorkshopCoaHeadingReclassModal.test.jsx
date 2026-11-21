/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkshopCoaHeadingReclassModal from './WorkshopCoaHeadingReclassModal';

vi.mock('../Modal', () => ({
  default: ({ title, children, footer }) => (
    <div>
      <h2>{title}</h2>
      {children}
      {footer}
    </div>
  ),
}));

vi.mock('../../pages/supplier/accounting/SupplierAccountingCombobox', () => ({
  default: ({ options, value, onChange, placeholder }) => (
    <select
      aria-label={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

const t = (key, vars) => {
  if (key === 'coa.reclass.done') return `Moved. Journal ${vars?.no}.`;
  return key;
};

describe('WorkshopCoaHeadingReclassModal', () => {
  it('hides AP children and keeps one clientRequestId per open', () => {
    const onSubmit = vi.fn();
    render(
      <MemoryRouter>
        <WorkshopCoaHeadingReclassModal
          heading={{ id: '10', code: '1010', name: 'Bank' }}
          buckets={[
            {
              headingId: '10',
              branchId: null,
              net: '50.00',
              lineCount: 2,
              leaves: [
                { id: '1', code: '1010-G', name: 'General', isApSupplierChild: false },
                { id: '2', code: '1010-S1', name: 'Supplier', isApSupplierChild: true },
              ],
            },
          ]}
          t={t}
          onClose={() => {}}
          onSubmit={onSubmit}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading').textContent).toMatch(/coa\.reclass\.title|1010/);
    const select = screen.getByLabelText('coa.reclass.target');
    const opts = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(opts.some((x) => String(x).includes('Supplier'))).toBe(false);
    expect(opts.some((x) => String(x).includes('General'))).toBe(true);

    fireEvent.change(select, { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('coa.reclass.amount'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('coa.reclass.reason'), {
      target: { value: 'cleanup old heading' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'coa.reclass.submit' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const firstId = onSubmit.mock.calls[0][0].clientRequestId;
    fireEvent.click(screen.getByRole('button', { name: 'coa.reclass.submit' }));
    expect(onSubmit.mock.calls[1][0].clientRequestId).toBe(firstId);
  });
});
