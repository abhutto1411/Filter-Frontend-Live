/**
 * CORPORATE-FIX-02-CLOSING F5/R3: distribution-preview payload built from the
 * same draft the bill save sends. The save carries each invoice at its live
 * remaining, capped at the edited inclusive amount; the backend preview
 * applies the same cap, and the edited excl/VAT go along as lineOverrides.
 */
const money2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export function buildDistributionPreviewPayload(draftLines, dirtyOverrides = []) {
    const invoices = (draftLines || [])
        .filter((l) => l?.invoiceId)
        .map((l) => ({ invoiceId: String(l.invoiceId), amount: money2(l.invoiceInclusiveVat) }));
    const lineOverrides = (dirtyOverrides || []).map((o) => ({
        invoiceId: String(o.invoiceId),
        invoiceExclVat: money2(o.invoiceExclVat),
        vat15: money2(o.vat15),
        invoiceInclusiveVat: money2(o.invoiceInclusiveVat),
    }));
    return { invoices, lineOverrides };
}
