import { PI_ACCOUNT_OPTIONS } from '../workshop/constants';
import {
    computeLineAmounts,
    computePurchaseInvoiceTotals,
    money2,
    PURCHASE_INVOICE_TAX_LABEL as TAX_LABEL,
    PURCHASE_INVOICE_VAT_RATE as VAT_RATE,
} from '../workshop/purchaseInvoicePayload';

function roundMoney2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

export function unwrapPurchaseInvoiceFromSupplierGet(res) {
    if (!res || typeof res !== 'object') return {};
    return (
        res.purchaseInvoice ?? res.invoice ?? res.data?.purchaseInvoice ?? res.data ?? {}
    );
}

/** `YYYY-MM-DD` from ISO or date string */
export function isoDateSlice10(raw) {
    if (!raw) return '';
    return String(raw).slice(0, 10);
}

/** Ex-VAT default unit from master-catalog row (`purchasePrice` treated VAT-inclusive when > 0). */
export function pickPriceExclFromMasterCatalogRow(p) {
    if (!p || typeof p !== 'object') return 0;
    const inclusive = Number(p.purchasePrice ?? p.purchase_price);
    if (Number.isFinite(inclusive) && inclusive > 0) {
        return roundMoney2(inclusive / (1 + VAT_RATE));
    }
    const before = Number(p.salePriceBeforeVat ?? p.sale_price_before_vat);
    if (Number.isFinite(before) && before > 0) return roundMoney2(before);
    const saleInc = Number(p.salePrice ?? p.sale_price);
    if (Number.isFinite(saleInc) && saleInc > 0) return roundMoney2(saleInc / (1 + VAT_RATE));
    return 0;
}

/** Map persisted tax codes to WorkshopSupplierPurchaseInvoiceItem values (VAT15 default). */
export function normalizeTaxCodeForApi(raw) {
    const s = String(raw ?? '').trim().toUpperCase().replace(/\s/g, '');
    if (!s) return 'VAT15';
    if (s.includes('VAT15')) return 'VAT15';
    if (s.includes('15')) return 'VAT15';
    if (s === 'VAT') return 'VAT15';
    return s;
}

/** Display tax label in grid (readable). */
export function taxLabelForUi(storedTaxCode) {
    const compact = String(storedTaxCode ?? '').trim().toUpperCase();
    if (!compact || compact === 'VAT15' || compact.includes('15')) return TAX_LABEL;
    return storedTaxCode || TAX_LABEL;
}

export function defaultAccountDisplayFromProduct(productId) {
    return productId ? '1410 - Inventory Asset' : '5100 - Cost of Goods Sold';
}

/** One catalog option row for selects (supplier master catalog GET). */
export function masterCatalogRowToPurchaseOption(row) {
    if (!row) return null;
    const id = String(row.id ?? '').trim();
    if (!id) return null;
    const name =
        row.name ??
        row.label ??
        (`Product ${id.length > 8 ? `${id.slice(0, 8)}…` : id}`);
    const unit =
        row.unit?.trim?.() ? String(row.unit).trim() : row.uom ?? 'piece';
    return {
        id,
        name: String(name || '—'),
        unit: String(unit || 'piece'),
        priceExcl: pickPriceExclFromMasterCatalogRow(row),
    };
}

/** UI line keyed for React (`clientRowKey`); sends `id` preserved from server when rewriting items. */
export function createBlankSupplierWsPiLine(localKeyOverride) {
    const clientRowKey = localKeyOverride ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return {
        clientRowKey,
        persistenceLineId: null,
        productId: '',
        item: '',
        account: '1410 - Inventory Asset',
        description: '',
        uom: 'piece',
        qty: 1,
        price: 0,
        discount: 0,
        taxCode: TAX_LABEL,
    };
}

/** Rebuild UI state from GET /supplier/workshop-purchase-invoices/:id formatted invoice */
export function hydrateSupplierWorkshopPurchaseForm(invRaw) {
    const inv = invRaw && typeof invRaw === 'object' ? invRaw : {};
    const issueDate = isoDateSlice10(inv.issueDate ?? inv.issue_date);
    const dueIsoFull = isoDateSlice10(inv.dueDate ?? inv.due_date);
    const pt = String(inv.paymentTerms ?? inv.payment_terms ?? 'Net');

    let dueDateType = 'Net';
    let customDue = dueIsoFull || issueDate;
    const netDaysRaw = Number(inv.netDays ?? inv.net_days ?? 30);

    const iDt =
        issueDate && /^\d{4}-\d{2}-\d{2}$/.test(issueDate)
            ? new Date(`${issueDate}T12:00:00`)
            : null;
    const dDt =
        dueIsoFull && /^\d{4}-\d{2}-\d{2}$/.test(dueIsoFull)
            ? new Date(`${dueIsoFull}T12:00:00`)
            : null;
    const diffDays =
        iDt && dDt && !Number.isNaN(iDt.getTime()) && !Number.isNaN(dDt.getTime())
            ? Math.round((dDt.getTime() - iDt.getTime()) / 86400000)
            : null;

    if (/eom/i.test(pt)) {
        dueDateType = 'EOM';
    } else if (/custom/i.test(pt)) {
        dueDateType = 'Custom';
        customDue = dueIsoFull || issueDate;
    } else if (
        diffDays !== null &&
        diffDays >= 0 &&
        Number.isFinite(netDaysRaw) &&
        diffDays !== netDaysRaw
    ) {
        /** Due date does not match issue + stored net_days — treat as explicitly set */
        dueDateType = 'Custom';
        customDue = dueIsoFull || issueDate;
    } else {
        dueDateType = 'Net';
    }

    const netDays =
        Number.isFinite(netDaysRaw) && netDaysRaw >= 0 ? netDaysRaw : diffDays != null ? diffDays : 30;

    const items = Array.isArray(inv.items) ? inv.items : [];

    const invoiceDiscountMode = inv.discountType === 'percent' ? 'percent' : 'fixed_sar';
    const invoiceDiscountRaw = Number(inv.discountAmount ?? inv.discount_amount ?? 0);
    const invoiceDiscountValue = Number.isFinite(invoiceDiscountRaw) ? String(invoiceDiscountRaw) : '0';

    /** Line discount heuristic from stored rows */
    const linesWithDisc = items.filter((it) => Number(it.discount ?? 0) > 0);
    const types = [...new Set(linesWithDisc.map((it) => String(it.discountType ?? 'percent')))];
    const discountIsPercent = types.length === 1 ? types[0] === 'percent' : linesWithDisc.length === 0;
    const showDiscount = linesWithDisc.length > 0 || types.length > 0;

    const showDesc = items.some((it) => String(it.description ?? '').trim().length > 0);

    const lineItems = items.map((it, idx) => {
        const productId =
            it.productId != null && String(it.productId).trim() !== ''
                ? String(it.productId).trim()
                : '';
        const qty = Number(it.qty);
        const unitPrice = Number(it.unitPrice ?? it.unit_price ?? 0);
        const discount = Number(it.discount ?? 0);
        const itemName = String(it.itemName ?? it.item_name ?? '').trim();
        const code = String(it.taxCode ?? it.tax_code ?? '');
        /** Account codes are optional on persisted rows — default from product linkage */
        const account = defaultAccountDisplayFromProduct(productId);
        return {
            clientRowKey: `${it.id ?? `new-${idx}`}`,
            persistenceLineId: it.id != null ? String(it.id) : null,
            productId,
            item: itemName,
            account: PI_ACCOUNT_OPTIONS.some((o) => `${o.code} - ${o.name}` === account)
                ? account
                : defaultAccountDisplayFromProduct(productId),
            description: String(it.description ?? ''),
            uom: String(it.uom ?? 'piece').trim() || 'piece',
            qty: Number.isFinite(qty) ? qty : 1,
            price: Number.isFinite(unitPrice) ? unitPrice : 0,
            discount: Number.isFinite(discount) ? discount : 0,
            taxCode: taxLabelForUi(code || TAX_LABEL),
        };
    });

    const persistedPaidAmount = Number(inv.paidAmount ?? inv.paid_amount ?? 0) || 0;

    const branchId = inv.branchId != null ? String(inv.branchId) : '';

    const workshopName = inv.workshop?.name ? String(inv.workshop.name) : '';
    const branchName = inv.branch?.name ? String(inv.branch.name) : '';

    return {
        issueDate,
        dueDateType,
        netDays: Number.isFinite(netDays) && netDays >= 0 ? netDays : 30,
        customDueDate: customDue || issueDate,
        vendorInvoiceRef: String(inv.refNumber ?? inv.vendorInvoiceRef ?? inv.vendor_invoice_ref ?? '').trim(),
        description: String(inv.description ?? ''),
        invoiceNotes: String(inv.notes ?? ''),
        lineItems:
            lineItems.length > 0
                ? lineItems
                : [createBlankSupplierWsPiLine()],
        showDesc,
        showDiscount,
        discountIsPercent,
        invoiceDiscountMode,
        invoiceDiscountValue,
        persistedPaidAmount,
        workshopName,
        branchName,
        branchId,
        invoiceNumber: inv.invoiceNumber ?? inv.invoice_number ?? '',
    };
}

/** Net / Custom / EOM due date computation (mirror workshop purchases). */
export function calculateWorkshopPurchaseDueDateISO(issueDateStr, dueDateType, netDays, customDueDateStr) {
    const issue = new Date(issueDateStr);
    if (Number.isNaN(issue.getTime())) return '';
    let due = new Date(issue);
    if (dueDateType === 'Net') {
        due.setDate(issue.getDate() + parseInt(String(netDays || 0), 10));
    } else if (dueDateType === 'Custom') {
        const c = isoDateSlice10(customDueDateStr || issueDateStr);
        return c;
    } else if (dueDateType === 'EOM') {
        due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
    }
    const y = due.getFullYear();
    const m = String(due.getMonth() + 1).padStart(2, '0');
    const d = String(due.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * PATCH body for /supplier/workshop-purchase-invoices/:id matching UpdateWorkshopSupplierPurchaseInvoiceDto
 * (decimals + camelCase aliases where supported).
 */
export function buildSupplierWorkshopPurchaseInvoicePatchDto({
    lineItems,
    showDiscount,
    discountIsPercent,
    invoiceDiscountMode,
    invoiceDiscountValue,
    issueDate,
    dueDateType,
    netDays,
    customDueDate,
    vendorInvoiceRef,
    description,
    notes,
    persistedPaidAmount,
}) {
    if (!issueDate || !String(issueDate).trim()) throw new Error('Issue date is required');

    const applyLineDiscount = showDiscount;

    const totals = computePurchaseInvoiceTotals({
        lineItems,
        applyLineDiscount,
        lineDiscountIsPercent: discountIsPercent,
        invoiceDiscountMode,
        invoiceDiscountValue,
        vatRate: VAT_RATE,
    });

    const dueComputed = calculateWorkshopPurchaseDueDateISO(
        issueDate,
        dueDateType,
        netDays,
        customDueDate,
    );

    /** paymentTerms aligns with persisted workshop-created invoices */
    const paymentTermsSimple =
        dueDateType === 'Net' ? 'Net' : dueDateType === 'EOM' ? 'EOM' : 'Custom';

    const grand = totals.grand_total;
    const paid = Number.isFinite(persistedPaidAmount) ? money2(persistedPaidAmount) : 0;
    const balance = money2(Math.max(0, grand - paid));

    const itemsPayload = lineItems.map((line, idx) => {
        const a = computeLineAmounts(line, applyLineDiscount, discountIsPercent, VAT_RATE);
        const discRaw = parseFloat(line.discount) || 0;
        const discountActive = applyLineDiscount && discRaw > 0;
        /** @type {'percent'|'fixed'} */
        const discountLineType =
            discountActive && discountIsPercent ? 'percent' : discountActive ? 'fixed' : 'percent';

        const itemNameClean = String(line.item ?? '').trim() || `Item ${idx + 1}`;
        const productTrim = line.productId != null ? String(line.productId).trim() : '';

        const obj = {
            itemName: itemNameClean,
            description: String(line.description ?? '').trim() || undefined,
            uom: String(line.uom ?? 'piece').trim() || 'piece',
            qty: (() => {
                const q = parseFloat(String(line.qty));
                const safe = Number.isFinite(q) && q > 0 ? q : 0;
                if (safe <= 0) throw new Error(`Line ${idx + 1}: quantity must be greater than zero`);
                return money2(safe);
            })(),
            unitPrice: money2(parseFloat(line.price) || 0),
            discount: money2(discRaw),
            discountType: discountLineType,
            lineTotal: money2(a.taxableExcl),
            taxCode: normalizeTaxCodeForApi(line.taxCode),
            taxAmount: money2(a.taxAmt),
            total: money2(a.totalIncl),
        };
        const pid = productTrim || undefined;
        if (pid) obj.productId = pid;
        if (line.persistenceLineId) obj.id = String(line.persistenceLineId);
        return obj;
    });

    if (!itemsPayload.length) throw new Error('At least one line item is required');

    const ref = String(vendorInvoiceRef ?? '').trim();

    return {
        issueDate,
        dueDate: dueComputed,
        paymentTerms: paymentTermsSimple,
        netDays: Math.floor(Number(netDays) || 0),

        vendorInvoiceRef: ref || undefined,
        vendor_invoice_ref: ref || undefined,
        refNumber: ref || undefined,
        description: String(description ?? '').trim() || undefined,
        notes: String(notes ?? '').trim() || undefined,

        subtotal: totals.subtotal_ex_vat,
        discountAmount: totals.invoice_discount_applied_ex_vat,
        discountType: invoiceDiscountMode === 'percent' ? 'percent' : 'fixed',
        taxAmount: totals.total_vat,
        grandTotal: totals.grand_total,
        paidAmount: paid,
        balance,

        items: itemsPayload,
    };
}
