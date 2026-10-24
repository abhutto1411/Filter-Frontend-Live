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
assert(
    canVisitAdminPath('/admin/approvals/admin_wallet_expense_request/256?action=approve', {
        user: sabith,
        hasPermission: sabithHas,
    }),
    'Sabith must open expense approve screen (not bounce)',
);
assert(
    canVisitAdminPath('/admin/approvals/admin_wallet_expense_request/256', {
        user: sabith,
        hasPermission: sabithHas,
    }),
    'Sabith must open expense details',
);
assert(
    canVisitAdminPath('/admin/approvals/admin_wallet_expense_request/256?action=reject', {
        user: sabith,
        hasPermission: sabithHas,
    }),
    'Sabith must open expense reject screen',
);
assert(
    canVisitAdminPath('/admin/approvals/admin_wallet_fund_request/12?action=approve', {
        user: sabith,
        hasPermission: sabithHas,
    }),
    'Sabith must open fund approve screen',
);

const asstBdmCodes = new Set([
    'approvals.view',
    'approvals.admin-wallet-expense-request.view',
    'approvals.admin-wallet-expense-request.approve',
    'approvals.admin-wallet-expense-request.reject',
    'approvals.admin-wallet-fund-request.view',
    'approvals.admin-wallet-fund-request.approve',
    'approvals.admin-wallet-fund-request.reject',
    'admin-wallets.view',
]);
const asstBdmHas = (code) => Boolean(code) && asstBdmCodes.has(code);
const asstBdm = { userType: 'platform_admin', role: { name: 'Asst. BDM', isSystem: false } };
assert(
    canVisitAdminPath('/admin/approvals/admin_wallet_expense_request/1301?action=approve', {
        user: asstBdm,
        hasPermission: asstBdmHas,
    }),
    'Asst. BDM must stay on expense approve URL',
);
assert(
    !canVisitAdminPath('/admin/permissions', { user: asstBdm, hasPermission: asstBdmHas }),
    'Asst. BDM still denied pages they were not granted',
);

const systemHas = () => true;
const systemAdmin = { userType: 'platform_admin', role: { isSystem: true } };
assert(canVisitAdminPath('/admin/legal-pages', { user: systemAdmin, hasPermission: systemHas }), 'Super Admin system allowed legal-pages');

console.log('adminPageAccess: 16 checks passed');
