/** Same ±0.05 epsilon as backend generated-bill settlement. */
export const CORPORATE_BILL_PAY_EPS = 0.05;

export function roundCorporateBillMoney(n) {
    return Math.round(Number(n) * 100) / 100;
}

export function parseCorporateReceivedAmount(raw) {
    if (raw == null || raw === '') return Number.NaN;
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(n)) return Number.NaN;
    return roundCorporateBillMoney(n);
}

/** @returns {'partially_paid' | 'paid' | 'overpaid'} */
export function classifyCorporateBillPayment(due, received) {
    const d = roundCorporateBillMoney(due);
    const r = roundCorporateBillMoney(received);
    if (r + CORPORATE_BILL_PAY_EPS < d) return 'partially_paid';
    if (r > d + CORPORATE_BILL_PAY_EPS) return 'overpaid';
    return 'paid';
}

export function remainingAfterCorporateReceipt(due, received) {
    const d = roundCorporateBillMoney(due);
    const r = roundCorporateBillMoney(received);
    return Math.max(0, roundCorporateBillMoney(d - Math.min(r, d)));
}
