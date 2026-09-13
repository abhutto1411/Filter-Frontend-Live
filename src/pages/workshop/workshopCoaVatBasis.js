/**
 * How a workshop COA balance relates to VAT, from how journals actually post:
 *
 * Incl. VAT — cash, bank, AR, AP, POS settlement (gross tender / invoice total).
 * Excl. VAT — revenue (posted pre-VAT), inventory, COGS, operating expenses, equity.
 * VAT — control accounts that hold tax only (1310 input, 2100 output).
 */

export const COA_VAT_BASIS = {
    INCL: 'incl',
    EXCL: 'excl',
    VAT: 'vat',
};

function rootCode(account) {
    const raw = String(account?.code ?? '').trim();
    if (!raw) return '';
    if (/^CB[-_]/i.test(raw)) return 'CB';
    return raw.split(/[-_]/)[0];
}

export function vatBasisForCoaAccount(account) {
    if (account?.cashBankRegisterType) return COA_VAT_BASIS.INCL;

    const raw = String(account?.code ?? '').trim();
    if (/^CB[-_]/i.test(raw)) return COA_VAT_BASIS.INCL;

    const root = rootCode(account);
    if (!root) return COA_VAT_BASIS.EXCL;

    if (root === '1310' || root === '2100') return COA_VAT_BASIS.VAT;

    // Cash / bank / locker / cashier tills (100x, 101x)
    if (/^100\d$/.test(root) || /^101\d$/.test(root)) return COA_VAT_BASIS.INCL;

    // AR, petty-cash float, POS/SoftPOS settlement, marketing wallet, AP
    if (
        root === '1100'
        || root === '1110'
        || root === '1280'
        || root === '1300'
        || root === '1320'
        || root === '1330'
        || root === '2000'
        || root === '2001'
        || root === '2010'
    ) {
        return COA_VAT_BASIS.INCL;
    }

    return COA_VAT_BASIS.EXCL;
}

export function vatBasisI18nKey(basis) {
    if (basis === COA_VAT_BASIS.INCL) return 'coa.vat.incl';
    if (basis === COA_VAT_BASIS.VAT) return 'coa.vat.vat';
    return 'coa.vat.excl';
}

export function vatBasisHintKey(basis) {
    if (basis === COA_VAT_BASIS.INCL) return 'coa.vat.inclHint';
    if (basis === COA_VAT_BASIS.VAT) return 'coa.vat.vatHint';
    return 'coa.vat.exclHint';
}
