const MONEY_2DP = /^[+-]?\d+\.\d{2}$/;

function text(value) {
    if (value == null) return '';
    return String(value).trim();
}

/**
 * Return deduction on a commission line, or null when the API sent none.
 * Amounts stay the 2-decimal strings the server sent.
 */
export function readReturnDeduction(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const returnedAmount = text(raw.returned_amount ?? raw.returnedAmount);
    const originalCommission = text(raw.original_commission ?? raw.originalCommission);
    const payableAfterReturn = text(raw.payable_after_return ?? raw.payableAfterReturn);
    if (returnedAmount === '' && originalCommission === '' && payableAfterReturn === '') return null;
    return { returnedAmount, originalCommission, payableAfterReturn };
}

/**
 * Fields added for return rows on GET /workshop-staff/commissions
 * (`items` and `history_items`).
 */
export function readCommissionLineExtras(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const returnDeduction = readReturnDeduction(src.return_deduction ?? src.returnDeduction);
    const amountRaw = src.amount;
    let amountDisplay = null;
    if (typeof amountRaw === 'string' && MONEY_2DP.test(amountRaw.trim())) {
        const label = amountRaw.trim();
        if (returnDeduction || label.startsWith('-')) amountDisplay = label;
    }
    const ref = src.job_card_ref ?? src.jobCardRef ?? '';
    return {
        service: src.service_name ?? src.serviceName ?? '',
        payoutNotes: text(src.payout_notes ?? src.payoutNotes),
        jobCardRef: ref == null ? '' : String(ref),
        returnDeduction,
        amountDisplay,
    };
}

export function commissionReturnSlip(row) {
    if (!row?.returnDeduction) return null;
    return {
        id: row.id,
        employee: row.employee || '',
        service: row.service || '',
        payoutNotes: row.payoutNotes || '',
        jobCardRef: row.jobCardRef || '',
        amountDisplay: row.amountDisplay || '',
        returnDeduction: row.returnDeduction,
    };
}
