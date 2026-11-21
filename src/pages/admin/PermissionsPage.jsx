/* eslint-disable react/prop-types */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, useMatch, useOutletContext } from 'react-router-dom';
import {
    Pencil, Trash2, Search,
    ShieldCheck, Users,
    UserCircle, ChevronDown, ChevronRight,
    Building, Wrench, Store, ScrollText, Sparkles, Briefcase,
    Loader2, RefreshCcw, AlertCircle, Wallet,
} from 'lucide-react';
import PermissionsShell from '../../components/admin/PermissionsShell';
import ApprovalsPage from './ApprovalsPage';
import * as permissionsApi from '../../services/permissionsApi';
import { getWorkshopOptions, getBranches } from '../../services/superAdminApi';
import { codesToActionsByTab, flattenActionsByTab } from '../../utils/permissions';
import { portalRequiresWorkshopScope } from '../../utils/permissionsPortalUtils';
import { permT, actionLabel, portalLabel, portalDesc, workshopRoleLabel, portalLoginHintT } from '../../utils/permissionsI18n';
import { useAuth } from '../../context/AuthContext';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import '../../styles/ui.css';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Portals (UI-only metadata — backend is the source of truth for codes)    */
/* ────────────────────────────────────────────────────────────────────────── */

/* Portals are categories, not states — the icon tells them apart, so they
 * share the one neutral pill rather than each owning a colour. */
const PORTALS = [
    { id: 'super_admin', icon: ShieldCheck },
    { id: 'workshop',    icon: Wrench      },
    { id: 'cashier',     icon: Store       },
    { id: 'technician',  icon: Briefcase   },
    { id: 'corporate',   icon: Building    },
    { id: 'supplier',    icon: ScrollText  },
    { id: 'referrer',    icon: Users       },
];

function getPortalsMeta(locale) {
    return PORTALS.map((p) => ({
        ...p,
        label: portalLabel(locale, p.id),
        desc: portalDesc(locale, p.id),
    }));
}

function getComingSoonTree(t) {
    return [
        { section: t('comingSoon.section'), tabs: [{ key: '_placeholder', label: t('comingSoon.label'), actions: [] }] },
    ];
}

/** Maps backend `userType` → portal id used in the PORTALS array above. */
const USER_TYPE_TO_PORTAL = {
    platform_admin: 'super_admin',
    workshop_owner: 'workshop',
    workshop_user:  'workshop',
    cashier_user:   'cashier',
    technician:     'technician',
    technician_user: 'technician',
    corporate_user: 'corporate',
    supplier_user:  'supplier',
    referrer_user:  'referrer',
};

function portalIdForUser(user) {
    return USER_TYPE_TO_PORTAL[user?.userType] || user?.role?.portal || null;
}

/* Referrer profile — keep these in step with the Marketing portal's
 * Add New Referrer form (pages/marketing/ReferrerFormPage.jsx). */
const REFERRER_CATEGORY_VALUES = ['Individual', 'Corporate', 'Technician', 'Employee'];
const REFERRER_STATUS_VALUES = ['active', 'inactive'];
const EMPTY_REFERRER_PROFILE = {
    category: 'Individual',
    nationalId: '',
    status: 'active',
    bankName: '',
    iban: '',
    notes: '',
};

/* Supplier profile — keep in step with Super Admin → Suppliers → Add Supplier
 * (pages/admin/SuppliersPage.jsx EMPTY_SUPPLIER_FORM). */
const SUPPLIER_CATEGORY_VALUES = ['supplier', 'warehouse', 'other'];
const EMPTY_SUPPLIER_PROFILE = {
    supplierName: '',
    category: 'supplier',
    vatId: '',
    crNumber: '',
    contactPerson: '',
    address: '',
    street: '',
    cityDistrict: '',
    bankName: '',
    iban: '',
    status: 'active',
};

const WORKSHOP_ROLE_OPTIONS = [
    { id: 'workshop_owner' },
    { id: 'manager' },
    { id: 'supervisor' },
    { id: 'team_leader' },
    { id: 'cashier' },
    { id: 'technician' },
];

/* Granting one of these is not the same as granting a read, so the chip says
 * so. Every other action shares the one on/off vocabulary. */
const DESTRUCTIVE_ACTIONS = new Set([
    'delete',
    'reject',
    'force-logout',
    'manual-adjust',
    'critical-level',
]);

const PERMISSIONS_LIST_PATH = '/admin/permissions';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main page                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export default function PermissionsPage() {
    const { hasPermission } = useAuth();
    const outletCtx = useOutletContext() || {};
    const locale = outletCtx.locale || localStorage.getItem('portal-locale') || 'en';
    const t = useCallback((key, vars) => permT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const location = useLocation();
    const roleNewRoute = useMatch('/admin/permissions/roles/new');
    const roleEditRoute = useMatch('/admin/permissions/roles/:roleId/edit');
    const userNewRoute = useMatch('/admin/permissions/users/new');
    const userRoleRoute = useMatch('/admin/permissions/users/:userId/role');
    const userPermsRoute = useMatch('/admin/permissions/users/:userId/permissions');
    const routeView = Boolean(roleNewRoute || roleEditRoute || userNewRoute || userRoleRoute || userPermsRoute);

    const goToPermissionsList = useCallback(() => {
        navigate(PERMISSIONS_LIST_PATH);
    }, [navigate]);

    const canSeeApprovalSettings = hasPermission('approvals.settings.view');
    const [activeTab, setActiveTab] = useState('users');

    // Auto-snap away from Approval Configuration tab if user lacks permission.
    useEffect(() => {
        if (activeTab === 'approvals' && !canSeeApprovalSettings) {
            setActiveTab('users');
        }
    }, [activeTab, canSeeApprovalSettings]);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [registryByPortal, setRegistryByPortal] = useState({});
    const [routeRoleDetail, setRouteRoleDetail] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [portalFilter, setPortalFilter] = useState('');
    const [usersTotal, setUsersTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // The server pages, searches and filters the user list, so changing page
    // is a request — not a slice of a list the browser already holds.
    const usersPaging = useServerPaging({ resetKey: `${searchQuery}|${portalFilter}` });
    const { page: usersPage, pageSize: usersPageSize } = usersPaging;
    const debouncedSearch = useDebouncedValue(searchQuery, 350);

    const fetchRoles = useCallback(async () => {
        const res = await permissionsApi.listRoles();
        setRoles(res?.roles ?? []);
    }, []);

    const fetchUsers = useCallback(async () => {
        setUsersLoading(true);
        try {
            const res = await permissionsApi.listUsers({
                search: debouncedSearch.trim() || undefined,
                portal: portalFilter || undefined,
                page: usersPage,
                limit: usersPageSize,
            });
            setUsers(res?.users ?? []);
            setUsersTotal(Number(res?.total ?? 0));
        } finally {
            setUsersLoading(false);
        }
    }, [debouncedSearch, portalFilter, usersPage, usersPageSize]);

    const fetchRegistry = useCallback(async (portal) => {
        const res = await permissionsApi.getRegistry(portal);
        setRegistryByPortal((prev) => ({ ...prev, [portal]: res?.tree ?? [] }));
        return res?.tree ?? [];
    }, []);

    // Roles and the permission registry do not change when the user table is
    // paged or searched, so they load on their own and stay put.
    const fetchBase = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            await Promise.all([fetchRoles(), fetchRegistry('super_admin')]);
        } catch (e) {
            setError(e?.message || t('error.load'));
        } finally {
            setLoading(false);
        }
    }, [fetchRoles, fetchRegistry, t]);

    const fetchAll = useCallback(async () => {
        await Promise.all([fetchBase(), fetchUsers()]);
    }, [fetchBase, fetchUsers]);

    useEffect(() => { fetchBase(); }, [fetchBase]);

    // Re-runs on page, page size, debounced search and portal filter.
    useEffect(() => {
        fetchUsers().catch((e) => setError(e?.message || t('error.load')));
    }, [fetchUsers, t]);

    const handleCreateNewRole = () => {
        navigate(`${PERMISSIONS_LIST_PATH}/roles/new`);
    };

    const handleCreateNewUser = () => {
        navigate(`${PERMISSIONS_LIST_PATH}/users/new`);
    };

    const handleEditRole = (role) => {
        navigate(`${PERMISSIONS_LIST_PATH}/roles/${encodeURIComponent(role.id)}/edit`, { state: { role } });
    };

    const handleEditUserRole = (user) => {
        navigate(`${PERMISSIONS_LIST_PATH}/users/${encodeURIComponent(user.id)}/role`, { state: { user } });
    };

    const handleEditUserPermissions = (user) => {
        navigate(`${PERMISSIONS_LIST_PATH}/users/${encodeURIComponent(user.id)}/permissions`, { state: { user } });
    };

    const handleSaveUserRole = async (userId, roleId, opts = {}) => {
        setSaving(true);
        try {
            await permissionsApi.assignRoleToUser(userId, roleId, opts);
            goToPermissionsList();
            await fetchUsers();
        } catch (e) {
            alert(e?.message || t('error.updateUser'));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async (id) => {
        if (!window.confirm(t('confirm.deleteRole'))) return;
        try {
            await permissionsApi.deleteRole(id);
            await fetchRoles();
        } catch (e) {
            alert(e?.message || t('error.deleteRole'));
        }
    };

    /** RoleModal returns `{ name, description, portal, permissions: string[] (flat codes) }`. */
    const handleSaveRole = async (payload, roleToEdit = null) => {
        setSaving(true);
        try {
            if (roleToEdit) {
                await permissionsApi.updateRole(roleToEdit.id, {
                    name: payload.name,
                    description: payload.description,
                    permissions: payload.permissions,
                });
            } else {
                await permissionsApi.createRole({
                    name: payload.name,
                    description: payload.description,
                    portal: payload.portal,
                    workshopId: null,
                    permissions: payload.permissions,
                });
            }
            goToPermissionsList();
            await fetchRoles();
        } catch (e) {
            alert(e?.message || t('error.saveRole'));
        } finally {
            setSaving(false);
        }
    };

    /** UserModal returns the full payload — see permissionsApi.createUser. */
    const handleSaveUser = async (payload) => {
        setSaving(true);
        try {
            await permissionsApi.createUser(payload);
            goToPermissionsList();
            await fetchUsers();
        } catch (e) {
            alert(e?.message || t('error.createUser'));
        } finally {
            setSaving(false);
        }
    };

    const routeUser = useMemo(() => {
        const userId = userRoleRoute?.params?.userId ?? userPermsRoute?.params?.userId;
        if (!userId) return null;
        const fromState = location.state?.user;
        if (fromState && String(fromState.id) === String(userId)) return fromState;
        return users.find((u) => String(u.id) === String(userId)) ?? null;
    }, [userRoleRoute?.params?.userId, userPermsRoute?.params?.userId, location.state, users]);

    const roleEditId = roleEditRoute?.params?.roleId ?? null;

    useEffect(() => {
        if (!roleEditId) {
            setRouteRoleDetail(null);
            return undefined;
        }
        const fromState = location.state?.role;
        if (fromState && String(fromState.id) === String(roleEditId) && fromState.permissions) {
            setRouteRoleDetail(fromState);
            return undefined;
        }
        const fromList = roles.find((r) => String(r.id) === String(roleEditId));
        if (fromList?.permissions) {
            setRouteRoleDetail(fromList);
            return undefined;
        }
        let cancelled = false;
        permissionsApi.getRole(roleEditId)
            .then((res) => {
                if (!cancelled) setRouteRoleDetail(res?.role ?? res ?? null);
            })
            .catch(() => {
                if (!cancelled) setRouteRoleDetail(null);
            });
        return () => { cancelled = true; };
    }, [roleEditId, location.state, roles]);

    const renderRouteView = () => {
        if (roleNewRoute) {
            return (
                <RoleModal
                    asPage
                    onClose={goToPermissionsList}
                    onSave={(payload) => handleSaveRole(payload, null)}
                    editingRole={null}
                    registryByPortal={registryByPortal}
                    loadRegistry={fetchRegistry}
                    saving={saving}
                    t={t}
                    locale={locale}
                />
            );
        }
        if (roleEditRoute) {
            if (!routeRoleDetail && loading) {
                return (
                    <div className="ui-root ui-root--flush">
                        <div className="ui-state">
                            <Loader2 size={20} className="ui-spin" />
                            <div className="ui-state-title">{t('loading.role')}</div>
                        </div>
                    </div>
                );
            }
            if (!routeRoleDetail) {
                return (
                    <div className="ui-root ui-root--flush">
                        <div className="ui-state">
                            <AlertCircle size={20} />
                            <div className="ui-state-title">{t('notFound.role')}</div>
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                onClick={goToPermissionsList}
                                style={{ marginTop: 14 }}
                            >
                                {t('shell.back')}
                            </button>
                        </div>
                    </div>
                );
            }
            return (
                <RoleModal
                    asPage
                    onClose={goToPermissionsList}
                    onSave={(payload) => handleSaveRole(payload, routeRoleDetail)}
                    editingRole={routeRoleDetail}
                    registryByPortal={registryByPortal}
                    loadRegistry={fetchRegistry}
                    saving={saving}
                    t={t}
                    locale={locale}
                />
            );
        }
        if (userNewRoute) {
            return (
                <UserModal
                    asPage
                    onClose={goToPermissionsList}
                    onSave={handleSaveUser}
                    roles={roles}
                    saving={saving}
                    t={t}
                    locale={locale}
                />
            );
        }
        if (userRoleRoute) {
            if (!routeUser && loading) {
                return (
                    <div className="ui-root ui-root--flush">
                        <div className="ui-state">
                            <Loader2 size={20} className="ui-spin" />
                            <div className="ui-state-title">{t('loading.user')}</div>
                        </div>
                    </div>
                );
            }
            if (!routeUser) {
                return (
                    <div className="ui-root ui-root--flush">
                        <div className="ui-state">
                            <AlertCircle size={20} />
                            <div className="ui-state-title">{t('notFound.user')}</div>
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                onClick={goToPermissionsList}
                                style={{ marginTop: 14 }}
                            >
                                {t('shell.back')}
                            </button>
                        </div>
                    </div>
                );
            }
            return (
                <EditUserRoleModal
                    asPage
                    user={routeUser}
                    roles={roles}
                    onClose={goToPermissionsList}
                    onSave={handleSaveUserRole}
                    saving={saving}
                    t={t}
                    locale={locale}
                />
            );
        }
        if (userPermsRoute) {
            if (!routeUser && loading) {
                return (
                    <div className="ui-root ui-root--flush">
                        <div className="ui-state">
                            <Loader2 size={20} className="ui-spin" />
                            <div className="ui-state-title">{t('loading.user')}</div>
                        </div>
                    </div>
                );
            }
            if (!routeUser) {
                return (
                    <div className="ui-root ui-root--flush">
                        <div className="ui-state">
                            <AlertCircle size={20} />
                            <div className="ui-state-title">{t('notFound.user')}</div>
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                onClick={goToPermissionsList}
                                style={{ marginTop: 14 }}
                            >
                                {t('shell.back')}
                            </button>
                        </div>
                    </div>
                );
            }
            return (
                <UserPermissionsModal
                    asPage
                    user={routeUser}
                    registryByPortal={registryByPortal}
                    loadRegistry={fetchRegistry}
                    onClose={goToPermissionsList}
                    onSaved={() => {
                        goToPermissionsList();
                        fetchUsers();
                    }}
                    t={t}
                    locale={locale}
                />
            );
        }
        return null;
    };

    if (routeView) {
        return renderRouteView();
    }

    return (
        <div className="ui-root ui-root--flush">
            <div className="ui-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'users'}
                    className="ui-tab"
                    onClick={() => setActiveTab('users')}
                >
                    {t('tab.users', { count: users.length })}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'roles'}
                    className="ui-tab"
                    onClick={() => setActiveTab('roles')}
                >
                    {t('tab.roles', { count: roles.length })}
                </button>
                {canSeeApprovalSettings && (
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'approvals'}
                        className="ui-tab"
                        onClick={() => setActiveTab('approvals')}
                    >
                        {t('tab.approvals')}
                    </button>
                )}
                <div className="ui-tabs-end">
                    <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={fetchAll}
                        title={t('btn.refresh')}
                    >
                        <RefreshCcw size={14} /> {t('btn.refresh')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={handleCreateNewUser}
                    >
                        <UserCircle size={14} /> {t('btn.createUser')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary ui-btn--sm"
                        onClick={handleCreateNewRole}
                    >
                        <ShieldCheck size={14} /> {t('btn.createRole')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="ui-banner ui-banner--dang" style={{ marginTop: 16 }}>
                    <AlertCircle size={15} />
                    <span>{error}</span>
                </div>
            )}

            <div className="ui-band" style={{ marginTop: 16 }}>
                {loading ? (
                    <TabSkeleton />
                ) : activeTab === 'users' ? (
                    <UsersTab
                        users={users}
                        usersLoading={usersLoading}
                        pagerProps={usersPaging.pagerFor(usersTotal)}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        portalFilter={portalFilter}
                        setPortalFilter={setPortalFilter}
                        totalCount={usersTotal}
                        onEditUser={handleEditUserRole}
                        onEditPermissions={handleEditUserPermissions}
                        t={t}
                        locale={locale}
                    />
                ) : activeTab === 'roles' ? (
                    <RolesTab roles={roles} onEdit={handleEditRole} onDelete={handleDeleteRole} t={t} locale={locale} />
                ) : canSeeApprovalSettings ? (
                    <ApprovalsPage isTab onlySettings />
                ) : null}
            </div>
        </div>
    );
}

/** One skeleton bar. */
function Sk({ shape = 'text', w, style }) {
    return <div className={`ui-sk ui-sk--${shape}${w ? ` ui-sk--w${w}` : ''}`} style={style} />;
}

function TabSkeleton() {
    return (
        <section className="ui-panel ui-sk-row" role="status" aria-busy="true">
            <div className="ui-toolbar">
                <Sk shape="input" style={{ maxWidth: 300 }} />
                <div className="ui-toolbar-end">
                    <Sk shape="btn" />
                </div>
            </div>
            <ul className="ui-list">
                {Array.from({ length: 7 }).map((_, i) => (
                    <li key={i} className="ui-list-row">
                        <Sk shape="circle" />
                        <div className="ui-list-main">
                            <Sk shape="strong" w={40} />
                            <Sk shape="text" w={55} style={{ marginTop: 7 }} />
                        </div>
                        <Sk shape="pill" w={25} />
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Users tab                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function UsersTab({ users, usersLoading, pagerProps, searchQuery, setSearchQuery, portalFilter, setPortalFilter, totalCount, onEditUser, onEditPermissions, t, locale }) {
    const portalsMeta = getPortalsMeta(locale);
    return (
        <div className="ui-table-wrap">
            <div className="ui-toolbar">
                <div className="ui-search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder={t('search.users')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="ui-input"
                    />
                </div>
                <select
                    className="ui-select"
                    style={{ maxWidth: 220 }}
                    value={portalFilter}
                    onChange={(e) => setPortalFilter(e.target.value)}
                >
                    <option value="">{t('filter.allPortals', { count: totalCount })}</option>
                    {portalsMeta.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                </select>
                {portalFilter && (
                    <button
                        type="button"
                        className="ui-btn ui-btn--subtle ui-btn--sm"
                        onClick={() => setPortalFilter('')}
                    >
                        {t('btn.clearFilter')}
                    </button>
                )}
            </div>

            {usersLoading ? (
                <div className="ui-state">
                    <Loader2 size={18} className="ui-spin" />
                </div>
            ) : users.length === 0 ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><Users size={18} /></div>
                    <div className="ui-empty-title">{t('empty.users')}</div>
                </div>
            ) : (
                <>
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('table.user')}</th>
                                <th>{t('table.portal')}</th>
                                <th>{t('table.workshopBranch')}</th>
                                <th>{t('table.role')}</th>
                                <th>{t('table.permissions')}</th>
                                <th>{t('table.status')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => {
                                const portalId = portalIdForUser(user);
                                const portalMeta = portalsMeta.find((p) => p.id === portalId);
                                const avatar = (user.name || user.email || '?').charAt(0).toUpperCase();
                                return (
                                    <tr key={user.id}>
                                        <td data-label={t('table.user')}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                                <span className="ui-avatar">{avatar}</span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="ui-list-title">{user.name || '—'}</div>
                                                    <div className="ui-list-meta">{user.email || '—'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label={t('table.portal')}>
                                            {portalId ? (
                                                <span className="ui-pill ui-pill--neutral">
                                                    {portalMeta?.label ?? portalId}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td data-label={t('table.workshopBranch')}>
                                            <div>{user.workshopName ?? '—'}</div>
                                            {user.branchName ? (
                                                <div className="ui-list-meta">{user.branchName}</div>
                                            ) : null}
                                        </td>
                                        <td data-label={t('table.role')}>
                                            {user.role?.name ?? (
                                                <span style={{ color: 'var(--ui-n-400)' }}>{t('empty.noRole')}</span>
                                            )}
                                        </td>
                                        <td data-label={t('table.permissions')}>
                                            {t('count.permissions', { count: user.role?.permissionCount ?? 0 })}
                                        </td>
                                        <td data-label={t('table.status')}>
                                            <span className={`ui-pill ui-pill--${user.isActive ? 'ok' : 'neutral'}`}>
                                                {user.isActive ? t('status.active') : t('status.inactive')}
                                            </span>
                                        </td>
                                        <td data-label={t('table.actions')}>
                                            <div style={{ display: 'inline-flex', gap: 6 }}>
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--icon ui-btn--subtle ui-btn--sm"
                                                    onClick={() => onEditUser?.(user)}
                                                    title={t('title.changeRole')}
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                {user.role && (
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--icon ui-btn--subtle ui-btn--sm"
                                                        onClick={() => onEditPermissions?.(user)}
                                                        title={t('title.overridePerms')}
                                                    >
                                                        <ShieldCheck size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <UiPager {...pagerProps} id="perm-users-per-page" />
                </>
            )}
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Roles tab                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function RolesTab({ roles, onEdit, onDelete, t, locale }) {
    const portalsMeta = getPortalsMeta(locale);
    const grouped = useMemo(() => {
        const map = new Map();
        for (const r of roles) {
            const k = r.portal || 'other';
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(r);
        }
        return [...map.entries()];
    }, [roles]);

    if (roles.length === 0) {
        const createRole = t('btn.createRole');
        const parts = t('empty.roles', { createRole: '|||' }).split('|||');
        return (
            <section className="ui-panel">
                <div className="ui-empty">
                    <div className="ui-empty-icon"><ShieldCheck size={18} /></div>
                    <div className="ui-empty-title">
                        {parts[0]}<strong>{createRole}</strong>{parts[1] ?? ''}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <>
            {grouped.map(([portalId, list]) => {
                const portal = portalsMeta.find((p) => p.id === portalId) || PORTALS.find((p) => p.id === portalId);
                const Icon = portal?.icon ?? Sparkles;
                return (
                    <div key={portalId} className="ui-band">
                        <div className="ui-band-head">
                            <Icon size={14} />
                            <h2>{portal?.label ?? portalId}</h2>
                            <span className="ui-pill ui-pill--neutral">
                                {t('count.roles', { count: list.length })}
                            </span>
                        </div>
                        <div className="ui-cards">
                            {list.map((role) => (
                                <div key={role.id} className="ui-rcard">
                                    <div className="ui-rcard-top">
                                        <span className="ui-rcard-icon"><ShieldCheck size={16} /></span>
                                        {role.isSystem && (
                                            <div className="ui-rcard-end">
                                                <span className="ui-pill ui-pill--info">{t('badge.systemRole')}</span>
                                            </div>
                                        )}
                                    </div>

                                    <h3 className="ui-rcard-title">{role.name}</h3>
                                    {role.description ? (
                                        <p className="ui-rcard-sub">{role.description}</p>
                                    ) : null}

                                    <div className="ui-tags">
                                        <span className="ui-tag">
                                            {t('count.permissions', { count: role.permissionCount })}
                                        </span>
                                        <span className="ui-tag">
                                            {t('count.users', { count: role.userCount ?? 0 })}
                                        </span>
                                    </div>

                                    <div className="ui-rcard-foot">
                                        <div className="ui-rcard-end">
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                onClick={() => onEdit(role)}
                                            >
                                                <Pencil size={14} /> {t('btn.edit')}
                                            </button>
                                            {!role.isSystem && (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--icon ui-btn--danger ui-btn--sm"
                                                    onClick={() => onDelete(role.id)}
                                                    title={t('btn.delete')}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Create / Edit Role Modal                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function RoleModal({ onClose, onSave, editingRole, registryByPortal, loadRegistry, saving, asPage = false, t, locale }) {
    const portalsMeta = getPortalsMeta(locale);
    const [step, setStep] = useState(editingRole ? 2 : 1);
    const [portal, setPortal] = useState(editingRole?.portal || '');
    const [name, setName] = useState(editingRole?.name || '');
    const [description, setDescription] = useState(editingRole?.description || '');
    /** permissions shape: { [tabKey]: { [action]: true } } — mirrors backend code list. */
    const [perms, setPerms] = useState(
        editingRole?.permissions ? codesToActionsByTab(editingRole.permissions) : {},
    );
    const [loadingTree, setLoadingTree] = useState(false);

    // Lazy-load registry when a non-cached portal is picked.
    useEffect(() => {
        if (!portal || registryByPortal[portal]) return;
        setLoadingTree(true);
        loadRegistry(portal).finally(() => setLoadingTree(false));
    }, [portal, registryByPortal, loadRegistry]);

    const portalTree = portal
        ? (registryByPortal[portal]?.length ? registryByPortal[portal] : getComingSoonTree(t))
        : null;

    const totalActions = useMemo(() => {
        if (!portalTree) return 0;
        return portalTree.reduce(
            (sum, sec) => sum + sec.tabs.reduce((acc, tab) => acc + (tab.actions?.length ?? 0), 0),
            0,
        );
    }, [portalTree]);

    const selectedCount = useMemo(
        () => Object.values(perms).reduce(
            (acc, m) => acc + Object.values(m).filter(Boolean).length, 0,
        ),
        [perms],
    );

    const toggleAction = (tabKey, action) => {
        setPerms((prev) => ({
            ...prev,
            [tabKey]: {
                ...(prev[tabKey] || {}),
                [action]: !prev[tabKey]?.[action],
            },
        }));
    };

    const toggleTabAll = (tab) => {
        const allOn = tab.actions.every((a) => perms[tab.key]?.[a]);
        const next = { ...(perms[tab.key] || {}) };
        tab.actions.forEach((a) => { next[a] = !allOn; });
        setPerms((prev) => ({ ...prev, [tab.key]: next }));
    };

    const toggleSectionAll = (section) => {
        const flatActions = section.tabs.flatMap((tab) => tab.actions.map((a) => [tab.key, a]));
        const allOn = flatActions.every(([k, a]) => perms[k]?.[a]);
        const next = { ...perms };
        for (const tab of section.tabs) {
            next[tab.key] = { ...(next[tab.key] || {}) };
            for (const a of tab.actions) next[tab.key][a] = !allOn;
        }
        setPerms(next);
    };

    const selectAll = () => {
        if (!portalTree) return;
        const allOn = selectedCount === totalActions;
        const next = {};
        if (!allOn) {
            for (const sec of portalTree) {
                for (const tab of sec.tabs) {
                    next[tab.key] = {};
                    for (const a of tab.actions) next[tab.key][a] = true;
                }
            }
        }
        setPerms(next);
    };

    const handleSubmit = () => {
        if (!portal) { alert(t('role.alert.portal')); return; }
        if (!name.trim()) { alert(t('role.alert.name')); return; }
        const codes = flattenActionsByTab(perms);
        onSave({
            name: name.trim(),
            description: description.trim(),
            portal,
            permissions: codes,
        });
    };

    return (
        <PermissionsShell asPage={asPage}
            title={editingRole ? t('title.editRole') : t('title.createRole')}
            onClose={onClose}
            backDisabled={saving}
            backLabel={t('shell.back')}
            locale={locale}
            footer={(
                <div className="ui-panel-end">
                    {!editingRole && step === 2 && (
                        <button type="button" className="ui-btn ui-btn--default" onClick={() => setStep(1)}>
                            {t('btn.back')}
                        </button>
                    )}
                    <button type="button" className="ui-btn ui-btn--default" onClick={onClose}>{t('btn.cancel')}</button>
                    {step === 1 ? (
                        <button
                            type="button" className="ui-btn ui-btn--primary"
                            disabled={!portal} onClick={() => setStep(2)}
                        >
                            {t('btn.continue')}
                        </button>
                    ) : (
                        <button type="button" className="ui-btn ui-btn--primary" onClick={handleSubmit} disabled={saving}>
                            {saving ? t('btn.saving') : (editingRole ? t('btn.saveChanges') : t('btn.createRoleSubmit'))}
                        </button>
                    )}
                </div>
            )}
        >
            {step === 1 ? (
                <section className="ui-subsection">
                    <div className="ui-subsection-head">
                        <h4>{t('role.pickPortal')}</h4>
                    </div>
                    <div className="ui-tiles ui-tiles--pick">
                        {portalsMeta.map((p) => {
                            const Icon = p.icon;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    className="ui-tile"
                                    aria-pressed={portal === p.id}
                                    onClick={() => setPortal(p.id)}
                                >
                                    <span className="ui-tile-icon"><Icon size={17} /></span>
                                    <span className="ui-tile-label">{p.label}</span>
                                    <span className="ui-tile-sub">{p.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            ) : (
                <div className="ui-stack">
                    <div className="ui-form-grid">
                        <div className="ui-field ui-col-6">
                            <label>{t('role.name')}</label>
                            <input
                                type="text" className="ui-input" placeholder={t('role.namePlaceholder')}
                                value={name} onChange={(e) => setName(e.target.value)}
                                disabled={editingRole?.isSystem}
                            />
                            {editingRole?.isSystem && (
                                <span className="ui-help">{t('role.systemRename')}</span>
                            )}
                        </div>
                        <div className="ui-field ui-col-6">
                            <label>{t('role.description')}</label>
                            <input
                                type="text" className="ui-input" placeholder={t('role.descPlaceholder')}
                                value={description} onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="ui-toolbar ui-toolbar--standalone">
                        <strong>{t('role.portalSuffix', { label: portalLabel(locale, portal) })}</strong>
                        <span>· {t('count.selected', { selected: selectedCount, total: totalActions })}</span>
                        <div className="ui-toolbar-end">
                            <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={selectAll}>
                                {selectedCount === totalActions ? t('btn.deselectAll') : t('btn.selectAll')}
                            </button>
                        </div>
                    </div>

                    {loadingTree ? (
                        <div className="ui-state">
                            <Loader2 size={18} className="ui-spin" />
                            <div className="ui-state-title">{t('loading.tree')}</div>
                        </div>
                    ) : (
                        <div className="ui-stack-sm">
                            {portalTree?.map((section) => (
                                <SectionPermissionsCard
                                    key={section.section}
                                    section={section}
                                    perms={perms}
                                    onToggleAction={toggleAction}
                                    onToggleTab={toggleTabAll}
                                    onToggleSection={() => toggleSectionAll(section)}
                                    t={t}
                                    locale={locale}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </PermissionsShell>
    );
}

function SectionPermissionsCard({ section, perms, onToggleAction, onToggleTab, onToggleSection, t, locale }) {
    const [open, setOpen] = useState(true);
    const totalActions = section.tabs.reduce((acc, tab) => acc + (tab.actions?.length ?? 0), 0);
    const checkedActions = section.tabs.reduce(
        (acc, tab) => acc + (tab.actions?.filter((a) => perms[tab.key]?.[a]).length ?? 0),
        0,
    );
    const allOn = totalActions > 0 && checkedActions === totalActions;

    return (
        <section className="ui-panel">
            <div className="ui-toolbar">
                <button
                    type="button"
                    className="ui-btn ui-btn--subtle ui-btn--sm"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    style={{ paddingInline: 0 }}
                >
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <span className="ui-panel-title">{section.section}</span>
                </button>
                <div className="ui-toolbar-end" style={{ alignItems: 'center' }}>
                    <span className={`ui-pill ui-pill--${checkedActions === 0 ? 'neutral' : allOn ? 'ok' : 'info'}`}>
                        {checkedActions}/{totalActions}
                    </span>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={onToggleSection}
                    >
                        {allOn ? t('btn.clear') : t('btn.selectAllLower')}
                    </button>
                </div>
            </div>

            {open && (
                <ul className="ui-list">
                    {section.tabs.map((tab) => (
                        <TabPermissionRow
                            key={tab.key}
                            tab={tab}
                            perms={perms}
                            onToggleAction={onToggleAction}
                            onToggleTab={() => onToggleTab(tab)}
                            locale={locale}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function TabPermissionRow({ tab, perms, onToggleAction, onToggleTab, locale }) {
    if ((tab.actions?.length ?? 0) === 0) {
        return (
            <li className="ui-list-row">
                <span className="ui-list-main ui-list-meta">{tab.label}</span>
            </li>
        );
    }
    const all = tab.actions.every((a) => perms[tab.key]?.[a]);
    return (
        <li className="ui-list-row">
            <label className="ui-switch" style={{ minWidth: 240, flex: 1 }}>
                <input type="checkbox" checked={!!all} onChange={onToggleTab} />
                <span className="ui-switch-track" />
                <span className="ui-list-title">{tab.label}</span>
            </label>
            <div className="ui-chips">
                {tab.actions.map((a) => {
                    const on = !!perms[tab.key]?.[a];
                    const tone = on ? (DESTRUCTIVE_ACTIONS.has(a) ? ' ui-chip--on-dang' : ' ui-chip--on') : '';
                    return (
                        <label key={a} className={`ui-chip${tone}`}>
                            <input
                                type="checkbox"
                                checked={on}
                                onChange={() => onToggleAction(tab.key, a)}
                            />
                            {actionLabel(locale, a)}
                        </label>
                    );
                })}
            </div>
        </li>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Create User Modal                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function UserModal({ onClose, onSave, roles, saving, asPage = false, t, locale }) {
    const portalsMeta = getPortalsMeta(locale);
    const [selectedPortal, setSelectedPortal] = useState('workshop');
    const needsWorkshopScope = portalRequiresWorkshopScope(selectedPortal);
    const [workshopId, setWorkshopId] = useState('');
    const [branchId, setBranchId] = useState('');
    const [workshopRole, setWorkshopRole] = useState('');
    const [assignRoleId, setAssignRoleId] = useState('');
    // Referrer profile — mirrors the Marketing portal's Add New Referrer form.
    const [referrer, setReferrer] = useState(EMPTY_REFERRER_PROFILE);
    // Supplier profile — mirrors Super Admin → Suppliers → Add Supplier.
    const [supplier, setSupplier] = useState(EMPTY_SUPPLIER_PROFILE);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [assignWallet, setAssignWallet] = useState(false);

    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loadingWs, setLoadingWs] = useState(false);
    const [loadingBr, setLoadingBr] = useState(false);

    // Load workshops the first time a branch-scoped portal needs them.
    useEffect(() => {
        if (!needsWorkshopScope) return;
        if (workshops.length > 0) return;
        setLoadingWs(true);
        getWorkshopOptions()
            .then((res) => setWorkshops(res?.workshops ?? []))
            .catch(() => setWorkshops([]))
            .finally(() => setLoadingWs(false));
    }, [needsWorkshopScope, workshops.length]);

    // Load branches whenever workshop changes.
    useEffect(() => {
        if (!workshopId) { setBranches([]); return; }
        setLoadingBr(true);
        getBranches({ workshopId })
            .then((res) => setBranches(res?.branches ?? []))
            .catch(() => setBranches([]))
            .finally(() => setLoadingBr(false));
    }, [workshopId]);

    // Only roles belonging to the selected login portal can be assigned — the
    // backend derives the user's `userType` from the role's portal.
    const assignableRoles = useMemo(
        () => roles.filter((r) => r.portal === selectedPortal),
        [roles, selectedPortal],
    );

    const handlePortalChange = (nextPortal) => {
        setSelectedPortal(nextPortal);
        setAssignRoleId('');
        if (!portalRequiresWorkshopScope(nextPortal)) {
            setWorkshopId('');
            setBranchId('');
            setWorkshopRole('');
        }
        if (nextPortal !== 'referrer') setReferrer(EMPTY_REFERRER_PROFILE);
        if (nextPortal !== 'supplier') setSupplier(EMPTY_SUPPLIER_PROFILE);
    };

    const setReferrerField = (field, value) =>
        setReferrer((prev) => ({ ...prev, [field]: value }));

    const setSupplierField = (field, value) =>
        setSupplier((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = () => {
        if (!name.trim()) { alert(t('user.alert.name')); return; }
        if (!email.trim()) { alert(t('user.alert.email')); return; }
        if (!password || password.length < 6) {
            alert(t('user.alert.password'));
            return;
        }
        // A role is only required when the portal actually has one to offer.
        // With no role the user gets unrestricted access to their portal, which
        // is the intended behaviour for portals that have no permission codes.
        if (!assignRoleId && assignableRoles.length > 0) {
            alert(t('user.alert.role'));
            return;
        }
        if (needsWorkshopScope && (!workshopId || !branchId)) {
            alert(t('user.alert.workshopBranch'));
            return;
        }
        onSave({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            mobile: mobile.trim() || undefined,
            // The backend still keys the platform-admin path off this flag.
            isSuperAdmin: selectedPortal === 'super_admin',
            portal: selectedPortal,
            assignWallet,
            workshopId: needsWorkshopScope ? workshopId : null,
            branchId: needsWorkshopScope ? branchId : null,
            workshopRole: selectedPortal === 'workshop' ? (workshopRole || null) : null,
            roleId: assignRoleId || null,
            // Creates the matching marketing_referrers row so the account shows
            // up in Marketing → Referrer Management.
            ...(selectedPortal === 'referrer' ? { referrerProfile: referrer } : {}),
            // Creates the matching suppliers row so the account shows up under
            // Super Admin → Suppliers.
            ...(selectedPortal === 'supplier' ? { supplierProfile: supplier } : {}),
        });
    };

    return (
        <PermissionsShell asPage={asPage}
            title={t('title.createUser')}
            onClose={onClose}
            backDisabled={saving}
            backLabel={t('shell.back')}
            locale={locale}
            footer={(
                <div className="ui-panel-end">
                    <button type="button" className="ui-btn ui-btn--default" onClick={onClose}>{t('btn.cancel')}</button>
                    <button type="button" className="ui-btn ui-btn--primary" onClick={handleSubmit} disabled={saving}>
                        {saving ? t('btn.creating') : t('btn.createUser')}
                    </button>
                </div>
            )}
        >
            <div className="ui-stack">
                {/* Portal access — decides which login portal the user gets */}
                <section className="ui-subsection">
                    <div className="ui-subsection-head">
                        <h4>{t('user.portalAccess')}</h4>
                    </div>
                    <div className="ui-form-grid">
                        <div className="ui-field ui-col-6">
                            <label>{t('edit.assignPortal')}</label>
                            <select
                                className="ui-select"
                                value={selectedPortal}
                                onChange={(e) => handlePortalChange(e.target.value)}
                            >
                                {portalsMeta.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {t('edit.portalOption', { label: p.label, desc: p.desc })}
                                    </option>
                                ))}
                            </select>
                            <span className="ui-help">{portalLoginHintT(locale, selectedPortal)}</span>
                        </div>
                    </div>
                </section>

                <div className="ui-setting-head ui-setting-head--boxed">
                    <span className="ui-setting-icon"><Wallet size={16} /></span>
                    <div>
                        <div className="ui-setting-name">{t('user.assignWallet')}</div>
                        <div className="ui-help">{t('user.assignWalletHint')}</div>
                    </div>
                    <ToggleSwitch checked={assignWallet} onChange={setAssignWallet} />
                </div>

                {/* Identity */}
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label>{t('user.name')}</label>
                        <input
                            type="text" className="ui-input" placeholder={t('user.namePlaceholder')}
                            value={name} onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label>{t('user.email')}</label>
                        <input
                            type="email" className="ui-input" placeholder={t('user.emailPlaceholder')}
                            value={email} onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label>{t('user.mobile')}</label>
                        <input
                            type="text" className="ui-input" placeholder="+966 50 000 0000"
                            value={mobile} onChange={(e) => setMobile(e.target.value)}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label>{t('user.password')}</label>
                        <input
                            type="password" placeholder={t('user.passwordPlaceholder')}
                            className="ui-input" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                {needsWorkshopScope && (
                    <>
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.workshop')}</label>
                                <select
                                    className="ui-select" value={workshopId}
                                    onChange={(e) => {
                                        setWorkshopId(e.target.value);
                                        setBranchId(''); setWorkshopRole('');
                                    }}
                                    disabled={loadingWs}
                                >
                                    <option value="">{loadingWs ? t('loading.workshops') : t('user.selectWorkshop')}</option>
                                    {workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('user.branch')}</label>
                                <select
                                    className="ui-select" value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                    disabled={!workshopId || loadingBr}
                                >
                                    <option value="">{loadingBr ? t('loading.branches') : t('user.selectBranch')}</option>
                                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {selectedPortal === 'workshop' && (
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('user.workshopRole')}</label>
                                    <select
                                        className="ui-select" value={workshopRole}
                                        onChange={(e) => setWorkshopRole(e.target.value)}
                                        disabled={!branchId}
                                    >
                                        <option value="">{t('user.none')}</option>
                                        {WORKSHOP_ROLE_OPTIONS.map((r) => (
                                            <option key={r.id} value={r.id}>{workshopRoleLabel(locale, r.id)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {selectedPortal === 'referrer' && (
                    <>
                        <div className="ui-subsection-head">
                            <Users size={14} />
                            <h4>{t('user.referrerSection')}</h4>
                        </div>

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.referrerCategory')} *</label>
                                <select
                                    className="ui-select"
                                    value={referrer.category}
                                    onChange={(e) => setReferrerField('category', e.target.value)}
                                >
                                    {REFERRER_CATEGORY_VALUES.map((v) => (
                                        <option key={v} value={v}>
                                            {t(`user.referrerCat.${v.toLowerCase()}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('user.referrerNationalId')}</label>
                                <input
                                    type="text" className="ui-input"
                                    value={referrer.nationalId}
                                    onChange={(e) => setReferrerField('nationalId', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.referrerStatus')}</label>
                                <select
                                    className="ui-select"
                                    value={referrer.status}
                                    onChange={(e) => setReferrerField('status', e.target.value)}
                                >
                                    {REFERRER_STATUS_VALUES.map((v) => (
                                        <option key={v} value={v}>{t(`user.referrerStatus.${v}`)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('user.referrerBankName')}</label>
                                <input
                                    type="text" className="ui-input"
                                    value={referrer.bankName}
                                    onChange={(e) => setReferrerField('bankName', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.referrerIban')}</label>
                                <input
                                    type="text" className="ui-input"
                                    placeholder="SA..."
                                    value={referrer.iban}
                                    onChange={(e) => setReferrerField('iban', e.target.value)}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('user.referrerNotes')}</label>
                                <input
                                    type="text" className="ui-input"
                                    value={referrer.notes}
                                    onChange={(e) => setReferrerField('notes', e.target.value)}
                                />
                            </div>
                        </div>

                        <p className="ui-help">{t('user.referrerHint')}</p>
                    </>
                )}

                {selectedPortal === 'supplier' && (
                    <>
                        <div className="ui-subsection-head">
                            <ScrollText size={14} />
                            <h4>{t('user.supplierSection')}</h4>
                        </div>

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierName')}</label>
                                <input
                                    type="text" className="ui-input"
                                    placeholder={t('user.supplierNamePh')}
                                    value={supplier.supplierName}
                                    onChange={(e) => setSupplierField('supplierName', e.target.value)}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierCategory')}</label>
                                <select
                                    className="ui-select"
                                    value={supplier.category}
                                    onChange={(e) => setSupplierField('category', e.target.value)}
                                >
                                    {SUPPLIER_CATEGORY_VALUES.map((v) => (
                                        <option key={v} value={v}>{t(`user.supplierCat.${v}`)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierVatId')}</label>
                                <input
                                    type="text" className="ui-input"
                                    value={supplier.vatId}
                                    onChange={(e) => setSupplierField('vatId', e.target.value)}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierCrNumber')}</label>
                                <input
                                    type="text" className="ui-input"
                                    value={supplier.crNumber}
                                    onChange={(e) => setSupplierField('crNumber', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierContactPerson')}</label>
                                <input
                                    type="text" className="ui-input"
                                    value={supplier.contactPerson}
                                    onChange={(e) => setSupplierField('contactPerson', e.target.value)}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierStatus')}</label>
                                <select
                                    className="ui-select"
                                    value={supplier.status}
                                    onChange={(e) => setSupplierField('status', e.target.value)}
                                >
                                    <option value="active">{t('user.referrerStatus.active')}</option>
                                    <option value="inactive">{t('user.referrerStatus.inactive')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierAddress')}</label>
                                <input
                                    type="text" className="ui-input"
                                    value={supplier.address}
                                    onChange={(e) => setSupplierField('address', e.target.value)}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierStreet')}</label>
                                <input
                                    type="text" className="ui-input"
                                    value={supplier.street}
                                    onChange={(e) => setSupplierField('street', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierCityDistrict')}</label>
                                <input
                                    type="text" className="ui-input"
                                    value={supplier.cityDistrict}
                                    onChange={(e) => setSupplierField('cityDistrict', e.target.value)}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierBankName')}</label>
                                <input
                                    type="text" className="ui-input"
                                    value={supplier.bankName}
                                    onChange={(e) => setSupplierField('bankName', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.supplierIban')}</label>
                                <input
                                    type="text" className="ui-input"
                                    placeholder="SA..."
                                    value={supplier.iban}
                                    onChange={(e) => setSupplierField('iban', e.target.value)}
                                />
                            </div>
                        </div>

                        <p className="ui-help">{t('user.supplierHint')}</p>
                    </>
                )}

                <section className="ui-subsection">
                    <div className="ui-subsection-head">
                        <Users size={14} />
                        <h4>{t('user.assignRoleSection')}</h4>
                    </div>
                    <div className="ui-form-grid">
                        <div className="ui-field ui-col-6">
                            <label>{t('user.role')}</label>
                            <select
                                className="ui-select" value={assignRoleId}
                                onChange={(e) => setAssignRoleId(e.target.value)}
                            >
                                <option value="">
                                    {assignableRoles.length === 0
                                        ? t('user.roleFullAccess')
                                        : t('user.selectRole')}
                                </option>
                                {assignableRoles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {t('user.roleOption', { name: r.name, count: r.permissionCount })}
                                    </option>
                                ))}
                            </select>
                            {!assignRoleId && (
                                <span className="ui-help">
                                    {t('user.noRoleHint', {
                                        portal: portalLabel(locale, selectedPortal) || selectedPortal,
                                    })}
                                </span>
                            )}
                            {assignableRoles.length === 0 && (
                                <span className="ui-help">{t('user.noRolesScope')}</span>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </PermissionsShell>
    );
}

function ToggleSwitch({ checked, onChange }) {
    return (
        <label className="ui-switch">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="ui-switch-track" />
        </label>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Edit User Role Modal                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function EditUserRoleModal({ user, roles, onClose, onSave, saving, asPage = false, t, locale }) {
    const portalsMeta = getPortalsMeta(locale);
    const [roleId, setRoleId] = useState(user.role?.id ?? '');
    const [resetPassword, setResetPassword] = useState('');
    const [name, setName] = useState(user.name ?? '');
    const [email, setEmail] = useState(user.email ?? '');
    const [mobile, setMobile] = useState(user.mobile ?? '');
    const [assignWallet, setAssignWallet] = useState(Boolean(user.walletEnabled));
    const initialPortal = portalIdForUser(user) || user.role?.portal || 'workshop';
    const [selectedPortal, setSelectedPortal] = useState(initialPortal);
    const [workshopStaffRole, setWorkshopStaffRole] = useState(user.workshopStaffRole ?? '');

    const needsWorkshopScope = portalRequiresWorkshopScope(selectedPortal);
    const [workshopId, setWorkshopId] = useState(user.workshopId ?? '');
    const [branchId, setBranchId] = useState(user.branchId ?? '');

    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loadingWs, setLoadingWs] = useState(false);
    const [loadingBr, setLoadingBr] = useState(false);

    // Load workshops when the selected portal requires workshop / branch scope.
    useEffect(() => {
        if (!needsWorkshopScope) return;
        setLoadingWs(true);
        getWorkshopOptions()
            .then((res) => setWorkshops(res?.workshops ?? []))
            .catch(() => setWorkshops([]))
            .finally(() => setLoadingWs(false));
    }, [needsWorkshopScope]);

    // Load branches whenever the workshop selection changes. Reset branchId
    // if it no longer belongs to the new workshop.
    useEffect(() => {
        if (!needsWorkshopScope || !workshopId) { setBranches([]); return; }
        setLoadingBr(true);
        getBranches({ workshopId })
            .then((res) => {
                const list = res?.branches ?? [];
                setBranches(list);
                // If current branch isn't part of the new workshop, clear it.
                if (branchId && !list.some((b) => String(b.id) === String(branchId))) {
                    setBranchId('');
                }
            })
            .catch(() => setBranches([]))
            .finally(() => setLoadingBr(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workshopId, needsWorkshopScope]);

    const assignableRoles = useMemo(() => {
        const matching = roles.filter((r) => r.portal === selectedPortal);
        if (user.role?.id && !matching.some((r) => String(r.id) === String(user.role.id))) {
            const current = roles.find((r) => String(r.id) === String(user.role.id));
            if (current && String(current.id) === String(roleId)) {
                return [current, ...matching.filter((r) => String(r.id) !== String(current.id))];
            }
        }
        return matching;
    }, [roles, selectedPortal, user.role?.id, roleId]);

    const selectedRole = roles.find((r) => String(r.id) === String(roleId));
    const portalMismatch = selectedRole && selectedRole.portal !== selectedPortal;

    const handlePortalChange = (nextPortal) => {
        setSelectedPortal(nextPortal);
        const currentRole = roles.find((r) => String(r.id) === String(roleId));
        if (currentRole && currentRole.portal !== nextPortal) {
            setRoleId('');
        }
        if (nextPortal === 'super_admin') {
            setWorkshopId('');
            setBranchId('');
        }
    };

    const handleSubmit = () => {
        const pwd = resetPassword.trim();
        if (pwd && pwd.length < 6) {
            alert(t('edit.alert.password'));
            return;
        }
        if (!name.trim()) {
            alert(t('user.alert.name'));
            return;
        }
        if (!email.trim()) {
            alert(t('user.alert.email'));
            return;
        }
        if (needsWorkshopScope && (!workshopId || !branchId)) {
            alert(t('edit.alert.workshopBranch'));
            return;
        }
        const opts = {
            assignWallet,
            portal: selectedPortal,
        };
        // Only send what actually changed, so an untouched field is never
        // re-validated (and an unchanged email never trips the uniqueness check).
        if (name.trim() !== (user.name ?? '')) opts.name = name.trim();
        if (email.trim().toLowerCase() !== String(user.email ?? '').toLowerCase()) {
            opts.email = email.trim().toLowerCase();
        }
        if (mobile.trim() !== (user.mobile ?? '')) opts.mobile = mobile.trim();
        if (needsWorkshopScope) {
            opts.workshopId = workshopId || null;
            opts.branchId = branchId || null;
            if (selectedPortal === 'workshop') {
                opts.workshopRole = workshopStaffRole || null;
            }
        } else if (selectedPortal === 'super_admin') {
            opts.workshopId = null;
            opts.branchId = null;
        }
        if (pwd) opts.password = pwd;
        onSave(user.id, roleId ? String(roleId) : null, opts);
    };

    return (
        <PermissionsShell asPage={asPage}
            title={t('title.editUser', { name: user.name || user.email })}
            onClose={onClose}
            backDisabled={saving}
            backLabel={t('shell.back')}
            locale={locale}
            footer={(
                <div className="ui-panel-end">
                    <button type="button" className="ui-btn ui-btn--default" onClick={onClose}>{t('btn.cancel')}</button>
                    <button type="button" className="ui-btn ui-btn--primary" onClick={handleSubmit} disabled={saving || portalMismatch}>
                        {saving ? t('btn.saving') : t('btn.saveChanges')}
                    </button>
                </div>
            )}
        >
            <div className="ui-stack">
                {/* User summary */}
                <div className="ui-toolbar ui-toolbar--standalone">
                    <span className="ui-avatar ui-avatar--lg">
                        {(user.name || user.email || '?').charAt(0).toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0 }}>
                        <div className="ui-list-title">{user.name || '—'}</div>
                        <div className="ui-meta" style={{ marginTop: 3 }}>
                            <span>{user.email || '—'}</span>
                            <span className="ui-pill ui-pill--neutral">
                                {portalLabel(locale, selectedPortal) || selectedPortal}
                            </span>
                            {user.workshopName ? <span>{user.workshopName}</span> : null}
                            {user.branchName ? <span>{user.branchName}</span> : null}
                        </div>
                    </div>
                </div>

                {/* Assign Wallet — available for any portal user */}
                <div className="ui-setting-head ui-setting-head--boxed">
                    <span className="ui-setting-icon"><Wallet size={16} /></span>
                    <div>
                        <div className="ui-setting-name">{t('user.assignWallet')}</div>
                        <div className="ui-help">
                            {user.walletEnabled
                                ? t('user.assignWalletActive')
                                : t('user.assignWalletHint')}
                        </div>
                    </div>
                    <ToggleSwitch checked={assignWallet} onChange={setAssignWallet} />
                </div>

                {/* Account details — editable */}
                <section className="ui-subsection">
                    <div className="ui-subsection-head">
                        <h4>{t('edit.accountDetails')}</h4>
                    </div>
                    <div className="ui-form-grid">
                        <div className="ui-field ui-col-6">
                            <label>{t('user.name')}</label>
                            <input
                                type="text" className="ui-input"
                                value={name} onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="ui-field ui-col-6">
                            <label>{t('user.email')}</label>
                            <input
                                type="email" className="ui-input"
                                value={email} onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="ui-form-grid">
                        <div className="ui-field ui-col-6">
                            <label>{t('user.mobile')}</label>
                            <input
                                type="text" className="ui-input"
                                placeholder="+966 50 000 0000"
                                value={mobile} onChange={(e) => setMobile(e.target.value)}
                            />
                        </div>
                    </div>
                </section>

                {/* Login portal assignment */}
                <section className="ui-subsection">
                    <div className="ui-subsection-head">
                        <h4>{t('edit.loginPortal')}</h4>
                    </div>
                    <div className="ui-form-grid">
                        <div className="ui-field ui-col-6">
                            <label>{t('edit.assignPortal')}</label>
                            <select
                                className="ui-select"
                                value={selectedPortal}
                                onChange={(e) => handlePortalChange(e.target.value)}
                            >
                                {portalsMeta.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {t('edit.portalOption', { label: p.label, desc: p.desc })}
                                    </option>
                                ))}
                            </select>
                            <span className="ui-help">{portalLoginHintT(locale, selectedPortal)}</span>
                        </div>
                    </div>
                </section>

                {/* Current role */}
                <div className={`ui-banner ui-banner--${user.role ? 'info' : 'warn'}`}>
                    <span>
                        {t('edit.currentRole')} <strong>{user.role?.name ?? t('edit.noRoleLegacy')}</strong>
                        {user.role ? ` ${t('edit.currentRoleMeta', {
                            count: user.role.permissionCount,
                            portal: portalLabel(locale, user.role.portal) || user.role.portal,
                        })}` : ''}
                    </span>
                </div>

                {/* Workshop + Branch — for workshop / cashier / technician portals */}
                {needsWorkshopScope && (
                    <>
                        <div className="ui-subsection-head">
                            <h4>{t('edit.workshopScope')}</h4>
                        </div>
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label>{t('user.workshop')}</label>
                                <select
                                    className="ui-select"
                                    value={workshopId}
                                    onChange={(e) => {
                                        setWorkshopId(e.target.value);
                                        setBranchId(''); // reset branch when workshop changes
                                    }}
                                    disabled={loadingWs}
                                >
                                    <option value="">{loadingWs ? t('loading.workshops') : t('user.none')}</option>
                                    {workshops.map((w) => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('user.branch')}</label>
                                <select
                                    className="ui-select"
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                    disabled={!workshopId || loadingBr}
                                >
                                    <option value="">{loadingBr ? t('loading.branches') : t('user.none')}</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {selectedPortal === 'workshop' && (
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('user.workshopRole')}</label>
                                    <select
                                        className="ui-select"
                                        value={workshopStaffRole}
                                        onChange={(e) => setWorkshopStaffRole(e.target.value)}
                                    >
                                        <option value="">{t('user.none')}</option>
                                        {WORKSHOP_ROLE_OPTIONS.map((r) => (
                                            <option key={r.id} value={r.id}>{workshopRoleLabel(locale, r.id)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Role selector */}
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label>{t('edit.assignRole')}</label>
                        <select
                            className="ui-select"
                            value={roleId}
                            onChange={(e) => setRoleId(e.target.value)}
                        >
                            <option value="">{t('edit.clearRole')}</option>
                            {assignableRoles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {t('edit.roleOption', {
                                        name: r.name,
                                        count: r.permissionCount,
                                        portal: portalLabel(locale, r.portal) || r.portal,
                                    })}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label>{t('edit.resetPassword')}</label>
                        <input
                            type="password"
                            className="ui-input"
                            autoComplete="new-password"
                            placeholder={t('edit.resetPasswordPlaceholder')}
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                        />
                        <span className="ui-help">{t('edit.resetPasswordHint')}</span>
                    </div>
                </div>

                {portalMismatch && (
                    <div className="ui-banner ui-banner--warn">
                        <AlertCircle size={15} />
                        <span>
                            {t('edit.mismatch', {
                                rolePortal: portalLabel(locale, selectedRole.portal) || selectedRole.portal,
                                selectedPortal: portalLabel(locale, selectedPortal) || selectedPortal,
                            })}
                        </span>
                    </div>
                )}

                <p className="ui-help">{t('edit.tip')}</p>
            </div>
        </PermissionsShell>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Per-User Permission Override Modal                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Lets the admin override a single user's effective permissions without
 * touching their role. Loads:
 *   - The registry tree for the role's portal (matrix UI)
 *   - The user's CURRENT effective codes (override or role defaults)
 *
 * Save → PUT /users/:id/permissions (stores override)
 * Reset to defaults → DELETE /users/:id/permissions (clears override)
 */
function UserPermissionsModal({ user, registryByPortal, loadRegistry, onClose, onSaved, asPage = false, t, locale }) {
    const portal = user?.role?.portal || 'super_admin';
    const [perms, setPerms] = useState({}); // { [tabKey]: { [action]: true } }
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [hasOverride, setHasOverride] = useState(false);

    // Make sure the role's portal tree is cached.
    useEffect(() => {
        if (registryByPortal[portal]) return;
        loadRegistry(portal).catch(() => undefined);
    }, [portal, registryByPortal, loadRegistry]);

    // Load the user's effective codes on open and seed the checkbox matrix.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        permissionsApi.getUserPermissions(user.id)
            .then((res) => {
                if (cancelled) return;
                setHasOverride(Boolean(res?.hasOverride));
                setPerms(codesToActionsByTab(res?.effectiveCodes ?? []));
                setError('');
            })
            .catch((e) => {
                if (cancelled) return;
                setError(e?.message || t('error.loadUserPerms'));
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [user.id, t]);

    const portalTree = registryByPortal[portal]?.length
        ? registryByPortal[portal]
        : getComingSoonTree(t);
    const totalActions = useMemo(() => portalTree.reduce(
        (sum, sec) => sum + sec.tabs.reduce((acc, tab) => acc + (tab.actions?.length ?? 0), 0),
        0,
    ), [portalTree]);
    const selectedCount = useMemo(() => Object.values(perms).reduce(
        (acc, m) => acc + Object.values(m).filter(Boolean).length, 0,
    ), [perms]);

    const toggleAction = (tabKey, action) => {
        setPerms((prev) => ({
            ...prev,
            [tabKey]: { ...(prev[tabKey] || {}), [action]: !prev[tabKey]?.[action] },
        }));
    };
    const toggleTabAll = (tab) => {
        const allOn = tab.actions.every((a) => perms[tab.key]?.[a]);
        const next = { ...(perms[tab.key] || {}) };
        tab.actions.forEach((a) => { next[a] = !allOn; });
        setPerms((prev) => ({ ...prev, [tab.key]: next }));
    };
    const toggleSectionAll = (section) => {
        const flat = section.tabs.flatMap((tab) => tab.actions.map((a) => [tab.key, a]));
        const allOn = flat.every(([k, a]) => perms[k]?.[a]);
        const next = { ...perms };
        for (const tab of section.tabs) {
            next[tab.key] = { ...(next[tab.key] || {}) };
            for (const a of tab.actions) next[tab.key][a] = !allOn;
        }
        setPerms(next);
    };
    const selectAll = () => {
        const allOn = selectedCount === totalActions;
        const next = {};
        if (!allOn) {
            for (const sec of portalTree) for (const tab of sec.tabs) {
                next[tab.key] = {};
                for (const a of tab.actions) next[tab.key][a] = true;
            }
        }
        setPerms(next);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const codes = flattenActionsByTab(perms);
            await permissionsApi.setUserPermissions(user.id, codes);
            onSaved?.();
        } catch (e) {
            alert(e?.message || t('error.savePermissions'));
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm(t('confirm.resetOverride'))) return;
        setSaving(true);
        try {
            await permissionsApi.clearUserPermissions(user.id);
            onSaved?.();
        } catch (e) {
            alert(e?.message || t('error.resetPermissions'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <PermissionsShell asPage={asPage}
            title={t('title.userPermissions', { name: user.name || user.email })}
            onClose={onClose}
            backDisabled={saving}
            backLabel={t('shell.back')}
            locale={locale}
            footer={(
                <div className="ui-panel-end">
                    {hasOverride && (
                        <button type="button" className="ui-btn ui-btn--default" onClick={handleReset} disabled={saving}>
                            {t('btn.resetDefaults')}
                        </button>
                    )}
                    <button type="button" className="ui-btn ui-btn--default" onClick={onClose}>{t('btn.cancel')}</button>
                    <button type="button" className="ui-btn ui-btn--primary" onClick={handleSave} disabled={saving || loading}>
                        {saving ? t('btn.saving') : t('btn.saveOverride')}
                    </button>
                </div>
            )}
        >
            <div className="ui-stack">
                {/* User + role summary */}
                <div className="ui-toolbar ui-toolbar--standalone">
                    <span className="ui-avatar ui-avatar--lg">
                        {(user.name || user.email || '?').charAt(0).toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0 }}>
                        <div className="ui-list-title">{user.name || '—'}</div>
                        <div className="ui-meta" style={{ marginTop: 3 }}>
                            <span>{user.email || '—'}</span>
                            <span className="ui-pill ui-pill--neutral">
                                {portalLabel(locale, portal) || portal}
                            </span>
                            <span>{t('override.roleLabel', { name: user.role?.name })}</span>
                        </div>
                    </div>
                </div>

                {/* Mode banner */}
                <div className={`ui-banner ui-banner--${hasOverride ? 'warn' : 'info'}`}>
                    <span>{hasOverride ? t('override.active') : t('override.defaults')}</span>
                </div>

                {error && (
                    <div className="ui-banner ui-banner--dang">
                        <AlertCircle size={15} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="ui-toolbar ui-toolbar--standalone">
                    <strong>{t('count.selected', { selected: selectedCount, total: totalActions })}</strong>
                    <div className="ui-toolbar-end">
                        <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={selectAll}>
                            {selectedCount === totalActions ? t('btn.deselectAll') : t('btn.selectAll')}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="ui-state">
                        <Loader2 size={18} className="ui-spin" />
                        <div className="ui-state-title">{t('loading.permissions')}</div>
                    </div>
                ) : (
                    <div className="ui-stack-sm">
                        {portalTree.map((section) => (
                            <SectionPermissionsCard
                                key={section.section}
                                section={section}
                                perms={perms}
                                onToggleAction={toggleAction}
                                onToggleTab={toggleTabAll}
                                onToggleSection={() => toggleSectionAll(section)}
                                t={t}
                                locale={locale}
                            />
                        ))}
                    </div>
                )}

                <p className="ui-help">{t('override.tip', { role: user.role?.name })}</p>
            </div>
        </PermissionsShell>
    );
}
