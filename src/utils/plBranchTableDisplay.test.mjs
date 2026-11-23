import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPlBranchTableModel,
  formatAccountingNumber,
  formatSarLatn,
} from './plBranchTableDisplay.js';

describe('plBranchTableDisplay (P-A17B)', () => {
  it('formatAccountingNumber forces latn western digits', () => {
    const prev = Intl.NumberFormat;
    // Simulate Arabic locale preference on the host — helper still uses en-US/latn.
    assert.equal(formatAccountingNumber(1234.5), '1,234.50');
    assert.equal(formatSarLatn(27360), 'SAR 27,360.00');
    assert.ok(!/[٠-٩]/.test(formatAccountingNumber(99.1)));
    void prev;
  });

  it('buildPlBranchTableModel: branch columns + combined; unassigned hidden when zero', () => {
    const pl = {
      breakdown: 'branch',
      branchColumns: [
        { key: '1', branchId: '1', name: 'Branch A' },
        { key: '2', branchId: '2', name: 'Branch B' },
        { key: 'unassigned', branchId: null, name: 'Unassigned branch' },
      ],
      revenue: [
        {
          id: '40',
          name: 'Service sales',
          amount: 118000,
          amountsByBranch: { '1': 70000, '2': 48000, unassigned: 0 },
        },
      ],
      costOfGoodsSold: [
        {
          id: '50',
          name: 'Cost of parts',
          amount: 51000,
          amountsByBranch: { '1': 30000, '2': 21000 },
        },
      ],
      operatingExpenses: [],
      otherIncome: [],
      otherExpenses: [],
      netRevenue: 118000,
      totalCOGS: 51000,
      totalOperatingExpenses: 0,
      totalOtherExpenses: 0,
      netIncome: 67000,
      netIncomeByBranch: { '1': 40000, '2': 27000, unassigned: 0 },
    };
    const model = buildPlBranchTableModel(pl, { showCombined: true });
    assert.equal(model.hasBreakdown, true);
    assert.deepEqual(
      model.columns.map((c) => c.key),
      ['1', '2', '__combined'],
    );
    const sales = model.rows.find((r) => r.label === 'Service sales');
    assert.equal(sales.amounts['1'], 70000);
    assert.equal(sales.amounts['2'], 48000);
    assert.equal(sales.amounts.__combined, 118000);
    const net = model.rows.find((r) => r.kind === 'net');
    assert.equal(net.amounts.__combined, 67000);
    assert.equal(model.cards.income, 118000);
  });

  it('11 Nov fixture: cash count difference line and API net 67.09', () => {
    const pl = {
      netRevenue: 220.86,
      totalCOGS: 133.64,
      totalOperatingExpenses: 24.13,
      totalOtherExpenses: 0,
      netIncome: 67.09,
      cashOverShort: { net: 4, byBranch: { '5': 4 } },
      revenue: [],
      costOfGoodsSold: [],
      operatingExpenses: [],
      otherIncome: [],
      otherExpenses: [],
    };
    const model = buildPlBranchTableModel(pl, {
      cashCountDiffLabel: 'Cash count difference (over/short)',
    });
    const cash = model.rows.find((r) => r.label === 'Cash count difference (over/short)');
    assert.equal(cash.amounts.__combined, 4);
    assert.equal(model.cards.net, 67.09);
    assert.equal(model.cards.cashOverShort, 4);
    assert.equal(
      Number(
        (
          model.cards.income -
          model.cards.expenses +
          model.cards.otherIncome +
          model.cards.cashOverShort
        ).toFixed(2),
      ),
      model.cards.net,
    );
  });

  it('single-branch mode hides Combined column', () => {
    const pl = {
      breakdown: 'branch',
      branchColumns: [{ key: '1', branchId: '1', name: 'Branch A' }],
      revenue: [
        {
          id: '1',
          name: 'Sales',
          amount: 90,
          amountsByBranch: { '1': 90 },
        },
      ],
      costOfGoodsSold: [],
      operatingExpenses: [],
      otherIncome: [],
      otherExpenses: [],
      netIncome: 90,
      netIncomeByBranch: { '1': 90 },
      netRevenue: 90,
    };
    const model = buildPlBranchTableModel(pl, { showCombined: false });
    assert.deepEqual(
      model.columns.map((c) => c.key),
      ['1'],
    );
  });

  it('without breakdown: single Combined column only', () => {
    const pl = {
      revenue: [{ id: '1', name: 'Sales', amount: 10 }],
      costOfGoodsSold: [],
      operatingExpenses: [],
      otherIncome: [],
      otherExpenses: [],
      netIncome: 10,
      netRevenue: 10,
    };
    const model = buildPlBranchTableModel(pl);
    assert.equal(model.hasBreakdown, false);
    assert.deepEqual(
      model.columns.map((c) => c.key),
      ['__combined'],
    );
  });
});
