import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildTxImport,
    normalizeImportDate,
    parseDelimited,
    pastedCellsToJournalRows,
    pastedCellsToPayRows,
    txImportTemplateCsv,
} from './txImport.js';

const lookups = {
    accounts: [
        { id: 61, code: '6110', name: 'Fuel', type: 'EXPENSE' },
        { id: 71, code: '7001', name: 'Water Purchases', nameAr: 'مشتريات مياه', type: 'EXPENSE' },
        { id: 41, code: '4100', name: 'Service revenue', type: 'INCOME' },
    ],
    cashBankAccounts: [
        { id: 1, name: 'Main Cash', type: 'CASH', branchId: 5 },
        { id: 2, name: 'Main Bank', type: 'BANK' },
    ],
    payees: {
        supplier: [{ id: 'local:9', name: 'Example Supplier Co' }],
        customer: [{ id: 'corp:3', name: 'Example Customer' }],
        employee: [{ id: 21, name: 'Ali Hassan' }],
    },
    branches: [{ id: 5, name: 'Main' }],
};

test('template round-trips: payment, receipt and a balanced journal; nothing unmatched', () => {
    const res = buildTxImport(txImportTemplateCsv(), lookups);
    assert.equal(res.counts.rows, 5);
    assert.equal(res.counts.loaded, 5);
    assert.deepEqual(res.entries.map((e) => [e.type, e.rows.length, e.total]), [
        ['payment', 2, '165.00'],
        ['receipt', 1, '300.00'],
        ['journal', 2, '25.00'],
    ]);
    const pe = res.entries[0];
    assert.equal(pe.header.cashAccountId, '1');
    assert.deepEqual(pe.rows[0], {
        date: '2026-11-19', type: 'Supplier', payeeId: 'local:9', payeeName: 'Example Supplier Co',
        accountId: '71', amount: '115.00', ref: 'INV-1001', notes: 'Water bill',
    });
    assert.equal(pe.rows[1].type, 'Other');
    assert.equal(pe.rows[1].payeeName, 'Fuel station');
    assert.equal(res.entries[1].rows[0].payeeId, 'corp:3');
    assert.deepEqual(res.entries[2].rows.map((r) => [r.accountId, r.debit, r.credit]), [['61', '25.00', ''], ['71', '', '25.00']]);
    assert.deepEqual(res.issues, []);
});

test('groups payments by pay-from register (one entry per register, like a manual PE)', () => {
    const csv = [
        'type,date,payee_type,payee,account,amount,pay_from_receive_into',
        'payment,2026-11-19,Other,A,6110,10,Main Cash',
        'payment,2026-11-19,Other,B,6110,20,Main Bank',
        'payment,2026-11-19,Other,C,6110,30,Main Cash',
    ].join('\n');
    const res = buildTxImport(csv, lookups);
    assert.deepEqual(res.entries.map((e) => [e.header.cashAccountId, e.rows.length, e.total]), [['1', 2, '40.00'], ['2', 1, '20.00']]);
});

test('reports unmatched account / payee / register / bad amount with file line numbers; rows still load', () => {
    const csv = [
        'type,date,payee_type,payee,account,amount,pay_from_receive_into',
        'payment,2026-11-19,Supplier,Unknown Co,9999,abc,Nowhere',
    ].join('\n');
    const res = buildTxImport(csv, lookups);
    assert.deepEqual(res.issues.map((i) => [i.line, i.key]).sort(), [
        [2, 'tx.imp.err.account'], [2, 'tx.imp.err.amount'], [2, 'tx.imp.err.payee'], [2, 'tx.imp.err.register'],
    ].sort());
    assert.equal(res.entries[0].rows[0].accountId, '');
    assert.equal(res.entries[0].rows[0].payeeName, 'Unknown Co');
});

test('transfer rows and unknown types are skipped with a reason', () => {
    const csv = 'type,account,amount\ntransfer,6110,10\nfoo,6110,10\npayment,6110,10';
    const res = buildTxImport(csv, lookups);
    assert.equal(res.counts.skipped, 2);
    assert.deepEqual(res.issues.map((i) => i.key), ['tx.imp.err.transfer', 'tx.imp.err.type']);
    assert.equal(res.entries.length, 1);
});

test('unbalanced journal is flagged', () => {
    const csv = 'type,account,debit,credit\njournal,6110,10,\njournal,7001,,9';
    const res = buildTxImport(csv, lookups);
    assert.ok(res.issues.some((i) => i.key === 'tx.imp.err.unbalanced' && i.value === '10.00 / 9.00'));
});

test('missing / wrong header → clear error', () => {
    assert.equal(buildTxImport('', lookups).issues[0].key, 'tx.imp.err.empty');
    assert.equal(buildTxImport('a,b\n1,2', lookups).issues[0].key, 'tx.imp.err.header');
});

test('old template column names still work (accountId, cashBankAccountId, description)', () => {
    const csv = 'type,date,reference,payeeType,payeeName,accountId,cashBankAccountId,description,amount\npayment,2026-11-04,INV-1,Supplier,Example Supplier Co,7001,Main Cash,Water,"5,750.00"';
    const res = buildTxImport(csv, lookups);
    assert.deepEqual(res.issues, []);
    assert.equal(res.entries[0].rows[0].amount, '5750.00');
    assert.equal(res.entries[0].rows[0].notes, 'Water');
});

test('account matches by code, name, Arabic name or "code — name"', () => {
    const csv = 'type,account,amount\npayment,Water Purchases,1\npayment,مشتريات مياه,1\npayment,7001 — Water Purchases,1';
    const res = buildTxImport(csv, lookups);
    assert.deepEqual(res.entries[0].rows.map((r) => r.accountId), ['71', '71', '71']);
});

test('dates: ISO, slashes, day-first; invalid flagged', () => {
    assert.equal(normalizeImportDate('2026-11-19'), '2026-11-19');
    assert.equal(normalizeImportDate('19/11/2026'), '2026-11-19');
    assert.equal(normalizeImportDate('2026/1/5'), '2026-01-05');
    assert.equal(normalizeImportDate('31/02/2026'), null);
});

test('CSV parser: quotes, embedded commas / newlines, BOM, TSV', () => {
    assert.deepEqual(parseDelimited('﻿a,"b,c","d ""q"""\n1,2,3'), [['a', 'b,c', 'd "q"'], ['1', '2', '3']]);
    assert.deepEqual(parseDelimited('a\tb\n"x\ny"\tz'), [['a', 'b'], ['x\ny', 'z']]);
});

test('Excel paste into PE grid and JE grid', () => {
    const pe = pastedCellsToPayRows([['19/11/2026', 'Employee', 'Ali Hassan', '6110', '12.5', 'R1', 'n']], lookups);
    assert.deepEqual(pe.issues, []);
    assert.equal(pe.rows[0].payeeId, '21');
    assert.equal(pe.rows[0].amount, '12.50');
    assert.equal(pe.rows[0].date, '2026-11-19');
    const je = pastedCellsToJournalRows([['6110', 'x', '5', ''], ['7001', 'y', '', '5']], lookups);
    assert.deepEqual(je.rows.map((r) => [r.accountId, r.debit, r.credit]), [['61', '5.00', ''], ['71', '', '5.00']]);
});

import { batchDraftRowsToImportText } from './txImport.js';

test('batch draft → import: only unposted rows; ids resolve to the same accounts / register / payee', () => {
    const rows = [
        { lineNo: 1, state: 'posted', journalId: '900', payload: { type: 'payment', amount: '5', accountId: '61', cashBankAccountId: '1' } },
        { lineNo: 2, state: 'draft', payload: { type: 'payment', date: '2026-11-19', payeeType: 'Supplier', payeeId: 'local:9', accountId: '71', amount: '115', cashBankAccountId: '1', description: 'Water' } },
        { lineNo: 3, state: 'closed', payload: { type: 'payment', amount: '1', accountId: '61' } },
        { lineNo: 4, state: 'error', payload: { type: 'journal', accountId: '61', debit: '10', journalGroup: 1 } },
        { lineNo: 5, state: 'error', payload: { type: 'journal', accountId: '71', credit: '10', journalGroup: 1 } },
    ];
    const { text, openRows } = batchDraftRowsToImportText(rows);
    assert.equal(openRows, 3);
    const res = buildTxImport(text, lookups);
    assert.deepEqual(res.issues, []);
    assert.deepEqual(res.entries.map((e) => [e.type, e.rows.length]), [['payment', 1], ['journal', 2]]);
    assert.deepEqual(res.entries[0].rows[0], {
        date: '2026-11-19', type: 'Supplier', payeeId: 'local:9', payeeName: 'Example Supplier Co',
        accountId: '71', amount: '115.00', ref: '', notes: 'Water',
    });
    assert.equal(res.entries[0].header.cashAccountId, '1');
});
