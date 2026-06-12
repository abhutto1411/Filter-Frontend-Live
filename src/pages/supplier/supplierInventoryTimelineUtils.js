/**
 * Map supplier_transaction_history rows (from /supplier/inventory/stock-balances) to workshop-style timeline entries.
 * All running balances use **warehouse UOM** (supplier_stock.current_quantity). Workshop equivalents are derived via CF.
 */

export function humanizeSupplierTimelineSource(source) {
    const s = String(source || 'manual').toLowerCase();
    if (s === 'super_supplier_purchase') return 'Purchase invoice (AP)';
    if (s === 'supplier_purchase_invoice') return 'Supplier purchase (approved)';
    if (s === 'pos') return 'POS';
    if (s === 'sales_invoice') return 'Sales invoice';
    if (s === 'purchase_order') return 'Purchase order';
    if (s === 'replenishment') return 'Replenishment';
    if (s === 'purchase') return 'Purchase receipt';
    return s.replace(/_/g, ' ');
}

export function humanizeSupplierTimelineRefType(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'super_supplier_purchase') return 'Purchase invoice';
    if (t === 'workshop_supplier_purchase_invoice') return 'Workshop purchase invoice';
    if (t === 'supplier_invoice') return 'Sales invoice';
    if (t === 'purchase_order') return 'Purchase order';
    return t.replace(/_/g, ' ');
}

/** Transaction types that change warehouse stock (excludes AR-only rows like invoice_created). */
export const SUPPLIER_STOCK_MOVEMENT_TX_TYPES = new Set([
    'stock_adjusted',
    'inventory_out_sales_invoice',
    'inventory_in_sales_return',
    'inventory_in_super_supplier_purchase',
    'workshop_supplier_purchase_invoice_approved',
    'purchase_order_delivered',
]);

export function isSupplierStockMovementHistoryRow(h) {
    if (!h?.createdAt) return false;
    const type = String(h.transactionType || '').toLowerCase();
    const meta =
        h.metadata && typeof h.metadata === 'object' && !Array.isArray(h.metadata)
            ? h.metadata
            : {};
    if (
        type === 'stock_adjusted' &&
        String(meta.reason ?? '') === 'deferred_until_workshop_receive_reconcile'
    ) {
        return false;
    }
    if (!SUPPLIER_STOCK_MOVEMENT_TX_TYPES.has(type)) return false;
    if (type === 'stock_adjusted') {
        if (String(meta.source || '').toLowerCase() === 'super_supplier_purchase') {
            return true;
        }
    }
    if (!h.supplierProductId) return false;
    return true;
}

function isMeaningfulStockMovementEntry(entry) {
    if (!entry) return false;
    const d = entry.delta;
    if (d != null && Number.isFinite(Number(d)) && Math.abs(Number(d)) > 0.0005) {
        return true;
    }
    // Show explicit stock sets (e.g. set to zero) even when rounded delta is ~0
    if (entry.transactionType === 'stock_adjusted') {
        const prev = entry.previousQty;
        const next = entry.newQty;
        if (
            prev != null &&
            next != null &&
            Number.isFinite(Number(prev)) &&
            Number.isFinite(Number(next)) &&
            Math.abs(Number(prev) - Number(next)) > 0.0005
        ) {
            return true;
        }
    }
    return false;
}

function readMetaQty(meta, ...keys) {
    for (const key of keys) {
        if (meta[key] == null) continue;
        const n = Number(meta[key]);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

function readMetaStr(meta, ...keys) {
    for (const key of keys) {
        if (meta[key] == null) continue;
        const s = String(meta[key]).trim();
        if (s) return s;
    }
    return null;
}

function readUomFromMeta(meta) {
    const warehouseUnit = readMetaStr(meta, 'warehouseUnit') || 'Box';
    const workshopUnit = readMetaStr(meta, 'workshopUnit') || 'Liter';
    const cfRaw = readMetaQty(meta, 'conversionFactor');
    const conversionFactor = cfRaw != null && cfRaw > 0 ? cfRaw : 1;
    return { warehouseUnit, workshopUnit, conversionFactor };
}

function invoiceRef(h) {
    const id =
        h.supplierInvoiceId != null
            ? String(h.supplierInvoiceId)
            : h.referenceId != null
              ? String(h.referenceId)
              : '';
    return {
        type: 'supplier_invoice',
        id,
        invoiceNumber: h.invoiceNo != null ? String(h.invoiceNo) : undefined,
    };
}

function superSupplierPurchaseRef(h, meta) {
    const purchaseId =
        meta.purchaseId != null
            ? String(meta.purchaseId)
            : h.referenceId != null
              ? String(h.referenceId)
              : '';
    return {
        type: 'super_supplier_purchase',
        id: purchaseId,
        invoiceNumber:
            meta.invoiceNo != null
                ? String(meta.invoiceNo)
                : purchaseId
                  ? `SSP-${purchaseId}`
                  : undefined,
        superSupplierName: meta.superSupplierName != null ? String(meta.superSupplierName) : null,
        referenceNo: meta.referenceNo != null ? String(meta.referenceNo) : null,
        vendorRef: meta.vendorRef != null ? String(meta.vendorRef) : null,
    };
}

function warehouseDeltaFromMeta(meta, signed = false) {
    const signedQty = readMetaQty(meta, 'signedDeltaQty');
    if (signedQty != null && signedQty !== 0) {
        return signed ? signedQty : Math.abs(signedQty);
    }
    const wh = readMetaQty(meta, 'qtyWarehouseUnits', 'quantity', 'qty');
    if (wh == null || wh === 0) return null;
    return signed ? wh : Math.abs(wh);
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
    const uom = readUomFromMeta(meta);

    let delta = null;
    /** @type {'manual'|'super_supplier_purchase'|'supplier_purchase_invoice'|'sales_invoice'|'replenishment'|'purchase_order'|'purchase'|'other'} */
    let source = 'manual';
    /** @type {{ type?: string; id?: string; invoiceNumber?: string; superSupplierName?: string|null; referenceNo?: string|null; vendorRef?: string|null } | null} */
    let reference = null;
    let reason = h.title ? String(h.title).slice(0, 160) : 'Other';

    if (
        type === 'inventory_in_super_supplier_purchase' ||
        (type === 'stock_adjusted' &&
            String(meta.source || '').toLowerCase() === 'super_supplier_purchase')
    ) {
        source = 'super_supplier_purchase';
        reference = superSupplierPurchaseRef(h, meta);
        const purchasePrev = readMetaQty(meta, 'previousQuantity', 'previousQty');
        const purchaseNext = readMetaQty(meta, 'newQuantity', 'newQty');
        if (purchasePrev != null && purchaseNext != null) {
            delta = purchaseNext - purchasePrev;
        } else {
            const signed = warehouseDeltaFromMeta(meta, true);
            if (signed != null && signed !== 0) {
                delta = signed;
            }
        }
        reason =
            reference.superSupplierName != null
                ? `Purchase from ${reference.superSupplierName}`
                : 'Purchase invoice receipt';
        if (reference.invoiceNumber) {
            reason += ` · ${reference.invoiceNumber}`;
        }
        if (reference.vendorRef) {
            reason += ` · Ref ${reference.vendorRef}`;
        }
    } else if (type === 'stock_adjusted') {
        const prev = readMetaQty(meta, 'previousQuantity', 'previousQty');
        const next = readMetaQty(meta, 'newQuantity', 'newQty');
        if (prev != null && next != null) {
            delta = next - prev;
        } else {
            const signed = warehouseDeltaFromMeta(meta, true);
            if (signed != null && signed !== 0) delta = signed;
        }
        source = 'manual';
        const metaReason =
            typeof meta.reason === 'string'
                ? meta.reason.trim()
                : typeof meta.notes === 'string'
                  ? meta.notes.trim()
                  : '';
        reason = metaReason ? metaReason.slice(0, 500) : 'Manual stock adjustment';
    } else if (type === 'inventory_out_sales_invoice') {
        source = 'sales_invoice';
        reference = invoiceRef(h);
        const q = warehouseDeltaFromMeta(meta);
        if (q != null && q > 0) delta = -Math.abs(q);
        reason = h.title ? String(h.title).slice(0, 120) : 'Stock out — sales invoice';
    } else if (type === 'inventory_in_sales_return') {
        source = 'sales_invoice';
        reference = invoiceRef(h);
        const q = warehouseDeltaFromMeta(meta);
        if (q != null && q > 0) delta = Math.abs(q);
        reason = h.title ? String(h.title).slice(0, 120) : 'Stock in — sales return';
    } else if (type === 'workshop_supplier_purchase_invoice_approved') {
        source = 'supplier_purchase_invoice';
        const invNo = meta.invoiceNumber != null ? String(meta.invoiceNumber) : '';
        reference = {
            type: 'workshop_supplier_purchase_invoice',
            id: h.referenceId != null ? String(h.referenceId) : '',
            invoiceNumber: invNo,
        };
        const q = warehouseDeltaFromMeta(meta);
        if (q != null && q > 0) delta = Math.abs(q);
        reason = 'Workshop purchase invoice approved';
    } else if (type.includes('purchase_order')) {
        source = 'purchase_order';
        reference = {
            type: 'purchase_order',
            id: h.purchaseOrderId != null ? String(h.purchaseOrderId) : '',
        };
        const q = warehouseDeltaFromMeta(meta);
        if (q != null && q > 0) {
            delta =
                type.includes('delivered') || type.includes('accepted') ? Math.abs(q) : null;
        }
        reason =
            type === 'purchase_order_delivered'
                ? 'Purchase order delivered'
                : 'Purchase order';
    } else if (type === 'replenishment_order_created' || h.quantity != null) {
        source = 'replenishment';
        const q =
            h.quantity != null ? Number(h.quantity) : readMetaQty(meta, 'quantity', 'qty');
        if (Number.isFinite(q)) delta = q;
        reference = {
            type: 'supplier_replenishment_order',
            id:
                h.supplierReplenishmentOrderId != null
                    ? String(h.supplierReplenishmentOrderId)
                    : '',
        };
        reason = 'Replenishment order';
    } else {
        source = 'other';
        if (h.referenceType && h.referenceId != null) {
            reference = { type: String(h.referenceType), id: String(h.referenceId) };
        }
        const q = warehouseDeltaFromMeta(meta, true);
        if (q != null && q !== 0) delta = q;
    }

    const adjustedBy =
        h.createdByUserName != null && String(h.createdByUserName).trim() !== ''
            ? { name: String(h.createdByUserName).trim() }
            : null;

    const metaPrev = readMetaQty(meta, 'previousQuantity', 'previousQty');
    const metaNext = readMetaQty(meta, 'newQuantity', 'newQty');
    const cfForWs =
        uom.conversionFactor != null && uom.conversionFactor > 0 ? uom.conversionFactor : 1;
    const hasMetaBalances =
        metaPrev != null &&
        metaNext != null &&
        (type === 'stock_adjusted' ||
            type === 'inventory_in_super_supplier_purchase');

    return {
        id,
        at,
        supplierProductId: h.supplierProductId != null ? String(h.supplierProductId) : null,
        productLabel: h.productName || '—',
        previousQty: hasMetaBalances ? metaPrev : null,
        newQty: hasMetaBalances ? metaNext : null,
        delta,
        previousQtyWorkshop: hasMetaBalances ? metaPrev * cfForWs : null,
        newQtyWorkshop: hasMetaBalances ? metaNext * cfForWs : null,
        deltaWorkshop:
            hasMetaBalances && delta != null && Number.isFinite(Number(delta))
                ? Number(delta) * cfForWs
                : null,
        reason,
        source,
        reference,
        invoiceNo: h.invoiceNo ?? meta.invoiceNo ?? reference?.invoiceNumber ?? null,
        adjustedBy,
        transactionType: type,
        warehouseUnit: uom.warehouseUnit,
        workshopUnit: uom.workshopUnit,
        conversionFactor: uom.conversionFactor,
    };
}

/**
 * Back-fill FROM / TO in warehouse units by walking newest → oldest from current on-hand qty.
 * Workshop columns are derived via conversion factor.
 * @param {object[]} entries – newest first
 * @param {number|null|undefined} currentQtyOnHand – warehouse units on hand now
 * @param {{ warehouseUnit?: string; workshopUnit?: string; conversionFactor?: number }} [productUom]
 */
export function fillSupplierTimelineRunningQty(entries, currentQtyOnHand, productUom = {}) {
    if (!Array.isArray(entries) || entries.length === 0) return [];
    let runningNew = Number(currentQtyOnHand);
    if (!Number.isFinite(runningNew)) runningNew = 0;

    const defaultWh = productUom.warehouseUnit || entries[0]?.warehouseUnit || 'Box';
    const defaultWs = productUom.workshopUnit || entries[0]?.workshopUnit || 'Liter';
    const defaultCf =
        productUom.conversionFactor != null && productUom.conversionFactor > 0
            ? Number(productUom.conversionFactor)
            : entries[0]?.conversionFactor > 0
              ? Number(entries[0].conversionFactor)
              : 1;

    return entries.map((entry) => {
        const cf =
            entry.conversionFactor != null && entry.conversionFactor > 0
                ? Number(entry.conversionFactor)
                : defaultCf;
        const whUom = entry.warehouseUnit || defaultWh;
        const wsUom = entry.workshopUnit || defaultWs;

        let delta = entry.delta;
        if (delta == null || !Number.isFinite(Number(delta))) {
            return {
                ...entry,
                warehouseUnit: whUom,
                workshopUnit: wsUom,
                conversionFactor: cf,
            };
        }

        delta = Number(delta);

        // Prefer authoritative warehouse balances from API metadata (manual adjustments).
        if (
            entry.previousQty != null &&
            entry.newQty != null &&
            Number.isFinite(Number(entry.previousQty)) &&
            Number.isFinite(Number(entry.newQty))
        ) {
            const previousQty = Number(entry.previousQty);
            const newQty = Number(entry.newQty);
            runningNew = previousQty;
            return {
                ...entry,
                previousQty,
                newQty,
                delta,
                previousQtyWorkshop:
                    entry.previousQtyWorkshop != null
                        ? Number(entry.previousQtyWorkshop)
                        : previousQty * cf,
                newQtyWorkshop:
                    entry.newQtyWorkshop != null
                        ? Number(entry.newQtyWorkshop)
                        : newQty * cf,
                deltaWorkshop:
                    entry.deltaWorkshop != null ? Number(entry.deltaWorkshop) : delta * cf,
                warehouseUnit: whUom,
                workshopUnit: wsUom,
                conversionFactor: cf,
            };
        }

        const newQty = runningNew;
        const previousQty = runningNew - delta;
        runningNew = previousQty;

        return {
            ...entry,
            previousQty,
            newQty,
            delta,
            previousQtyWorkshop: previousQty * cf,
            newQtyWorkshop: newQty * cf,
            deltaWorkshop: delta * cf,
            warehouseUnit: whUom,
            workshopUnit: wsUom,
            conversionFactor: cf,
        };
    });
}

/**
 * Inventory line value in SAR — warehouse qty × warehouse unit price (e.g. boxes × SAR/box).
 * Never multiply workshop liters by per-box price.
 */
export function warehouseStockLineValueSar(row) {
    if (!row) return 0;
    const fromApi = row.valueWarehouseSar;
    if (fromApi != null && Number.isFinite(Number(fromApi))) {
        return Number(fromApi);
    }
    const whQty = Number(row.warehouseQty ?? row.currentBalanceWarehouse ?? 0);
    const unitPrice = Number(row.price ?? row.warehouseUnitPrice ?? 0);
    return whQty * unitPrice;
}

/** Purchase/base price per warehouse unit (Box), from API balances. */
export function warehouseUnitPriceFromItem(item) {
    if (!item) return 0;
    const wh = Number(item.currentBalanceWarehouse ?? item.warehouseQty ?? 0);
    const val = Number(item.valueWarehouseSar ?? 0);
    if (wh > 0 && val > 0) return val / wh;
    return Number(item.price ?? 0);
}

/** Format warehouse qty with optional workshop equivalent, e.g. "1 Box (12 Liter)". */
export function formatDualUomQty(qty, warehouseUnit, workshopQty, workshopUnit) {
    const wh = Number(qty);
    if (!Number.isFinite(wh)) return '—';
    const whLabel = warehouseUnit || 'Box';
    const ws = Number(workshopQty);
    const wsLabel = workshopUnit || 'Liter';
    if (Number.isFinite(ws) && wsLabel && Math.abs(ws - wh) > 0.0005) {
        return `${formatPlainQty(wh)} ${whLabel} (${formatPlainQty(ws)} ${wsLabel})`;
    }
    return `${formatPlainQty(wh)} ${whLabel}`;
}

function formatPlainQty(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    if (Math.abs(x - Math.round(x)) < 0.0005) return String(Math.round(x));
    return x.toFixed(2).replace(/\.?0+$/, '');
}

/** Single-line label for Source / Ref column. */
export function formatSupplierTimelineSourceRef(e) {
    if (!e) return '—';
    if (e.source === 'super_supplier_purchase') {
        const num = e.reference?.invoiceNumber || e.invoiceNo || e.reference?.id;
        const vendor = e.reference?.superSupplierName;
        const ref = e.reference?.vendorRef || e.reference?.referenceNo;
        const parts = ['Purchase invoice (AP)'];
        if (num) parts.push(`#${num}`);
        if (vendor) parts.push(vendor);
        if (ref) parts.push(`Ref ${ref}`);
        return parts.join(' · ');
    }
    if (e.source === 'sales_invoice' && e.invoiceNo) {
        return `Sales invoice · #${e.invoiceNo}`;
    }
    const base = humanizeSupplierTimelineSource(e.source);
    if (
        e.reference?.type === 'workshop_supplier_purchase_invoice' &&
        (e.reference.invoiceNumber || e.reference.id)
    ) {
        const num = e.reference.invoiceNumber || e.reference.id;
        return `Supplier purchase (approved) · #${num}`;
    }
    if (e.reference?.type === 'supplier_invoice' && (e.reference.invoiceNumber || e.invoiceNo)) {
        return `Sales invoice · #${e.reference.invoiceNumber || e.invoiceNo}`;
    }
    if (e.reference?.id) {
        const t = humanizeSupplierTimelineRefType(e.reference.type);
        return `${base} · ${t} #${e.reference.id}`;
    }
    return base;
}

function enrichEntryWithProductUom(entry, productUom) {
    if (!entry || !productUom) return entry;
    const cf = Number(productUom.conversionFactor);
    if (!Number.isFinite(cf) || cf <= 0) return entry;
    const entryCf = Number(entry.conversionFactor);
    const useCf = !Number.isFinite(entryCf) || entryCf <= 1 ? cf : entryCf;
    return {
        ...entry,
        conversionFactor: useCf,
        warehouseUnit: productUom.warehouseUnit || entry.warehouseUnit || 'Box',
        workshopUnit: productUom.workshopUnit || entry.workshopUnit || 'Liter',
    };
}

/**
 * Stock Movements tab — one row per physical movement, running qty per product (warehouse UOM).
 */
export function mapSupplierHistoryToMovementRegister(list, warehouseQtyByProductId = {}, productUomByProductId = {}) {
    if (!Array.isArray(list)) return [];

    const stockRows = list.filter(isSupplierStockMovementHistoryRow);
    const entries = stockRows
        .map((h) => {
            const e = normalizeSupplierTimelineEntry(h);
            if (!e) return null;
            const pid = e.supplierProductId;
            return enrichEntryWithProductUom(e, pid ? productUomByProductId[pid] : null);
        })
        .filter((e) => e && isMeaningfulStockMovementEntry(e));

    const byProduct = new Map();
    for (const entry of entries) {
        const pid = entry.supplierProductId || '_unknown';
        if (!byProduct.has(pid)) byProduct.set(pid, []);
        byProduct.get(pid).push(entry);
    }

    const merged = [];
    for (const [pid, group] of byProduct) {
        group.sort((a, b) => String(b.at).localeCompare(String(a.at)));
        const currentQty = Number(warehouseQtyByProductId[pid] ?? 0);
        const uom = productUomByProductId[pid] || {};
        merged.push(...fillSupplierTimelineRunningQty(group, currentQty, uom));
    }

    merged.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return merged;
}

/**
 * Single-product timeline (modal) — newest first with running warehouse balance.
 */
export function mapSupplierHistoryToTimelineEntries(list, currentQtyOnHand, productUom = {}) {
    if (!Array.isArray(list)) return [];
    const stockRows = list.filter(isSupplierStockMovementHistoryRow);
    const rows = stockRows
        .map((h) => {
            const e = normalizeSupplierTimelineEntry(h);
            if (!e) return null;
            return enrichEntryWithProductUom(
                e,
                e.supplierProductId
                    ? productUom[e.supplierProductId] || productUom
                    : productUom,
            );
        })
        .filter((e) => e && isMeaningfulStockMovementEntry(e));
    rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return fillSupplierTimelineRunningQty(rows, currentQtyOnHand, productUom);
}
