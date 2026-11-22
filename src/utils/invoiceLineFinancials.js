/**
 * Shared line + invoice rollup math (supplier sales invoice is the reference implementation).
 */

export const DEFAULT_INVOICE_TAXES = [
    { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
    { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
    { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0 },
    { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0 },
];

export function roundMoney2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

export function vatRateForTaxCode(taxCode, taxes = DEFAULT_INVOICE_TAXES, fallback = 0.15, noVat = false) {
    if (noVat) return 0;
    if (taxCode == null || taxCode === '') return fallback;
    const found = taxes.find((t) => t.code === taxCode);
    return found ? found.rate : fallback;
}

/**
 * A blank line (no product and no typed name) is entered as one amount
 * when Qty is empty, or when the Qty column is hidden.
 */
export function parseInvoiceNumber(value) {
    const n = parseFloat(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
}

/** Up to 6 decimals, trailing zeros removed, so 750 / 3 stays 250 and 100 / 3 stays 33.333333. */
export function formatSolvedAmount(n) {
    if (!Number.isFinite(n)) return '';
    const rounded = Math.round((n + Number.EPSILON) * 1e6) / 1e6;
    return String(rounded);
}

/** The user typed a line total, so VAT follows that amount rather than Qty × Unit Price. */
export function lineHasTypedTotal(line) {
    if (line?.amountSource !== 'total') return false;
    return Number.isFinite(parseInvoiceNumber(line.enteredTotal));
}

/**
 * After a total is typed, the next Qty or Unit Price edit fills the other field.
 * Editing the total again keeps it and recalculates the field that was filled last.
 * A zero or blank divisor is left as typed.
 */
export function applyPurchaseLineEdit(line, field, value) {
    const next = { ...line, [field]: value };
    if (field !== 'qty' && field !== 'price' && field !== 'enteredTotal') return next;

    if (field === 'enteredTotal') {
        const text = String(value ?? '');
        if (text.trim() === '') {
            return { ...next, amountSource: '', enteredTotal: '', totalSolveFor: '' };
        }
        next.amountSource = 'total';
        next.enteredTotal = text;
        const total = parseInvoiceNumber(text);
        if (!(total > 0)) return next;
        if (!next.totalSolveFor) {
            const price = parseInvoiceNumber(next.price);
            const qty = parseInvoiceNumber(next.qty);
            const qtyBlank = String(next.qty ?? '').trim() === '';
            const priceBlank = String(next.price ?? '').trim() === '';
            if (price > 0 && qtyBlank) next.totalSolveFor = 'qty';
            else if (qty > 0 && priceBlank) next.totalSolveFor = 'price';
        }
        if (next.totalSolveFor === 'qty') {
            const price = parseInvoiceNumber(next.price);
            if (price > 0) next.qty = formatSolvedAmount(total / price);
        } else if (next.totalSolveFor === 'price') {
            const qty = parseInvoiceNumber(next.qty);
            if (qty > 0) next.price = formatSolvedAmount(total / qty);
        }
        return next;
    }

    if (next.amountSource !== 'total') return next;
    const total = parseInvoiceNumber(next.enteredTotal);
    const typed = parseInvoiceNumber(value);
    if (!(total > 0) || !(typed > 0)) return next;
    if (field === 'price') {
        next.totalSolveFor = 'qty';
        next.qty = formatSolvedAmount(total / typed);
    } else {
        next.totalSolveFor = 'price';
        next.price = formatSolvedAmount(total / typed);
    }
    return next;
}

export function lineUsesEnteredTotal(line, { hideQty = false, searchText = '' } = {}) {
    const hasProduct = String(line?.productId ?? '').trim() !== '';
    const name = String(searchText || line?.item || '').trim();
    if (hasProduct || name) return false;
    if (hideQty) return true;
    return String(line?.qty ?? '').trim() === '';
}

/**
 * Derive ex-VAT line amount, VAT, and VAT-inclusive grand total from user inputs.
 * @param {object} line
 * @param {boolean} amountsTaxInclusive — unit price (or the typed total) is VAT-inclusive when true
 * @param {{ taxes?: typeof DEFAULT_INVOICE_TAXES, defaultRate?: number, noVat?: boolean }} [options]
 */

export function computeLineFinancials(line, amountsTaxInclusive, options = {}) {
    if (line?.directTotal) {
        const entered = parseFloat(String(line.enteredTotal ?? '').replace(',', '.'));
        return computeLineFinancials(
            {
                ...line,
                directTotal: false,
                qty: 1,
                price: Number.isFinite(entered) ? entered : 0,
            },
            amountsTaxInclusive,
            options,
        );
    }
    const taxes = options.taxes ?? DEFAULT_INVOICE_TAXES;
    const defaultRate = options.defaultRate ?? 0.15;
    const noVat = options.noVat === true;

    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    const unitInput = parseFloat(String(line.price).replace(',', '.')) || 0;
    const discRaw = parseFloat(String(line.discount ?? 0).replace(',', '.')) || 0;
    const discMode = line.discountMode === 'fixed_sar' ? 'fixed_sar' : 'percent';
    const rate = noVat
        ? 0
        : vatRateForTaxCode(line.taxCode, taxes, defaultRate, false);

    let lineEx = 0;
    let taxAmt = 0;
    let grandIncl = 0;

    if (amountsTaxInclusive) {
        const grossInclBeforeDisc = roundMoney2(qty * unitInput);
        let netIncl = grossInclBeforeDisc;
        if (discRaw > 0) {
            if (discMode === 'percent') {
                const pct = Math.min(100, Math.max(0, discRaw));
                netIncl = roundMoney2(grossInclBeforeDisc * (1 - pct / 100));
            } else {
                netIncl = roundMoney2(Math.max(0, grossInclBeforeDisc - discRaw));
            }
        }
        lineEx =
            netIncl > 0 && rate > 0 ? roundMoney2(netIncl / (1 + rate)) : roundMoney2(netIncl);
        grandIncl = netIncl;
        taxAmt = roundMoney2(Math.max(0, grandIncl - lineEx));
    } else {
        const grossExBeforeDisc = roundMoney2(qty * unitInput);
        let lineExAdj = grossExBeforeDisc;
        if (discRaw > 0) {
            if (discMode === 'percent') {
                const pct = Math.min(100, Math.max(0, discRaw));
                lineExAdj = roundMoney2(grossExBeforeDisc * (1 - pct / 100));
            } else {
                lineExAdj = roundMoney2(Math.max(0, grossExBeforeDisc - discRaw));
            }
        }
        lineEx = lineExAdj;
        taxAmt = roundMoney2(lineEx * rate);
        grandIncl = roundMoney2(lineEx + taxAmt);
    }

    const grossExBeforeDisc = amountsTaxInclusive
        ? rate > 0
            ? roundMoney2((qty * unitInput) / (1 + rate))
            : roundMoney2(qty * unitInput)
        : roundMoney2(qty * unitInput);
    const discountAmount = roundMoney2(Math.max(0, grossExBeforeDisc - lineEx));

    return {
        lineEx,
        taxAmt,
        grandIncl,
        discountAmount,
        vatRate: rate,
        taxAmtStr: taxAmt.toFixed(2),
        grandInclStr: grandIncl.toFixed(2),
        lineExStr: lineEx.toFixed(2),
    };
}

export function applyLineTotals(line, amountsTaxInclusive, options = {}) {
    const f = computeLineFinancials(line, amountsTaxInclusive, options);
    return {
        ...line,
        taxAmt: f.taxAmtStr,
        totalFinal: f.grandInclStr,
    };
}

/** Stored net unit (ex VAT, after line discount) → rebuild list price for the form. */
export function reconstructInvoiceUnitPriceInput(it, amountsTaxInclusive, taxCode, options = {}) {
    const taxes = options.taxes ?? DEFAULT_INVOICE_TAXES;
    const defaultRate = options.defaultRate ?? 0.15;
    const rate = vatRateForTaxCode(taxCode, taxes, defaultRate, options.noVat === true);
    const qty = Math.max(0.000001, parseFloat(String(it.qty ?? 1).replace(',', '.')) || 1);
    const U_net = Number(it.unitPrice ?? it.unit_price_ex_vat ?? it.unitPriceExVat ?? 0);
    const discRaw = Number(it.lineDiscountValue ?? it.line_discount_raw ?? it.discount ?? 0);
    const discMode =
        it.lineDiscountMode === 'fixed_sar' || it.line_discount_mode === 'fixed_sar' || it.discountMode === 'fixed_sar'
            ? 'fixed_sar'
            : 'percent';

    if (!(discRaw > 0)) {
        if (!amountsTaxInclusive) {
            return String(roundMoney2(U_net));
        }
        return String(roundMoney2(U_net * (1 + rate)));
    }

    if (!amountsTaxInclusive) {
        if (discMode === 'percent') {
            const pct = Math.min(100, Math.max(0, discRaw));
            const denom = 1 - pct / 100;
            if (denom <= 0 || denom >= 1) {
                return String(roundMoney2(U_net));
            }
            const U_list_ex = roundMoney2(U_net / denom);
            return String(U_list_ex);
        }
        const fixed = discRaw;
        const grossLineEx = roundMoney2(U_net * qty + fixed);
        return String(roundMoney2(grossLineEx / qty));
    }

    const netIncl = roundMoney2(U_net * qty * (1 + rate));
    if (discMode === 'percent') {
        const pct = Math.min(100, Math.max(0, discRaw));
        const denom = 1 - pct / 100;
        const grossInclBeforeDisc = denom <= 0 ? netIncl : roundMoney2(netIncl / denom);
        return String(roundMoney2(grossInclBeforeDisc / qty));
    }
    const fixed = discRaw;
    const grossInclBeforeDisc = roundMoney2(netIncl + fixed);
    return String(roundMoney2(grossInclBeforeDisc / qty));
}

/**
 * Invoice footer totals.
 * Order: line taxable (ex VAT) → invoice discount → VAT on post-discount taxable → + freight → grand.
 */
export function computeInvoiceRollupTotals({
    lineItems,
    amountsTaxInclusive,
    applyLineDiscount = true,
    invoiceDiscountMode = 'fixed_sar',
    invoiceDiscountValue = 0,
    freightIn = 0,
    taxes = DEFAULT_INVOICE_TAXES,
    defaultVatRate = 0.15,
    noVat = false,
}) {
    const lineOpts = { taxes, defaultRate: defaultVatRate, noVat };
    let subtotalEx = 0;
    let linesVatBeforeInvDisc = 0;
    let linesGrandSum = 0;
    let lineDiscountSum = 0;
    let lineGrossEx = 0;

    for (const line of lineItems) {
        const workingLine = applyLineDiscount ? line : { ...line, discount: 0 };
        const f = computeLineFinancials(workingLine, amountsTaxInclusive, lineOpts);
        subtotalEx += f.lineEx;
        linesVatBeforeInvDisc += f.taxAmt;
        linesGrandSum += f.grandIncl;
        lineDiscountSum += f.discountAmount;
        const rate = lineOpts.noVat ? 0 : vatRateForTaxCode(workingLine.taxCode, taxes, defaultVatRate, false);
        let grossEx;
        if (workingLine.directTotal) {
            const entered = parseFloat(String(workingLine.enteredTotal ?? '').replace(',', '.')) || 0;
            grossEx = amountsTaxInclusive
                ? rate > 0
                    ? roundMoney2(entered / (1 + rate))
                    : roundMoney2(entered)
                : roundMoney2(entered);
        } else {
            const qty = parseFloat(String(workingLine.qty).replace(',', '.')) || 0;
            const unitInput = parseFloat(String(workingLine.price).replace(',', '.')) || 0;
            grossEx = amountsTaxInclusive
                ? rate > 0
                    ? roundMoney2((qty * unitInput) / (1 + rate))
                    : roundMoney2(qty * unitInput)
                : roundMoney2(qty * unitInput);
        }
        lineGrossEx += grossEx;
    }

    subtotalEx = roundMoney2(subtotalEx);
    linesVatBeforeInvDisc = roundMoney2(linesVatBeforeInvDisc);
    linesGrandSum = roundMoney2(linesGrandSum);
    lineDiscountSum = roundMoney2(lineDiscountSum);
    lineGrossEx = roundMoney2(lineGrossEx);

    const freight = roundMoney2(freightIn);

    const invRaw = parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0;
    let invoiceDiscountApplied = 0;
    if (invoiceDiscountMode === 'percent') {
        invoiceDiscountApplied = roundMoney2(
            (subtotalEx * Math.min(100, Math.max(0, invRaw))) / 100,
        );
    } else {
        invoiceDiscountApplied = roundMoney2(Math.min(Math.max(0, invRaw), subtotalEx));
    }

    const taxableAfterInvoiceDiscount = roundMoney2(
        Math.max(0, subtotalEx - invoiceDiscountApplied),
    );

    // Scale line VAT to the post–invoice-discount taxable base (handles mixed rates).
    const totalVat =
        noVat || subtotalEx <= 0
            ? 0
            : roundMoney2(
                  linesVatBeforeInvDisc * (taxableAfterInvoiceDiscount / subtotalEx),
              );

    const grandTotal = roundMoney2(
        Math.max(0, taxableAfterInvoiceDiscount + totalVat + freight),
    );

    return {
        line_gross_ex_vat: lineGrossEx,
        line_discount_amount: lineDiscountSum,
        /** Line goods taxable (ex VAT), after line discounts, before invoice discount */
        lines_taxable_ex_vat: subtotalEx,
        /** Line VAT before invoice-level discount (informational) */
        lines_total_vat: linesVatBeforeInvDisc,
        lines_grand_total_incl_vat: linesGrandSum,
        invoice_discount_applied_ex_vat: invoiceDiscountApplied,
        /** Taxable base after invoice discount (ex VAT) — VAT is computed on this */
        taxable_after_invoice_discount: taxableAfterInvoiceDiscount,
        /** Alias kept for AP payloads that store pre–invoice-discount goods subtotal */
        subtotal_ex_vat: subtotalEx,
        total_vat: totalVat,
        freight_in: freight,
        goods_grand_incl_vat: roundMoney2(taxableAfterInvoiceDiscount + totalVat),
        grand_total: grandTotal,
    };
}
