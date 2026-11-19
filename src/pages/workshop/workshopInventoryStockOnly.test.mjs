/**
 * Run: node --test src/pages/workshop/workshopInventoryStockOnly.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStockOnly,
  workshopInventoryHasStock,
} from '../../utils/workshopInventoryStockOnly.js';

describe('Inventory stock-only filter', () => {
  it('6 rows (1 in stock) ⇒ filter ⇒ 1; clear ⇒ 6', () => {
    const rows = [
      { id: '1', qty: 0 },
      { id: '2', qty: 5 },
      { id: '3', qty: 0 },
      { id: '4', qty: 0 },
      { id: '5', qty: 0 },
      { id: '6', qty: 0 },
    ];
    const filtered = applyStockOnly(rows, true);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, '2');
    assert.equal(workshopInventoryHasStock(filtered[0]), true);
    assert.equal(applyStockOnly(rows, false).length, 6);
  });
});
