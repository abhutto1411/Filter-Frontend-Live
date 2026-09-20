/**
 * How a workshop COA balance relates to VAT, from how journals actually post:
 *
 * Incl. VAT — cash, bank, tills, locker, AR (incl. corporate children), AP,
 *             POS/HQ settlement, petty-cash float (gross tender / invoice total).
 * Excl. VAT — revenue (posted pre-VAT), inventory, COGS, operating expenses, equity.
 * VAT — control accounts that hold tax only (1310 input, 2100 output).
 */

export const COA_VAT_BASIS = {
    INCL: 'incl',
    EXCL: 'excl',
    VAT: 'vat',
};

const SETTLEMENT_ASSET_CODES = new Set([1300, 1320, 1330, 1335, 1340, 1400]);
const SETTLEMENT_LIABILITY_CODES = new Set([2310, 2400, 2410, 2420]);

function rootCode(account) {
    const raw = String(account?.code ?? '').trim();
    if (!raw) return '';
    if (/^CB[-_]/i.test(raw)) return 'CB';
    return raw.split(/[-_]/)[0];
}

function numericRoot(account) {
    const n = Number.parseInt(rootCode(account), 10);
    return Number.isFinite(n) ? n : null;
}

function accountType(account) {
    return String(account?.type || '').toUpperCase();
}

export function vatBasisForCoaAccount(account) {
    if (account?.cashBankRegisterType) return COA_VAT_BASIS.INCL;

    const raw = String(account?.code ?? '').trim();
    if (/^CB[-_]/i.test(raw)) return COA_VAT_BASIS.INCL;

    const n = numericRoot(account);
    if (n == null) return COA_VAT_BASIS.EXCL;

    if (n === 1310 || n === 2100) return COA_VAT_BASIS.VAT;

    const t = accountType(account);
    // P&L / equity post net of VAT (or are not tax bases).
    if (t === 'INCOME' || t === 'EXPENSE' || t === 'EQUITY') return COA_VAT_BASIS.EXCL;

    if (/corporate-ar:\d+/i.test(String(account?.description || ''))) {
        return COA_VAT_BASIS.INCL;
    }

    // 1000–1099 cash / bank / locker / cashier tills (1020 was missed as 102x).
    if (n >= 1000 && n <= 1099) return COA_VAT_BASIS.INCL;
    // 1100–1149 AR trade + corporate + per-customer children (1111…), not 1150 variance.
    if (n >= 1100 && n <= 1149) return COA_VAT_BASIS.INCL;
    // Petty-cash float (1280, 1280-BR-*).
    if (n === 1280) return COA_VAT_BASIS.INCL;
    if (SETTLEMENT_ASSET_CODES.has(n)) return COA_VAT_BASIS.INCL;
    // 2000–2019 AP trade / affiliated / local + children.
    if (n >= 2000 && n <= 2019) return COA_VAT_BASIS.INCL;
    if (SETTLEMENT_LIABILITY_CODES.has(n)) return COA_VAT_BASIS.INCL;

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
