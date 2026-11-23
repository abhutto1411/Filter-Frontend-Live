/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { cardSubs } from './dashboardKpiCards';
import { wsDashT } from '../../utils/workshopDashboardI18n';

describe('dashboardKpiCards captions', () => {
    const t = (key, vars) => wsDashT('en', key, vars);

    it('point-in-time cards use As of kpiAsOf, not inventory basis', () => {
        const subs = cardSubs({
            id: 'inventoryValue',
            kpiAsOf: '30/09/2026',
            status: 'ok',
        }, t);
        expect(subs).toContain('As of 30/09/2026');
        expect(subs.some((l) => /as of now/i.test(l))).toBe(false);
        expect(subs.some((l) => /latest purchase/i.test(l))).toBe(false);
    });

    it('gross margin uses grossMarginPercent', () => {
        const subs = cardSubs({ id: 'grossMargin', grossMarginPercent: 42.5, status: 'ok' }, t);
        expect(subs.some((l) => l.includes('42.50') && l.includes('net sales'))).toBe(true);
    });
});