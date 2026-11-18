import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JUNE_2026_CANONICAL as J } from './workshopJuneClock.fixture.mjs';
import {
  assembleClockBridgeGap,
  assembleDocumentDiscounts,
  assembleDocumentNet,
  assemblePostedIncomeFromDocuments,
  postedNetUnchangedByDocumentDiscounts,
} from './workshopJuneClock.js';

describe('June 2026 locked identities', () => {
  it('Reports net = 684366.13 − 5781.24', () => {
    assert.equal(assembleDocumentNet(J.calendarGrossExVat, J.completedReturnsExVat), 678584.89);
  });

  it('issued_at net = 683246.12 − 5781.24', () => {
    assert.equal(assembleDocumentNet(J.issuedAtGrossExVat, J.completedReturnsExVat), 677464.88);
  });

  it('clock gap 1135.23 − 15.22 = 1120.01', () => {
    assert.equal(assembleClockBridgeGap(J.reportsNetExVat, J.issuedAtNetExVat), 1120.01);
    assert.equal(assembleDocumentNet(1135.23, 15.22), 1120.01);
  });

  it('document POS discounts 587.38 + 3622.91 + 0 = 4210.29 do not reduce posted net', () => {
    assert.equal(assembleDocumentDiscounts(587.38, 3622.91, 0), 4210.29);
    assert.equal(postedNetUnchangedByDocumentDiscounts(J.postedIncomeExVat), 669112.62);
    assert.notEqual(assembleDocumentDiscounts(587.38, 3622.91, 0), 1370.87);
  });

  it('posted income 669112.62 from documents', () => {
    assert.equal(
      assemblePostedIncomeFromDocuments({
        calendarGrossExVat: J.calendarGrossExVat,
        completedReturnsExVat: J.completedReturnsExVat,
        missingInvoiceJournalExVat: J.missingInvoiceJournalExVat,
      }),
      669112.62,
    );
  });
});
