import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNoncashQueueQuery,
  formatSarLatn,
  halalasToMoney,
  mapNoncashQueueSummary,
  moneyHalalas,
  pageRangeLabel,
  photoCountFromItem,
  previewInclusiveVat,
  statusChipKind,
} from './noncashReviewDisplay.js';

describe('noncashReviewDisplay', () => {
  it('formatSarLatn', () => {
    assert.equal(formatSarLatn('1150.5'), '1,150.50');
  });

  it('mapNoncashQueueSummary hides missing cards', () => {
    const cards = mapNoncashQueueSummary({
      pendingCount: 9,
      pendingAmount: '6845.00',
      duplicates: 1,
    });
    assert.equal(cards.length, 2);
    assert.equal(cards[0].id, 'pending');
    assert.equal(cards[1].id, 'duplicates');
  });

  it('buildNoncashQueueQuery + pageRange', () => {
    const q = buildNoncashQueueQuery({ status: 'pending', q: 'CH' }, 2);
    assert.equal(q.page, '2');
    assert.equal(q.q, 'CH');
    const r = pageRangeLabel(1, 25, 9);
    assert.deepEqual(r, { from: 1, to: 9, total: 9 });
  });

  it('previewInclusiveVat 115 → 100 + 15', () => {
    const p = previewInclusiveVat('1150.00', 15);
    assert.equal(p.gross, '1150.00');
    assert.equal(p.net, '1000.00');
    assert.equal(p.vat, '150.00');
  });

  it('previewInclusiveVat uses integer halalas (1.13)', () => {
    assert.equal(moneyHalalas('1.13'), 113);
    assert.equal(halalasToMoney(113), '1.13');
  });

  it('photoCount + statusChip', () => {
    assert.equal(photoCountFromItem({ proofUrl: 'http://x' }), 1);
    assert.equal(photoCountFromItem({ photos: ['a', 'b'] }), 2);
    assert.equal(statusChipKind('approved'), 'approved');
    assert.equal(statusChipKind('pending'), 'pending');
  });
});
