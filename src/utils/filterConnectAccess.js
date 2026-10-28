/**
 * FILTER CONNECT is opt-in. Unlike Phase-1 `hasPermission`, an empty / missing
 * permission set is NOT a grant — only Super Admin system access or an
 * explicit Connect code on the assigned role.
 */
export const FILTER_CONNECT_PERMISSION_CODES = [
    'filter-connect.view',
    'workshop.filter-connect.view',
];

function toCodeSet(input) {
    if (!input) return new Set();
    if (input instanceof Set) return input;
    if (Array.isArray(input)) return new Set(input.filter(Boolean).map(String));
    return new Set();
}

export function canAccessFilterConnect(user, userPermissions) {
    if (!user) return false;
    if (user.userType === 'platform_admin' && (!user.role || user.role?.isSystem)) {
        return true;
    }
    const set = toCodeSet(userPermissions);
    return FILTER_CONNECT_PERMISSION_CODES.some((code) => set.has(code));
}
