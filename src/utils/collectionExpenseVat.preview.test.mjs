import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCollectionRecordJournalPreview,
    validateStageBExpenseLines,
} from './lockerCitDisplay.js';
import {
    expensesForJournalPreview,
    stageAExpenseLineErrors,
} from '../pages/locker/recordCollectionHelpers.js';

const VAT_NO = '300000000000003';

function preview(lines, extra = {}) {
    return buildCollectionRecordJournalPreview({
        expected: 1000,
        received: 885,
        citEnabled: false,
        debitCode: '1004',
        debitName: 'Locker Vault Cash',
        branchLabel: 'Al Basateen',
        expenses: expensesForJournalPreview(lines),
        ...extra,
    });
}
const simple = (j) => j.lines.map((l) => `${l.side} ${l.code} ${Number(l.amount).toFixed(2)}`);

test('on-approval JE: valid VAT no → Dr chosen account net + Dr 1310 VAT / Cr clearing gross', () => {
    const p = preview(
        [{ gross: '115.00', vat: '15.00', supplierVatNumber: VAT_NO, expenseAccountCode: '7001', expenseAccountName: 'Water Purchases' }],
        { clearingCode: '1158', clearingName: 'Collection expense claims — pending approval' },
    );
    const approval = p.journals.find((j) => j.title === 'on approval');
    assert.deepEqual(simple(approval), ['Dr 7001 100.00', 'Dr 1310 15.00', 'Cr 1158 115.00']);
    // JE1 pickup debits the real clearing code too (not a hard-coded 1156)
    assert.ok(simple(p.journals[0]).includes('Dr 1158 115.00'));
});

test('on-approval JE: no VAT number → Dr chosen account gross (VAT is a cost), no 1310 line', () => {
    const p = preview([{ gross: '115.00', vat: '15.00', expenseAccountCode: '7001', expenseAccountName: 'Water Purchases' }]);
    const approval = p.journals.find((j) => j.title === 'on approval');
    assert.deepEqual(simple(approval), ['Dr 7001 115.00', 'Cr 1156 115.00']);
});

test('on-approval JE never invents 6110 when no account is picked yet', () => {
    const p = preview([{ gross: '115.00', vat: '0' }]);
    const approval = p.journals.find((j) => j.title === 'on approval');
    assert.equal(approval.lines[0].code, '—');
});

test('Stage A line errors: VAT above the VAT inside the total', () => {
    assert.equal(
        stageAExpenseLineErrors({ gross: '7.00', vat: '1.50', expenseAccountId: '1' }).vat,
        'record.expense.errVatTooHigh',
    );
    assert.equal(stageAExpenseLineErrors({ gross: '7.00', vat: '0.91', expenseAccountId: '1' }).vat, undefined);
});

test('Stage B validator: VAT too high and bad VAT number', () => {
    assert.equal(
        validateStageBExpenseLines([{ gross: '7.00', vat: '1.50', expenseAccountId: '1' }]).errorKey,
        'cit.receive.exp.errVatTooHigh',
    );
    assert.equal(
        validateStageBExpenseLines([{ gross: '115.00', vat: '15.00', expenseAccountId: '1', supplierVatNumber: '123' }]).errorKey,
        'cit.receive.exp.errVatNumber',
    );
    assert.equal(
        validateStageBExpenseLines([{ gross: '115.00', vat: '15.00', expenseAccountId: '1', supplierVatNumber: VAT_NO }]).ok,
        true,
    );
});
