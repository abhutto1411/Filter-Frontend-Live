import test from 'node:test';
import assert from 'node:assert/strict';
import { CFX02_I18N, buildSettlementStatementRows } from './corporateFix02I18n.js';

test('every EN key has an AR string', () => {
    for (const k of Object.keys(CFX02_I18N.en)) {
        assert.ok(CFX02_I18N.ar[k], `missing AR for ${k}`);
    }
});

test('settlement statement reproduces mockup §5 (W50)', () => {
    const rows = buildSettlementStatementRows(
        [
            {
                billNo: 'BILL-0011-20261101-001',
                events: [
                    { date: '2026-11-30', kind: 'bill', ref: 'BILL-0011-20261101-001', debit: '575.00', credit: '0.00' },
                    { date: '2026-11-30', kind: 'payout', ref: 'BILL-0011-20261101-001', debit: '0.00', credit: '333.33' },
                    { date: '2026-12-15', kind: 'payout', ref: 'BILL-0011-20261101-001', debit: '0.00', credit: '241.67' },
                ],
            },
        ],
        'en',
    );
    assert.deepEqual(rows.map((r) => r.balance), [575, 241.67, 0]);
    assert.match(rows[0].description, /assigned to HQ/);
});
