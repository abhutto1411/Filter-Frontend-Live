import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDistributionPreviewPayload } from './corporateBillPreviewPayload.js';

test('F5: preview sends the same per-invoice amount + edits as the save', () => {
    const draft = [
        { invoiceId: '301', invoiceInclusiveVat: 230.004 },
        { invoiceId: '', invoiceInclusiveVat: 999 }, // opening / no invoice → not sent
        { invoiceId: 302, invoiceInclusiveVat: '115' },
    ];
    const dirty = [{ invoiceId: '301', invoiceExclVat: 200, vat15: 30, salesDiscounts: 0, invoiceInclusiveVat: 230 }];
    assert.deepEqual(buildDistributionPreviewPayload(draft, dirty), {
        invoices: [
            { invoiceId: '301', amount: 230 },
            { invoiceId: '302', amount: 115 },
        ],
        lineOverrides: [{ invoiceId: '301', invoiceExclVat: 200, vat15: 30, invoiceInclusiveVat: 230 }],
    });
    assert.deepEqual(buildDistributionPreviewPayload([], undefined), { invoices: [], lineOverrides: [] });
});
