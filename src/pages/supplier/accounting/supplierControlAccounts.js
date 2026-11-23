export const SUPPLIER_CONTROL_SEEDS = {
    AR_AFFILIATED: 'AR_AFFILIATED',
    AR_NON_AFFILIATED: 'AR_NON_AFFILIATED',
    AP_SUPER_SUPPLIER: 'AP_SUPER_SUPPLIER',
};

const CONTROL_CODES = {
    AR_AFFILIATED: '1100',
    AR_NON_AFFILIATED: '1110',
    AP_SUPER_SUPPLIER: '2000',
};

export function isSupplierControlAccount(account) {
    const seed = String(account?.seedKey || '').trim();
    if (Object.values(SUPPLIER_CONTROL_SEEDS).includes(seed)) return true;
    const code = String(account?.code || '').trim();
    return code === '1100' || code === '1110' || code === '2000';
}

export function findSupplierControlAccount(accounts, seed) {
    const rows = (accounts || []).filter(Boolean);
    const bySeed = rows.find((a) => String(a.seedKey || '').trim() === seed);
    if (bySeed) return bySeed;
    const code = CONTROL_CODES[seed];
    const byCode = rows.find((a) => String(a.code || '').trim() === code);
    if (byCode) return byCode;
    const nameOf = (a) => String(a.name || '').toLowerCase();
    if (seed === 'AR_AFFILIATED') {
        return rows.find((a) => {
            const n = nameOf(a);
            return n.includes('receivable') && n.includes('affiliated') && !/non[-\s]?affiliated/.test(n);
        }) || null;
    }
    if (seed === 'AR_NON_AFFILIATED') {
        return rows.find((a) => {
            const n = nameOf(a);
            return n.includes('receivable') && /non[-\s]?affiliated/.test(n);
        }) || null;
    }
    return rows.find((a) => {
        const n = nameOf(a);
        return n.includes('payable') && n.includes('super');
    }) || null;
}

export function normalizePartyLabel(raw) {
    return String(raw || '')
        .toLowerCase()
        .replace(/non[-\s]?affiliated/g, ' ')
        .replace(/شركة|مؤسسة|workshop|branch/g, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function affiliatedLabelCollides(externalName, affiliatedNames) {
    const ext = normalizePartyLabel(externalName);
    if (!ext || ext.length < 4) return false;
    for (const raw of affiliatedNames || []) {
        const aff = normalizePartyLabel(raw);
        if (!aff || aff.length < 4) continue;
        if (ext === aff || ext.includes(aff) || aff.includes(ext)) return true;
    }
    return false;
}

export function againstAccountsForPicker(accounts) {
    return (accounts || []).filter((a) => {
        if (!a || a.isCashEquivalent) return false;
        if (String(a.status || 'active').toLowerCase() === 'inactive') return false;
        if (!a.hasChildren) return true;
        return isSupplierControlAccount(a);
    });
}
