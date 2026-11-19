import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  batchListAction,
  batchStatusChip,
  buildBatchListQuery,
  deriveBatchResultCounts,
  formatSarLatn,
  mapBatchListSummary,
  pageRangeLabel,
  rowAmountDisplay,
  sumMoneyStrings,
  truncateIdempotencyKey,
} from './bulkBatchesDisplay.js';

describe('bulkBatchesDisplay money', () => {
  it('formatSarLatn + sumMoneyStrings (halalas)', () => {
    assert.equal(formatSarLatn('11200'), '11,200.00');
    assert.equal(sumMoneyStrings(['11200.00', '8000.00']), '19200.00');
  });
});

describe('N2 list mapping', () => {
  it('mapBatchListSummary cards', () => {
    const cards = mapBatchListSummary({
      batches: 18,
      drafts: 3,
      posted: 14,
      reversed: 1,
      totalPostedOut: '41300.00',
      totalPostedIn: '22050.00',
    });
    assert.equal(cards.length, 5);
    assert.equal(cards[0].id, 'batches');
    assert.equal(cards[4].out, '41300.00');
  });

  it('status chips + action', () => {
    assert.equal(batchStatusChip({ status: 'posted' }).kind, 'posted');
    assert.equal(
      batchStatusChip({ status: 'draft', errorCount: 2 }).kind,
      'draft',
    );
    assert.equal(
      batchStatusChip({ status: 'draft', source: 'import' }).kind,
      'draft_import',
    );
    assert.equal(batchListAction({ status: 'draft', canContinue: true }), 'continue');
    assert.equal(batchListAction({ status: 'posted' }), 'open');
  });

  it('pageRangeLabel + query', () => {
    assert.deepEqual(pageRangeLabel(1, 25, 18), { from: 1, to: 18, total: 18 });
    const q = buildBatchListQuery({ search: 'BT', status: 'posted' }, 2, 25);
    assert.equal(q.page, 2);
    assert.equal(q.search, 'BT');
    assert.equal(q.status, 'posted');
  });
});

describe('result 30 helpers', () => {
  it('derive counts + row amount + idem truncate', () => {
    const rows = [
      { type: 'payment', state: 'posted', journalId: '1', payload: { amount: '10' } },
      { type: 'transfer', state: 'posted', journalId: '2', payload: { amount: '3' } },
      { type: 'journal', state: 'posted', journalId: '3', payload: { debit: '45' } },
      { type: 'journal', state: 'posted', journalId: '3', payload: { credit: '45' } },
    ];
    const c = deriveBatchResultCounts(rows);
    assert.equal(c.transfers, 1);
    assert.equal(c.journals, 3);
    assert.equal(rowAmountDisplay(rows[0]), '10');
    assert.equal(truncateIdempotencyKey('abcdef9f2c'), '…9f2c');
  });
});
