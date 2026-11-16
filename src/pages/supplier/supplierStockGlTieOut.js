/** Inventory asset on the supplier CoA (locked inspection code). */
export const INVENTORY_GL_CODE = '1200';

/** Display / compare money at 2 dp HALF_UP (same quantum as portal SAR). */
export function money2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round((x + Number.EPSILON) * 100) / 100;
}

function scaledInt(n, scale) {
    const digits = String(scale).length - 1;
    const s = String(n ?? '').trim().replace(/,/g, '');
    if (!s) return 0;
    const neg = s.startsWith('-');
    const body = neg ? s.slice(1) : s;
    if (!/^\d+(\.\d+)?$/.test(body)) {
        const x = Number(n);
        if (!Number.isFinite(x)) return 0;
        return Math.round(x * scale);
    }
    const [whole, frac = ''] = body.split('.');
    let v = Number(whole) * scale + Number((frac + '0'.repeat(digits)).slice(0, digits) || 0);
    if (frac[digits] && Number(frac[digits]) >= 5) v += 1;
    return neg ? -v : v;
}

function qtyTimesAvgCents(qty, avg) {
    const q = scaledInt(qty, 1000);
    const p = scaledInt(avg, 100);
    if (!(q > 0) || !(p > 0)) return 0;
    const prod = q * p;
    return Math.floor(prod / 1000) + (prod % 1000 >= 500 ? 1 : 0);
}

function centsToNumber(cents) {
    return money2(cents / 100);
}

function locWarehouseQty(loc) {
    return Number(loc?.quantityWarehouseUnits ?? loc?.warehouseQty ?? loc?.qty) || 0;
}

function locMovingAvg(loc) {
    return Number(loc?.averageCost ?? loc?.averageCostWarehouse);
}

/** True when on-hand qty exists but moving average is missing — do not fall back to selling price. */
export function stockLineIsUnaveraged(row) {
    if (!row) return false;
    if (Array.isArray(row.byLocation) && row.byLocation.length) {
        return row.byLocation.some((loc) => {
            const q = locWarehouseQty(loc);
            const avg = locMovingAvg(loc);
            return q > 0 && !(Number.isFinite(avg) && avg > 0);
        });
    }
    const qtyWh = Number(row.warehouseQty ?? row.qty) || 0;
    if (qtyWh <= 0) return false;
    const avg = Number(row.averageCostWarehouse);
    return !(Number.isFinite(avg) && avg > 0);
}

export function stockHasUnaveragedLines(rows) {
    return Array.isArray(rows) && rows.some(stockLineIsUnaveraged);
}

/**
 * Qty × moving average. Ignores `valueWarehouseSar` / `basePrice` / `price`
 * (those are selling / catalogue, not GL 1200).
 */
function lineCents(row) {
    if (!row) return 0;
    if (Array.isArray(row.byLocation) && row.byLocation.length) {
        let cents = 0;
        for (const loc of row.byLocation) {
            const avg = locMovingAvg(loc);
            if (Number.isFinite(avg) && avg > 0) {
                cents += qtyTimesAvgCents(locWarehouseQty(loc), avg);
            }
        }
        return cents;
    }
    const avg = Number(row.averageCostWarehouse);
    if (!(Number.isFinite(avg) && avg > 0)) return 0;
    return qtyTimesAvgCents(row.warehouseQty ?? row.qty, avg);
}

export function stockLineQtyTimesAvgSar(row) {
    return centsToNumber(lineCents(row));
}

/** Qty × average warehouse cost across rows (selling `valueWarehouseSar` is ignored). */
export function stockQtyTimesAvgSar(rows) {
    if (!Array.isArray(rows)) return 0;
    let cents = 0;
    for (const row of rows) cents += lineCents(row);
    return centsToNumber(cents);
}

/**
 * Closing debit − credit for account 1200 from a trial-balance (or CoA) row list.
 * Returns `null` when the account is missing so the widget can fail visibly.
 */
export function inventoryGl1200Balance(accounts) {
    const list = Array.isArray(accounts) ? accounts : [];
    const acc = list.find(
        (a) => String(a?.code ?? a?.accountCode ?? '').trim() === INVENTORY_GL_CODE,
    );
    if (!acc) return null;
    if (acc.debitBalance != null || acc.creditBalance != null) {
        return money2(Number(acc.debitBalance || 0) - Number(acc.creditBalance || 0));
    }
    if (acc.debit != null || acc.credit != null) {
        return money2(Number(acc.debit || 0) - Number(acc.credit || 0));
    }
    if (acc.balance != null) return money2(acc.balance);
    return null;
}

/**
 * Stock qty×avg vs GL 1200. Breaks visibly when the account is missing or
 * the absolute delta is above one halala.
 */
export function stockGlTieOut({
    stockValue,
    glBalance,
    unaveraged = false,
    tolerance = 0.01,
} = {}) {
    const stock = money2(stockValue);
    if (unaveraged) {
        return {
            ok: false,
            missingGl: false,
            unaveraged: true,
            stockValue: stock,
            glBalance:
                glBalance == null || !Number.isFinite(Number(glBalance))
                    ? null
                    : money2(glBalance),
            delta: null,
        };
    }
    if (glBalance == null || !Number.isFinite(Number(glBalance))) {
        return {
            ok: false,
            missingGl: true,
            unaveraged: false,
            stockValue: stock,
            glBalance: null,
            delta: null,
        };
    }
    const gl = money2(glBalance);
    const delta = money2(stock - gl);
    return {
        ok: Math.abs(delta) <= tolerance,
        missingGl: false,
        unaveraged: false,
        stockValue: stock,
        glBalance: gl,
        delta,
    };
}
