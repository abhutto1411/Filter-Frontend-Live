import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incompleteJournalRows, incompletePayRows } from './txEntryRows.js';

test('PE / RV: blank rows ignored; started rows need account + amount > 0', () => {
    assert.deepEqual(
        incompletePayRows([
            { accountId: '', amount: '' },
            { accountId: '7', amount: '10' },
            { accountId: '', amount: '5' },
            { accountId: '7', amount: '0' },
            { payeeName: 'Shop' },
        ]),
        [3, 4, 5],
    );
});

test('JE: started lines need an account and exactly one of Dr / Cr', () => {
    assert.deepEqual(
        incompleteJournalRows([
            { accountId: '1', debit: '5', credit: '' },
            { accountId: '2', debit: '', credit: '5' },
            { accountId: '3', debit: '5', credit: '5' },
            { accountId: '', debit: '5' },
            { description: 'x' },
            {},
        ]),
        [3, 4, 5],
    );
});

test('PE / RV: an untouched line with only an auto-suggested account is not "started"', () => {
    assert.deepEqual(
        incompletePayRows([
            { accountId: '2100', accountAutoFilled: '2100', amount: '50', payeeId: 'local:9' },
            { accountId: '2100', accountAutoFilled: '2100', amount: '' },
            { accountId: '2100', accountAutoFilled: '2100', amount: '' },
            { accountId: '7001', accountAutoFilled: '2100', amount: '' },
        ]),
        [4],
    );
});
