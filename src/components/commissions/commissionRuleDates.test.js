import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    formatRuleEffective,
    normalizeRuleDate,
    optionalFromDateError,
    commissionRuleSavePlan,
    ruleEffectiveDateError,
    ruleEffectivePayload,
    savedRuleIdentity,
} from './commissionRuleDates.js';

const t = (key, vars) => {
    const pack = {
        'rules.effectiveRange': '{from} → {to}',
        'rules.effectiveFromValue': 'From {from}',
        'rules.effectiveToValue': 'Until {to}',
    };
    let text = pack[key] ?? key;
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, String(value));
        }
    }
    return text;
};

describe('commission rule effective dates', () => {
    it('keeps a real Riyadh day and a DATE serialized at midnight', () => {
        assert.equal(normalizeRuleDate('2026-10-16'), '2026-10-16');
        assert.equal(normalizeRuleDate('2026-10-16T00:00:00.000Z'), '2026-10-16');
        assert.equal(normalizeRuleDate(''), '');
        assert.equal(normalizeRuleDate(null), '');
        assert.equal(normalizeRuleDate('2026-02-31'), '');
        assert.equal(normalizeRuleDate('16-10-2026'), '');
    });

    it('accepts equal dates and rejects an end before the start', () => {
        assert.equal(ruleEffectiveDateError('', ''), '');
        assert.equal(ruleEffectiveDateError('2026-10-16', ''), '');
        assert.equal(ruleEffectiveDateError('', '2026-10-20'), '');
        assert.equal(ruleEffectiveDateError('2026-10-16', '2026-10-16'), '');
        assert.equal(ruleEffectiveDateError('2026-10-16', '2026-10-17'), '');
        assert.equal(ruleEffectiveDateError('2026-10-17', '2026-10-16'), 'order');
        assert.equal(ruleEffectiveDateError('2026-13-01', ''), 'invalid');
    });

    it('sends null when a date is left empty', () => {
        assert.deepEqual(ruleEffectivePayload('', ''), { effectiveFrom: null, effectiveTo: null });
        assert.deepEqual(ruleEffectivePayload('2026-10-16', ''), {
            effectiveFrom: '2026-10-16',
            effectiveTo: null,
        });
        assert.deepEqual(ruleEffectivePayload('2026-10-16T00:00:00.000Z', '2026-12-31'), {
            effectiveFrom: '2026-10-16',
            effectiveTo: '2026-12-31',
        });
    });

    it('labels the window for the rules list', () => {
        assert.equal(formatRuleEffective({ effectiveFrom: '2026-10-16', effectiveTo: '2026-12-31' }, t), '2026-10-16 → 2026-12-31');
        assert.equal(formatRuleEffective({ effective_from: '2026-10-16' }, t), 'From 2026-10-16');
        assert.equal(formatRuleEffective({ effective_to: '2026-12-31' }, t), 'Until 2026-12-31');
        assert.equal(formatRuleEffective({}, t), '');
    });

    it('checks the optional apply from-date', () => {
        assert.equal(optionalFromDateError(''), '');
        assert.equal(optionalFromDateError('2026-10-16'), '');
        assert.equal(optionalFromDateError('2026-02-31'), 'invalid');
    });

    it('updates the same rule after create, and skips a save already in flight', () => {
        assert.deepEqual(commissionRuleSavePlan({ ruleId: null, savedRuleId: '', inFlight: false }), {
            action: 'create',
            id: '',
        });
        assert.deepEqual(commissionRuleSavePlan({ ruleId: null, savedRuleId: '', inFlight: true }), {
            action: 'skip',
            id: '',
        });
        assert.deepEqual(commissionRuleSavePlan({ ruleId: null, savedRuleId: '42', inFlight: false }), {
            action: 'update',
            id: '42',
        });
        assert.deepEqual(commissionRuleSavePlan({ ruleId: null, savedRuleId: '42', inFlight: true }), {
            action: 'skip',
            id: '',
        });
        assert.deepEqual(commissionRuleSavePlan({ ruleId: '7', savedRuleId: '', inFlight: false }), {
            action: 'update',
            id: '7',
        });
        assert.deepEqual(commissionRuleSavePlan({ ruleId: '7', savedRuleId: '42', inFlight: false }), {
            action: 'update',
            id: '42',
        });
        assert.deepEqual(
            commissionRuleSavePlan({ ruleId: null, savedRuleId: '', createdWithoutId: true, inFlight: false }),
            { action: 'skip', id: '' },
        );
        assert.deepEqual(
            commissionRuleSavePlan({ ruleId: null, savedRuleId: '42', createdWithoutId: false, inFlight: false }),
            { action: 'update', id: '42' },
        );
    });

    it('reads the saved rule id from common response shapes', () => {
        assert.deepEqual(savedRuleIdentity({ id: '9', name: 'Oil' }), { id: '9', name: 'Oil' });
        assert.deepEqual(savedRuleIdentity({ rule: { id: 4, name: 'Svc' } }), { id: '4', name: 'Svc' });
        assert.deepEqual(savedRuleIdentity({ data: { id: '7' } }, { name: 'Fallback' }), { id: '7', name: 'Fallback' });
        assert.deepEqual(savedRuleIdentity({}, { id: '3', name: 'Edit' }), { id: '3', name: 'Edit' });
        assert.equal(savedRuleIdentity({}), null);
    });
});
