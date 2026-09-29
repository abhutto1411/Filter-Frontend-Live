import assert from 'node:assert/strict';
import {
    COA_VAT_BASIS,
    vatBasisForCoaAccount,
    vatBasisHintKey,
    vatBasisI18nKey,
} from './workshopCoaVatBasis.js';

assert.equal(vatBasisForCoaAccount({ code: '1000' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '1000-BR-5' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: 'CB-3-1' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '1100' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '1110' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '1113', type: 'ASSET' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '1020', type: 'ASSET' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '1004' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '1340', type: 'ASSET' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({
    code: '1111',
    type: 'ASSET',
    description: 'corporate-ar:15',
}), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '1280' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '1280-BR-3' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '1300' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '2001' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '2010' }), COA_VAT_BASIS.INCL);
assert.equal(vatBasisForCoaAccount({ code: '9999', cashBankRegisterType: 'CASH' }), COA_VAT_BASIS.INCL);

assert.equal(vatBasisForCoaAccount({ code: '1310' }), COA_VAT_BASIS.VAT);
assert.equal(vatBasisForCoaAccount({ code: '2100' }), COA_VAT_BASIS.VAT);
assert.equal(vatBasisForCoaAccount({ code: '2100-BR-1' }), COA_VAT_BASIS.VAT);

assert.equal(vatBasisForCoaAccount({ code: '4000' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '4010' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '1200' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '5000' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '6100' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '3000' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '1150' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '1150', type: 'EXPENSE' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '1250' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '2200' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '4000', type: 'INCOME' }), COA_VAT_BASIS.EXCL);
assert.equal(vatBasisForCoaAccount({ code: '2310', type: 'LIABILITY' }), COA_VAT_BASIS.INCL);

assert.equal(vatBasisI18nKey(COA_VAT_BASIS.INCL), 'coa.vat.incl');
assert.equal(vatBasisHintKey(COA_VAT_BASIS.EXCL), 'coa.vat.exclHint');

console.log('workshopCoaVatBasis.test.mjs ok');
