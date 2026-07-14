import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Plus,
    Pencil,
    ChevronDown,
    Loader,
    Search,
    Users,
    UserCheck,
    Wrench,
    Building2,
} from 'lucide-react';
import EmployeesPageShell from '../../components/admin/EmployeesPageShell';
import { ShimmerTable } from '../../components/supplier/Shimmer';
import '../../styles/admin/EmployeesPage.css';
import '../../styles/admin/ApprovalsPage.css';
import {
    getTechnicians,
    getCashiers,
    getTechnician,
    getCashier,
    createTechnician,
    createCashier,
    updateTechnician,
    updateCashier,
    getWorkshopOptions,
    getBranches,
} from '../../services/superAdminApi';
import { parseEmployeesRoute, employeesRoutes, EMPLOYEES_BASE } from '../../utils/employeesRoutes';

const EMPTY_FORM = {
    name: '',
    mobile: '',
    email: '',
    password: '',
    role: 'cashier',
    workshopId: '',
    branchId: '',
    technicianType: 'workshop',
    commissionPercent: '0',
    isActive: true,
};

const ROLE_TABS = [
    { id: 'all', label: 'All' },
    { id: 'cashier', label: 'Cashiers' },
    { id: 'technician', label: 'Technicians' },
];

function pickArray(res, keys = []) {
    if (Array.isArray(res)) return res;
    for (const key of keys) {
        if (Array.isArray(res?.[key])) return res[key];
        if (Array.isArray(res?.data?.[key])) return res.data[key];
    }
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.data?.items)) return res.data.items;
    return [];
}

function inferRole(emp) {
    const raw = String(emp?.role ?? emp?.rawRole ?? '').trim().toLowerCase();
    if (raw.includes('tech')) return 'technician';
    if (raw.includes('cash')) return 'cashier';
    if (emp?.technicianType) return 'technician';
    return raw || 'cashier';
}

/** Human-readable duty label — DB stores workshop | on_call | both */
function formatTechnicianTypeLabel(value) {
    const key = String(value ?? '').trim().toLowerCase();
    if (!key) return '';
    if (key === 'workshop') return 'Workshop';
    if (key === 'on_call' || key === 'oncall') return 'On call';
    if (key === 'both') return 'Workshop & on-call';
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeEmployee(u, roleHint) {
    const rawRole = roleHint ?? inferRole(u);
    return {
        id: String(u.id ?? u._id ?? ''),
        name: u.name ?? u.fullName ?? '—',
        mobile: u.mobile ?? u.phone ?? '',
        email: u.email ?? '',
        rawRole,
        role: u.position ?? rawRole ?? u.role ?? u.userType ?? rawRole,
        workshopId: u.workshopId != null ? String(u.workshopId) : '',
        workshopName: u.workshopName ?? u.workshop?.name ?? '—',
        branchId: u.branchId != null ? String(u.branchId) : '',
        technicianType: u.technicianType ?? null,
        branch: u.branchName ?? u.branch?.name ?? '—',
        commission:
            u.commissionPercent != null && u.commissionPercent !== ''
                ? `${u.commissionPercent}%`
                : '—',
        commissionPercent: u.commissionPercent != null ? String(u.commissionPercent) : '0',
        status: u.isActive === false ? 'inactive' : 'active',
        isActive: u.isActive !== false,
    };
}

function employeeToForm(emp) {
    return {
        name: emp.name === '—' ? '' : emp.name,
        mobile: emp.mobile || '',
        email: emp.email || '',
        password: '',
        role: emp.rawRole || inferRole(emp),
        workshopId: emp.workshopId || '',
        branchId: emp.branchId || '',
        technicianType: emp.technicianType || 'workshop',
        commissionPercent: emp.commissionPercent || '0',
        isActive: emp.isActive !== false,
    };
}

function SelectField({ value, onChange, disabled, children, className = '' }) {
    return (
        <div className={`select-wrapper ${className}`.trim()}>
            <select className="form-input-field" value={value} onChange={onChange} disabled={disabled}>
                {children}
            </select>
            <ChevronDown size={16} className="select-icon" />
        </div>
    );
}

function EmployeeFormFields({ values, onChange, isEdit = false, workshopOptions = [], branchOptions = [] }) {
    const set = (field) => (e) => onChange(field, e.target.value);
    const isTechnician = values.role === 'technician';

    return (
        <div className="employees-form-layout">
            <section className="employees-form-section">
                <h2 className="employees-form-section-title">Assignment</h2>
                <div className="employees-form-grid employees-form-grid--3">
                    <div className="form-group">
                        <label className="form-label">Workshop *</label>
                        <SelectField
                            value={values.workshopId}
                            onChange={(e) => {
                                onChange('workshopId', e.target.value);
                                onChange('branchId', '');
                            }}
                            disabled={isEdit}
                        >
                            <option value="">Select workshop</option>
                            {workshopOptions.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}
                                </option>
                            ))}
                        </SelectField>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Branch *</label>
                        <SelectField
                            value={values.branchId}
                            onChange={set('branchId')}
                            disabled={!values.workshopId}
                        >
                            <option value="">Select branch</option>
                            {branchOptions.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </SelectField>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Role *</label>
                        <SelectField value={values.role} onChange={set('role')} disabled={isEdit}>
                            <option value="cashier">Cashier</option>
                            <option value="technician">Technician</option>
                        </SelectField>
                    </div>
                </div>
            </section>

            <section className="employees-form-section">
                <h2 className="employees-form-section-title">Profile</h2>
                <div className="employees-form-grid employees-form-grid--4">
                    <div className="form-group span-2">
                        <label className="form-label">Full name *</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Employee name"
                            value={values.name}
                            onChange={set('name')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Mobile *</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="05XXXXXXXX"
                            value={values.mobile}
                            onChange={set('mobile')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email {isTechnician ? '' : '*'}</label>
                        <input
                            type="email"
                            className="form-input-field"
                            placeholder="email@example.com"
                            autoComplete="off"
                            value={values.email}
                            onChange={set('email')}
                        />
                    </div>
                </div>
            </section>

            {isTechnician ? (
                <section className="employees-form-section">
                    <h2 className="employees-form-section-title">Technician settings</h2>
                    <div className="employees-form-grid employees-form-grid--3">
                        <div className="form-group">
                            <label className="form-label">Technician type</label>
                            <SelectField value={values.technicianType} onChange={set('technicianType')}>
                                <option value="workshop">Workshop</option>
                                <option value="on_call">On call</option>
                                {values.technicianType === 'both' ? (
                                    <option value="both">Workshop & on-call</option>
                                ) : null}
                            </SelectField>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Commission %</label>
                            <input
                                type="number"
                                min="0"
                                step="0.1"
                                className="form-input-field"
                                value={values.commissionPercent}
                                onChange={set('commissionPercent')}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <SelectField
                                value={values.isActive ? 'active' : 'inactive'}
                                onChange={(e) => onChange('isActive', e.target.value === 'active')}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </SelectField>
                        </div>
                    </div>
                </section>
            ) : (
                <section className="employees-form-section">
                    <h2 className="employees-form-section-title">Status</h2>
                    <div className="employees-form-grid employees-form-grid--3">
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <SelectField
                                value={values.isActive ? 'active' : 'inactive'}
                                onChange={(e) => onChange('isActive', e.target.value === 'active')}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </SelectField>
                        </div>
                    </div>
                </section>
            )}

            <section className="employees-form-section">
                <h2 className="employees-form-section-title">{isEdit ? 'Reset password' : 'Portal login'}</h2>
                <div className="employees-form-grid employees-form-grid--3">
                    <div className="form-group">
                        <label className="form-label">{isEdit ? 'New password' : 'Password *'}</label>
                        <input
                            type="password"
                            className="form-input-field"
                            placeholder={isEdit ? 'Leave blank to keep current' : 'Login password'}
                            autoComplete="new-password"
                            value={values.password}
                            onChange={set('password')}
                        />
                    </div>
                </div>
                {!isEdit ? (
                    <p className="employees-form-hint">
                        Login credentials can be shared with the employee after creation.
                    </p>
                ) : null}
            </section>
        </div>
    );
}

export default function EmployeesPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const route = parseEmployeesRoute(location.pathname);
    const pageMode = Boolean(route);

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editMeta, setEditMeta] = useState({ id: null, role: 'cashier' });
    const [editLoading, setEditLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [formBranchOptions, setFormBranchOptions] = useState([]);
    const [workshopFilter, setWorkshopFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const latestFetchRef = useRef(0);

    const goBack = useCallback(() => navigate(EMPLOYEES_BASE), [navigate]);

    const onFormField = useCallback((field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    }, []);

    const approvedWorkshopOptions = useMemo(
        () => workshopOptions.filter((w) => w.status === 'approved' || !w.status),
        [workshopOptions],
    );

    const reloadEmployees = useCallback(async () => {
        const fetchId = ++latestFetchRef.current;
        setLoading(true);
        const params = {
            workshopId: workshopFilter || undefined,
            branchId: branchFilter || undefined,
        };
        try {
            if (roleFilter === 'technician') {
                const techs = await getTechnicians(params);
                const techList = pickArray(techs, ['technicians'])
                    .map((u) => normalizeEmployee(u, 'technician'))
                    .filter((u) => inferRole(u) === 'technician');
                if (fetchId !== latestFetchRef.current) return;
                setEmployees(techList);
                return;
            }
            if (roleFilter === 'cashier') {
                const cashiers = await getCashiers(params);
                const cashierList = pickArray(cashiers, ['cashiers'])
                    .map((u) => normalizeEmployee(u, 'cashier'))
                    .filter((u) => inferRole(u) === 'cashier');
                if (fetchId !== latestFetchRef.current) return;
                setEmployees(cashierList);
                return;
            }
            const [techs, cashiers] = await Promise.all([
                getTechnicians(params),
                getCashiers(params),
            ]);
            const techList = pickArray(techs, ['technicians'])
                .map((u) => normalizeEmployee(u, 'technician'))
                .filter((u) => inferRole(u) === 'technician');
            const cashierList = pickArray(cashiers, ['cashiers'])
                .map((u) => normalizeEmployee(u, 'cashier'))
                .filter((u) => inferRole(u) === 'cashier');
            if (fetchId !== latestFetchRef.current) return;
            setEmployees([...techList, ...cashierList]);
        } catch {
            if (fetchId !== latestFetchRef.current) return;
            setEmployees([]);
        } finally {
            if (fetchId !== latestFetchRef.current) return;
            setLoading(false);
        }
    }, [roleFilter, workshopFilter, branchFilter]);

    useEffect(() => {
        getWorkshopOptions()
            .then((res) => {
                const rows = pickArray(res, ['options', 'workshops']);
                setWorkshopOptions(
                    rows
                        .map((w) => ({
                            id: String(w.id ?? w.value ?? w.workshopId ?? ''),
                            name: w.name ?? w.label ?? w.workshopName ?? `Workshop ${w.id ?? ''}`,
                            status: String(w.status ?? '').toLowerCase(),
                        }))
                        .filter((w) => w.id),
                );
            })
            .catch(() => setWorkshopOptions([]));
    }, []);

    useEffect(() => {
        if (!workshopFilter) {
            setBranchOptions([]);
            setBranchFilter('');
            return;
        }
        getBranches({ workshopId: workshopFilter })
            .then((res) => {
                const rows = pickArray(res, ['branches']);
                setBranchOptions(
                    rows
                        .map((b) => ({
                            id: String(b.id ?? b.value ?? b.branchId ?? ''),
                            name: b.name ?? b.branchName ?? b.label ?? `Branch ${b.id ?? ''}`,
                        }))
                        .filter((b) => b.id),
                );
            })
            .catch(() => setBranchOptions([]));
    }, [workshopFilter]);

    useEffect(() => {
        if (!form.workshopId) {
            setFormBranchOptions([]);
            return;
        }
        getBranches({ workshopId: form.workshopId })
            .then((res) => {
                const rows = pickArray(res, ['branches']);
                setFormBranchOptions(
                    rows
                        .map((b) => ({
                            id: String(b.id ?? b.value ?? b.branchId ?? ''),
                            name: b.name ?? b.branchName ?? b.label ?? `Branch ${b.id ?? ''}`,
                        }))
                        .filter((b) => b.id),
                );
            })
            .catch(() => setFormBranchOptions([]));
    }, [form.workshopId]);

    useEffect(() => {
        if (pageMode) return;
        setEmployees([]);
        reloadEmployees();
    }, [pageMode, reloadEmployees]);

    useEffect(() => {
        if (route?.screen !== 'create') return;
        setForm(EMPTY_FORM);
        setEditMeta({ id: null, role: 'cashier' });
    }, [route?.screen]);

    useEffect(() => {
        if (route?.screen !== 'edit' || !route.id) return;

        const fromNav = location.state?.employee;
        if (fromNav && String(fromNav.id) === String(route.id)) {
            const role = fromNav.rawRole || inferRole(fromNav);
            setEditMeta({ id: route.id, role });
            setForm(employeeToForm(fromNav));
            return;
        }

        let cancelled = false;
        setEditLoading(true);
        (async () => {
            const roleHint = location.state?.role;
            const tryRole = roleHint || 'technician';
            try {
                let payload = null;
                let role = tryRole;
                if (tryRole === 'technician') {
                    const res = await getTechnician(route.id);
                    payload = res?.data && typeof res.data === 'object' ? res.data : res;
                } else {
                    const res = await getCashier(route.id);
                    payload = res?.data && typeof res.data === 'object' ? res.data : res;
                }
                if (!payload?.id && tryRole === 'technician') {
                    const res = await getCashier(route.id);
                    payload = res?.data && typeof res.data === 'object' ? res.data : res;
                    role = 'cashier';
                } else if (!payload?.id) {
                    const res = await getTechnician(route.id);
                    payload = res?.data && typeof res.data === 'object' ? res.data : res;
                    role = 'technician';
                }
                if (cancelled) return;
                const emp = normalizeEmployee(payload, role);
                setEditMeta({ id: route.id, role: emp.rawRole });
                setForm(employeeToForm(emp));
            } catch {
                if (!cancelled) {
                    setEditMeta({ id: route.id, role: 'cashier' });
                    setForm(EMPTY_FORM);
                }
            } finally {
                if (!cancelled) setEditLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [route?.screen, route?.id, location.state]);

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return employees.filter((e) => {
            if (roleFilter !== 'all' && inferRole(e) !== roleFilter) return false;
            if (!needle) return true;
            return [e.name, e.mobile, e.email, e.workshopName, e.branch, e.role]
                .join(' ')
                .toLowerCase()
                .includes(needle);
        });
    }, [employees, search, roleFilter]);

    const total = employees.length;
    const activeCount = employees.filter((e) => e.status === 'active').length;
    const technicianCount = employees.filter((e) => inferRole(e) === 'technician').length;
    const cashierCount = employees.filter((e) => inferRole(e) === 'cashier').length;

    const handleSaveCreate = async () => {
        if (!form.name.trim() || !form.workshopId || !form.branchId) {
            window.alert('Workshop, branch, and name are required.');
            return;
        }
        if (!form.mobile.trim()) {
            window.alert('Mobile is required.');
            return;
        }
        if (form.role === 'cashier' && !form.email.trim()) {
            window.alert('Email is required for cashiers.');
            return;
        }
        if (!form.password.trim()) {
            window.alert('Password is required.');
            return;
        }

        setSaving(true);
        try {
            if (form.role === 'technician') {
                await createTechnician({
                    workshopId: form.workshopId,
                    branchId: form.branchId,
                    name: form.name.trim(),
                    mobile: form.mobile.trim(),
                    email: form.email.trim() || undefined,
                    password: form.password,
                    technicianType: form.technicianType,
                    commissionPercent: parseFloat(form.commissionPercent) || 0,
                });
            } else {
                await createCashier({
                    workshopId: form.workshopId,
                    branchId: form.branchId,
                    name: form.name.trim(),
                    mobile: form.mobile.trim(),
                    email: form.email.trim(),
                    password: form.password,
                });
            }
            await reloadEmployees();
            goBack();
        } catch (err) {
            window.alert(err?.message || 'Could not create employee');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!form.name.trim()) {
            window.alert('Name is required.');
            return;
        }
        setSaving(true);
        try {
            const body = {
                name: form.name.trim(),
                mobile: form.mobile.trim() || undefined,
                branchId: form.branchId || undefined,
                isActive: form.isActive,
            };
            if (editMeta.role === 'technician') {
                await updateTechnician(editMeta.id, {
                    ...body,
                    technicianType: form.technicianType,
                    commissionPercent: parseFloat(form.commissionPercent) || 0,
                });
            } else {
                await updateCashier(editMeta.id, {
                    ...body,
                    email: form.email.trim() || undefined,
                });
            }
            await reloadEmployees();
            goBack();
        } catch (err) {
            window.alert(err?.message || 'Could not save changes');
        } finally {
            setSaving(false);
        }
    };

    if (route?.screen === 'create') {
        return (
            <EmployeesPageShell
                title="Add Employee"
                onClose={goBack}
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={goBack}>
                            Cancel
                        </button>
                        <button type="button" className="btn-submit" onClick={handleSaveCreate} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader size={14} className="spin" /> Creating…
                                </>
                            ) : (
                                'Create Employee'
                            )}
                        </button>
                    </>
                }
            >
                <p className="employees-form-lead">
                    Add a cashier or technician to a workshop branch. They receive portal login for POS or
                    technician apps.
                </p>
                <EmployeeFormFields
                    values={form}
                    onChange={onFormField}
                    workshopOptions={approvedWorkshopOptions}
                    branchOptions={formBranchOptions}
                />
            </EmployeesPageShell>
        );
    }

    if (route?.screen === 'edit') {
        return (
            <EmployeesPageShell
                title="Edit Employee"
                onClose={goBack}
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={goBack}>
                            Cancel
                        </button>
                        <button type="button" className="btn-submit" onClick={handleSaveEdit} disabled={saving || editLoading}>
                            {saving ? (
                                <>
                                    <Loader size={14} className="spin" /> Saving…
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </>
                }
            >
                {editLoading ? (
                    <div className="table-empty">
                        <Loader size={18} className="spin" /> Loading employee…
                    </div>
                ) : (
                    <>
                        <p className="employees-form-lead">
                            Update profile, branch assignment, and status for this{' '}
                            {editMeta.role === 'technician' ? 'technician' : 'cashier'}.
                        </p>
                        <EmployeeFormFields
                            values={form}
                            onChange={onFormField}
                            isEdit
                            workshopOptions={approvedWorkshopOptions}
                            branchOptions={formBranchOptions}
                        />
                    </>
                )}
            </EmployeesPageShell>
        );
    }

    return (
        <div className="employees-page module-container">
            <header className="employees-page-header">
                <div className="employees-page-header-text">
                    <h1 className="employees-title">Employees</h1>
                    <p className="employees-subtitle">
                        Cashiers and technicians across all workshops
                    </p>
                </div>
                <button
                    type="button"
                    className="btn-portal employees-header-add"
                    onClick={() => navigate(employeesRoutes.create())}
                >
                    <Plus size={16} /> Add Employee
                </button>
            </header>

            <div className="employees-stats-grid">
                <div className="employees-stat-card">
                    <span className="employees-stat-icon employees-stat-icon--total">
                        <Users size={18} />
                    </span>
                    <div>
                        <p className="employees-stat-label">Total</p>
                        <p className="employees-stat-value">{total}</p>
                    </div>
                </div>
                <div className="employees-stat-card">
                    <span className="employees-stat-icon employees-stat-icon--active">
                        <UserCheck size={18} />
                    </span>
                    <div>
                        <p className="employees-stat-label">Active</p>
                        <p className="employees-stat-value">{activeCount}</p>
                    </div>
                </div>
                <div className="employees-stat-card">
                    <span className="employees-stat-icon employees-stat-icon--tech">
                        <Wrench size={18} />
                    </span>
                    <div>
                        <p className="employees-stat-label">Technicians</p>
                        <p className="employees-stat-value">{technicianCount}</p>
                    </div>
                </div>
                <div className="employees-stat-card">
                    <span className="employees-stat-icon employees-stat-icon--cashier">
                        <Building2 size={18} />
                    </span>
                    <div>
                        <p className="employees-stat-label">Cashiers</p>
                        <p className="employees-stat-value">{cashierCount}</p>
                    </div>
                </div>
            </div>

            <div className="employees-filter-bar">
                <div className="search-bar-mini employees-search">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search name, mobile, email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="employees-segment" role="tablist" aria-label="Filter by role">
                    {ROLE_TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={roleFilter === t.id}
                            className={`employees-segment-btn ${roleFilter === t.id ? 'active' : ''}`}
                            onClick={() => setRoleFilter(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="employees-filter-dropdowns">
                    <SelectField
                        value={workshopFilter}
                        onChange={(e) => {
                            setWorkshopFilter(e.target.value);
                            setBranchFilter('');
                        }}
                        className="employees-filter-select"
                    >
                        <option value="">All workshops</option>
                        {approvedWorkshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name}
                            </option>
                        ))}
                    </SelectField>

                    <SelectField
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        disabled={!workshopFilter}
                        className="employees-filter-select"
                    >
                        <option value="">All branches</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </SelectField>
                </div>
            </div>

            <section className="premium-table employees-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Employee</th>
                            <th className="table-th">Role</th>
                            <th className="table-th">Workshop</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">Commission</th>
                            <th className="table-th">Status</th>
                            <th className="table-th" />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 0, border: 'none' }}>
                                    <ShimmerTable rows={8} columns={7} />
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="table-cell table-empty employees-empty">
                                    <Users size={40} strokeWidth={1.25} />
                                    <p>No employees found</p>
                                    <span>Try adjusting filters or add a new employee.</span>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((emp) => {
                                const role = inferRole(emp);
                                return (
                                    <tr key={`${role}-${emp.id}`} className="table-row">
                                        <td className="table-cell">
                                            <div className="employee-cell">
                                                <span className="employee-avatar">{emp.name.charAt(0)}</span>
                                                <div className="employee-cell-text">
                                                    <span className="cell-main-text">{emp.name}</span>
                                                    <span className="cell-sub-text">
                                                        {emp.mobile || '—'}
                                                        {emp.email ? ` · ${emp.email}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            <span
                                                className={`employees-role-badge employees-role-badge--${role}`}
                                            >
                                                {role === 'technician' ? 'Technician' : 'Cashier'}
                                            </span>
                                            {role === 'technician' && emp.technicianType ? (
                                                <span className="employees-tech-type">
                                                    {formatTechnicianTypeLabel(emp.technicianType)}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="table-cell">{emp.workshopName || '—'}</td>
                                        <td className="table-cell">{emp.branch || '—'}</td>
                                        <td className="table-cell">{emp.commission}</td>
                                        <td className="table-cell">
                                            <span
                                                className={`status-badge ${
                                                    emp.status === 'active'
                                                        ? 'status-completed'
                                                        : 'status-warning'
                                                }`}
                                            >
                                                {emp.status}
                                            </span>
                                        </td>
                                        <td className="table-cell employees-actions-cell">
                                            <button
                                                type="button"
                                                className="btn-edit-icon"
                                                title="Edit"
                                                onClick={() =>
                                                    navigate(employeesRoutes.edit(emp.id), {
                                                        state: { employee: emp, role },
                                                    })
                                                }
                                            >
                                                <Pencil size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
