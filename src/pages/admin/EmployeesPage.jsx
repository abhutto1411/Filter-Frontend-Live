import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import {
    AlertTriangle,
    Building2,
    Loader,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    UserCheck,
    Users,
    Wrench,
} from 'lucide-react';
import EmployeesPageShell from '../../components/admin/EmployeesPageShell';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import '../../styles/admin/EmployeesPage.css';
import '../../styles/admin/ApprovalsPage.css';
import '../../styles/ui.css';
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
import { empT, EMP_ROLE_TAB_KEYS } from '../../utils/employeesI18n';
import CompensationRevisionPanel from '../../components/compensation/CompensationRevisionPanel';

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
    basicSalary: '',
    isActive: true,
};

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

/** Human-readable duty label — the DB stores workshop | on_call | both. */
function formatTechnicianTypeLabel(value, t) {
    const key = String(value ?? '').trim().toLowerCase();
    if (!key) return '';
    if (key === 'workshop') return t('techType.workshop');
    if (key === 'on_call' || key === 'oncall') return t('techType.onCall');
    if (key === 'both') return t('techType.both');
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
        basicSalary: u.basicSalary != null ? String(u.basicSalary) : '',
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
        basicSalary: emp.basicSalary || '',
        isActive: emp.isActive !== false,
    };
}

function EmployeeFormFields({
    values,
    onChange,
    isEdit = false,
    workshopOptions = [],
    branchOptions = [],
    t,
    locale = 'en',
    recordId,
}) {
    const set = (field) => (e) => onChange(field, e.target.value);
    const isTechnician = values.role === 'technician';

    return (
        <>
            <section className="ui-section">
                <h2>{t('section.assignment')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-4">
                        <label htmlFor="emp-workshop">{t('label.workshop')}</label>
                        <select
                            id="emp-workshop"
                            className="ui-select"
                            value={values.workshopId}
                            onChange={(e) => {
                                onChange('workshopId', e.target.value);
                                onChange('branchId', '');
                            }}
                            disabled={isEdit}
                        >
                            <option value="">{t('opt.selectWorkshop')}</option>
                            {workshopOptions.map((w) => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="emp-branch">{t('label.branch')}</label>
                        <select
                            id="emp-branch"
                            className="ui-select"
                            value={values.branchId}
                            onChange={set('branchId')}
                            disabled={!values.workshopId}
                        >
                            <option value="">{t('opt.selectBranch')}</option>
                            {branchOptions.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="emp-role">{t('label.role')}</label>
                        <select
                            id="emp-role"
                            className="ui-select"
                            value={values.role}
                            onChange={set('role')}
                            disabled={isEdit}
                        >
                            <option value="cashier">{t('role.cashier')}</option>
                            <option value="technician">{t('role.technician')}</option>
                        </select>
                    </div>
                </div>
            </section>

            <section className="ui-section">
                <h2>{t('section.profile')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="emp-name">{t('label.name')}</label>
                        <input
                            id="emp-name"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.name')}
                            value={values.name}
                            onChange={set('name')}
                        />
                    </div>
                    <div className="ui-field ui-col-3">
                        <label htmlFor="emp-mobile">{t('label.mobile')}</label>
                        <input
                            id="emp-mobile"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.mobile')}
                            value={values.mobile}
                            onChange={set('mobile')}
                        />
                    </div>
                    <div className="ui-field ui-col-3">
                        <label htmlFor="emp-email">
                            {isTechnician ? t('label.email') : t('label.emailReq')}
                            {isTechnician ? (
                                <> <span className="ui-field-opt">{t('optional')}</span></>
                            ) : null}
                        </label>
                        <input
                            id="emp-email"
                            type="email"
                            className="ui-input"
                            placeholder={t('ph.email')}
                            autoComplete="off"
                            value={values.email}
                            onChange={set('email')}
                        />
                    </div>
                </div>
            </section>

            {isTechnician ? (
                <section className="ui-section">
                    <h2>{t('section.tech')}</h2>
                    <div className="ui-form-grid">
                        <div className="ui-field ui-col-3">
                            <label htmlFor="emp-techtype">{t('label.techType')}</label>
                            <select
                                id="emp-techtype"
                                className="ui-select"
                                value={values.technicianType}
                                onChange={set('technicianType')}
                            >
                                <option value="workshop">{t('techType.workshop')}</option>
                                <option value="on_call">{t('techType.onCall')}</option>
                                {values.technicianType === 'both' ? (
                                    <option value="both">{t('techType.both')}</option>
                                ) : null}
                            </select>
                        </div>
                        <div className="ui-field ui-col-3">
                            <label htmlFor="emp-salary">{t('label.basicSalary')}</label>
                            <input
                                id="emp-salary"
                                type="number"
                                min="0"
                                step="0.01"
                                className="ui-input ui-input--figure"
                                value={values.basicSalary}
                                onChange={set('basicSalary')}
                            />
                        </div>
                        <div className="ui-field ui-col-3">
                            <label htmlFor="emp-commission">{t('label.commission')}</label>
                            <input
                                id="emp-commission"
                                type="number"
                                min="0"
                                step="0.1"
                                className="ui-input ui-input--figure"
                                value={values.commissionPercent}
                                onChange={set('commissionPercent')}
                            />
                        </div>
                        <div className="ui-field ui-col-3">
                            <label htmlFor="emp-status-tech">{t('label.status')}</label>
                            <select
                                id="emp-status-tech"
                                className="ui-select"
                                value={values.isActive ? 'active' : 'inactive'}
                                onChange={(e) => onChange('isActive', e.target.value === 'active')}
                            >
                                <option value="active">{t('status.active')}</option>
                                <option value="inactive">{t('status.inactive')}</option>
                            </select>
                        </div>
                    </div>
                    {isEdit && recordId ? (
                        <CompensationRevisionPanel
                            locale={locale}
                            api="admin"
                            recordId={String(recordId)}
                            recordType="employee"
                            basicSalary={values.basicSalary}
                            commissionPercent={values.commissionPercent}
                            onApplied={(res) => {
                                if (res?.newBasicSalary != null) {
                                    onChange('basicSalary', String(res.newBasicSalary));
                                }
                                if (res?.newCommissionPercent != null) {
                                    onChange('commissionPercent', String(res.newCommissionPercent));
                                }
                            }}
                        />
                    ) : null}
                </section>
            ) : (
                <section className="ui-section">
                    <h2>{t('section.status')}</h2>
                    <div className="ui-form-grid">
                        <div className="ui-field ui-col-3">
                            <label htmlFor="emp-status">{t('label.status')}</label>
                            <select
                                id="emp-status"
                                className="ui-select"
                                value={values.isActive ? 'active' : 'inactive'}
                                onChange={(e) => onChange('isActive', e.target.value === 'active')}
                            >
                                <option value="active">{t('status.active')}</option>
                                <option value="inactive">{t('status.inactive')}</option>
                            </select>
                        </div>
                    </div>
                </section>
            )}

            <section className="ui-section">
                <h2>{isEdit ? t('section.resetPassword') : t('section.portal')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="emp-password">
                            {isEdit ? t('label.newPassword') : t('label.password')}
                        </label>
                        <input
                            id="emp-password"
                            type="password"
                            className="ui-input"
                            placeholder={isEdit ? t('ph.passwordKeep') : t('ph.password')}
                            autoComplete="new-password"
                            value={values.password}
                            onChange={set('password')}
                        />
                        {!isEdit ? <p className="ui-help">{t('hint.credentials')}</p> : null}
                    </div>
                </div>
            </section>
        </>
    );
}

export default function EmployeesPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => empT(locale, key, vars), [locale]);

    const route = parseEmployeesRoute(location.pathname);
    const pageMode = Boolean(route);

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editMeta, setEditMeta] = useState({ id: null, role: 'cashier' });
    const [editLoading, setEditLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [formBranchOptions, setFormBranchOptions] = useState([]);
    const [workshopFilter, setWorkshopFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    // Each list reports its own total, so the stat cards read those rather than
    // counting a fetched page — which only ever saw the first 200 rows.
    const [totals, setTotals] = useState({ technicians: 0, cashiers: 0, active: 0 });
    const [reloadKey, setReloadKey] = useState(0);

    const paging = useServerPaging({
        resetKey: `${roleFilter}|${workshopFilter}|${branchFilter}|${searchDebounced}`,
    });
    const { page, pageSize } = paging;

    useEffect(() => {
        const timer = setTimeout(() => setSearchDebounced(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const goBack = useCallback(() => navigate(EMPLOYEES_BASE), [navigate]);

    const onFormField = useCallback((field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    }, []);

    const approvedWorkshopOptions = useMemo(
        () => workshopOptions.filter((w) => w.status === 'approved' || !w.status),
        [workshopOptions],
    );

    const totalOf = (res) => Number((res?.data || res)?.total ?? 0);

    /**
     * Technicians and cashiers are two endpoints, so "All" asks each for the
     * same page and concatenates. Page count is the larger of the two rather
     * than derived from the combined total: with 300 technicians and 5 cashiers,
     * the sum would stop paging four pages early and hide the rest.
     */
    const listPage = useCallback(
        async () => {
            const params = {
                workshopId: workshopFilter || undefined,
                branchId: branchFilter || undefined,
                limit: pageSize,
                offset: (page - 1) * pageSize,
                search: searchDebounced || undefined,
            };
            const wantTech = roleFilter !== 'cashier';
            const wantCashier = roleFilter !== 'technician';
            const [techRes, cashierRes] = await Promise.all([
                wantTech ? getTechnicians(params) : null,
                wantCashier ? getCashiers(params) : null,
            ]);
            const techData = techRes ? techRes.data || techRes : null;
            const cashierData = cashierRes ? cashierRes.data || cashierRes : null;
            const techRows = techData
                ? pickArray(techData, ['technicians'])
                      .map((u) => normalizeEmployee(u, 'technician'))
                      .filter((u) => inferRole(u) === 'technician')
                : [];
            const cashierRows = cashierData
                ? pickArray(cashierData, ['cashiers'])
                      .map((u) => normalizeEmployee(u, 'cashier'))
                      .filter((u) => inferRole(u) === 'cashier')
                : [];
            const techTotal = Number(techData?.total ?? 0);
            const cashierTotal = Number(cashierData?.total ?? 0);
            return {
                rows: [...techRows, ...cashierRows],
                total: techTotal + cashierTotal,
                pageCount: Math.max(
                    1,
                    Math.ceil(techTotal / pageSize),
                    Math.ceil(cashierTotal / pageSize),
                ),
            };
        },
        [roleFilter, workshopFilter, branchFilter, pageSize, page, searchDebounced],
    );

    const [pageMeta, setPageMeta] = useState({ total: 0, pageCount: 1 });

    useEffect(() => {
        if (pageMode) return undefined;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await listPage();
                if (cancelled) return;
                setEmployees(res.rows);
                setPageMeta({ total: res.total, pageCount: res.pageCount });
                setLoadError(false);
            } catch {
                if (cancelled) return;
                setEmployees([]);
                setPageMeta({ total: 0, pageCount: 1 });
                setLoadError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [pageMode, listPage, reloadKey]);

    // The stat cards need four counts and no rows, so they ask for one row each
    // instead of the 9999-row pages the old screen pulled for them.
    useEffect(() => {
        if (pageMode) return undefined;
        let cancelled = false;
        const scope = {
            workshopId: workshopFilter || undefined,
            branchId: branchFilter || undefined,
        };
        Promise.all([
            getTechnicians({ ...scope, limit: 1 }),
            getCashiers({ ...scope, limit: 1 }),
        ])
            .then(([techRes, cashierRes]) => {
                if (cancelled) return;
                setTotals({
                    technicians: totalOf(techRes),
                    cashiers: totalOf(cashierRes),
                    active: 0,
                });
            })
            .catch(() => {
                if (!cancelled) setTotals({ technicians: 0, cashiers: 0, active: 0 });
            });
        return () => { cancelled = true; };
    }, [pageMode, workshopFilter, branchFilter, reloadKey]);

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
        if (route?.screen !== 'create') return;
        setForm(EMPTY_FORM);
        setEditMeta({ id: null, role: 'cashier' });
    }, [route?.screen]);

    useEffect(() => {
        if (route?.screen !== 'edit' || !route.id) return undefined;

        const fromNav = location.state?.employee;
        if (fromNav && String(fromNav.id) === String(route.id)) {
            const role = fromNav.rawRole || inferRole(fromNav);
            setEditMeta({ id: route.id, role });
            setForm(employeeToForm(fromNav));
            return undefined;
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

        return () => { cancelled = true; };
    }, [route?.screen, route?.id, location.state]);

    const handleSaveCreate = async () => {
        if (!form.name.trim() || !form.workshopId || !form.branchId) {
            window.alert(t('err.requiredFields'));
            return;
        }
        if (!form.mobile.trim()) {
            window.alert(t('err.mobile'));
            return;
        }
        if (form.role === 'cashier' && !form.email.trim()) {
            window.alert(t('err.emailCashier'));
            return;
        }
        if (!form.password.trim()) {
            window.alert(t('err.password'));
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
            setReloadKey((k) => k + 1);
            goBack();
        } catch (err) {
            window.alert(err?.message || t('err.create'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!form.name.trim()) {
            window.alert(t('err.name'));
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
            setReloadKey((k) => k + 1);
            goBack();
        } catch (err) {
            window.alert(err?.message || t('err.save'));
        } finally {
            setSaving(false);
        }
    };

    if (route?.screen === 'create') {
        return (
            <EmployeesPageShell
                title={t('create.title')}
                onClose={goBack}
                backDisabled={saving}
                footer={
                    <>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={goBack}
                            disabled={saving}
                        >
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary"
                            onClick={handleSaveCreate}
                            disabled={saving}
                        >
                            {saving ? (
                                <><Loader size={14} className="ui-spin" /> {t('btn.creating')}</>
                            ) : t('btn.create')}
                        </button>
                    </>
                }
            >
                <p className="ui-lead">{t('create.lead')}</p>
                <EmployeeFormFields
                    values={form}
                    onChange={onFormField}
                    workshopOptions={approvedWorkshopOptions}
                    branchOptions={formBranchOptions}
                    t={t}
                />
            </EmployeesPageShell>
        );
    }

    if (route?.screen === 'edit') {
        return (
            <EmployeesPageShell
                title={t('edit.title')}
                onClose={goBack}
                backDisabled={saving}
                footer={
                    <>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={goBack}
                            disabled={saving}
                        >
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary"
                            onClick={handleSaveEdit}
                            disabled={saving || editLoading}
                        >
                            {saving ? (
                                <><Loader size={14} className="ui-spin" /> {t('btn.saving')}</>
                            ) : t('btn.save')}
                        </button>
                    </>
                }
            >
                {editLoading ? (
                    <div className="ui-form-grid" aria-label={t('loading')} aria-busy="true">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={`sk-${i}`} className="ui-field ui-col-4 ui-sk-row">
                                <div className="ui-sk ui-sk--label ui-sk--w40" />
                                <div className="ui-sk ui-sk--input" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <p className="ui-lead">
                            {t('edit.lead', {
                                role:
                                    editMeta.role === 'technician'
                                        ? t('role.technician')
                                        : t('role.cashier'),
                            })}
                        </p>
                        <EmployeeFormFields
                            values={form}
                            onChange={onFormField}
                            isEdit
                            workshopOptions={approvedWorkshopOptions}
                            branchOptions={formBranchOptions}
                            t={t}
                            locale={locale}
                            recordId={editMeta.id}
                        />
                    </>
                )}
            </EmployeesPageShell>
        );
    }

    const pagerProps = {
        ...paging.pagerFor(pageMeta.total),
        pageCount: pageMeta.pageCount,
    };

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-kpis">
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Users size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.total')}</div>
                    <div className="ui-metric-value">{totals.technicians + totals.cashiers}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Wrench size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.technicians')}</div>
                    <div className="ui-metric-value">{totals.technicians}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Building2 size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.cashiers')}</div>
                    <div className="ui-metric-value">{totals.cashiers}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><UserCheck size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.active')}</div>
                    <div className="ui-metric-value">
                        {employees.filter((e) => e.status === 'active').length}
                    </div>
                    <div className="ui-metric-foot">{t('page.count', { n: employees.length })}</div>
                </div>
            </div>

            <div className="ui-table-wrap">
                <div className="ui-toolbar ui-toolbar--standalone">
                    <div className="ui-search">
                        <Search size={14} />
                        <input
                            type="text"
                            className="ui-input"
                            placeholder={t('search.placeholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="ui-chips" role="tablist" aria-label={t('filter.roleAria')}>
                        {EMP_ROLE_TAB_KEYS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={roleFilter === tab.id}
                                className={`ui-chip${roleFilter === tab.id ? ' ui-chip--on' : ''}`}
                                onClick={() => setRoleFilter(tab.id)}
                            >
                                {t(tab.labelKey)}
                            </button>
                        ))}
                    </div>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => navigate(employeesRoutes.create())}
                        >
                            <Plus size={14} /> {t('btn.add')}
                        </button>
                    </div>
                </div>

                <div className="ui-toolbar">
                    <select
                        className="ui-select"
                        aria-label={t('th.workshop')}
                        value={workshopFilter}
                        onChange={(e) => {
                            setWorkshopFilter(e.target.value);
                            setBranchFilter('');
                        }}
                    >
                        <option value="">{t('filter.allWorkshops')}</option>
                        {approvedWorkshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <select
                        className="ui-select"
                        aria-label={t('th.branch')}
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        disabled={!workshopFilter}
                    >
                        <option value="">{t('filter.allBranches')}</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                    <span className="ui-toolbar-end ui-meta">
                        {searchDebounced
                            ? t('page.matches', { n: pageMeta.total })
                            : t('page.count', { n: pageMeta.total })}
                    </span>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('err.loadTitle')}</div>
                        <div className="ui-empty-sub">{t('err.loadHint')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('btn.retry')}
                        </button>
                    </div>
                ) : !loading && employees.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon">
                            {searchDebounced || workshopFilter || branchFilter
                                ? <Search size={18} />
                                : <Users size={18} />}
                        </div>
                        <div className="ui-empty-title">
                            {searchDebounced || workshopFilter || branchFilter
                                ? t('noMatch.title')
                                : t('empty.title')}
                        </div>
                        <div className="ui-empty-sub">
                            {searchDebounced || workshopFilter || branchFilter
                                ? t('noMatch.hint')
                                : t('empty.hint')}
                        </div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('th.employee')}</th>
                                <th>{t('th.role')}</th>
                                <th>{t('th.workshop')}</th>
                                <th>{t('th.branch')}</th>
                                <th className="ui-num">{t('th.commission')}</th>
                                <th>{t('th.status')}</th>
                                <th aria-label={t('th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--btn" /></td>
                                    </tr>
                                ))
                            ) : employees.map((emp) => {
                                const role = inferRole(emp);
                                const active = emp.status === 'active';
                                return (
                                    <tr key={`${role}-${emp.id}`}>
                                        <td data-label={t('th.employee')}>
                                            <div className="ui-strong">{emp.name}</div>
                                            <div className="ui-meta">
                                                {emp.mobile || '—'}
                                                {emp.email ? ` · ${emp.email}` : ''}
                                            </div>
                                        </td>
                                        <td data-label={t('th.role')}>
                                            <span className={`ui-pill ui-pill--${role === 'technician' ? 'info' : 'neutral'}`}>
                                                {role === 'technician'
                                                    ? t('role.technician')
                                                    : t('role.cashier')}
                                            </span>
                                            {role === 'technician' && emp.technicianType ? (
                                                <div className="ui-meta">
                                                    {formatTechnicianTypeLabel(emp.technicianType, t)}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td data-label={t('th.workshop')}>{emp.workshopName || '—'}</td>
                                        <td data-label={t('th.branch')}>{emp.branch || '—'}</td>
                                        <td data-label={t('th.commission')} className="ui-num">
                                            {emp.commission}
                                        </td>
                                        <td data-label={t('th.status')}>
                                            <span className={`ui-pill ui-pill--${active ? 'ok' : 'neutral'}`}>
                                                {active ? t('status.active') : t('status.inactive')}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="ui-rowacts">
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
                                                    onClick={() =>
                                                        navigate(employeesRoutes.edit(emp.id), {
                                                            state: { employee: emp, role },
                                                        })
                                                    }
                                                >
                                                    <Pencil size={13} /> {t('btn.edit')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                <UiPager {...pagerProps} />
            </div>
        </div>
    );
}
