import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCashBankSummaryCards,
  cashBankRegisterClass,
  displayCashBankBalance,
  filterCashBankAccounts,
  formatMoneyString,
  hasOtherRegisterClass,
  isReconcileFinishEnabled,
  mapCashBankAccountFromApi,
  pageTickIds,
  reconcileErrorKey,
  reconcileUiState,
} from './cashBankScreen.js';

function row(partial) {
  return mapCashBankAccountFromApi({
    id: partial.id,
    name: partial.name || `A${partial.id}`,
    type: partial.type || 'CASH',
    kind: partial.kind ?? 'OPERATING',
    balance: partial.balance ?? 0,
    balanceSource: partial.balanceSource || 'stored',
    branchId: partial.branchId || '1',
    branch: { name: partial.branchName || 'B1' },
    coaAccount: partial.code
      ? { id: partial.id, code: partial.code, name: partial.name || 'COA' }
      : undefined,
    sharedCoaWith: partial.sharedCoaWith,
  });
}

describe('cashBankRegisterClass', () => {
  it('classifies BANK by apiType', () => {
    assert.equal(
      cashBankRegisterClass(row({ id: '1', type: 'BANK', kind: 'OPERATING', code: '1010' })),
      'BANK',
    );
  });

  it('classifies till by kind SYSTEM_CASHIER_TILL', () => {
    assert.equal(
      cashBankRegisterClass(
        row({
          id: '2',
          type: 'CASH',
          kind: 'SYSTEM_CASHIER_TILL',
          code: '1001-C5',
          name: 'Cashier Till — A',
        }),
      ),
      'CASHIER_TILL',
    );
  });

  it('classifies wallet by kind SYSTEM_PETTY_CASH_WALLET', () => {
    assert.equal(
      cashBankRegisterClass(
        row({
          id: '3',
          type: 'PETTY_CASH',
          kind: 'SYSTEM_PETTY_CASH_WALLET',
          code: '1003-C5',
        }),
      ),
      'PETTY_WALLET',
    );
  });

  it('classifies locker by kind SYSTEM_LOCKER_VAULT', () => {
    assert.equal(
      cashBankRegisterClass(
        row({
          id: '4',
          type: 'CASH',
          kind: 'SYSTEM_LOCKER_VAULT',
          code: '1004',
          name: 'Locker Cash',
        }),
      ),
      'LOCKER',
    );
  });

  it('classifies operating CASH with code 1003 as CASH_ON_HAND (not wallet)', () => {
    assert.equal(
      cashBankRegisterClass(
        row({
          id: '5',
          type: 'CASH',
          kind: 'OPERATING',
          code: '1003',
          name: 'Cash On Hand — Branch A',
        }),
      ),
      'CASH_ON_HAND',
    );
  });

  it('falls back to 1001-C* / 1003-C* / 1004 when kind missing', () => {
    assert.equal(
      cashBankRegisterClass(
        row({ id: '6', type: 'CASH', kind: '', code: '1001-C9' }),
      ),
      'CASHIER_TILL',
    );
    assert.equal(
      cashBankRegisterClass(
        row({ id: '7', type: 'CASH', kind: '', code: '1003-C9' }),
      ),
      'PETTY_WALLET',
    );
    assert.equal(
      cashBankRegisterClass(
        row({ id: '8', type: 'CASH', kind: '', code: '1004' }),
      ),
      'LOCKER',
    );
  });

  it('PETTY_CASH without wallet kind → PETTY_WALLET', () => {
    assert.equal(
      cashBankRegisterClass(
        row({ id: '9', type: 'PETTY_CASH', kind: 'OPERATING', code: '1280' }),
      ),
      'PETTY_WALLET',
    );
  });
});

describe('buildCashBankSummaryCards (FIX3 classes)', () => {
  it('0 rows → empty', () => {
    assert.deepEqual(buildCashBankSummaryCards([]), []);
  });

  it('1 till → one till account card', () => {
    const cards = buildCashBankSummaryCards([
      row({
        id: '1',
        type: 'CASH',
        kind: 'SYSTEM_CASHIER_TILL',
        code: '1001-C1',
        balance: 40,
        name: 'Till 1',
      }),
    ]);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].registerClass, 'CASHIER_TILL');
    assert.equal(cards[0].balance, 40);
  });

  it('3 mixed → three account cards', () => {
    const cards = buildCashBankSummaryCards([
      row({
        id: '1',
        type: 'CASH',
        kind: 'OPERATING',
        code: '1003',
        balance: 10,
        name: 'Cash On Hand',
      }),
      row({
        id: '2',
        type: 'CASH',
        kind: 'SYSTEM_CASHIER_TILL',
        code: '1001-C1',
        balance: 20,
      }),
      row({ id: '3', type: 'BANK', kind: 'OPERATING', code: '1010', balance: 30 }),
    ]);
    assert.equal(cards.length, 3);
    assert.equal(cards[0].registerClass, 'CASH_ON_HAND');
    assert.equal(cards[1].registerClass, 'CASHIER_TILL');
    assert.equal(cards[2].registerClass, 'BANK');
  });

  it('10 tills only → one Tills total card', () => {
    const tills = Array.from({ length: 10 }, (_, i) =>
      row({
        id: String(i + 1),
        type: 'CASH',
        kind: 'SYSTEM_CASHIER_TILL',
        code: `1001-C${i + 1}`,
        balance: 2,
      }),
    );
    const cards = buildCashBankSummaryCards(tills);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].registerClass, 'CASHIER_TILL');
    assert.equal(cards[0].balance, 20);
    assert.equal(cards[0].accountCount, 10);
  });

  it('1 cash-on-hand + 9 tills → two class totals with correct sums', () => {
    const rows = [
      row({
        id: '1',
        type: 'CASH',
        kind: 'OPERATING',
        code: '1003',
        balance: 100,
        name: 'Cash On Hand',
      }),
      ...Array.from({ length: 9 }, (_, i) =>
        row({
          id: String(i + 2),
          type: 'CASH',
          kind: 'SYSTEM_CASHIER_TILL',
          code: `1001-C${i + 2}`,
          balance: 5,
        }),
      ),
    ];
    const cards = buildCashBankSummaryCards(rows);
    assert.equal(cards.length, 2);
    assert.equal(cards[0].registerClass, 'CASH_ON_HAND');
    assert.equal(cards[0].accountCount, 1);
    assert.equal(cards[0].balance, 100);
    assert.equal(cards[1].registerClass, 'CASHIER_TILL');
    assert.equal(cards[1].accountCount, 9);
    assert.equal(cards[1].balance, 45);
  });

  it('wallets + locker + bank mix → three totals', () => {
    const rows = [
      row({
        id: '1',
        type: 'PETTY_CASH',
        kind: 'SYSTEM_PETTY_CASH_WALLET',
        code: '1003-C1',
        balance: 1,
      }),
      row({
        id: '2',
        type: 'PETTY_CASH',
        kind: 'SYSTEM_PETTY_CASH_WALLET',
        code: '1003-C2',
        balance: 2,
      }),
      row({
        id: '3',
        type: 'CASH',
        kind: 'SYSTEM_LOCKER_VAULT',
        code: '1004',
        balance: 8,
      }),
      row({ id: '4', type: 'BANK', kind: 'OPERATING', code: '1010', balance: 50 }),
    ];
    const cards = buildCashBankSummaryCards(rows);
    assert.deepEqual(
      cards.map((c) => [c.registerClass, c.balance, c.accountCount]),
      [
        ['PETTY_WALLET', 3, 2],
        ['LOCKER', 8, 1],
        ['BANK', 50, 1],
      ],
    );
  });

  it('shared_coa secondary excluded from sum and count', () => {
    const cards = buildCashBankSummaryCards([
      row({
        id: '1',
        type: 'CASH',
        kind: 'OPERATING',
        code: '1003',
        balance: 99.5,
        balanceSource: 'gl',
      }),
      row({
        id: '2',
        type: 'CASH',
        kind: 'OPERATING',
        code: '1003',
        balance: 3,
        balanceSource: 'shared_coa',
        sharedCoaWith: ['1'],
      }),
      row({
        id: '3',
        type: 'CASH',
        kind: 'SYSTEM_CASHIER_TILL',
        code: '1001-C1',
        balance: 10,
      }),
      row({
        id: '4',
        type: 'CASH',
        kind: 'SYSTEM_CASHIER_TILL',
        code: '1001-C2',
        balance: 1,
      }),
    ]);
    const cash = cards.find((c) => c.registerClass === 'CASH_ON_HAND');
    assert.equal(cash.balance, 99.5);
    assert.equal(cash.accountCount, 1);
    const tills = cards.find((c) => c.registerClass === 'CASHIER_TILL');
    assert.equal(tills.balance, 11);
    assert.equal(tills.accountCount, 2);
  });

  it('negative flag', () => {
    const cards = buildCashBankSummaryCards([
      row({
        id: '1',
        type: 'CASH',
        kind: 'SYSTEM_CASHIER_TILL',
        code: '1001-C1',
        balance: -12,
      }),
    ]);
    assert.equal(cards[0].negative, true);
    assert.equal(cards[0].balance, -12);
  });

  it('Type filter = Cashier tills → only till rows/cards', () => {
    const all = [
      row({
        id: '1',
        type: 'CASH',
        kind: 'OPERATING',
        code: '1003',
        balance: 100,
      }),
      row({
        id: '2',
        type: 'CASH',
        kind: 'SYSTEM_CASHIER_TILL',
        code: '1001-C1',
        balance: 5,
      }),
      row({
        id: '3',
        type: 'CASH',
        kind: 'SYSTEM_CASHIER_TILL',
        code: '1001-C2',
        balance: 7,
      }),
    ];
    const filtered = filterCashBankAccounts(all, { type: 'CASHIER_TILL' });
    assert.equal(filtered.length, 2);
    const cards = buildCashBankSummaryCards(filtered);
    assert.equal(cards.length, 2);
    assert.ok(cards.every((c) => c.registerClass === 'CASHIER_TILL'));
    assert.equal(
      cards.reduce((s, c) => s + c.balance, 0),
      12,
    );
  });

  it('keeps workshop-shared (empty branchId) registers when a branch is selected', () => {
    const pakistan = row({
      id: '10',
      type: 'CASH',
      kind: 'SYSTEM_CASHIER_TILL',
      code: '1001-C1',
      branchId: '55',
    });
    const otherBranch = row({
      id: '11',
      type: 'CASH',
      kind: 'SYSTEM_CASHIER_TILL',
      code: '1001-C2',
      branchId: '99',
    });
    const sharedBank = mapCashBankAccountFromApi({
      id: '12',
      name: 'Operating Bank — Control',
      type: 'BANK',
      kind: 'OPERATING',
      balance: 50,
      balanceSource: 'gl',
      branchId: null,
      coaAccount: { id: '12', code: '1014', name: 'Operating Bank — Control' },
    });
    const filtered = filterCashBankAccounts(
      [pakistan, otherBranch, sharedBank],
      { branchId: '55' },
    );
    assert.deepEqual(
      filtered.map((a) => a.id),
      ['10', '12'],
    );
  });
});

describe('hasOtherRegisterClass', () => {
  it('detects OTHER presence', () => {
    assert.equal(
      hasOtherRegisterClass([
        row({ id: '1', type: 'CASH', kind: 'OPERATING', code: '1003' }),
      ]),
      false,
    );
    const weird = {
      id: '9',
      name: 'Odd',
      apiType: 'CASH',
      kind: 'CUSTOM_KIND',
      coaLink: '9999 · Odd',
      balance: 1,
    };
    assert.equal(cashBankRegisterClass(weird), 'OTHER');
    assert.equal(hasOtherRegisterClass([weird]), true);
  });
});

describe('displayCashBankBalance smoke', () => {
  it('reads balance', () => {
    assert.equal(displayCashBankBalance({ balance: 1.5 }), 1.5);
  });
});

describe('reconcileUiState', () => {
  it('covers every branch', () => {
    assert.equal(reconcileUiState({ canView: false }), 'no-access');
    assert.equal(reconcileUiState({ canView: true, hasBank: false }), 'pick-bank');
    assert.equal(
      reconcileUiState({ canView: true, hasBank: true, loading: true }),
      'loading',
    );
    assert.equal(
      reconcileUiState({
        canView: true,
        hasBank: true,
        loading: false,
        error: 'x',
      }),
      'error',
    );
    assert.equal(
      reconcileUiState({
        canView: true,
        hasBank: true,
        state: { draft: { id: '1' } },
      }),
      'draft',
    );
    assert.equal(
      reconcileUiState({
        canView: true,
        hasBank: true,
        state: { draft: null },
      }),
      'no-draft',
    );
  });
});

describe('reconcileErrorKey', () => {
  const codes = [
    'RECONCILE_NOT_BANK',
    'RECONCILE_SHARED_COA',
    'RECONCILE_DIFFERENCE_NOT_ZERO',
    'RECONCILE_NO_ITEMS',
    'RECONCILE_DATE_BEFORE_LAST',
    'RECONCILE_DATE_IN_FUTURE',
    'RECONCILE_BUSY',
    'RECONCILE_LINE_ALREADY_CLEARED',
    'RECONCILE_LINE_INELIGIBLE',
    'RECONCILE_UNDO_ONLY_LATEST',
    'RECONCILE_UNDO_REASON',
    'RECONCILE_NO_DRAFT',
  ];
  for (const code of codes) {
    it(`maps ${code}`, () => {
      const r = reconcileErrorKey({ code });
      assert.ok(r.key.startsWith('cb.recon.err.'));
    });
  }
  it('passes primaryRegisterId and difference', () => {
    const shared = reconcileErrorKey({
      code: 'RECONCILE_SHARED_COA',
      primaryRegisterId: '99',
    });
    assert.equal(shared.params.primaryRegisterId, '99');
    const diff = reconcileErrorKey({
      code: 'RECONCILE_DIFFERENCE_NOT_ZERO',
      difference: '450.00',
    });
    assert.equal(diff.params.difference, '450.00');
  });
  it('unknown → generic with message', () => {
    const r = reconcileErrorKey({ message: 'boom' });
    assert.equal(r.key, 'cb.recon.err.generic');
    assert.equal(r.params.message, 'boom');
  });
});

describe('isReconcileFinishEnabled', () => {
  it('true only for 0.00 + tickedCount ≥ 1', () => {
    assert.equal(
      isReconcileFinishEnabled({ difference: '0.00', tickedCount: 1 }),
      true,
    );
    assert.equal(
      isReconcileFinishEnabled({ difference: '0.00', tickedCount: 0 }),
      false,
    );
    for (const bad of ['0', '0.0', '-0.00', 0, '0.01', '-0.01', null]) {
      assert.equal(
        isReconcileFinishEnabled(
          bad === null ? null : { difference: bad, tickedCount: 2 },
        ),
        false,
      );
    }
  });
});

describe('formatMoneyString', () => {
  it('formats Western digits without Number()', () => {
    assert.equal(formatMoneyString('1234.5').text, '1,234.50');
    assert.equal(formatMoneyString('-1150.00').isNegative, true);
    assert.equal(formatMoneyString('-1150.00').text, '-1,150.00');
    assert.equal(formatMoneyString('0').text, '0.00');
    assert.equal(formatMoneyString('1234567.89').text, '1,234,567.89');
  });
});

describe('pageTickIds', () => {
  it('returns ids whose ticked differs', () => {
    const items = [
      { journalLineId: '1', ticked: true },
      { journalLineId: '2', ticked: false },
      { journalLineId: '3', ticked: false },
    ];
    assert.deepEqual(pageTickIds(items, true), ['2', '3']);
    assert.deepEqual(pageTickIds(items, false), ['1']);
  });
});
