const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealYmd(value) {
    const match = YMD.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Calendar day `YYYY-MM-DD`, or '' when the value is empty or not a real day. */
export function normalizeRuleDate(value) {
    if (value == null) return '';
    const text = String(value).trim();
    if (!text) return '';
    if (isRealYmd(text)) return text;
    const head = text.slice(0, 10);
    return isRealYmd(head) ? head : '';
}

/**
 * @returns {''|'order'|'invalid'}
 * `order` when both dates are real and Effective to is before Effective from.
 */
export function ruleEffectiveDateError(from, to) {
    const fromText = String(from ?? '').trim();
    const toText = String(to ?? '').trim();
    if (fromText && !isRealYmd(fromText)) return 'invalid';
    if (toText && !isRealYmd(toText)) return 'invalid';
    if (fromText && toText && toText < fromText) return 'order';
    return '';
}

/** Always send both keys. Empty input becomes null. */
export function ruleEffectivePayload(from, to) {
    return {
        effectiveFrom: normalizeRuleDate(from) || null,
        effectiveTo: normalizeRuleDate(to) || null,
    };
}

export function ruleEffectiveParts(rule) {
    return {
        from: normalizeRuleDate(rule?.effectiveFrom ?? rule?.effective_from),
        to: normalizeRuleDate(rule?.effectiveTo ?? rule?.effective_to),
    };
}

export function formatRuleEffective(rule, t) {
    const { from, to } = ruleEffectiveParts(rule);
    if (from && to) return t('rules.effectiveRange', { from, to });
    if (from) return t('rules.effectiveFromValue', { from });
    if (to) return t('rules.effectiveToValue', { to });
    return '';
}

export function optionalFromDateError(fromDate) {
    const text = String(fromDate ?? '').trim();
    if (!text) return '';
    return isRealYmd(text) ? '' : 'invalid';
}

/**
 * Which save to run. A second Save after create must update `savedRuleId`.
 * `inFlight` skips a double-click. `createdWithoutId` skips every later Save
 * when create succeeded but the response had no id, so the form does not stay in create mode.
 * @returns {{ action: 'skip'|'update'|'create', id: string }}
 */
export function commissionRuleSavePlan({ ruleId, savedRuleId, inFlight, createdWithoutId } = {}) {
    if (inFlight || createdWithoutId) return { action: 'skip', id: '' };
    const preferred = savedRuleId != null && String(savedRuleId).trim() !== '' ? savedRuleId : ruleId;
    const id = preferred != null && String(preferred).trim() !== '' ? String(preferred) : '';
    if (id) return { action: 'update', id };
    return { action: 'create', id: '' };
}

/** Id returned by create/update, with the edited rule as a fallback. */
export function savedRuleIdentity(res, fallback = {}) {
    const list = [];
    if (res && typeof res === 'object' && !Array.isArray(res)) {
        if (res.rule && typeof res.rule === 'object') list.push(res.rule);
        const data = res.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            if (data.rule && typeof data.rule === 'object') list.push(data.rule);
            list.push(data);
        }
        list.push(res);
    }
    for (const row of list) {
        if (row && row.id != null && String(row.id).trim() !== '') {
            return {
                id: String(row.id),
                name: String(row.name || fallback.name || ''),
            };
        }
    }
    if (fallback.id != null && String(fallback.id).trim() !== '') {
        return { id: String(fallback.id), name: String(fallback.name || '') };
    }
    return null;
}
