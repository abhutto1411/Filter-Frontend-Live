/** Mirror of BE system roles the locker UI may hit (minimal set for next-code type). */
const ROLE_META = {
    LOCKER_COLLECTION_EXPENSE_CLEARING: { type: 'ASSET', subType: 'CURRENT' },
};

export function getSystemRoleDef(role) {
    return ROLE_META[String(role || '')] || null;
}