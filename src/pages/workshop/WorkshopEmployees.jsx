import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Users, Wrench, Radio, Plus, Pencil, Trash2, Loader, Eye, EyeOff, ShieldCheck, Key, ChevronDown, ChevronRight } from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import { useAuth } from '../../context/AuthContext';
import * as workshopPermsApi from '../../services/workshopPermissionsApi';
import { codesToActionsByTab, flattenActionsByTab } from '../../utils/permissions';
import { ROLE_OPTIONS, COMMISSION_TYPE_OPTIONS, normalizeCommissionType } from './constants';
import {
    loadWorkshopEmployeesCombined,
    createWorkshopTechnician,
    createWorkshopCashier,
    createWorkshopPortalStaff,
    updateWorkshopPortalStaff,
    updateWorkshopTechnician,
    updateWorkshopCashier,
    deleteWorkshopCashier,
    deleteWorkshopPortalStaff,
    getWorkshopBranches,
    getWorkshopTechnicianById,
    getWorkshopCashierById,
    getWorkshopPortalStaffById,
    unwrapWorkshopStaffDetail,
    unwrapWorkshopPortalStaffDetail,
    unwrapWorkshopBranchesResponse,
    filterPortalVisibleBranches,
    normalizeWorkshopEmployee,
    buildPortalStaffPatchPayload,
} from '../../services/workshopStaffApi';
import { getMyDepartments, getBranchDepartments } from '../../services/workshopCatalogApi';

const isTechnicianRole = (r) => r === 'technician';

const isPortalStaffRole = (r) =>
    r === 'manager' ||
    r === 'supervisor' ||
    r === 'team_leader' ||
    r === 'locker_supervisor' ||
    r === 'locker_collector';

const isLockerPortalRole = (r) => r === 'locker_supervisor' || r === 'locker_collector';

/** Manager / supervisor / team leader rows (recordType portal_user or legacy role-only lists). */
function isPortalEmployeeRow(emp) {
    if (!emp) return false;
    if (String(emp.recordType || '').toLowerCase() === 'portal_user') return true;
    const r = String(emp.role || '')
        .toLowerCase()
        .replace(/\s+/g, '_');
    return isPortalStaffRole(r);
}

function mapBranchOption(branch) {
    return {
        ...branch,
        id: branch.id ?? branch._id,
        name: branch.name ?? branch.branchName ?? 'Branch',
        approvalStatus: branch.approvalStatus ?? branch.approval_status ?? null,
    };
}

function parseWorkshopDepartmentsResponse(res) {
    return (
        (Array.isArray(res?.departments) && res.departments)
        || (Array.isArray(res?.data?.departments) && res.data.departments)
        || (Array.isArray(res?.data) && res.data)
        || (Array.isArray(res) && res)
        || []
    );
}

const EMPTY_FORM = {
    full_name: '',
    mobile: '',
    email: '',
    iqama: '',
    branchId: '',
    departmentIds: [],
    /** Single department for role `team_leader` (linked on the server). */
    teamLeaderDepartmentId: '',
    role: 'cashier',
    is_technician: false,
    workshop_duty: false,
    oncall_available: false,
    basic_salary: '',
    commission_percent: 0,
    commission_type: 'percent_of_revenue',
    status: 'active',
    password: '',
    /** Workshop RBAC role assignment — overlay on top of the job-title `role`. */
    permissionRoleId: '',
};

export default function WorkshopEmployees({ selectedBranchId = 'all', branches: branchesProp = [] }) {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('workshop.employees.create');
    const canEdit   = hasPermission('workshop.employees.edit');
    const canDelete = hasPermission('workshop.employees.delete');
    // Gate the Roles & Permissions panel + per-employee actions.
    const canManagePermissions = hasPermission('workshop.permissions.view');
    const canCreateRoles       = hasPermission('workshop.permissions.create');
    const canDeleteRoles       = hasPermission('workshop.permissions.delete');
    const [employees, setEmployees] = useState([]);
    const [branchList, setBranchList] = useState([]);
    const [workshopDepartments, setWorkshopDepartments] = useState([]);
    /** Departments adopted on the branch selected in the modal (for team leader). */
    const [teamLeaderDepartments, setTeamLeaderDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [listError, setListError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);

    // ─── Roles & Permissions (workshop-scoped) ────────────────────────────
    const [workshopRoles, setWorkshopRoles] = useState([]);
    const [rolesPanelOpen, setRolesPanelOpen] = useState(false);
    const [roleEditTarget, setRoleEditTarget] = useState(null); // null = closed; {} = create; {...} = edit
    const [portalAccessTarget, setPortalAccessTarget] = useState(null); // employee row
    const [permissionsTarget, setPermissionsTarget] = useState(null); // employee row
    const loadWorkshopRoles = useCallback(async () => {
        try {
            const res = await workshopPermsApi.listRoles();
            setWorkshopRoles(res?.roles ?? []);
        } catch {
            setWorkshopRoles([]);
        }
    }, []);
    useEffect(() => { loadWorkshopRoles(); }, [loadWorkshopRoles]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [showPassword, setShowPassword] = useState(false);
    /** Bumps on each openEdit so late detail responses do not overwrite a newer modal. */
    const editDetailGenerationRef = useRef(0);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const isCreateTechnicianMode = !editing && (form.is_technician || isTechnicianRole(form.role));

    // Job-role editing rules.
    //   • Create → any role is allowed.
    //   • Edit a portal-staff member → may switch within {manager, supervisor,
    //     team_leader} (same `users` row; safe column change).
    //   • Edit anyone else (cashier / technician / locker) → role is LOCKED,
    //     because changing it would move the person between database tables.
    const PORTAL_STAFF_JOB_ROLES = ['manager', 'supervisor', 'team_leader'];
    const editingRoleKey = editing
        ? String(editing.role || '').toLowerCase().replace(/\s+/g, '_')
        : '';
    const editingIsPortalStaffGroup =
        !!editing && isPortalEmployeeRow(editing) && PORTAL_STAFF_JOB_ROLES.includes(editingRoleKey);
    const roleSelectEditable = !editing || editingIsPortalStaffGroup;
    const roleSelectOptions = !editing
        ? ROLE_OPTIONS
        : editingIsPortalStaffGroup
            ? PORTAL_STAFF_JOB_ROLES
            : ROLE_OPTIONS.includes(editingRoleKey)
                ? [editingRoleKey]
                : [form.role];
    const toggleDepartmentId = (id) =>
        setForm((f) => {
            const s = String(id);
            const has = f.departmentIds.includes(s);
            return { ...f, departmentIds: has ? f.departmentIds.filter((d) => d !== s) : [...f.departmentIds, s] };
        });

    useEffect(() => {
        if (branchesProp?.length) {
            setBranchList(filterPortalVisibleBranches(branchesProp).map(mapBranchOption));
            return;
        }
        let cancelled = false;
        getWorkshopBranches()
            .then((r) => {
                if (cancelled) return;
                const raw = filterPortalVisibleBranches(unwrapWorkshopBranchesResponse(r));
                if (raw.length > 0) {
                    setBranchList(raw.map(mapBranchOption));
                    return;
                }
                if (r?.success && Array.isArray(r.branches)) {
                    setBranchList(filterPortalVisibleBranches(r.branches).map(mapBranchOption));
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [branchesProp]);

    /** Cashiers / portal staff may only be assigned to super-admin–approved branches. */
    const branchesForNonTechnicianSelect = useMemo(() => {
        const approved = branchList.filter((b) => {
            const s = String(b.approvalStatus ?? '').toLowerCase();
            return s === '' || s === 'approved';
        });
        if (editing?.branchId) {
            const cur = branchList.find((b) => String(b.id) === String(editing.branchId));
            if (cur && !approved.some((b) => String(b.id) === String(cur.id))) {
                return [...approved, mapBranchOption(cur)];
            }
        }
        return approved;
    }, [branchList, editing]);

    const branchSelectOptions = useMemo(() => {
        const asTechnician = form.is_technician || isTechnicianRole(form.role);
        const cashierOrPortalEdit = editing && editing._source !== 'technician';
        const base = (asTechnician && !cashierOrPortalEdit)
            ? branchList
            : branchesForNonTechnicianSelect;

        // Sidebar branch scope — when a specific branch is selected, narrow the
        // form's branch dropdown so the admin can only create/edit employees
        // under that branch. While editing an existing row keep its current
        // branch visible so the option doesn't disappear.
        const isAll = !selectedBranchId || selectedBranchId === 'all';
        if (isAll) return base;
        return base.filter((b) =>
            String(b.id) === String(selectedBranchId)
            || (editing && String(b.id) === String(editing.branchId ?? '')),
        );
    }, [form.is_technician, form.role, branchList, branchesForNonTechnicianSelect, editing, selectedBranchId]);

    const loadEmployees = useCallback(async () => {
        setListError('');
        setLoading(true);
        try {
            // Push the branch filter to the server when the sidebar selector
            // points at a specific branch. With "all" we get the workshop-wide
            // list and the table-level filter takes over.
            const { employees: rows } = await loadWorkshopEmployeesCombined({
                branchId: selectedBranchId,
            });
            setEmployees(rows);
        } catch (e) {
            setEmployees([]);
            setListError(e.message || 'Failed to load employees.');
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    const selectedBranchName = useMemo(
        () => branchList.find((b) => String(b.id) === String(selectedBranchId))?.name,
        [branchList, selectedBranchId],
    );

    const displayedEmployees = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return employees;
        const sid = String(selectedBranchId);
        return employees.filter((e) => {
            const scopeIds =
                Array.isArray(e.effectiveBranchIds) && e.effectiveBranchIds.length > 0
                    ? e.effectiveBranchIds.map(String)
                    : e.branchId
                      ? [String(e.branchId)]
                      : [];
            return (
                scopeIds.includes(sid) ||
                (selectedBranchName && e.branch === selectedBranchName)
            );
        });
    }, [employees, selectedBranchId, selectedBranchName]);

    const loadWorkshopDepartmentCatalog = useCallback(async () => {
        try {
            const isAll = !selectedBranchId || selectedBranchId === 'all';
            const res = isAll
                ? await getMyDepartments()
                : await getBranchDepartments(String(selectedBranchId));
            setWorkshopDepartments(parseWorkshopDepartmentsResponse(res));
        } catch {
            setWorkshopDepartments([]);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadWorkshopDepartmentCatalog();
    }, [loadWorkshopDepartmentCatalog]);

    // Team leader is tied to one workshop department on the selected branch.
    useEffect(() => {
        if (form.role !== 'team_leader' || !form.branchId) {
            setTeamLeaderDepartments([]);
            return undefined;
        }
        let cancelled = false;
        getBranchDepartments(String(form.branchId))
            .then((res) => {
                if (cancelled) return;
                setTeamLeaderDepartments(parseWorkshopDepartmentsResponse(res));
            })
            .catch(() => {
                if (!cancelled) setTeamLeaderDepartments([]);
            });
        return () => {
            cancelled = true;
        };
    }, [form.role, form.branchId]);

    // New technician creation is fixed as dual-duty by policy.
    useEffect(() => {
        if (!isCreateTechnicianMode) return;
        if (form.workshop_duty && form.oncall_available) return;
        setForm((f) => ({ ...f, workshop_duty: true, oncall_available: true }));
    }, [isCreateTechnicianMode, form.workshop_duty, form.oncall_available]);

    const ensureDepartmentsLoaded = useCallback(async () => {
        if (workshopDepartments.length > 0) return;
        await loadWorkshopDepartmentCatalog();
    }, [workshopDepartments.length, loadWorkshopDepartmentCatalog]);

    const formatEmployeeDepartments = useCallback(
        (emp) => {
            const direct = emp.department && String(emp.department).trim();
            if (direct) return direct;
            const ids = Array.isArray(emp.departmentIds) ? emp.departmentIds : [];
            if (!ids.length || !workshopDepartments.length) return null;
            const names = ids
                .map((id) => {
                    const row = workshopDepartments.find(
                        (d) => String(d.id ?? d._id) === String(id),
                    );
                    return row?.name ?? row?.departmentName ?? '';
                })
                .filter(Boolean);
            return names.length ? names.join(', ') : null;
        },
        [workshopDepartments],
    );

    const openAdd = () => {
        setEditing(null);
        // Pre-fill the branch from the sidebar scope (so the admin doesn't have
        // to re-pick it). If "All Branches" is selected we leave it blank.
        const presetBranchId =
            selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '';
        setForm({ ...EMPTY_FORM, branchId: presetBranchId });
        setShowPassword(false);
        setModalOpen(true);
        ensureDepartmentsLoaded();
    };

    const openEdit = (emp) => {
        const gen = ++editDetailGenerationRef.current;
        const empId = emp.id;
        const source = emp._source;
        const isPortal = isPortalEmployeeRow(emp);
        const detailFetchId = isPortal ? String(emp.userId ?? emp.id) : empId;
        setEditing(emp);
        const roleVal = (emp.role || '').toLowerCase().replace(/\s+/g, '_');
        const hasRole = ROLE_OPTIONS.includes(roleVal);
        const tlDept =
            Array.isArray(emp.departmentIds) && emp.departmentIds.length > 0
                ? String(emp.departmentIds[0])
                : emp.departmentId != null
                  ? String(emp.departmentId)
                  : '';
        setForm({
            full_name: emp.name,
            mobile: emp.phone || '',
            email: emp.email || '',
            iqama: emp.iqama || '',
            branchId: emp.branchId || '',
            departmentIds: Array.isArray(emp.departmentIds) ? emp.departmentIds.map(String) : [],
            teamLeaderDepartmentId: roleVal === 'team_leader' ? tlDept : '',
            role: hasRole ? roleVal : 'technician',
            is_technician:
                !!emp.workshop_duty ||
                !!emp.oncall_available ||
                (emp.role || '').toLowerCase().includes('technician'),
            workshop_duty: !!emp.workshop_duty,
            oncall_available: !!emp.oncall_available,
            basic_salary: emp.basic_salary ?? '',
            commission_percent: emp.commission_percent ?? 0,
            commission_type: normalizeCommissionType(emp.commission_type),
            status: emp.status || 'active',
            password: '',
            permissionRoleId: emp.permissionRole?.id ? String(emp.permissionRole.id) : '',
        });
        setShowPassword(false);
        setModalOpen(true);
        ensureDepartmentsLoaded();

        (async () => {
            try {
                const res =
                    source === 'technician'
                        ? await getWorkshopTechnicianById(empId)
                        : isPortal
                          ? await getWorkshopPortalStaffById(detailFetchId)
                          : await getWorkshopCashierById(empId);
                if (gen !== editDetailGenerationRef.current) return;
                const raw =
                    source === 'technician'
                        ? unwrapWorkshopStaffDetail(res, source)
                        : isPortal
                          ? unwrapWorkshopPortalStaffDetail(res)
                          : unwrapWorkshopStaffDetail(res, source);
                if (!raw) return;
                const n = normalizeWorkshopEmployee(raw, source);
                if (gen !== editDetailGenerationRef.current) return;
                setEditing((prev) =>
                    prev && String(prev.id) === String(empId)
                        ? {
                            ...prev,
                            ...n,
                            // Keep the list row's authoritative identity/role. The
                            // detail endpoint can mis-derive `role` — e.g. a locker
                            // user whose DB workshopStaffRole is null falls back to
                            // 'cashier' — which would wrongly flip the Role dropdown
                            // (and its route family) after the modal already opened.
                            role: prev.role,
                            _source: prev._source,
                            recordType: prev.recordType,
                            userId: prev.userId ?? n.userId,
                        }
                        : prev,
                );
                setForm((f) => ({
                    ...f,
                    full_name: n.name && n.name !== '—' ? n.name : f.full_name,
                    mobile: n.phone || f.mobile,
                    email: n.email || f.email,
                    iqama: n.iqama || f.iqama,
                    branchId: n.branchId || f.branchId,
                    departmentIds:
                        Array.isArray(n.departmentIds) && n.departmentIds.length > 0
                            ? n.departmentIds.map(String)
                            : f.departmentIds,
                    teamLeaderDepartmentId:
                        f.role === 'team_leader' &&
                        Array.isArray(n.departmentIds) &&
                        n.departmentIds.length > 0
                            ? String(n.departmentIds[0])
                            : f.teamLeaderDepartmentId,
                    workshop_duty:
                        source === 'technician' ? !!n.workshop_duty : f.workshop_duty,
                    oncall_available:
                        source === 'technician' ? !!n.oncall_available : f.oncall_available,
                    basic_salary:
                        n.basic_salary !== '' && n.basic_salary != null ? n.basic_salary : f.basic_salary,
                    commission_percent: n.commission_percent ?? f.commission_percent,
                    commission_type: n.commission_type
                        ? normalizeCommissionType(n.commission_type)
                        : f.commission_type,
                    status: n.status || f.status,
                }));
            } catch {
                /* List row is enough if GET :id is missing or restricted */
            }
        })();
    };

    /**
     * Build the body for the staff endpoints. The mapping mirrors what the BE
     * wires up: name/mobile/email/iqama/branchId/basicSalary/commissionPercent/
     * commissionType/isActive on both routes, plus departmentIds +
     * workshopDuty/oncallAvailable/technicianType for technicians. Empty optional strings are coerced to `undefined` so
     * they're left out of the JSON instead of overwriting columns with "".
     */
    const buildStaffPayload = ({ asTechnician, isEdit }) => {
        const optStr = (v) => {
            const t = typeof v === 'string' ? v.trim() : v;
            return t === '' || t == null ? undefined : t;
        };
        const optNum = (v) => {
            if (v === '' || v == null) return undefined;
            const n = Number(v);
            return Number.isFinite(n) ? n : undefined;
        };

        const body = {
            name: form.full_name.trim(),
            mobile: form.mobile.trim(),
            email: optStr(form.email),
            iqama: optStr(form.iqama),
            branchId: form.branchId ? String(form.branchId) : undefined,
            basicSalary: optNum(form.basic_salary),
            commissionPercent: Number(form.commission_percent) || 0,
            commissionType: optStr(form.commission_type),
            isActive: form.status === 'active',
        };

        // Backend DTOs may use camelCase or snake_case — send both so Nest pipes validation consistently.
        if (body.basicSalary !== undefined) body.basic_salary = body.basicSalary;
        if (body.commissionPercent !== undefined) body.commission_percent = body.commissionPercent;
        if (body.commissionType !== undefined) body.commission_type = body.commissionType;
        if (body.iqama !== undefined) {
            body.nationalId = body.iqama;
            body.national_id = body.iqama;
            body.cnic = body.iqama;
        }

        if (asTechnician) {
            if (!isEdit) {
                // Create flow: always dual-duty, not user-selectable.
                body.workshopDuty = true;
                body.oncallAvailable = true;
                body.technicianType = 'both';
            } else {
                body.workshopDuty = !!form.workshop_duty;
                body.oncallAvailable = !!form.oncall_available;
                if (form.workshop_duty && !form.oncall_available) {
                    body.technicianType = 'workshop';
                } else if (!form.workshop_duty && form.oncall_available) {
                    body.technicianType = 'on_call';
                }
            }
            // When both are true, rely on workshopDuty + oncallAvailable; omit technicianType so BE can persist both flags.
            // Always send the array on technician requests so the BE can
            // diff/replace links cleanly. Empty array means "no departments".
            body.departmentIds = form.departmentIds.map(String);
        } else {
            // Cashier / manager / supervisor / team leader — backend may read `role` or `staffRole`.
            body.role = form.role;
            body.staffRole = form.role;
            if (form.role === 'team_leader' && form.teamLeaderDepartmentId) {
                const did = String(form.teamLeaderDepartmentId);
                body.departmentId = did;
                body.department_id = did;
                body.departmentIds = [did];
                body.department_ids = [did];
                body.teamLeaderDepartmentId = did;
                body.team_leader_department_id = did;
            }
        }

        if (isEdit) {
            // Optional password reset on edit. Send only when the user has
            // typed something — empty input means "leave the password alone".
            const newPwd = optStr(form.password);
            if (newPwd) body.password = newPwd;
        } else {
            // Create flow: BE expects a password to seed the User row. We
            // generate a temporary one if the admin didn't provide one.
            body.password = optStr(form.password) || `Temp@${Date.now()}`;
        }

        return body;
    };

    const handleSave = async () => {
        if (!form.full_name?.trim() || !form.mobile?.trim()) return;
        const asTechnician = form.is_technician || isTechnicianRole(form.role);
        const isPortal = isPortalStaffRole(form.role);
        const isLocker = isLockerPortalRole(form.role);
        // Cashiers, generic staff rows, and portal staff need a branch on an approved portal.
        // Locker users are workshop-wide and don't need a branch.
        const isCashierCreate = !editing && !asTechnician && (form.role === 'cashier' || form.role === 'staff');
        const isPortalCreate = !editing && !asTechnician && isPortal && !isLocker;
        const editingLocker =
            editing && isLockerPortalRole(String(editing.role || '').toLowerCase().replace(/\s+/g, '_'));
        const isNonTechEdit = editing && editing._source !== 'technician' && !editingLocker;
        if ((isCashierCreate || isPortalCreate || isNonTechEdit) && !form.branchId) {
            alert('Assign a super-admin–approved branch (required for cashiers, staff, and portal roles).');
            return;
        }
        if (asTechnician && !form.workshop_duty && !form.oncall_available) {
            alert('Select at least one technician type: Workshop and/or On-Call.');
            return;
        }
        if (form.role === 'team_leader' && !form.teamLeaderDepartmentId?.trim()) {
            alert('Select the department this team leader is responsible for.');
            return;
        }
        setSaving(true);
        try {
            const isEdit = !!editing;
            // The "kind" follows the existing record on edit (you can't flip a
            // cashier into a technician via PATCH) and the form intent on
            // create.
            const isTech = isEdit ? editing._source === 'technician' : asTechnician;
            const body = buildStaffPayload({ asTechnician: isTech, isEdit });

            if (isEdit) {
                if (isTech) {
                    await updateWorkshopTechnician(editing.id, body);
                } else if (isPortalEmployeeRow(editing)) {
                    // Pass the NEW role so department fields aren't stripped when
                    // switching TO team_leader, and send staffRole so the job role
                    // can change within the portal-staff group (manager /
                    // supervisor / team_leader).
                    const patch = buildPortalStaffPatchPayload(body, form.role);
                    patch.staffRole = form.role;
                    const portalUserId = String(editing.userId ?? editing.id);
                    await updateWorkshopPortalStaff(portalUserId, patch);
                } else {
                    await updateWorkshopCashier(editing.id, body);
                }

                // Permission Role assignment — only if the dropdown was visible
                // (employee has a User account) AND the value actually changed.
                // Re-uses the workshop's portal-access endpoint to swap the
                // role without touching userType or password.
                if (editing.userId && canManagePermissions) {
                    const currentRoleId = editing.permissionRole?.id ? String(editing.permissionRole.id) : '';
                    const nextRoleId = String(form.permissionRoleId || '');
                    if (currentRoleId !== nextRoleId) {
                        // Prefer the SELECTED role's portal so backend's portal-match
                        // check passes. Falls back to inferring from the user's
                        // current portal if no new role was picked (i.e. removing).
                        const selectedRole = nextRoleId
                            ? workshopRoles.find((r) => String(r.id) === nextRoleId)
                            : null;
                        const currentPortal = selectedRole?.portal
                            || editing.permissionRole?.portal
                            || (editing.userType === 'cashier_user' ? 'cashier'
                                : editing.role === 'technician'      ? 'technician'
                                : 'workshop');
                        try {
                            await workshopPermsApi.grantPortalAccess(editing.userId, {
                                portal: currentPortal,
                                roleId: nextRoleId || null,
                                password: null, // keep existing password
                            });
                        } catch (rerr) {
                            // The main employee update already committed, but the role
                            // swap failed. Common causes:
                            //   - Vultr DB connection blip ("Can't reach database server")
                            //   - Portal mismatch (role.portal !== currentPortal)
                            //   - Role no longer exists (deleted in another tab)
                            // Keep the modal open + setSaving(false) so user can retry
                            // without losing their other unsaved edits.
                            const msg = String(rerr?.message || 'unknown error');
                            const isNetwork = /Can't reach|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(msg);
                            alert(
                                isNetwork
                                    ? `Employee details saved, but ROLE assignment couldn't reach the database.\n\nThis is usually a temporary network blip — try saving again in a few seconds. Your role choice is still in the form.`
                                    : `Employee saved, but role assignment failed:\n${msg}`,
                            );
                            // Bail out before modal closes so the user can retry without
                            // re-opening + re-picking the role.
                            setSaving(false);
                            await loadEmployees();
                            return;
                        }
                    }
                }
            } else if (isTech) {
                await createWorkshopTechnician(body);
            } else if (isPortalStaffRole(form.role)) {
                const portalBody = { ...body };
                delete portalBody.role;
                portalBody.staffRole = form.role;
                ['workshopDuty', 'oncallAvailable', 'technicianType'].forEach((k) => {
                    if (portalBody[k] !== undefined) delete portalBody[k];
                });
                if (form.role !== 'team_leader') {
                    ['departmentId', 'department_id', 'departmentIds', 'department_ids', 'teamLeaderDepartmentId', 'team_leader_department_id'].forEach((k) => {
                        if (portalBody[k] !== undefined) delete portalBody[k];
                    });
                }
                const createRes = await createWorkshopPortalStaff(portalBody);
                const createdUserId =
                    createRes?.user?.id ??
                    createRes?.data?.user?.id ??
                    unwrapWorkshopPortalStaffDetail(createRes)?.id;
                if (form.permissionRoleId && canManagePermissions && createdUserId) {
                    const selectedRole = workshopRoles.find(
                        (r) => String(r.id) === String(form.permissionRoleId),
                    );
                    await workshopPermsApi.grantPortalAccess(String(createdUserId), {
                        portal: selectedRole?.portal || 'workshop',
                        roleId: form.permissionRoleId,
                    });
                }
            } else {
                await createWorkshopCashier(body);
            }
            setModalOpen(false);
            setEditing(null);
            await loadEmployees();
        } catch (e) {
            alert(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (emp) => {
        // Accept either the full row (new) or (id, source) for older callers.
        const id = typeof emp === 'object' ? emp.id : emp;
        const source = typeof emp === 'object' ? emp._source : arguments[1];
        const isPortal = typeof emp === 'object' && isPortalEmployeeRow(emp);
        if (source === 'technician') {
            alert('Technicians cannot be deleted. Edit the technician and set Status to Inactive instead.');
            return;
        }
        if (!confirm('Remove this employee? This cannot be undone.')) return;
        setSaving(true);
        try {
            if (isPortal) {
                // Manager / supervisor / team_leader — User row, NOT cashiers/employees table.
                // Uses User.id; the row's `userId` is the same as `id` for portal_user.
                const userId = (typeof emp === 'object' ? (emp.userId ?? emp.id) : id);
                await deleteWorkshopPortalStaff(userId);
            } else {
                await deleteWorkshopCashier(id);
            }
            await loadEmployees();
        } catch (e) {
            alert(e.message || 'Delete failed');
        } finally {
            setSaving(false);
        }
    };

    if (roleEditTarget !== null) {
        return (
            <WorkshopRoleScreen
                role={roleEditTarget.id ? roleEditTarget : null}
                branches={branchList}
                onBack={() => setRoleEditTarget(null)}
                onSaved={async () => {
                    setRoleEditTarget(null);
                    await loadWorkshopRoles();
                }}
            />
        );
    }

    if (portalAccessTarget) {
        return (
            <PortalAccessScreen
                employee={portalAccessTarget}
                roles={workshopRoles}
                onBack={() => setPortalAccessTarget(null)}
                onSaved={async () => {
                    setPortalAccessTarget(null);
                    await loadEmployees();
                }}
            />
        );
    }

    if (permissionsTarget) {
        return (
            <EmployeePermissionsScreen
                employee={permissionsTarget}
                onBack={() => setPermissionsTarget(null)}
                onSaved={() => setPermissionsTarget(null)}
            />
        );
    }

    if (modalOpen) {
        return (
            <WorkshopSubScreen
                title={editing ? 'Edit Employee' : 'Add New Employee'}
                subtitle={
                    editing
                        ? `Update ${editing.name || 'employee'} details, role, and access.`
                        : 'Create a cashier, technician, or portal staff member for this workshop.'
                }
                backLabel="Back to Employees"
                onBack={() => !saving && setModalOpen(false)}
                backDisabled={saving}
                size="wide"
                footer={(
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                        <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                            Cancel
                        </button>
                        <button type="button" className="btn-submit" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                )}
            >
                <div className="ws-section" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        color: 'var(--color-text-muted)',
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    BASIC INFORMATION
                                </div>
                                <div className="ws-form-grid" style={{ marginTop: 10 }}>
                                    <div className="ws-field">
                                        <label>Full Name *</label>
                                        <input
                                            value={form.full_name}
                                            onChange={(e) => set('full_name', e.target.value)}
                                            placeholder="Full Name"
                                            required
                                        />
                                    </div>
                                    <div className="ws-field">
                                        <label>Mobile *</label>
                                        <input
                                            value={form.mobile}
                                            onChange={(e) => set('mobile', e.target.value)}
                                            placeholder="05XXXXXXXX"
                                            required
                                        />
                                    </div>
                                    <div className="ws-field">
                                        <label>Email</label>
                                        <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" />
                                    </div>
                                    <div className="ws-field">
                                        <label>Iqama / CNIC</label>
                                        <input value={form.iqama} onChange={(e) => set('iqama', e.target.value)} placeholder="Iqama / CNIC" />
                                    </div>
                                    <div className="ws-field">
                                        {(() => {
                                            const asTechnician = form.is_technician || isTechnicianRole(form.role);
                                            const isLocker = isLockerPortalRole(form.role);
                                            const nonTechEdit = editing && editing._source !== 'technician';
                                            const branchRequired = !asTechnician && !isLocker && (!editing || nonTechEdit);
                                            return (
                                                <label>
                                                    Branch{' '}
                                                    {isLocker ? (
                                                        <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                                            (not used — locker users are workshop-wide)
                                                        </span>
                                                    ) : branchRequired ? (
                                                        '*'
                                                    ) : (
                                                        <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>(optional for technicians)</span>
                                                    )}
                                                </label>
                                            );
                                        })()}
                                        <select
                                            value={form.branchId}
                                            disabled={isLockerPortalRole(form.role)}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setForm((f) => ({
                                                    ...f,
                                                    branchId: v,
                                                    ...(f.role === 'team_leader' ? { teamLeaderDepartmentId: '' } : {}),
                                                }));
                                            }}
                                        >
                                            <option value="">
                                                {isLockerPortalRole(form.role) ? '— Not applicable —' : 'Select Branch'}
                                            </option>
                                            {branchSelectOptions.map((b) => (
                                                <option key={b.id} value={String(b.id)}>
                                                    {b.name}
                                                    {String(b.approvalStatus ?? '').toLowerCase() === 'pending'
                                                        ? ' (pending approval)'
                                                        : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="ws-field">
                                        <label>Role</label>
                                        <select
                                            value={form.role}
                                            disabled={!roleSelectEditable}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setForm((f) => ({
                                                    ...f,
                                                    role: v,
                                                    ...(v !== 'team_leader' ? { teamLeaderDepartmentId: '' } : {}),
                                                    ...(isLockerPortalRole(v) ? { branchId: '' } : {}),
                                                }));
                                            }}
                                        >
                                            {roleSelectOptions.map((r) => (
                                                <option key={r} value={r}>
                                                    {r.replace(/_/g, ' ')}
                                                </option>
                                            ))}
                                        </select>
                                        <small style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                                            {roleSelectEditable
                                                ? 'Job title — controls which workshop sub-flow they’re slotted into.'
                                                : 'Role is set at creation for this employee type and can’t be changed here. Use the Permission Role below to adjust their dashboard access.'}
                                        </small>
                                    </div>

                                    {/* Permission Role — optional overlay; leave blank for legacy full-access bypass. */}
                                    {canManagePermissions &&
                                        (editing?.userId ||
                                            (!editing &&
                                                isPortalStaffRole(form.role) &&
                                                !isLockerPortalRole(form.role))) && (
                                        <div className="ws-field">
                                            <label>Permission Role</label>
                                            <select
                                                value={form.permissionRoleId}
                                                onChange={(e) => setForm((f) => ({ ...f, permissionRoleId: e.target.value }))}
                                            >
                                                <option value="">— No role (full access via legacy bypass) —</option>
                                                {/* Show ALL workshop-managed roles regardless of portal — admin can
                                                    assign cross-portal if they know what they're doing. Each option's
                                                    portal is shown in the label so the choice is informed. Backend
                                                    still validates portal compatibility on save. */}
                                                {workshopRoles.length === 0 ? (
                                                    <option value="" disabled>
                                                        (No workshop roles created yet — create one in Roles & Permissions panel)
                                                    </option>
                                                ) : workshopRoles.map((r) => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.name} [{r.portal}] · {r.permissionCount} permissions
                                                    </option>
                                                ))}
                                            </select>
                                            <small style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                                                Controls dashboard tabs + actions. To change portal or password, use the 🔑 Portal Access button.
                                            </small>
                                        </div>
                                    )}

                                    {form.role === 'team_leader' && (
                                        <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                            <label>
                                                Department for team leader <span style={{ color: '#B91C1C' }}>*</span>
                                            </label>
                                            {!form.branchId ? (
                                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                                                    Choose a branch first — departments are loaded for that branch.
                                                </p>
                                            ) : teamLeaderDepartments.length === 0 ? (
                                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                                                    No departments adopted for this branch yet. Add departments from the
                                                    Master Catalog, then try again.
                                                </p>
                                            ) : (
                                                <select
                                                    value={form.teamLeaderDepartmentId}
                                                    onChange={(e) => set('teamLeaderDepartmentId', e.target.value)}
                                                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                                                >
                                                    <option value="">Select department</option>
                                                    {teamLeaderDepartments.map((d) => {
                                                        const id = String(d.id ?? d._id);
                                                        return (
                                                            <option key={id} value={id}>
                                                                {d.name ?? d.departmentName ?? id}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            )}
                                        </div>
                                    )}
                                    {(form.is_technician || isTechnicianRole(form.role)) && (
                                        <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                            <label>
                                                Departments{' '}
                                                <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                                    (workshop departments this technician can work in)
                                                </span>
                                            </label>
                                            {workshopDepartments.length === 0 ? (
                                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                                                    No departments adopted yet. Add some from the Master Catalog first.
                                                </p>
                                            ) : (
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                                        gap: 8,
                                                        marginTop: 6,
                                                        padding: 10,
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: 8,
                                                        maxHeight: 160,
                                                        overflow: 'auto',
                                                    }}
                                                >
                                                    {workshopDepartments.map((d) => {
                                                        const id = String(d.id);
                                                        const checked = form.departmentIds.includes(id);
                                                        return (
                                                            <label key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleDepartmentId(id)}
                                                                />
                                                                {d.name}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ height: 1, background: 'var(--color-border-light)' }} />

                            <div>
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        color: 'var(--color-text-muted)',
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    TECHNICIAN SETTINGS
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                                    <label
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: '0.875rem',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.is_technician}
                                            onChange={(e) => {
                                                const v = e.target.checked;
                                                setForm((f) => ({
                                                    ...f,
                                                    is_technician: v,
                                                    ...(!v ? { workshop_duty: false, oncall_available: false } : {}),
                                                    ...(v ? { workshop_duty: true, oncall_available: true } : {}),
                                                }));
                                            }}
                                        />
                                        This employee is a Technician
                                    </label>
                                </div>
                                {(form.is_technician || isTechnicianRole(form.role)) && (
                                    <div style={{ marginTop: 10 }}>
                                        <div
                                            style={{
                                                fontSize: '0.6875rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.07em',
                                                marginBottom: 10,
                                            }}
                                        >
                                            Technician type
                                        </div>
                                        <p style={{ margin: '0 0 10px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                                            {isCreateTechnicianMode
                                                ? 'Default for new technicians: both Workshop and On-Call are enabled.'
                                                : 'Select one or both. Workshop covers in-house assignment; On-Call covers mobile / after-hours eligibility.'}
                                        </p>
                                        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                                            <label
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    fontSize: '0.875rem',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isCreateTechnicianMode ? true : form.workshop_duty}
                                                    onChange={(e) => set('workshop_duty', e.target.checked)}
                                                    disabled={isCreateTechnicianMode}
                                                />
                                                Workshop
                                            </label>
                                            <label
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    fontSize: '0.875rem',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isCreateTechnicianMode ? true : form.oncall_available}
                                                    onChange={(e) => set('oncall_available', e.target.checked)}
                                                    disabled={isCreateTechnicianMode}
                                                />
                                                On-Call
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ height: 1, background: 'var(--color-border-light)' }} />

                            <div>
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        color: 'var(--color-text-muted)',
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    FINANCIAL
                                </div>
                                <div className="ws-form-grid" style={{ marginTop: 10 }}>
                                    <div className="ws-field">
                                        <label>Basic Salary (SAR)</label>
                                        <input
                                            type="number"
                                            value={form.basic_salary}
                                            onChange={(e) => set('basic_salary', e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="ws-field">
                                        <label>Commission %</label>
                                        <input
                                            type="number"
                                            value={form.commission_percent}
                                            onChange={(e) => set('commission_percent', parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="ws-field">
                                        <label>Commission Type</label>
                                        <select value={form.commission_type} onChange={(e) => set('commission_type', e.target.value)}>
                                            {COMMISSION_TYPE_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="ws-field">
                                        <label>Status</label>
                                        <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div style={{ height: 1, background: 'var(--color-border-light)' }} />

                            <div>
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        color: 'var(--color-text-muted)',
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    {editing ? 'RESET PASSWORD' : 'INITIAL PASSWORD'}
                                </div>
                                <div className="ws-form-grid" style={{ marginTop: 10 }}>
                                    <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                        <label>
                                            {editing ? 'New Password' : 'Password'}{' '}
                                            <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                                {editing
                                                    ? '(leave blank to keep the current password)'
                                                    : '(optional — a temporary password is generated if blank)'}
                                            </span>
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={form.password}
                                                onChange={(e) => set('password', e.target.value)}
                                                placeholder={editing ? 'New password' : 'Leave blank to auto-generate'}
                                                autoComplete="new-password"
                                                style={{ paddingRight: 40, width: '100%' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                style={{
                                                    position: 'absolute',
                                                    right: 8,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: 4,
                                                    color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>
            </WorkshopSubScreen>
        );
    }

    if (rolesPanelOpen && canManagePermissions) {
        return (
            <WorkshopSubScreen
                title="Roles & Permissions"
                subtitle="Create roles and assign permission bundles to employees."
                backLabel="Back to Employees"
                onBack={() => setRolesPanelOpen(false)}
                size="full"
            >
                <WorkshopRolesPanel
                    roles={workshopRoles}
                    canCreate={canCreateRoles}
                    canDelete={canDeleteRoles}
                    onCreate={() => setRoleEditTarget({})}
                    onEdit={(r) => setRoleEditTarget(r)}
                    onDelete={async (r) => {
                        if (!window.confirm(`Delete role "${r.name}"?`)) return;
                        try {
                            await workshopPermsApi.deleteRole(r.id);
                            await loadWorkshopRoles();
                        } catch (e) {
                            alert(e?.message || 'Could not delete role');
                        }
                    }}
                />
            </WorkshopSubScreen>
        );
    }

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Employees</h2>
                    <p className="ws-page-sub">
                        One list from the workshop employees API (staff, technicians, and cashiers). Portal roles
                        (manager / supervisor / team leader) show here when the server returns them; they sign in with
                        the workshop portal after approval.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    {canManagePermissions && (
                        <button
                            className="btn-portal-outline"
                            onClick={() => setRolesPanelOpen(true)}
                            title="Manage workshop roles & permissions"
                        >
                            <ShieldCheck size={15} /> Roles & Permissions ({workshopRoles.length})
                        </button>
                    )}
                    {canCreate && (
                        <button className="btn-portal" onClick={openAdd} disabled={saving}>
                            <Plus size={15} /> Add New Employee
                        </button>
                    )}
                </div>
            </div>

            {listError && (
                <div className="ws-section" style={{ marginBottom: 12, padding: 12, color: '#B91C1C', fontSize: '0.875rem' }}>
                    {listError}
                </div>
            )}
            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Total Staff</p>
                        <p className="ws-kpi-value">{displayedEmployees.length}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">
                        <Users size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">On Workshop Duty</p>
                        <p className="ws-kpi-value">{displayedEmployees.filter((e) => e.workshop_duty).length}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">
                        <Wrench size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">On-Call</p>
                        <p className="ws-kpi-value">{displayedEmployees.filter((e) => e.oncall_available).length}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--purple">
                        <Radio size={22} />
                    </div>
                </div>
            </div>
            <div className="ws-section" style={{ position: 'relative' }}>
                {loading && (
                    <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Loader size={20} style={{ animation: 'ws-spin 0.8s linear infinite' }} />
                        <span style={{ fontSize: '0.875rem' }}>Loading employees…</span>
                    </div>
                )}
                {!loading && displayedEmployees.length === 0 ? (
                    <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No employees in this view.</p>
                ) : (
                    !loading && (
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Assigned Role</th>
                                    <th>Department</th>
                                    <th>Branch</th>
                                    <th>Phone</th>
                                    <th>Commission %</th>
                                    <th>Workshop Duty</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedEmployees.map((emp) => (
                                    <tr key={`${emp._source}-${emp.id}`}>
                                        <td>
                                            <strong>{emp.name}</strong>
                                        </td>
                                        <td>{String(emp.role || '').replace(/_/g, ' ') || '—'}</td>
                                        <td>
                                            {emp.permissionRole ? (
                                                <span style={{
                                                    display: 'inline-block', padding: '2px 8px',
                                                    borderRadius: 999, background: '#f5f3ff',
                                                    color: '#6b21a8', fontWeight: 700, fontSize: '0.75rem',
                                                }}>
                                                    {emp.permissionRole.name}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>—</span>
                                            )}
                                        </td>
                                        <td>{formatEmployeeDepartments(emp) ?? '—'}</td>
                                        <td>{emp.branch || '—'}</td>
                                        <td>{emp.phone}</td>
                                        <td>{emp.commission_percent}%</td>
                                        <td>
                                            <span className={`ws-badge ${emp.workshop_duty ? 'ws-badge--green' : 'ws-badge--gray'}`}>
                                                {emp.workshop_duty ? 'Active' : 'Off'}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className={`ws-badge ${
                                                    emp.status === 'active'
                                                        ? 'ws-badge--green'
                                                        : emp.status === 'pending'
                                                          ? 'ws-badge--yellow'
                                                          : 'ws-badge--red'
                                                }`}
                                            >
                                                {emp.status === 'pending' ? 'pending approval' : emp.status}
                                            </span>
                                        </td>
                                        <td style={{ display: 'flex', gap: 6 }}>
                                            {canEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(emp)}
                                                    style={{
                                                        padding: '5px 10px',
                                                        background: '#EFF6FF',
                                                        color: '#2563EB',
                                                        border: 'none',
                                                        borderRadius: 6,
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                    }}
                                                    disabled={saving}
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                            )}
                                            {canDelete && emp._source !== 'technician' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(emp)}
                                                    style={{
                                                        padding: '5px 10px',
                                                        background: '#FEE2E2',
                                                        color: '#DC2626',
                                                        border: 'none',
                                                        borderRadius: 6,
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                    }}
                                                    disabled={saving}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                            {canManagePermissions && emp.userId && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPortalAccessTarget(emp)}
                                                    title="Grant / change portal access (cashier / technician / workshop)"
                                                    style={{
                                                        padding: '5px 10px',
                                                        background: '#FEF3C7',
                                                        color: '#92400E',
                                                        border: 'none',
                                                        borderRadius: 6,
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                    }}
                                                >
                                                    <Key size={12} />
                                                </button>
                                            )}
                                            {canManagePermissions && emp.userId && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPermissionsTarget(emp)}
                                                    title="Override permissions for this user"
                                                    style={{
                                                        padding: '5px 10px',
                                                        background: '#F3E8FF',
                                                        color: '#6B21A8',
                                                        border: 'none',
                                                        borderRadius: 6,
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                    }}
                                                >
                                                    <ShieldCheck size={12} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                )}
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Workshop Roles Panel — lists this workshop's custom roles                */
/* ────────────────────────────────────────────────────────────────────────── */

const PORTAL_OPTIONS = [
    { id: 'workshop',   label: 'Workshop Admin Portal' },
    { id: 'cashier',    label: 'Cashier (POS) Portal' },
    { id: 'technician', label: 'Technician Portal' },
];

/**
 * Predefined role names — same job-titles list used by the Add Employee form
 * (ROLE_OPTIONS in workshop/constants.js). Keeping this list in sync means a
 * workshop will typically have roles named after the same job titles its
 * employees hold, making role assignment self-documenting.
 */
const PREDEFINED_ROLE_NAMES = [
    'cashier',
    'technician',
    'supervisor',
    'manager',
    'team_leader',
    'locker_supervisor',
    'locker_collector',
];

const formatRoleName = (slug) =>
    slug.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

function WorkshopRolesPanel({ roles, canCreate = true, canDelete = true, onCreate, onEdit, onDelete }) {
    return (
        <div className="ws-section" style={{ marginBottom: 16, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Workshop Roles</h3>
                {canCreate && (
                    <button className="btn-portal" onClick={onCreate}>
                        <Plus size={14} /> Create Role
                    </button>
                )}
            </div>
            {roles.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
                    No custom roles yet. Click <strong>Create Role</strong> to bundle a set of permissions
                    you can later assign to employees.
                </p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                    {roles.map((r) => (
                        <div key={r.id} style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: 10, padding: 12, background: '#fff',
                            display: 'flex', flexDirection: 'column', gap: 6,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '0.9375rem' }}>{r.name}</strong>
                                <span style={{
                                    fontSize: '0.7rem', fontWeight: 700,
                                    padding: '2px 8px', borderRadius: 999,
                                    background: r.portal === 'cashier' ? '#dbeafe' :
                                                r.portal === 'technician' ? '#fed7aa' : '#dcfce7',
                                    color:      r.portal === 'cashier' ? '#1e40af' :
                                                r.portal === 'technician' ? '#9a3412' : '#166534',
                                }}>
                                    {r.portal}
                                </span>
                            </div>
                            {r.description && (
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{r.description}</p>
                            )}
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                                {r.permissionCount} permissions · {r.userCount} user(s) assigned
                            </p>
                            {r.portal === 'workshop' && (
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                                    Branches: {r.branchScope === 'all' || !r.branches?.length
                                        ? 'All'
                                        : r.branches.map((b) => b.name).join(', ')}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                <button
                                    type="button"
                                    style={{ flex: 1, padding: '5px', background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                    onClick={() => onEdit(r)}
                                >
                                    <Pencil size={12} /> Edit
                                </button>
                                {!r.isSystem && (
                                    <button
                                        type="button"
                                        style={{ flex: 1, padding: '5px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                        onClick={() => onDelete(r)}
                                    >
                                        <Trash2 size={12} /> Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Workshop Role Create / Edit Screen                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function WorkshopRoleScreen({ role, branches = [], onBack, onSaved }) {
    const isEdit = Boolean(role?.id);
    const [name, setName] = useState(role?.name ?? '');
    const [description, setDescription] = useState(role?.description ?? '');
    const [portal, setPortal] = useState(role?.portal ?? 'workshop');
    const [perms, setPerms] = useState(role?.permissions ? codesToActionsByTab(role.permissions) : {});
    const [tree, setTree] = useState([]);
    const [loadingTree, setLoadingTree] = useState(false);
    const [saving, setSaving] = useState(false);

    // Branch scope — only meaningful for portal = 'workshop'. Empty array sent
    // to backend = "All Branches" (no restriction).
    //   - 'all'      → assigned users can switch between all workshop branches
    //   - 'specific' → assigned users are restricted to selectedBranchIds only
    const [branchScope, setBranchScope] = useState(role?.branchScope ?? 'all');
    const [selectedBranchIds, setSelectedBranchIds] = useState(
        (role?.branchIds ?? []).map(String),
    );

    useEffect(() => {
        setLoadingTree(true);
        workshopPermsApi.getRegistry(portal)
            .then((res) => setTree(res?.tree ?? []))
            .catch(() => setTree([]))
            .finally(() => setLoadingTree(false));
    }, [portal]);

    const totalActions = useMemo(
        () => tree.reduce((s, sec) => s + sec.tabs.reduce((c, t) => c + (t.actions?.length ?? 0), 0), 0),
        [tree],
    );
    const selectedCount = useMemo(
        () => Object.values(perms).reduce((s, m) => s + Object.values(m).filter(Boolean).length, 0),
        [perms],
    );

    const toggleAction = (tabKey, action) =>
        setPerms((p) => ({ ...p, [tabKey]: { ...(p[tabKey] || {}), [action]: !p[tabKey]?.[action] } }));
    const toggleTabAll = (tab) => {
        const allOn = tab.actions.every((a) => perms[tab.key]?.[a]);
        const next = { ...(perms[tab.key] || {}) };
        tab.actions.forEach((a) => { next[a] = !allOn; });
        setPerms((p) => ({ ...p, [tab.key]: next }));
    };
    const selectAll = () => {
        const allOn = selectedCount === totalActions;
        const next = {};
        if (!allOn) for (const sec of tree) for (const t of sec.tabs) {
            next[t.key] = {};
            for (const a of t.actions) next[t.key][a] = true;
        }
        setPerms(next);
    };

    const handleSave = async () => {
        if (!name.trim()) { alert('Role name is required'); return; }
        if (portal === 'workshop' && branchScope === 'specific' && selectedBranchIds.length === 0) {
            alert('Pick at least one branch, or switch to "All Branches"');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim(),
                permissions: flattenActionsByTab(perms),
                // Branch scope: 'all' → empty list (no restriction);
                // 'specific' → only the picked branches.
                // Only sent for workshop portal — backend ignores for cashier/technician.
                branchIds: portal === 'workshop' && branchScope === 'specific'
                    ? selectedBranchIds.map(String)
                    : [],
            };
            if (isEdit) {
                await workshopPermsApi.updateRole(role.id, payload);
            } else {
                await workshopPermsApi.createRole({ ...payload, portal });
            }
            onSaved?.();
        } catch (e) {
            alert(e?.message || 'Could not save role');
        } finally {
            setSaving(false);
        }
    };

    return (
        <WorkshopSubScreen
            title={isEdit ? `Edit Role — ${role.name}` : 'Create Workshop Role'}
            subtitle="Bundle permissions and optional branch scope for workshop staff."
            backLabel="Back to Roles"
            onBack={onBack}
            backDisabled={saving}
            size="xl"
            footer={(
                <>
                    <button className="btn-portal-outline" onClick={onBack} disabled={saving}>Cancel</button>
                    <button className="btn-portal" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Role')}
                    </button>
                </>
            )}
        >
            <div className="ws-section" style={{ padding: 20, fontSize: '0.875rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Role name *</label>
                        <select
                            value={PREDEFINED_ROLE_NAMES.includes(name) ? name : (name ? '__custom__' : '')}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (v === '__custom__') setName('');     // open free-text below
                                else if (v === '') setName('');
                                else setName(v);
                            }}
                            disabled={isEdit}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', opacity: isEdit ? 0.7 : 1 }}
                        >
                            <option value="">— Pick a role name —</option>
                            {PREDEFINED_ROLE_NAMES.map((n) => (
                                <option key={n} value={n}>{formatRoleName(n)}</option>
                            ))}
                            <option value="__custom__">Custom name…</option>
                        </select>
                        {/* Free-text input only when user picked "Custom" (or in edit mode). */}
                        {(!PREDEFINED_ROLE_NAMES.includes(name) || isEdit) && (
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={isEdit ? '' : 'Type a custom name'}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', marginTop: 6 }}
                            />
                        )}
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Portal</label>
                        <select
                            value={portal}
                            onChange={(e) => { setPortal(e.target.value); setPerms({}); }}
                            disabled={isEdit}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', opacity: isEdit ? 0.7 : 1 }}
                        >
                            {PORTAL_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                        {isEdit && (
                            <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Portal cannot change after creation.</small>
                        )}
                    </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Description</label>
                    <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }} />
                </div>

                {/* Branch scope — workshop portal only. Cashier & technician use
                    per-user User.branchId (set at employee creation) for scoping. */}
                {portal === 'workshop' && (
                    <div style={{ marginBottom: 14, padding: 12, background: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Branch Access</label>
                        <select
                            value={branchScope}
                            onChange={(e) => setBranchScope(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', marginBottom: branchScope === 'specific' ? 10 : 0 }}
                        >
                            <option value="all">All Branches (no restriction)</option>
                            <option value="specific">Specific Branches…</option>
                        </select>

                        {branchScope === 'specific' && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {branches.length === 0 ? (
                                    <small style={{ color: '#92400e' }}>No branches available.</small>
                                ) : branches.map((b) => {
                                    const id = String(b.id);
                                    const on = selectedBranchIds.includes(id);
                                    return (
                                        <label key={id} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                                            border: `1px solid ${on ? '#7c3aed' : '#cbd5e1'}`,
                                            background: on ? '#f5f3ff' : '#fff',
                                            color: on ? '#6b21a8' : '#475569',
                                            fontSize: '0.8125rem', fontWeight: 600,
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                onChange={() => setSelectedBranchIds((prev) => (
                                                    on ? prev.filter((x) => x !== id) : [...prev, id]
                                                ))}
                                                style={{ display: 'none' }}
                                            />
                                            {b.name}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        <small style={{ display: 'block', marginTop: 8, color: '#64748b', fontSize: '0.75rem' }}>
                            Users with this role will only be able to switch between the selected branches in the sidebar.
                        </small>
                    </div>
                )}

                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 10, background: '#f8fafc',
                    border: '1px solid var(--color-border)', marginBottom: 12,
                }}>
                    <span style={{ fontWeight: 700 }}>
                        {selectedCount} of {totalActions} permissions selected
                    </span>
                    <button type="button" className="btn-link" onClick={selectAll}>
                        {selectedCount === totalActions ? 'Deselect All' : 'Select All'}
                    </button>
                </div>

                {loadingTree ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                        <Loader size={18} className="spin" /> Loading permissions…
                    </div>
                ) : tree.length === 0 ? (
                    <div style={{ padding: 20, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '0.875rem' }}>
                        No permissions defined yet for the <strong>{portal}</strong> portal. You can still
                        create the role — assigned users will use the legacy fallback (full access for now).
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {tree.map((sec) => (
                            <SectionCard key={sec.section} section={sec} perms={perms} onToggleAction={toggleAction} onToggleTab={toggleTabAll} />
                        ))}
                    </div>
                )}
            </div>
        </WorkshopSubScreen>
    );
}

function SectionCard({ section, perms, onToggleAction, onToggleTab }) {
    const [open, setOpen] = useState(true);
    const total = section.tabs.reduce((s, t) => s + (t.actions?.length ?? 0), 0);
    const checked = section.tabs.reduce((s, t) => s + (t.actions?.filter((a) => perms[t.key]?.[a]).length ?? 0), 0);
    return (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <strong style={{ flex: 1 }}>{section.section}</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{checked}/{total}</span>
            </div>
            {open && section.tabs.map((tab) => {
                if ((tab.actions?.length ?? 0) === 0) {
                    return <div key={tab.key} style={{ padding: 8, fontSize: '0.8125rem', color: '#92400e', background: '#fffbeb', borderRadius: 6, marginBottom: 6 }}>{tab.label}</div>;
                }
                const all = tab.actions.every((a) => perms[tab.key]?.[a]);
                return (
                    <div key={tab.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: 6, background: '#fff' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 220 }}>
                            <input type="checkbox" checked={all} onChange={() => onToggleTab(tab)} />
                            <strong style={{ fontSize: '0.8125rem' }}>{tab.label}</strong>
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 'auto' }}>
                            {tab.actions.map((a) => {
                                const on = !!perms[tab.key]?.[a];
                                return (
                                    <label key={a} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '3px 8px', borderRadius: 999, cursor: 'pointer',
                                        border: `1px solid ${on ? '#7c3aed' : '#cbd5e1'}`,
                                        background: on ? '#f5f3ff' : '#fff',
                                        color: on ? '#6b21a8' : '#64748b',
                                        fontSize: '0.7rem', fontWeight: 700,
                                    }}>
                                        <input type="checkbox" checked={on} onChange={() => onToggleAction(tab.key, a)} style={{ display: 'none' }} />
                                        {a}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Portal Access Screen — per employee                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function PortalAccessScreen({ employee, roles, onBack, onSaved }) {
    const [portal, setPortal] = useState('workshop');
    const [roleId, setRoleId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const availableRoles = useMemo(
        () => roles.filter((r) => r.portal === portal),
        [roles, portal],
    );

    const handleSave = async () => {
        setError('');
        if (!portal) { setError('Select a portal'); return; }
        if (password && password.length > 0 && password.length < 6) {
            setError('Password must be at least 6 characters (or leave blank to keep current)');
            return;
        }
        setSaving(true);
        try {
            await workshopPermsApi.grantPortalAccess(employee.userId ?? employee.id, {
                portal,
                roleId: roleId || null,
                password: password || null,
            });
            onSaved?.();
        } catch (e) {
            setError(e?.message || 'Could not grant portal access');
        } finally {
            setSaving(false);
        }
    };

    return (
        <WorkshopSubScreen
            title={`Portal Access — ${employee.name || employee.email}`}
            subtitle="Choose which portal this employee signs into and which role applies."
            backLabel="Back to Employees"
            onBack={onBack}
            backDisabled={saving}
            size="form"
            footer={(
                <>
                    <button className="btn-portal-outline" onClick={onBack} disabled={saving}>Cancel</button>
                    <button className="btn-portal" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Grant Access'}
                    </button>
                </>
            )}
        >
            <div className="ws-section" style={{ padding: 20, fontSize: '0.875rem' }}>
                <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 14 }}>
                    <strong>{employee.name || '—'}</strong>
                    <div style={{ color: '#64748b', fontSize: '0.8125rem' }}>{employee.email || 'no email'}</div>
                </div>
                {error && (
                    <div style={{ marginBottom: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8 }}>{error}</div>
                )}

                <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Portal *</label>
                    <select
                        value={portal}
                        onChange={(e) => { setPortal(e.target.value); setRoleId(''); }}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                    >
                        {PORTAL_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                        The employee will sign in via this portal's login page using their email + password.
                    </small>
                </div>

                <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Role</label>
                    <select
                        value={roleId}
                        onChange={(e) => setRoleId(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                    >
                        <option value="">— No role (full access via legacy bypass) —</option>
                        {availableRoles.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name} · {r.permissionCount} permissions
                            </option>
                        ))}
                    </select>
                    {availableRoles.length === 0 && (
                        <small style={{ color: '#92400e', fontSize: '0.75rem' }}>
                            No roles defined for the {portal} portal yet. Create one in <strong>Roles & Permissions</strong> first.
                        </small>
                    )}
                </div>

                <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                        New password <span style={{ fontWeight: 400, color: '#64748b' }}>(leave blank to keep current)</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            style={{ width: '100%', padding: '10px 36px 10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div style={{
                    padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: 8, fontSize: '0.75rem', color: '#1e40af',
                }}>
                    💡 This replaces any existing portal access this employee has — one employee can only
                    use one portal at a time.
                </div>
            </div>
        </WorkshopSubScreen>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Employee Permission Override Screen                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function EmployeePermissionsScreen({ employee, onBack, onSaved }) {
    const userId = employee.userId ?? employee.id;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [hasOverride, setHasOverride] = useState(false);
    const [tree, setTree] = useState([]);
    const [perms, setPerms] = useState({});

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        Promise.all([
            workshopPermsApi.getEmployeePermissions(userId),
            // We need a tree to render the matrix. Use the portal of the user's
            // assigned role if any; otherwise default to 'workshop'.
        ]).then(async ([res]) => {
            if (cancelled) return;
            setHasOverride(Boolean(res?.hasOverride));
            // We don't know the portal from the employee row directly; try to infer.
            const portalGuess = inferPortalFromEmployee(employee) || 'workshop';
            const treeRes = await workshopPermsApi.getRegistry(portalGuess).catch(() => ({ tree: [] }));
            if (cancelled) return;
            setTree(treeRes?.tree ?? []);
            setPerms(codesToActionsByTab(res?.effectiveCodes ?? []));
        }).catch((e) => {
            if (!cancelled) setError(e?.message || 'Failed to load permissions');
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => { cancelled = true; };
    }, [userId, employee]);

    const total = useMemo(
        () => tree.reduce((s, sec) => s + sec.tabs.reduce((c, t) => c + (t.actions?.length ?? 0), 0), 0),
        [tree],
    );
    const checked = useMemo(
        () => Object.values(perms).reduce((s, m) => s + Object.values(m).filter(Boolean).length, 0),
        [perms],
    );

    const toggleAction = (tabKey, action) =>
        setPerms((p) => ({ ...p, [tabKey]: { ...(p[tabKey] || {}), [action]: !p[tabKey]?.[action] } }));
    const toggleTabAll = (tab) => {
        const allOn = tab.actions.every((a) => perms[tab.key]?.[a]);
        const next = { ...(perms[tab.key] || {}) };
        tab.actions.forEach((a) => { next[a] = !allOn; });
        setPerms((p) => ({ ...p, [tab.key]: next }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await workshopPermsApi.setEmployeePermissions(userId, flattenActionsByTab(perms));
            onSaved?.();
        } catch (e) {
            alert(e?.message || 'Could not save');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('Revert this employee to their role\'s default permissions?')) return;
        setSaving(true);
        try {
            await workshopPermsApi.clearEmployeePermissions(userId);
            onSaved?.();
        } catch (e) {
            alert(e?.message || 'Could not reset');
        } finally {
            setSaving(false);
        }
    };

    return (
        <WorkshopSubScreen
            title={`Permissions — ${employee.name || employee.email}`}
            subtitle="Override this employee's effective permissions on top of their assigned role."
            backLabel="Back to Employees"
            onBack={onBack}
            backDisabled={saving}
            size="xl"
            footer={(
                <>
                    {hasOverride && (
                        <button className="btn-portal-outline" onClick={handleReset} disabled={saving}>Reset to role defaults</button>
                    )}
                    <button className="btn-portal-outline" onClick={onBack} disabled={saving}>Cancel</button>
                    <button className="btn-portal" onClick={handleSave} disabled={saving || loading}>
                        {saving ? 'Saving…' : 'Save Override'}
                    </button>
                </>
            )}
        >
            <div className="ws-section" style={{ padding: 20, fontSize: '0.875rem' }}>
                <div style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: hasOverride ? '#faf5ff' : '#eff6ff',
                    border: `1px solid ${hasOverride ? '#e9d5ff' : '#bfdbfe'}`,
                    fontSize: '0.8125rem', marginBottom: 14, fontWeight: 600,
                    color: hasOverride ? '#6b21a8' : '#1e40af',
                }}>
                    {hasOverride
                        ? '🟣 Custom override active for this employee.'
                        : '🔵 Using role defaults — saving below creates a per-user override.'}
                </div>
                {error && (
                    <div style={{ marginBottom: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8 }}>{error}</div>
                )}
                {loading ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                        <Loader size={18} className="spin" /> Loading…
                    </div>
                ) : (
                    <>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 14px', borderRadius: 10, background: '#f1f5f9',
                            border: '1px solid var(--color-border)', marginBottom: 12,
                        }}>
                            <strong>{checked} of {total} permissions selected</strong>
                        </div>
                        {tree.length === 0 ? (
                            <div style={{ padding: 20, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                                No permissions defined for this portal yet.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {tree.map((sec) => (
                                    <SectionCard key={sec.section} section={sec} perms={perms} onToggleAction={toggleAction} onToggleTab={toggleTabAll} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </WorkshopSubScreen>
    );
}

function inferPortalFromEmployee(emp) {
    const ut = String(emp.userType ?? '').toLowerCase();
    if (ut === 'cashier_user') return 'cashier';
    if (ut === 'workshop_user' || ut === 'workshop_owner') return 'workshop';
    const role = String(emp.role ?? '').toLowerCase();
    if (role === 'technician') return 'technician';
    if (role === 'cashier') return 'cashier';
    return 'workshop';
}
