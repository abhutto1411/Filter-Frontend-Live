/**
 * D7: Cash & Bank controls card helpers.
 * Run: node --test src/utils/accountingSettingsCashBank.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  branchOverrideTriState,
  normalizeBranchOverrideMap,
  setBranchOverrideTriState,
  settingsDirty,
  fieldLabelKey,
} from './accountingSettingsDisplay.js';
import { accT } from './accountingI18n.js';

describe('D7 Cash & Bank controls', () => {
  it('card titles exist in EN and AR', () => {
    assert.equal(accT('en', 'accSettings.cashBankControlsTitle'), 'Cash & Bank controls');
    assert.equal(accT('ar', 'accSettings.cashBankControlsTitle'), 'ضوابط النقد والبنك');
  });

  it('branch tri-state inherit/allow/block', () => {
    assert.equal(branchOverrideTriState({}, '2'), 'inherit');
    assert.equal(branchOverrideTriState({ '2': true }, '2'), 'allow');
    assert.equal(branchOverrideTriState({ '2': false }, '2'), 'block');
    const next = setBranchOverrideTriState({ '2': true }, '3', 'block');
    assert.deepEqual(normalizeBranchOverrideMap(next), { '2': true, '3': false });
    assert.deepEqual(
      normalizeBranchOverrideMap(setBranchOverrideTriState(next, '2', 'inherit')),
      { '3': false },
    );
  });

  it('settingsDirty tracks by-branch map + field labels', () => {
    const saved = {
      startDate: '2026-01-01',
      lockedUpTo: null,
      cutoverEnabled: false,
      basis: 'accrual',
      allowNegativeCashBank: false,
      allowNegativeCashBankByBranch: {},
    };
    assert.equal(settingsDirty({ ...saved }, saved), false);
    assert.equal(
      settingsDirty(
        { ...saved, allowNegativeCashBankByBranch: { '9': true } },
        saved,
      ),
      true,
    );
    assert.equal(
      fieldLabelKey('allowNegativeCashBankByBranch'),
      'accSettings.field.allowNegativeCashBankByBranch',
    );
  });
});
