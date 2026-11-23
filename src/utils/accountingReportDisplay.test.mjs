import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceSheetBadge, bsWarningMessages } from './accountingReportDisplay.js';
import { accT } from './accountingI18n.js';

test('balanceSheetBadge notApplicable before isBalanced', () => {
  const badge = balanceSheetBadge({
    isBalanced: true,
    difference: 0,
    warnings: ['bs.beforeBooksStart'],
    booksStartDate: '2026-11-08',
  });
  assert.equal(badge.kind, 'notApplicable');
  assert.equal(badge.textKey, 'bs.badge.notApplicable');
});

test('bsWarningMessages noOpeningBalance text with the date', () => {
  const msgs = bsWarningMessages({
    warnings: ['bs.noOpeningBalance'],
    booksStartDate: '2026-11-08',
  });
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].key, 'bs.noOpeningBalance');
  assert.equal(msgs[0].vars.date, '08/11/2026');
  const en = accT('en', msgs[0].key, msgs[0].vars);
  assert.ok(en.includes('08/11/2026'));
  assert.equal(en.includes('SAR'), false);
});
