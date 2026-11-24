import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  unlockDaysCount,
  settingsDirty,
  flattenSettingsHistory,
  slicePage,
  isPeriodLockedError,
  extractLockedUpToFromError,
  reportShowsLegacy,
  parseYmd,
} from './accountingSettingsDisplay.js';

describe('accountingSettingsDisplay (P-A10B)', () => {
  it('parseYmd accepts YYYY-MM-DD only', () => {
    assert.equal(parseYmd('2026-03-31'), '2026-03-31');
    assert.equal(parseYmd('bad'), null);
  });

  it('unlockDaysCount when lockedUpTo moves earlier', () => {
    assert.equal(unlockDaysCount('2026-03-31', '2026-03-31'), 0);
    assert.equal(unlockDaysCount('2026-03-31', '2026-04-30'), 0);
    assert.equal(unlockDaysCount('2026-03-31', '2026-03-01'), 30);
    assert.equal(unlockDaysCount(null, '2026-01-01'), 0);
  });

  it('settingsDirty detects basis and dates', () => {
    const saved = {
      startDate: '2026-01-01',
      lockedUpTo: '2026-03-31',
      cutoverEnabled: true,
      basis: 'accrual',
    };
    assert.equal(settingsDirty({ ...saved }, saved), false);
    assert.equal(
      settingsDirty({ ...saved, lockedUpTo: '2026-02-28' }, saved),
      true,
    );
    assert.equal(settingsDirty({ ...saved, basis: 'cash' }, saved), true);
  });

  it('flattenSettingsHistory emits one row per changed field', () => {
    const rows = flattenSettingsHistory([
      {
        at: '2026-04-12T09:10:00.000Z',
        byUserId: '9',
        reason: 'Q1 close',
        before: {
          startDate: '2026-01-01',
          lockedUpTo: '2026-02-28',
          cutoverEnabled: false,
          basis: 'accrual',
        },
        after: {
          startDate: '2026-01-01',
          lockedUpTo: '2026-03-31',
          cutoverEnabled: false,
          basis: 'accrual',
        },
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].field, 'lockedUpTo');
    assert.equal(rows[0].oldValue, '2026-02-28');
    assert.equal(rows[0].newValue, '2026-03-31');
    assert.equal(rows[0].reason, 'Q1 close');
  });

  it('slicePage paginates at 25', () => {
    const list = Array.from({ length: 30 }, (_, i) => i);
    const p1 = slicePage(list, 1, 25);
    assert.equal(p1.rows.length, 25);
    assert.equal(p1.from, 1);
    assert.equal(p1.to, 25);
    const p2 = slicePage(list, 2, 25);
    assert.equal(p2.rows.length, 5);
    assert.equal(p2.from, 26);
  });

  it('PERIOD_LOCKED detection and date extract', () => {
    assert.equal(
      isPeriodLockedError({ status: 423, code: 'PERIOD_LOCKED' }),
      true,
    );
    assert.equal(
      extractLockedUpToFromError({
        message: 'Journal date 2026-03-01 is locked (lockedUpTo 2026-03-31)',
      }),
      '2026-03-31',
    );
  });

  it('reportShowsLegacy', () => {
    assert.equal(reportShowsLegacy({ legacy: true }), true);
    assert.equal(reportShowsLegacy({}), false);
  });
});
