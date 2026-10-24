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
    // Older POS invoices with fixed line discounts kept VAT on the pre-discount base
    // (Excl 69.91 + VAT 11.09 = 81.00). VAT must be 15 % of the discounted Excl.
    if (Math.abs(vat) > 0.005 && Math.abs(vat - excl * 0.15) > 0.011) {
        return splitInclusiveVatAmount(incl);
    }
    return { excl, vat, incl };
}

/**
 * Tax-invoice presentation of one bill line, same order as the cashier invoice:
 * Total Excl VAT → Less discounts → Taxable amount → VAT 15 % → Total incl VAT.
 * `excl` is the stored post-discount (taxable) amount; discounts are pre-VAT.
 */
export function billBreakdownFromAmounts({ excl = 0, discount = 0, vat = 0, incl = 0 } = {}) {
    const taxable = money2(excl);
    const disc = money2(Math.max(0, Number(discount) || 0));
    return {
        grossExcl: money2(taxable + disc),
        discount: disc,
        taxable,
        vat: money2(vat),
        total: money2(incl),
    };
}

export function invoiceBillBreakdown(line) {
    const a = storedInvoiceDisplayAmounts(line);
    return billBreakdownFromAmounts({
        excl: a.excl,
        discount: line?.salesDiscounts ?? 0,
        vat: a.vat,
        incl: a.incl,
    });
}

/** Column totals = sum of the per-invoice figures (never a re-split of the grand total). */
export function sumBillBreakdowns(breakdowns) {
    const t = { grossExcl: 0, discount: 0, taxable: 0, vat: 0, total: 0 };
    for (const b of breakdowns ?? []) {
        t.grossExcl += Number(b?.grossExcl ?? 0);
        t.discount += Number(b?.discount ?? 0);
        t.taxable += Number(b?.taxable ?? 0);
        t.vat += Number(b?.vat ?? 0);
        t.total += Number(b?.total ?? 0);
    }
    return {
        grossExcl: money2(t.grossExcl),
        discount: money2(t.discount),
        taxable: money2(t.taxable),
        vat: money2(t.vat),
        total: money2(t.total),
    };
}

export function collectionAmountDue({ opening = 0, invoices = 0, receipts = 0, returns = 0 } = {}) {
    return money2(Number(opening) + Number(invoices) - Number(receipts) - Number(returns));
}

const nonZero = (n) => Math.abs(Number(n) || 0) > 0.005;

/**
 * Bill totals in tax-invoice order:
 * Total Excl VAT → Less discounts → Taxable → VAT → Total Amount Due.
 * Opening / returns / receipts appear only when they change the amount due.
 */
export function buildBillAmountSummaryLines({ invoiceTotals, opening = 0, returns = 0, receipts = 0 } = {}) {
    const t = invoiceTotals ?? {};
    const invoicesIncl = money2(t.total);
    const amountDue = collectionAmountDue({ opening, invoices: invoicesIncl, receipts, returns });
    const lines = [
        { key: 'grossExcl', en: 'Total (Excluding VAT)', ar: 'الإجمالي (غير شامل ضريبة القيمة المضافة)', amount: money2(t.grossExcl) },
        { key: 'discount', en: 'Less: Discounts (all types)', ar: 'يخصم: الخصومات (جميع الأنواع)', amount: money2(t.discount), negative: true },
        { key: 'taxable', en: 'Total Taxable Amount (Excluding VAT)', ar: 'إجمالي المبلغ الخاضع للضريبة', amount: money2(t.taxable), subtotal: true },
        { key: 'vat', en: 'Total VAT (15%)', ar: 'مجموع ضريبة القيمة المضافة (15%)', amount: money2(t.vat) },
    ];
    if (nonZero(opening) || nonZero(returns) || nonZero(receipts)) {
        lines.push({ key: 'invoices', en: 'Total Invoices (Including VAT)', ar: 'إجمالي الفواتير (شامل الضريبة)', amount: invoicesIncl, subtotal: true });
        if (nonZero(opening)) {
            lines.push({ key: 'opening', en: 'Add: Opening Balance', ar: 'يضاف: الرصيد الافتتاحي', amount: money2(opening) });
        }
        if (nonZero(returns)) {
            lines.push({ key: 'returns', en: 'Less: Sales Returns', ar: 'يخصم: مرتجعات المبيعات', amount: money2(returns), negative: true });
        }
        if (nonZero(receipts)) {
            lines.push({ key: 'receipts', en: 'Less: Receipts', ar: 'يخصم: المقبوضات', amount: money2(receipts), negative: true });
        }
    }
    lines.push({ key: 'due', en: 'Total Amount Due', ar: 'إجمالي المبلغ المستحق', amount: amountDue, grand: true });
    return { lines, amountDue };
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
