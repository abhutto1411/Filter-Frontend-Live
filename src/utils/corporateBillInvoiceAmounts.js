/** Frozen POS / bill Inclusive VAT is the collection amount. Never rewrite it as excl × 1.15. */

export function money2(n) {
    return Number(Number(n ?? 0).toFixed(2));
}

export function splitInclusiveVatAmount(inclRaw) {
    const incl = money2(inclRaw);
    if (Math.abs(incl) < 0.005) return { excl: 0, vat: 0, incl: 0 };
    const sign = incl < 0 ? -1 : 1;
    const abs = Math.abs(incl);
    const excl = money2(abs / 1.15);
    const vat = money2(abs - excl);
    return { excl: excl * sign, vat: vat * sign, incl };
}

/**
 * Display Excl / VAT / Incl for corporate bills.
 * Inclusive VAT stays the stored cashier / bill amount.
 * Discounts are informational and must not change Incl (16 × 15% = 2.40 was the old bug).
 */
export function storedInvoiceDisplayAmounts(line) {
    const incl = money2(line?.invoiceInclusiveVat ?? line?.invoiceAmount ?? 0);
    const excl = money2(line?.invoiceExclVat ?? 0);
    const vat = money2(line?.vat15 ?? 0);

    if (Math.abs(incl) > 0.005 && Math.abs(excl) < 0.005 && Math.abs(vat) < 0.005) {
        return splitInclusiveVatAmount(incl);
    }
    if (Math.abs(excl + vat - incl) > 0.02) {
        return splitInclusiveVatAmount(incl);
    }
    return { excl, vat, incl };
}

export function collectionAmountDue({ opening = 0, invoices = 0, receipts = 0, returns = 0 } = {}) {
    return money2(Number(opening) + Number(invoices) - Number(receipts) - Number(returns));
}

export function sumStoredInvoiceInclusive(lines) {
    return money2(
        (lines ?? [])
            .filter((l) => l?.type === 'Invoice')
            .reduce((s, l) => s + storedInvoiceDisplayAmounts(l).incl, 0),
    );
}

/**
 * Place 1 (KPI) and Place 2 (monthly PDF table) must share these numbers.
 * `frozenInvoiceIncl` is the ledger/KPI invoice total when present.
 */
export function monthlyCollectionPlaces({
    invoiceLines = [],
    opening = 0,
    receipts = 0,
    returns = 0,
    frozenInvoiceIncl,
} = {}) {
    const invoices = money2(
        frozenInvoiceIncl ?? sumStoredInvoiceInclusive(invoiceLines),
    );
    const amountDue = collectionAmountDue({ opening, invoices, receipts, returns });
    return {
        totalInvoices: invoices,
        amountDue,
        tableTotal: amountDue,
    };
}
