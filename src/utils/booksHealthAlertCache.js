/** 5-minute cache for Accounting menu alert dot (P-A9B). */

const CACHE_MS = 5 * 60 * 1000;
const KEY = 'filter.booksHealth.alert';

/** In-memory fallback when sessionStorage is unavailable (node tests). */
let memoryCache = null;

function storageGet() {
    try {
        if (typeof sessionStorage !== 'undefined') {
            return sessionStorage.getItem(KEY);
        }
    } catch {
        /* ignore */
    }
    return memoryCache;
}

function storageSet(raw) {
    memoryCache = raw;
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(KEY, raw);
        }
    } catch {
        /* ignore quota */
    }
}

function storageClear() {
    memoryCache = null;
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(KEY);
        }
    } catch {
        /* ignore */
    }
}

export function readBooksHealthAlertCache(now = Date.now()) {
    try {
        const raw = storageGet();
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (typeof parsed.fetchedAt !== 'number') return null;
        if (now - parsed.fetchedAt > CACHE_MS) return null;
        return {
            showDot: Boolean(parsed.showDot),
            fetchedAt: parsed.fetchedAt,
        };
    } catch {
        return null;
    }
}

export function writeBooksHealthAlertCache(showDot, now = Date.now()) {
    storageSet(JSON.stringify({ showDot: Boolean(showDot), fetchedAt: now }));
}

export function clearBooksHealthAlertCache() {
    storageClear();
}

/** True when failed/dead postings or setup problems exist. */
export function booksHealthShouldShowAlert(summary) {
    if (!summary || typeof summary !== 'object') return false;
    const dead = Number(summary.deadPostings ?? 0);
    const problems = Array.isArray(summary.problems) ? summary.problems.length : 0;
    const setupBad = summary.setupOk === false;
    return dead > 0 || problems > 0 || setupBad;
}
