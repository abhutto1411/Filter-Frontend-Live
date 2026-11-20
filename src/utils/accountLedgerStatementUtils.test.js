import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ledgerRowDescriptionAndReference } from './accountLedgerStatementUtils.js';

describe('ledgerRowDescriptionAndReference', () => {
    it('keeps a typed Ref on the reference column', () => {
        const row = ledgerRowDescriptionAndReference({
            description: 'Invoices for Laman — Ref inv/01sep',
        });
        assert.equal(row.description, 'Invoices for Laman');
        assert.equal(row.reference, 'inv/01sep');
    });

    it('uses an explicit reference from the API', () => {
        const row = ledgerRowDescriptionAndReference({
            description: 'Invoices from 01 sept to 10 sept for laman branch',
            reference: 'JF80888',
        });
        assert.equal(row.description, 'Invoices from 01 sept to 10 sept for laman branch');
        assert.equal(row.reference, 'JF80888');
    });
});
