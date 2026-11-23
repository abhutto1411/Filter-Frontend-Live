import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    bumpConflictEditSession,
    isConflictEditSessionCurrent,
    releaseConflictEditLock,
    resolveRuleForConflictEdit,
    tryAcquireConflictEditLock,
} from './openConflictRuleEditor.js';

describe('conflict edit busy lock', () => {
    it('blocks a second acquire until released (double-click guard)', () => {
        const busyRef = { current: false };
        assert.equal(tryAcquireConflictEditLock(busyRef), true);
        assert.equal(busyRef.current, true);
        assert.equal(tryAcquireConflictEditLock(busyRef), false);
        releaseConflictEditLock(busyRef);
        assert.equal(busyRef.current, false);
        assert.equal(tryAcquireConflictEditLock(busyRef), true);
        releaseConflictEditLock(busyRef);
    });

    it('allows work without a busyRef', () => {
        assert.equal(tryAcquireConflictEditLock(null), true);
        assert.equal(tryAcquireConflictEditLock(undefined), true);
        releaseConflictEditLock(null);
    });
});

describe('conflict edit session (close-during-fetch)', () => {
    it('marks the started session stale after bump (dialog closed)', () => {
        const sessionRef = { current: 0 };
        const startedAt = sessionRef.current;
        assert.equal(isConflictEditSessionCurrent(sessionRef, startedAt), true);
        bumpConflictEditSession(sessionRef);
        assert.equal(isConflictEditSessionCurrent(sessionRef, startedAt), false);
        assert.equal(isConflictEditSessionCurrent(null, startedAt), true);
    });
});

describe('resolveRuleForConflictEdit', () => {
    it('returns the rule from the list when present (even if UI filter would hide it)', async () => {
        const rules = [
            { id: '41', name: 'Services' },
            { id: '99', name: 'Hidden by search' },
        ];
        const result = await resolveRuleForConflictEdit({
            id: '99',
            rules,
            fetchRule: async () => {
                throw new Error('should not fetch');
            },
        });
        assert.equal(result.ok, true);
        assert.equal(result.rule.name, 'Hidden by search');
    });

    it('fetches by id when the list does not contain the rule', async () => {
        const result = await resolveRuleForConflictEdit({
            id: '42',
            rules: [{ id: '41', name: 'Other' }],
            fetchRule: async (id) => ({ rule: { id, name: `Fetched ${id}` } }),
        });
        assert.equal(result.ok, true);
        assert.equal(result.rule.id, '42');
        assert.equal(result.rule.name, 'Fetched 42');
    });

    it('accepts a bare rule object from the API (no .rule wrapper)', async () => {
        const result = await resolveRuleForConflictEdit({
            id: '7',
            rules: [],
            fetchRule: async () => ({ id: '7', name: 'Bare' }),
        });
        assert.equal(result.ok, true);
        assert.equal(result.rule.name, 'Bare');
    });

    it('returns an i18n error key when fetch fails', async () => {
        const result = await resolveRuleForConflictEdit({
            id: '8',
            rules: [],
            fetchRule: async () => {
                throw new Error('network');
            },
        });
        assert.equal(result.ok, false);
        assert.equal(result.errorKey, 'rules.conflicts.editLoadError');
    });

    it('returns an error key when the fetched body has no id', async () => {
        const result = await resolveRuleForConflictEdit({
            id: '8',
            rules: [],
            fetchRule: async () => ({ name: 'no id' }),
        });
        assert.equal(result.ok, false);
        assert.equal(result.errorKey, 'rules.conflicts.editLoadError');
    });
});
