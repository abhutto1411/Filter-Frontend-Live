import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    PERIOD_CLOSE_ENABLED,
    isPeriodCloseDisabledError,
    messageFromPeriodCloseError,
} from './periodCloseDisabled.js';

describe('periodCloseDisabled', () => {
    it('flag is on after P-A16A/B', () => {
        assert.equal(PERIOD_CLOSE_ENABLED, true);
    });

    it('uses backend message on 423', () => {
        const msg = messageFromPeriodCloseError(
            { status: 423, message: 'Period close is temporarily disabled.' },
            'fallback',
        );
        assert.equal(msg, 'Period close is temporarily disabled.');
    });

    it('falls back when 423 has no message', () => {
        const msg = messageFromPeriodCloseError(
            { status: 423, code: 'PERIOD_CLOSE_DISABLED' },
            'Banner fallback text',
        );
        assert.equal(msg, 'Banner fallback text');
    });

    it('detects PERIOD_CLOSE_DISABLED code', () => {
        assert.equal(
            isPeriodCloseDisabledError({ code: 'PERIOD_CLOSE_DISABLED' }),
            true,
        );
        assert.equal(isPeriodCloseDisabledError({ status: 500 }), false);
    });

    it('uses ordinary message for non-423 errors', () => {
        assert.equal(
            messageFromPeriodCloseError({ status: 404, message: 'Not found' }, 'x'),
            'Not found',
        );
    });
});
