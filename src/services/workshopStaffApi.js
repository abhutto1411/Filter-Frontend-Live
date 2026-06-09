import { apiFetch } from './api';

/** Build a query string for GET requests (omits null/undefined/empty). */
export function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v != null && v !== '' && String(v) !== 'undefined') p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

/**
 * Optional `branchId` for workshop-staff list endpoints when the sidebar branch is not "all".
 * Backends may ignore this if unsupported; callers can still client-filter rows when fields exist.
 */
export function branchScopeParams(selectedBranchId) {
    if (selectedBranchId == null || selectedBranchId === '' || selectedBranchId === 'all') return {};
    return { branchId: String(selectedBranchId) };
}

/**
 * For GET /workshop-staff/products, /workshop-staff/commissions, etc.:
 * one branch → `branchId`; workshop-wide in the UI → `allBranches=true` (API limits this to **active** branches only).
 */
export function workshopStaffListScopeQuery(selectedBranchId) {
    if (selectedBranchId == null || selectedBranchId === '' || selectedBranchId === 'all') {
        return { allBranches: true };
    }
    return { branchId: String(selectedBranchId) };
}

function unwrapList(res, keys = ['data', 'technicians', 'cashiers', 'users', 'items']) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    for (const k of keys) {
        const v = res[k];
        if (Array.isArray(v)) return v;
    }
    const data = res.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const k of keys) {
            const v = data[k];
            if (Array.isArray(v)) return v;
        }
    }
    return [];
}

export function unwrapWorkshopStaffList(res, kind) {
    const keys =
        kind === 'technician'
            ? ['technicians', 'data', 'items', 'users', 'rows', 'results', 'list']
            : ['cashiers', 'data', 'items', 'users', 'rows', 'results', 'list'];
    return unwrapList(res, keys);
}

/**
 * Workshop JWT — list technicians for this workshop.
 * Supported query params: `branchId` (filter to one branch), `isActive`
 * ('true' | 'false'). With nothing passed, returns the workshop-wide list.
 */
export const getWorkshopTechnicians = (params = {}) =>
    apiFetch(`/workshop-staff/technicians${qs(params)}`);

/**
 * Workshop JWT — list cashiers.
 * Supported query params: `branchId`, `isActive` ('true' | 'false').
 */
export const getWorkshopCashiers = (params = {}) =>
    apiFetch(`/workshop-staff/cashiers${qs(params)}`);

/**
 * Workshop JWT — unified list (staff + technicians + cashiers merged on the server).
 * GET /workshop-staff/employees — optional: branchId, employeeType (staff | technician | cashier),
 * isActive, limit, offset.
 * POST /workshop-staff/employees — same filters in JSON body (GetEmployeesDto).
 */
export const getWorkshopEmployees = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/employees${qs(params)}`, options);

export const postWorkshopEmployees = (body = {}, options = {}) =>
    apiFetch('/workshop-staff/employees', {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
        signal: options.signal,
        headers: options.headers,
    });

/** Stable select value — ids overlap across employees, cashiers, and portal users. */
export function workshopStaffSelectValue(row) {
    if (!row) return '';
    const type = row.recordType || 'employee';
    return `${type}:${String(row.id ?? '')}`;
}

/** Parse `workshopStaffSelectValue` back to record type + bare id. */
export function parseWorkshopStaffSelectValue(value) {
    if (!value) return { recordType: 'employee', id: '', compositeKey: '' };
    const s = String(value);
    const idx = s.indexOf(':');
    if (idx <= 0) {
        return { recordType: 'employee', id: s, compositeKey: `employee:${s}` };
    }
    return {
        recordType: s.slice(0, idx),
        id: s.slice(idx + 1),
        compositeKey: s,
    };
}

export function indexWorkshopStaffBySelectValue(employees) {
    return Object.fromEntries(
        (employees ?? []).map((e) => [workshopStaffSelectValue(e), e]),
    );
}

/** Unwrap GET/POST /workshop-staff/employees list payloads. */
export function unwrapWorkshopEmployeesList(res) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    const keys = ['employees', 'items', 'rows', 'results', 'list'];
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res.data)) return res.data;
    return [];
}

/** GET one technician (often includes user/email fields omitted from list responses). */
export const getWorkshopTechnicianById = (id) =>
    apiFetch(`/workshop-staff/technicians/${encodeURIComponent(String(id))}`);

/** GET one cashier. */
export const getWorkshopCashierById = (id) =>
    apiFetch(`/workshop-staff/cashiers/${encodeURIComponent(String(id))}`);

/**
 * Merge inner DTO when the API wraps rows as `{ technician: {...} }` or `{ cashier: {...} }`.
 * @param {object} row
 * @param {'technician'|'cashier'} kind
 */
export function flattenWorkshopStaffRow(row, kind) {
    if (row == null || typeof row !== 'object') return row;
    const inner =
        kind === 'technician'
            ? row.technician ?? row.technicianUser ?? row.tech ?? row.staff
            : row.cashier ?? row.cashierUser ?? row.staff;
    let base;
    if (inner != null && typeof inner === 'object' && !Array.isArray(inner)) {
        base = { ...inner, ...row };
    } else {
        base = row;
    }
    const emp = base.employee && typeof base.employee === 'object' ? base.employee : null;
    if (!emp) return base;
    return {
        ...base,
        basicSalary: base.basicSalary ?? emp.basicSalary ?? emp.basic_salary,
        commissionPercent: base.commissionPercent ?? emp.commissionPercent ?? emp.commission_percent,
        commissionType: base.commissionType ?? emp.commissionType ?? emp.commission_type,
        iqama:
            base.iqama ??
            emp.iqama ??
            emp.nationalId ??
            emp.national_id ??
            emp.cnic,
    };
}

/**
 * Single-resource JSON from GET /technicians/:id or POST create response.
 * @param {object} res
 * @param {'technician'|'cashier'} kind
 */
export function unwrapWorkshopStaffDetail(res, kind) {
    if (res == null || typeof res !== 'object') return null;
    const keys =
        kind === 'technician'
            ? ['technician', 'data', 'employee', 'profile', 'result', 'payload']
            : ['cashier', 'data', 'employee', 'profile', 'result', 'payload'];
    for (const k of keys) {
        const v = res[k];
        if (v != null && typeof v === 'object' && !Array.isArray(v)) {
            return flattenWorkshopStaffRow(v, kind);
        }
    }
    if (
        res.id != null ||
        res.userId != null ||
        res._id != null ||
        res.name != null ||
        res.mobile != null ||
        res.phone != null
    ) {
        return flattenWorkshopStaffRow(res, kind);
    }
    return null;
}

/**
 * Create a technician.
 * Preferred route: POST /workshop-staff/technician/create.
 * Backward compatibility: if unavailable, fallback to POST /workshop-staff/technicians.
 * Body: { name, mobile, email?, password?, technicianType?, workshopDuty?, oncallAvailable?, commissionPercent,
 *         branchId?, departmentIds?, basicSalary?, iqama? }.
 */
export const createWorkshopTechnician = async (body) => {
    try {
        return await apiFetch('/workshop-staff/technician/create', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    } catch (primaryErr) {
        // Older backends used the plural route for create.
        try {
            return await apiFetch('/workshop-staff/technicians', {
                method: 'POST',
                body: JSON.stringify(body),
            });
        } catch {
            throw primaryErr;
        }
    }
};

/**
 * Create a cashier / non-technician staff (manager, supervisor, etc.).
 * Same guards and body (CreateCashierDto) as either:
 *   POST /workshop-staff/cashier/create (canonical) or
 *   POST /workshop-staff/cashiers (plural alias — same handler).
 * Tries singular first, then plural, so either route stays compatible.
 */
export const createWorkshopCashier = async (body) => {
    try {
        return await apiFetch('/workshop-staff/cashier/create', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    } catch (primaryErr) {
        try {
            return await apiFetch('/workshop-staff/cashiers', {
                method: 'POST',
                body: JSON.stringify(body),
            });
        } catch {
            throw primaryErr;
        }
    }
};

const PORTAL_STAFF_ROLE_ALIASES = {
    manager: 'manager',
    supervisor: 'supervisor',
    team_leader: 'team-leader',
};

const DEPT_KEYS_PORTAL = [
    'departmentId',
    'department_id',
    'departmentIds',
    'department_ids',
    'teamLeaderDepartmentId',
    'team_leader_department_id',
];

export function stripPortalDepartmentFields(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = { ...obj };
    for (const k of DEPT_KEYS_PORTAL) delete out[k];
    return out;
}

const PORTAL_PATCH_TECH_KEYS = ['workshopDuty', 'oncallAvailable', 'technicianType'];

/**
 * Shape a PATCH /workshop-staff/portal-staff/:id body from the shared staff payload.
 * Omits `role` / `staffRole`; strips department keys for manager/supervisor; mirrors `password` → `newPassword`.
 */
export function buildPortalStaffPatchPayload(body, staffRole) {
    if (!body || typeof body !== 'object') return body;
    const roleKey = String(staffRole ?? '').toLowerCase().replace(/\s+/g, '_');
    const isLockerRole = roleKey === 'locker_supervisor' || roleKey === 'locker_collector';
    const patch = { ...body };
    delete patch.role;
    delete patch.staffRole;
    delete patch.staff_role;
    for (const k of PORTAL_PATCH_TECH_KEYS) {
        if (patch[k] !== undefined) delete patch[k];
    }
    if (roleKey !== 'team_leader') {
        stripPortalDepartmentFields(patch);
    }
    if (isLockerRole) {
        // Locker users are workshop-wide — never patch a branch on them, the
        // backend will reject it with 400.
        delete patch.branchId;
        delete patch.branch_id;
        delete patch.branch;
    }
    if (patch.password) {
        patch.newPassword = patch.password;
    }
    if (!isLockerRole && patch.branchId != null && patch.branch === undefined) {
        patch.branch = patch.branchId;
    }
    return patch;
}

/**
 * Workshop portal staff (manager | supervisor | team_leader), same workshop JWT family as owner.
 * POST /workshop-staff/portal-staff — team_leader requires departmentId (or department_id); manager/supervisor must not send department fields (400).
 * Fallback: POST /workshop-staff/{manager|supervisor|team-leader}/create — body without staffRole (CreateTeamLeaderDto requires departmentId for team-leader).
 */
export const createWorkshopPortalStaff = async (body) => {
    const staffRole = body?.staffRole ?? body?.staff_role;
    if (!staffRole) {
        throw new Error(
            'staffRole is required (manager, supervisor, team_leader, locker_supervisor, or locker_collector).',
        );
    }
    const roleKey = String(staffRole).toLowerCase();
    const aliasSlug = PORTAL_STAFF_ROLE_ALIASES[roleKey];
    const isLockerRole = roleKey === 'locker_supervisor' || roleKey === 'locker_collector';

    if (roleKey === 'team_leader') {
        const dept = body?.departmentId ?? body?.department_id;
        if (dept == null || String(dept).trim() === '') {
            throw new Error('departmentId is required for team_leader (must be in workshop + branch departments).');
        }
    }

    // Locker users are workshop-wide — strip branch + dept fields so the BE
    // doesn't try to validate them. Manager / supervisor (workshop portal)
    // already strip dept fields; team_leader keeps them.
    let portalPayload;
    if (isLockerRole) {
        portalPayload = stripPortalDepartmentFields(body);
        // Locker users are not tied to a branch; remove any stale branch keys.
        delete portalPayload.branchId;
        delete portalPayload.branch_id;
        delete portalPayload.branch;
    } else if (roleKey === 'manager' || roleKey === 'supervisor') {
        portalPayload = stripPortalDepartmentFields(body);
    } else {
        portalPayload = { ...body };
    }

    const { staffRole: _sr, staff_role: _sr2, role: _r, ...restForAlias } = portalPayload;
    const aliasBody =
        roleKey === 'manager' || roleKey === 'supervisor'
            ? stripPortalDepartmentFields(restForAlias)
            : { ...restForAlias };

    try {
        return await apiFetch('/workshop-staff/portal-staff', {
            method: 'POST',
            body: JSON.stringify(portalPayload),
        });
    } catch (primaryErr) {
        // Locker roles have no `/workshop-staff/{role}/create` alias.
        if (!aliasSlug || isLockerRole) throw primaryErr;
        try {
            return await apiFetch(`/workshop-staff/${aliasSlug}/create`, {
                method: 'POST',
                body: JSON.stringify(aliasBody),
            });
        } catch {
            throw primaryErr;
        }
    }
};

/** GET one portal staff row by **users.id** (optional; hydrates edit modal). */
export const getWorkshopPortalStaffById = (id) =>
    apiFetch(`/workshop-staff/portal-staff/${encodeURIComponent(String(id))}`);

/**
 * Single-resource JSON from GET /workshop-staff/portal-staff/:id (shape may mirror cashier create).
 * @param {object} res
 */
export function unwrapWorkshopPortalStaffDetail(res) {
    if (res == null || typeof res !== 'object') return null;
    const keys = ['portalStaff', 'data', 'user', 'employee', 'profile', 'result', 'payload'];
    for (const k of keys) {
        const v = res[k];
        if (v != null && typeof v === 'object' && !Array.isArray(v)) {
            return flattenWorkshopStaffRow(v, 'cashier');
        }
    }
    if (
        res.id != null ||
        res.userId != null ||
        res._id != null ||
        res.name != null ||
        res.mobile != null ||
        res.phone != null
    ) {
        return flattenWorkshopStaffRow(res, 'cashier');
    }
    return null;
}

/**
 * PATCH portal staff — **id is users.id** (employees list `recordType: "portal_user"`).
 * UpdatePortalStaffDto: name, email, mobile, branch / branchId, isActive, password / newPassword,
 * departmentId (team leaders), basicSalary, commissionPercent, commissionType, iqama (+ snake_case / nationalId aliases).
 */
export const updateWorkshopPortalStaff = (id, body) =>
    apiFetch(`/workshop-staff/portal-staff/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

/** Patch a technician. All fields optional: name, mobile, email, password, branchId, technicianType, workshopDuty, oncallAvailable, commissionPercent, basicSalary, iqama, departmentIds, isActive. */
export const updateWorkshopTechnician = (id, body) =>
    apiFetch(`/workshop-staff/technicians/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

/**
 * Patch a cashier / non-technician staff row.
 * Canonical: PATCH /workshop-staff/cashier/:id — plural PATCH /workshop-staff/cashiers/:id is an alias (same handler).
 * Tries singular first, then plural, for older stacks that only exposed one route.
 */
export const updateWorkshopCashier = async (id, body) => {
    const sid = encodeURIComponent(String(id));
    try {
        return await apiFetch(`/workshop-staff/cashier/${sid}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    } catch (primaryErr) {
        try {
            return await apiFetch(`/workshop-staff/cashiers/${sid}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
        } catch {
            throw primaryErr;
        }
    }
};

export const deleteWorkshopTechnician = (id) =>
    apiFetch(`/workshop-staff/technicians/${id}`, { method: 'DELETE' });

/**
 * DELETE /workshop-staff/cashier/:id — plural …/cashiers/:id is an alias. Singular first, then plural.
 */
export const deleteWorkshopCashier = async (id) => {
    const sid = encodeURIComponent(String(id));
    try {
        return await apiFetch(`/workshop-staff/cashier/${sid}`, { method: 'DELETE' });
    } catch (primaryErr) {
        try {
            return await apiFetch(`/workshop-staff/cashiers/${sid}`, { method: 'DELETE' });
        } catch {
            throw primaryErr;
        }
    }
};

/**
 * Delete a workshop portal staff user (manager / supervisor / team_leader).
 * `id` is `users.id` (matches the recordType: 'portal_user' rows on GET /employees).
 * Works for any approval state (pending / approved / rejected).
 */
export const deleteWorkshopPortalStaff = (id) =>
    apiFetch(`/workshop-staff/portal-staff/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });

export const getWorkshopBranches = () => apiFetch('/workshop-staff/branches');

/** Cash/bank registers — each row is auto-linked to a Current Asset COA account for the workshop. */
export const listWorkshopCashBankAccounts = (params = {}) =>
    apiFetch(`/workshop-staff/cash-bank/accounts${qs(params)}`);

export const createWorkshopCashBankAccount = (body) =>
    apiFetch('/workshop-staff/cash-bank/accounts', {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const updateWorkshopCashBankAccount = (id, body) =>
    apiFetch(`/workshop-staff/cash-bank/accounts/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body ?? {}),
    });

/** SoftPOS terminals — for linking a cash/bank register as settlement account (same branch). */
export const listWorkshopCashBankPosTerminals = () =>
    apiFetch('/workshop-staff/cash-bank/pos-terminals');

/** Internal transfer between two workshop registers (debit + credit, same reference). */
export const internalTransferWorkshopCashBank = (body) =>
    apiFetch('/workshop-staff/cash-bank/internal-transfer', {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

/** Set or clear a branch's default cash/bank operating register. */
export const setBranchDefaultAccounts = (branchId, body) =>
    apiFetch(`/workshop-staff/branches/${encodeURIComponent(String(branchId))}/default-accounts`, {
        method: 'PATCH',
        body: JSON.stringify(body ?? {}),
    });

/** Phase 2 migration: provision system registers + sync balances with GL. */
export const resetCashFlowV3 = () =>
    apiFetch('/workshop-staff/accounting/reset-cash-flow-v3', { method: 'POST' });

/** Normalize GET /workshop-staff/branches payloads (top-level or nested). */
export function unwrapWorkshopBranchesResponse(res) {
    if (!res || typeof res !== 'object') return [];
    if (Array.isArray(res.branches)) return res.branches;
    if (Array.isArray(res.data?.branches)) return res.data.branches;
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
}

/** Workshop portal: treat branch as non-selectable / hidden when inactive. */
export function isWorkshopPortalBranchInactive(b) {
    if (b == null || typeof b !== 'object') return false;
    if (String(b.status ?? '').toLowerCase() === 'inactive') return true;
    if (b.isActive === false) return true;
    return false;
}

/**
 * Drop inactive workshop branches for pickers, labels, and lists.
 * @param {unknown[]} list
 * @param {{ includeInactive?: boolean }} [opts] Pass `{ includeInactive: true }` on branch-management screens that must list every branch.
 */
export function filterPortalVisibleBranches(list, opts = {}) {
    const { includeInactive = false } = opts;
    if (!Array.isArray(list)) return [];
    if (includeInactive) return list;
    return list.filter((b) => !isWorkshopPortalBranchInactive(b));
}

/**
 * Workshop JWT — nested tree for one branch (departments → categories → items).
 * Use when the UI needs hierarchy (e.g. POS menus). Prefer flat lists below for tables/dropdowns.
 */
export const getWorkshopStaffBranchCatalog = (branchId, { signal } = {}) =>
    apiFetch(`/workshop-staff/branches/${encodeURIComponent(branchId)}/catalog`, { signal });

/**
 * Workshop JWT — flat branch product list. Branch is always in the path.
 * `workshopId` query is optional: the backend uses `query.workshopId || req.user.workshopId`.
 * Omit it for normal workshop tokens; pass it for impersonation / super-admin-style flows.
 */
export const getWorkshopStaffBranchProducts = (branchId, { signal, workshopId, supplierId } = {}) =>
    apiFetch(
        `/workshop-staff/branches/${encodeURIComponent(branchId)}/products${qs({ workshopId, supplierId })}`,
        { signal },
    );

/** Flat branch service list (same contract as products). */
export const getWorkshopStaffBranchServices = (branchId, { signal, workshopId } = {}) =>
    apiFetch(
        `/workshop-staff/branches/${encodeURIComponent(branchId)}/services${qs({ workshopId })}`,
        { signal },
    );

/**
 * GET /workshop-staff/products — **branchId** (or **branch_id**) is required unless **allBranches=true**
 * (workshop-wide union). Prefer `getWorkshopStaffBranchProducts(id)` where the branch is always in the path.
 *
 * `workshopId` is optional when the JWT already carries the workshop (same resolution as branch …/products).
 * Example with only a workshop token: `getWorkshopStaffProducts({ allBranches: true })`.
 * Pass `workshopId` when impersonating. If neither query nor user has a workshop, the API returns **400** (not 401).
 */
export const getWorkshopStaffProducts = (params = {}) =>
    apiFetch(`/workshop-staff/products${qs(params)}`);

/**
 * GET /workshop-staff/services — same contract as products (branchId / allBranches=true / optional workshopId).
 */
export const getWorkshopStaffServices = (params = {}) =>
    apiFetch(`/workshop-staff/services${qs(params)}`);

/**
 * Query for GET /workshop-staff/reports-analytics (same branch rule as products: branchId or allBranches=true).
 * Sends both snake_case and camelCase date / technician keys for DTO compatibility.
 * @param {string|number|'all'|undefined} selectedBranchId
 * @param {{ startDate?: string, endDate?: string, technicianId?: string }} opts — Each date: `YYYY-MM-DD` (UTC full day) or full ISO instant for time-of-day filters
 */
export function workshopReportsAnalyticsParams(selectedBranchId, opts = {}) {
    const { startDate = '', endDate = '', technicianId = '' } = opts;
    const q = { ...workshopStaffListScopeQuery(selectedBranchId) };
    if (q.branchId != null && q.branchId !== '') q.branch_id = q.branchId;
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
            q.client_time_zone = tz;
            q.clientTimeZone = tz;
        }
    } catch (_) {
        /* ignore */
    }
    if (startDate) {
        q.start_date = startDate;
        q.startDate = startDate;
    }
    if (endDate) {
        q.end_date = endDate;
        q.endDate = endDate;
    }
    if (technicianId != null && String(technicianId) !== '') {
        const tid = String(technicianId);
        q.technician_id = tid;
        q.employee_id = tid;
    }
    return q;
}

/** Workshop JWT — bundled KPIs, daily revenue, by technician/customer/product/department/branch. */
export const getWorkshopReportsAnalytics = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports-analytics${qs(params)}`, options);

export const getWorkshopRecentOrders = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/recent-orders${qs(params)}`, options);

export const getWorkshopRecentOpenOrderDetails = (salesOrderId, params = {}, options = {}) =>
    apiFetch(
        `/workshop-staff/reports/recent-orders/open-order/${encodeURIComponent(String(salesOrderId))}/details${qs(params)}`,
        options,
    );

export const getWorkshopRecentOrderDetails = (invoiceId, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/recent-orders/${encodeURIComponent(String(invoiceId))}/details${qs(params)}`, options);

export const getWorkshopRecentOrderPdf = (invoiceId, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/recent-orders/${encodeURIComponent(String(invoiceId))}/pdf${qs(params)}`, options);

export const getWorkshopSalesReturns = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/sales-returns${qs(params)}`, options);

export const getWorkshopSalesReturn = (returnId, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/sales-returns/${encodeURIComponent(String(returnId))}${qs(params)}`, options);

export const approveWorkshopSalesReturn = (returnId, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/sales-returns/${encodeURIComponent(String(returnId))}/approve${qs(params)}`, {
        method: 'POST',
        ...options,
    });

export const rejectWorkshopSalesReturn = (returnId, body, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/sales-returns/${encodeURIComponent(String(returnId))}/reject${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
        ...options,
    });

export const runWorkshopRelativeAction = (endpoint, method = 'POST', body) =>
    apiFetch(endpoint, {
        method,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

export const getWorkshopReportsByTechnician = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-technician${qs(params)}`, options);

export const getWorkshopReportsByCustomer = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-customer${qs(params)}`, options);

export const getWorkshopReportsByProduct = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-product${qs(params)}`, options);

export const getWorkshopReportsByDepartment = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-department${qs(params)}`, options);

export const getWorkshopReportsByBranch = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-branch${qs(params)}`, options);

export const getWorkshopReportsByCashier = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-cashier${qs(params)}`, options);

export const getWorkshopReportsByTechnicianDetails = (id, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-technician/${encodeURIComponent(String(id))}/details${qs(params)}`, options);

export const getWorkshopReportsByCustomerDetails = (id, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-customer/${encodeURIComponent(String(id))}/details${qs(params)}`, options);

export const getWorkshopReportsByProductDetails = (id, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-product/${encodeURIComponent(String(id))}/details${qs(params)}`, options);

export const getWorkshopReportsByDepartmentDetails = (id, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-department/${encodeURIComponent(String(id))}/details${qs(params)}`, options);

export const getWorkshopReportsByBranchDetails = (id, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-branch/${encodeURIComponent(String(id))}/details${qs(params)}`, options);

export const getWorkshopReportsByCashierDetails = (id, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/by-cashier/${encodeURIComponent(String(id))}/details${qs(params)}`, options);

/** `date` = YYYY-MM-DD (invoice date key; same as Daily Sales row). */
export const getWorkshopReportsDailySalesDetails = (date, params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports/daily-sales/${encodeURIComponent(String(date))}/details${qs(params)}`, options);

/**
 * Flat list from GET .../branches/:id/products|services (workshop-staff or workshop-catalog) and
 * similar workshop-product payloads. Staff APIs may use `items`, `rows`, or `data` instead of `products`.
 * @param {'products'|'services'} kind
 */
export function unwrapWorkshopBranchListResponse(res, kind = 'products') {
    if (res == null) return [];
    if (Array.isArray(res)) return res;
    if (typeof res !== 'object') return [];

    const primaryKey = kind === 'services' ? 'services' : 'products';
    const buckets = [
        res[primaryKey],
        res?.data?.[primaryKey],
        res?.data?.items,
        res?.data?.rows,
        res?.items,
        res?.rows,
        res?.data?.list,
        res?.list,
        res?.result,
        res?.results,
        res?.payload,
        res?.data?.payload,
    ];
    for (const a of buckets) {
        if (Array.isArray(a)) return a;
    }
    if (Array.isArray(res.data)) return res.data;
    return [];
}

/**
 * Workshop JWT — suppliers for this workshop (filtered by workshopId).
 * Query: `q` or `search` (first non-empty wins) — case-insensitive server-side search.
 * Pagination: `limit` (max 500), `offset`.
 */
export const getWorkshopSuppliers = (params = {}) =>
    apiFetch(`/workshop-staff/suppliers${qs(params)}`);

/**
 * Global supplier registry visible to workshop admins.
 * GET /workshop-staff/suppliers/registered
 * Query: q/search, isActive, limit, offset.
 */
export const getRegisteredWorkshopSuppliers = (params = {}) =>
    apiFetch(`/workshop-staff/suppliers/registered${qs(params)}`);

/**
 * Link existing suppliers to the current workshop.
 * POST /workshop-staff/suppliers/link
 * Body: { supplierIds: string[] }
 */
export const linkSuppliersToWorkshop = (supplierIds = []) =>
    apiFetch('/workshop-staff/suppliers/link', {
        method: 'POST',
        body: JSON.stringify({ supplierIds: (supplierIds || []).map(String) }),
    });

/**
 * Create a new supplier and link them to the current workshop (workshop JWT).
 * POST /workshop-staff/supplier/create
 * Use workshopLocalOnly: true for a workshop-scoped vendor with no supplier portal login.
 * Onboarded suppliers: omit workshopLocalOnly (or false), email required, portal user + email sent.
 */
export const createWorkshopSupplier = (body) =>
    apiFetch('/workshop-staff/supplier/create', {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

/** Workshop — create supplier purchase invoice (starts pending; no stock until supplier approves). */
export const createWorkshopSupplierPurchaseInvoice = (body) =>
    apiFetch('/workshop-staff/supplier-purchase-invoices', {
        method: 'POST',
        body: JSON.stringify(body),
    });

/** Workshop — complete a draft purchase invoice and send it to supplier. */
export const completeWorkshopSupplierPurchaseInvoiceDraft = (invoiceId) =>
    apiFetch(
        `/workshop-staff/supplier-purchase-invoices/${encodeURIComponent(String(invoiceId))}/complete`,
        { method: 'PATCH', body: JSON.stringify({}) },
    );

/** Workshop — edit a draft purchase invoice. */
export const updateWorkshopSupplierPurchaseInvoiceDraft = (invoiceId, body) =>
    apiFetch(`/workshop-staff/supplier-purchase-invoices/${encodeURIComponent(String(invoiceId))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

/** Workshop — list supplier purchase invoices. Query: status, supplierId, limit, offset (+ optional branchId). */
export const listWorkshopSupplierPurchaseInvoices = (params = {}) =>
    apiFetch(`/workshop-staff/supplier-purchase-invoices${qs(params)}`);

/** Workshop — single invoice */
export const getWorkshopSupplierPurchaseInvoice = (invoiceId) =>
    apiFetch(`/workshop-staff/supplier-purchase-invoices/${encodeURIComponent(String(invoiceId))}`);

/**
 * Workshop — supplier-scoped last purchase prices for the PI form.
 * Returns the most recent unit price (ex-VAT, incl. VAT) the workshop paid this
 * supplier per product across prior workshop purchase invoices.
 * Response: `{ success, supplierId, prices: [{ productId, lastUnitPriceExVat, lastUnitPriceInclVat, lastInvoiceId, lastInvoiceNumber, lastIssueDate }] }`
 */
export const getWorkshopSupplierLastPurchasePrices = (supplierId, opts = {}) => {
    const params = new URLSearchParams();
    if (opts.supplierKind === 'local') params.set('supplierKind', 'local');
    if (opts.branchId != null && String(opts.branchId).trim() !== '') {
        params.set('branchId', String(opts.branchId).trim());
    }
    const qs = params.toString();
    return apiFetch(
        `/workshop-staff/suppliers/${encodeURIComponent(String(supplierId))}/last-purchase-prices${qs ? `?${qs}` : ''}`,
    );
};

/** UOM rules (Box ↔ Liter) for branch products matched to affiliated supplier catalog. */
export const getWorkshopSupplierProductUomRules = (supplierId, branchId) =>
    apiFetch(
        `/workshop-staff/suppliers/${encodeURIComponent(String(supplierId))}/product-uom-rules?branchId=${encodeURIComponent(String(branchId))}`,
    );

/**
 * Map API user row to UI row (WorkshopEmployees / dashboard).
 * @param {object} raw
 * @param {'technician'|'cashier'} role
 */
export function normalizeWorkshopEmployee(raw, role) {
    const id = raw.id ?? raw.userId ?? raw._id;
    const user = raw.user && typeof raw.user === 'object' ? raw.user : null;
    const profile = raw.profile && typeof raw.profile === 'object' ? raw.profile : null;
    const employee = raw.employee && typeof raw.employee === 'object' ? raw.employee : null;
    const worker = raw.worker && typeof raw.worker === 'object' ? raw.worker : null;
    const name = raw.name ?? raw.fullName ?? raw.full_name ?? '—';
    const phone = raw.mobile ?? raw.phone ?? user?.mobile ?? user?.phone ?? employee?.mobile ?? employee?.phone ?? '';
    const email =
        raw.email ??
        user?.email ??
        profile?.email ??
        employee?.email ??
        worker?.email ??
        raw.emailAddress ??
        raw.email_address ??
        raw.userEmail ??
        raw.user_email ??
        raw.contactEmail ??
        raw.contact_email ??
        raw.loginEmail ??
        '';
    const branchRaw =
        raw.branchName ??
        raw.branch?.name ??
        (typeof raw.branch === 'string' ? raw.branch : null) ??
        null;
    const branch = branchRaw || '—';
    const branchId =
        raw.branchId != null
            ? String(raw.branchId)
            : raw.branch?.id != null
              ? String(raw.branch.id)
              : raw.branch_id != null
                ? String(raw.branch_id)
                : '';
    // Technicians may be linked to multiple workshop departments. The BE may
    // send these as `departmentIds: string[]` or expand them into
    // `departments: [{id,name}, …]` — accept either shape.
    const departmentIds = Array.isArray(raw.departmentIds)
        ? raw.departmentIds.map(String)
        : Array.isArray(raw.department_ids)
          ? raw.department_ids.map(String)
          : Array.isArray(raw.departments)
            ? raw.departments
                .map((d) => (d == null ? null : String(d.id ?? d._id ?? d)))
                .filter((v) => v != null && v !== '')
            : [];

    const singleDeptName =
        raw.department?.name ??
        raw.departmentName ??
        (typeof raw.department === 'string' ? raw.department : '') ??
        '';
    let fromDepartmentList = '';
    if (Array.isArray(raw.departmentNames) && raw.departmentNames.length > 0) {
        fromDepartmentList = raw.departmentNames.map((n) => String(n).trim()).filter(Boolean).join(', ');
    }
    if (!fromDepartmentList && Array.isArray(raw.departments) && raw.departments.length > 0) {
        fromDepartmentList = raw.departments
            .map((d) => {
                if (d == null) return '';
                if (typeof d === 'string') return d.trim();
                return String(d.name ?? d.departmentName ?? d.title ?? '').trim();
            })
            .filter(Boolean)
            .join(', ');
    }
    const department = (fromDepartmentList || singleDeptName || '').trim();
    const commission = Number(
        raw.commissionPercent ??
            raw.commission_percent ??
            user?.commissionPercent ??
            user?.commission_percent ??
            employee?.commissionPercent ??
            employee?.commission_percent ??
            worker?.commissionPercent ??
            worker?.commission_percent ??
            0,
    );
    const commissionTypeNorm =
        raw.commissionType ??
        raw.commission_type ??
        user?.commissionType ??
        user?.commission_type ??
        employee?.commissionType ??
        employee?.commission_type ??
        worker?.commissionType ??
        worker?.commission_type ??
        '';
    const basicSalaryRaw =
        employee?.basicSalary ??
        employee?.basic_salary ??
        raw.basicSalary ??
        raw.basic_salary ??
        user?.basicSalary ??
        user?.basic_salary ??
        worker?.basicSalary ??
        worker?.basic_salary ??
        '';
    const approvalStatus = String(
        raw.approvalStatus ??
            raw.approval_status ??
            user?.approvalStatus ??
            user?.approval_status ??
            '',
    ).toLowerCase();
    const pendingApproval = approvalStatus === 'pending';
    const active =
        !pendingApproval &&
        raw.isActive !== false &&
        raw.status !== 'inactive' &&
        user?.isActive !== false &&
        employee?.isActive !== false;
    const status = pendingApproval ? 'pending' : active ? 'active' : 'inactive';
    const technicianType = String(raw.technicianType ?? raw.technician_type ?? '').toLowerCase();
    const dutyMode = String(raw.dutyMode ?? raw.duty_mode ?? '').toLowerCase();
    const dualTechnicianType =
        technicianType === 'both' ||
        technicianType === 'hybrid' ||
        technicianType === 'workshop_and_oncall' ||
        technicianType === 'workshop_on_call';
    const explicitWorkshop = raw.workshopDuty ?? raw.workshop_duty;
    const explicitOncall = raw.oncallAvailable ?? raw.oncall_available;
    const hasExplicitDutyFlags = explicitWorkshop != null || explicitOncall != null;

    /**
     * Capability (form checkboxes) vs active session:
     * - technicianType "both" / hybrid = eligible for workshop AND on-call.
     * - dutyMode is the *current active* mode when type is "both" (e.g. dutyMode
     *   "workshop" + technicianType "both" → still show both toggles on).
     * So never derive capability from dutyMode alone before reading technicianType.
     */
    let workshop_duty;
    let oncall_available;
    if (hasExplicitDutyFlags) {
        workshop_duty = !!explicitWorkshop;
        oncall_available = !!explicitOncall;
    } else if (dualTechnicianType) {
        workshop_duty = true;
        oncall_available = true;
    } else if (technicianType === 'workshop') {
        workshop_duty = true;
        oncall_available = false;
    } else if (technicianType === 'on_call' || technicianType === 'oncall') {
        workshop_duty = false;
        oncall_available = true;
    } else if (
        dutyMode === 'both' ||
        dutyMode === 'hybrid' ||
        dutyMode === 'mixed' ||
        dutyMode === 'workshop_and_oncall'
    ) {
        workshop_duty = true;
        oncall_available = true;
    } else if (dutyMode === 'workshop') {
        workshop_duty = true;
        oncall_available = false;
    } else if (dutyMode === 'on_call' || dutyMode === 'oncall' || dutyMode === 'on-call') {
        workshop_duty = false;
        oncall_available = true;
    } else {
        workshop_duty =
            technicianType === 'workshop' ||
            raw.workshopDuty === true ||
            raw.workshop_duty === true;
        oncall_available =
            technicianType === 'on_call' ||
            technicianType === 'oncall' ||
            raw.oncallAvailable === true ||
            raw.oncall_available === true;
    }
    const workshopStaffRole = (
        raw.workshopStaffRole ??
        raw.workshop_staff_role ??
        user?.workshopStaffRole ??
        user?.workshop_staff_role ??
        ''
    )
        .toString()
        .toLowerCase();
    // `employeeType` is the authoritative job role on the unified employees
    // list (cashier / staff / technician). It must rank ABOVE the `role` arg,
    // which is only the PATCH/DELETE route family ('cashier' covers cashier +
    // staff). Without it, a `staff` employee falls back to the arg and renders
    // + prefills as "cashier". Portal/locker rows still win via workshopStaffRole.
    let displayRole = (
        raw.role ??
        raw.userType ??
        raw.user_type ??
        raw.employeeType ??
        raw.employee_type ??
        role ??
        ''
    ).toString().toLowerCase() || role;
    if (workshopStaffRole) {
        displayRole = workshopStaffRole;
    }

    const userIdStr =
        raw.userId != null || raw.user_id != null
            ? String(raw.userId ?? raw.user_id)
            : user?.id != null
              ? String(user.id)
              : undefined;

    return {
        id,
        /** users.id when the API sends it; use for PATCH /workshop-staff/portal-staff/:id */
        userId: userIdStr,
        recordType: raw.recordType ?? raw.record_type ?? undefined,
        name,
        role: displayRole,
        branch,
        branchId,
        phone,
        email,
        iqama:
            raw.iqama ??
            employee?.iqama ??
            raw.iqamaNumber ??
            raw.iqama_no ??
            raw.iqamaNo ??
            profile?.iqama ??
            user?.iqama ??
            user?.nationalId ??
            user?.national_id ??
            user?.cnic ??
            profile?.nationalId ??
            profile?.cnic ??
            employee?.nationalId ??
            employee?.national_id ??
            employee?.cnic ??
            worker?.iqama ??
            worker?.nationalId ??
            worker?.cnic ??
            raw.cnic ??
            raw.nationalId ??
            raw.national_id ??
            raw.idNumber ??
            raw.id_number ??
            raw.resident_id ??
            raw.residentId ??
            '',
        department: department || undefined,
        departmentIds,
        status,
        workshop_duty: role === 'technician' ? workshop_duty : false,
        oncall_available: role === 'technician' ? oncall_available : false,
        commission_percent: Number.isFinite(commission) ? commission : 0,
        commission_type: commissionTypeNorm,
        basic_salary:
            basicSalaryRaw === '' || basicSalaryRaw == null
                ? ''
                : String(basicSalaryRaw),
        approvalStatus: approvalStatus || undefined,
        // Pass-through the currently-assigned RBAC role from the backend
        // (workshop Roles & Permissions). Without this, the Edit modal's
        // Permission Role dropdown can't pre-select and the Employees table's
        // "Assigned Role" column always shows '—'. Accept multiple casings
        // since different endpoints have shipped slightly different shapes.
        permissionRole:
            raw.permissionRole ??
            raw.permission_role ??
            user?.permissionRole ??
            user?.permission_role ??
            null,
        effectiveBranchIds: Array.isArray(raw.effectiveBranchIds)
            ? raw.effectiveBranchIds.map(String)
            : Array.isArray(raw.effective_branch_ids)
              ? raw.effective_branch_ids.map(String)
              : Array.isArray(raw.permissionRole?.branchIds)
                ? raw.permissionRole.branchIds.map(String)
                : [],
        userType:
            raw.userType ??
            raw.user_type ??
            user?.userType ??
            user?.user_type ??
            null,
        userId:
            raw.userId != null
                ? String(raw.userId)
                : user?.id != null
                  ? String(user.id)
                  : raw.user_id != null
                    ? String(raw.user_id)
                    : null,
        _source: role,
    };
}

/**
 * Map one row from GET /workshop-staff/employees through flatten + normalize.
 * `_source` selects technician vs cashier PATCH/DELETE families; `staff` rows use cashier routes.
 * Portal roles (recordType `portal_user`) use PATCH /workshop-staff/portal-staff/:userId for updates.
 */
export function normalizeUnifiedWorkshopEmployeeRow(raw) {
    if (!raw || typeof raw !== 'object') {
        return normalizeWorkshopEmployee({}, 'cashier');
    }
    // Fill missing top-level fields from nested `user` (iqama, salary, commission) without overwriting row `id`.
    const merged = (() => {
        if (!raw.user || typeof raw.user !== 'object' || Array.isArray(raw.user)) return { ...raw };
        const out = { ...raw };
        for (const [k, v] of Object.entries(raw.user)) {
            if (v === undefined || v === null) continue;
            if (k === 'id' || k === '_id') continue;
            const cur = out[k];
            if (cur === undefined || cur === null || cur === '') {
                out[k] = v;
            }
        }
        return out;
    })();
    const empNested = merged.employee && typeof merged.employee === 'object' ? merged.employee : null;
    const empType = String(
        merged.employeeType ??
            merged.employee_type ??
            empNested?.employeeType ??
            empNested?.employee_type ??
            '',
    ).toLowerCase();
    const wsRole = String(
        merged.workshopStaffRole ??
            merged.workshop_staff_role ??
            merged.user?.workshopStaffRole ??
            merged.user?.workshop_staff_role ??
            '',
    ).toLowerCase();

    let listKind = 'cashier';
    if (empType === 'technician') {
        listKind = 'technician';
    } else if (
        empType === 'cashier' ||
        empType === 'staff' ||
        wsRole === 'manager' ||
        wsRole === 'supervisor' ||
        wsRole === 'team_leader'
    ) {
        listKind = 'cashier';
    }

    const flat = flattenWorkshopStaffRow(merged, listKind === 'technician' ? 'technician' : 'cashier');
    return normalizeWorkshopEmployee(flat, listKind);
}

/**
 * Load workshop people for the Employees UI (staff + technicians + cashiers).
 * Prefers GET /workshop-staff/employees; falls back to parallel technicians + cashiers if unavailable.
 *
 * @param {object} [params]
 * @param {string|number} [params.branchId]
 * @param {string} [params.employeeType] staff | technician | cashier
 * @param {boolean|string} [params.isActive]
 * @param {boolean} [params.includeInactive] When true, do not default workshop-wide lists to active-only.
 * @param {number|string} [params.limit]
 * @param {number|string} [params.offset]
 */
export async function loadWorkshopEmployeesCombined(params = {}) {
    const query = {};
    const isWorkshopWide =
        params.branchId == null ||
        params.branchId === '' ||
        String(params.branchId) === 'all';
    if (params.branchId != null && params.branchId !== '' && params.branchId !== 'all') {
        query.branchId = String(params.branchId);
    }
    if (params.employeeType != null && params.employeeType !== '') {
        query.employeeType = String(params.employeeType);
    }
    if (params.isActive != null && params.isActive !== '') {
        query.isActive = String(params.isActive);
    }
    // Note: previously "all branches" mode auto-added isActive=true, which
    // caused newly-created employees to disappear if their User.isActive flag
    // wasn't true yet (e.g., pending approval, or auto-set false by a portal
    // flow). Now both single-branch and all-branches views load the same set;
    // callers that explicitly want active-only can still pass isActive: 'true'.
    if (params.limit != null && params.limit !== '') {
        query.limit = String(params.limit);
    }
    if (params.offset != null && params.offset !== '') {
        query.offset = String(params.offset);
    }

    try {
        const res = await getWorkshopEmployees(query);
        const list = unwrapWorkshopEmployeesList(res);
        const employees = list.map((row) => normalizeUnifiedWorkshopEmployeeRow(row));
        const techList = employees.filter((e) => e._source === 'technician');
        const cashList = employees.filter((e) => e._source === 'cashier');
        return { techList, cashList, employees };
    } catch (primaryErr) {
        const legacyQuery = { ...query };
        delete legacyQuery.employeeType;
        delete legacyQuery.limit;
        delete legacyQuery.offset;
        const [techRes, cashRes] = await Promise.all([
            getWorkshopTechnicians(legacyQuery).catch(() => null),
            getWorkshopCashiers(legacyQuery).catch(() => null),
        ]);
        if (techRes == null && cashRes == null) {
            throw new Error(
                primaryErr?.message
                    || 'Failed to load employees (GET /workshop-staff/employees and legacy lists unreachable).',
            );
        }
        const techList = unwrapWorkshopStaffList(techRes, 'technician').map((u) =>
            normalizeWorkshopEmployee(flattenWorkshopStaffRow(u, 'technician'), 'technician'),
        );
        const cashList = unwrapWorkshopStaffList(cashRes, 'cashier').map((u) =>
            normalizeWorkshopEmployee(flattenWorkshopStaffRow(u, 'cashier'), 'cashier'),
        );
        return { techList, cashList, employees: [...techList, ...cashList] };
    }
}

/**
 * Query for GET /workshop-staff/corporate-customers (branchId or allBranches=true; optional branch_id alias).
 */
export function workshopCorporateCustomersParams(selectedBranchId) {
    const q = { ...workshopStaffListScopeQuery(selectedBranchId) };
    if (q.branchId != null && q.branchId !== '') q.branch_id = q.branchId;
    return q;
}

/** Workshop JWT — list corporate accounts linked to this workshop. */
export const getWorkshopCorporateCustomers = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/corporate-customers${qs(params)}`, options);

/**
 * Register a corporate customer (workshop JWT). Sends only branches from this workshop; super admin can add more on approval.
 * Body: companyName, vatNumber?, contactPerson, email, password, selectedStoreIds[], referralId?, mobile?
 */
export const postCorporateRegister = (body) =>
    apiFetch('/workshop-staff/corporate-register', {
        method: 'POST',
        body: JSON.stringify(body),
    });

/** System totals for an open POS session (force-close preview). */
export const getPosSessionShiftSummary = (posSessionId) =>
    apiFetch(`/workshop-staff/pos-monitoring/${encodeURIComponent(posSessionId)}/shift-summary`);

/** Force close shift + logout cashier on POS (counter closing). */
export const forceClosePosSession = (posSessionId, body) =>
    apiFetch(`/workshop-staff/pos-monitoring/${encodeURIComponent(posSessionId)}/force-close`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
