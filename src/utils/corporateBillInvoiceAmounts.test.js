import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildBillAmountSummaryLines,
    collectionAmountDue,
    invoiceBillBreakdown,
    monthlyCollectionPlaces,
    storedInvoiceDisplayAmounts,
    sumBillBreakdowns,
    sumStoredInvoiceInclusive,
} from './corporateBillInvoiceAmounts.js';

/** Lava Plus Trading — September 2026 corporate bill (BILL-0101-20260901-001). */
const LAVA_SEP_2026 = [
    { invoiceNo: 'INV-46717', invoiceExclVat: 112.17, vat15: 16.83, salesDiscounts: 0, invoiceInclusiveVat: 129 },
    { invoiceNo: 'INV-50396', invoiceExclVat: 85.65, vat15: 12.85, salesDiscounts: 0, invoiceInclusiveVat: 98.5 },
    { invoiceNo: 'INV-53153', invoiceExclVat: 106.96, vat15: 16.04, salesDiscounts: 0, invoiceInclusiveVat: 123 },
    { invoiceNo: 'INV-53154', invoiceExclVat: 151.71, vat15: 22.76, salesDiscounts: 2.2, invoiceInclusiveVat: 174.47 },
];

describe('invoiceBillBreakdown', () => {
    it('matches the INV-53154 tax invoice: 153.91 − 2.20 = 151.71 + 22.76 = 174.47', () => {
        const b = invoiceBillBreakdown(LAVA_SEP_2026[3]);
        assert.deepEqual(b, { grossExcl: 153.91, discount: 2.2, taxable: 151.71, vat: 22.76, total: 174.47 });
    });

    it('bill totals are the sum of invoices (456.49 / 68.48), not a re-split of 524.97', () => {
        const t = sumBillBreakdowns(LAVA_SEP_2026.map(invoiceBillBreakdown));
        assert.deepEqual(t, { grossExcl: 458.69, discount: 2.2, taxable: 456.49, vat: 68.48, total: 524.97 });
        assert.equal(Number((t.grossExcl - t.discount).toFixed(2)), t.taxable);
        assert.equal(Number((t.taxable + t.vat).toFixed(2)), t.total);
        assert.notEqual(t.taxable, 456.5);
        assert.notEqual(t.vat, 68.47);
    });
});

describe('buildBillAmountSummaryLines', () => {
    const invoiceTotals = sumBillBreakdowns(LAVA_SEP_2026.map(invoiceBillBreakdown));

    it('shows exactly the five tax-invoice lines when there is no opening / return / receipt', () => {
        const s = buildBillAmountSummaryLines({ invoiceTotals });
        assert.deepEqual(
            s.lines.map((l) => [l.key, l.amount]),
            [['grossExcl', 458.69], ['discount', 2.2], ['taxable', 456.49], ['vat', 68.48], ['due', 524.97]],
        );
        assert.equal(s.amountDue, 524.97);
    });

    it('adds opening / returns / receipts lines only when they change the amount due', () => {
        const s = buildBillAmountSummaryLines({ invoiceTotals, opening: 100, returns: 34.01, receipts: 50 });
        assert.deepEqual(
            s.lines.map((l) => l.key),
            ['grossExcl', 'discount', 'taxable', 'vat', 'invoices', 'opening', 'returns', 'receipts', 'due'],
        );
        assert.equal(s.amountDue, 540.96);
    });
});

describe('storedInvoiceDisplayAmounts', () => {
    it('keeps POS Inclusive VAT and re-splits it when stored VAT is not 15% of Excl', () => {
        const a = storedInvoiceDisplayAmounts({
            invoiceExclVat: 16.39,
            vat15: 2.61,
            salesDiscounts: 1,
            invoiceInclusiveVat: 19,
        });
        assert.equal(a.incl, 19);
        assert.equal(a.excl, 16.52);
        assert.equal(a.vat, 2.48);
    });

    it('re-splits INV-46134 (SAR 4 discount): VAT 15% of the discounted amount, total 81', () => {
        const a = storedInvoiceDisplayAmounts({
            invoiceExclVat: 69.91,
            vat15: 11.09,
            salesDiscounts: 4,
            invoiceInclusiveVat: 81,
        });
        assert.deepEqual([a.excl, a.vat, a.incl], [70.43, 10.57, 81]);
    });

    it('keeps zero-VAT invoices unchanged', () => {
        const a = storedInvoiceDisplayAmounts({ invoiceExclVat: 50, vat15: 0, invoiceInclusiveVat: 50 });
        assert.deepEqual([a.excl, a.vat, a.incl], [50, 0, 50]);
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
