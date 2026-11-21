import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  booksHealthShouldShowAlert,
  readBooksHealthAlertCache,
  writeBooksHealthAlertCache,
  clearBooksHealthAlertCache,
} from './booksHealthAlertCache.js';
import {
  canRetryOutboxRow,
  mapBooksHealthSummaryCards,
  mapNoncashRepairCards,
  mapOutboxRow,
  noncashPlannedFixKey,
  noncashProblemKey,
  outboxStateChip,
  slicePage,
  sumAmountStringsHalalas,
} from './booksHealthDisplay.js';

describe('mapBooksHealthSummaryCards', () => {
  it('uses em dash when start/locked missing', () => {
    const cards = mapBooksHealthSummaryCards({
      pendingPostings: 3,
      deadPostings: 1,
    });
    assert.equal(cards[0].value, '—');
    assert.equal(cards[1].value, '—');
    assert.equal(cards[2].value, '3');
    assert.equal(cards[2].tone, 'warn');
    assert.equal(cards[3].value, '1');
    assert.equal(cards[3].tone, 'bad');
  });

  it('marks queue ok when zero pending/failed', () => {
    const cards = mapBooksHealthSummaryCards({
      pendingPostings: 0,
      deadPostings: 0,
    });
    assert.equal(cards[2].tone, 'ok');
    assert.equal(cards[3].tone, 'ok');
  });
});

describe('outboxStateChip / canRetryOutboxRow', () => {
  it('queued / failed / posted', () => {
    assert.equal(outboxStateChip({ status: 'pending' }).key, 'bh.outbox.queued');
    assert.equal(outboxStateChip({ status: 'failed', lastError: 'x' }).tone, 'bad');
    assert.equal(outboxStateChip({ status: 'posted' }).tone, 'ok');
    assert.equal(canRetryOutboxRow({ status: 'failed' }), true);
    assert.equal(canRetryOutboxRow({ status: 'posted' }), false);
  });
});

describe('slicePage', () => {
  it('pages 25 at a time', () => {
    const rows = Array.from({ length: 30 }, (_, i) => i);
    const p1 = slicePage(rows, 1, 25);
    assert.equal(p1.rows.length, 25);
    assert.equal(p1.from, 1);
    assert.equal(p1.to, 25);
    const p2 = slicePage(rows, 2, 25);
    assert.equal(p2.rows.length, 5);
    assert.equal(p2.from, 26);
    assert.equal(p2.to, 30);
  });
});

describe('noncash mapping', () => {
  it('maps reasons to i18n keys', () => {
    assert.equal(noncashProblemKey('duplicate'), 'bh.noncash.problem.duplicate');
    assert.equal(noncashPlannedFixKey('duplicate'), 'bh.noncash.fix.reverseOnly');
  });

  it('sums amount strings via halalas', () => {
    assert.equal(sumAmountStringsHalalas(['800.00', '1150.00', '240.00', '120.00']), '2310.00');
  });

  it('mapNoncashRepairCards', () => {
    const m = mapNoncashRepairCards({
      dryRun: true,
      noncash_invalid_postings: 2,
      findings: [
        { journalId: '1', amount: '10.50', reason: 'duplicate' },
        { journalId: '2', amount: '1.50', reason: 'not_approved' },
      ],
    });
    assert.equal(m.invalidCount, 2);
    assert.equal(m.amountAffected, '12.00');
    assert.equal(m.voidedAutomatically, '0');
  });
});

describe('mapOutboxRow', () => {
  it('prefers idempotencyKey as ref', () => {
    const r = mapOutboxRow({
      id: '9',
      source: 'invoice',
      sourceId: '1',
      idempotencyKey: 'invoice:1',
      status: 'failed',
    });
    assert.equal(r.ref, 'invoice:1');
    assert.equal(r.source, 'invoice');
  });
});

describe('booksHealthAlertCache', () => {
  it('shouldShowAlert on dead or problems', () => {
    assert.equal(booksHealthShouldShowAlert({ deadPostings: 1 }), true);
    assert.equal(booksHealthShouldShowAlert({ problems: ['x'] }), true);
    assert.equal(booksHealthShouldShowAlert({ setupOk: false }), true);
    assert.equal(
      booksHealthShouldShowAlert({ deadPostings: 0, problems: [], setupOk: true }),
      false,
    );
  });

  it('round-trips session cache', () => {
    clearBooksHealthAlertCache();
    writeBooksHealthAlertCache(true, 1000);
    const hit = readBooksHealthAlertCache(1000 + 60_000);
    assert.equal(hit?.showDot, true);
    assert.equal(readBooksHealthAlertCache(1000 + 6 * 60_000), null);
    clearBooksHealthAlertCache();
  });
});
