import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clientValidateRow,
  computeGridTotals,
  emptyBatchRow,
  filterRowsByChip,
  formatHalalas,
  journalGroupsBalanced,
  mapPasteCellsToRowPatch,
  mapTypeToken,
  parseMoneyToHalalas,
  parsePasteBlock,
  splitInclusiveVat,
} from './bulkTransactionGrid.js';

describe('bulkTransactionGrid money', () => {
  it('parseMoneyToHalalas handles commas and decimals', () => {
    assert.equal(parseMoneyToHalalas('1,250.50'), 125050);
    assert.equal(parseMoneyToHalalas('1250.5'), 125050);
    assert.equal(formatHalalas(125050), '1250.50');
  });

  it('splitInclusiveVat S15', () => {
    const s = splitInclusiveVat('115', 15);
    assert.equal(s.gross, '115.00');
    assert.equal(s.net, '100.00');
    assert.equal(s.vat, '15.00');
  });
});

describe('paste parser', () => {
  it('parses TSV with Arabic and quotes', () => {
    const rows = parsePasteBlock('payment\t2026-11-04\t"مورد، أ"\t1150.00');
    assert.equal(rows.length, 1);
    assert.equal(rows[0][0], 'payment');
    assert.equal(rows[0][2], 'مورد، أ');
    assert.equal(rows[0][3], '1150.00');
  });

  it('maps type tokens P/R/T/J', () => {
    assert.equal(mapTypeToken('P'), 'payment');
    assert.equal(mapTypeToken('receipt'), 'receipt');
    assert.equal(mapTypeToken('T'), 'transfer');
    assert.equal(mapTypeToken('J'), 'journal');
  });

  it('mapPasteCellsToRowPatch', () => {
    const p = mapPasteCellsToRowPatch(['payment', '2026-11-04', 'R1']);
    assert.equal(p.type, 'payment');
    assert.equal(p.date, '2026-11-04');
    assert.equal(p.reference, 'R1');
  });
});

describe('validation + totals', () => {
  it('requires employee purpose', () => {
    const r = clientValidateRow(
      emptyBatchRow({
        type: 'payment',
        date: '2026-11-04',
        amount: '10',
        cashBankAccountId: '1',
        payeeType: 'Employee',
        payeeId: '9',
      }),
    );
    assert.equal(r.state, 'error');
    assert.ok(
      r.errors.some((e) => e.code === 'BATCH_ROW_EMPLOYEE_PURPOSE_REQUIRED'),
    );
  });

  it('transfer same register', () => {
    const r = clientValidateRow(
      emptyBatchRow({
        type: 'transfer',
        date: '2026-11-04',
        amount: '5',
        cashBankAccountId: '1',
        toCashBankAccountId: '1',
      }),
    );
    assert.ok(
      r.errors.some((e) => e.code === 'BATCH_ROW_TRANSFER_SAME_REGISTER'),
    );
  });

  it('journal group balance', () => {
    const rows = [
      emptyBatchRow({ type: 'journal', journalGroup: '1', debit: '45', credit: '', accountId: '1' }),
      emptyBatchRow({ type: 'journal', journalGroup: '1', debit: '', credit: '40', accountId: '2' }),
    ];
    const b = journalGroupsBalanced(rows);
    assert.equal(b.balanced, false);
    rows[1].credit = '45';
    assert.equal(journalGroupsBalanced(rows).balanced, true);
  });

  it('computeGridTotals + filter chips', () => {
    const rows = [
      {
        ...emptyBatchRow({ type: 'payment', amount: '20', date: '2026-11-04', cashBankAccountId: '1' }),
        _state: 'valid',
      },
      {
        ...emptyBatchRow({ type: 'receipt', amount: '30', date: '2026-11-04', cashBankAccountId: '1' }),
        _state: 'warning',
      },
      {
        ...emptyBatchRow({ type: 'payment', amount: '0', date: '2026-11-04' }),
        _state: 'error',
      },
    ];
    const t = computeGridTotals(rows);
    assert.equal(t.count, 3);
    assert.equal(t.valid, 1);
    assert.equal(t.warnings, 1);
    assert.equal(t.errors, 1);
    assert.equal(t.totalOut, '20.00');
    assert.equal(t.totalIn, '30.00');
    assert.equal(filterRowsByChip(rows, 'errors').length, 1);
    assert.equal(filterRowsByChip(rows, 'valid').length, 1);
  });
});

import {
  batchValidateKey,
  mergeServerValidation,
  postableLeafAccounts,
} from './bulkTransactionGrid.js';

describe('batch grid validate loop guards (8-fixes §4)', () => {
  const rows = [
    { ...emptyBatchRow({ type: 'payment', amount: '10', date: '2026-11-04' }), clientRowId: 'a', _state: 'valid', _errors: [], _warnings: [] },
    { ...emptyBatchRow({ type: 'receipt', amount: '20', date: '2026-11-04' }), clientRowId: 'b', _state: 'valid', _errors: [], _warnings: [] },
  ];
  it('mergeServerValidation returns the SAME array when nothing changed', () => {
    const server = [
      { clientRowId: 'a', state: 'valid', errors: [], warnings: [] },
      { clientRowId: 'b', state: 'valid', errors: [], warnings: [] },
    ];
    assert.equal(mergeServerValidation(rows, server), rows);
  });
  it('returns a new array (only the changed row replaced) when a row changed', () => {
    const next = mergeServerValidation(rows, [
      { clientRowId: 'a', state: 'error', errors: [{ code: 'X', field: 'amount', message: 'bad' }], warnings: [] },
    ]);
    assert.notEqual(next, rows);
    assert.equal(next[0]._state, 'error');
    assert.equal(next[1], rows[1]);
  });
  it('batchValidateKey ignores server-only fields (_state/_errors/_warnings)', () => {
    const k1 = batchValidateKey(rows, { memo: 'm' });
    const k2 = batchValidateKey(
      rows.map((r) => ({ ...r, _state: 'error', _errors: [{ code: 'Y' }], _warnings: [{ code: 'W' }] })),
      { memo: 'm' },
    );
    assert.equal(k1, k2);
    assert.notEqual(k1, batchValidateKey([{ ...rows[0], amount: '11' }, rows[1]], { memo: 'm' }));
  });
  it('postableLeafAccounts drops header accounts and parents', () => {
    const list = postableLeafAccounts([
      { id: '1', code: '6000', isHeader: true },
      { id: '2', code: '6100' },
      { id: '3', code: '6110', parentId: '2' },
    ]);
    assert.deepEqual(list.map((a) => a.id), ['3']);
  });
});
