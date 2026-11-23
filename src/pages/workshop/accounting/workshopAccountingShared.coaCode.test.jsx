import { describe, it, expect } from 'vitest';
import { normalizeWorkshopCashBankRow } from './workshopAccountingShared';
import { isCitOfficerRegister } from '../../../utils/cashBankScreen';

describe('normalizeWorkshopCashBankRow coaCode for CIT', () => {
  it('keeps coaCode/coaLink for 1005-O* from nested coaAccount', () => {
    const row = normalizeWorkshopCashBankRow({
      id: 9,
      name: 'Officer',
      type: 'CASH',
      kind: 'OPERATING',
      currentBalance: 1,
      coaAccount: { id: 1, code: '1005-O12', name: 'CIT officer' },
    });
    expect(row.coaCode).toBe('1005-O12');
    expect(row.coaLink).toMatch(/^1005-O12/);
    expect(isCitOfficerRegister(row)).toBe(true);
  });

  it('keeps coaCode when only top-level coaCode is present', () => {
    const row = normalizeWorkshopCashBankRow({
      id: 9,
      name: 'Officer',
      type: 'CASH',
      kind: 'OPERATING',
      currentBalance: 1,
      coaCode: '1005-O99',
    });
    expect(row.coaCode).toBe('1005-O99');
    expect(row.coaLink).toMatch(/^1005-O99/);
    expect(isCitOfficerRegister(row)).toBe(true);
  });
});
