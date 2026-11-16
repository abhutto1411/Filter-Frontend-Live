import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SUPPLIERS_AP_PAGE_SIZE,
  buildApListQuery,
  filtersFromSearchParams,
  formatDocLabel,
  formatMoneyLatn,
  hasDrift,
  mapApSummaryCards,
  openBillsFromAgeing,
  overdueFromAgeing,
  searchParamsFromFilters,
  showingRange,
  sumMoneyStrings,
  typeChipKind,
} from './suppliersApDisplay.js';

describe('suppliersApDisplay (P-A13B)', () => {
  it('formatMoneyLatn + sumMoneyStrings (halalas)', () => {
    assert.equal(formatMoneyLatn('62000'), '62,000.00');
    assert.equal(sumMoneyStrings(['1.10', '2.20']), '3.30');
  });

  it('openBills / overdue from ageing API fields', () => {
    const ageing = {
      current: '100.00',
      d1_30: '20.00',
      d31_60: '5.00',
      d61_90: '0.00',
      d90_plus: '3.00',
    };
    assert.equal(openBillsFromAgeing(ageing), '128.00');
    assert.equal(overdueFromAgeing(ageing), '28.00');
  });

  it('mapApSummaryCards', () => {
    const c = mapApSummaryCards(
      {
        suppliersCount: 36,
        ageing: {
          current: '53600',
          d1_30: '8400',
          d31_60: '0',
          d61_90: '0',
          d90_plus: '0',
        },
      },
      { affiliatedTotal: 9 },
    );
    assert.equal(c.suppliers, '36');
    assert.equal(c.affiliated, '9');
    assert.equal(c.openBills, '62000.00');
    assert.equal(c.overdue, '8400.00');
  });

  it('typeChipKind + drift + doc label', () => {
    assert.equal(typeChipKind('affiliated'), 'affiliated');
    assert.equal(typeChipKind('local'), 'local');
    assert.equal(hasDrift('0.00'), false);
    assert.equal(hasDrift('1.50'), true);
    assert.equal(
      formatDocLabel({ journalNumber: 'JE9' }),
      'JE9',
    );
  });

  it('filters ↔ URL ↔ list query', () => {
    const f = filtersFromSearchParams(
      new URLSearchParams(
        'type=local&search=oil&from=2026-01-01&to=2026-03-31&supplierType=local&supplierId=5',
      ),
    );
    assert.equal(f.type, 'local');
    assert.equal(f.supplierId, '5');
    const sp = searchParamsFromFilters(f);
    assert.equal(sp.type, 'local');
    assert.equal(sp.supplierId, '5');
    const q = buildApListQuery(f);
    assert.equal(q.pageSize, SUPPLIERS_AP_PAGE_SIZE);
    assert.equal(q.asOf, '2026-03-31');
    assert.equal(q.type, 'local');
  });

  it('showingRange', () => {
    assert.deepEqual(showingRange(1, 25, 36), { from: 1, to: 25, total: 36 });
  });
});
