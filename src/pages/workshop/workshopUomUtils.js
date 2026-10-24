export const WS_WAREHOUSE_UNIT_PRESETS = [
    'Box',
    'Carton',
    'Dozen',
    'Pack',
    'Drum',
    'Bag',
    'liter',
    'pcs',
];

export const WS_WORKSHOP_UNIT_PRESETS = [
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

/** Stock is stored in workshop units (e.g. Liter). Show warehouse (Box) as primary. */
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

export function productEffectiveUom(product) {
    if (product?.uomProfile) {
        return {
            warehouseUnit: product.uomProfile.warehouseUnit,
            workshopUnit: product.uomProfile.workshopUnit,
            conversionFactor: product.uomProfile.conversionFactor,
            profileName: product.uomProfile.name,
            uomProfileId: product.uomProfile.id,
        };
    }
    return {
        warehouseUnit: product?.warehouseUnit,
        workshopUnit: product?.workshopUnit || product?.unit,
        conversionFactor: product?.conversionFactor ?? 1,
        profileName: product?.uomProfileName ?? null,
        uomProfileId: product?.uomProfileId ?? null,
    };
}

export function productUomSelectValue(product, profiles = []) {
    if (product?.uomProfileId) return `profile:${product.uomProfileId}`;
    const unit = String(product?.workshopUnit || product?.unit || 'pcs').trim() || 'pcs';
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

export function buildProductUomSelectOptions(profiles = []) {
    const options = [
        { value: 'unit:pcs', label: 'pcs (each)', kind: 'unit' },
        { value: 'unit:Liter', label: 'Liter', kind: 'unit' },
        { value: 'unit:liter', label: 'liter', kind: 'unit' },
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
        });
    }
    return options;
}

export function buildInvoiceLineUomOptions(capsRow, profiles = []) {
    const options = [];
    const seen = new Set();

    const push = (opt) => {
        if (!opt?.value || seen.has(opt.value)) return;
        seen.add(opt.value);
        options.push(opt);
    };

    if (capsRow?.warehouseUnit) {
        const cf = Number(capsRow.conversionFactor) || 1;
        const rule = formatUomRule(capsRow.warehouseUnit, capsRow.workshopUnit, cf);
        const wh = String(capsRow.warehouseUnit).trim() || 'Box';
        const ws = String(capsRow.workshopUnit || '').trim();
        push({
            value: 'uom:wh',
            label: `Product default — ${rule} (invoice in ${wh})`,
            shortLabel: wh,
            title: `Invoice in ${wh}; branch stock in ${ws || wh}. ${rule}`,
            unit: wh,
            uomProfileId: capsRow.uomProfileId ?? null,
            mode: 'warehouse',
        });
        if (ws && normUomKey(ws) !== normUomKey(wh)) {
            push({
                value: 'uom:ws',
                label: `Product default — stock in ${ws}`,
                shortLabel: ws,
                title: `Invoice in ${ws}; same unit as branch stock. ${rule}`,
                unit: ws,
                uomProfileId: capsRow.uomProfileId ?? null,
                mode: 'workshop',
            });
        }
    }

    for (const p of profiles) {
        if (p.isActive === false) continue;
        const rule = p.ruleLabel || formatUomRule(p.warehouseUnit, p.workshopUnit, p.conversionFactor);
        const wh = String(p.warehouseUnit || '').trim() || 'Box';
        const ws = String(p.workshopUnit || '').trim();
        push({
            value: `profile:${p.id}:wh`,
            label: `${p.name} — ${rule} (invoice in ${wh})`,
            shortLabel: wh,
            title: `${p.name}: invoice in ${wh}, stock in ${ws || wh}. ${rule}`,
            unit: wh,
            uomProfileId: p.id,
            mode: 'warehouse',
        });
        if (ws && normUomKey(ws) !== normUomKey(wh)) {
            push({
                value: `profile:${p.id}:ws`,
                label: `${p.name} — ${rule} (invoice in ${ws})`,
                shortLabel: ws,
                title: `${p.name}: invoice in ${ws}. ${rule}`,
                unit: ws,
                uomProfileId: p.id,
                mode: 'workshop',
            });
        }
    }

    push({
        value: 'uom:pcs',
        label: 'pcs',
        shortLabel: 'pcs',
        title: 'Pieces (each)',
        unit: 'pcs',
        uomProfileId: null,
        mode: 'warehouse',
    });

    return options;
}

export function parseInvoiceLineUomSelectValue(selectVal, options = []) {
    const hit = options.find((o) => o.value === selectVal);
    if (hit) {
        return {
            uom: hit.unit,
            uomProfileId: hit.uomProfileId || null,
            uomMode: hit.mode === 'workshop' ? 'workshop' : 'warehouse',
        };
    }
    if (String(selectVal).startsWith('profile:')) {
        const parts = String(selectVal).split(':');
        const id = parts[1];
        const mode = parts[2] === 'ws' ? 'workshop' : 'warehouse';
        const prof = (options.length ? options : []).find((o) => String(o.uomProfileId) === id);
        return {
            uom: prof?.unit || (mode === 'workshop' ? 'Liter' : 'Box'),
            uomProfileId: id,
            uomMode: mode,
        };
    }
    return { uom: 'pcs', uomProfileId: null, uomMode: 'warehouse' };
}

export function invoiceLineUomSelectValue(line, options = []) {
    if (line?.uomProfileId) {
        const mode = line.uomMode === 'workshop' ? 'ws' : 'wh';
        const want = `profile:${line.uomProfileId}:${mode}`;
        if (options.some((o) => o.value === want)) return want;
        const any = `profile:${line.uomProfileId}:wh`;
        if (options.some((o) => o.value === any)) return any;
    }
    if (line?.uomMode === 'workshop') {
        const ws = options.find((o) => o.value === 'uom:ws');
        if (ws) return ws.value;
    }
    if (line?.uom) {
        const byUnit = options.find((o) => normUomKey(o.unit) === normUomKey(line.uom));
        if (byUnit) return byUnit.value;
    }
    return options[0]?.value || 'uom:pcs';
}

export function branchProductToUomCaps(product) {
    if (!product) return null;
    const cf = Number(product.conversionFactor) || 1;
    return {
        warehouseUnit: product.warehouseUnit || product.unit || 'pcs',
        workshopUnit: product.workshopUnit || product.unit || 'pcs',
        conversionFactor: cf,
        uomProfileId: product.uomProfileId ?? null,
        profileName: product.uomProfileName ?? null,
        stockQtyWorkshop: product.qtyOnHand ?? product.currentQty ?? product.qty,
    };
}

export function lineInventoryCapsForInvoice(capsRow, line, profiles = []) {
    if (!capsRow) return null;
    const pid = line?.uomProfileId;
    if (!pid) return capsRow;
    const p = (profiles || []).find((x) => String(x.id) === String(pid));
    if (!p) return capsRow;
    const cf = Number(p.conversionFactor) || 1;
    const qtyWs = Number(capsRow.stockQtyWorkshop ?? capsRow.qtyOnHandWorkshop) || 0;
    return {
        ...capsRow,
        warehouseUnit: p.warehouseUnit,
        workshopUnit: p.workshopUnit,
        conversionFactor: cf,
        uomProfileId: p.id,
        profileName: p.name,
        warehouseStockQty: cf > 0 ? Math.round((qtyWs / cf) * 1000) / 1000 : qtyWs,
    };
}
