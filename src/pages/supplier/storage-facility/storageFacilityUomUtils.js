export const SF_WAREHOUSE_UNIT_PRESETS = [
    'Box',
    'Carton',
    'Dozen',
    'Pack',
    'Drum',
    'Bag',
    'liter',
    'pcs',
];

export const SF_WORKSHOP_UNIT_PRESETS = [
    'pcs',
    'Liter',
    'liter',
    'kg',
    'ml',
    'Set',
    'piece',
];

export function normUomKey(u) {
    return String(u ?? '').trim().toLowerCase();
}

export function formatUomRule(warehouseUnit, workshopUnit, conversionFactor) {
    const wu = String(warehouseUnit || '').trim();
    const ws = String(workshopUnit || '').trim();
    const n = Number(conversionFactor) || 1;
    if (!wu) return '—';
    if (!ws || wu.toLowerCase() === ws.toLowerCase()) return wu;
    return `1 ${wu} = ${n} ${ws}`;
}

/** Effective UOM from storage product row (profile, catalog map, or stock unit). */
/** Options for product create/edit — link a saved profile or pick a stock unit. */
export function buildProductUomSelectOptions(profiles = []) {
    const options = [
        { value: 'unit:pcs', label: 'pcs (each)', kind: 'unit' },
        { value: 'unit:Liter', label: 'Liter', kind: 'unit' },
        { value: 'unit:liter', label: 'liter', kind: 'unit' },
        { value: 'unit:kg', label: 'kg', kind: 'unit' },
    ];
    const seen = new Set(options.map((o) => o.value));
    for (const p of profiles) {
        if (p.isActive === false) continue;
        const key = `profile:${p.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.unshift({
            value: key,
            label: `${p.name} — ${p.ruleLabel || formatUomRule(p.warehouseUnit, p.workshopUnit, p.conversionFactor)}`,
            kind: 'profile',
            profileId: p.id,
            workshopUnit: p.workshopUnit,
        });
    }
    return options;
}

export function productUomSelectValue(product, profiles) {
    if (product?.uomProfileId) return `profile:${product.uomProfileId}`;
    const unit = String(product?.unit || 'pcs').trim() || 'pcs';
    const match = (profiles || []).find(
        (p) =>
            p.isActive !== false &&
            String(p.workshopUnit || '').toLowerCase() === unit.toLowerCase(),
    );
    if (match) return `profile:${match.id}`;
    return `unit:${unit}`;
}

export function parseProductUomSelectValue(value) {
    const v = String(value || '').trim();
    if (v.startsWith('profile:')) {
        return { uomProfileId: v.slice(8), unit: null };
    }
    if (v.startsWith('unit:')) {
        return { uomProfileId: null, unit: v.slice(5) || 'pcs' };
    }
    return { uomProfileId: null, unit: v || 'pcs' };
}

/** Stock is stored in workshop/stock units (e.g. Liter). Show warehouse packing (Box) as primary. */
export function formatStockOnHandDisplay(qtyOnHand, eff) {
    const qty = Number(qtyOnHand) || 0;
    const cf = Number(eff?.conversionFactor) || 1;
    const wu = String(eff?.warehouseUnit || '').trim() || 'pcs';
    const wsu = String(eff?.workshopUnit || '').trim() || wu;
    const same = normUomKey(wu) === normUomKey(wsu);

    if (same || cf <= 1) {
        return { primary: `${qty.toLocaleString()} ${wsu}`, secondary: null };
    }
    const whQty = Math.round((qty / cf) * 1000) / 1000;
    return {
        primary: `${whQty.toLocaleString()} ${wu}`,
        secondary: `${qty.toLocaleString()} ${wsu} in stock`,
    };
}

/** Movement/timeline qty (stored in workshop units) → warehouse display when split UOM. */
export function formatStorageMovementQtyDisplay(wsQty, eff) {
    const qty = Number(wsQty);
    if (!Number.isFinite(qty)) return '—';
    const cf = Number(eff?.conversionFactor) || 1;
    const wu = String(eff?.warehouseUnit || '').trim() || 'pcs';
    const wsu = String(eff?.workshopUnit || '').trim() || wu;
    const split =
        wu &&
        wsu &&
        normUomKey(wu) !== normUomKey(wsu) &&
        cf > 1;
    if (!split) {
        return `${qty.toLocaleString()} ${wsu}`;
    }
    const whQty = Math.round((qty / cf) * 1000) / 1000;
    return `${whQty.toLocaleString()} ${wu}`;
}

/** Default qty entry unit for transfers / movements (warehouse pack when split UOM). */
export function defaultEntryUnitForProduct(product) {
    const eff = productEffectiveUom(product || {});
    const cf = Number(eff.conversionFactor) || 1;
    const wu = String(eff.warehouseUnit || '').trim();
    const wsu = String(eff.workshopUnit || '').trim();
    const split =
        wu && wsu && normUomKey(wu) !== normUomKey(wsu) && cf > 1;
    return split ? wu : wsu || wu || 'pcs';
}

/** Stored stock qty (workshop) → qty for user entry field (warehouse when split). */
export function stockQtyToEntryQty(stockQty, product) {
    const qty = Number(stockQty);
    if (!Number.isFinite(qty)) return '';
    const eff = productEffectiveUom(product || {});
    const cf = Number(eff.conversionFactor) || 1;
    const wu = String(eff.warehouseUnit || '').trim();
    const wsu = String(eff.workshopUnit || '').trim();
    const split =
        wu && wsu && normUomKey(wu) !== normUomKey(wsu) && cf > 1;
    if (!split) return String(qty);
    const wh = Math.round((qty / cf) * 1000) / 1000;
    return String(wh);
}

/** Invoice line caps — use selected profile conversion when line picks a profile. */
export function lineInventoryCapsForInvoice(capsRow, line, profiles = []) {
    if (!capsRow) return null;
    const pid = line?.uomProfileId;
    if (!pid) return capsRow;
    const p = (profiles || []).find((x) => String(x.id) === String(pid));
    if (!p) return capsRow;
    const cf = Number(p.conversionFactor) || 1;
    const qtyWs = Number(capsRow.stockQtyWorkshop) || 0;
    return {
        ...capsRow,
        warehouseUnit: p.warehouseUnit,
        workshopUnit: p.workshopUnit,
        conversionFactor: cf,
        warehouseStockQty: cf > 0 ? Math.round((qtyWs / cf) * 1000) / 1000 : qtyWs,
    };
}

/** Invoice line UOM dropdown — each profile is its own option (no duplicate Box collapse). */
export function buildInvoiceLineUomOptions(capsRow, profiles = []) {
    const options = [];
    const seen = new Set();

    const push = (opt) => {
        if (!opt?.value || seen.has(opt.value)) return;
        seen.add(opt.value);
        options.push(opt);
    };

    if (capsRow) {
        const cf = Number(capsRow.conversionFactor) || 1;
        const rule = formatUomRule(
            capsRow.warehouseUnit,
            capsRow.workshopUnit,
            cf,
        );
        if (capsRow.warehouseUnit) {
            push({
                value: 'uom:wh',
                label: `Sell in ${capsRow.warehouseUnit} — ${rule} (this product)`,
                unit: capsRow.warehouseUnit,
                uomProfileId: null,
                mode: 'warehouse',
            });
        }
        if (
            capsRow.workshopUnit &&
            normUomKey(capsRow.workshopUnit) !== normUomKey(capsRow.warehouseUnit)
        ) {
            push({
                value: 'uom:ws',
                label: `Sell in ${capsRow.workshopUnit} — stock is counted in ${capsRow.workshopUnit}`,
                unit: capsRow.workshopUnit,
                uomProfileId: null,
                mode: 'workshop',
            });
        }
    }

    for (const p of profiles) {
        if (p.isActive === false) continue;
        const rule =
            p.ruleLabel ||
            formatUomRule(p.warehouseUnit, p.workshopUnit, p.conversionFactor);
        push({
            value: `profile:${p.id}:wh`,
            label: `${p.name} — ${rule} (invoice in ${p.warehouseUnit})`,
            unit: p.warehouseUnit,
            uomProfileId: p.id,
            mode: 'warehouse',
        });
        if (
            p.workshopUnit &&
            normUomKey(p.workshopUnit) !== normUomKey(p.warehouseUnit)
        ) {
            push({
                value: `profile:${p.id}:ws`,
                label: `${p.name} — ${rule} (invoice in ${p.workshopUnit})`,
                unit: p.workshopUnit,
                uomProfileId: p.id,
                mode: 'workshop',
            });
        }
    }

    push({
        value: 'uom:pcs',
        label: 'pcs',
        unit: 'pcs',
        uomProfileId: null,
        mode: 'warehouse',
    });

    return options;
}

export function parseInvoiceLineUomSelectValue(selectValue, options = []) {
    const hit = options.find((o) => o.value === selectValue);
    if (hit) {
        return {
            unit: hit.unit,
            uomProfileId: hit.uomProfileId || null,
            uomMode: hit.mode || 'warehouse',
        };
    }
    const v = String(selectValue || '').trim();
    if (v.startsWith('profile:')) {
        const parts = v.split(':');
        const id = parts[1];
        const mode = parts[2];
        return { unit: mode === 'ws' ? 'Liter' : 'Box', uomProfileId: id };
    }
    if (v.startsWith('uom:')) {
        return { unit: 'pcs', uomProfileId: null };
    }
    return { unit: v || 'pcs', uomProfileId: null, uomMode: 'warehouse' };
}

export function invoiceLineUomSelectValue(line, options = []) {
    if (line?.uomProfileId) {
        const mode =
            line.uomMode ||
            (normUomKey(line.uom) === normUomKey(line.workshopUnit) ? 'workshop' : 'warehouse');
        const want = `profile:${line.uomProfileId}:${mode === 'workshop' ? 'ws' : 'wh'}`;
        if (options.some((o) => o.value === want)) return want;
        const any = `profile:${line.uomProfileId}:wh`;
        if (options.some((o) => o.value === any)) return any;
    }
    if (line?.uom) {
        const u = normUomKey(line.uom);
        const wh = options.find((o) => o.value === 'uom:wh' && normUomKey(o.unit) === u);
        if (wh) return wh.value;
        const ws = options.find((o) => o.value === 'uom:ws' && normUomKey(o.unit) === u);
        if (ws) return ws.value;
    }
    return options[0]?.value || 'uom:pcs';
}

export function productEffectiveUom(product) {
    if (product?.uomProfile) {
        return {
            warehouseUnit: product.uomProfile.warehouseUnit,
            workshopUnit: product.uomProfile.workshopUnit,
            conversionFactor: product.uomProfile.conversionFactor,
            profileName: product.uomProfile.name,
            source: 'profile',
        };
    }
    const wh = product?.warehouseProduct;
    if (wh) {
        return {
            warehouseUnit: wh.warehouseUnit,
            workshopUnit: wh.workshopUnit,
            conversionFactor: wh.conversionFactor,
            profileName: null,
            source: 'catalog',
        };
    }
    const u = String(product?.unit || 'pcs').trim() || 'pcs';
    return {
        warehouseUnit: u,
        workshopUnit: u,
        conversionFactor: 1,
        profileName: null,
        source: 'unit',
    };
}
