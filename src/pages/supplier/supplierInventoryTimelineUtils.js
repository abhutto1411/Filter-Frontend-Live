/**
 * Map supplier_transaction_history rows (from /supplier/inventory/stock-balances) to workshop-style timeline entries.
 */

export function humanizeSupplierTimelineSource(source) {
    const s = String(source || 'manual').toLowerCase();
    if (s === 'supplier_purchase_invoice') return 'Supplier purchase (approved)';
    if (s === 'pos') return 'POS';
    if (s === 'sales_invoice') return 'Sales invoice';
    if (s === 'purchase_order') return 'Purchase order';
    if (s === 'replenishment') return 'Replenishment';
    return s.replace(/_/g, ' ');
}

export function humanizeSupplierTimelineRefType(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'workshop_supplier_purchase_invoice') return 'Workshop purchase invoice';
    if (t === 'supplier_invoice') return 'Invoice';
    if (t === 'purchase_order') return 'Purchase order';
    return t.replace(/_/g, ' ');
}

/**
 * @param {object} h – single row from API `transactionHistory`
 * @returns {object|null}
 */
export function normalizeSupplierTimelineEntry(h) {
    if (!h || !h.createdAt) return null;
    const id = String(h.id ?? `${h.createdAt}-${h.transactionType}`);
    const at = String(h.createdAt);
    const meta =
        h.metadata && typeof h.metadata === 'object' && !Array.isArray(h.metadata) ? h.metadata : {};
    const type = String(h.transactionType || '').toLowerCase();

    let previousQty = null;
    let newQty = null;
    let delta = null;
    /** @type {'manual'|'supplier_purchase_invoice'|'sales_invoice'|'replenishment'|'purchase_order'|'other'} */
    let source = 'manual';
    /** @type {{ type?: string; id?: string } | null} */
    let reference = null;

    if (type === 'stock_adjusted') {
        if (meta.previousQuantity != null && meta.newQuantity != null) {
            previousQty = Number(meta.previousQuantity);
            newQty = Number(meta.newQuantity);
            if (Number.isFinite(previousQty) && Number.isFinite(newQty)) {
                delta = newQty - previousQty;
            }
        }
        source = 'manual';
    } else if (type === 'workshop_supplier_purchase_invoice_approved') {
        source = 'supplier_purchase_invoice';
        const invNo = meta.invoiceNumber != null ? String(meta.invoiceNumber) : '';
        reference = {
            type: 'workshop_supplier_purchase_invoice',
            id: h.referenceId != null ? String(h.referenceId) : '',
            invoiceNumber: invNo,
        };
        delta = null;
    } else if (type === 'invoice_created') {
        source = 'sales_invoice';
        reference = {
            type: 'supplier_invoice',
            id: h.supplierInvoiceId != null ? String(h.supplierInvoiceId) : h.referenceId != null ? String(h.referenceId) : '',
        };
        if (meta.previousQuantity != null && meta.newQuantity != null) {
            previousQty = Number(meta.previousQuantity);
            newQty = Number(meta.newQuantity);
            if (Number.isFinite(previousQty) && Number.isFinite(newQty)) delta = newQty - previousQty;
        }
    } else if (type === 'replenishment_order_created' || h.quantity != null) {
        source = 'replenishment';
        const q = h.quantity != null ? Number(h.quantity) : null;
        if (Number.isFinite(q)) delta = q;
        reference = {
            type: 'supplier_replenishment_order',
            id: h.supplierReplenishmentOrderId != null ? String(h.supplierReplenishmentOrderId) : '',
        };
    } else if (type.includes('purchase_order')) {
        source = 'purchase_order';
        reference = {
            type: 'purchase_order',
            id: h.purchaseOrderId != null ? String(h.purchaseOrderId) : '',
        };
    } else {
        source = 'other';
        if (h.referenceType && h.referenceId != null) {
            reference = { type: String(h.referenceType), id: String(h.referenceId) };
        }
    }

    let reason = 'Other';
    if (type === 'stock_adjusted') {
        const metaReason =
            typeof meta.reason === 'string'
                ? meta.reason.trim()
                : typeof meta.notes === 'string'
                  ? meta.notes.trim()
                  : '';
        reason = metaReason ? metaReason.slice(0, 500) : 'Other';
    } else if (type === 'invoice_created') reason = 'POS Invoice Sale';
    else if (type === 'workshop_supplier_purchase_invoice_approved') reason = 'Supplier purchase (approved)';
    else if (type === 'replenishment_order_created') reason = 'Replenishment order';
    else if (type === 'purchase_order_delivered') reason = 'Purchase order delivered';
    else if (type === 'purchase_order_accepted') reason = 'Purchase order accepted';
    else if (type === 'payment_received') reason = 'Payment received';
    else if (h.title) reason = String(h.title).slice(0, 120);

    const adjustedBy =
        h.createdByUserName != null && String(h.createdByUserName).trim() !== ''
            ? { name: String(h.createdByUserName).trim() }
            : null;

    return {
        id,
        at,
        productLabel: h.productName || '—',
        previousQty,
        newQty,
        delta,
        reason,
        source,
        reference,
        invoiceNo: h.invoiceNo ?? null,
        adjustedBy,
    };
}

/** Single-line label for Source / Ref column (matches workshop inventory timeline tone). */
export function formatSupplierTimelineSourceRef(e) {
    if (!e) return '—';
    const base = humanizeSupplierTimelineSource(e.source);
    if (e.source === 'sales_invoice' && e.invoiceNo) {
        return `pos invoice - invoice #${e.invoiceNo}`;
    }
    if (
        e.reference?.type === 'workshop_supplier_purchase_invoice' &&
        (e.reference.invoiceNumber || e.reference.id)
    ) {
        const num = e.reference.invoiceNumber || e.reference.id;
        return `Supplier purchase (approved) - Workshop purchase invoice #${num}`;
    }
    if (e.reference?.id) {
        const t = humanizeSupplierTimelineRefType(e.reference.type);
        return `${base} · ${t} #${e.reference.id}`;
    }
    return base;
}

export function mapSupplierHistoryToTimelineEntries(list) {
    if (!Array.isArray(list)) return [];
    const rows = list.map(normalizeSupplierTimelineEntry).filter(Boolean);
    return rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
