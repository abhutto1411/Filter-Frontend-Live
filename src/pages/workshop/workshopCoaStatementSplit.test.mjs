import assert from 'node:assert/strict';
import {
    BALANCE_SHEET_TYPES,
    INCOME_STATEMENT_TYPES,
    countGroupedAccounts,
    allowedAccountTypesForStatement,
    closingColumnsFromSigned,
    defaultTypeForStatementPart,
    isCoaPostableAccount,
    netProfitFromClosingBalances,
    signedClosingBalance,
    sumSignedClosingBalances,
    sumTopLevelClosingBalances,
    filterTypeGroupsByChip,
    isBalanceSheetAccountType,
    isIncomeStatementAccountType,
    partitionCoaTypeGroups,
    statementPartForAccountType,
} from './workshopCoaStatementSplit.js';

assert.deepEqual(BALANCE_SHEET_TYPES, ['ASSET', 'LIABILITY', 'EQUITY']);
assert.deepEqual(INCOME_STATEMENT_TYPES, ['INCOME', 'EXPENSE']);

assert.equal(isBalanceSheetAccountType('ASSET'), true);
assert.equal(isBalanceSheetAccountType('equity'), true);
assert.equal(isBalanceSheetAccountType('INCOME'), false);
assert.equal(isIncomeStatementAccountType('EXPENSE'), true);
assert.equal(isIncomeStatementAccountType('LIABILITY'), false);

assert.equal(statementPartForAccountType('INCOME'), 'pl');
assert.equal(statementPartForAccountType('ASSET'), 'bs');

const typeGroups = [
    { key: 'ASSET' },
    { key: 'LIABILITY' },
    { key: 'EQUITY' },
    { key: 'INCOME' },
    { key: 'EXPENSE' },
];
const parts = partitionCoaTypeGroups(typeGroups);
assert.deepEqual(parts.balanceSheet.map((g) => g.key), ['ASSET', 'LIABILITY', 'EQUITY']);
assert.deepEqual(parts.incomeStatement.map((g) => g.key), ['INCOME', 'EXPENSE']);

const grouped = {
    ASSET: [{ id: 1 }, { id: 2 }],
    LIABILITY: [{ id: 3 }],
    EQUITY: [],
    INCOME: [{ id: 4 }],
    EXPENSE: [{ id: 5 }, { id: 6 }],
};
assert.equal(countGroupedAccounts(grouped, BALANCE_SHEET_TYPES), 3);
assert.equal(countGroupedAccounts(grouped, INCOME_STATEMENT_TYPES), 3);

assert.deepEqual(
    filterTypeGroupsByChip(parts.balanceSheet, 'LIABILITY').map((g) => g.key),
    ['LIABILITY'],
);
assert.equal(filterTypeGroupsByChip(parts.balanceSheet, '').length, 3);

assert.equal(defaultTypeForStatementPart('pl'), 'INCOME');
assert.equal(defaultTypeForStatementPart('bs'), 'ASSET');

assert.deepEqual(allowedAccountTypesForStatement('pl'), ['INCOME', 'EXPENSE']);
assert.deepEqual(allowedAccountTypesForStatement('bs'), ['ASSET', 'LIABILITY', 'EQUITY']);
assert.deepEqual(allowedAccountTypesForStatement('', 'INCOME'), ['INCOME', 'EXPENSE']);

assert.equal(isCoaPostableAccount({ hasChildren: true }), false);
assert.equal(isCoaPostableAccount({ isHeading: true }), false);
assert.equal(isCoaPostableAccount({ type: 'ASSET', closingDebit: 10 }), true);

assert.equal(signedClosingBalance({ type: 'ASSET', closingDebit: 100, closingCredit: 20 }), 80);
assert.equal(signedClosingBalance({ type: 'INCOME', closingDebit: 0, closingCredit: 50 }), 50);
assert.equal(signedClosingBalance({ type: 'EXPENSE', closingDebit: 40, closingCredit: 5 }), 35);

const kpiRows = [
    { id: 'inc-folder', type: 'INCOME', closingCredit: 100, parentId: null, hasChildren: true },
    { id: 'inc-leaf', type: 'INCOME', closingCredit: 100, parentId: 'inc-folder' },
    { id: 'exp-leaf', type: 'EXPENSE', closingDebit: 30, parentId: null },
    { id: 'asset-folder', type: 'ASSET', closingDebit: 200, parentId: null, hasChildren: true },
    { id: 'asset-leaf', type: 'ASSET', closingDebit: 200, parentId: 'asset-folder' },
];
assert.equal(sumTopLevelClosingBalances(kpiRows, 'INCOME'), 100);
assert.equal(sumSignedClosingBalances(kpiRows, 'INCOME'), 100);
assert.equal(sumSignedClosingBalances(kpiRows, 'EXPENSE'), 30);
assert.equal(sumSignedClosingBalances(kpiRows, 'ASSET'), 200);
assert.equal(netProfitFromClosingBalances(kpiRows), 70);
assert.deepEqual(closingColumnsFromSigned('INCOME', 70), { closingDebit: 0, closingCredit: 70 });
assert.deepEqual(closingColumnsFromSigned('EXPENSE', 30), { closingDebit: 30, closingCredit: 0 });

console.log('workshopCoaStatementSplit.test.mjs ok');
