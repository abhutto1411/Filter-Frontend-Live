/**
 * Warehouse unit cost for the stock API.
 * Blank is allowed (server keeps the moving average).
 * Otherwise a non-negative decimal with at most 2 places, sent as a string.
 */
export function validatedUnitCostString(raw) {
    const s = String(raw ?? '').trim().replace(/,/g, '');
    if (!s) return { ok: true, blank: true, value: '' };
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return { ok: false, blank: false, value: '' };
    const [whole, frac = ''] = s.split('.');
    const units = whole.replace(/^0+(?=\d)/, '') || '0';
    return { ok: true, blank: false, value: `${units}.${(frac + '00').slice(0, 2)}` };
}
