import { isPlatformSuperAdmin } from '../../utils/allowNegativeBalance';
import { HQ_ACCOUNTING_TABS } from './saAccountingScope';

/** Extra monitor tabs for Super Admin heading-reclass access (not for workshop roles). */
export const SA_HEADING_RECLASS_TABS = [
    { path: 'settings', labelKey: 'nav.acc.settings' },
    { path: 'heading-reclass', labelKey: 'tab.headingReclass' },
];

const SA_ONLY_HQ_PATHS = new Set(['settings', 'heading-reclass']);

export function canShowSaHeadingReclassTabs(user) {
    return isPlatformSuperAdmin(user);
}

/** HQ tab list: Settings + Heading reclass only for real platform Super Admin. */
export function hqTabsForUser(user) {
    const tabs = Array.isArray(HQ_ACCOUNTING_TABS) ? HQ_ACCOUNTING_TABS : [];
    if (canShowSaHeadingReclassTabs(user)) return tabs;
    return tabs.filter((t) => !SA_ONLY_HQ_PATHS.has(t.path));
}

export function monitorTabsWithSaHeadingReclass(baseTabs, user) {
    const tabs = Array.isArray(baseTabs) ? [...baseTabs] : [];
    if (!canShowSaHeadingReclassTabs(user)) return tabs;
    const have = new Set(tabs.map((t) => t.path));
    for (const extra of SA_HEADING_RECLASS_TABS) {
        if (!have.has(extra.path)) tabs.push(extra);
    }
    return tabs;
}

/** Resolve the workshop id for admin Settings / Heading reclass panels. */
export function saScopedWorkshopId(scope) {
    if (!scope || typeof scope !== 'object') return '';
    if (scope.type === 'hq') return String(scope.hqWorkshopId || '');
    if (scope.type === 'workshop') return String(scope.workshopId || '');
    return '';
}
