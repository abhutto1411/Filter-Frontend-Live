import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { salesReturnsKpiFromListResponse } from './workshopSalesReturnsKpi.js';

describe('salesReturnsKpiFromListResponse', () => {
  it('uses filtered totals, not rows.length', () => {
    const page = Array.from({ length: 18 }, (_, i) => ({
      id: i + 1,
      totalAmount: 201.438,
    }));
    const kpi = salesReturnsKpiFromListResponse({
      total: 31,
      salesReturns: page,
      summary: { count: 31, incVat: 6639.28, exVat: 5781.24, vat: 858.04 },
    });
    assert.equal(kpi.count, 31);
    assert.equal(kpi.incVat, 6639.28);
    assert.equal(kpi.exVat, 5781.24);
    assert.notEqual(kpi.count, page.length);
  });
});
