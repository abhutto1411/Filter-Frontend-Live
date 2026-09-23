/** Workshop AP/AR control accounts — party field next to the COA combo. */

export const WORKSHOP_CONTROL_KINDS = {
    AP_AFFILIATED: 'ap_affiliated',
    AP_LOCAL: 'ap_local',
    AR_CORPORATE: 'ar_corporate',
    AR_TRADE: 'ar_trade',
};

const SEED_TO_KIND = {
    AP_AFFILIATED_SUPPLIERS: WORKSHOP_CONTROL_KINDS.AP_AFFILIATED,
    AP_LOCAL_SUPPLIERS: WORKSHOP_CONTROL_KINDS.AP_LOCAL,
    AR_CORPORATE: WORKSHOP_CONTROL_KINDS.AR_CORPORATE,
    AR_TRADE: WORKSHOP_CONTROL_KINDS.AR_TRADE,
};

export function controlKindFromSeedKey(seedKey) {
    const key = String(seedKey || '').trim();
    return SEED_TO_KIND[key] || null;
}

export function controlKindFromName(name) {
    const n = String(name || '').toLowerCase();
    if (!n) return null;
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

export function controlKind(account) {
    if (!account) return null;
    const fromApi = controlKindFromSeedKey(account.controlKind) || controlKindFromSeedKey(account.seedKey);
    if (fromApi) return fromApi;
    return controlKindFromName(account.name || account.label);
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
        return (payees?.supplier || []).filter((p) => p.supplierKind === 'affiliated');
    }
    if (kind === WORKSHOP_CONTROL_KINDS.AP_LOCAL) {
        return (payees?.supplier || []).filter((p) => p.supplierKind === 'local');
    }
    if (kind === WORKSHOP_CONTROL_KINDS.AR_CORPORATE) {
        return (payees?.customer || []).filter(isCorporatePayee);
    }
    if (kind === WORKSHOP_CONTROL_KINDS.AR_TRADE) {
        return (payees?.customer || []).filter((p) => !isCorporatePayee(p));
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
