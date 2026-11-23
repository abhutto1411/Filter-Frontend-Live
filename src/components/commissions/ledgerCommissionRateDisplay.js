/**
 * Ledger rate cell from API `rule_commission_type` + `rate_percent`.
 * Fixed lines must not show a misleading derived % (often 0%).
 *
 * @param {{
 *   ruleCommissionType?: unknown,
 *   ratePercent?: unknown,
 * }} args
 * @returns {{ text: string | null, titleKey: string | null }}
 */
export function ledgerCommissionRateDisplay({ ruleCommissionType, ratePercent }) {
    const raw =
        ruleCommissionType == null ? '' : String(ruleCommissionType).trim().toLowerCase();
    if (raw === 'fixed') {
        return { text: '-', titleKey: 'ledger.rate.fixedTitle' };
    }
    const rateNum = ratePercent;
    const text =
        rateNum != null && !Number.isNaN(Number(rateNum)) ? `${Number(rateNum)}%` : null;
    return { text, titleKey: null };
}
