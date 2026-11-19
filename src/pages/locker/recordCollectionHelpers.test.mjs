import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    MAX_STAGE_A_EXPENSE_LINES,
    buildStageAExpensesPayload,
    isReceivedAmountEntered,
    mergeOpenDetailFormState,
    newExpenseLine,
    pickupVarianceHalalas,
    pickupVarianceSar,
    sanitizeMoneyInput,
    stageAExpenseLineErrors,
    stageAExpensesValid,
    stageAVatNotClaimable,
    sumExpenseGross,
    sumExpenseGrossHalalas,
    toHalalas,
} from './recordCollectionHelpers.js';

const line = (p) => ({ ...newExpenseLine(), ...p });
const VALID_VAT_NO = '310123456700003';

describe('sanitizeMoneyInput', () => {
    it('digits + one dot, max 2 decimals, Arabic-Indic digits', () => {
        assert.equal(sanitizeMoneyInput('12.345'), '12.34');
        assert.equal(sanitizeMoneyInput('1.2.3'), '1.23');
        assert.equal(sanitizeMoneyInput('abc-5'), '5');
        assert.equal(sanitizeMoneyInput('\u0661\u0662\u066B\u0665'), '12.5');
        assert.equal(sanitizeMoneyInput(''), '');
    });
});

describe('buildStageAExpensesPayload', () => {
    it('uses BE RecordCollectionExpenseLineDto field names with 2-dp money strings', () => {
        const [p] = buildStageAExpensesPayload([
            line({
                purposeId: 7,
                purposeLabel: 'Fuel',
                description: ' trip ',
                gross: '80',
                vat: '10.4',
                supplierVatNumber: '310 1234 5670 0003',
                billNo: ' B-1 ',
                proofUrl: ' data:x ',
            }),
        ]);
        assert.deepEqual(p, {
            expensePurposeId: '7',
            category: 'Fuel',
            note: 'trip',
            grossAmount: '80.00',
            vatAmount: '10.40',
            supplierVatNumber: VALID_VAT_NO,
            billNo: 'B-1',
            proofUrl: 'data:x',
        });
        assert.equal('gross' in p, false);
        assert.equal('purposeId' in p, false);
    });
    it('empty optional fields → undefined, VAT 0.00', () => {
        const [p] = buildStageAExpensesPayload([line({ gross: '5', proofUrl: 'u' })]);
        assert.equal(p.vatAmount, '0.00');
        assert.equal(p.expensePurposeId, undefined);
        assert.equal(p.supplierVatNumber, undefined);
        assert.equal(p.note, undefined);
    });
});

describe('stageAExpenseLineErrors / stageAExpensesValid', () => {
    it('accepts a valid line', () => {
        assert.deepEqual(stageAExpenseLineErrors(line({ gross: '100', proofUrl: 'u' })), {});
        assert.equal(stageAExpensesValid([line({ gross: '100', proofUrl: 'u' })]), true);
    });
    it('flags gross, VAT > gross, bad VAT number and missing receipt', () => {
        const e = stageAExpenseLineErrors(line({ gross: '0', vat: '5', supplierVatNumber: '123' }));
        assert.equal(e.gross, 'record.expense.errGross');
        assert.ok(e.vatNumber);
        assert.equal(e.proof, 'record.expense.receiptRequired');
        const v = stageAExpenseLineErrors(line({ gross: '10', vat: '11', proofUrl: 'u' }));
        assert.equal(v.vat, 'record.expense.errVat');
    });
    it('no lines or more than max → invalid', () => {
        assert.equal(stageAExpensesValid([]), false);
        const many = Array.from({ length: MAX_STAGE_A_EXPENSE_LINES + 1 }, () =>
            line({ gross: '1', proofUrl: 'u' }),
        );
        assert.equal(stageAExpensesValid(many), false);
    });
});

describe('stageAVatNotClaimable', () => {
    it('VAT without a valid supplier VAT number is not claimable', () => {
        assert.equal(stageAVatNotClaimable(line({ vat: '15' })), true);
        assert.equal(stageAVatNotClaimable(line({ vat: '15', supplierVatNumber: VALID_VAT_NO })), false);
        assert.equal(stageAVatNotClaimable(line({ vat: '' })), false);
    });
});

describe('toHalalas / sumExpenseGrossHalalas', () => {
    it('avoids float drift (0.1 + 0.2) and rounds 1.005', () => {
        assert.equal(toHalalas('0.1'), 10);
        assert.equal(toHalalas('0.2'), 20);
        const lines = [line({ gross: '0.1' }), line({ gross: '0.2' })];
        assert.equal(sumExpenseGrossHalalas(lines), 30);
        assert.equal(sumExpenseGross(lines), 0.3);
        assert.equal(toHalalas('1.005'), 101);
    });
    it('Arabic-Indic digits and empty → 0', () => {
        assert.equal(toHalalas('\u0661\u0660'), 1000);
        assert.equal(toHalalas(''), 0);
    });
});

describe('received amount entry / detail form', () => {
    it('empty is not entered; typed zero is valid', () => {
        assert.equal(isReceivedAmountEntered(''), false);
        assert.equal(isReceivedAmountEntered('  '), false);
        assert.equal(isReceivedAmountEntered('0'), true);
    });
    it('loading detail does not prefill received amount', () => {
        const prev = { requestId: '', receivedAmount: '', notes: '' };
        const next = mergeOpenDetailFormState(prev, 99);
        assert.equal(next.receivedAmount, '');
        assert.equal(next.requestId, '99');
    });
});

describe('live reconciliation inputs', () => {
    it('counted 142, received 42, expense 100 → exact (integer halalas)', () => {
        const lines = [line({ gross: '100' })];
        const expenseH = sumExpenseGrossHalalas(lines);
        assert.equal(pickupVarianceHalalas(142, '42', expenseH), 0);
        assert.equal(pickupVarianceHalalas(142, '42', 0), 10000);
        assert.equal(pickupVarianceSar(142, '42', expenseH), 0);
        assert.equal(pickupVarianceSar(142, '42', 0), 100);
    });
});