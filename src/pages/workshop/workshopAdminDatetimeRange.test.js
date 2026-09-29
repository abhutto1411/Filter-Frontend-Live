import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rollLiveRangeForward } from './workshopAdminDatetimeRange.js';

// 2026-09-27 12:18 Asia/Riyadh
const NOW = new Date('2026-09-27T09:18:00Z');

describe('rollLiveRangeForward', () => {
    it('extends a live range saved yesterday through end of today', () => {
        const r = rollLiveRangeForward(
            { dateFrom: '2026-09-01T00:00', dateTo: '2026-09-27T00:00' },
            '2026-09-26',
            NOW,
        );
        assert.deepEqual(r, { dateFrom: '2026-09-01T00:00', dateTo: '2026-09-28T00:00' });
    });

    it('extends a live range saved several days ago', () => {
        const r = rollLiveRangeForward(
            { dateFrom: '2026-09-01T00:00', dateTo: '2026-09-21T00:00' },
            '2026-09-20',
            NOW,
        );
        assert.equal(r.dateTo, '2026-09-28T00:00');
    });

    it('keeps a deliberately historical range', () => {
        const r = rollLiveRangeForward(
            { dateFrom: '2026-08-01T00:00', dateTo: '2026-09-01T00:00' },
            '2026-09-26',
            NOW,
        );
        assert.equal(r.dateTo, '2026-09-01T00:00');
    });

    it('keeps a range saved today', () => {
        const r = rollLiveRangeForward(
            { dateFrom: '2026-09-01T00:00', dateTo: '2026-09-27T00:00' },
            '2026-09-27',
            NOW,
        );
        assert.equal(r.dateTo, '2026-09-27T00:00');
    });

    it('legacy entry without savedDay ending yesterday is extended', () => {
        const r = rollLiveRangeForward(
            { dateFrom: '2026-09-01T00:00', dateTo: '2026-09-27T00:00' },
            '',
            NOW,
        );
        assert.equal(r.dateTo, '2026-09-28T00:00');
    });
});
