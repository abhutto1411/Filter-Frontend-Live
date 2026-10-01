/** Saudi VAT default for storage facility invoices / movements */
export const STORAGE_VAT_RATE = 0.15;

export function roundMoney2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * @param {Array<{ qty: number|string, unitAmount: number|string }>} lines
 * @param {boolean} amountsTaxInclusive — unitAmount is VAT-inclusive when true
 */
export function computeStorageTotals(lines, amountsTaxInclusive, vatRate = STORAGE_VAT_RATE) {
    let subtotalEx = 0;
    let grandIncl = 0;

    for (const ln of lines) {
        const qty = Number(ln.qty);
        const unit = Number(ln.unitAmount);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unit) || unit < 0) continue;

        if (amountsTaxInclusive) {
            const lineIncl = qty * unit;
            const lineEx = vatRate > 0 ? lineIncl / (1 + vatRate) : lineIncl;
            subtotalEx += lineEx;
            grandIncl += lineIncl;
        } else {
            const lineEx = qty * unit;
            subtotalEx += lineEx;
            grandIncl += lineEx * (1 + vatRate);
        }
    }

    const vatAmount = grandIncl - subtotalEx;
    return {
        subtotal: roundMoney2(subtotalEx),
        vatAmount: roundMoney2(vatAmount),
        grandTotal: roundMoney2(grandIncl),
    };
}

/** Convert entered unit to exclusive for API (backend adds VAT on exclusive). */
export function unitAmountForApi(unitAmount, amountsTaxInclusive, vatRate = STORAGE_VAT_RATE) {
    const u = Number(unitAmount);
    if (!Number.isFinite(u)) return undefined;
    if (amountsTaxInclusive && vatRate > 0) {
        return roundMoney2(u / (1 + vatRate));
    }
    return roundMoney2(u);
}
