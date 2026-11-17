import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ledgerCommissionRateDisplay } from './ledgerCommissionRateDisplay.js';

describe('ledgerCommissionRateDisplay', () => {
    it('Fixed hides rate_percent and uses dash + fixed title key', () => {
        assert.deepEqual(
            ledgerCommissionRateDisplay({ ruleCommissionType: 'Fixed', ratePercent: 0 }),
            { text: '-', titleKey: 'ledger.rate.fixedTitle' },
        );
    });

    it('Percentage keeps the percent text', () => {
        assert.deepEqual(
            ledgerCommissionRateDisplay({ ruleCommissionType: 'Percentage', ratePercent: 10 }),
            { text: '10%', titleKey: null },
        );
    });

    it('null type keeps today’s percent display', () => {
        assert.deepEqual(
            ledgerCommissionRateDisplay({ ruleCommissionType: null, ratePercent: 5 }),
            { text: '5%', titleKey: null },
        );
        assert.deepEqual(
            ledgerCommissionRateDisplay({ ruleCommissionType: undefined, ratePercent: null }),
            { text: null, titleKey: null },
        );
    });

    it('unknown type keeps today’s percent display', () => {
        assert.deepEqual(
            ledgerCommissionRateDisplay({ ruleCommissionType: 'bogus', ratePercent: 12 }),
            { text: '12%', titleKey: null },
        );
    });

    it('legacy lowercase fixed / percentage', () => {
        assert.deepEqual(
            ledgerCommissionRateDisplay({ ruleCommissionType: 'fixed', ratePercent: 0 }),
            { text: '-', titleKey: 'ledger.rate.fixedTitle' },
        );
        assert.deepEqual(
            ledgerCommissionRateDisplay({ ruleCommissionType: 'percentage', ratePercent: 7.5 }),
            { text: '7.5%', titleKey: null },
        );
    });
});
