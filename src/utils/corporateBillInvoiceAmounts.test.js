import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    collectionAmountDue,
    monthlyCollectionPlaces,
    storedInvoiceDisplayAmounts,
    sumStoredInvoiceInclusive,
} from './corporateBillInvoiceAmounts.js';

describe('storedInvoiceDisplayAmounts', () => {
    it('keeps POS Inclusive VAT when stored VAT is not exactly 15% of Excl', () => {
        const a = storedInvoiceDisplayAmounts({
            invoiceExclVat: 16.39,
            vat15: 2.61,
            salesDiscounts: 1,
            invoiceInclusiveVat: 19,
        });
        assert.equal(a.incl, 19);
        assert.equal(a.excl, 16.39);
        assert.equal(a.vat, 2.61);
    });

    it('does not drop 2.40 from a 16.00 discount book', () => {
        const lines = Array.from({ length: 16 }, () => ({
            type: 'Invoice',
            invoiceExclVat: 16.39,
            vat15: 2.61,
            salesDiscounts: 1,
            invoiceInclusiveVat: 19,
        }));
        assert.equal(sumStoredInvoiceInclusive(lines), 304);
    });
});

describe('collectionAmountDue', () => {
    it('matches BILL-0015 Place 1: 3058 − 34.01 = 3023.99', () => {
        assert.equal(
            collectionAmountDue({ opening: 0, invoices: 3058, receipts: 0, returns: 34.01 }),
            3023.99,
        );
    });

    it('does not produce the old PDF footer 3021.59', () => {
        assert.notEqual(
            collectionAmountDue({ opening: 0, invoices: 3058, receipts: 0, returns: 34.01 }),
            3021.59,
        );
    });
});

describe('monthlyCollectionPlaces', () => {
    it('locks Place 1 and Place 2 to 3058.00 / 3023.99', () => {
        const places = monthlyCollectionPlaces({
            opening: 0,
            receipts: 0,
            returns: 34.01,
            frozenInvoiceIncl: 3058,
        });
        assert.equal(places.totalInvoices, 3058);
        assert.equal(places.amountDue, 3023.99);
        assert.equal(places.tableTotal, 3023.99);
        assert.notEqual(places.totalInvoices, 3055.6);
        assert.notEqual(places.tableTotal, 3021.59);
    });
});
