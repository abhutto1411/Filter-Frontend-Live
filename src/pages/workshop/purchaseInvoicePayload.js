/**
 * Workshop purchase invoice — POST body shape for persisting a full draft/saved invoice.
 * Line and rollup math matches supplier sales invoice (see utils/invoiceLineFinancials.js).
 */

import {
    computeLineFinancials,
    computeInvoiceRollupTotals,
    reconstructInvoiceUnitPriceInput,
    roundMoney2 as money2,
    DEFAULT_INVOICE_TAXES,
} from '../../utils/invoiceLineFinancials';

export { reconstructInvoiceUnitPriceInput };

export const PURCHASE_INVOICE_VAT_RATE = 0.15;
export const PURCHASE_INVOICE_TAX_LABEL = 'VAT 15%';

export const PURCHASE_INVOICE_TAXES = DEFAULT_INVOICE_TAXES;

export { money2 };

/** Look up the VAT rate for a code, falling back to the default 15%. */
export function vatRateForCode(code, fallback = PURCHASE_INVOICE_VAT_RATE) {
    if (code == null || code === '') return fallback;
    const found = PURCHASE_INVOICE_TAXES.find((t) => t.code === code);
    return found ? found.rate : fallback;
}

function lineFinancialsOpts(vatRate, opts = {}) {
    return {
        taxes: PURCHASE_INVOICE_TAXES,
        defaultRate: vatRate,
        noVat: opts.noVat === true,
    };
}

/**
 * Adapter around {@link computeLineFinancials} for legacy call sites.
 * `opts.unitPriceTaxInclusive` === supplier `amountsTaxInclusive`.
 */
export function computeLineAmounts(
    line,
    applyDiscount,
    discountIsPercent,
    vatRate = PURCHASE_INVOICE_VAT_RATE,
    opts = {},
) {
    const amountsTaxInclusive = opts.unitPriceTaxInclusive === true;
    let workingLine = applyDiscount ? line : { ...line, discount: 0 };
    if (
        applyDiscount &&
        !line.discountMode &&
        discountIsPercent === false &&
        workingLine.discountMode == null
    ) {
        workingLine = { ...workingLine, discountMode: 'fixed_sar' };
    } else if (applyDiscount && !line.discountMode && discountIsPercent) {
        workingLine = { ...workingLine, discountMode: 'percent' };
    }
    const f = computeLineFinancials(workingLine, amountsTaxInclusive, lineFinancialsOpts(vatRate, opts));
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    const unitPriceExVat = qty > 0 ? money2(f.lineEx / qty) : 0;
    return {
        grossExcl: money2(f.lineEx + f.discountAmount),
        taxableExcl: f.lineEx,
        taxAmt: f.taxAmt,
        totalIncl: f.grandIncl,
        discountAmount: f.discountAmount,
        vatRate: f.vatRate,
        unitPriceExVat,
    };
}

/** Roll up lines + freight + invoice discount (same rules as supplier sales invoice). */
export function computePurchaseInvoiceTotals({
    lineItems,
    applyLineDiscount,
    lineDiscountIsPercent: _lineDiscountIsPercent,
    invoiceDiscountMode,
    invoiceDiscountValue,
    vatRate = PURCHASE_INVOICE_VAT_RATE,
    unitPriceTaxInclusive = false,
    noVat = false,
    freightIn = 0,
}) {
    return computeInvoiceRollupTotals({
        lineItems,
        amountsTaxInclusive: unitPriceTaxInclusive,
        applyLineDiscount,
        invoiceDiscountMode,
        invoiceDiscountValue,
        freightIn,
        taxes: PURCHASE_INVOICE_TAXES,
        defaultVatRate: vatRate,
        noVat,
    });
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
            uom_profile_id: line.uomProfileId ?? null,
            uomProfileId: line.uomProfileId ?? null,
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
            amountsTaxInclusive: Boolean(p.ui?.amounts_tax_inclusive),
            prices_include_vat: Boolean(p.ui?.prices_include_vat ?? p.ui?.amounts_tax_inclusive),
            no_vat: Boolean(p.ui?.no_vat),
            showLineDescriptionColumn: Boolean(p.ui?.show_line_description_column),
            showLineDiscountColumn: Boolean(p.ui?.show_line_discount_column),
            lineDiscountIsPercent: Boolean(p.ui?.line_discount_is_percent),
        },

        freight_in: money2(p.freight_in ?? p.totals?.freight_in ?? 0),
        freightIn: money2(p.freight_in ?? p.totals?.freight_in ?? 0),

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

/** Snapshot raw modal line rows so draft reload restores the full form. */
export function serializePurchaseInvoiceFormLines(lines) {
    return (lines ?? []).map((line) => ({
        client_line_id: line.id,
        productId: line.productId ?? '',
        item: line.item ?? '',
        account: line.account ?? '',
        description: line.description ?? '',
        uom: line.uom ?? 'piece',
        qty: line.qty ?? 1,
        price: line.price ?? 0,
        discount: line.discount ?? 0,
        discountMode: line.discountMode ?? 'percent',
        taxCode: line.taxCode ?? PURCHASE_INVOICE_TAX_LABEL,
        taxAmt: line.taxAmt ?? '0.00',
        totalFinal: line.totalFinal ?? '0.00',
        warehouseUnit: line.warehouseUnit ?? null,
        workshopUnit: line.workshopUnit ?? null,
        conversionFactor: line.conversionFactor ?? null,
        uomProfileId: line.uomProfileId ?? null,
        supplierProductId: line.supplierProductId ?? null,
    }));
}

/**
 * Full purchase-invoice modal state for draft save/restore (checkboxes, searches, all lines).
 */
export function buildPurchaseInvoiceFormSnapshot(state) {
    return {
        version: 1,
        invoice_branch_id: state.invoiceBranchId ?? '',
        selected_vendor: state.selectedVendor ?? '',
        supplier_id: state.supplierId ?? null,
        issue_date: state.issueDate ?? '',
        due_date_type: state.dueDateType ?? 'Net',
        net_days: state.netDays ?? 30,
        custom_due_date: state.customDueDate ?? '',
        vendor_invoice_ref: state.vendorInvoiceRef ?? '',
        invoice_description: state.invoiceDescription ?? '',
        invoice_notes: state.invoiceNotes ?? '',
        invoice_discount_value: state.invoiceDiscountValue ?? '0',
        invoice_discount_mode: state.invoiceDiscountMode ?? 'fixed_sar',
        show_desc: Boolean(state.showDesc),
        show_discount: Boolean(state.showDiscount),
        discount_is_percent: Boolean(state.discountIsPercent),
        amounts_tax_inclusive: Boolean(state.amountsTaxInclusive),
        freight_sar: state.freightSar ?? '0',
        update_last_purchase_price: Boolean(state.updateLastPurchasePrice),
        product_search_by_line_id: state.productSearchByLineId ?? {},
        line_items: serializePurchaseInvoiceFormLines(state.lineItems),
    };
}

/** Build API line DTOs; for drafts include every modal row (even without a picked product). */
export function buildPurchaseInvoiceLinesForSave(
    lineItems,
    {
        applyLineDiscount,
        lineDiscountIsPercent,
        amountsTaxInclusive,
        forDraft = false,
        productSearchByLineId = {},
    },
) {
    const mapped = (lineItems ?? []).map((line) => {
        const itemLabel = String(productSearchByLineId[line.id] ?? line.item ?? '').trim();
        const qtyRaw = parseFloat(String(line.qty ?? '').replace(',', '.'));
        const qty =
            forDraft && (!Number.isFinite(qtyRaw) || qtyRaw <= 0)
                ? 1
                : line.qty ?? 1;
        return {
            ...line,
            item: itemLabel || line.item || '',
            qty,
        };
    });

    let rows = forDraft
        ? mapped
        : mapped.filter((l) => l.productId != null && String(l.productId).trim() !== '');

    if (forDraft && rows.length === 0) {
        rows = [
            {
                id: `draft-${Date.now()}`,
                productId: '',
                item: '',
                account: '1410 - Inventory Asset',
                description: '',
                uom: 'piece',
                qty: 1,
                price: 0,
                discount: 0,
                discountMode: 'percent',
                taxCode: PURCHASE_INVOICE_TAX_LABEL,
            },
        ];
    }

    if (forDraft) {
        rows = rows.map((line) => ({
            ...line,
            item: String(line.item ?? '').trim() || 'Draft line',
        }));
    }

    return buildEnrichedLineItems(
        rows,
        applyLineDiscount,
        lineDiscountIsPercent,
        PURCHASE_INVOICE_VAT_RATE,
        PURCHASE_INVOICE_TAX_LABEL,
        { unitPriceTaxInclusive: amountsTaxInclusive, noVat: false },
    );
}
