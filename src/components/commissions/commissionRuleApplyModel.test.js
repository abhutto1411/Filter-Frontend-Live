import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    applyResultCounts,
    canConfirmRuleApply,
    differenceTone,
    displayMoneyString,
    isPeriodLocked,
    mapPreviewWorkers,
    previewApplyBody,
    previewTotals,
    unwrapApplyResponse,
} from './commissionRuleApplyModel.js';

const t = (key, vars) => {
    if (key === 'emDash') return '—';
    if (key === 'money.sar') return `SAR ${vars.amount}`;
    return key;
};

describe('who can confirm apply', () => {
    it('allows edit on a workshop rule and blocks platform rules', () => {
        const workshop = { id: '1', scope: 'workshop' };
        const platform = { id: '2', scope: 'platform' };
        const readOnly = { id: '3', scope: 'workshop', readOnly: true };
        assert.equal(canConfirmRuleApply(workshop, true), true);
        assert.equal(canConfirmRuleApply(workshop, false), false);
        assert.equal(canConfirmRuleApply(platform, true), false);
        assert.equal(canConfirmRuleApply(platform, false), false);
        assert.equal(canConfirmRuleApply(readOnly, true), false);
        assert.equal(canConfirmRuleApply(null, true), true);
    });
});

describe('apply to past sales preview', () => {
    it('omits fromDate until the user picks a day', () => {
        assert.deepEqual(previewApplyBody(''), {});
        assert.deepEqual(previewApplyBody('   '), {});
        assert.deepEqual(previewApplyBody('2026-10-16'), { fromDate: '2026-10-16' });
        assert.deepEqual(previewApplyBody('not-a-date'), {});
    });

    it('keeps money strings and worker counts from the preview', () => {
        const preview = unwrapApplyResponse({
            data: {
                applied: false,
                workers: [
                    {
                        workerId: 'w1',
                        name: 'Sara',
                        role: 'Technician',
                        branchId: 'b1',
                        branch: 'Olaya',
                        oldTotal: '10.00',
                        newTotal: '12.50',
                        difference: '+2.50',
                        lineCount: 4,
                        paidRowCount: 1,
                    },
                ],
                oldTotal: '10.00',
                newTotal: '12.50',
                difference: '+2.50',
                periodLocked: false,
            },
        });
        const [row] = mapPreviewWorkers(preview);
        assert.equal(row.oldTotal, '10.00');
        assert.equal(row.newTotal, '12.50');
        assert.equal(row.difference, '+2.50');
        assert.equal(row.lineCount, 4);
        assert.equal(row.paidRowCount, 1);
        assert.deepEqual(previewTotals(preview), {
            oldTotal: '10.00',
            newTotal: '12.50',
            difference: '+2.50',
        });
        assert.equal(displayMoneyString(row.difference, t), 'SAR +2.50');
        assert.equal(displayMoneyString('', t), '—');
        assert.equal(differenceTone('+2.50'), 'up');
        assert.equal(differenceTone('-2.00'), 'down');
        assert.equal(differenceTone('0.00'), 'zero');
        assert.equal(differenceTone('+0.00'), 'zero');
        assert.equal(isPeriodLocked(preview), false);
    });

    it('reads a period lock without turning the difference into a number', () => {
        const preview = {
            periodLocked: true,
            periodLockMessage: 'October is closed',
            difference: '-2.00',
        };
        assert.equal(isPeriodLocked(preview), true);
        assert.equal(preview.difference, '-2.00');
        assert.equal(differenceTone(preview.difference), 'down');
    });

    it('counts apply results and journal entries', () => {
        const counts = applyResultCounts({
            applied: true,
            updatedRowCount: 3,
            adjustmentRowCount: 1,
            createdRowCount: 2,
            journals: [
                { journalId: 'j1', entryNumber: 'JV-9', workerId: 'w1', difference: '+2.50' },
                { journalId: 'j2', entryNumber: '', workerId: 'w2', difference: '0.00' },
            ],
        });
        assert.deepEqual(counts, {
            updatedRowCount: 3,
            adjustmentRowCount: 1,
            createdRowCount: 2,
            journalCount: 2,
            entryNumbers: ['JV-9'],
        });
    });
});
