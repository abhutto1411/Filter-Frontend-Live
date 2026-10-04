/**
 * VAT tag shown in the workshop COA — only on the accounts the POS sale journal
 * posts to (sales-journal.ts), all of which are booked net of VAT:
 *
 *   4000 Service Revenue / 4010 Product Revenue — Cr subtotal; VAT goes to 2100.
 *   1200 Inventory — Dr at ex-VAT cost on purchase (VAT to 1310), Cr ex-VAT cost on sale.
 *   5000 Cost of Goods Sold — Dr ex-VAT unit cost × qty.
 *
 * Every other account gets no tag.
 */

export const COA_VAT_BASIS = {
    EXCL: 'excl',
};

const POS_EXCL_VAT_CODES = new Set(['1200', '4000', '4010', '5000']);

function rootCode(account) {
    const raw = String(account?.code ?? '').trim();
    return raw ? raw.split(/[-_]/)[0] : '';
}

/** `'excl'` for POS sales / inventory / COGS accounts, otherwise `null` (no tag). */
export function vatBasisForCoaAccount(account) {
    if (account?.cashBankRegisterType) return null;
    return POS_EXCL_VAT_CODES.has(rootCode(account)) ? COA_VAT_BASIS.EXCL : null;
}

export function vatBasisI18nKey() {
    return 'coa.vat.excl';
}

export function vatBasisHintKey() {
    return 'coa.vat.exclHint';
}
