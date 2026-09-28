import React from 'react';
import { STORAGE_VAT_RATE, computeStorageTotals } from './storageFacilityTotals';

function fmtSar(n) {
    return `SAR ${Number(n || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/**
 * VAT inclusive/exclusive toggle + live totals strip.
 */
export default function StorageFacilityVatTotals({
    lines,
    amountsTaxInclusive,
    onAmountsTaxInclusiveChange,
    unitFieldLabel = 'Unit price',
    footerHint = '',
}) {
    const totals = computeStorageTotals(
        lines.map((ln) => ({
            qty: ln.qty,
            unitAmount: ln.unitAmount,
        })),
        amountsTaxInclusive,
    );

    const hasAmounts = totals.grandTotal > 0 || lines.some((ln) => {
        const q = Number(ln.qty);
        const u = Number(ln.unitAmount);
        return q > 0 && Number.isFinite(u) && u > 0;
    });

    const vatPct = Math.round(STORAGE_VAT_RATE * 100);

    return (
        <div className="sf-vat-totals-block">
            <label className="sf-vat-toggle">
                <div className="sf-vat-toggle-row">
                    <input
                        type="checkbox"
                        checked={amountsTaxInclusive}
                        onChange={(e) => onAmountsTaxInclusiveChange(e.target.checked)}
                    />
                    <span className="sf-vat-toggle-text">
                        {amountsTaxInclusive ? (
                            <>
                                Prices are <strong>inclusive</strong> of VAT ({vatPct}%)
                            </>
                        ) : (
                            <>
                                Prices are <strong>exclusive</strong> of VAT ({vatPct}%)
                            </>
                        )}
                    </span>
                </div>
                <span className="sf-vat-toggle-hint">
                    {amountsTaxInclusive
                        ? `${unitFieldLabel} includes VAT — subtotal and VAT are derived below`
                        : `${unitFieldLabel} excludes VAT — ${vatPct}% VAT is added to the subtotal below`}
                </span>
            </label>

            {hasAmounts ? (
                <div className="sf-doc-totals sf-doc-totals--live">
                    <div className="sf-bulk-totals-row">
                        <span>Subtotal (ex VAT)</span>
                        <strong>{fmtSar(totals.subtotal)}</strong>
                    </div>
                    <div className="sf-bulk-totals-row">
                        <span>VAT ({vatPct}%)</span>
                        <strong>{fmtSar(totals.vatAmount)}</strong>
                    </div>
                    <div className="sf-bulk-totals-row sf-bulk-totals-row--grand">
                        <span>Total (incl. VAT)</span>
                        <strong>{fmtSar(totals.grandTotal)}</strong>
                    </div>
                    {footerHint ? (
                        <p className="sf-vat-totals-foot">{footerHint}</p>
                    ) : null}
                </div>
            ) : (
                <p className="sf-vat-totals-empty">
                    Enter quantity and {unitFieldLabel.toLowerCase()} on lines to see totals.
                </p>
            )}
        </div>
    );
}

export { computeStorageTotals, fmtSar };
