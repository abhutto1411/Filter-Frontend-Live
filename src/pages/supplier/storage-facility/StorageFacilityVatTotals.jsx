import React from 'react';
import { STORAGE_VAT_RATE, computeStorageTotals } from './storageFacilityTotals';
import { useSfT } from './useSfT';
import { sfMoney } from './sfFormat';
import '../../../styles/ui.css';

/**
 * The VAT inclusive / exclusive switch and the live totals under a line grid.
 */
export default function StorageFacilityVatTotals({
    lines,
    amountsTaxInclusive,
    onAmountsTaxInclusiveChange,
    unitFieldLabel,
    footerHint = '',
}) {
    const t = useSfT();
    const fieldLabel = unitFieldLabel || t('sfx.uom.label');
    const totals = computeStorageTotals(
        lines.map((ln) => ({ qty: ln.qty, unitAmount: ln.unitAmount })),
        amountsTaxInclusive,
    );

    const hasAmounts =
        totals.grandTotal > 0 ||
        lines.some((ln) => {
            const q = Number(ln.qty);
            const u = Number(ln.unitAmount);
            return q > 0 && Number.isFinite(u) && u > 0;
        });

    const pct = Math.round(STORAGE_VAT_RATE * 100);

    return (
        // It sits inside portalled modals, so it declares the tokens itself.
        <div className="ui-stack-sm ui-tokens">
            <label className="ui-switch ui-switch--row">
                <input
                    type="checkbox"
                    checked={amountsTaxInclusive}
                    onChange={(e) => onAmountsTaxInclusiveChange(e.target.checked)}
                />
                <span className="ui-switch-name">
                    {amountsTaxInclusive
                        ? t('sfx.vat.inclusive', { pct })
                        : t('sfx.vat.exclusive', { pct })}
                </span>
                <span className="ui-switch-track" />
            </label>

            <p className="ui-help">
                {amountsTaxInclusive
                    ? t('sfx.vat.hintInclusive', { field: fieldLabel })
                    : t('sfx.vat.hintExclusive', { field: fieldLabel, pct })}
            </p>

            {hasAmounts ? (
                <div className="ui-panel ui-panel-pad">
                    <div className="ui-sum">
                        <div className="ui-sum-row">
                            <span>{t('sfx.vat.subtotal')}</span>
                            <span>{sfMoney(t, totals.subtotal)}</span>
                        </div>
                        <div className="ui-sum-row">
                            <span>{t('sfx.vat.amount', { pct })}</span>
                            <span>{sfMoney(t, totals.vatAmount)}</span>
                        </div>
                        <div className="ui-sum-sep" />
                        <div className="ui-sum-row ui-sum-row--total">
                            <span>{t('sfx.vat.total')}</span>
                            <span>{sfMoney(t, totals.grandTotal)}</span>
                        </div>
                    </div>
                    {footerHint ? <p className="ui-help">{footerHint}</p> : null}
                </div>
            ) : (
                <p className="ui-meta">{t('sfx.vat.empty')}</p>
            )}
        </div>
    );
}
