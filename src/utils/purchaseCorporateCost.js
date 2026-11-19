/**
 * CORPORATE-FIX-02-FINAL D5-4 (pure): 5100 "Cost of Corporate Services" is
 * reserved for HQ corporate cost. Purchase screens default non-stock lines
 * to 5000 Cost of Goods Sold, hide the corporate row in the pickers, and
 * flag (without changing) a saved line that sits on it.
 * Identity = backend D5-2: code 5100 + name "Cost of Corporate Services"
 * (+ isAutoSeed when the API sends it).
 */
export const CORP_COST_CODE = '5100';
export const CORP_COST_NAME = 'Cost of Corporate Services';
export const PURCHASE_COGS_CODE = '5000';
export const PURCHASE_COGS_LABEL = '5000 - Cost of Goods Sold';
/** Old unsaved default. Remap only when the line was not loaded from a saved invoice. */
export const LEGACY_PURCHASE_COGS_LABEL = '5100 - Cost of Goods Sold';

export function isCorporateCostOption(opt) {
    if (!opt) return false;
    if (String(opt.code ?? '').trim() !== CORP_COST_CODE) return false;
    if (opt.isAutoSeed === false) return false;
    return String(opt.name ?? '').trim() === CORP_COST_NAME;
}

/** Default COGS for new non-stock lines: 5000 leaf, else a COGS-named non-corporate leaf. Headings are skipped. */
export function findPurchaseCogs(leaves) {
    const list = (Array.isArray(leaves) ? leaves : []).filter(
        (r) => !r?.isHeading && !r?.hasChildren,
    );
    return (
        list.find((r) => String(r.code) === PURCHASE_COGS_CODE) ||
        list.find((r) => /cost of goods/i.test(String(r.name ?? '')) && !isCorporateCostOption(r)) ||
        null
    );
}

export function purchaseCogsLabel(leaves) {
    const row = findPurchaseCogs(leaves);
    return row ? `${row.code} - ${row.name}` : null;
}

/** Unsaved placeholder labels that should become the live COGS leaf. */
export function isUnsavedCogsPlaceholder(line) {
    if (!line || line.loadedFromSaved) return false;
    const current = String(line.account ?? '');
    return current === PURCHASE_COGS_LABEL || current === LEGACY_PURCHASE_COGS_LABEL || current === '';
}

/** Purchase account picker choices without the corporate-cost row. */
export function purchaseAccountChoices(options) {
    return (Array.isArray(options) ? options : []).filter((o) => !isCorporateCostOption(o));
}

/** `"5100 - Cost of Corporate Services"` → is it the corporate row of this COA? */
export function isCorporateCostAccountLabel(label, coa) {
    const code = String(label ?? '').split(' - ')[0]?.trim();
    if (code !== CORP_COST_CODE) return false;
    const row = (Array.isArray(coa) ? coa : []).find((r) => String(r.code) === CORP_COST_CODE);
    if (row) return isCorporateCostOption(row);
    const name = String(label ?? '').split(' - ').slice(1).join(' - ').trim();
    return name === CORP_COST_NAME;
}

/** Lines (saved or edited) that still sit on the corporate-cost account. */
export function linesOnCorporateCost(lines, coa) {
    return (Array.isArray(lines) ? lines : []).filter((l) => isCorporateCostAccountLabel(l?.account, coa));
}
