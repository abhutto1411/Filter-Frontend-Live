/**
 * Evaluate a simple arithmetic expression for money inputs (e.g. 1000+440, 12*1.15).
 * Returns the original string when empty or not a safe expression.
 * @param {string|number} expr
 * @param {{ decimals?: number }} [opts]
 * @returns {string}
 */
export function evalMathExpression(expr, opts = {}) {
    const decimals = Number.isFinite(opts.decimals) ? opts.decimals : 2;
    const str = String(expr ?? '').trim();
    if (!str) return '';
    if (!/^[\d\s+\-*/.()]+$/.test(str)) return str;
    if (/^\d+(\.\d+)?$/.test(str)) return str;
    try {
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${str})`)();
        if (typeof result === 'number' && Number.isFinite(result)) {
            return parseFloat(result.toFixed(decimals)).toString();
        }
    } catch {
        /* keep original */
    }
    return str;
}

/** Apply evalMathExpression on blur / Enter for controlled amount fields. */
export function commitMathFieldValue(raw, opts = {}) {
    return evalMathExpression(raw, opts);
}
