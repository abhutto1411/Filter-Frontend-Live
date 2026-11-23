/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formatCashGuardMessage } from '../../utils/cashGuardMessage';
import { workshopCoaCashGuardLang } from './WorkshopCOAView';

describe('WorkshopCOAView cash-guard locale (E6)', () => {
    let prevLang;

    beforeEach(() => {
        prevLang = document.documentElement.lang;
        document.documentElement.lang = 'en';
    });

    afterEach(() => {
        document.documentElement.lang = prevLang;
    });

    it('uses portal locale ar when document.lang is en', () => {
        expect(workshopCoaCashGuardLang('ar')).toBe('ar');
        const msg = formatCashGuardMessage(
            {
                code: 'INSUFFICIENT_CASH_BALANCE',
                accountCode: '1004',
                accountName: 'Cash',
                available: 0,
                required: 1,
            },
            workshopCoaCashGuardLang('ar'),
        );
        expect(msg).toMatch(/غير كاف/);
        expect(msg).not.toMatch(/Insufficient balance/);
    });
});