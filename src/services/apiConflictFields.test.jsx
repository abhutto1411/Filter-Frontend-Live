/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch } from './api';
import {
    handleSystemAccountConflict,
    parseSystemAccountConflict,
} from '../utils/systemAccountConflict';

const body409 = {
    success: false,
    statusCode: 409,
    message: 'System account "Collection expense claims — pending approval" needs code 1156, …',
    code: 'SYSTEM_ACCOUNT_CODE_CONFLICT',
    role: 'LOCKER_COLLECTION_EXPENSE_CLEARING',
    roleLabel: 'Collection expense claims — pending approval',
    preferredCode: '1156',
    roleType: 'ASSET',
    roleSubType: 'CURRENT',
    suggestedCode: '1158',
    conflictingAccount: { id: '9156', code: '1156', name: 'Zad Al Sharq Food Products Company', type: 'ASSET' },
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('apiFetch keeps SYSTEM_ACCOUNT_CODE_CONFLICT fields on the error', () => {
    it('409 body → error carries role, codes, suggestion and the conflicting account', async () => {
        // Answered in-process; nothing leaves the test.
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(body409), { status: 409, headers: { 'Content-Type': 'application/json' } })),
        );
        vi.spyOn(console, 'error').mockImplementation(() => {});
        let err;
        try {
            await apiFetch('/locker/cit/receive', { method: 'POST', body: JSON.stringify({}) });
        } catch (e) {
            err = e;
        }
        expect(err).toBeTruthy();
        expect(err.status).toBe(409);
        const seen = [];
        expect(handleSystemAccountConflict(err, { onConflict: (p) => seen.push(p) })).toBe(true);
        expect(seen[0]).toEqual(parseSystemAccountConflict(err));
        expect(seen[0]).toMatchObject({
            role: 'LOCKER_COLLECTION_EXPENSE_CLEARING',
            roleLabel: 'Collection expense claims — pending approval',
            preferredCode: '1156',
            roleType: 'ASSET',
            suggestedCode: '1158',
            resolvable: true,
            conflictingAccount: { code: '1156', name: 'Zad Al Sharq Food Products Company', type: 'ASSET' },
        });
    });
});
