import { describe, it, expect } from 'vitest';
import { canTransferCashBank } from './cashBankTransferAccess';

describe('canTransferCashBank', () => {
  it('hides Transfer for view-only cash-bank permission', () => {
    expect(
      canTransferCashBank({
        isAdminHqBooks: false,
        hasPermission: (k) => k === 'workshop.accounting.cash-bank.view',
      }),
    ).toBe(false);
  });

  it('shows Transfer for workshop.accounting.cash-bank', () => {
    expect(
      canTransferCashBank({
        isAdminHqBooks: false,
        hasPermission: (k) => k === 'workshop.accounting.cash-bank',
      }),
    ).toBe(true);
  });

  it('shows Transfer for HQ books admin', () => {
    expect(
      canTransferCashBank({
        isAdminHqBooks: true,
        hasPermission: () => false,
      }),
    ).toBe(true);
  });
});
