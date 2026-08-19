/** Which login portals require workshop + branch linkage. */
export function portalRequiresWorkshopScope(portal) {
    return portal === 'workshop' || portal === 'cashier' || portal === 'technician';
}

/** Maps permissions UI portal id → backend userType for login routing. */
export function userTypeForPortal(portal, workshopStaffRole = null) {
    if (portal === 'super_admin') return 'platform_admin';
    if (portal === 'cashier') return 'cashier_user';
    if (portal === 'corporate') return 'corporate_user';
    if (portal === 'supplier') return 'supplier_user';
    if (workshopStaffRole === 'workshop_owner') return 'workshop_owner';
    return 'workshop_user';
}

/** Human-readable login path hint for the selected portal. */
export function portalLoginHint(portal) {
    switch (portal) {
        case 'super_admin':
            return 'User signs in at the Super Admin portal (/admin).';
        case 'workshop':
            return 'User signs in at the Workshop portal (/workshop).';
        case 'cashier':
            return 'User signs in at the Cashier POS portal. Requires cashier profile linkage.';
        case 'technician':
            return 'User signs in at the Technician app. Requires an active technician employee record.';
        case 'corporate':
            return 'User signs in at the Corporate portal. Requires corporate account linkage.';
        case 'supplier':
            return 'User signs in at the Supplier portal. Requires supplier profile linkage.';
        default:
            return '';
    }
}
