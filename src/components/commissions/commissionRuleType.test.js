import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    applyCommissionTypeChange,
    commissionTypeFieldsFromRule,
    commissionTypePayload,
    commissionValueError,
    commissionValueErrorKey,
    formatCommissionFormRate,
    formatCommissionRuleRate,
    isCommissionValueValid,
    normalizeCommissionType,
} from './commissionRuleType.js';

const EN = {
    'money.sar': 'SAR {amount}',
    'rules.rate.profile': 'Profile %',
    'rules.rate.fixedPerUnit': '{money} per unit',
};

const AR = {
    'money.sar': '{amount} ر.س',
    'rules.rate.profile': 'نسبة الملف',
    'rules.rate.fixedPerUnit': '{money} لكل وحدة',
};

const makeT = (pack) => (key, vars) => {
    let text = pack[key] ?? key;
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, String(value));
        }
    }
    return text;
};

const t = makeT(EN);
const tAr = makeT(AR);

describe('commissionRuleType', () => {
    it('loads Fixed (any case) and Percentage from a saved rule', () => {
        assert.equal(normalizeCommissionType('fixed'), 'Fixed');
        assert.equal(normalizeCommissionType('FIXED'), 'Fixed');
        assert.equal(normalizeCommissionType('Percentage'), 'Percentage');
        assert.equal(normalizeCommissionType(''), 'Percentage');
        assert.deepEqual(commissionTypeFieldsFromRule({ commissionType: 'fixed', useProfilePercent: true }), {
            commissionType: 'Fixed',
            useProfilePercent: false,
        });
        assert.deepEqual(
            commissionTypeFieldsFromRule({ commissionType: 'Percentage', useProfilePercent: true }),
            { commissionType: 'Percentage', useProfilePercent: true },
        );
    });

    it('payload carries the type and forces profile off for Fixed', () => {
        assert.deepEqual(commissionTypePayload('Fixed', 150, true), {
            commissionType: 'Fixed',
            useProfilePercent: false,
            value: 150,
        });
        assert.deepEqual(commissionTypePayload('Percentage', 20, true), {
            commissionType: 'Percentage',
            useProfilePercent: true,
            value: 0,
        });
    });

    it('rejects 150 for Percentage but accepts it for Fixed; negatives fail', () => {
        assert.equal(commissionValueError('Percentage', 150, false), 'percentage');
        assert.equal(isCommissionValueValid('Percentage', 150, false), false);
        assert.equal(commissionValueError('Fixed', 150, false), '');
        assert.equal(isCommissionValueValid('Fixed', 150, false), true);
        assert.equal(commissionValueError('Fixed', -1, false), 'negative');
        assert.equal(commissionValueError('Percentage', -0.1, false), 'negative');
        assert.equal(commissionValueError('Fixed', 100001, false), 'fixed');
    });

    it('maps negative Percentage to the 0–100 key and Fixed negatives to the Fixed range key', () => {
        assert.equal(
            commissionValueErrorKey('Percentage', -1, false),
            'rules.err.rateRange',
        );
        assert.equal(
            commissionValueErrorKey('Fixed', -1, false),
            'rules.err.fixedRange',
        );
        assert.equal(
            commissionValueErrorKey('Percentage', 150, false),
            'rules.err.rateRange',
        );
        assert.equal(
            commissionValueErrorKey('Fixed', 100001, false),
            'rules.err.fixedRange',
        );
    });

    it('forces profile % off when switching to Fixed', () => {
        const next = applyCommissionTypeChange(
            { commissionType: 'Percentage', useProfilePercent: true, value: '10' },
            'Fixed',
        );
        assert.equal(next.commissionType, 'Fixed');
        assert.equal(next.useProfilePercent, false);
    });

    it('formats rate labels in EN and AR for both types', () => {
        assert.equal(
            formatCommissionRuleRate({ commissionType: 'Fixed', value: 10 }, t),
            'SAR 10 per unit',
        );
        assert.equal(
            formatCommissionRuleRate({ commissionType: 'Percentage', value: 20 }, t),
            '20%',
        );
        assert.equal(
            formatCommissionRuleRate({ commissionType: 'Percentage', useProfilePercent: true }, t),
            'Profile %',
        );
        assert.equal(
            formatCommissionRuleRate({ commissionType: 'Fixed', value: 10 }, tAr),
            '10 ر.س لكل وحدة',
        );
        assert.equal(
            formatCommissionFormRate({ commissionType: 'Percentage', value: '12.5' }, t),
            '12.5%',
        );
        assert.equal(
            formatCommissionFormRate({ commissionType: 'Fixed', value: '7' }, tAr),
            '7 ر.س لكل وحدة',
        );
    });
});
