/**
 * Workshop purchase invoice — POST body shape for persisting a full draft/saved invoice.
 * Adjust field names to match your backend; structure mirrors the Purchase Invoice UI.
 */

export const PURCHASE_INVOICE_VAT_RATE = 0.15;
export const PURCHASE_INVOICE_TAX_LABEL = 'VAT 15%';

/**
 * Mirrors the supplier sales invoice tax catalog so workshop purchase invoices
 * can compute identical numbers when a different code is picked per line.
 */
export const PURCHASE_INVOICE_TAXES = [
    { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
    { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
    { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0 },
    { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0 },
];

export function money2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

/** Look up the VAT rate for a code, falling back to the default 15%. */
export function vatRateForCode(code, fallback = PURCHASE_INVOICE_VAT_RATE) {
    if (code == null || code === '') return fallback;
    const found = PURCHASE_INVOICE_TAXES.find((t) => t.code === code);
    return found ? found.rate : fallback;
}

/**
 * Line math: ex-VAT unit in `line.price`, unless `opts.unitPriceTaxInclusive` — then `line.price` is VAT-inclusive per unit (÷ (1+vat) for ex-VAT math).
 *
 * `discountMode` selection precedence (matches Supplier SI behaviour):
 *   1. `line.discountMode` if set ('percent' | 'fixed_sar')
 *   2. global `discountIsPercent` argument
 *
 * Tax rate precedence:
 *   1. `opts.noVat` is true → 0 (entire invoice is VAT-exempt; line tax code ignored)
 *   2. `line.taxCode` lookup in PURCHASE_INVOICE_TAXES
 *   3. caller-provided `vatRate`
 */
export function computeLineAmounts(
    line,
    applyDiscount,
    discountIsPercent,
    vatRate = PURCHASE_INVOICE_VAT_RATE,
    opts = {},
) {
    const qty = parseFloat(line.qty) || 0;
    const rawUnit = parseFloat(line.price) || 0;
    const noVat = opts.noVat === true;
    const baseLineRate = line && line.taxCode ? vatRateForCode(line.taxCode, vatRate) : vatRate;
    const lineRate = noVat ? 0 : baseLineRate;
    /**
     * `unitPriceTaxInclusive` only divides when VAT is actually being applied.
     * In a VAT-exempt invoice, the entered unit price IS the final amount
     * (no division, no extra tax line).
     */
    const priceExcl =
        opts.unitPriceTaxInclusive === true && !noVat
            ? money2(rawUnit / (1 + lineRate))
            : rawUnit;
    const discRaw = parseFloat(line.discount) || 0;
    const grossExcl = qty * priceExcl;
    const linePercentMode =
        line && line.discountMode
            ? line.discountMode !== 'fixed_sar'
            : discountIsPercent;
    let discountAmount = 0;
    if (applyDiscount && discRaw > 0) {
        if (linePercentMode) {
            discountAmount = (grossExcl * Math.min(100, Math.max(0, discRaw))) / 100;
        } else {
            discountAmount = Math.min(discRaw, grossExcl);
        }
    }
    const taxableExcl = Math.max(0, grossExcl - discountAmount);
    const taxAmt = taxableExcl * lineRate;
    const totalIncl = taxableExcl * (1 + lineRate);
    /** Per-unit amount excluding VAT (before line discount), for API `unit_price_ex_vat`. */
    const unitPriceExVat = money2(priceExcl);
    return {
        grossExcl,
        taxableExcl,
        taxAmt,
        totalIncl,
        discountAmount,
        vatRate: lineRate,
        unitPriceExVat,
    };
}

/**
 * Roll up lines, then apply invoice-level discount on the sum of line taxable (ex VAT) amounts
 * and recalculate VAT.
 *
 * When per-line tax codes are used (mirrors Supplier SI), VAT is recomputed on
 * each line's net taxable share (after the proportional invoice discount split)
 * so totals match the per-line tax rate the user picked.
 */
export function computePurchaseInvoiceTotals({
    lineItems,
    applyLineDiscount,
    lineDiscountIsPercent,
    invoiceDiscountMode,
    invoiceDiscountValue,
    vatRate = PURCHASE_INVOICE_VAT_RATE,
    unitPriceTaxInclusive = false,
    noVat = false,
    freightIn = 0,
}) {
    const lineOpts = { unitPriceTaxInclusive, noVat };
    const freight = money2(freightIn);
    const perLine = [];
    let lineGross = 0;
    let lineDiscountSum = 0;
    let linesTaxable = 0;
    let linesVat = 0;
    let linesGrand = 0;

    for (const line of lineItems) {
        const a = computeLineAmounts(line, applyLineDiscount, lineDiscountIsPercent, vatRate, lineOpts);
        perLine.push(a);
        lineGross += a.grossExcl;
        lineDiscountSum += a.discountAmount;
        linesTaxable += a.taxableExcl;
        linesVat += a.taxAmt;
        linesGrand += a.totalIncl;
    }

    lineGross = money2(lineGross);
    lineDiscountSum = money2(lineDiscountSum);
    linesTaxable = money2(linesTaxable);
    linesVat = money2(linesVat);
    linesGrand = money2(linesGrand);

    const invRaw = parseFloat(String(invoiceDiscountValue ?? '').replace(',', '.')) || 0;
    let invoiceDiscountApplied = 0;
    if (invoiceDiscountMode === 'percent') {
        invoiceDiscountApplied = money2((linesTaxable * Math.min(100, Math.max(0, invRaw))) / 100);
    } else {
        invoiceDiscountApplied = money2(Math.min(invRaw, linesTaxable));
    }

    const discountFactor =
        linesTaxable > 0 ? Math.max(0, 1 - invoiceDiscountApplied / linesTaxable) : 1;
    let totalVat = 0;
    let netTaxable = 0;
    for (const a of perLine) {
        const lineNet = money2(a.taxableExcl * discountFactor);
        netTaxable += lineNet;
        totalVat += lineNet * a.vatRate;
    }
    netTaxable = money2(netTaxable);
    totalVat = money2(totalVat);
    const goodsGrandInclVat = money2(netTaxable + totalVat);
    const grandTotal = money2(goodsGrandInclVat + freight);

    return {
        line_gross_ex_vat: lineGross,
        line_discount_amount: lineDiscountSum,
        lines_taxable_ex_vat: linesTaxable,
        lines_total_vat: linesVat,
        lines_grand_total_incl_vat: linesGrand,
        invoice_discount_applied_ex_vat: invoiceDiscountApplied,
        subtotal_ex_vat: netTaxable,
        total_vat: totalVat,
        freight_in: freight,
        goods_grand_incl_vat: goodsGrandInclVat,
        grand_total: grandTotal,
    };
}

export function buildEnrichedLineItems(
    lineItems,
    applyLineDiscount,
    lineDiscountIsPercent,
    vatRate,
    vatLabel,
    opts = {},
) {
    const lineOpts = {
        unitPriceTaxInclusive: opts.unitPriceTaxInclusive === true,
        noVat: opts.noVat === true,
    };
    return lineItems.map((line, idx) => {
        const a = computeLineAmounts(line, applyLineDiscount, lineDiscountIsPercent, vatRate, lineOpts);
        const { code, name } = parseAccountDisplay(line.account);
        const qty = parseFloat(line.qty) || 0;
        const unitPriceExVat = money2(a.unitPriceExVat ?? 0);
        const unitPurchasePriceInclVat =
            qty > 0 ? money2(a.totalIncl / qty) : money2(unitPriceExVat * (1 + a.vatRate));
        const lineTaxCode = lineOpts.noVat
            ? 'VAT 0%'
            : line && line.taxCode
              ? line.taxCode
              : vatLabel;
        const lineDiscountMode =
            line && line.discountMode === 'fixed_sar' ? 'fixed_sar' : 'percent';
        return {
            line_no: idx + 1,
            client_line_id: line.id,
            branch_catalog_product_id: line.productId ? String(line.productId) : null,
            item_name: line.item ?? '',
            account_display: line.account ?? '',
            account_code: code,
            account_name: name,
            description: line.description ?? '',
            uom: line.uom ?? 'piece',
            qty,
            unit_price_ex_vat: unitPriceExVat,
            unit_purchase_price_incl_vat: unitPurchasePriceInclVat,
            line_discount_raw: line.discount,
            line_discount_amount: money2(a.discountAmount),
            line_discount_mode: lineDiscountMode,
            gross_ex_vat: money2(a.grossExcl),
            taxable_ex_vat: money2(a.taxableExcl),
            tax_code: lineTaxCode,
            tax_rate: a.vatRate,
            tax_amount: money2(a.taxAmt),
            line_total_incl_vat: money2(a.totalIncl),
        };
    });
}

/** Split "1410 - Inventory Asset" → { code, name } */
export function parseAccountDisplay(accountDisplay) {
    const s = String(accountDisplay || '').trim();
    if (!s) return { code: '', name: '' };
    const i = s.indexOf(' - ');
    if (i === -1) return { code: s, name: '' };
    return { code: s.slice(0, i).trim(), name: s.slice(i + 3).trim() };
}

/**
 * @param {object} p
 * @param {string|null} p.branch_id
 * @param {string|null} p.selected_branch_filter - sidebar value (may be "all")
 * @param {string} p.issue_date - YYYY-MM-DD
 * @param {'Net'|'Custom'|'EOM'} p.due_date_type
 * @param {number|string} p.due_net_days
 * @param {string} p.due_date_custom - YYYY-MM-DD when type Custom
 * @param {string} p.due_date_computed - YYYY-MM-DD shown under Due
 * @param {string} p.vendor_invoice_ref
 * @param {{ id: string|null, name: string }} p.supplier
 * @param {string} p.invoice_description
 * @param {string} p.notes
 * @param {string} p.currency
 * @param {number} p.vat_rate - e.g. 0.15
 * @param {string} p.vat_label - e.g. "VAT 15%"
 * @param {object} p.ui
 * @param {boolean} p.ui.show_line_description_column
 * @param {boolean} p.ui.show_line_discount_column
 * @param {boolean} p.ui.line_discount_is_percent
 * @param {{ mode: 'fixed_sar'|'percent', value: number }} p.invoice_discount
 * @param {boolean} p.update_last_purchase_price_on_save
 * @param {Array<object>} p.lines - enriched line DTOs (see build payload below)
 * @param {object} p.totals - precomputed money2 numbers
 * @param {string} [p.status] - default draft
 */
export function buildPurchaseInvoicePayload(p) {
    const status = p.status ?? 'draft';
    return {
        status,
        currency: p.currency ?? 'SAR',
        branch_id: p.branch_id ?? null,
        selected_branch_filter: p.selected_branch_filter ?? null,

        issue_date: p.issue_date,
        due_date: {
            type: p.due_date_type,
            net_days: p.due_date_type === 'Net' ? Number(p.due_net_days) || 0 : null,
            custom_date: p.due_date_type === 'Custom' ? p.due_date_custom : null,
            computed_due_date: p.due_date_computed,
        },

        vendor_invoice_ref: p.vendor_invoice_ref ?? '',
        supplier: {
            id: p.supplier?.id ?? null,
            name: p.supplier?.name ?? '',
        },
        description: p.invoice_description ?? '',
        notes: p.notes ?? '',

        tax: {
            label: p.vat_label,
            rate: p.vat_rate,
        },

        ui: {
            show_line_description_column: Boolean(p.ui?.show_line_description_column),
            show_line_discount_column: Boolean(p.ui?.show_line_discount_column),
            line_discount_is_percent: Boolean(p.ui?.line_discount_is_percent),
            amounts_tax_inclusive: Boolean(p.ui?.amounts_tax_inclusive),
        },

        invoice_discount: {
            mode: p.invoice_discount?.mode ?? 'fixed_sar',
            value: money2(p.invoice_discount?.value ?? 0),
        },
        update_last_purchase_price_on_save: Boolean(p.update_last_purchase_price_on_save),

        lines: p.lines ?? [],

        totals: {
            /** Sum of line taxable amounts (ex VAT), after line discounts only */
            lines_taxable_ex_vat: money2(p.totals?.lines_taxable_ex_vat ?? 0),
            /** Sum of line VAT amounts (before invoice-level discount) */
            lines_total_vat: money2(p.totals?.lines_total_vat ?? 0),
            /** Sum of line totals incl VAT (before invoice-level discount) */
            lines_grand_total_incl_vat: money2(p.totals?.lines_grand_total_incl_vat ?? 0),

            line_gross_ex_vat: money2(p.totals?.line_gross_ex_vat ?? 0),
            line_discount_amount: money2(p.totals?.line_discount_amount ?? 0),

            invoice_discount_applied_ex_vat: money2(p.totals?.invoice_discount_applied_ex_vat ?? 0),

            /** Amounts your AP / purchase row should store (after invoice discount, single VAT bucket) */
            subtotal_ex_vat: money2(p.totals?.subtotal_ex_vat ?? 0),
            total_vat: money2(p.totals?.total_vat ?? 0),
            grand_total: money2(p.totals?.grand_total ?? 0),
            freight_in: money2(p.totals?.freight_in ?? 0),
        },
    };
}
