/** Parse a qty field without turning negatives into 0 (`Number(-5) || 0` is fine; empty/`NaN` is not). */
export function parseInventoryQty(value) {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).trim().replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
}

export function qtyEquals(a, b, eps = 1e-8) {
    const na = parseInventoryQty(a);
    const nb = parseInventoryQty(b);
    if (na == null || nb == null) return false;
    return Math.abs(na - nb) < eps;
}

/** Counted on-hand may be 0+; negative only when the SKU allows minus stock. Opening must stay ≥ 0. */
export function isValidAdjustNewQty(newQty, { isOpening = false, allowMinus = false } = {}) {
    const n = parseInventoryQty(newQty);
    if (n == null) return false;
    if (isOpening) return n >= 0;
    return n >= 0 || Boolean(allowMinus);
}

export function adjustInputMin({ isOpening = false, allowMinus = false, currentQty = null } = {}) {
    if (isOpening) return 0;
    if (allowMinus) return undefined;
    const current = parseInventoryQty(currentQty);
    if (current != null && current < 0) return undefined;
    return 0;
}
