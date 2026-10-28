import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    canEditCommissionProfileFallback,
    commissionProfileFallbackPatchBody,
    formatProfileFallbackChangedAt,
    readCommissionProfileSettings,
} from './commissionProfileFallback.js';

describe('commission profile fallback setting', () => {
    it('lets a workshop editor change it and blocks platform and view-only users', () => {
        assert.equal(canEditCommissionProfileFallback({ adminMode: false, hasEditPermission: true }), true);
        assert.equal(canEditCommissionProfileFallback({ adminMode: true, hasEditPermission: true }), false);
        assert.equal(canEditCommissionProfileFallback({ adminMode: false, hasEditPermission: false }), false);
        assert.equal(canEditCommissionProfileFallback({ adminMode: true, hasEditPermission: false }), false);
    });

    it('sends only the boolean and treats a missing value as off', () => {
        assert.deepEqual(commissionProfileFallbackPatchBody(true), { commissionProfileFallback: true });
        assert.deepEqual(commissionProfileFallbackPatchBody(false), { commissionProfileFallback: false });
        assert.deepEqual(commissionProfileFallbackPatchBody('yes'), { commissionProfileFallback: false });
        assert.deepEqual(readCommissionProfileSettings({
            commissionProfileFallback: true,
            updatedAt: '2026-04-02T10:00:00.000Z',
            updatedByUserId: 'u1',
        }), {
            commissionProfileFallback: true,
            updatedAt: '2026-04-02T10:00:00.000Z',
            updatedByUserId: 'u1',
        });
        assert.deepEqual(readCommissionProfileSettings({ data: { commissionProfileFallback: false, updatedAt: null, updatedByUserId: null } }), {
            commissionProfileFallback: false,
            updatedAt: null,
            updatedByUserId: null,
        });
        assert.deepEqual(readCommissionProfileSettings({}), {
            commissionProfileFallback: false,
            updatedAt: null,
            updatedByUserId: null,
        });
    });

    it('shows a last-changed time only when updatedAt is a real instant', () => {
        assert.equal(formatProfileFallbackChangedAt(null), '');
        assert.equal(formatProfileFallbackChangedAt(''), '');
        assert.equal(formatProfileFallbackChangedAt('not-a-date'), '');
        const label = formatProfileFallbackChangedAt('2026-04-02T10:00:00.000Z', 'en');
        assert.match(label, /2026/);
        assert.match(label, /13:00/);
    });
});
