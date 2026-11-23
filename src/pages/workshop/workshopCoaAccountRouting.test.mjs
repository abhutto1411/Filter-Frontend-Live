import assert from 'node:assert/strict';
import {
    buildWorkshopCoaAccountCreateUrl,
    buildWorkshopCoaAccountEditUrl,
    filterWorkshopPettyCashCoaList,
    isWorkshopCoaLedgerClickable,
    isWorkshopPettyCashCoaCollapsedChild,
    isWorkshopPettyCashCoaControlAccount,
    isWorkshopPettyCashLedgerAccount,
    parseWorkshopCoaAccountFormFromPath,
    pruneWorkshopPettyCashCoaTree,
} from './workshopCoaAccountRouting.js';
import { isCorporateArLedgerClickable } from '../admin/hqCoaAccountRouting.js';

assert.equal(isWorkshopPettyCashCoaControlAccount({ code: '1280' }), true);
assert.equal(isWorkshopPettyCashCoaControlAccount({ code: '6100' }), true);
assert.equal(isWorkshopPettyCashCoaControlAccount({ code: '1280-BR-5' }), false);

assert.equal(isWorkshopPettyCashCoaCollapsedChild({ code: '1280-BR-5' }), true);
assert.equal(isWorkshopPettyCashCoaCollapsedChild({ code: '1280-BR-5-E153' }), true);
assert.equal(isWorkshopPettyCashCoaCollapsedChild({ code: '6100-BR-6' }), true);
assert.equal(isWorkshopPettyCashCoaCollapsedChild({ code: '1280' }), false);

assert.equal(isWorkshopPettyCashLedgerAccount({ code: '1280' }), true);
assert.equal(isWorkshopPettyCashLedgerAccount({ code: '1280-BR-5-E153' }), false);

const accounts = [
    { code: '1280', name: 'Fund' },
    { code: '1280-BR-5', name: 'Branch' },
    { code: '1280-BR-5-E153', name: 'Athiya' },
    { code: '6100', name: 'Expense' },
    { code: '6100-BR-5', name: 'Branch exp' },
    { code: '1110', name: 'AR' },
];
const filtered = filterWorkshopPettyCashCoaList(accounts);
assert.deepEqual(filtered.map((a) => a.code), ['1280', '6100', '1110']);

const tree = pruneWorkshopPettyCashCoaTree([
    {
        code: '1280',
        children: [
            { code: '1280-BR-5', children: [{ code: '1280-BR-5-E153', children: [] }] },
        ],
    },
]);
assert.equal(tree.length, 1);
assert.equal(tree[0].code, '1280');
assert.equal(tree[0].children.length, 0);

assert.equal(
    buildWorkshopCoaAccountCreateUrl({ type: 'INCOME', statement: 'pl' }),
    '/workshop/accounting/chart-of-accounts/new?type=INCOME&statement=pl',
);
assert.equal(
    buildWorkshopCoaAccountEditUrl('109'),
    '/workshop/accounting/chart-of-accounts/109/edit',
);
assert.deepEqual(
    parseWorkshopCoaAccountFormFromPath('/workshop/accounting/chart-of-accounts/new'),
    { mode: 'new', accountId: '' },
);
assert.deepEqual(
    parseWorkshopCoaAccountFormFromPath('/workshop/accounting/chart-of-accounts/88/edit'),
    { mode: 'edit', accountId: '88' },
);
assert.equal(
    parseWorkshopCoaAccountFormFromPath('/workshop/accounting/chart-of-accounts'),
    null,
);

assert.equal(isCorporateArLedgerClickable({ code: '1110', isHeading: true }), true);
assert.equal(isCorporateArLedgerClickable({ code: '1112', parentCode: '1110' }), true);
assert.equal(isWorkshopCoaLedgerClickable({ id: '9', code: '1110', isHeading: true }), true);
assert.equal(isWorkshopCoaLedgerClickable({ id: '10', code: '1112', hasChildren: false }), true);
assert.equal(isWorkshopCoaLedgerClickable({ id: '11', code: '1000', isHeading: true }), false);

console.log('workshopCoaAccountRouting tests passed');
