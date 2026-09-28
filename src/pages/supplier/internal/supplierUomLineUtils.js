/** Shared sales-invoice line UOM helpers (warehouse ↔ workshop conversion). */

export function roundMoney2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
}

export function normUomLabel(u) {
    return String(u ?? '').trim().toLowerCase();
}

export function isWarehouseUomLine(line, inv) {
    if (line?.uomMode === 'workshop') return false;
    if (line?.uomMode === 'warehouse') return true;
    const wu = normUomLabel(inv?.warehouseUnit);
    const u = normUomLabel(line?.uom);
    return !!wu && !!u && u === wu;
}

export function lineStockKey(line) {
    const a = String(line?.supplierStockProductId ?? '').trim();
    if (a) return a;
    const b = String(line?.supplierProductId ?? '').trim();
    if (b) return b;
    return String(line?.storageProductId ?? '').trim();
}

export function findInventoryCapsRow(line, inventoryItems) {
    const sid = String(line?.supplierStockProductId ?? '').trim();
    const pid = String(line?.supplierProductId ?? '').trim();
    const stid = String(line?.storageProductId ?? '').trim();
    if (!sid && !pid && !stid) return null;
    return (
        inventoryItems.find((inv) => {
            const iss =
                inv.supplierStockProductId != null
                    ? String(inv.supplierStockProductId)
                    : '';
            const iid = String(inv.id);
            const ist = inv.storageProductId != null ? String(inv.storageProductId) : '';
            return (
                (sid && (iss === sid || iid === sid)) ||
                (pid && iid === pid) ||
                (stid && (ist === stid || iid === stid))
            );
        }) ?? null
    );
}

function maxSellableQtyWorkshopForLine(line, lines, inventoryItems) {
    const inv = findInventoryCapsRow(line, inventoryItems);
    if (!inv || inv.stockQtyWorkshop == null || !Number.isFinite(inv.stockQtyWorkshop)) {
        return null;
    }
    const cap = Number(inv.stockQtyWorkshop);
    const key = lineStockKey(line);
    if (!key) return null;
    let otherSum = 0;
    for (const ln of lines) {
        if (ln.key === line.key || ln.id === line.id) continue;
        if (lineStockKey(ln) !== key) continue;
        if (isWarehouseUomLine(ln, inv)) continue;
        otherSum += parseFloat(String(ln.qty).replace(',', '.')) || 0;
    }
    return Math.max(0, roundMoney2(cap - otherSum));
}

function maxSellableQtyWarehouseForLine(line, lines, inventoryItems) {
    const inv = findInventoryCapsRow(line, inventoryItems);
    if (!inv || !Number.isFinite(Number(inv.warehouseStockQty))) {
        return null;
    }
    const cap = Number(inv.warehouseStockQty);
    const key = lineStockKey(line);
    if (!key) return null;
    let otherSum = 0;
    for (const ln of lines) {
        if (ln.key === line.key || ln.id === line.id) continue;
        if (lineStockKey(ln) !== key) continue;
        if (!isWarehouseUomLine(ln, inv)) continue;
        otherSum += parseFloat(String(ln.qty).replace(',', '.')) || 0;
    }
    return Math.max(0, roundMoney2(cap - otherSum));
}

export function maxSellableQtyForLine(line, lines, inventoryItems) {
    const inv = findInventoryCapsRow(line, inventoryItems);
    if (!inv) return null;
    return isWarehouseUomLine(line, inv)
        ? maxSellableQtyWarehouseForLine(line, lines, inventoryItems)
        : maxSellableQtyWorkshopForLine(line, lines, inventoryItems);
}

export function lineUomOptions(line, inv) {
    const opts = [];
    const wu = String(inv?.warehouseUnit ?? '').trim();
    const wsu = String(inv?.workshopUnit ?? '').trim();
    if (wu) opts.push(wu);
    if (wsu && normUomLabel(wsu) !== normUomLabel(wu)) opts.push(wsu);
    if (opts.length === 0) {
        return [String(line?.uom ?? 'pcs').trim() || 'pcs'];
    }
    return opts;
}

export function formatLineUomConversionPreview(line, inv) {
    if (!inv) return '';
    const cf = Number(inv.conversionFactor) || 1;
    if (!(cf > 1)) return '';
    const wu = inv.warehouseUnit || 'Box';
    const wsu = inv.workshopUnit || 'pcs';
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    if (!(qty > 0)) return '';
    const price = parseFloat(String(line.unitPrice ?? line.price).replace(',', '.')) || 0;
    if (isWarehouseUomLine(line, inv)) {
        const wsQty = roundMoney2(qty * cf);
        const wsPrice = cf > 0 ? roundMoney2(price / cf) : price;
        return `${qty} ${wu} = ${wsQty} ${wsu} at workshop · SAR ${price.toFixed(2)}/${wu} → SAR ${wsPrice.toFixed(2)}/${wsu}`;
    }
    const whQty = roundMoney2(qty / cf);
    const whPrice = roundMoney2(price * cf);
    return `${qty} ${wsu} = ${whQty} ${wu} warehouse · SAR ${price.toFixed(2)}/${wsu} → SAR ${whPrice.toFixed(2)}/${wu}`;
}

/** Build inventory caps row from a storage-facility product list entry. */
export function storageProductToInvCaps(p) {
    const wh = p?.warehouseProduct;
    const prof = p?.uomProfile;
    if (!wh && prof) {
        const cf = Number(prof.conversionFactor) || 1;
        const qtyWs = Number(p.qtyOnHand) || 0;
        const wu = String(prof.warehouseUnit ?? '').trim();
        const wsu = String(prof.workshopUnit ?? p.unit ?? '').trim();
        return {
            id: String(p.id),
            storageProductId: String(p.id),
            supplierProductId: '',
            warehouseUnit: wu || wsu || 'pcs',
            workshopUnit: wsu || wu || 'pcs',
            conversionFactor: cf,
            stockQtyWorkshop: qtyWs,
            warehouseStockQty: cf > 0 ? roundMoney2(qtyWs / cf) : qtyWs,
        };
    }
    if (!wh) {
        const u = String(p?.unit ?? 'pcs').trim() || 'pcs';
        const qtyWs = Number(p.qtyOnHand) || 0;
        return {
            id: String(p.id),
            storageProductId: String(p.id),
            supplierProductId: '',
            warehouseUnit: u,
            workshopUnit: u,
            conversionFactor: 1,
            stockQtyWorkshop: qtyWs,
            warehouseStockQty: qtyWs,
        };
    }
    const cf = Number(wh.conversionFactor) || 1;
    const qtyWs = Number(p.qtyOnHand) || 0;
    const wu = String(wh.warehouseUnit ?? '').trim();
    const wsu = String(wh.workshopUnit ?? p.unit ?? '').trim();
    return {
        id: String(wh.id),
        storageProductId: String(p.id),
        supplierProductId: String(wh.id),
        warehouseUnit: wu || wsu || 'pcs',
        workshopUnit: wsu || wu || 'pcs',
        conversionFactor: cf,
        stockQtyWorkshop: qtyWs,
        warehouseStockQty: cf > 0 ? roundMoney2(qtyWs / cf) : qtyWs,
    };
}

export function storageProductsToInvCaps(products) {
    return (products || [])
        .map(storageProductToInvCaps)
        .filter(Boolean);
}

export function catalogUnitsAreSameFromWh(wh) {
    if (!wh) return false;
    const wu = normUomLabel(wh.warehouseUnit);
    const ws = normUomLabel(wh.workshopUnit);
    return !!wu && !!ws && wu === ws;
}

export function defaultUomForWarehouseProduct(wh, fallback = 'pcs') {
    if (!wh) return fallback;
    const wu = String(wh.warehouseUnit ?? '').trim();
    const wsu = String(wh.workshopUnit ?? '').trim();
    if (catalogUnitsAreSameFromWh(wh)) return wu || wsu || fallback;
    return wu || wsu || fallback;
}
