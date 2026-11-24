import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    filterAccountsForBranch,
    filterPayeesForBranch,
} from './workshopAccountingShared.js';

describe('filterAccountsForBranch', () => {
    const list = [
        { id: '1', name: 'Cash A', branchId: '10' },
        { id: '2', name: 'Cash B', branchId: '20' },
        { id: '3', name: 'Locker', branchId: null },
        { id: '4', name: 'HQ', branchId: '' },
    ];

    it('returns all when branch is empty (All Branches)', () => {
        assert.equal(filterAccountsForBranch(list, '').length, 4);
        assert.equal(filterAccountsForBranch(list, null).length, 4);
    });

    it('keeps matching branch + workshop-wide (null/empty)', () => {
        const scoped = filterAccountsForBranch(list, '10');
        assert.deepEqual(scoped.map((a) => a.id), ['1', '3', '4']);
    });
});

describe('filterPayeesForBranch', () => {
    const list = [
        { id: 'a', name: 'Emp A', branchId: '10' },
        { id: 'b', name: 'Emp B', branchId: '20' },
        { id: 'c', name: 'Shared', branchId: null },
    ];

    it('filters by branch and keeps workshop-wide', () => {
        assert.deepEqual(
            filterPayeesForBranch(list, '20').map((p) => p.id),
            ['b', 'c'],
        );
    });
});

import { postableAccountOptions } from './workshopAccountingShared.js';

describe('postableAccountOptions — PE / RV / JE Account column (8-fixes §5)', () => {
    const pool = [
        { id: '1', code: '1390', name: 'Prepaid rent', type: 'ASSET', branchId: null },
        { id: '2', code: '1013', name: 'Bank Account — TEST Riyadh Branch', type: 'ASSET', branchId: '20', branchName: 'Riyadh' },
        { id: '3', code: '7001', name: 'Water Purchases', type: 'EXPENSE', branchId: '10', branchName: 'Jeddah' },
        { id: '4', code: '2100', name: 'Accrued liabilities', type: 'LIABILITY', branchId: null },
        { id: '5', code: '1001', name: 'Main cash (register COA)', type: 'ASSET', branchId: '10' },
    ];

    it('keeps manual ASSET / LIABILITY / EXPENSE accounts of every branch (Payment and Receipt alike)', () => {
        const ids = postableAccountOptions(pool, { headerBranchId: '10' }).map((o) => o.id);
        for (const id of ['1', '2', '3', '4']) assert.ok(ids.includes(id), `missing ${id}`);
    });

    it('this branch / workshop-wide first, then "Other branches" with the branch name', () => {
        const opts = postableAccountOptions(pool, { headerBranchId: '10', otherBranchesLabel: 'Other branches' });
        const other = opts.find((o) => o.id === '2');
        assert.equal(other.group, 'other');
        assert.match(other.subtitle, /Other branches · Riyadh/);
        assert.equal(opts[opts.length - 1].id, '2');
        assert.equal(opts.find((o) => o.id === '3').group, 'this');
    });

    it('drops the header register\'s own COA account', () => {
        const ids = postableAccountOptions(pool, { headerBranchId: '10', excludeAccountIds: ['5'] }).map((o) => o.id);
        assert.ok(!ids.includes('5'));
    });

    it('no header branch → nothing is "other"', () => {
        assert.ok(postableAccountOptions(pool, {}).every((o) => o.group === 'this'));
    });
});
