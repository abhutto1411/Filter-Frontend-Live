/** CORPORATE-FIX-02 G2: client-side mirror of the backend REMITTANCE_EXCEEDS_SHARE cap. */
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export function payoutWithinShare(row, amount) {
    const a = r2(amount);
    return a > 0 && a <= r2(row?.payableNow) + 0.005;
}
