import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIcReportQuery,
  formatSarLatn,
  mapIcSummaryRows,
  previewBookLines,
  validateSettlementAmount,
} from './platformExpensesDisplay.js';

describe('platformExpensesDisplay', () => {
  it('formatSarLatn', () => {
    assert.equal(formatSarLatn('1150'), '1,150.00');
  });

  it('mapIcSummaryRows hides incomplete and maps fields', () => {
    const rows = mapIcSummaryRows([
      {
        workshopId: '1',
        workshopName: 'W1',
        expensesPaidForHq: '1300.00',
        settlements: '0.00',
        closing: '1300.00',
      },
      { workshopName: 'orphan' },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].paidForHq, '1300.00');
    assert.equal(rows[0].canSettle, true);
  });

  it('buildIcReportQuery', () => {
    const q = buildIcReportQuery({ workshopId: '9', from: '2026-01-01' }, 2);
    assert.equal(q.page, '2');
    assert.deepEqual(q.workshopIds, ['9']);
  });

  it('previewBookLines', () => {
    const p = previewBookLines({
      amount: '1150',
      paidFromLabel: 'Bank 001',
      workshopLabel: 'EXAMPLE',
    });
    assert.match(p.workshopLine, /Receivable from Platform HQ/);
    assert.match(p.platformLine, /Liability to EXAMPLE/);
  });

  it('validateSettlementAmount', () => {
    assert.equal(validateSettlementAmount('100', '100').ok, true);
    assert.equal(
      validateSettlementAmount('101', '100').code,
      'SETTLEMENT_EXCEEDS_BALANCE',
    );
  });
});
