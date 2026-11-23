/**
 * Run: node --test src/pages/workshop/accounting/workshopLedgerClosing.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStatementClosing,
  statementClosingZeroLines,
} from './ledgerStatementClosing.js';

describe('WorkshopLedgerView closing basis', () => {
  it('0 lines ⇒ closing == opening (never all-time server balance)', () => {
    const opening = 0;
    const serverAllTime = 9999.99;
    const closing = statementClosingZeroLines(opening);
    assert.equal(closing, opening);
    assert.notEqual(closing, serverAllTime);
  });

  it('computeStatementClosing mirrors zero-line rule', () => {
    assert.equal(
      computeStatementClosing({
        filteredLinesLength: 0,
        statementOpening: 12.5,
        totalsDebit: 100,
        totalsCredit: 40,
      }),
      12.5,
    );
  });
});
