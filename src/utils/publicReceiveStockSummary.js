function fmtQty(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    if (Math.abs(v - Math.round(v)) < 0.0005) return String(Math.round(v));
    return v.toFixed(2).replace(/\.?0+$/, '');
}

function parseEnteredReceiveQty(raw) {
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const n = parseFloat(String(raw).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
}

/** Actual workshop UOM qty this branch will receive for a line (typed override or invoiced). */
export function effectiveLineReceiveQty(ln, receiveQtyByItemId) {
    const itemId = ln?.invoiceItemId != null ? String(ln.invoiceItemId) : null;
    if (itemId) {
        const entered = parseEnteredReceiveQty(receiveQtyByItemId?.[itemId]);
        if (entered != null) return entered;
    }
    const invoiced = Number(ln?.workshopReceiveQty);
    return Number.isFinite(invoiced) ? invoiced : null;
}

export function liveStockReceiveSummaryText(data, receiveQtyByItemId) {
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    if (lines.length > 0) {
        const byUnit = new Map();
        for (const ln of lines) {
            const qty = effectiveLineReceiveQty(ln, receiveQtyByItemId);
            if (qty == null) continue;
            const unit = String(ln.workshopReceiveUnit ?? ln.unit ?? 'pcs').trim() || 'pcs';
            byUnit.set(unit, (byUnit.get(unit) ?? 0) + qty);
        }
        const totals = [...byUnit.entries()].map(([unit, qty]) => ({ unit, qty }));
        if (totals.length === 1) {
            return `Branch inventory will increase by +${fmtQty(totals[0].qty)} ${totals[0].unit}`;
        }
        if (totals.length > 1) {
            return `Branch inventory will increase by ${totals
                .map((t) => `+${fmtQty(t.qty)} ${t.unit}`)
                .join(' · ')} (each product uses its own catalog UOM)`;
        }
    }
    if (data?.stockReceiveSummary) return data.stockReceiveSummary;
    const totals = Array.isArray(data?.totalsByWorkshopUnit) ? data.totalsByWorkshopUnit : [];
    if (totals.length === 1) {
        return `Branch inventory will increase by +${fmtQty(totals[0].qty)} ${totals[0].unit}`;
    }
    if (totals.length > 1) {
        return `Branch inventory will increase by ${totals
            .map((t) => `+${fmtQty(t.qty)} ${t.unit}`)
            .join(' · ')} (each product uses its own catalog UOM)`;
    }
    return null;
}
