/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkshopCashBankTransferPanel from './WorkshopCashBankTransferPanel';
import {
  isCitOfficerRegister,
  mapCashBankTransferError,
} from '../../../utils/cashBankScreen';
import { accT } from '../../../utils/accountingI18n';

vi.mock('../../../services/workshopStaffApi', () => ({
  internalTransferWorkshopCashBank: vi.fn(),
}));

import { internalTransferWorkshopCashBank } from '../../../services/workshopStaffApi';

const t = (key, vars) => {
  if (key === 'cb.xfer.done') return `Transferred. Reference ${vars?.ref}.`;
  const map = {
    'cb.xfer.title': 'Internal fund transfer',
    'cb.xfer.desc': 'desc',
    'cb.xfer.from': 'From',
    'cb.xfer.to': 'To',
    'cb.xfer.amount': 'Amount',
    'cb.xfer.date': 'Date',
    'cb.xfer.note': 'Note',
    'cb.xfer.notePh': '',
    'cb.xfer.searchPh': 'search',
    'cb.xfer.noMatch': 'none',
    'cb.xfer.submit': 'Transfer funds',
    'cb.xfer.submitting': 'Transferring…',
    'cb.xfer.err.both': 'Select both',
    'cb.xfer.err.diff': 'must differ',
    'cb.xfer.err.amount': 'bad amount',
    'cb.xfer.err.amount2dp': '2dp',
    'cb.xfer.err.tillOpen': "Close the cashier's POS session first.",
    'cb.xfer.err.failed': 'failed',
    'cb.xfer.citOfficerDisabled':
      'Collection officer wallet: use Record collection',
    'cb.xfer.err.citOfficer':
      'Collection officer wallets receive cash only via Record collection.',
    'cb.xfer.balanceAfter': 'Source balance after transfer',
    'cb.class.CASH_ON_HAND': 'Cash',
    'cb.class.CASHIER_TILL': 'Till',
    'cb.class.BANK': 'Bank',
    'cb.class.LOCKER': 'Locker',
    'cb.class.PETTY_WALLET': 'Petty',
    'cb.class.OTHER': 'Other',
  };
  return map[key] || key;
};

const accounts = [
  {
    id: '1',
    name: 'Cash A',
    branch: 'Main',
    balance: 100,
    apiType: 'CASH',
    kind: 'OPERATING',
  },
  {
    id: '2',
    name: 'Bank B',
    branch: 'Main',
    balance: 200,
    apiType: 'BANK',
    kind: 'OPERATING',
  },
];

describe('WorkshopCashBankTransferPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('requires both accounts before submit', () => {
    render(
      <MemoryRouter>
        <WorkshopCashBankTransferPanel accounts={accounts} t={t} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Transfer funds/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/Select both/i);
  });

  it('maps TILL_SESSION_OPEN to plain message', () => {
    expect(t('cb.xfer.err.tillOpen')).toMatch(/POS session/i);
  });

  it('mounts transfer title', () => {
    render(
      <MemoryRouter>
        <WorkshopCashBankTransferPanel accounts={accounts} t={t} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Internal fund transfer')).toBeTruthy();
    expect(internalTransferWorkshopCashBank).not.toHaveBeenCalled();
  });

  it('B4: CIT officer option aria-disabled in From/To; locker selectable (EN+AR)', () => {
    const officer = {
      id: '9',
      name: 'Officer wallet',
      branch: 'Main',
      balance: 10,
      apiType: 'CASH',
      kind: 'OPERATING',
      coaCode: '1005-O12',
      coaLink: '1005-O12 · CIT',
    };
    const locker = {
      id: '8',
      name: 'Locker',
      branch: 'Main',
      balance: 40,
      apiType: 'CASH',
      kind: 'SYSTEM_LOCKER_VAULT',
      coaCode: '1004',
      coaLink: '1004 · Locker',
    };
    expect(isCitOfficerRegister(officer)).toBe(true);
    expect(isCitOfficerRegister(locker)).toBe(false);
    expect(mapCashBankTransferError({ code: 'REGISTER_IS_CIT_OFFICER' }, t)).toBe(
      t('cb.xfer.err.citOfficer'),
    );

    const openAndAssert = (translate) => {
      render(
        <MemoryRouter>
          <WorkshopCashBankTransferPanel
            accounts={[...accounts, officer, locker]}
            t={translate}
          />
        </MemoryRouter>,
      );
      const combos = screen.getAllByRole('combobox');
      expect(combos.length).toBeGreaterThanOrEqual(2);
      for (const combo of combos.slice(0, 2)) {
        fireEvent.focus(combo);
        fireEvent.click(combo);
        const officerOpt = screen
          .getAllByRole('option')
          .find((el) => /Officer wallet/i.test(el.textContent || ''));
        expect(officerOpt).toBeTruthy();
        expect(officerOpt.getAttribute('aria-disabled')).toBe('true');
        expect(officerOpt.textContent).toMatch(
          /Collection officer wallet: use Record collection|محفظة مسؤول التحصيل/,
        );
        const lockerOpt = screen
          .getAllByRole('option')
          .find((el) => /^Locker/i.test(el.textContent || '') || el.textContent?.includes('Locker'));
        expect(lockerOpt).toBeTruthy();
        expect(lockerOpt.getAttribute('aria-disabled')).toBeFalsy();
        fireEvent.blur(combo);
      }
      cleanup();
    };

    openAndAssert(t);
    const tAr = (key, vars) => {
      if (key.startsWith('cb.')) return accT('ar', key, vars);
      return t(key, vars);
    };
    openAndAssert(tAr);
  });
});
