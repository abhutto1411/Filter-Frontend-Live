/* eslint-disable react/prop-types */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Pencil, Trash2, Search,
    ShieldCheck, Users,
    UserCircle, ChevronDown, ChevronRight,
    Building, Wrench, Store, ScrollText, Sparkles, Briefcase,
    Loader2, RefreshCcw, AlertCircle, Wallet,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Modal from '../../components/Modal';
import ApprovalsPage from './ApprovalsPage';
import * as permissionsApi from '../../services/permissionsApi';
import { getWorkshopOptions, getBranches } from '../../services/superAdminApi';
import { codesToActionsByTab, flattenActionsByTab } from '../../utils/permissions';
import { portalLoginHint, portalRequiresWorkshopScope } from '../../utils/permissionsPortalUtils';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/PermissionsPage.css';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Portals (UI-only metadata — backend is the source of truth for codes)    */
/* ────────────────────────────────────────────────────────────────────────── */

const PORTALS = [
    { id: 'super_admin', label: 'Super Admin', icon: ShieldCheck, color: '#7c3aed', desc: 'Platform-wide control' },
    { id: 'workshop',    label: 'Workshop',    icon: Wrench,      color: '#0d9488', desc: 'Workshop owner / staff' },
    { id: 'cashier',     label: 'Cashier (POS)', icon: Store,     color: '#2563eb', desc: 'Point of sale operators' },
    { id: 'technician',  label: 'Technician',  icon: Briefcase,   color: '#ea580c', desc: 'Job execution app' },
    { id: 'corporate',   label: 'Corporate',   icon: Building,    color: '#0891b2', desc: 'Corporate client portal' },
    { id: 'supplier',    label: 'Supplier',    icon: ScrollText,  color: '#a16207', desc: 'Supplier portal' },
];

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
};

function portalIdForUser(user) {
    return USER_TYPE_TO_PORTAL[user?.userType] || user?.role?.portal || null;
}

const WORKSHOP_ROLE_OPTIONS = [
    { id: 'workshop_owner', label: 'Workshop Owner' },
    { id: 'manager',        label: 'Manager' },
    { id: 'supervisor',     label: 'Supervisor' },
    { id: 'team_leader',    label: 'Team Leader' },
    { id: 'cashier',        label: 'Cashier' },
    { id: 'technician',     label: 'Technician' },
];

const ACTION_LABEL = {
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    approve: 'Approve',
    reject: 'Reject',
    export: 'Export',
};
const ACTION_COLOR = {
    view: '#0ea5e9',
    create: '#16a34a',
    edit: '#d97706',
    delete: '#dc2626',
    approve: '#7c3aed',
    reject: '#be185d',
    export: '#0891b2',
};

/** Fallback skeleton when a portal's tree isn't seeded yet. */
const COMING_SOON_TREE = [
    { section: 'COMING SOON', tabs: [{ key: '_placeholder', label: 'Permissions for this portal will be defined in the next step', actions: [] }] },
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main page                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export default function PermissionsPage() {
    const { hasPermission } = useAuth();
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
    const [roleModalOpen, setRoleModalOpen] = useState(false);
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    /** User whose per-user permission override is being edited (separate from role-edit modal). */
    const [permissionsUser, setPermissionsUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [portalFilter, setPortalFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchRoles = useCallback(async () => {
        const res = await permissionsApi.listRoles();
        setRoles(res?.roles ?? []);
    }, []);

    const fetchUsers = useCallback(async () => {
        const res = await permissionsApi.listUsers();
        setUsers(res?.users ?? []);
    }, []);

    const fetchRegistry = useCallback(async (portal) => {
        const res = await permissionsApi.getRegistry(portal);
        setRegistryByPortal((prev) => ({ ...prev, [portal]: res?.tree ?? [] }));
        return res?.tree ?? [];
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            await Promise.all([
                fetchRoles(),
                fetchUsers(),
                fetchRegistry('super_admin'),
            ]);
        } catch (e) {
            setError(e?.message || 'Failed to load permissions data');
        } finally {
            setLoading(false);
        }
    }, [fetchRoles, fetchUsers, fetchRegistry]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const filteredUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return users.filter((u) => {
            if (portalFilter && portalIdForUser(u) !== portalFilter) return false;
            if (!q) return true;
            return (u.name || '').toLowerCase().includes(q)
                || (u.email || '').toLowerCase().includes(q)
                || (u.role?.name || '').toLowerCase().includes(q);
        });
    }, [users, searchQuery, portalFilter]);

    const handleCreateNewRole = () => {
        setEditingRole(null);
        setRoleModalOpen(true);
    };

    const handleCreateNewUser = () => setUserModalOpen(true);

    const handleEditRole = (role) => {
        setEditingRole(role);
        setRoleModalOpen(true);
    };

    const handleEditUserRole = (user) => {
        setEditingUser(user);
    };

    const handleEditUserPermissions = (user) => {
        setPermissionsUser(user);
    };

    const handleSaveUserRole = async (userId, roleId, opts = {}) => {
        setSaving(true);
        try {
            await permissionsApi.assignRoleToUser(userId, roleId, opts);
            setEditingUser(null);
            await fetchUsers();
        } catch (e) {
            alert(e?.message || 'Could not update user');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async (id) => {
        if (!window.confirm('Delete this role? This cannot be undone.')) return;
        try {
            await permissionsApi.deleteRole(id);
            await fetchRoles();
        } catch (e) {
            alert(e?.message || 'Could not delete role');
        }
    };

    /** RoleModal returns `{ name, description, portal, permissions: string[] (flat codes) }`. */
    const handleSaveRole = async (payload) => {
        setSaving(true);
        try {
            if (editingRole) {
                await permissionsApi.updateRole(editingRole.id, {
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
            setRoleModalOpen(false);
            setEditingRole(null);
            await fetchRoles();
        } catch (e) {
            alert(e?.message || 'Could not save role');
        } finally {
            setSaving(false);
        }
    };

    /** UserModal returns the full payload — see permissionsApi.createUser. */
    const handleSaveUser = async (payload) => {
        setSaving(true);
        try {
            await permissionsApi.createUser(payload);
            setUserModalOpen(false);
            await fetchUsers();
        } catch (e) {
            alert(e?.message || 'Could not create user');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="permissions-page module-container">
            <header className="permissions-page-header">
                <div>
                    <h1 className="permissions-title">Users & Permissions</h1>
                    <p className="permissions-subtitle">Manage users, roles and access control</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn-portal create-role-btn" onClick={fetchAll} title="Refresh">
                        <RefreshCcw size={16} /> Refresh
                    </button>
                    <button type="button" className="btn-portal create-role-btn" onClick={handleCreateNewUser}>
                        <UserCircle size={18} /> Create User
                    </button>
                    <button type="button" className="btn-portal create-role-btn" onClick={handleCreateNewRole}>
                        <ShieldCheck size={18} /> Create Role
                    </button>
                </div>
            </header>

            {error && (
                <div style={{
                    margin: '0 0 12px', padding: '10px 14px', borderRadius: 10,
                    background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem',
                }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div className="permissions-tabs-container">
                <div className="permissions-tabs">
                    <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                        Users ({users.length})
                    </button>
                    <button className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>
                        Roles ({roles.length})
                    </button>
                    {canSeeApprovalSettings && (
                        <button className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>
                            Approval Configuration
                        </button>
                    )}
                </div>
            </div>

            <main className="permissions-content">
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, justifyContent: 'center', color: '#64748b' }}>
                        <Loader2 size={20} className="spin" /> Loading…
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {activeTab === 'users' ? (
                            <UsersTab
                                key="users"
                                users={filteredUsers}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                portalFilter={portalFilter}
                                setPortalFilter={setPortalFilter}
                                totalCount={users.length}
                                onEditUser={handleEditUserRole}
                                onEditPermissions={handleEditUserPermissions}
                            />
                        ) : activeTab === 'roles' ? (
                            <RolesTab key="roles" roles={roles} onEdit={handleEditRole} onDelete={handleDeleteRole} />
                        ) : canSeeApprovalSettings ? (
                            <ApprovalsPage key="approvals" isTab onlySettings />
                        ) : null}
                    </AnimatePresence>
                )}
            </main>

            <AnimatePresence>
                {roleModalOpen && (
                    <RoleModal
                        onClose={() => { setRoleModalOpen(false); setEditingRole(null); }}
                        onSave={handleSaveRole}
                        editingRole={editingRole}
                        registryByPortal={registryByPortal}
                        loadRegistry={fetchRegistry}
                        saving={saving}
                    />
                )}
                {userModalOpen && (
                    <UserModal
                        onClose={() => setUserModalOpen(false)}
                        onSave={handleSaveUser}
                        roles={roles}
                        saving={saving}
                    />
                )}
                {editingUser && (
                    <EditUserRoleModal
                        user={editingUser}
                        roles={roles}
                        onClose={() => setEditingUser(null)}
                        onSave={handleSaveUserRole}
                        saving={saving}
                    />
                )}
                {permissionsUser && (
                    <UserPermissionsModal
                        user={permissionsUser}
                        registryByPortal={registryByPortal}
                        loadRegistry={fetchRegistry}
                        onClose={() => setPermissionsUser(null)}
                        onSaved={() => { setPermissionsUser(null); fetchUsers(); }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Users tab                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function UsersTab({ users, searchQuery, setSearchQuery, portalFilter, setPortalFilter, totalCount, onEditUser, onEditPermissions }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }} className="users-tab-content"
        >
            <div className="search-bar-container" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="search-input-wrapper" style={{ flex: 1 }}>
                    <Search className="search-icon" size={18} />
                    <input
                        type="text" placeholder="Search users…"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
                <select
                    value={portalFilter}
                    onChange={(e) => setPortalFilter(e.target.value)}
                    style={{
                        padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
                        background: '#fff', fontSize: '0.875rem', fontWeight: 600,
                        color: '#0f172a', cursor: 'pointer', minWidth: 200,
                    }}
                >
                    <option value="">All Portals ({totalCount})</option>
                    {PORTALS.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                </select>
                {portalFilter && (
                    <button
                        type="button"
                        onClick={() => setPortalFilter('')}
                        style={{
                            padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                            background: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                            color: '#64748b',
                        }}
                    >
                        Clear filter
                    </button>
                )}
            </div>

            <div className="premium-table-container">
                <table className="premium-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Portal</th>
                            <th>Workshop / Branch</th>
                            <th>Role</th>
                            <th>Permissions</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No users found.</td></tr>
                        ) : users.map((user) => {
                            const portalId = portalIdForUser(user);
                            const portalMeta = PORTALS.find((p) => p.id === portalId);
                            const avatar = (user.name || user.email || '?').charAt(0).toUpperCase();
                            return (
                                <tr key={user.id}>
                                    <td>
                                        <div className="user-info-cell">
                                            <div className="perm-user-avatar">{avatar}</div>
                                            <div className="user-details">
                                                <div className="perm-user-name">{user.name || '—'}</div>
                                                <div className="perm-user-email">{user.email || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        {portalId ? (
                                            <span style={portalPillStyle(portalId)}>
                                                {portalMeta?.label ?? portalId}
                                            </span>
                                        ) : <span style={{ color: '#94a3b8' }}>—</span>}
                                    </td>
                                    <td style={{ fontSize: '0.8125rem' }}>
                                        <div>{user.workshopName ?? '—'}</div>
                                        {user.branchName ? (
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{user.branchName}</div>
                                        ) : null}
                                    </td>
                                    <td>
                                        <div className="role-selector">
                                            <span>{user.role?.name ?? <em style={{ color: '#94a3b8' }}>No role</em>}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="permission-count-badge">
                                            {user.role?.permissionCount ?? 0} permissions
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${user.isActive ? 'status-active' : ''}`}>
                                            {user.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <div style={{ display: 'inline-flex', gap: 6 }}>
                                            <button
                                                type="button"
                                                className="btn-icon"
                                                onClick={() => onEditUser?.(user)}
                                                title="Change assigned role / workshop / branch"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            {user.role && (
                                                <button
                                                    type="button"
                                                    className="btn-icon"
                                                    onClick={() => onEditPermissions?.(user)}
                                                    title="Override this user's permissions (won't affect the role)"
                                                    style={{ color: '#7c3aed' }}
                                                >
                                                    <ShieldCheck size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
}

function portalPillStyle(portal) {
    const p = PORTALS.find((x) => x.id === portal);
    const c = p?.color || '#64748b';
    return {
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        background: `${c}1a`,
        color: c,
        fontSize: '0.7rem',
        fontWeight: 700,
    };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Roles tab                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function RolesTab({ roles, onEdit, onDelete }) {
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
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                No roles defined yet. Click <strong>Create Role</strong> to add one.
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
        >
            {grouped.map(([portalId, list]) => {
                const portal = PORTALS.find((p) => p.id === portalId);
                const Icon = portal?.icon ?? Sparkles;
                return (
                    <div key={portalId} style={{ marginBottom: 28 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${portal?.color ?? '#64748b'}1a`, color: portal?.color ?? '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={18} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                                    {portal?.label ?? portalId}
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{list.length} role(s)</p>
                            </div>
                        </div>
                        <div className="roles-grid">
                            {list.map((role) => (
                                <motion.div key={role.id} className="role-card role-admin" whileHover={{ scale: 1.02 }}>
                                    <div className="role-card-header">
                                        <div className="role-icon-container">
                                            <ShieldCheck size={22} className="role-icon" />
                                        </div>
                                        <div className="role-card-actions">
                                            <button className="btn-icon" onClick={() => onEdit(role)}><Pencil size={18} /></button>
                                            {!role.isSystem && (
                                                <button className="btn-icon delete" onClick={() => onDelete(role.id)}><Trash2 size={18} /></button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="role-card-body">
                                        <h3 className="role-name">{role.name}</h3>
                                        <p className="role-perm-count">{role.permissionCount} permissions</p>
                                        <p className="role-description">{role.description || '—'}</p>
                                        <div className="role-tags">
                                            <span className="role-tag">{role.userCount ?? 0} user(s)</span>
                                        </div>
                                    </div>
                                    {role.isSystem && (
                                        <div className="role-card-footer">
                                            <span className="system-role-badge">System Role</span>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </motion.div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Create / Edit Role Modal                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function RoleModal({ onClose, onSave, editingRole, registryByPortal, loadRegistry, saving }) {
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
        ? (registryByPortal[portal]?.length ? registryByPortal[portal] : COMING_SOON_TREE)
        : null;

    const totalActions = useMemo(() => {
        if (!portalTree) return 0;
        return portalTree.reduce(
            (sum, sec) => sum + sec.tabs.reduce((s, t) => s + (t.actions?.length ?? 0), 0),
            0,
        );
    }, [portalTree]);

    const selectedCount = useMemo(
        () => Object.values(perms).reduce(
            (s, m) => s + Object.values(m).filter(Boolean).length, 0,
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
        const flatActions = section.tabs.flatMap((t) => t.actions.map((a) => [t.key, a]));
        const allOn = flatActions.every(([k, a]) => perms[k]?.[a]);
        const next = { ...perms };
        for (const t of section.tabs) {
            next[t.key] = { ...(next[t.key] || {}) };
            for (const a of t.actions) next[t.key][a] = !allOn;
        }
        setPerms(next);
    };

    const selectAll = () => {
        if (!portalTree) return;
        const allOn = selectedCount === totalActions;
        const next = {};
        if (!allOn) {
            for (const sec of portalTree) {
                for (const t of sec.tabs) {
                    next[t.key] = {};
                    for (const a of t.actions) next[t.key][a] = true;
                }
            }
        }
        setPerms(next);
    };

    const handleSubmit = () => {
        if (!portal) { alert('Pick a portal first'); return; }
        if (!name.trim()) { alert('Role name is required'); return; }
        const codes = flattenActionsByTab(perms);
        onSave({
            name: name.trim(),
            description: description.trim(),
            portal,
            permissions: codes,
        });
    };

    return (
        <Modal
            title={editingRole ? 'Edit Role' : 'Create New Role'}
            onClose={onClose}
            className="create-role-modal"
            footer={(
                <div className="modal-footer-actions">
                    {!editingRole && step === 2 && (
                        <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                            ← Back
                        </button>
                    )}
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    {step === 1 ? (
                        <button
                            type="button" className="btn-submit"
                            disabled={!portal} onClick={() => setStep(2)}
                            style={{ opacity: portal ? 1 : 0.6 }}
                        >
                            Continue →
                        </button>
                    ) : (
                        <button type="button" className="btn-submit" onClick={handleSubmit} disabled={saving}>
                            {saving ? 'Saving…' : (editingRole ? 'Save Changes' : 'Create Role')}
                        </button>
                    )}
                </div>
            )}
        >
            {step === 1 ? (
                <div style={{ padding: 4 }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                        Which portal is this role for?
                    </h3>
                    <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#64748b' }}>
                        Each portal has its own pages and actions. We'll show only the permissions that apply.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                        {PORTALS.map((p) => {
                            const Icon = p.icon;
                            const selected = portal === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setPortal(p.id)}
                                    style={{
                                        padding: 16, borderRadius: 12, border: `2px solid ${selected ? p.color : '#e2e8f0'}`,
                                        background: selected ? `${p.color}10` : '#fff', textAlign: 'left', cursor: 'pointer',
                                        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${p.color}1a`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Icon size={18} />
                                    </div>
                                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{p.label}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.desc}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="create-role-form">
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label>Role Name *</label>
                            <input
                                type="text" className="form-input" placeholder="e.g. Branch Manager"
                                value={name} onChange={(e) => setName(e.target.value)}
                                disabled={editingRole?.isSystem}
                            />
                            {editingRole?.isSystem && (
                                <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>System roles cannot be renamed.</small>
                            )}
                        </div>
                        <div className="form-group flex-1">
                            <label>Description</label>
                            <input
                                type="text" className="form-input" placeholder="Brief description"
                                value={description} onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 10, background: '#f8fafc',
                        border: '1px solid #e2e8f0', marginTop: 8, marginBottom: 14,
                    }}>
                        <div>
                            <strong style={{ fontSize: '0.875rem' }}>{PORTALS.find((p) => p.id === portal)?.label} portal</strong>
                            <span style={{ color: '#64748b', marginLeft: 8, fontSize: '0.8125rem' }}>
                                · {selectedCount} of {totalActions} permissions selected
                            </span>
                        </div>
                        <button type="button" className="btn-link" onClick={selectAll}>
                            {selectedCount === totalActions ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    {loadingTree ? (
                        <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                            <Loader2 size={18} className="spin" /> Loading permissions tree…
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {portalTree?.map((section) => (
                                <SectionPermissionsCard
                                    key={section.section}
                                    section={section}
                                    perms={perms}
                                    onToggleAction={toggleAction}
                                    onToggleTab={toggleTabAll}
                                    onToggleSection={() => toggleSectionAll(section)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

function SectionPermissionsCard({ section, perms, onToggleAction, onToggleTab, onToggleSection }) {
    const [open, setOpen] = useState(true);
    const totalActions = section.tabs.reduce((s, t) => s + (t.actions?.length ?? 0), 0);
    const checkedActions = section.tabs.reduce(
        (s, t) => s + (t.actions?.filter((a) => perms[t.key]?.[a]).length ?? 0),
        0,
    );
    const allOn = totalActions > 0 && checkedActions === totalActions;

    return (
        <div className="permission-group-card">
            <div className="group-header" style={{ alignItems: 'center' }}>
                <div className="group-title-row" style={{ flex: 1 }}>
                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
                    >
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className="group-name" style={{ fontWeight: 800, color: '#0f172a' }}>{section.section}</span>
                    </button>
                    <span className="group-counter" style={{ marginLeft: 'auto' }}>{checkedActions}/{totalActions}</span>
                </div>
                <button
                    type="button"
                    onClick={onToggleSection}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                >
                    {allOn ? 'Clear' : 'Select all'}
                </button>
            </div>

            {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {section.tabs.map((tab) => (
                        <TabPermissionRow
                            key={tab.key}
                            tab={tab}
                            perms={perms}
                            onToggleAction={onToggleAction}
                            onToggleTab={() => onToggleTab(tab)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function TabPermissionRow({ tab, perms, onToggleAction, onToggleTab }) {
    if ((tab.actions?.length ?? 0) === 0) {
        return (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: '0.8125rem' }}>
                {tab.label}
            </div>
        );
    }
    const all = tab.actions.every((a) => perms[tab.key]?.[a]);
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px',
            borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0',
        }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 240 }}>
                <input type="checkbox" checked={!!all} onChange={onToggleTab} />
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{tab.label}</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' }}>
                {tab.actions.map((a) => {
                    const on = !!perms[tab.key]?.[a];
                    const c = ACTION_COLOR[a] || '#64748b';
                    return (
                        <label
                            key={a}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '4px 10px', borderRadius: 999,
                                border: `1px solid ${on ? c : '#cbd5e1'}`,
                                background: on ? `${c}14` : '#fff',
                                color: on ? c : '#64748b',
                                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                transition: 'all 0.12s',
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={on}
                                onChange={() => onToggleAction(tab.key, a)}
                                style={{ display: 'none' }}
                            />
                            {ACTION_LABEL[a] || a}
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Create User Modal                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function UserModal({ onClose, onSave, roles, saving }) {
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [workshopId, setWorkshopId] = useState('');
    const [branchId, setBranchId] = useState('');
    const [workshopRole, setWorkshopRole] = useState('');
    const [assignRoleId, setAssignRoleId] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [assignWallet, setAssignWallet] = useState(false);

    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loadingWs, setLoadingWs] = useState(false);
    const [loadingBr, setLoadingBr] = useState(false);

    // Load workshops the first time the non-super-admin branch needs them.
    useEffect(() => {
        if (isSuperAdmin) return;
        if (workshops.length > 0) return;
        setLoadingWs(true);
        getWorkshopOptions()
            .then((res) => setWorkshops(res?.workshops ?? []))
            .catch(() => setWorkshops([]))
            .finally(() => setLoadingWs(false));
    }, [isSuperAdmin, workshops.length]);

    // Load branches whenever workshop changes.
    useEffect(() => {
        if (!workshopId) { setBranches([]); return; }
        setLoadingBr(true);
        getBranches({ workshopId })
            .then((res) => setBranches(res?.branches ?? []))
            .catch(() => setBranches([]))
            .finally(() => setLoadingBr(false));
    }, [workshopId]);

    // Strict portal filter:
    //   - Super Admin toggle ON → only super_admin portal roles
    //   - Super Admin toggle OFF (workshop + branch + employee flow) → only workshop portal roles
    // Other portals (cashier / corporate / supplier / technician) have their own
    // dedicated create flows, so we don't list those roles here.
    const assignableRoles = useMemo(() => {
        const targetPortal = isSuperAdmin ? 'super_admin' : 'workshop';
        return roles.filter((r) => r.portal === targetPortal);
    }, [roles, isSuperAdmin]);

    const handleSubmit = () => {
        if (!name.trim()) { alert('Name is required'); return; }
        if (!email.trim()) { alert('Email is required'); return; }
        if (!password || password.length < 6) {
            alert('Password is required (min 6 characters)');
            return;
        }
        if (!assignRoleId) {
            alert('Pick a role to assign');
            return;
        }
        if (!isSuperAdmin) {
            if (!workshopId || !branchId) {
                alert('Workshop and branch are required for non-Super-Admin users');
                return;
            }
        }
        onSave({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            mobile: mobile.trim() || undefined,
            isSuperAdmin,
            assignWallet,
            workshopId: isSuperAdmin ? null : workshopId,
            branchId: isSuperAdmin ? null : branchId,
            workshopRole: isSuperAdmin ? null : (workshopRole || null),
            roleId: assignRoleId,
        });
    };

    return (
        <Modal
            title="Create New User"
            onClose={onClose}
            className="create-role-modal"
            footer={(
                <div className="modal-footer-actions">
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn-submit" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Creating…' : 'Create User'}
                    </button>
                </div>
            )}
        >
            <div className="create-role-form">
                {/* Super Admin toggle */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 12,
                    border: `2px solid ${isSuperAdmin ? '#7c3aed' : '#e2e8f0'}`,
                    background: isSuperAdmin ? '#faf5ff' : '#fff',
                    marginBottom: 16, transition: 'all 0.15s',
                }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: isSuperAdmin ? '#7c3aed' : '#f1f5f9',
                            color: isSuperAdmin ? '#fff' : '#64748b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9375rem' }}>Super Admin user</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Platform-wide access — workshop / branch selection is skipped.
                            </div>
                        </div>
                    </div>
                    <ToggleSwitch checked={isSuperAdmin} onChange={(v) => {
                        setIsSuperAdmin(v);
                        if (v) { setWorkshopId(''); setBranchId(''); setWorkshopRole(''); }
                        setAssignRoleId('');
                    }} />
                </div>

                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 12,
                    border: `2px solid ${assignWallet ? '#d97706' : '#e2e8f0'}`,
                    background: assignWallet ? '#fffbeb' : '#fff',
                    marginBottom: 16, transition: 'all 0.15s',
                }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: assignWallet ? '#f59e0b' : '#f1f5f9',
                            color: assignWallet ? '#fff' : '#64748b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Wallet size={18} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9375rem' }}>Assign Wallet</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Create a SAR wallet (0 balance) — user can request funds and record expenses later.
                            </div>
                        </div>
                    </div>
                    <ToggleSwitch checked={assignWallet} onChange={setAssignWallet} />
                </div>

                {/* Identity */}
                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>Name *</label>
                        <input
                            type="text" className="form-input" placeholder="Full name"
                            value={name} onChange={(e) => setName(e.target.value)}
                            style={selectStyle}
                        />
                    </div>
                    <div className="form-group flex-1">
                        <label>Email *</label>
                        <input
                            type="email" className="form-input" placeholder="user@example.com"
                            value={email} onChange={(e) => setEmail(e.target.value)}
                            style={selectStyle}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>Mobile</label>
                        <input
                            type="text" className="form-input" placeholder="+966 50 000 0000"
                            value={mobile} onChange={(e) => setMobile(e.target.value)}
                            style={selectStyle}
                        />
                    </div>
                    <div className="form-group flex-1">
                        <label>Password *</label>
                        <input
                            type="password" placeholder="Min 6 characters"
                            className="form-input" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={selectStyle}
                        />
                    </div>
                </div>

                {!isSuperAdmin && (
                    <>
                        <div className="form-row">
                            <div className="form-group flex-1">
                                <label>Workshop *</label>
                                <select
                                    className="form-input" value={workshopId}
                                    onChange={(e) => {
                                        setWorkshopId(e.target.value);
                                        setBranchId(''); setWorkshopRole('');
                                    }}
                                    style={selectStyle}
                                    disabled={loadingWs}
                                >
                                    <option value="">{loadingWs ? 'Loading workshops…' : 'Select workshop'}</option>
                                    {workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group flex-1">
                                <label>Branch *</label>
                                <select
                                    className="form-input" value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                    disabled={!workshopId || loadingBr}
                                    style={selectStyle}
                                >
                                    <option value="">{loadingBr ? 'Loading branches…' : 'Select branch'}</option>
                                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group flex-1">
                                <label>Workshop Role</label>
                                <select
                                    className="form-input" value={workshopRole}
                                    onChange={(e) => setWorkshopRole(e.target.value)}
                                    disabled={!branchId}
                                    style={selectStyle}
                                >
                                    <option value="">— None —</option>
                                    {WORKSHOP_ROLE_OPTIONS.map((r) => (
                                        <option key={r.id} value={r.id}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group flex-1" />
                        </div>
                    </>
                )}

                <div style={{
                    marginTop: 4, marginBottom: 12, padding: '10px 14px',
                    borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe',
                    fontSize: '0.8125rem', color: '#1e40af', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <Users size={14} /> Assign Role
                </div>

                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>Role *</label>
                        <select
                            className="form-input" value={assignRoleId}
                            onChange={(e) => setAssignRoleId(e.target.value)}
                            style={selectStyle}
                        >
                            <option value="">Select role</option>
                            {assignableRoles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name} · {r.permissionCount} permissions
                                </option>
                            ))}
                        </select>
                        {assignableRoles.length === 0 && (
                            <small style={{ color: '#92400e', fontSize: '0.7rem' }}>
                                No roles available for this scope. Create a role first.
                            </small>
                        )}
                    </div>
                    <div className="form-group flex-1" />
                </div>
            </div>
        </Modal>
    );
}

const selectStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.875rem',
};

function ToggleSwitch({ checked, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            style={{
                width: 48, height: 26, borderRadius: 999,
                border: 'none', cursor: 'pointer', padding: 0,
                background: checked ? '#7c3aed' : '#cbd5e1',
                position: 'relative', transition: 'background 0.18s',
            }}
        >
            <span
                style={{
                    position: 'absolute', top: 3, left: checked ? 24 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.18s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
            />
        </button>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Edit User Role Modal                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function EditUserRoleModal({ user, roles, onClose, onSave, saving }) {
    const [roleId, setRoleId] = useState(user.role?.id ?? '');
    const [resetPassword, setResetPassword] = useState('');
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
            alert('Password must be at least 6 characters');
            return;
        }
        if (needsWorkshopScope && (!workshopId || !branchId)) {
            alert('Workshop and branch are required for this portal');
            return;
        }
        const opts = {
            assignWallet,
            portal: selectedPortal,
        };
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
        <Modal
            title={`Edit user — ${user.name || user.email}`}
            onClose={onClose}
            className="create-role-modal"
            footer={(
                <div className="modal-footer-actions">
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn-submit" onClick={handleSubmit} disabled={saving || portalMismatch}>
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            )}
        >
            <div className="create-role-form">
                {/* Assign Wallet — available for any portal user */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 12,
                    border: `2px solid ${assignWallet ? '#d97706' : '#e2e8f0'}`,
                    background: assignWallet ? '#fffbeb' : '#fff',
                    marginBottom: 16, transition: 'all 0.15s',
                }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: assignWallet ? '#f59e0b' : '#f1f5f9',
                            color: assignWallet ? '#fff' : '#64748b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Wallet size={18} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9375rem' }}>Assign Wallet</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {user.walletEnabled
                                    ? 'SAR wallet is active — user can request funds and record expenses.'
                                    : 'Create a SAR wallet (0 balance) — user can request funds and record expenses later.'}
                            </div>
                        </div>
                    </div>
                    <ToggleSwitch checked={assignWallet} onChange={setAssignWallet} />
                </div>

                {/* User summary */}
                <div style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    padding: 14, borderRadius: 10,
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    marginBottom: 16,
                }}>
                    <div className="perm-user-avatar">
                        {(user.name || user.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{user.name || '—'}</div>
                        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{user.email || '—'}</div>
                        <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.75rem' }}>
                            <span style={portalPillStyle(selectedPortal)}>
                                {PORTALS.find((p) => p.id === selectedPortal)?.label ?? selectedPortal}
                            </span>
                            {user.workshopName && (
                                <span style={{ color: '#64748b' }}>· {user.workshopName}</span>
                            )}
                            {user.branchName && (
                                <span style={{ color: '#94a3b8' }}>/ {user.branchName}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Login portal assignment */}
                <div style={{
                    marginBottom: 14, padding: '12px 14px', borderRadius: 12,
                    border: '2px solid #e2e8f0', background: '#fff',
                }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9375rem', marginBottom: 8 }}>
                        Login portal
                    </div>
                    <div className="form-group">
                        <label>Assign portal *</label>
                        <select
                            className="form-input"
                            value={selectedPortal}
                            onChange={(e) => handlePortalChange(e.target.value)}
                            style={selectStyle}
                        >
                            {PORTALS.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.label} — {p.desc}
                                </option>
                            ))}
                        </select>
                        <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.45 }}>
                            {portalLoginHint(selectedPortal)}
                        </p>
                    </div>
                </div>

                {/* Current role */}
                <div style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: user.role ? '#eff6ff' : '#fef3c7',
                    border: `1px solid ${user.role ? '#bfdbfe' : '#fde68a'}`,
                    fontSize: '0.8125rem', marginBottom: 14, fontWeight: 600,
                    color: user.role ? '#1e40af' : '#92400e',
                }}>
                    Current role: <strong>{user.role?.name ?? 'No role assigned (legacy bypass)'}</strong>
                    {user.role && (
                        <span style={{ marginLeft: 8, opacity: 0.8 }}>
                            · {user.role.permissionCount} permissions · {user.role.portal} portal
                        </span>
                    )}
                </div>

                {/* Workshop + Branch — for workshop / cashier / technician portals */}
                {needsWorkshopScope && (
                    <>
                        <div style={{
                            marginTop: 4, marginBottom: 10, padding: '8px 12px',
                            borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0',
                            fontSize: '0.75rem', color: '#166534', fontWeight: 600,
                        }}>
                            Workshop scope — required for the selected portal login.
                        </div>
                        <div className="form-row">
                            <div className="form-group flex-1">
                                <label>Workshop *</label>
                                <select
                                    className="form-input"
                                    value={workshopId}
                                    onChange={(e) => {
                                        setWorkshopId(e.target.value);
                                        setBranchId(''); // reset branch when workshop changes
                                    }}
                                    style={selectStyle}
                                    disabled={loadingWs}
                                >
                                    <option value="">{loadingWs ? 'Loading workshops…' : '— None —'}</option>
                                    {workshops.map((w) => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group flex-1">
                                <label>Branch *</label>
                                <select
                                    className="form-input"
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                    disabled={!workshopId || loadingBr}
                                    style={selectStyle}
                                >
                                    <option value="">{loadingBr ? 'Loading branches…' : '— None —'}</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {selectedPortal === 'workshop' && (
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label>Workshop Role</label>
                                    <select
                                        className="form-input"
                                        value={workshopStaffRole}
                                        onChange={(e) => setWorkshopStaffRole(e.target.value)}
                                        style={selectStyle}
                                    >
                                        <option value="">— None —</option>
                                        {WORKSHOP_ROLE_OPTIONS.map((r) => (
                                            <option key={r.id} value={r.id}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group flex-1" />
                            </div>
                        )}
                    </>
                )}

                {/* Role selector */}
                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>Assign role</label>
                        <select
                            className="form-input"
                            value={roleId}
                            onChange={(e) => setRoleId(e.target.value)}
                            style={selectStyle}
                        >
                            <option value="">— No role (clear assignment) —</option>
                            {assignableRoles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name} · {r.permissionCount} permissions · ({r.portal})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>Reset password</label>
                        <input
                            type="password"
                            className="form-input"
                            autoComplete="new-password"
                            placeholder="Leave empty to keep current password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                        />
                        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                            Min 6 characters. Applies to this user&apos;s portal login.
                        </p>
                    </div>
                </div>

                {portalMismatch && (
                    <div style={{
                        marginTop: 10, padding: '10px 14px', borderRadius: 8,
                        background: '#fef3c7', border: '1px solid #fde68a',
                        fontSize: '0.8125rem', color: '#92400e',
                    }}>
                        <strong>⚠ Portal mismatch:</strong> this role is designed for the
                        <strong> {selectedRole.portal} </strong> portal but you selected
                        <strong> {selectedPortal} </strong>. Pick a matching role before saving.
                    </div>
                )}

                <div style={{
                    marginTop: 14, padding: '10px 14px', borderRadius: 8,
                    background: '#f1f5f9', fontSize: '0.75rem', color: '#64748b',
                }}>
                    💡 Tip — clear the role to revert this user to the legacy bypass
                    (they'll see everything their userType normally allows).
                    Changes take effect after the user logs out and back in.
                </div>
            </div>
        </Modal>
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
function UserPermissionsModal({ user, registryByPortal, loadRegistry, onClose, onSaved }) {
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
                setError(e?.message || 'Failed to load user permissions');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [user.id]);

    const portalTree = registryByPortal[portal] || COMING_SOON_TREE;
    const totalActions = useMemo(() => portalTree.reduce(
        (s, sec) => s + sec.tabs.reduce((c, t) => c + (t.actions?.length ?? 0), 0),
        0,
    ), [portalTree]);
    const selectedCount = useMemo(() => Object.values(perms).reduce(
        (s, m) => s + Object.values(m).filter(Boolean).length, 0,
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
        const flat = section.tabs.flatMap((t) => t.actions.map((a) => [t.key, a]));
        const allOn = flat.every(([k, a]) => perms[k]?.[a]);
        const next = { ...perms };
        for (const t of section.tabs) {
            next[t.key] = { ...(next[t.key] || {}) };
            for (const a of t.actions) next[t.key][a] = !allOn;
        }
        setPerms(next);
    };
    const selectAll = () => {
        const allOn = selectedCount === totalActions;
        const next = {};
        if (!allOn) {
            for (const sec of portalTree) for (const t of sec.tabs) {
                next[t.key] = {};
                for (const a of t.actions) next[t.key][a] = true;
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
            alert(e?.message || 'Could not save permissions');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm("Revert this user to the role's default permissions? Their custom overrides will be discarded.")) return;
        setSaving(true);
        try {
            await permissionsApi.clearUserPermissions(user.id);
            onSaved?.();
        } catch (e) {
            alert(e?.message || 'Could not reset permissions');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title={`Permissions — ${user.name || user.email}`}
            onClose={onClose}
            className="create-role-modal"
            footer={(
                <div className="modal-footer-actions">
                    {hasOverride && (
                        <button type="button" className="btn-secondary" onClick={handleReset} disabled={saving}>
                            Reset to role defaults
                        </button>
                    )}
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn-submit" onClick={handleSave} disabled={saving || loading}>
                        {saving ? 'Saving…' : 'Save Override'}
                    </button>
                </div>
            )}
        >
            <div className="create-role-form">
                {/* User + role summary */}
                <div style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    padding: 14, borderRadius: 10,
                    background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 14,
                }}>
                    <div className="perm-user-avatar">
                        {(user.name || user.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{user.name || '—'}</div>
                        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{user.email || '—'}</div>
                        <div style={{ marginTop: 4, fontSize: '0.75rem' }}>
                            <span style={portalPillStyle(portal)}>
                                {PORTALS.find((p) => p.id === portal)?.label ?? portal}
                            </span>
                            <span style={{ color: '#64748b', marginLeft: 6 }}>
                                · Role: <strong>{user.role?.name}</strong>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Mode banner */}
                <div style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: hasOverride ? '#faf5ff' : '#eff6ff',
                    border: `1px solid ${hasOverride ? '#e9d5ff' : '#bfdbfe'}`,
                    fontSize: '0.8125rem', marginBottom: 14, fontWeight: 600,
                    color: hasOverride ? '#6b21a8' : '#1e40af',
                }}>
                    {hasOverride
                        ? '🟣 Custom override is active — this user is using a hand-picked permission set.'
                        : '🔵 Using role defaults — saving below will create a custom override for this user only.'}
                </div>

                {error && (
                    <div style={{ marginBottom: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 10, background: '#f1f5f9',
                    border: '1px solid #e2e8f0', marginBottom: 14,
                }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                        {selectedCount} of {totalActions} permissions selected
                    </span>
                    <button type="button" className="btn-link" onClick={selectAll}>
                        {selectedCount === totalActions ? 'Deselect All' : 'Select All'}
                    </button>
                </div>

                {loading ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                        <Loader2 size={18} className="spin" /> Loading permissions…
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {portalTree.map((section) => (
                            <SectionPermissionsCard
                                key={section.section}
                                section={section}
                                perms={perms}
                                onToggleAction={toggleAction}
                                onToggleTab={toggleTabAll}
                                onToggleSection={() => toggleSectionAll(section)}
                            />
                        ))}
                    </div>
                )}

                <div style={{
                    marginTop: 14, padding: '10px 14px', borderRadius: 8,
                    background: '#f1f5f9', fontSize: '0.75rem', color: '#64748b',
                }}>
                    💡 Tip — saving here creates a per-user override. The role itself is
                    untouched, so other users assigned to <strong>{user.role?.name}</strong> are
                    unaffected. Changes take effect after the user logs out and back in.
                </div>
            </div>
        </Modal>
    );
}
