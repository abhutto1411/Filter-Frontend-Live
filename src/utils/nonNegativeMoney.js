/** Strip leading minus so price fields cannot be typed negative (super-admin catalog). */
export function sanitizeNonNegativeMoneyInput(raw) {
    if (raw === '' || raw == null) return '';
    const s = String(raw).trim();
    if (!s.startsWith('-')) return s;
    return s.replace(/^-+/, '');
}

/** First field label with a negative numeric value, or null if all OK / empty. */
export function findFirstNegativeMoneyField(labeledValues) {
    for (const { label, value } of labeledValues) {
        if (value === '' || value == null) continue;
        const n = Number(value);
        if (Number.isFinite(n) && n < 0) return label;
    }
    return null;
}

/** Parse money for API payloads; never returns negative (uses fallback instead). */
export function parseNonNegativeNumberOr(value, fallback = 0) {
    if (value === '' || value == null) return fallback;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
}

export const NON_NEGATIVE_MONEY_INPUT_ATTRS = Object.freeze({
    type: 'number',
    min: 0,
    step: '0.01',
});
