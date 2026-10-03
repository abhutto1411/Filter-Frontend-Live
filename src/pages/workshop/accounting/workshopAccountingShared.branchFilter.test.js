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
