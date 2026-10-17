import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    classifyCorporateBillPayment,
    parseCorporateReceivedAmount,
    remainingAfterCorporateReceipt,
} from './corporateBillPayment.js';

describe('classifyCorporateBillPayment', () => {
    it('classifies equal as paid, less as partial, more as overpaid', () => {
        assert.equal(classifyCorporateBillPayment(687.5, 687.5), 'paid');
        assert.equal(classifyCorporateBillPayment(687.5, 400), 'partially_paid');
        assert.equal(classifyCorporateBillPayment(687.5, 800), 'overpaid');
    });
});

describe('remainingAfterCorporateReceipt', () => {
    it('keeps leftover only on partial', () => {
        assert.equal(remainingAfterCorporateReceipt(687.5, 400), 287.5);
        assert.equal(remainingAfterCorporateReceipt(687.5, 687.5), 0);
        assert.equal(remainingAfterCorporateReceipt(687.5, 800), 0);
    });
});

describe('parseCorporateReceivedAmount', () => {
    it('parses to 2dp and rejects empty', () => {
        assert.equal(parseCorporateReceivedAmount('400.129'), 400.13);
        assert.equal(Number.isNaN(parseCorporateReceivedAmount('')), true);
    });
});
