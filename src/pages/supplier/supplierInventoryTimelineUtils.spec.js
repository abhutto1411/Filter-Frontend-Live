import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fillSupplierTimelineRunningQty } from './supplierInventoryTimelineUtils.js';

describe('supplier inventory timeline — all activities', () => {
    it('keeps signed product balances: 1 − 2 = −1, then +6 = 5', () => {
        const rows = fillSupplierTimelineRunningQty(
            [
                { id: 'sale', at: '2026-01-02', delta: -2, previousQty: 1, newQty: -1 },
                { id: 'buy', at: '2026-01-03', delta: 6, previousQty: 0, newQty: 6 },
            ],
            -1,
        );
        rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));
        assert.deepEqual(
            rows.map((r) => [r.previousQty, r.newQty]),
            [
                [1, -1],
                [-1, 5],
            ],
        );
    });

    it('replays opening, sale, purchase, debit note, credit note, adjustments', () => {
        const rows = fillSupplierTimelineRunningQty(
            [
                { id: 'open', at: 't1', delta: 10, previousQty: 0, newQty: 10 },
                { id: 'sale', at: 't2', delta: -12, previousQty: 10, newQty: -2 },
                { id: 'buy', at: 't3', delta: 6, previousQty: 0, newQty: 6 },
                { id: 'dn', at: 't4', delta: -1, previousQty: 6, newQty: 5 },
                { id: 'cn', at: 't5', delta: 2, previousQty: 0, newQty: 2 },
                { id: 'adj-', at: 't6', delta: -7, previousQty: 5, newQty: -2 },
                { id: 'adj+', at: 't7', delta: 8, previousQty: 0, newQty: 8 },
            ],
            6,
        );
        rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));
        assert.deepEqual(
            rows.map((r) => r.newQty),
            [10, -2, 4, 3, 5, -2, 6],
        );
    });
});
