import {
    buildBnplSettlementControlUrl,
    buildCorporateArControlUrl,
    buildMonitorLedgerUrl,
    isBnplSettlementControlAccount,
    isCorporateArControlAccount,
} from './saAccountingDateRange';

function accountCode(account) {
    return String(account?.code ?? '').trim();
}

export function isSoftPosSettlementReceivableAccount(account) {
    return accountCode(account) === '1320';
}

export function isMarketingWalletAccount(account) {
    return accountCode(account) === '1330';
}

export function isReferralCommissionPayableAccount(account) {
    return accountCode(account) === '2210';
}

export function isMarketingPromotionPayableAccount(account) {
    return accountCode(account) === '2215';
}

export function isSalaryAdvancesAccount(account) {
    return accountCode(account) === '1250';
}

/** Detail cash/bank COA rows that map to Cash & Bank registers (not heading 1000/1010). */
export function isCashOrBankCoaAccount(account) {
    const code = accountCode(account);
    if (!code || code === '1000' || code === '1010') return false;
    if (code === '1004') return false;
    if (/^100\d/i.test(code)) return true;
    if (/^101\d/i.test(code)) return true;
    return false;
}

function withDateParams(basePath, dateRange, extra = {}) {
    const params = new URLSearchParams();
    if (dateRange?.dateFrom) params.set('dateFrom', dateRange.dateFrom);
    if (dateRange?.dateTo) params.set('dateTo', dateRange.dateTo);
    for (const [key, value] of Object.entries(extra)) {
        if (value != null && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ''}`;
}

/**
 * HQ Chart of Accounts row navigation — control registers vs generic ledger.
 */
export function buildHqCoaNavigationUrl(account, dateRange) {
    if (isCorporateArControlAccount(account)) {
        return buildCorporateArControlUrl(dateRange);
    }
    if (isBnplSettlementControlAccount(account)) {
        return buildBnplSettlementControlUrl(dateRange);
    }
    if (isSoftPosSettlementReceivableAccount(account)) {
        return withDateParams('/admin/softpos-settlement', dateRange, { tab: 'hqsettlement' });
    }
    if (isMarketingWalletAccount(account)) {
        return '/admin/marketing/marketing-wallet';
    }
    if (isReferralCommissionPayableAccount(account)) {
        return withDateParams('/admin/accounting/commissions', dateRange);
    }
    if (isMarketingPromotionPayableAccount(account)) {
        return withDateParams('/admin/marketing/marketing-promotions', dateRange);
    }
    if (isSalaryAdvancesAccount(account)) {
        return withDateParams('/admin/accounting/advances', dateRange);
    }
    if (isCashOrBankCoaAccount(account)) {
        return withDateParams('/admin/accounting/cash-bank', dateRange, {
            coaAccountId: account.id,
        });
    }
    return buildMonitorLedgerUrl(String(account.id), account, dateRange);
}

export const HQ_COA_CONTROL_BADGES = {
    1110: { label: 'Control', background: '#EDE9FE', color: '#5B21B6' },
    1300: { label: 'BNPL', background: '#DBEAFE', color: '#1D4ED8' },
    1320: { label: 'SoftPOS', background: '#E0E7FF', color: '#4338CA' },
    1330: { label: 'Marketing', background: '#FCE7F3', color: '#9D174D' },
    1250: { label: 'Advances', background: '#FFEDD5', color: '#C2410C' },
    2210: { label: 'Referral', background: '#F3E8FF', color: '#7C3AED' },
    2215: { label: 'Promotions', background: '#FEF3C7', color: '#B45309' },
};
