/**
 * Commission type helpers for the rule form (Percentage vs Fixed SAR/unit).
 */

export const COMMISSION_TYPES = ['Percentage', 'Fixed'];
export const FIXED_VALUE_MAX = 100000;

/** Case-insensitive: anything not "fixed" → Percentage. */
export function normalizeCommissionType(raw) {
    return String(raw ?? '')
        .trim()
        .toLowerCase() === 'fixed'
        ? 'Fixed'
        : 'Percentage';
}

/**
 * Load type + profile flag from a saved rule.
 * Fixed always forces useProfilePercent off.
 */
export function commissionTypeFieldsFromRule(rule) {
    const commissionType = normalizeCommissionType(rule?.commissionType);
    const useProfilePercent =
        commissionType === 'Fixed' ? false : Boolean(rule?.useProfilePercent);
    return { commissionType, useProfilePercent };
}

/**
 * @returns {'' | 'percentage' | 'fixed' | 'negative'}
 */
export function commissionValueError(commissionType, value, useProfilePercent) {
    if (useProfilePercent) return '';
    const n = Number(value);
    if (value === '' || value == null || !Number.isFinite(n)) {
        return normalizeCommissionType(commissionType) === 'Fixed' ? 'fixed' : 'percentage';
    }
    if (n < 0) return 'negative';
    const type = normalizeCommissionType(commissionType);
    if (type === 'Fixed') {
        return n > FIXED_VALUE_MAX ? 'fixed' : '';
    }
    return n > 100 ? 'percentage' : '';
}

export function isCommissionValueValid(commissionType, value, useProfilePercent) {
    return commissionValueError(commissionType, value, useProfilePercent) === '';
}

/** i18n key for an invalid value: Percentage → 0–100; Fixed → 0–100000 (incl. negatives). */
export function commissionValueErrorKey(commissionType, value, useProfilePercent) {
    const kind = commissionValueError(commissionType, value, useProfilePercent);
    if (!kind) return '';
    const isFixed = normalizeCommissionType(commissionType) === 'Fixed';
    if (kind === 'fixed' || (kind === 'negative' && isFixed)) {
        return 'rules.err.fixedRange';
    }
    return 'rules.err.rateRange';
}

/** Profile % cannot combine with Fixed — force off when type is Fixed. */
export function applyCommissionTypeChange(prev, nextType) {
    const commissionType = normalizeCommissionType(nextType);
    if (commissionType === 'Fixed') {
        return { ...prev, commissionType, useProfilePercent: false };
    }
    return { ...prev, commissionType };
}

export function commissionTypePayload(commissionType, value, useProfilePercent) {
    const type = normalizeCommissionType(commissionType);
    const useProfile = type === 'Fixed' ? false : Boolean(useProfilePercent);
    const n = Number(value);
    return {
        commissionType: type,
        useProfilePercent: useProfile,
        value: useProfile ? 0 : Math.round(n * 10000) / 10000,
    };
}

/**
 * List/summary label for a rule's stored rate.
 * Fixed → money.sar + "per unit"; Percentage → "N%"; profile → profile label.
 */
export function formatCommissionRuleRate(rule, t) {
    if (!rule) return '—';
    if (rule.useProfilePercent && normalizeCommissionType(rule.commissionType) !== 'Fixed') {
        return t('rules.rate.profile');
    }
    const type = normalizeCommissionType(rule.commissionType);
    const n = Number(rule.value ?? 0);
    if (type === 'Fixed') {
        const amount = Number.isFinite(n) ? String(n) : '0';
        return t('rules.rate.fixedPerUnit', {
            money: t('money.sar', { amount }),
        });
    }
    return `${Number.isFinite(n) ? n : 0}%`;
}

/** Form summary rate chip while editing. */
export function formatCommissionFormRate(form, t) {
    if (!form) return '—';
    const type = normalizeCommissionType(form.commissionType);
    if (type !== 'Fixed' && form.useProfilePercent) return t('rules.rate.profile');
    if (!isCommissionValueValid(type, form.value, form.useProfilePercent)) return '—';
    const n = Number(form.value);
    if (type === 'Fixed') {
        return t('rules.rate.fixedPerUnit', {
            money: t('money.sar', { amount: String(n) }),
        });
    }
    return `${n}%`;
}
