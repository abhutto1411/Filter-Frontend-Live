import { adminViewPermissionForNav, canVisitAdminPath } from './adminPageAccess.js';

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

assert(adminViewPermissionForNav('legal-pages') === 'legal-pages.view', 'legal-pages maps to view');
assert(adminViewPermissionForNav('mobile-app-menu') === 'mobile-app-menu.view', 'mobile-app-menu maps to view');
assert(adminViewPermissionForNav('brand-new-page') === 'brand-new-page.view', 'unknown pages fail-closed to <path>.view');
assert(adminViewPermissionForNav('my-wallet') === null, 'my-wallet is wallet-flagged');

const sabithCodes = new Set(['approvals.view', 'inventory.master-catalog.view', 'customers.all-customers.view', 'sales.workshop-sales.view']);
const sabithHas = (code) => Boolean(code) && sabithCodes.has(code);
const sabith = { userType: 'platform_admin', role: { name: 'MAIN ADMIN', isSystem: false } };

assert(!canVisitAdminPath('/admin/legal-pages', { user: sabith, hasPermission: sabithHas }), 'Sabith denied legal-pages');
assert(!canVisitAdminPath('/admin/mobile-app-menu', { user: sabith, hasPermission: sabithHas }), 'Sabith denied mobile-app-menu');
assert(!canVisitAdminPath('/admin/filter-connect', { user: sabith, hasPermission: sabithHas }), 'Sabith denied FILTER CONNECT');
assert(!canVisitAdminPath('/admin/fleet-management', { user: sabith, hasPermission: sabithHas }), 'Sabith denied placeholder fleet');
assert(canVisitAdminPath('/admin/approvals', { user: sabith, hasPermission: sabithHas }), 'Sabith allowed approvals');

const systemHas = () => true;
const systemAdmin = { userType: 'platform_admin', role: { isSystem: true } };
assert(canVisitAdminPath('/admin/legal-pages', { user: systemAdmin, hasPermission: systemHas }), 'Super Admin system allowed legal-pages');

console.log('adminPageAccess: 10 checks passed');
