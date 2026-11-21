import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lockerCollectionErrorMessage } from './lockerCollectionErrors.js';

const t = (key, vars) => {
  if (key === 'err.alreadyCollected') {
    return `EN already ${vars.name} @ ${vars.time}`;
  }
  return key;
};

describe('lockerCollectionErrorMessage', () => {
  it('maps LOCKER_ALREADY_COLLECTED with EN server message', () => {
    const msg = lockerCollectionErrorMessage(
      {
        code: 'LOCKER_ALREADY_COLLECTED',
        messageEn: 'Collected by Officer A',
      },
      { locale: 'en', t },
    );
    assert.equal(msg, 'Collected by Officer A');
  });

  it('maps LOCKER_ALREADY_COLLECTED with AR fallback from i18n', () => {
    const msg = lockerCollectionErrorMessage(
      {
        code: 'LOCKER_ALREADY_COLLECTED',
        collectedByName: 'Salem',
        collectedAt: '2026-11-18T10:00:00.000Z',
      },
      { locale: 'ar', t },
    );
    assert.match(msg, /Salem/);
  });

  it('maps other open-collection codes', () => {
    assert.equal(
      lockerCollectionErrorMessage({ code: 'LOCKER_SESSION_NOT_COLLECTIBLE' }, { locale: 'en', t }),
      'err.sessionNotCollectible',
    );
  });

  it('returns backend message for unknown codes and when code is absent', () => {
    assert.equal(
      lockerCollectionErrorMessage(
        { code: 'VALIDATION_FAILED', messageEn: 'Gross must match receipt.' },
        { locale: 'en', t },
      ),
      'Gross must match receipt.',
    );
    assert.equal(
      lockerCollectionErrorMessage({ message: 'Payload entity too large' }, { locale: 'en', t }),
      'Payload entity too large',
    );
  });
});