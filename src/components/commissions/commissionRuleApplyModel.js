import { uniqueWorkerIds } from './commissionApplyWorkers.js';
import { normalizeRuleDate } from './commissionRuleDates.js';

function text(value) {
    if (value == null) return '';
    return String(value).trim();
}

function count(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/** Platform rules and read-only rows are preview-only. */
export function isPlatformCommissionRule(rule) {
    return rule?.scope === 'platform' || Boolean(rule?.readOnly);
}

/**
 * Confirm apply is `!isPlatform && can('edit')`.
 * Preview stays available either way.
 */
export function canConfirmRuleApply(rule, hasEditPermission) {
    const isPlatform = isPlatformCommissionRule(rule);
    return !isPlatform && Boolean(hasEditPermission);
}

/**
 * Body for preview-apply and apply.
 * Omit fromDate when the field is empty. Omit workerIds when none are selected
 * so the server keeps the default: every worker the rule affects.
 */
export function previewApplyBody(fromDate, workerIds) {
    const body = {};
    const day = normalizeRuleDate(fromDate);
    if (day) body.fromDate = day;
    const ids = uniqueWorkerIds(workerIds);
    if (ids.length) body.workerIds = ids;
    return body;
}

export function unwrapApplyResponse(res) {
    if (!res || typeof res !== 'object' || Array.isArray(res)) return res;
    const data = res.data;
    if (
        data &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        (data.workers || data.applied != null || data.ruleId)
    ) {
        return { ...res, ...data };
    }
    return res;
}

export function mapPreviewWorkers(preview) {
    const workers = Array.isArray(preview?.workers) ? preview.workers : [];
    return workers.map((worker, index) => ({
        key: `${worker?.workerId ?? 'w'}-${worker?.branchId ?? index}-${index}`,
        workerId: worker?.workerId ?? '',
        name: text(worker?.name),
        role: text(worker?.role),
        branch: text(worker?.branch),
        oldTotal: text(worker?.oldTotal),
        newTotal: text(worker?.newTotal),
        difference: text(worker?.difference),
        lineCount: count(worker?.lineCount),
        paidRowCount: count(worker?.paidRowCount),
    }));
}

export function previewTotals(preview) {
    return {
        oldTotal: text(preview?.oldTotal),
        newTotal: text(preview?.newTotal),
        difference: text(preview?.difference),
    };
}

export function isPeriodLocked(preview) {
    return Boolean(preview?.periodLocked);
}

/** up | down | zero — sign comes from the API string, not from float math. */
export function differenceTone(difference) {
    const s = text(difference);
    if (!s || s === '0.00' || s === '+0.00' || s === '-0.00') return 'zero';
    if (s.startsWith('+')) return 'up';
    if (s.startsWith('-')) return 'down';
    return 'zero';
}

export function displayMoneyString(value, t) {
    const s = text(value);
    if (!s) return t('emDash');
    return t('money.sar', { amount: s });
}

export function commissionRoleLabel(role, t) {
    const raw = text(role);
    if (!raw) return '';
    const titled = raw.charAt(0).toUpperCase() + raw.slice(1);
    const candidates = [raw, raw.toLowerCase(), titled];
    for (const candidate of candidates) {
        const key = `rules.role.${candidate}`;
        const label = t(key);
        if (label !== key) return label;
    }
    return raw;
}

export function applyResultCounts(res) {
    const journals = Array.isArray(res?.journals) ? res.journals : [];
    return {
        updatedRowCount: count(res?.updatedRowCount),
        adjustmentRowCount: count(res?.adjustmentRowCount),
        createdRowCount: count(res?.createdRowCount),
        journalCount: journals.length,
        entryNumbers: journals
            .map((journal) => journal?.entryNumber)
            .filter((entry) => entry != null && String(entry).trim() !== '')
            .map((entry) => String(entry)),
    };
}
