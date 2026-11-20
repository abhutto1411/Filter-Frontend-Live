import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    APPLY_ERROR_CODE_KEYS,
    WORKER_SELECTION_CAP,
    formatSelectedWorkerCount,
    friendlyApplyErrorMessage,
    isInsideCombo,
    nextWorkerListGeneration,
    presentApplyServerError,
    previewCoverage,
    readCommissionWorkerPage,
    samePreviewInputs,
    selectAllShownWorkers,
    shouldCloseOnFocusLeave,
    shouldCloseOnOutside,
    toggleWorkerSelection,
    uniqueWorkerIds,
    workerListResponseIsCurrent,
    workerSearchParams,
} from './commissionApplyWorkers.js';
import { previewApplyBody } from './commissionRuleApplyModel.js';
import { wcomT } from '../../utils/workshopCommissionsI18n.js';

describe('commission apply worker selection', () => {
    it('toggles one id and keeps the string the API sent', () => {
        const added = toggleWorkerSelection([], '44');
        assert.deepEqual(added, { ids: ['44'], capped: false });
        assert.deepEqual(toggleWorkerSelection(added.ids, '045'), { ids: ['44', '045'], capped: false });
        assert.deepEqual(toggleWorkerSelection(['44', '045'], '44'), { ids: ['045'], capped: false });
        assert.deepEqual(uniqueWorkerIds(['44', '44', '45']), ['44', '45']);
    });

    it('stops at 500 and does not drop the workers already chosen', () => {
        const full = Array.from({ length: WORKER_SELECTION_CAP }, (_, i) => String(i + 1));
        const blocked = toggleWorkerSelection(full, '501');
        assert.equal(blocked.capped, true);
        assert.equal(blocked.ids.length, 500);
        assert.equal(blocked.ids[0], '1');
        assert.equal(blocked.ids.includes('501'), false);
        const room = toggleWorkerSelection(full.slice(0, 499), '501');
        assert.equal(room.capped, false);
        assert.equal(room.ids.at(-1), '501');
    });

    it('selects only the workers shown on this page and still stops at 500', () => {
        const shown = [{ id: '44', name: 'Ali' }, { id: '45' }, { id: '44' }];
        assert.deepEqual(selectAllShownWorkers(['45'], shown), { ids: ['45', '44'], capped: false });
        const almost = Array.from({ length: 499 }, (_, i) => String(i + 1));
        const page = ['1', '900', '901'];
        const result = selectAllShownWorkers(almost, page);
        assert.equal(result.capped, true);
        assert.deepEqual(result.ids.slice(-1), ['900']);
        assert.equal(result.ids.includes('901'), false);
        assert.equal(result.ids.includes('2'), true);
    });

    it('treats a preview as current only for the same rule, date, and workers', () => {
        const pending = { ruleId: '9', fromDate: '2026-08-01', workerIds: ['45', '44'] };
        assert.equal(samePreviewInputs(pending, { ruleId: '9', fromDate: '2026-08-01', workerIds: ['44', '45'] }), true);
        assert.equal(samePreviewInputs(pending, { ruleId: '9', fromDate: '', workerIds: [] }), false);
        assert.equal(samePreviewInputs(
            { ruleId: '9', fromDate: '', workerIds: [] },
            { ruleId: '9', fromDate: '', workerIds: [] },
        ), true);
        assert.equal(samePreviewInputs(pending, { ruleId: '9', fromDate: '2026-08-02', workerIds: ['44', '45'] }), false);
        assert.equal(samePreviewInputs(pending, { ruleId: '8', fromDate: '2026-08-01', workerIds: ['44', '45'] }), false);
        assert.equal(samePreviewInputs(pending, { ruleId: '9', fromDate: '2026-08-01', workerIds: ['44'] }), false);
        assert.equal(samePreviewInputs(null, pending), false);
    });

    it('omits workerIds when none are selected and sends them with the from date', () => {
        assert.deepEqual(previewApplyBody(''), {});
        assert.deepEqual(previewApplyBody('2026-08-01', []), { fromDate: '2026-08-01' });
        assert.deepEqual(previewApplyBody('', ['44', '44', '45']), { workerIds: ['44', '45'] });
        assert.deepEqual(previewApplyBody('2026-08-01', ['44', '45']), {
            fromDate: '2026-08-01',
            workerIds: ['44', '45'],
        });
        assert.deepEqual(previewApplyBody('not-a-date', []), {});
    });

    it('reads a worker page and hides Prisma errors', () => {
        assert.deepEqual(workerSearchParams({ q: '  ', offset: 0, workshopId: '' }), { limit: 20, offset: 0 });
        assert.deepEqual(workerSearchParams({ q: 'ali', offset: 20, workshopId: 'w1', limit: 80 }), {
            limit: 50,
            offset: 20,
            q: 'ali',
            workshopId: 'w1',
        });
        assert.deepEqual(readCommissionWorkerPage({
            workers: [{ id: '44', name: 'Ali', role: 'workshop', branchId: '3', branch: 'Main' }],
            nextOffset: null,
        }), {
            workers: [{ id: '44', name: 'Ali', role: 'workshop', branchId: '3', branch: 'Main' }],
            nextOffset: null,
        });
        assert.deepEqual(previewCoverage({ selectedWorkerIds: null }), { kind: 'all', count: 0 });
        assert.deepEqual(previewCoverage({ selectedWorkerIds: ['44', '45'] }), { kind: 'selected', count: 2 });
        const tr = (key) => `tr:${key}`;
        assert.equal(friendlyApplyErrorMessage('Select at most 500 workers.', tr, 'fallback'), 'tr:apply.err.maxWorkers');
        assert.equal(friendlyApplyErrorMessage('workerIds must be an array of ids', tr, 'fallback'), 'tr:apply.err.workerIds');
        assert.equal(
            friendlyApplyErrorMessage('One or more workers are not in this workshop.', tr, 'fallback'),
            'tr:apply.err.notInWorkshop',
        );
        assert.equal(friendlyApplyErrorMessage('October is closed', tr, 'fallback'), 'October is closed');
        assert.equal(friendlyApplyErrorMessage('Select at most 500 workers', tr, 'fallback'), 'Select at most 500 workers');
        assert.equal(friendlyApplyErrorMessage('', tr, 'fallback'), 'fallback');
        assert.equal(
            friendlyApplyErrorMessage('Invalid `prisma.worker.findMany()` invocation', tr, 'fallback'),
            'tr:apply.err.generic',
        );
        assert.equal(friendlyApplyErrorMessage('prisma.commissionLine.findMany failed', tr, 'fallback'), 'tr:apply.err.generic');
    });

    it('ignores a load-more page after a newer search starts', () => {
        const first = nextWorkerListGeneration(0, 'search');
        assert.deepEqual(first, { generation: 1, loadingMore: false, replace: true });
        const more = nextWorkerListGeneration(first.generation, 'more');
        assert.deepEqual(more, { generation: 1, loadingMore: true, replace: false });
        const newer = nextWorkerListGeneration(more.generation, 'search');
        assert.equal(newer.loadingMore, false);
        assert.equal(workerListResponseIsCurrent(newer.generation, more.generation), false);
        assert.equal(workerListResponseIsCurrent(newer.generation, newer.generation), true);
    });

    it('uses one selected-count phrase for 11 and above', () => {
        const t = (key, vars) => wcomT('en', key, vars);
        assert.equal(formatSelectedWorkerCount(11, t), '11 selected workers');
        assert.equal(formatSelectedWorkerCount(11, (key, vars) => wcomT('ar', key, vars)), 'المحدد: 11');
        assert.equal(wcomT('ar', 'apply.coverageSelected', { count: 12 }), 'المحدد: 12');
        assert.equal(wcomT('en', 'apply.coverageSelected', { count: 12 }), '12 selected workers');
    });

    it('maps apply errors by code first, then by the English sentence', () => {
        const en = (key, vars) => wcomT('en', key, vars);
        const ar = (key, vars) => wcomT('ar', key, vars);
        const tooLarge = {
            code: 'COMMISSION_APPLY_WINDOW_TOO_LARGE',
            message: 'This date range is too large (1400 jobs). Select fewer workers or choose a shorter date range.',
            count: 1400,
            limit: 500,
        };
        assert.equal(
            presentApplyServerError(tooLarge, en, 'fallback'),
            'This date range is too large (1400 jobs, limit 500). Select fewer workers or choose a shorter From date, one week at a time.',
        );
        assert.equal(
            presentApplyServerError(tooLarge, ar, 'fallback'),
            'هذه الفترة كبيرة جداً (1400 عملية، الحد 500). اختر موظفين أقل أو تاريخ «من» أقصر، أسبوعاً بأسبوع.',
        );
        assert.equal(
            presentApplyServerError({
                code: 'COMMISSION_APPLY_WINDOW_TOO_LARGE',
                message: 'Select at most 500 workers.',
                count: '1400.9',
                limit: null,
            }, en, 'fallback'),
            'This date range is too large (— jobs, limit —). Select fewer workers or choose a shorter From date, one week at a time.',
        );
        assert.match(presentApplyServerError({ code: 'COMMISSION_APPLY_TIMEOUT', message: 'timed out' }, en, 'fallback'), /shorter From date/);
        assert.match(presentApplyServerError({ code: 'COMMISSION_APPLY_FAILED', message: 'failed' }, ar, 'fallback'), /تعذر إكمال/);
        assert.equal(
            presentApplyServerError({ message: 'Select at most 500 workers.' }, en, 'fallback'),
            'Select at most 500 workers.',
        );
        assert.equal(presentApplyServerError({ message: 'October is closed' }, en, 'fallback'), 'October is closed');
        assert.equal(
            presentApplyServerError({
                code: 'OTHER',
                message: 'Invalid `prisma.job.findMany()` invocation\n    at foo (bar.js:1:1)',
            }, en, 'fallback'),
            'Something went wrong. Please try again.',
        );
    });

    it('maps a preview timeout code to the localized review message', () => {
        const en = (key, vars) => wcomT('en', key, vars);
        const ar = (key, vars) => wcomT('ar', key, vars);
        const err = { code: 'COMMISSION_PREVIEW_TIMEOUT', message: 'Preview timed out' };
        assert.equal(APPLY_ERROR_CODE_KEYS.COMMISSION_PREVIEW_TIMEOUT, 'apply.err.previewTimeout');
        assert.equal(
            presentApplyServerError(err, en, 'fallback'),
            'Reviewing this date range took too long. Please choose a shorter date range or fewer workers.',
        );
        assert.equal(
            presentApplyServerError(err, ar, 'fallback'),
            'استغرقت مراجعة هذه الفترة وقتاً طويلاً. اختر فترة أقصر أو موظفين أقل.',
        );
    });

    it('keeps an unknown code on the generic message', () => {
        const en = (key, vars) => wcomT('en', key, vars);
        assert.equal(APPLY_ERROR_CODE_KEYS.NOT_A_KNOWN_CODE, undefined);
        assert.equal(
            presentApplyServerError({
                code: 'NOT_A_KNOWN_CODE',
                message: 'Invalid `prisma.preview()` invocation',
            }, en, 'fallback'),
            'Something went wrong. Please try again.',
        );
    });

    it('closes the worker list only when the pointer or focus leaves the combo', () => {
        const input = { id: 'input' };
        const option = { id: 'option' };
        const tool = { id: 'select-shown' };
        const chip = { id: 'chip' };
        const combo = {
            contains(target) {
                return target === combo || target === input || target === option || target === tool;
            },
        };

        assert.equal(isInsideCombo(combo, input), true);
        assert.equal(isInsideCombo(combo, option), true);
        assert.equal(isInsideCombo(combo, tool), true);
        assert.equal(isInsideCombo(combo, chip), false);
        assert.equal(isInsideCombo(combo, null), false);
        assert.equal(isInsideCombo(null, chip), false);

        assert.equal(shouldCloseOnOutside(combo, chip), true);
        assert.equal(shouldCloseOnOutside(combo, option), false);
        assert.equal(shouldCloseOnOutside(combo, tool), false);
        assert.equal(shouldCloseOnOutside(combo, null), false);
        assert.equal(shouldCloseOnOutside(null, chip), false);

        assert.equal(shouldCloseOnFocusLeave(combo, null), false);
        assert.equal(shouldCloseOnFocusLeave(combo, option), false);
        assert.equal(shouldCloseOnFocusLeave(combo, tool), false);
        assert.equal(shouldCloseOnFocusLeave(combo, chip), true);
        assert.equal(shouldCloseOnFocusLeave(null, chip), true);
        assert.equal(shouldCloseOnFocusLeave(null, null), false);
    });
});
