import { normalizeRuleDate } from './commissionRuleDates.js';

/** Server rejects more than this many ids on preview and apply. */
export const WORKER_SELECTION_CAP = 500;

export const WORKER_SEARCH_LIMIT = 20;
export const WORKER_QUERY_MAX = 80;

function workerKey(raw) {
    const value = raw != null && typeof raw === 'object' ? raw.id : raw;
    if (value == null) return '';
    const id = String(value);
    return id.trim() === '' ? '' : id;
}

/** Ids in first-seen order. The string is sent back unchanged (no numeric rewrite). */
export function uniqueWorkerIds(workerIds) {
    if (!Array.isArray(workerIds)) return [];
    const ids = [];
    const seen = new Set();
    for (const raw of workerIds) {
        const id = workerKey(raw);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
    }
    return ids;
}

/**
 * Add or remove one worker. At the cap, a new id is refused and `capped` is true.
 * @returns {{ ids: string[], capped: boolean }}
 */
export function toggleWorkerSelection(selectedIds, id) {
    const ids = uniqueWorkerIds(selectedIds);
    const key = workerKey(id);
    if (!key) return { ids, capped: false };
    if (ids.includes(key)) {
        return { ids: ids.filter((item) => item !== key), capped: false };
    }
    if (ids.length >= WORKER_SELECTION_CAP) return { ids, capped: true };
    return { ids: [...ids, key], capped: false };
}

/**
 * Add every id in `shown` that is not already selected.
 * `shown` is the rows on screen (the loaded page), never the whole workshop.
 * Stops at the cap and reports `capped` when a shown id did not fit.
 * @returns {{ ids: string[], capped: boolean }}
 */
export function selectAllShownWorkers(selectedIds, shown) {
    const ids = uniqueWorkerIds(selectedIds);
    const seen = new Set(ids);
    let capped = false;
    for (const raw of shown || []) {
        const id = workerKey(raw);
        if (!id || seen.has(id)) continue;
        if (ids.length >= WORKER_SELECTION_CAP) {
            capped = true;
            break;
        }
        seen.add(id);
        ids.push(id);
    }
    return { ids, capped };
}

/** Query for GET .../rules/:id/workers. Empty search is omitted (first page). */
export function workerSearchParams({ q, offset, workshopId, limit } = {}) {
    const params = { limit: WORKER_SEARCH_LIMIT, offset: 0 };
    const query = String(q ?? '').trim().slice(0, WORKER_QUERY_MAX);
    if (query) params.q = query;
    const off = Number(offset);
    if (Number.isFinite(off) && off > 0) params.offset = Math.floor(off);
    const lim = Number(limit);
    if (Number.isFinite(lim) && lim > 0) params.limit = Math.min(50, Math.floor(lim));
    if (workshopId != null && String(workshopId).trim() !== '') {
        params.workshopId = String(workshopId).trim();
    }
    return params;
}

/** Read a worker search page. `nextOffset` is null on the last page. */
export function readCommissionWorkerPage(res) {
    const wrapped = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
        ? res.data
        : res;
    const source = wrapped && typeof wrapped === 'object' ? wrapped : {};
    const workers = [];
    for (const row of Array.isArray(source.workers) ? source.workers : []) {
        const id = workerKey(row);
        if (!id) continue;
        workers.push({
            id,
            name: row?.name == null ? '' : String(row.name),
            role: row?.role == null ? '' : String(row.role),
            branchId: row?.branchId == null ? '' : String(row.branchId),
            branch: row?.branch == null ? '' : String(row.branch),
        });
    }
    let nextOffset = null;
    if (source.nextOffset != null && source.nextOffset !== '') {
        const n = Number(source.nextOffset);
        if (Number.isFinite(n) && n >= 0) nextOffset = n;
    }
    return { workers, nextOffset };
}

/**
 * Preview and apply may run only for the same rule, from-date, and worker set
 * that produced the preview. Order of ids does not matter. Empty means all workers.
 */
export function samePreviewInputs(pending, current) {
    if (!pending || !current) return false;
    if (String(pending.ruleId ?? '') !== String(current.ruleId ?? '')) return false;
    const pendingDay = normalizeRuleDate(pending.fromDate) || '';
    const currentDay = normalizeRuleDate(current.fromDate) || '';
    if (pendingDay !== currentDay) return false;
    const left = uniqueWorkerIds(pending.workerIds).slice().sort();
    const right = uniqueWorkerIds(current.workerIds).slice().sort();
    if (left.length !== right.length) return false;
    return left.every((id, index) => id === right[index]);
}

/**
 * Search replaces the list and starts a new generation. Load-more keeps that generation.
 * A newer search makes the in-flight load-more stale and clears its loading flag.
 */
export function nextWorkerListGeneration(current, kind) {
    const previous = Number(current) || 0;
    if (kind === 'search') {
        return { generation: previous + 1, loadingMore: false, replace: true };
    }
    return { generation: previous, loadingMore: true, replace: false };
}

/** True only for the generation that is still the active search. */
export function workerListResponseIsCurrent(activeGeneration, requestGeneration) {
    return Number(activeGeneration) === Number(requestGeneration);
}

/**
 * One phrase for every count. Arabic uses a neutral form so 11+ is not the 3–10 plural.
 * @param {string} [key]
 */
export function formatSelectedWorkerCount(count, t, key = 'apply.workersSelected') {
    const n = Number(count);
    const safe = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    return t(key, { count: safe });
}

/** `selectedWorkerIds` null means the preview covers every worker. */
export function previewCoverage(preview) {
    const ids = preview?.selectedWorkerIds;
    if (!Array.isArray(ids)) return { kind: 'all', count: 0 };
    const unique = uniqueWorkerIds(ids);
    return { kind: 'selected', count: unique.length };
}

/**
 * True when `target` is inside the combo (search, list, and tools).
 * `container` is anything with `contains(node)` — an element, or a test double.
 * A missing container or target is not inside.
 */
export function isInsideCombo(container, target) {
    if (container == null || target == null) return false;
    if (typeof container.contains !== 'function') return false;
    return container.contains(target) === true;
}

/**
 * Close on a pointer event only when it lands outside the combo.
 * A missing container or target does not close.
 */
export function shouldCloseOnOutside(container, target) {
    if (container == null || target == null) return false;
    return !isInsideCombo(container, target);
}

/**
 * Close when focus moves from the combo to another element.
 * A null `relatedTarget` does not close: option rows are not focusable, and their
 * mousedown preventDefault can blur the search box with no next element. A real
 * click outside is closed by `shouldCloseOnOutside` instead.
 */
export function shouldCloseOnFocusLeave(container, relatedTarget) {
    if (relatedTarget == null) return false;
    if (container == null) return true;
    return !isInsideCombo(container, relatedTarget);
}

/** Exact English 400 text from the apply API, mapped to i18n keys. */
export const APPLY_SERVER_ERROR_KEYS = {
    'Select at most 500 workers.': 'apply.err.maxWorkers',
    'workerIds must be an array of ids': 'apply.err.workerIds',
    'One or more workers are not in this workshop.': 'apply.err.notInWorkshop',
};

/**
 * Prefer `code` over English text. Add or rename a row here when the backend confirms a code.
 * Window-too-large interpolates `{count}` and `{limit}`.
 */
export const APPLY_ERROR_CODE_KEYS = {
    COMMISSION_APPLY_WINDOW_TOO_LARGE: 'apply.err.windowTooLarge',
    COMMISSION_APPLY_TIMEOUT: 'apply.err.timeout',
    COMMISSION_APPLY_FAILED: 'apply.err.failed',
    COMMISSION_PREVIEW_TIMEOUT: 'apply.err.previewTimeout',
};

export const APPLY_GENERIC_ERROR_KEY = 'apply.err.generic';

function isPrismaLeak(text) {
    return /invalid `prisma/i.test(text) || /prisma\./i.test(text);
}

function isStackLeak(text) {
    return text.includes('\n') && /\bat\s+\S+/.test(text);
}

/** Whole-number text for job counts. Anything else stays out of the sentence. */
function applyCountText(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
    const text = String(value ?? '').trim();
    return /^-?\d+$/.test(text) ? text : '—';
}

/**
 * i18n key for a known apply error, the generic key for Prisma text, or '' so the
 * caller can show any other server sentence as-is.
 */
export function applyServerErrorKey(message) {
    const text = String(message ?? '').trim();
    if (!text) return '';
    if (isPrismaLeak(text) || isStackLeak(text)) return APPLY_GENERIC_ERROR_KEY;
    return APPLY_SERVER_ERROR_KEYS[text] || '';
}

/**
 * Show a translated apply/preview error.
 * `code` wins, then an exact English sentence, then the server text.
 * Prisma and stack text become the generic message.
 */
export function presentApplyServerError(err, t, fallback) {
    const body = err && typeof err === 'object' ? err : {};
    const text = (typeof err === 'string' ? err : String(body.message ?? '')).trim();
    const code = body.code == null ? '' : String(body.code).trim();
    const codeKey = APPLY_ERROR_CODE_KEYS[code];
    if (codeKey && typeof t === 'function') {
        return t(codeKey, { count: applyCountText(body.count), limit: applyCountText(body.limit) });
    }
    if (isPrismaLeak(text) || isStackLeak(text)) {
        return typeof t === 'function' ? t(APPLY_GENERIC_ERROR_KEY) : fallback;
    }
    return friendlyApplyErrorMessage(text, t, fallback);
}

/**
 * Translate a known 400 or a Prisma leak. Any other non-empty server message is returned unchanged.
 * `t` is `(key) => string`. `fallback` is used when the server sent no message.
 */
export function friendlyApplyErrorMessage(message, t, fallback) {
    const key = applyServerErrorKey(message);
    if (key) return typeof t === 'function' ? t(key) : fallback;
    const text = String(message ?? '').trim();
    if (!text) return fallback;
    return text;
}
