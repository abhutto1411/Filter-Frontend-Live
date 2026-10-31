import { useContext } from 'react';
import { createStableContext } from '../../utils/stableContext';
import { lockerT } from '../../utils/lockerPortalI18n';

/**
 * Locker pages read labels, money/date formatting and action gating from here.
 * The standalone `/locker` portal keeps every action except the `*.decide`
 * approvals for vault expenses and vault vouchers (locker users never approve
 * money leaving their own vault); the Workshop Admin mirror passes a
 * permission-based `can` (see `pages/workshop/lockerAccess.js`).
 */
const PORTAL_NEVER = new Set(['expenses.decide', 'vaultVouchers.decide']);
const PORTAL_DEFAULT_CAN = (action) => !PORTAL_NEVER.has(action);
const ALWAYS = () => true;

function formatAmount(n, minimumFractionDigits) {
    return Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits,
        maximumFractionDigits: 2,
    });
}

export function buildLockerPortalValue({
    locale = 'en',
    can = PORTAL_DEFAULT_CAN,
    canOpenTab = ALWAYS,
    embedded = false,
} = {}) {
    const t = (key, vars) => lockerT(locale, key, vars);
    const dateLocale = locale === 'ar' ? 'ar-SA' : undefined;
    return {
        locale,
        isRtl: locale === 'ar',
        embedded,
        t,
        can,
        canOpenTab,
        money: (n) => t('money.sar', { amount: formatAmount(n, 2) }),
        moneyWhole: (n) => t('money.sar', { amount: formatAmount(n, 0) }),
        dateTime: (iso) => {
            if (!iso) return t('emdash');
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return String(iso);
            return d.toLocaleString(dateLocale);
        },
        date: (iso) => {
            if (!iso) return t('emdash');
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return String(iso);
            return d.toLocaleDateString(dateLocale);
        },
        statusLabel: (status) => {
            const key = String(status || '').toLowerCase();
            if (!key) return t('emdash');
            const translated = t(`status.${key}`);
            return translated === `status.${key}` ? String(status).replace(/_/g, ' ') : translated;
        },
    };
}

export const LockerPortalContext = createStableContext('locker-portal', buildLockerPortalValue());

export function useLockerPortal() {
    return useContext(LockerPortalContext);
}
