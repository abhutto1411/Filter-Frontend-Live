/** Technician rule roles (`Technician` = every technician). */
export const COMMISSION_TECHNICIAN_ROLES = ['Technician', 'workshop', 'on_call'];

/** Non-technician staff that earn rule commission per invoice. */
export const COMMISSION_STAFF_ROLES = ['cashier', 'manager', 'supervisor', 'team_leader'];

/** Every rule `employeeRole` value understood by the commission engine. */
export const COMMISSION_RULE_ROLES = [...COMMISSION_TECHNICIAN_ROLES, ...COMMISSION_STAFF_ROLES];

/** Role selector groups: technicians first (with a type sub-choice), then staff roles. */
export const COMMISSION_ROLE_GROUPS = ['technician', ...COMMISSION_STAFF_ROLES];

export const isTechnicianRuleRole = (role) => !COMMISSION_STAFF_ROLES.includes(String(role || '').toLowerCase());

export const commissionRoleGroup = (role) => (isTechnicianRuleRole(role) ? 'technician' : String(role).toLowerCase());

/** Rule payload key holding the "specific people" ids for a role. */
export const commissionPeopleKey = (role) => {
    const group = commissionRoleGroup(role);
    if (group === 'technician') return 'employeeRecordIds';
    if (group === 'cashier') return 'cashierIds';
    return 'staffUserIds';
};

export const COMMISSION_RULE_APPLIES_TO = ['all', 'products', 'services'];
