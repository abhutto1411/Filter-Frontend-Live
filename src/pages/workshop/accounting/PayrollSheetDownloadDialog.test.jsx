/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PayrollSheetDownloadDialog from './PayrollSheetDownloadDialog.jsx';
import { validateSheetFilters } from './payrollSheetFilters';
import { accT } from '../../../utils/accountingI18n';
import { payrollErrorI18nKey } from '../../../utils/payrollRunDisplay';

const t = (k, v) => accT('en', k, v);

afterEach(cleanup);

describe('validateSheetFilters', () => {
  it('advance mode: month OR a full from ≤ to range', () => {
    expect(validateSheetFilters({ month: '', from: '', to: '', mode: 'advance' }).ok).toBe(false);
    expect(validateSheetFilters({ month: '2026-09', from: '', to: '', mode: 'advance' }).ok).toBe(true);
    expect(
      validateSheetFilters({ month: '', from: '2026-09-01', to: '2026-09-30', mode: 'advance' }).ok,
    ).toBe(true);
    expect(
      validateSheetFilters({ month: '', from: '2026-09-30', to: '2026-09-01', mode: 'advance' }).code,
    ).toBe('range');
    expect(validateSheetFilters({ month: '', from: '2026-09-01', to: '', mode: 'advance' }).code).toBe('range');
  });
});

describe('PayrollSheetDownloadDialog', () => {
  const base = { open: true, title: 'Advance sheet', t, branches: [{ id: 1, name: 'Riyadh' }], onClose: () => {} };

  it('advance mode button reads "Download advance sheet" (not salary)', () => {
    render(<PayrollSheetDownloadDialog {...base} mode="advance" showDateRange onDownload={() => {}} />);
    expect(screen.getByRole('button', { name: /Download advance sheet/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Download salary sheet/i })).toBeNull();
  });

  it('blocks download with no filter and shows a message', () => {
    const onDownload = vi.fn();
    render(<PayrollSheetDownloadDialog {...base} mode="advance" showDateRange onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: /Download advance sheet/i }));
    expect(onDownload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('passes month + format to onDownload when valid', () => {
    const onDownload = vi.fn();
    render(
      <PayrollSheetDownloadDialog {...base} mode="advance" showDateRange defaultMonth="2026-09" onDownload={onDownload} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Download advance sheet/i }));
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ month: '2026-09', format: 'pdf' }));
  });

  it('maps ADVANCE_SHEET_EMPTY to "No paid advances in this period" and Esc closes', () => {
    const key = payrollErrorI18nKey({ code: 'ADVANCE_SHEET_EMPTY' });
    expect(key).toBe('pr.sheet.err.advEmpty');
    const onClose = vi.fn();
    render(
      <PayrollSheetDownloadDialog {...base} mode="advance" error={t(key)} onClose={onClose} onDownload={() => {}} />,
    );
    expect(screen.getByText(/No paid advances in this period/i)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
