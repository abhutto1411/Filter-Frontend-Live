/**
 * D12: 500+1 affiliated rows ⇒ 2 list calls, no duplicates.
 * Run: node --test src/pages/workshop/purchaseListPaging.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

async function fetchAllAffiliated({ listFn, pageLimit = 500 }) {
  let offset = 0;
  let total = Infinity;
  const all = [];
  let calls = 0;
  while (offset < total && offset < 5000) {
    calls += 1;
    const res = await listFn({ limit: pageLimit, offset });
    const page = Array.isArray(res?.invoices) ? res.invoices : [];
    const apiTotal = Number(res?.total);
    total = Number.isFinite(apiTotal) ? apiTotal : page.length;
    all.push(...page);
    if (page.length < pageLimit) break;
    offset += pageLimit;
  }
  return { all, calls };
}

describe('D12 purchase list paging', () => {
  it('500+1 rows ⇒ 2 calls, no duplicates', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i + 1) }));
    const { all, calls } = await fetchAllAffiliated({
      pageLimit: 500,
      listFn: async ({ limit, offset }) => ({
        invoices: rows.slice(offset, offset + limit),
        total: rows.length,
      }),
    });
    assert.equal(calls, 2);
    assert.equal(all.length, 501);
    assert.equal(new Set(all.map((r) => r.id)).size, 501);
  });
});
