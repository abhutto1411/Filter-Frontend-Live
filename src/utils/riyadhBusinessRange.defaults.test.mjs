import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JUNE_2026_CANONICAL } from '../pages/workshop/workshopJuneClock.fixture.mjs';
import {
  defaultInclusiveCoaCalendarRange,
  defaultTbBsReportDates,
  toRiyadhDateISO,
  reportsRangeQueryParams,
  dashboardInclusiveCalendarYmd,
  dashboardLedgerCalendarDates,
  workshopDashboardRangeQueryParams,
  inclusiveCalendarRangeToInclusiveMidnight,
} from './riyadhBusinessRange.js';

describe('defaultTbBsReportDates', () => {
  it('TB is month-start→today and BS asOf is today (Asia/Riyadh)', () => {
    const now = new Date('2026-11-15T12:00:00+03:00');
    const range = defaultInclusiveCoaCalendarRange(now);
    const d = defaultTbBsReportDates(now);
    assert.equal(d.tb.dateFrom, range.dateFrom);
    assert.equal(d.tb.dateTo, range.dateTo);
    assert.equal(d.bs.asOf, toRiyadhDateISO(now));
    assert.equal(d.tb.dateFrom, '2026-11-01');
    assert.equal(d.tb.dateTo, '2026-11-15');
    assert.equal(d.bs.asOf, '2026-11-15');
  });
});

describe('reportsRangeQueryParams', () => {
  it('calendar Sep9 is date-only YMD, not equal-midnight ISO', () => {
    const q = reportsRangeQueryParams('2026-09-09T00:00', '2026-09-09T00:00', 'calendar');
    assert.equal(q.rangeKind, 'calendar_day');
    assert.equal(q.dateFrom, '2026-09-09');
    assert.equal(q.dateTo, '2026-09-09');
    assert.equal(q.startDate, '2026-09-09');
    assert.equal(q.clientTimeZone, 'Asia/Riyadh');
  });

  it('rejects equal precise midnights', () => {
    assert.throws(
      () => reportsRangeQueryParams('2026-09-09T00:00', '2026-09-09T00:00', 'precise'),
      /end after start|Equal midnight/i,
    );
  });

  it('rejects reversed precise range', () => {
    assert.throws(
      () => reportsRangeQueryParams('2026-09-09T12:00', '2026-09-09T08:00', 'precise'),
      /on or before end|end after start/i,
    );
  });

  it('precise hours keep Riyadh ISO and omit dateFrom YMD override', () => {
    const q = reportsRangeQueryParams('2026-09-09T00:00', '2026-09-09T01:00', 'precise');
    assert.equal(q.rangeKind, 'precise_instant');
    assert.equal(q.startDate, '2026-09-08T21:00:00.000Z');
    assert.equal(q.endDate, '2026-09-08T22:00:00.000Z');
    assert.equal(q.dateFrom, undefined);
    assert.equal(q.clientTimeZone, 'Asia/Riyadh');
  });
});

describe('dashboardInclusiveCalendarYmd', () => {
  it('custom To=30 Jun 00:00 includes 30 Jun', () => {
    const ymd = dashboardInclusiveCalendarYmd('2026-06-01T00:00', '2026-06-30T00:00');
    assert.deepEqual(ymd, { dateFrom: '2026-06-01', dateTo: '2026-06-30' });
    const q = workshopDashboardRangeQueryParams('2026-06-01T00:00', '2026-06-30T00:00');
    assert.equal(q.dateFrom, '2026-06-01');
    assert.equal(q.dateTo, '2026-06-30');
    assert.equal(q.startDate, undefined);
  });

  it('leftover exclusive To=01 Jul 00:00 still includes 30 Jun', () => {
    const ymd = dashboardInclusiveCalendarYmd('2026-06-01T00:00', '2026-07-01T00:00');
    assert.deepEqual(ymd, { dateFrom: '2026-06-01', dateTo: '2026-06-30' });
  });

  it('this-month inclusive midnight stores last calendar day, not next month', () => {
    const dt = inclusiveCalendarRangeToInclusiveMidnight('2026-06-01', '2026-06-30');
    assert.equal(dt.dateFrom, '2026-06-01T00:00');
    assert.equal(dt.dateTo, '2026-06-30T00:00');
  });

  it('June dashboard preset is invoice_date at Riyadh midnight, not the 07:00 operational day', () => {
    const preset = inclusiveCalendarRangeToInclusiveMidnight('2026-06-01', '2026-06-30');
    assert.equal(preset.dateFrom, '2026-06-01T00:00');
    assert.equal(preset.dateTo, '2026-06-30T00:00');
    const q = workshopDashboardRangeQueryParams(preset.dateFrom, preset.dateTo);
    assert.deepEqual(q, {
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      clientTimeZone: 'Asia/Riyadh',
    });
    assert.equal(q.startDate, undefined);
    assert.equal(q.endDate, undefined);
    const grainStart = `${q.dateFrom}T00:00:00+03:00`;
    const grainEnd = '2026-07-01T00:00:00+03:00';
    assert.equal(grainStart, '2026-06-01T00:00:00+03:00');
    assert.notEqual(grainStart, '2026-06-01T07:00:00+03:00');
    assert.equal(grainEnd, '2026-07-01T00:00:00+03:00');
    assert.equal(JUNE_2026_CANONICAL.reportsNetExVat, 678584.89);
  });

  it('ledger calendar dates keep 30 Jun when To is inclusive midnight', () => {
    const ymd = dashboardLedgerCalendarDates('2026-06-01T00:00', '2026-06-30T00:00');
    assert.deepEqual(ymd, { dateFrom: '2026-06-01', dateTo: '2026-06-30' });
  });
});
