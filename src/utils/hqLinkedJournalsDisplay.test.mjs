import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLinkedCards,
  buildLjReportQuery,
  formatSarLatn,
  mapIcListRows,
  mapJournalLines,
  pickJournalByNumber,
  slicePage,
} from './hqLinkedJournalsDisplay.js';

describe('hqLinkedJournalsDisplay', () => {
  it('formatSarLatn', () => {
    assert.equal(formatSarLatn('1150'), '1,150.00');
  });

  it('buildLjReportQuery', () => {
    const q = buildLjReportQuery(
      { search: 'IC-EX-0007', workshopId: '9' },
      2,
    );
    assert.equal(q.page, '2');
    assert.equal(q.search, 'IC-EX-0007');
    assert.deepEqual(q.workshopIds, ['9']);
  });

  it('mapIcListRows maps and drops orphans', () => {
    const rows = mapIcListRows([
      {
        ref: 'IC-EX-0007',
        date: '2026-10-29',
        workshopId: '3',
        workshopName: 'EXAMPLE',
        amount: '1150.00',
        status: 'posted',
        hqJournalNumber: 'JE-HQ-EX-310',
        workshopJournalNumber: 'JE-EX-1050',
      },
      { amount: '1' },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].ref, 'IC-EX-0007');
    assert.equal(rows[0].hqJournalNumber, 'JE-HQ-EX-310');
  });

  it('buildLinkedCards bothSides and linkedCount', () => {
    const both = buildLinkedCards({
      ref: 'IC-1',
      amount: '10.00',
      hqJournalNumber: 'JE-A',
      workshopJournalNumber: 'JE-B',
    });
    assert.equal(both.bothSides, 'posted');
    assert.equal(both.linkedCount, 2);

    const partial = buildLinkedCards({
      ref: 'IC-2',
      hqJournalNumber: 'JE-A',
    });
    assert.equal(partial.bothSides, 'partial');
    assert.equal(partial.linkedCount, 1);

    const missing = buildLinkedCards({ ref: 'IC-3' });
    assert.equal(missing.bothSides, 'missing');
    assert.equal(missing.linkedCount, 0);
  });

  it('mapJournalLines and slicePage', () => {
    const lines = mapJournalLines({
      lines: [
        { id: 1, accountCode: '6100', accountName: 'Marketing', debit: 1000, credit: 0 },
        { id: 2, accountCode: '2300', accountName: 'Liability', debit: 0, credit: 1000 },
      ],
    });
    assert.equal(lines[0].account, '6100 Marketing');
    assert.equal(lines[0].debit, '1000');
    const page = slicePage(lines, 1, 1);
    assert.equal(page.total, 2);
    assert.equal(page.items.length, 1);
  });

  it('pickJournalByNumber prefers exact entryNumber', () => {
    const picked = pickJournalByNumber(
      [{ entryNumber: 'JE-OTHER' }, { entryNumber: 'JE-HQ-EX-310', id: '9' }],
      'JE-HQ-EX-310',
    );
    assert.equal(picked.id, '9');
  });
});
