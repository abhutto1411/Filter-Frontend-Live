import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from './api';
import { listCoaAccounts, isUnknownCoaKindError } from './workshopAccountingApi';

function badKind() {
    const e = new Error('kind must be one of the following values: payable_expense, receivable_revenue, all');
    e.status = 400;
    return e;
}

describe('listCoaAccounts kind=postable compatibility', () => {
    beforeEach(() => apiFetch.mockReset());

    it('falls back to kind=all when the backend does not know postable yet', async () => {
        apiFetch.mockRejectedValueOnce(badKind()).mockResolvedValueOnce({ accounts: [{ id: 1 }] });
        const res = await listCoaAccounts('postable', { includeOtherBranches: '1' });
        expect(res).toEqual({ accounts: [{ id: 1 }] });
        expect(apiFetch.mock.calls[0][0]).toContain('kind=postable');
        expect(apiFetch.mock.calls[1][0]).toContain('kind=all');
        expect(apiFetch.mock.calls[1][0]).toContain('includeOtherBranches=1');
    });

    it('does not retry other errors or other kinds', async () => {
        const e = new Error('Forbidden');
        e.status = 403;
        apiFetch.mockRejectedValueOnce(e);
        await expect(listCoaAccounts('postable')).rejects.toBe(e);
        apiFetch.mockRejectedValueOnce(badKind());
        await expect(listCoaAccounts('payable_expense')).rejects.toThrow(/kind must be/);
        expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    it('isUnknownCoaKindError only matches the 400 kind message', () => {
        expect(isUnknownCoaKindError(badKind())).toBe(true);
        expect(isUnknownCoaKindError({ status: 400, message: 'other' })).toBe(false);
        expect(isUnknownCoaKindError(null)).toBe(false);
    });
});
