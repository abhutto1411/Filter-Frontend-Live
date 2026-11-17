// CORPORATE-FIX-02-FINAL D5-4 (f): purchase default 5000, picker hides the
// corporate 5100, a saved line on it is flagged (Save disabled).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PURCHASE_COGS_LABEL,
    findPurchaseCogs,
    isUnsavedCogsPlaceholder,
    isCorporateCostAccountLabel,
    isCorporateCostOption,
    linesOnCorporateCost,
    purchaseAccountChoices,
} from './purchaseCorporateCost.js';
import { wpT } from './workshopPurchasesI18n.js';

const COA = [
    { code: '1410', name: 'Inventory Asset' },
    { code: '5000', name: 'Cost of Goods Sold' },
    { code: '5100', name: 'Cost of Corporate Services', isAutoSeed: true },
    { code: '6100', name: 'Rent Expense' },
];

test('(f) a new non-stock line defaults to 5000 - Cost of Goods Sold', () => {
    assert.equal(PURCHASE_COGS_LABEL, '5000 - Cost of Goods Sold');
    const cogs = findPurchaseCogs(COA);
    assert.equal(`${cogs.code} - ${cogs.name}`, '5000 - Cost of Goods Sold');
});

test('(f) 5000 as a heading falls through to the COGS-named leaf', () => {
    const leaves = [
        { code: '5000', name: 'Cost of Goods Sold', isHeading: true },
        { code: '5050', name: 'Cost of goods – parts' },
        { code: '5100', name: 'Cost of Corporate Services', isAutoSeed: true },
    ];
    assert.equal(findPurchaseCogs(leaves).code, '5050');
});

test('(f) unsaved legacy 5100 COGS label remaps; a saved line does not', () => {
    assert.equal(isUnsavedCogsPlaceholder({ account: '5100 - Cost of Goods Sold' }), true);
    assert.equal(isUnsavedCogsPlaceholder({ account: '5000 - Cost of Goods Sold' }), true);
    assert.equal(
        isUnsavedCogsPlaceholder({ account: '5100 - Cost of Goods Sold', loadedFromSaved: true }),
        false,
    );
    assert.equal(isUnsavedCogsPlaceholder({ account: '5100 - Cost of Corporate Services', loadedFromSaved: true }), false);
});

test('(f) COGS finder never picks the corporate row, even without 5000', () => {
    const noCogs = COA.filter((r) => r.code !== '5000');
    assert.equal(findPurchaseCogs(noCogs), null);
    const manual = [...noCogs, { code: '5050', name: 'Cost of goods – parts' }];
    assert.equal(findPurchaseCogs(manual).code, '5050');
});

test('(f) the purchase picker hides "Cost of Corporate Services"', () => {
    const shown = purchaseAccountChoices(COA);
    assert.ok(!shown.some((o) => /Cost of Corporate Services/.test(o.name)));
    assert.equal(shown.length, 3);
    // A manual 5100 (not the seeded identity) stays selectable.
    assert.equal(purchaseAccountChoices([{ code: '5100', name: 'My COGS' }]).length, 1);
    assert.equal(isCorporateCostOption({ code: '5100', name: 'Cost of Corporate Services', isAutoSeed: false }), false);
});

test('(f) an existing saved line on the corporate row is flagged (Save disabled), its account kept', () => {
    const lines = [
        { id: 'a', account: '5100 - Cost of Corporate Services' },
        { id: 'b', account: '5000 - Cost of Goods Sold' },
    ];
    const flagged = linesOnCorporateCost(lines, COA);
    assert.deepEqual(flagged.map((l) => l.id), ['a']);
    assert.equal(lines[0].account, '5100 - Cost of Corporate Services'); // unchanged
    assert.equal(isCorporateCostAccountLabel('5100 - My COGS', [{ code: '5100', name: 'My COGS' }]), false);
    assert.equal(linesOnCorporateCost([{ id: 'b', account: '5000 - Cost of Goods Sold' }], COA).length, 0);
});

test('(f) warning + 5000 label exist in EN and AR', () => {
    assert.match(wpT('en', 'line.corporateCostReserved'), /5100 is reserved for corporate cost/);
    assert.notEqual(wpT('ar', 'line.corporateCostReserved'), 'line.corporateCostReserved');
    assert.equal(wpT('ar', 'account.5000'), 'تكلفة البضاعة المباعة');
});
