import assert from 'node:assert/strict';
import {
    filterWorkshopPettyCashCoaList,
    isWorkshopPettyCashCoaCollapsedChild,
    isWorkshopPettyCashCoaControlAccount,
    isWorkshopPettyCashLedgerAccount,
    pruneWorkshopPettyCashCoaTree,
} from './workshopCoaAccountRouting.js';

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

console.log('workshopCoaAccountRouting tests passed');
