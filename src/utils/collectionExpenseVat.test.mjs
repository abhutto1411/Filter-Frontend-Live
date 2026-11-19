import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    computeExpenseVat,
    expenseLineAccounting,
    expenseVatPatch,
    expenseVatTooHigh,
    inclusiveVatHalalas,
    isClaimableVatNumber,
} from './collectionExpenseVat.js';

const VAT_NO = '300000000000003';

test('Inc. VAT: 115.00 → net 100.00 + VAT 15.00', () => {
    assert.deepEqual(computeExpenseVat({ amount: '115', mode: 'inc', ratePercent: 15 }), {
        grossH: 11500,
        vatH: 1500,
        netH: 10000,
    });
});

test('Inc. VAT rounding matches backend splitInclusive (7.00 → VAT 0.91)', () => {
    assert.equal(computeExpenseVat({ amount: '7', mode: 'inc' }).vatH, 91);
    assert.equal(inclusiveVatHalalas(700, 15), 91);
});

test('Exc. VAT: net 100 → VAT 15 → total 115; net 7.01 → VAT 1.05 → 8.06', () => {
    assert.deepEqual(computeExpenseVat({ amount: '100', mode: 'exc' }), { grossH: 11500, vatH: 1500, netH: 10000 });
    assert.deepEqual(computeExpenseVat({ amount: '7.01', mode: 'exc' }), { grossH: 806, vatH: 105, netH: 701 });
});

test('No VAT: VAT 0, total = amount', () => {
    assert.deepEqual(computeExpenseVat({ amount: '50', mode: 'none' }), { grossH: 5000, vatH: 0, netH: 5000 });
});

test('uses the workshop rate (5%)', () => {
    assert.equal(computeExpenseVat({ amount: '105', mode: 'inc', ratePercent: 5 }).vatH, 500);
});

test('patch: amount change recomputes gross + VAT; mode switch keeps amount', () => {
    let line = { gross: '', vat: '' };
    line = { ...line, ...expenseVatPatch(line, { amount: '115' }) };
    assert.equal(line.gross, '115.00');
    assert.equal(line.vat, '15.00');
    line = { ...line, ...expenseVatPatch(line, { amountMode: 'exc' }) };
    assert.equal(line.amount, '115');
    assert.equal(line.gross, '132.25');
    assert.equal(line.vat, '17.25');
    line = { ...line, ...expenseVatPatch(line, { amountMode: 'none' }) };
    assert.equal(line.gross, '115.00');
    assert.equal(line.vat, '0.00');
});

test('patch: hand-typed VAT (invoice rounding) kept until the amount changes', () => {
    let line = { ...expenseVatPatch({}, { amount: '115' }) };
    line = { ...line, ...expenseVatPatch(line, { vat: '14.99' }) };
    assert.equal(line.vat, '14.99');
    assert.equal(line.gross, '115.00');
    assert.equal(line.vatEdited, true);
    line = { ...line, ...expenseVatPatch(line, { amount: '230' }) };
    assert.equal(line.vat, '30.00');
    assert.equal(line.vatEdited, false);
});

test('patch: Exc. VAT with typed VAT → gross = net + VAT', () => {
    let line = { ...expenseVatPatch({}, { amount: '100', amountMode: 'exc' }) };
    line = { ...line, ...expenseVatPatch(line, { vat: '15.01' }) };
    assert.equal(line.gross, '115.01');
});

test('old lines (gross/vat only) read as Inc. VAT', () => {
    const p = expenseVatPatch({ gross: '57.50', vat: '7.50' }, { amountMode: 'inc' });
    assert.equal(p.amount, '57.50');
    assert.equal(p.gross, '57.50');
    assert.equal(p.vat, '7.50');
});

test('accounting: valid VAT no → Dr expense net + Dr VAT; none → Dr expense gross', () => {
    const withNo = expenseLineAccounting({ gross: '115.00', vat: '15.00', supplierVatNumber: VAT_NO });
    assert.equal(withNo.claimable, true);
    assert.equal(withNo.expenseDebitH, 10000);
    assert.equal(withNo.vatDebitH, 1500);
    const noNo = expenseLineAccounting({ gross: '115.00', vat: '15.00', supplierVatNumber: '' });
    assert.equal(noNo.claimable, false);
    assert.equal(noNo.expenseDebitH, 11500);
    assert.equal(noNo.vatDebitH, 0);
    assert.equal(expenseLineAccounting({ gross: '115.00', vat: '15.00', supplierVatNumber: '12345' }).claimable, false);
});

test('VAT number check accepts spaced input, rejects bad ones', () => {
    assert.equal(isClaimableVatNumber('3000 0000 0000 003'), true);
    assert.equal(isClaimableVatNumber('100000000000003'), false);
    assert.equal(isClaimableVatNumber(''), false);
});

test('VAT above inclusive VAT (+1 halala) is flagged — screenshot case 7.00 / 1.50', () => {
    assert.equal(expenseVatTooHigh({ gross: '7.00', vat: '1.50' }), true);
    assert.equal(expenseVatTooHigh({ gross: '7.00', vat: '0.92' }), false);
    assert.equal(expenseVatTooHigh({ gross: '7.00', vat: '0.93' }), true);
    assert.equal(expenseVatTooHigh({ gross: '8.06', vat: '1.05' }), false);
});
