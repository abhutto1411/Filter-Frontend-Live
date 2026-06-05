import {
    defaultUomForWarehouseProduct,
    formatLineUomConversionPreview,
    isWarehouseUomLine,
    lineUomOptions,
    normUomLabel,
    roundMoney2,
} from '../supplier/internal/supplierUomLineUtils';

/** Map API rule → caps row shape used by supplier UOM helpers. */
export function uomRuleToCaps(rule) {
    if (!rule) return null;
    return {
        id: rule.supplierProductId,
        warehouseUnit: rule.warehouseUnit,
        workshopUnit: rule.workshopUnit,
        conversionFactor: rule.conversionFactor,
    };
}

export function findUomCapsForLine(line, supplierUomByProductId, branchProductOptions = []) {
    if (line?.warehouseUnit && line?.conversionFactor != null) {
        return uomRuleToCaps({
            supplierProductId: line.supplierProductId,
            warehouseUnit: line.warehouseUnit,
            workshopUnit: line.workshopUnit,
            conversionFactor: line.conversionFactor,
        });
    }
    const pid = String(line?.productId ?? '').trim();
    if (!pid) return null;
    const fromMap = supplierUomByProductId[pid];
    if (fromMap) return uomRuleToCaps(fromMap);
    const opt = branchProductOptions.find((o) => String(o.id) === pid);
    if (opt?.uomProfileId || (opt?.warehouseUnit && opt?.conversionFactor != null)) {
        return uomRuleToCaps({
            supplierProductId: opt.supplierProductId,
            warehouseUnit: opt.warehouseUnit,
            workshopUnit: opt.workshopUnit,
            conversionFactor: opt.conversionFactor,
            uomProfileId: opt.uomProfileId,
        });
    }
    return null;
}

/** Workshop PI line hint — matches invoice table copy (e.g. 1 Box = 12 Liter at workshop ~ SAR …/Box ~ SAR …/Liter). */
export function formatWorkshopPurchaseLineUomHint(line, caps) {
    if (!caps) return '';
    const cf = Number(caps.conversionFactor) || 1;
    if (!(cf > 1)) return '';
    const wu = String(caps.warehouseUnit || 'Box').trim() || 'Box';
    const wsu = String(caps.workshopUnit || 'pcs').trim() || 'pcs';
    const qtyRaw = parseFloat(String(line?.qty ?? '').replace(',', '.'));
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
    const price = parseFloat(String(line?.price ?? line?.unitPrice ?? '').replace(',', '.')) || 0;

    if (isWarehouseUomLine(line, caps)) {
        const wsQty = roundMoney2(qty * cf);
        let text = `${qty} ${wu} = ${wsQty} ${wsu} at workshop`;
        if (price > 0) {
            const wsPrice = roundMoney2(price / cf);
            text += ` ~ SAR ${price.toFixed(2)}/${wu} ~ SAR ${wsPrice.toFixed(2)}/${wsu}`;
        }
        return text;
    }

    const whQty = roundMoney2(qty / cf);
    let text = `${qty} ${wsu} = ${whQty} ${wu} warehouse`;
    if (price > 0) {
        const whPrice = roundMoney2(price * cf);
        text += ` ~ SAR ${price.toFixed(2)}/${wsu} ~ SAR ${whPrice.toFixed(2)}/${wu}`;
    }
    return text;
}

export {
    defaultUomForWarehouseProduct,
    formatLineUomConversionPreview,
    isWarehouseUomLine,
    lineUomOptions,
    normUomLabel,
    roundMoney2,
};

/** Convert a unit price from one UOM label to another using supplier caps. */
export function convertUnitPriceBetweenUoms(price, fromUom, toUom, caps) {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0 || !caps) return p;
    const cf = Number(caps.conversionFactor) || 1;
    if (!(cf > 1)) return p;
    const fromWh = normUomLabel(fromUom) === normUomLabel(caps.warehouseUnit);
    const toWh = normUomLabel(toUom) === normUomLabel(caps.warehouseUnit);
    if (fromWh === toWh) return roundMoney2(p);
    return roundMoney2(fromWh ? p / cf : p * cf);
}

/**
 * Prefill unit price for the selected line UOM.
 * Catalog / branch prices are per workshop unit (Liter); last prices are per the UOM on that invoice line.
 */
export function prefillPriceForLineUom({
    lineUom,
    caps,
    catalogUnit,
    catalogEx,
    catalogIncl,
    lastRow,
    amountsTaxInclusive,
}) {
    const cf = Number(caps?.conversionFactor) || 1;
    const defaultWh = caps ? defaultUomForWarehouseProduct(caps, lineUom) : lineUom;
    const targetUom = lineUom || defaultWh;

    if (lastRow) {
        const lastUom = lastRow.uom || caps?.workshopUnit || catalogUnit;
        const base = amountsTaxInclusive
            ? Number(lastRow.lastUnitPriceInclVat ?? 0)
            : Number(lastRow.lastUnitPriceExVat ?? 0);
        if (base > 0) {
            return convertUnitPriceBetweenUoms(base, lastUom, targetUom, caps);
        }
    }

    const catalogIsWorkshop =
        caps &&
        cf > 1 &&
        normUomLabel(catalogUnit) === normUomLabel(caps.workshopUnit);
    const lineIsWarehouse =
        caps && cf > 1 && normUomLabel(targetUom) === normUomLabel(caps.warehouseUnit);

    if (amountsTaxInclusive) {
        if (lineIsWarehouse && catalogIsWorkshop && catalogIncl > 0) {
            return roundMoney2(catalogIncl * cf);
        }
        return catalogIncl;
    }
    if (lineIsWarehouse && catalogIsWorkshop && catalogEx > 0) {
        return roundMoney2(catalogEx * cf);
    }
    return catalogEx;
}
