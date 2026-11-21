/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import {
    canShowSaHeadingReclassTabs,
    hqTabsForUser,
    monitorTabsWithSaHeadingReclass,
    saScopedWorkshopId,
    SA_HEADING_RECLASS_TABS,
} from './saHeadingReclassTabs';
import { HQ_ACCOUNTING_TABS } from './saAccountingScope';

function pathsIncludeBoth(paths) {
    return paths.includes('settings') && paths.includes('heading-reclass');
}

describe('saHeadingReclassTabs', () => {
    const cases = [
        {
            name: 'platform_admin, no role',
            user: { userType: 'platform_admin', type: 'admin' },
            include: true,
        },
        {
            name: 'platform_admin + system role',
            user: {
                userType: 'platform_admin',
                type: 'admin',
                role: { isSystem: true, name: 'Super Admin' },
            },
            include: true,
        },
        {
            name: 'platform_admin + custom non-system role',
            user: {
                userType: 'platform_admin',
                type: 'admin',
                role: { isSystem: false, name: 'Limited' },
            },
            include: false,
        },
        {
            name: 'platform_admin + permissionSource override',
            user: {
                userType: 'platform_admin',
                type: 'admin',
                permissionSource: 'override',
            },
            include: false,
        },
        {
            name: 'type admin without platform_admin',
            user: { type: 'admin' },
            include: false,
        },
        {
            name: 'workshop_owner',
            user: { userType: 'workshop_owner' },
            include: false,
        },
    ];

    for (const c of cases) {
        it(`${c.name}: HQ + monitor tabs`, () => {
            expect(canShowSaHeadingReclassTabs(c.user)).toBe(c.include);
            const hqPaths = hqTabsForUser(c.user).map((t) => t.path);
            const monPaths = monitorTabsWithSaHeadingReclass(
                [{ path: 'chart-of-accounts', labelKey: 'tab.coa' }],
                c.user,
            ).map((t) => t.path);
            expect(pathsIncludeBoth(hqPaths)).toBe(c.include);
            expect(pathsIncludeBoth(monPaths)).toBe(c.include);
            if (c.include) {
                expect(hqPaths).toEqual(HQ_ACCOUNTING_TABS.map((t) => t.path));
            }
        });
    }

    it('keeps SA_HEADING_RECLASS_TABS length 2', () => {
        expect(SA_HEADING_RECLASS_TABS).toHaveLength(2);
    });

    it('resolves workshop scope id for API calls', () => {
        expect(saScopedWorkshopId({ type: 'workshop', workshopId: '42' })).toBe('42');
        expect(saScopedWorkshopId({ type: 'hq', hqWorkshopId: '9' })).toBe('9');
        expect(saScopedWorkshopId({ type: 'supplier', supplierId: '1' })).toBe('');
    });
});
