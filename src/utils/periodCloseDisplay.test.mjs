import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildPeriodCloseMonthRows,
    dayBeforeYmd,
    formatMonthLabelEn,
    lastDayOfMonthYmd,
    summarizePeriodCloseCards,
} from './periodCloseDisplay.js';

describe('periodCloseDisplay (P-A16B)', () => {
    it('lastDayOfMonthYmd / dayBeforeYmd', () => {
        assert.equal(lastDayOfMonthYmd(2027, 3), '2027-03-31');
        assert.equal(dayBeforeYmd('2027-04-01'), '2027-03-31');
    });

    it('formatMonthLabelEn', () => {
        assert.equal(formatMonthLabelEn('2027-04-30'), 'Apr 2027');
    });

    it('buildPeriodCloseMonthRows marks locked vs open from lockedUpTo', () => {
        const rows = buildPeriodCloseMonthRows({
            lockedUpTo: '2027-03-31',
            periodCloses: [
                { id: '9', periodEndDate: '2027-03-31', canRestore: true },
            ],
            asOfYmd: '2027-04-15',
        });
        const mar = rows.find((r) => r.monthEndYmd === '2027-03-31');
        const apr = rows.find((r) => r.monthEndYmd === '2027-04-30');
        assert.equal(mar.status, 'locked');
        assert.equal(mar.closeId, '9');
        assert.equal(apr.status, 'open');
        assert.equal(apr.checks, null);
    });

    it('summarizePeriodCloseCards', () => {
        const rows = buildPeriodCloseMonthRows({
            lockedUpTo: '2027-03-31',
            asOfYmd: '2027-04-15',
        });
        const cards = summarizePeriodCloseCards(rows, '2027-03-31', '2027-04-15');
        assert.equal(cards.lockedUpTo, '2027-03-31');
        assert.equal(cards.openMonthsLabel, 'Apr 2027');
        assert.equal(cards.yearEndPosted, false);
        assert.equal(cards.yearEndYmd, '2027-12-31');
    });
});
