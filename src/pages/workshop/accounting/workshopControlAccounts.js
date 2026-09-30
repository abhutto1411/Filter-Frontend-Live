/** Workshop AP/AR/Employee control accounts — party field next to the COA combo. */

export const WORKSHOP_CONTROL_KINDS = {
    AP_AFFILIATED: 'ap_affiliated',
    AP_LOCAL: 'ap_local',
    AR_CORPORATE: 'ar_corporate',
    AR_TRADE: 'ar_trade',
    EMPLOYEE_ADVANCES: 'employee_advances',
    EMPLOYEE_COMMISSION: 'employee_commission',
};

const KIND_SET = new Set(Object.values(WORKSHOP_CONTROL_KINDS));

const SEED_TO_KIND = {
    AP_AFFILIATED_SUPPLIERS: WORKSHOP_CONTROL_KINDS.AP_AFFILIATED,
    AP_LOCAL_SUPPLIERS: WORKSHOP_CONTROL_KINDS.AP_LOCAL,
    AR_CORPORATE: WORKSHOP_CONTROL_KINDS.AR_CORPORATE,
    AR_TRADE: WORKSHOP_CONTROL_KINDS.AR_TRADE,
    EMPLOYEE_ADVANCES: WORKSHOP_CONTROL_KINDS.EMPLOYEE_ADVANCES,
    COMMISSION_PAYABLE: WORKSHOP_CONTROL_KINDS.EMPLOYEE_COMMISSION,
};

export function controlKindFromSeedKey(seedKey) {
    const key = String(seedKey || '').trim();
    return SEED_TO_KIND[key] || null;
}

/** API returns normalized kinds (ap_local); never remap those through seed keys. */
export function controlKindFromApiValue(value) {
    const v = String(value || '').trim();
    if (KIND_SET.has(v)) return v;
    return controlKindFromSeedKey(v);
}

export function controlKindFromCode(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return null;
    if (c === '1250' || /^1250-E\d+$/.test(c)) return WORKSHOP_CONTROL_KINDS.EMPLOYEE_ADVANCES;
    if (c === '2200' || /^2200-E\d+$/.test(c) || /^2200-ER\d+$/.test(c)) {
        return WORKSHOP_CONTROL_KINDS.EMPLOYEE_COMMISSION;
    }
    return null;
}

export function controlKindFromName(name) {
    const n = String(name || '').toLowerCase();
    if (!n) return null;
    if (
        n.includes('accrued commission')
        || (n.includes('commission') && n.includes('payable'))
    ) {
        return WORKSHOP_CONTROL_KINDS.EMPLOYEE_COMMISSION;
    }
    if (
        n.includes('salary advance')
        || (n.includes('advances receivable') && n.includes('employee'))
    ) {
        return WORKSHOP_CONTROL_KINDS.EMPLOYEE_ADVANCES;
    }
    const payable = n.includes('payable') || /\bap\b/.test(n);
    const receivable = n.includes('receivable') || /\bar\b/.test(n);
    if (payable) {
        if (
            n.includes('non-affil')
            || n.includes('non affil')
            || n.includes('nonaffil')
            || n.includes('local supplier')
        ) {
            return WORKSHOP_CONTROL_KINDS.AP_LOCAL;
        }
        if (n.includes('affil')) return WORKSHOP_CONTROL_KINDS.AP_AFFILIATED;
    }
    if (receivable) {
        if (n.includes('corporate')) return WORKSHOP_CONTROL_KINDS.AR_CORPORATE;
        if (n.includes('trade') || n.includes('walk')) return WORKSHOP_CONTROL_KINDS.AR_TRADE;
    }
    return null;
}

/** Per-party COA children carry tags like `local-supplier:7` in description. */
export function controlKindFromDescription(description) {
    const d = String(description || '').toLowerCase();
    if (!d) return null;
    if (d.includes('employee-advance:')) return WORKSHOP_CONTROL_KINDS.EMPLOYEE_ADVANCES;
    if (
        d.includes('employee-commission:')
        || d.includes('employee-commission-record:')
    ) {
        return WORKSHOP_CONTROL_KINDS.EMPLOYEE_COMMISSION;
    }
    if (d.includes('local-supplier:') || d.includes('local_supplier:')) {
        return WORKSHOP_CONTROL_KINDS.AP_LOCAL;
    }
    if (d.includes('affiliated-supplier:') || d.includes('affiliated_supplier:')) {
        return WORKSHOP_CONTROL_KINDS.AP_AFFILIATED;
    }
    if (d.includes('corporate-ar:') || d.includes('corporate_ar:') || d.includes('corp-ar:')) {
        return WORKSHOP_CONTROL_KINDS.AR_CORPORATE;
    }
    if (d.includes('trade-ar:') || d.includes('walkin-ar:') || d.includes('walk-in-ar:')) {
        return WORKSHOP_CONTROL_KINDS.AR_TRADE;
    }
    return null;
}

/**
 * Resolve control kind for the party (Customer/Supplier/Employee) column.
 * @param {object|null} account
 * @param {object[]} [accounts] optional COA list for parentId inheritance
 */
export function controlKind(account, accounts = []) {
    if (!account) return null;

    const direct = controlKindFromApiValue(account.controlKind)
        || controlKindFromSeedKey(account.seedKey)
        || controlKindFromCode(account.code)
        || controlKindFromDescription(account.description)
        || controlKindFromName(account.name || account.label);
    if (direct) return direct;

    const parentId = account.parentId;
    if (parentId == null || !Array.isArray(accounts) || accounts.length === 0) return null;
    const parent = accounts.find((a) => String(a.id) === String(parentId));
    if (!parent) return null;
    // One hop only — avoid recursion loops on bad parent chains.
    return controlKindFromApiValue(parent.controlKind)
        || controlKindFromSeedKey(parent.seedKey)
        || controlKindFromCode(parent.code)
        || controlKindFromDescription(parent.description)
        || controlKindFromName(parent.name || parent.label)
        || null;
}

export function accountById(accounts, accountId) {
    if (!accountId) return null;
    return (accounts || []).find((a) => String(a.id) === String(accountId)) || null;
}

export function payeeTypeForKind(kind) {
    if (kind === WORKSHOP_CONTROL_KINDS.AP_AFFILIATED || kind === WORKSHOP_CONTROL_KINDS.AP_LOCAL) {
        return 'Supplier';
    }
    if (kind === WORKSHOP_CONTROL_KINDS.AR_CORPORATE || kind === WORKSHOP_CONTROL_KINDS.AR_TRADE) {
        return 'Customer';
    }
    if (
        kind === WORKSHOP_CONTROL_KINDS.EMPLOYEE_ADVANCES
        || kind === WORKSHOP_CONTROL_KINDS.EMPLOYEE_COMMISSION
    ) {
        return 'Employee';
    }
    return null;
}

export function isCorporatePayee(payee) {
    if (!payee) return false;
    if (String(payee.customerKind || '').toLowerCase() === 'corporate') return true;
    return String(payee.id || '').startsWith('corp:');
}

export function partyOptionsForKind(kind, payees) {
    if (!kind) return [];
    if (kind === WORKSHOP_CONTROL_KINDS.AP_AFFILIATED) {
        return (payees?.supplier || []).filter(
            (p) => p.supplierKind === 'affiliated'
                || String(p.id || '').startsWith('affiliated:'),
        );
    }
    if (kind === WORKSHOP_CONTROL_KINDS.AP_LOCAL) {
        return (payees?.supplier || []).filter(
            (p) => p.supplierKind === 'local'
                || String(p.id || '').startsWith('local:'),
        );
    }
    if (kind === WORKSHOP_CONTROL_KINDS.AR_CORPORATE) {
        return (payees?.customer || []).filter(isCorporatePayee);
    }
    if (kind === WORKSHOP_CONTROL_KINDS.AR_TRADE) {
        return (payees?.customer || []).filter((p) => !isCorporatePayee(p));
    }
    if (
        kind === WORKSHOP_CONTROL_KINDS.EMPLOYEE_ADVANCES
        || kind === WORKSHOP_CONTROL_KINDS.EMPLOYEE_COMMISSION
    ) {
        return payees?.employee || [];
    }
    return [];
}

export function partyPayloadFromKind(kind, payeeId) {
    const key = String(payeeId || '').trim();
    if (!kind || !key) return {};
    const payeeType = payeeTypeForKind(kind);
    if (!payeeType) return {};
    return { payeeType, payeeId: key };
}

export function payeeIdFromJournalLine(line) {
    const key = String(line?.payeeKey || line?.payeeId || '').trim();
    if (key) return key;
    return '';
}
