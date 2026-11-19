import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildReceiveJournalPreview,
  buildStageBExpensesPayload,
  isLockerExpenseClaimRow,
  mapVarianceApprovalRows,
  stageBBranchOptions,
  validateStageBExpenseLines,
} from './lockerCitDisplay.js';

const sum = (lines, k) => lines.reduce((s, l) => s + Math.round(Number(l[k] || 0) * 100), 0);

describe('Stage B receive preview with expenses', () => {
  it('§5.4: expected 1150, counted 920, expense 80 → 1156 80, 1153 150, balanced', () => {
    const p = buildReceiveJournalPreview({
      countedAmount: 920,
      expectedAmount: 1150,
      expenses: [{ gross: '80', label: 'Fuel', branchLabel: 'Riyadh' }],
    });
    assert.equal(p.expensesTotal, 80);
    assert.equal(p.difference, -150);
    assert.equal(p.aboveExpected, false);
    assert.equal(p.balanced, true);
    assert.equal(sum(p.lines, 'dr'), sum(p.lines, 'cr'));
    const exp = p.lines.find((l) => l.pending);
    assert.equal(exp.dr, 80);
    assert.equal(exp.branchLabel, 'Riyadh');
    assert.ok(p.lines.some((l) => l.account.startsWith('1153') && l.dr === 150));
  });
  it('E5: counted + expenses above expected is flagged and not balanced', () => {
    const p = buildReceiveJournalPreview({
      countedAmount: 1100,
      expectedAmount: 1150,
      expenses: [{ gross: '60.01' }],
    });
    assert.equal(p.aboveExpected, true);
    assert.equal(p.balanced, false);
  });
  it('exact: counted 0 + expenses = expected → no 1004 line, no 1153', () => {
    const p = buildReceiveJournalPreview({
      countedAmount: 0,
      expectedAmount: 100.1,
      expenses: [{ gross: '0.1' }, { gross: '100' }],
    });
    assert.equal(p.balanced, true);
    assert.ok(!p.lines.some((l) => l.account.startsWith('1004')));
    assert.ok(!p.lines.some((l) => l.account.startsWith('1153')));
  });
});

describe('stageBBranchOptions', () => {
  it('only selected collections, largest branch first', () => {
    const opts = stageBBranchOptions(
      [
        { id: '1', branchId: '7', branchName: 'A', amount: 100 },
        { id: '2', branchId: '9', branchName: 'B', amount: 300 },
        { id: '3', branchId: '7', branchName: 'A', amount: 250 },
        { id: '4', branchId: '5', branchName: 'C', amount: 999 },
      ],
      ['1', '2', '3'],
    );
    assert.deepEqual(opts.map((o) => o.id), ['7', '9']);
  });
});

describe('validateStageBExpenseLines', () => {
  const ok = { gross: '10.50', vat: '1.37', proofUrl: 'https://x/r.jpg' };
  it('accepts valid lines', () => {
    assert.equal(validateStageBExpenseLines([ok]).ok, true);
  });
  it('rejects none / >10 / bad gross / vat > gross / missing proof', () => {
    assert.equal(validateStageBExpenseLines([]).errorKey, 'cit.receive.exp.errNone');
    assert.equal(validateStageBExpenseLines(Array(11).fill(ok)).errorKey, 'cit.receive.exp.errMax');
    assert.equal(validateStageBExpenseLines([{ ...ok, gross: '0' }]).errorKey, 'cit.receive.exp.errGross');
    assert.equal(validateStageBExpenseLines([{ ...ok, gross: '1.005' }]).errorKey, 'cit.receive.exp.errGross');
    assert.equal(validateStageBExpenseLines([{ ...ok, vat: '11' }]).errorKey, 'cit.receive.exp.errVat');
    const r = validateStageBExpenseLines([ok, { ...ok, proofUrl: ' ' }]);
    assert.equal(r.errorKey, 'cit.receive.exp.errProof');
    assert.equal(r.index, 1);
  });
});

describe('buildStageBExpensesPayload', () => {
  it('2-dp strings and BE field names', () => {
    const [l] = buildStageBExpensesPayload([
      { category: ' Fuel ', gross: '80', vat: '', proofUrl: ' u ', branchId: 7 },
    ]);
    assert.deepEqual(l, {
      category: 'Fuel',
      grossAmount: '80.00',
      vatAmount: '0.00',
      proofUrl: 'u',
      note: undefined,
      branchId: '7',
      billNo: undefined,
      supplierVatNumber: undefined,
    });
  });
});

describe('expense claim rows in locker Approvals', () => {
  it('are detected so they never hit approve-difference', () => {
    const [claim, coll] = mapVarianceApprovalRows([
      { id: '5', kind: 'expense_claim', stage: 'expense_claim', claimStage: 'vault_receive' },
      { id: '5', kind: 'collection', stage: 'pickup' },
    ]);
    assert.equal(isLockerExpenseClaimRow(claim), true);
    assert.equal(claim.claimStage, 'vault_receive');
    assert.equal(isLockerExpenseClaimRow(coll), false);
  });
});
