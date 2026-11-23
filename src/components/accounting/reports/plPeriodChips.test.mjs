import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlChip, plChipRange } from './plPeriodChips.js';

test('today / yesterday / thisMonth / lastMonth are closed YMD ranges', () => {
  const now = new Date('2026-11-11T12:00:00+03:00');
  assert.deepEqual(plChipRange('today', now), {
    dateFrom: '2026-11-11',
    dateTo: '2026-11-11',
  });
  assert.deepEqual(plChipRange('yesterday', now), {
    dateFrom: '2026-11-10',
    dateTo: '2026-11-10',
  });
  assert.deepEqual(plChipRange('thisMonth', now), {
    dateFrom: '2026-11-01',
    dateTo: '2026-11-11',
  });
  assert.deepEqual(plChipRange('lastMonth', now), {
    dateFrom: '2026-10-01',
    dateTo: '2026-10-31',
  });
  assert.equal(detectPlChip('2026-11-11', '2026-11-11', now), 'today');
  assert.equal(detectPlChip('2026-06-01', '2026-06-30', now), 'custom');
});
