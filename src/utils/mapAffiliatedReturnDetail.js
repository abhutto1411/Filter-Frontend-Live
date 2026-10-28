/**
 * Map supplier GET /supplier/affiliated-sales-returns/:id response to
 * WorkshopPurchaseReturnDetailView detail shape.
 */
export function mapSupplierAffiliatedReturnForView(apiRes) {
    const row = apiRes?.salesReturn;
    if (!row || typeof row !== 'object') return null;

    const linked = Array.isArray(row.workshopSupplierPurchaseReturns)
        ? row.workshopSupplierPurchaseReturns[0]
        : null;

    const sourceItems = linked?.items?.length ? linked.items : row.items;
    const items = (Array.isArray(sourceItems) ? sourceItems : []).map((item) => {
        const invoiceLine =
            item.invoiceLine ||
            item.invoice_line ||
            item.sourceSupplierInvoiceItem ||
            null;
        const qty = Number(item.qty ?? item.qtyReturned ?? 0);
        const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
        const taxAmount = Number(item.taxAmount ?? item.vatAmount ?? item.tax_amount ?? 0);
        const total = Number(item.total ?? item.lineTotal ?? item.line_total ?? qty * unitPrice + taxAmount);
        const uom = item.uom || item.unit || invoiceLine?.unit || null;
        const workshopUnit = item.workshopUnit ?? invoiceLine?.workshopUnit ?? null;
        const invoiceQty = invoiceLine?.qty != null ? Number(invoiceLine.qty) : null;
        const invoiceQtyWorkshop =
            invoiceLine?.qtyWorkshop != null ? Number(invoiceLine.qtyWorkshop) : null;
        let qtyWorkshop = item.qtyWorkshop != null ? Number(item.qtyWorkshop) : null;
        if (
            qtyWorkshop == null &&
            invoiceQty != null &&
            invoiceQty > 0 &&
            invoiceQtyWorkshop != null &&
            invoiceQtyWorkshop > 0 &&
            qty > 0
        ) {
            qtyWorkshop = Math.round((qty / invoiceQty) * invoiceQtyWorkshop * 1000) / 1000;
        }
        return {
            id: item.id != null ? String(item.id) : undefined,
            itemName:
                item.itemName ||
                item.productName ||
                invoiceLine?.productName ||
                '—',
            uom,
            unit: uom,
            qty,
            qtyWorkshop,
            workshopUnit,
            unitPrice,
            taxCode: item.taxCode || item.tax_code || 'VAT 15%',
            taxAmount,
            total,
            reason: item.reason ?? null,
        };
    });

    const issueDate =
        row.returnDate instanceof Date
            ? row.returnDate.toISOString().slice(0, 10)
            : row.returnDate
              ? String(row.returnDate).slice(0, 10)
              : null;

    return {
        returnNumber: row.returnNo || row.returnNumber || '—',
        issueDate,
        reference: row.invoice?.invoiceNo || row.reference || null,
        description: row.notes || row.description || null,
        status: row.status || 'pending',
        subtotal: Number(row.subtotal ?? 0),
        taxAmount: Number(row.vatAmount ?? row.taxAmount ?? 0),
        grandTotal: Number(row.grandTotal ?? 0),
        qrToken: linked?.qrToken ?? row.qrToken ?? null,
        approvedAt: linked?.approvedAt ?? row.approvedAt ?? null,
        qrConfirmedAt: linked?.qrConfirmedAt ?? row.qrConfirmedAt ?? null,
        finalizedAt: linked?.finalizedAt ?? row.finalizedAt ?? null,
        supplier: row.supplier
            ? {
                  id: row.supplier.id != null ? String(row.supplier.id) : undefined,
                  name: row.supplier.name,
                  vatId: row.supplier.vatId ?? null,
              }
            : null,
        workshop: row.workshop
            ? {
                  name: row.workshop.name,
                  vatId: row.workshop.taxId ?? row.workshop.vatId ?? null,
                  currencyCode: row.workshop.currencyCode ?? 'SAR',
              }
            : null,
        branch: row.branch
            ? {
                  id: row.branch.id != null ? String(row.branch.id) : undefined,
                  name: row.branch.name,
                  vatId: row.branch.vatId ?? null,
              }
            : null,
        sourcePurchaseInvoiceNumber: row.invoice?.invoiceNo ?? null,
        supplierSalesReturnNo: row.returnNo || null,
        linkedPurchaseReturnNo: linked?.returnNumber ?? null,
        items,
    };
}
