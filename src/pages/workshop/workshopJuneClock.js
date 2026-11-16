/** Locked June 2026 identities (ex-VAT). Do not invent replacements. */

export function money2HalfUp(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function assembleDocumentNet(grossExVat, completedReturnsExVat) {
    return money2HalfUp(
        money2HalfUp(grossExVat) - money2HalfUp(completedReturnsExVat),
    );
}

export function assembleClockBridgeGap(reportsNet, dashboardIssuedAtNet) {
    return money2HalfUp(
        money2HalfUp(reportsNet) - money2HalfUp(dashboardIssuedAtNet),
    );
}

export function assembleDocumentDiscounts(line, invoice, promo) {
    return money2HalfUp(
        money2HalfUp(line) + money2HalfUp(invoice) + money2HalfUp(promo),
    );
}

export function postedNetUnchangedByDocumentDiscounts(postedIncomeExVat) {
    return money2HalfUp(postedIncomeExVat);
}

export function assemblePostedIncomeFromDocuments({
    calendarGrossExVat,
    completedReturnsExVat,
    missingInvoiceJournalExVat,
} = {}) {
    const documentNet = assembleDocumentNet(
        calendarGrossExVat,
        completedReturnsExVat,
    );
    return money2HalfUp(
        documentNet -
            money2HalfUp(missingInvoiceJournalExVat) +
            money2HalfUp(completedReturnsExVat),
    );
}

