import assert from 'node:assert/strict';
import {
    COA_VAT_BASIS,
    vatBasisForCoaAccount,
    vatBasisHintKey,
    vatBasisI18nKey,
} from './workshopCoaVatBasis.js';

// POS sales, inventory and COGS — posted net of VAT.
assert.equal(vatBasisForCoaAccount({ code: '4000', type: 'INCOME' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '4010', type: 'INCOME' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '1200', type: 'ASSET' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '5000', type: 'EXPENSE' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '4010-BR-5' }), COA_VAT_BASIS.EXCL);

// Everything else — no tag.
for (const code of [
    '1000', '1000-BR-5', 'CB-3-1', '1020', '1100', '1110', '1250', '1280', '1300', '1310',
    '2000', '2010', '2100', '2200', '2310', '3000', '4500', '4510', '4700', '6100', '7001',
    '12000', '40100', '',
]) {
    assert.equal(vatBasisForCoaAccount({ code }), null, code);
}
assert.equal(vatBasisForCoaAccount({ code: '9999', cashBankRegisterType: 'CASH' }), null);
assert.equal(vatBasisForCoaAccount(null), null);

assert.equal(vatBasisI18nKey(COA_VAT_BASIS.EXCL), 'coa.vat.excl');
assert.equal(vatBasisHintKey(COA_VAT_BASIS.EXCL), 'coa.vat.exclHint');

console.log('workshopCoaVatBasis.test.mjs ok');
