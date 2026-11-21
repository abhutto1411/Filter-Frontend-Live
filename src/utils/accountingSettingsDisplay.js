/**
 * Pure helpers for Accounting settings (P-A10B).
 * No money maths — dates/history mapping only.
 */

export const ACC_SETTINGS_PAGE_SIZE = 25;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function parseYmd(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim().slice(0, 10);
    return YMD.test(s) ? s : null;
}

/** Inclusive calendar-day count from dayAfter(fromExclusive) through toInclusive. */
export function ymdDayDiffInclusive(fromExclusive, toInclusive) {
    const a = parseYmd(fromExclusive);
    const b = parseYmd(toInclusive);
    if (!a || !b || b < a) return 0;
    const t0 = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
    const t1 = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
    return Math.floor((t1 - t0) / 86400000) + 1;
}

/**
 * Days being unlocked when lockedUpTo moves earlier (or clears).
 * Moving later / same = 0 (not an unlock).
 */
export function unlockDaysCount(prevLockedUpTo, nextLockedUpTo) {
    const prev = parseYmd(prevLockedUpTo);
    const next = parseYmd(nextLockedUpTo);
    if (!prev) return 0;
    if (!next) {
        // Cleared lock — count unknown without start; treat as unlock needing confirm.
        return Math.max(1, ymdDayDiffInclusive('1970-01-01', prev));
    }
    if (next >= prev) return 0;
    // Unlock days = (next+1) … prev inclusive = dayDiff(next+1 day, prev)
    const d = new Date(Date.UTC(+next.slice(0, 4), +next.slice(5, 7) - 1, +next.slice(8, 10)));
    d.setUTCDate(d.getUTCDate() + 1);
    const start = d.toISOString().slice(0, 10);
    return ymdDayDiffInclusive(start, prev);
}

export function normalizeBranchOverrideMap(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'boolean') out[String(k)] = v;
    }
    return out;
}

export function branchOverrideTriState(map, branchId) {
    const key = String(branchId);
    const m = map && typeof map === 'object' ? map : {};
    if (!Object.prototype.hasOwnProperty.call(m, key)) return 'inherit';
    return m[key] ? 'allow' : 'block';
}

export function setBranchOverrideTriState(map, branchId, tri) {
    const next = { ...(map || {}) };
    const key = String(branchId);
    if (tri === 'inherit') {
        delete next[key];
    } else {
        next[key] = tri === 'allow';
    }
    return next;
}

export function settingsDirty(draft, saved) {
    const s = saved || {};
    const d = draft || {};
    const draftBranch = normalizeBranchOverrideMap(d.allowNegativeCashBankByBranch);
    const savedBranch = normalizeBranchOverrideMap(s.allowNegativeCashBankByBranch);
    return (
        parseYmd(d.startDate) !== parseYmd(s.startDate) ||
        parseYmd(d.lockedUpTo) !== parseYmd(s.lockedUpTo) ||
        Boolean(d.cutoverEnabled) !== Boolean(s.cutoverEnabled) ||
        String(d.basis || 'accrual') !== String(s.basis || 'accrual') ||
        Boolean(d.allowNegativeCashBank) !== Boolean(s.allowNegativeCashBank) ||
        JSON.stringify(draftBranch) !== JSON.stringify(savedBranch)
    );
}

const FIELD_KEYS = [
    'startDate',
    'lockedUpTo',
    'cutoverEnabled',
    'basis',
    'allowNegativeCashBank',
    'allowNegativeCashBankByBranch',
];

export function fieldLabelKey(field) {
    const map = {
        startDate: 'accSettings.field.startDate',
        lockedUpTo: 'accSettings.field.lockedUpTo',
        cutoverEnabled: 'accSettings.field.cutover',
        basis: 'accSettings.field.basis',
        allowNegativeCashBank: 'accSettings.field.allowNegativeCashBank',
        allowNegativeCashBankByBranch: 'accSettings.field.allowNegativeCashBankByBranch',
    };
    return map[field] || 'accSettings.field.unknown';
}

/** Flatten history entries into table rows (one per changed field). Newest first. */
export function flattenSettingsHistory(history) {
    const rows = [];
    const list = Array.isArray(history) ? history : [];
    for (const h of list) {
        if (!h || typeof h !== 'object') continue;
        const before = h.before && typeof h.before === 'object' ? h.before : {};
        const after = h.after && typeof h.after === 'object' ? h.after : {};
        for (const field of FIELD_KEYS) {
            const oldV = before[field];
            const newV = after[field];
            if (String(oldV ?? '') === String(newV ?? '')) continue;
            rows.push({
                at: h.at || '',
                userId: h.byUserId != null ? String(h.byUserId) : '',
                field,
                oldValue: formatHistoryCell(oldV),
                newValue: formatHistoryCell(newV),
                reason: h.reason != null ? String(h.reason) : '',
            });
        }
    }
    rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return rows;
}

function formatHistoryCell(v) {
    if (v == null || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'object') {
        try {
            return JSON.stringify(v);
        } catch {
            return String(v);
        }
    }
    return String(v);
}

export function slicePage(rows, page, pageSize = ACC_SETTINGS_PAGE_SIZE) {
    const list = Array.isArray(rows) ? rows : [];
    const size = Math.max(1, Number(pageSize) || ACC_SETTINGS_PAGE_SIZE);
    const pageCount = Math.max(1, Math.ceil(list.length / size) || 1);
    const current = Math.min(Math.max(1, Number(page) || 1), pageCount);
    const start = (current - 1) * size;
    return {
        rows: list.slice(start, start + size),
        page: current,
        pageCount,
        total: list.length,
        from: list.length === 0 ? 0 : start + 1,
        to: Math.min(list.length, start + size),
    };
}

/**
 * Inline PERIOD_LOCKED copy. Prefer lockedUpTo on error if present;
 * else parse from message (api.js does not forward extra JSON fields).
 */
export function extractLockedUpToFromError(err) {
    if (err?.lockedUpTo && YMD.test(String(err.lockedUpTo).slice(0, 10))) {
        return String(err.lockedUpTo).slice(0, 10);
    }
    const msg = String(err?.message || '');
    const m =
        msg.match(/lockedUpTo\s+(\d{4}-\d{2}-\d{2})/i) ||
        msg.match(/locked through\s+(\d{4}-\d{2}-\d{2})/i) ||
        msg.match(/up to\s+(\d{4}-\d{2}-\d{2})/i);
    return m ? m[1] : null;
}

export function isPeriodLockedError(err) {
    return (
        Number(err?.status) === 423 ||
        String(err?.code || '').trim() === 'PERIOD_LOCKED'
    );
}

export function periodLockedMessageVars(err) {
    return { date: extractLockedUpToFromError(err) || '—' };
}

export function reportShowsLegacy(report) {
    return Boolean(report && report.legacy === true);
}

export function reportLegacyBefore(report) {
    const d = parseYmd(report?.legacyBefore);
    return d || null;
}
