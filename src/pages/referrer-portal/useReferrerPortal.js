import { useOutletContext } from 'react-router-dom';

export function useReferrerPortal() {
    return (
        useOutletContext() || {
            locale: 'en',
            setLocale: () => {},
            displayName: '',
            overview: null,
            overviewError: '',
            overviewLoading: false,
            reloadOverview: () => {},
            isCommunity: false,
        }
    );
}

export function isCommunityReferrer(overview) {
    return Boolean(overview?.profile?.isCommunity);
}

export function formatRuleValue(rule, kind = 'commission') {
    if (!rule) return '';
    const type = kind === 'benefit' ? rule.discountType : rule.commissionType;
    const value = kind === 'benefit' ? rule.discountValue : rule.value;
    const n = Number(value);
    const amount = Number.isFinite(n) ? n : 0;
    if (String(type || '').toLowerCase().includes('fix')) {
        return `${amount.toFixed(2)} SAR`;
    }
    return `${amount}%`;
}

export function rfBadgeClass(status) {
    return `rf-badge rf-badge-${String(status || '').toLowerCase()}`;
}

function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sumPayoutsByStatus(payouts, statuses) {
    const wanted = new Set(statuses);
    return money(
        (Array.isArray(payouts) ? payouts : []).reduce((sum, row) => {
            const status = String(row?.status || '').toLowerCase();
            if (!wanted.has(status)) return sum;
            return sum + Number(row?.amount || 0);
        }, 0),
    );
}

/**
 * Unpaid = total earned − pending payouts − paid payouts.
 * Prefer payout rows so approve/reject updates the wallet even if the API
 * does not yet send available / paidPayouts fields.
 */
export function referrerWalletFromOverview(overview = {}) {
    const stats = overview?.stats || {};
    const payouts = Array.isArray(overview?.payouts) ? overview.payouts : [];
    const earned = money(stats.commissionTotal);
    const pending = money(Math.max(
        money(stats.pendingPayouts),
        sumPayoutsByStatus(payouts, ['pending']),
    ));
    const paid = money(Math.max(
        money(stats.paidPayouts),
        sumPayoutsByStatus(payouts, ['paid', 'approved']),
    ));
    const unpaid = money(Math.max(0, earned - pending - paid));
    return { earned, pending, paid, unpaid, available: unpaid };
}

/** @deprecated use referrerWalletFromOverview */
export function referrerWalletFromStats(stats = {}, payouts = []) {
    return referrerWalletFromOverview({ stats, payouts });
}
