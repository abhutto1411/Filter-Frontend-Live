import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CASHIER_VARIANCE_PAGE_SIZE,
  buildApiQuery,
  csvFromIds,
  filtersFromSearchParams,
  formatMoneyLatn,
  formatSignedMoneyLatn,
  formatSessionStamp,
  journalPostedLabel,
  mapSummaryCards,
  parseCsvIds,
  searchParamsFromFilters,
  showingRange,
  varianceTone,
} from './cashierVarianceDisplay.js';

describe('cashierVarianceDisplay (P-A11B)', () => {
  it('parseCsvIds + csvFromIds round-trip', () => {
    assert.deepEqual(parseCsvIds('1,2,2,x'), ['1', '2', 'x']);
    assert.equal(csvFromIds(['9', '10']), '9,10');
  });

  it('formatMoneyLatn / signed / tone', () => {
    assert.equal(formatMoneyLatn('312.5'), '312.50');
    assert.equal(formatSignedMoneyLatn('-50'), '-50.00');
    assert.equal(formatSignedMoneyLatn('20'), '+20.00');
    assert.equal(formatSignedMoneyLatn('0'), '0.00');
    assert.equal(varianceTone('-1'), 'bad');
    assert.equal(varianceTone('2'), 'ok');
    assert.equal(varianceTone('0'), 'neutral');
  });

  it('mapSummaryCards passes API strings through', () => {
    const c = mapSummaryCards({
      sessionsCount: 42,
      totalShortage: '312.50',
      totalOverage: '40.00',
      net: '-272.50',
      sessionsWithVariance: 10,
    });
    assert.equal(c.sessions, '42');
    assert.equal(c.shortages, '312.50');
    assert.equal(c.overages, '40.00');
    assert.equal(c.net, '-272.50');
  });

  it('journalPostedLabel queued / posted / none', () => {
    assert.equal(journalPostedLabel({ journalStatus: 'queued' }).kind, 'queued');
    assert.equal(
      journalPostedLabel({ journalStatus: 'posted', journalNumber: 'JE9' }).text,
      'JE9',
    );
    assert.equal(journalPostedLabel({ journalStatus: 'none' }).kind, 'dash');
  });

  it('filters ↔ URL ↔ API query', () => {
    const f = filtersFromSearchParams(
      new URLSearchParams('branchIds=10&type=shortage&page=2&from=2026-04-01'),
    );
    assert.deepEqual(f.branchIds, ['10']);
    assert.equal(f.type, 'shortage');
    assert.equal(f.page, 2);
    const sp = searchParamsFromFilters(f);
    assert.equal(sp.branchIds, '10');
    assert.equal(sp.type, 'shortage');
    assert.equal(sp.page, '2');
    const q = buildApiQuery(f);
    assert.equal(q.pageSize, CASHIER_VARIANCE_PAGE_SIZE);
    assert.equal(q.page, 2);
    assert.equal(q.type, 'shortage');
  });

  it('showingRange + formatSessionStamp', () => {
    assert.deepEqual(showingRange(1, 25, 42), { from: 1, to: 25, total: 42 });
    assert.deepEqual(showingRange(2, 25, 42), { from: 26, to: 42, total: 42 });
    assert.equal(
      formatSessionStamp('2026-04-14T08:00:00.000Z'),
      '2026-04-14 08:00',
    );
  });
});
