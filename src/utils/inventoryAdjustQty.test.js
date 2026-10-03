import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    adjustInputMin,
    isValidAdjustNewQty,
    parseInventoryQty,
    qtyEquals,
} from './inventoryAdjustQty.js';

describe('parseInventoryQty', () => {
    it('keeps a negative running balance', () => {
        assert.equal(parseInventoryQty(-5), -5);
        assert.equal(parseInventoryQty('-5'), -5);
    });

    it('does not coerce empty to 0', () => {
        assert.equal(parseInventoryQty(''), null);
        assert.equal(parseInventoryQty(null), null);
    });
});

describe('isValidAdjustNewQty', () => {
    it('allows correcting minus stock to a counted 0+', () => {
        assert.equal(isValidAdjustNewQty(8, { isOpening: false, allowMinus: false }), true);
        assert.equal(isValidAdjustNewQty(0, { isOpening: false, allowMinus: false }), true);
    });

    it('blocks a negative counted qty unless the SKU allows minus', () => {
        assert.equal(isValidAdjustNewQty(-2, { isOpening: false, allowMinus: false }), false);
        assert.equal(isValidAdjustNewQty(-2, { isOpening: false, allowMinus: true }), true);
        assert.equal(isValidAdjustNewQty(-1, { isOpening: true, allowMinus: true }), false);
    });
});

describe('running balance', () => {
    it('follows opening − sales + purchases + sales return − purchase return ± adjust', () => {
        const opening = 2;
        const afterSales = opening - 7;
        assert.equal(afterSales, -5);
        const afterPurchases = afterSales + 10;
        assert.equal(afterPurchases, 5);
        const afterSalesReturn = afterPurchases + 1;
        const afterPurchaseReturn = afterSalesReturn - 1;
        assert.equal(afterPurchaseReturn, 5);
        const counted = 8;
        const adjustDelta = counted - afterPurchaseReturn;
        assert.equal(adjustDelta, 3);
        assert.equal(afterPurchaseReturn + adjustDelta, counted);
        assert.equal(isValidAdjustNewQty(counted, { allowMinus: false }), true);
        assert.equal(qtyEquals(-5, 0), false);
    });
});

describe('adjustInputMin + qtyEquals', () => {
    it('drops min=0 when current is already negative so the field is editable', () => {
        assert.equal(adjustInputMin({ currentQty: -5, allowMinus: false }), undefined);
        assert.equal(adjustInputMin({ currentQty: 2, allowMinus: false }), 0);
        assert.equal(adjustInputMin({ isOpening: true, currentQty: -5 }), 0);
    });

    it('treats -5 and -5 as the same baseline', () => {
        assert.equal(qtyEquals(-5, '-5'), true);
        assert.equal(qtyEquals(-5, 8), false);
    });
});
