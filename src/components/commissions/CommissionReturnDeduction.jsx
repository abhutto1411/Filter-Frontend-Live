import React from 'react';

function moneyLabel(amount, t) {
    const text = amount == null ? '' : String(amount).trim();
    if (!text) return t('emDash');
    return t('money.sar', { amount: text });
}

/**
 * Three labelled amounts for a commission return row.
 * Renders nothing when the line has no return deduction and no payout notes.
 */
export default function CommissionReturnDeduction({
    deduction = null,
    payoutNotes = '',
    jobCardRef = '',
    showReference = false,
    showNotes = true,
    t,
}) {
    if (!deduction && !(showNotes && payoutNotes)) return null;
    return (
        <div className="wcom-return-block">
            {deduction ? (
                <dl className="wcom-return">
                    <div>
                        <dt>{t('return.returnedAmount')}</dt>
                        <dd><bdi>{moneyLabel(deduction.returnedAmount, t)}</bdi></dd>
                    </div>
                    <div>
                        <dt>{t('return.originalCommission')}</dt>
                        <dd><bdi>{moneyLabel(deduction.originalCommission, t)}</bdi></dd>
                    </div>
                    <div>
                        <dt>{t('return.payableAfterReturn')}</dt>
                        <dd><bdi>{moneyLabel(deduction.payableAfterReturn, t)}</bdi></dd>
                    </div>
                    {showReference && jobCardRef ? (
                        <div>
                            <dt>{t('return.reference')}</dt>
                            <dd><bdi>{jobCardRef}</bdi></dd>
                        </div>
                    ) : null}
                </dl>
            ) : null}
            {showNotes && payoutNotes ? (
                <p className="wcom-notes">
                    {deduction ? <span className="wcom-notes__label">{t('return.notes')}: </span> : null}
                    {payoutNotes}
                </p>
            ) : null}
        </div>
    );
}
