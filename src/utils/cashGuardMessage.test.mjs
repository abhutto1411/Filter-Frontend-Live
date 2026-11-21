import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCashGuardMessage } from './cashGuardMessage.js';

describe('formatCashGuardMessage', () => {
  it('formats INSUFFICIENT_CASH_BALANCE in EN', () => {
    const msg = formatCashGuardMessage(
      {
        code: 'INSUFFICIENT_CASH_BALANCE',
        accountCode: '1004',
        accountName: 'Locker Vault Cash',
        available: 0,
        required: 185857.86,
      },
      'en',
    );
    assert.match(msg, /1004/);
    assert.match(msg, /0\.00/);
    assert.match(msg, /185,857\.86/);
    assert.match(msg, /workshop GL/);
  });

  it('formats INSUFFICIENT_CASH_BALANCE in AR with Latin digits', () => {
    const msg = formatCashGuardMessage(
      {
        code: 'INSUFFICIENT_CASH_BALANCE',
        accountCode: '1004',
        accountName: 'Locker Vault Cash',
        available: 0,
        required: 1000,
      },
      'ar',
    );
    assert.match(msg, /1004/);
    assert.match(msg, /0\.00/);
    assert.match(msg, /1,000\.00|1000\.00/);
  });
});
