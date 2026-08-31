/**
 * Build receivedQtyByInvoiceItemId for approve/receive APIs.
 * Leave empty when physical qty matches invoiced workshop qty.
 */
export function buildReceivedQtyByInvoiceItemIdPayload(lines, receivedByItemId) {
    if (!Array.isArray(lines) || lines.length === 0) return undefined;
    const receivedQtyByInvoiceItemId = {};
    for (const ln of lines) {
        const itemId = ln.invoiceItemId;
        if (itemId == null || String(itemId).trim() === '') continue;
        const raw = receivedByItemId?.[itemId];
        if (raw === undefined || raw === null || String(raw).trim() === '') continue;
        const n = parseFloat(String(raw).replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) continue;
        const expected = Number(ln.workshopReceiveQty);
        if (Number.isFinite(expected) && Math.abs(n - expected) < 0.0005) continue;
        receivedQtyByInvoiceItemId[String(itemId)] = n;
    }
    return Object.keys(receivedQtyByInvoiceItemId).length > 0
        ? receivedQtyByInvoiceItemId
        : undefined;
}
