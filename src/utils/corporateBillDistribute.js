/**
 * CORPORATE-FIX-02-CLOSING F3/F4/F6: pure helpers for the Distribute panel
 * (no JSX so they run under node --test).
 */
import { toRiyadhDateISO } from './riyadhBusinessRange.js';

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** F3: payout date default = today in Asia/Riyadh. */
export function distributeTodayYmd(now = new Date()) {
    return toRiyadhDateISO(now);
}

/** F6: the exact allocations payload the panel posts. */
export function buildDistributeAllocations(dialog) {
    return (dialog?.rows || [])
        .filter((r) => r2(r.amount) > 0.005)
        .map((r) => ({
            workshopId: String(r.workshopId),
            amount: r2(r.amount),
            hqCashBankAccountId: String(dialog.hqAccount || ''),
            workshopCashBankAccountId: String(r.wsAccount || ''),
        }));
}

/** Σ amounts in the dialog (2 dp). */
export function distributeTotal(dialog) {
    return r2((dialog?.rows || []).reduce((s, r) => s + r2(r.amount), 0));
}

/**
 * F4: block Confirm when the HQ pay-from balance cannot cover Σ and the
 * FIX-03 negative-balance toggle is OFF (no such toggle exists yet → OFF).
 */
/**
 * Shortfall of the picked HQ register. allowNegative does not hide the gap;
 * it only decides whether Confirm stays enabled (see payoutConfirmState).
 * shortfall is the positive 2 dp gap, or 0 when the register covers the total.
 */
export function payoutShortfall({ balance, total } = {}) {
    if (balance == null || balance === '' || !Number.isFinite(Number(balance))) return 0;
    const gap = Math.round(Number(total || 0) * 100) - Math.round(Number(balance) * 100);
    return gap > 0 ? gap / 100 : 0;
}

export function hqBalanceBlocks({ balance, total, allowNegative = false }) {
    if (allowNegative) return false;
    if (balance == null || balance === '') return false; // unknown → backend decides
    return Math.round(Number(balance) * 100) < Math.round(Number(total || 0) * 100);
}

/** Backend error code → i18n key (EN/AR in corporateFix02I18n). */
export function distributeErrorKey(err) {
    const code = String(err?.code || err?.body?.code || '');
    if (code === 'REMITTANCE_EXCEEDS_SHARE') return 'payout.exceeds';
    const reason = String(err?.reason || err?.body?.reason || '');
    if (reason === 'SHARED_COA_PEER_OFF') return 'payout.peerOff';
    if (reason === 'REGISTER_OFF' || code === 'INSUFFICIENT_FUNDS') return 'payout.insufficient';
    // FINAL F5: the other backend codes on these screens.
    if (code === 'BILL_CHANGED') return 'err.billChanged';
    if (code === 'CORP_COST_ACCOUNT_CONFLICT') return 'err.corpCostConflict';
    if (code === 'CORP_COST_ACCOUNT_MISSING') return 'err.corpCostMissing';
    return null;
}

/**
 * FINAL F2 (pure): Confirm state of the HQ payout dialog. No silent
 * defaults — Confirm stays disabled until every pick and amount is valid.
 * Returns { disabled, reasonKey } (reasonKey = i18n key or null).
 */
export function payoutConfirmState({
    hqPickedId,
    hqBalance,
    total,
    allowNegative = false,
    rows,
    posting = false,
    loading = false,
} = {}) {
    if (posting || loading) return { disabled: true, reasonKey: 'payout.reason.busy' };
    if (!String(hqPickedId ?? '').trim()) return { disabled: true, reasonKey: 'payout.reason.pickHq' };
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length || list.some((r) => !String(r?.wsAccount ?? '').trim())) {
        return { disabled: true, reasonKey: 'payout.reason.pickWs' };
    }
    const badAmount = list.some((r) => {
        const cents = Math.round(Number(r?.amount) * 100);
        if (!Number.isFinite(cents) || cents <= 0) return true;
        return cents > Math.round(Number(r?.payableNow || 0) * 100);
    });
    if (badAmount) return { disabled: true, reasonKey: 'payout.reason.amount' };
    if (hqBalanceBlocks({ balance: hqBalance, total, allowNegative })) {
        return { disabled: true, reasonKey: 'payout.insufficient' };
    }
    return { disabled: false, reasonKey: null };
}

/** FINAL F2: balance not known yet → hint that the backend checks it. */
export function balanceUnknown(balance) {
    return balance == null || balance === '' || !Number.isFinite(Number(balance));
}

/** FINAL F3/F4: a workshop's registers → FIX-03 picker options (live balance). */
export function payFromOptions(banks, kindLabel) {
    return (Array.isArray(banks) ? banks : []).map((b) => ({
        id: String(b.id),
        name: b.name,
        balance: Number(b.availableBalance ?? 0),
        branchId: '',
        branchName: '',
        kind: 'OPERATING',
        kindLabel: kindLabel ? kindLabel(b) : String(b.type || ''),
        type: b.type || '',
    }));
}
