import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commissionReturnSlip, readCommissionLineExtras, readReturnDeduction } from './commissionPayoutLine.js';

describe('commission return deduction', () => {
    it('reads the three labelled amounts as the strings the API sent', () => {
        const deduction = readReturnDeduction({
            returned_amount: '115.00',
            original_commission: '11.50',
            payable_after_return: '-2.00',
        });
        assert.deepEqual(deduction, {
            returnedAmount: '115.00',
            originalCommission: '11.50',
            payableAfterReturn: '-2.00',
        });
    });

    it('accepts camelCase and returns null when the deduction is absent', () => {
        assert.equal(readReturnDeduction(null), null);
        assert.equal(readReturnDeduction(undefined), null);
        assert.equal(readReturnDeduction({}), null);
        const deduction = readReturnDeduction({
            returnedAmount: '10.00',
            originalCommission: '1.00',
            payableAfterReturn: '0.00',
        });
        assert.equal(deduction.payableAfterReturn, '0.00');
    });

    it('keeps a normal line unchanged and marks a return row', () => {
        const plain = readCommissionLineExtras({
            service_name: 'Oil change',
            amount: '115.00',
            job_card_ref: 'JC-4',
            return_deduction: null,
        });
        assert.equal(plain.returnDeduction, null);
        assert.equal(plain.amountDisplay, null);
        assert.equal(plain.service, 'Oil change');
        assert.equal(plain.jobCardRef, 'JC-4');
        assert.equal(plain.payoutNotes, '');

        const ret = readCommissionLineExtras({
            service_name: 'Oil change',
            payout_notes: 'Deducted from the next payout',
            job_card_ref: 'RET-4-L1',
            amount: '-2.00',
            return_deduction: {
                returned_amount: '115.00',
                original_commission: '11.50',
                payable_after_return: '-2.00',
            },
        });
        assert.equal(ret.jobCardRef, 'RET-4-L1');
        assert.equal(ret.payoutNotes, 'Deducted from the next payout');
        assert.equal(ret.amountDisplay, '-2.00');
        assert.equal(ret.returnDeduction.returnedAmount, '115.00');
        assert.equal(ret.returnDeduction.originalCommission, '11.50');
        assert.equal(ret.returnDeduction.payableAfterReturn, '-2.00');
    });

    it('builds a payout slip only for a return row', () => {
        assert.equal(commissionReturnSlip({ id: '1', returnDeduction: null }), null);
        const slip = commissionReturnSlip({
            id: '9',
            employee: 'Sara',
            service: 'Oil change',
            payoutNotes: 'Next payout',
            jobCardRef: 'RET-4-L1',
            amountDisplay: '-2.00',
            returnDeduction: {
                returnedAmount: '115.00',
                originalCommission: '11.50',
                payableAfterReturn: '-2.00',
            },
        });
        assert.equal(slip.jobCardRef, 'RET-4-L1');
        assert.equal(slip.returnDeduction.payableAfterReturn, '-2.00');
    });
});
