/**
 * Busy lock for "Edit existing rule" so a double click cannot fetch twice
 * or open the editor twice. Use with a `{ current: boolean }` ref.
 */
export function tryAcquireConflictEditLock(busyRef) {
    if (!busyRef) return true;
    if (busyRef.current) return false;
    busyRef.current = true;
    return true;
}

export function releaseConflictEditLock(busyRef) {
    if (busyRef) busyRef.current = false;
}

/**
 * Session token so a fetch that finishes after the conflict dialog was closed
 * does not open another rule or set an error on a dismissed UI.
 * Call `bumpConflictEditSession` on close; capture `sessionRef.current` when
 * starting the edit and compare after await.
 */
export function bumpConflictEditSession(sessionRef) {
    if (!sessionRef) return 0;
    sessionRef.current = (Number(sessionRef.current) || 0) + 1;
    return sessionRef.current;
}

export function isConflictEditSessionCurrent(sessionRef, startedAt) {
    if (!sessionRef) return true;
    return sessionRef.current === startedAt;
}

/**
 * Resolve a rule to open from the conflict dialog.
 * Prefers the in-memory list (even when search/filter would hide it from the
 * visible table — caller should pass the full loaded `rules` array). If the
 * id is missing from that list, fetches by id.
 *
 * Callers that need a double-click guard should wrap with
 * `tryAcquireConflictEditLock` / `releaseConflictEditLock` (and disable the
 * button while busy).
 *
 * @param {{
 *   id: string|number,
 *   rules?: Array<{ id?: string|number }>,
 *   fetchRule: (id: string) => Promise<unknown>,
 * }} args
 * @returns {Promise<{ ok: true, rule: object } | { ok: false, errorKey: string }>}
 */
export async function resolveRuleForConflictEdit({ id, rules, fetchRule }) {
    const want = String(id ?? '').trim();
    if (!want) return { ok: false, errorKey: 'rules.conflicts.editLoadError' };

    const found = Array.isArray(rules)
        ? rules.find((r) => String(r?.id ?? '').trim() === want)
        : null;
    if (found) return { ok: true, rule: found };

    if (typeof fetchRule !== 'function') {
        return { ok: false, errorKey: 'rules.conflicts.editLoadError' };
    }

    try {
        const res = await fetchRule(want);
        const next = res && typeof res === 'object' ? res.rule || res : null;
        if (next && typeof next === 'object' && String(next.id ?? '').trim() !== '') {
            return { ok: true, rule: next };
        }
        return { ok: false, errorKey: 'rules.conflicts.editLoadError' };
    } catch {
        return { ok: false, errorKey: 'rules.conflicts.editLoadError' };
    }
}
