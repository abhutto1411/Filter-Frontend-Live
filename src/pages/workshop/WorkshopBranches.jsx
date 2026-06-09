import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Key, Plus, MapPin, Phone, Mail, Users, Edit, RefreshCw } from 'lucide-react';
import Modal from '../../components/Modal';
import { ShimmerCatalogGrid } from '../../components/supplier/Shimmer';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const BRANCH_TABS = [
    { id: 'branches', label: 'Branch Portals',     permission: 'workshop.branches.branch-portals.view' },
    { id: 'access',   label: 'Access Permissions', permission: 'workshop.branches.access-permissions.view' },
];
import {
    loadWorkshopEmployeesCombined,
    unwrapWorkshopBranchesResponse,
    isWorkshopPortalBranchInactive,
} from '../../services/workshopStaffApi';
import {
    BRANCH_PERMISSIONS,
    MOCK_ROLE_PERMISSIONS,
} from './constants';

function BranchFormModal({ branch, onClose, onSave, isSaving }) {
    // Prefer BE-canonical field names (branchCode/vatId/crNumber/contactPerson)
    // and fall back to the legacy snake_case keys for any older callers.
    const [form, setForm] = useState({
        name: branch?.name || '',
        code: branch?.branchCode ?? branch?.code ?? '',
        address: branch?.address || '',
        phone: branch?.phone || '',
        email: branch?.email || '',
        vat_id: branch?.vatId ?? branch?.vat_id ?? '',
        cr_no: branch?.crNumber ?? branch?.cr_no ?? '',
        contact_person: branch?.contactPerson ?? branch?.contact_person ?? '',
        status: branch?.status || (branch?.isActive === false ? 'inactive' : 'active'),
        gpsLat: branch?.gpsLat ?? '',
        gpsLng: branch?.gpsLng ?? '',
    });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const handleSave = () => { onSave?.({ ...form, id: branch?.id }); };
    return (
        <Modal title={branch?.id ? 'Edit Branch' : 'New Branch Portal'} onClose={isSaving ? () => {} : onClose} width="520px"
            footer={<>
                <button className="btn-portal-outline" onClick={onClose} disabled={isSaving}>Cancel</button>
                <button className="btn-portal" disabled={!form.name.trim() || isSaving} onClick={handleSave}>
                    {isSaving ? (branch?.id ? 'Updating...' : 'Creating...') : (branch?.id ? 'Update Branch' : 'Create Branch')}
                </button>
            </>}>
            <div style={{ fontSize: '0.875rem' }}>
                <p style={{ padding: '12px 14px', background: '#EFF6FF', borderRadius: 10, color: '#1E40AF', margin: '0 0 16px', fontSize: '0.75rem' }}>
                    Each branch gets its own <strong>Branch Portal</strong> and <strong>POS</strong>. The Workshop Owner Admin can grant Branch Admins access to permitted sections only.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Branch Name *</label>
                        <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Riyadh Main Branch" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/>
                    </div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Branch Code</label><input type="text" value={form.code} onChange={e => set('code', e.target.value)} placeholder="e.g. RYD-001" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Status</label><select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Phone</label><input type="text" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+966..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>GPS Latitude</label><input type="number" value={form.gpsLat} onChange={e => set('gpsLat', e.target.value)} placeholder="e.g. 24.7136" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>GPS Longitude</label><input type="number" value={form.gpsLng} onChange={e => set('gpsLng', e.target.value)} placeholder="e.g. 46.6753" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>VAT ID</label><input type="text" value={form.vat_id} onChange={e => set('vat_id', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>CR Number</label><input type="text" value={form.cr_no} onChange={e => set('cr_no', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Contact Person</label><input type="text" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Address</label><textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', resize: 'vertical' }}/></div>
                </div>
            </div>
        </Modal>
    );
}

function branchIsApprovedForAccess(branch) {
    const s = String(branch?.approvalStatus ?? '').toLowerCase();
    return s === '' || s === 'approved';
}

function branchOperationalActive(branch) {
    const s = String(branch?.status ?? '').toLowerCase();
    if (s === 'active') return true;
    if (s === 'inactive') return false;
    return branch?.isActive !== false;
}

function AccessPermissionFormModal({ branches, onClose, onSave }) {
    const [form, setForm] = useState({ branch_id: '', admin_name: '', admin_email: '', permissions: [] });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const selectableBranches = useMemo(
        () =>
            (branches || [])
                .filter((b) => !isWorkshopPortalBranchInactive(b))
                .filter(branchIsApprovedForAccess),
        [branches],
    );
    const togglePerm = (key) => setForm(f => ({ ...f, permissions: f.permissions.includes(key) ? f.permissions.filter(p => p !== key) : [...f.permissions, key] }));
    const handleSave = () => {
        const branch = branches?.find(b => b.id === form.branch_id);
        onSave?.({ branch_id: form.branch_id, admin_name: form.admin_name, admin_email: form.admin_email, permissions: form.permissions, branchName: branch?.name });
        onClose();
    };
    return (
        <Modal title="Grant Branch Admin Access" onClose={onClose} width="420px"
            footer={<>
                <button className="btn-portal-outline" onClick={onClose}>Cancel</button>
                <button className="btn-portal" disabled={!form.branch_id || form.permissions.length === 0} onClick={handleSave}>Grant Access</button>
            </>}>
            <div style={{ fontSize: '0.875rem' }}>
                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Branch *</label>
                    <select value={form.branch_id} onChange={e => set('branch_id', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                        <option value="">Select branch</option>
                        {selectableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {selectableBranches.length === 0 && (branches || []).length > 0 && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#B45309' }}>
                            No approved branches yet. Super admin must approve a branch before you can assign branch admin access here.
                        </p>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Admin Name</label><input type="text" value={form.admin_name} onChange={e => set('admin_name', e.target.value)} placeholder="Full name" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Admin Email</label><input type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="admin@branch.com" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                </div>
                <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Permitted Sections</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {BRANCH_PERMISSIONS.map(p => {
                            const Icon = p.icon;
                            const checked = form.permissions.includes(p.key);
                            return (
                                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${checked ? '#3B82F6' : 'var(--color-border)'}`, background: checked ? '#EFF6FF' : '#fff', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <input type="checkbox" checked={checked} onChange={() => togglePerm(p.key)}/>
                                    <Icon size={16} style={{ color: checked ? '#2563EB' : 'var(--color-text-muted)' }}/>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: checked ? 600 : 500, color: checked ? '#1E40AF' : 'var(--color-text-body)' }}>{p.label}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export default function WorkshopBranches({ selectedBranchId = 'all' }) {
    const { hasPermission } = useAuth();
    const visibleBranchTabs = BRANCH_TABS.filter((t) => hasPermission(t.permission));
    const [branches, setBranches] = useState([]);
    const [rolePermissions, setRolePermissions] = useState(MOCK_ROLE_PERMISSIONS);
    const [activeTab, setActiveTab] = useState(() => visibleBranchTabs[0]?.id ?? 'branches');

    useEffect(() => {
        if (visibleBranchTabs.length === 0) return;
        if (!visibleBranchTabs.some((t) => t.id === activeTab)) {
            setActiveTab(visibleBranchTabs[0].id);
        }
    }, [visibleBranchTabs, activeTab]);
    const [showBranchForm, setShowBranchForm] = useState(false);
    const [editBranch, setEditBranch] = useState(null);
    const [showAccessForm, setShowAccessForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [isSavingBranch, setIsSavingBranch] = useState(false);
    const [togglingBranchId, setTogglingBranchId] = useState(null);
    const [employees, setEmployees] = useState([]);
    const getBranchPerm = (branchId) => rolePermissions.find(r => r.role_name === `branch_admin_${branchId}`);

    const visibleBranches = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return branches;
        return branches.filter((b) => String(b.id) === String(selectedBranchId));
    }, [branches, selectedBranchId]);

    /**
     * Map of `branchId → number of employees` built from a single workshop-wide
     * employees fetch. This is what feeds the per-branch "X employees" tag on
     * each card. Falls back to matching by branch name if the row only carries
     * a name (older API rows).
     */
    const employeeCountByBranch = useMemo(() => {
        const byId = new Map();
        const byName = new Map();
        for (const e of employees) {
            if (e.branchId) byId.set(String(e.branchId), (byId.get(String(e.branchId)) || 0) + 1);
            else if (e.branch) byName.set(e.branch, (byName.get(e.branch) || 0) + 1);
        }
        return { byId, byName };
    }, [employees]);

    const countEmployees = (branch) =>
        employeeCountByBranch.byId.get(String(branch.id)) ??
        employeeCountByBranch.byName.get(branch.name) ??
        0;

    const loadBranches = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const response = await apiFetch('/workshop-staff/branches');
            const rawList = unwrapWorkshopBranchesResponse(response);
            if (response?.success === false && rawList.length === 0) {
                throw new Error(response.message || 'Invalid branches response.');
            }
            // Mirror the BE-canonical keys onto a few legacy aliases the rest
            // of the page already reads (status, code) so we don't have to
            // rewrite every consumer downstream.
            setBranches(
                rawList.map((branch) => ({
                    ...branch,
                    id: branch.id ?? branch._id,
                    name: branch.name ?? branch.branchName ?? 'Branch',
                    status: branch.status || (branch.isActive ? 'active' : 'inactive'),
                    code: branch.branchCode ?? branch.code ?? '',
                    approvalStatus: branch.approvalStatus ?? branch.approval_status ?? null,
                    approvalRequestedAt: branch.approvalRequestedAt ?? branch.approval_requested_at ?? null,
                })),
            );
        } catch (error) {
            setLoadError(error.message || 'Failed to load branches.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    // Pull the workshop-wide staff list once so every branch card can show a
    // real "N employees" count. Failures are swallowed — we just fall back to
    // 0 rather than blocking the page.
    const loadEmployeesCount = useCallback(async () => {
        try {
            const params =
                selectedBranchId && selectedBranchId !== 'all' ? { branchId: String(selectedBranchId) } : {};
            const { employees: rows } = await loadWorkshopEmployeesCombined(params);
            setEmployees(Array.isArray(rows) ? rows : []);
        } catch {
            setEmployees([]);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadEmployeesCount();
    }, [loadEmployeesCount]);

    /**
     * Build the BE payload from the form state. The BE accepts every key as
     * optional (except `name` on create) and treats empty strings or null as
     * "clear this column". GPS values accept either numbers or numeric
     * strings, and `status` is mapped to `isActive` server-side.
     */
    const buildBranchPayload = (data) => {
        const trim = (v) => (typeof v === 'string' ? v.trim() : v);
        const optStr = (v) => {
            const t = trim(v);
            return t === '' || t == null ? null : t;
        };
        const optNum = (v) => {
            if (v === '' || v == null) return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        };
        const active = data.status !== 'inactive';
        return {
            name: trim(data.name) || '',
            branchCode: optStr(data.code),
            status: active ? 'active' : 'inactive',
            isActive: active,
            phone: optStr(data.phone),
            email: optStr(data.email),
            gpsLat: optNum(data.gpsLat),
            gpsLng: optNum(data.gpsLng),
            vatId: optStr(data.vat_id),
            crNumber: optStr(data.cr_no),
            contactPerson: optStr(data.contact_person),
            address: optStr(data.address),
        };
    };

    const handleBranchActiveToggle = async (branch, nextActive) => {
        if (togglingBranchId != null) return;
        setTogglingBranchId(String(branch.id));
        setLoadError('');
        const prev = branches;
        setBranches((rows) =>
            rows.map((b) =>
                String(b.id) === String(branch.id)
                    ? {
                          ...b,
                          status: nextActive ? 'active' : 'inactive',
                          isActive: nextActive,
                      }
                    : b,
            ),
        );
        try {
            await apiFetch(`/workshop-staff/branch/${encodeURIComponent(branch.id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ isActive: nextActive }),
            });
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('workshop-branches-changed'));
            }
        } catch (error) {
            setBranches(prev);
            setLoadError(error.message || 'Failed to update branch status.');
        } finally {
            setTogglingBranchId(null);
        }
    };

    const handleBranchSave = async (data) => {
        if (!data.name?.trim()) {
            setLoadError('Branch name is required.');
            return;
        }

        setIsSavingBranch(true);
        setLoadError('');
        try {
            const payload = buildBranchPayload(data);
            if (data.id) {
                await apiFetch(`/workshop-staff/branch/${encodeURIComponent(data.id)}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
            } else {
                await apiFetch('/workshop-staff/branch/create', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
            }
            await loadBranches();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('workshop-branches-changed'));
            }
            setShowBranchForm(false);
            setEditBranch(null);
        } catch (error) {
            setLoadError(error.message || (data.id ? 'Failed to update branch.' : 'Failed to create branch.'));
        } finally {
            setIsSavingBranch(false);
        }
    };
    const handleAccessSave = (data) => {
        setRolePermissions(prev => [...prev, {
            id: Date.now(), role_name: `branch_admin_${data.branch_id}`,
            permissions: data.permissions,
            description: `Branch Admin: ${data.admin_name || '—'} (${data.admin_email || '—'}) — ${data.branchName || '—'}`,
        }]);
    };

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Branches & Access Control</h2><p className="ws-page-sub">Manage branch portals and grant Branch Admin permissions{selectedBranchId && selectedBranchId !== 'all' ? ` · filtered to one branch` : ''}</p></div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-portal-outline" onClick={() => { loadBranches(); loadEmployeesCount(); }} disabled={isLoading}><RefreshCw size={15}/>{isLoading ? 'Refreshing...' : 'Refresh'}</button>
                    {hasPermission('workshop.branches.access-permissions.edit') && (
                        <button className="btn-portal-outline" onClick={() => setShowAccessForm(true)}><Key size={15}/> Grant Access</button>
                    )}
                    {hasPermission('workshop.branches.branch-portals.view') && hasPermission('workshop.branches.access-permissions.edit') && (
                        <button className="btn-portal" onClick={() => { setEditBranch(null); setShowBranchForm(true); }} disabled={isSavingBranch}>
                            <Plus size={15}/> {isSavingBranch ? 'Creating...' : 'New Branch'}
                        </button>
                    )}
                </div>
            </div>
            {loadError && (
                <div style={{ marginBottom: 16, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: '0.875rem' }}>
                    {loadError}
                </div>
            )}
            <div className="ws-branches-tabs">
                {visibleBranchTabs.map((t) => (
                    <button
                        key={t.id}
                        className={`ws-branches-tab ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'branches' && (
                isLoading && branches.length === 0 ? (
                    <ShimmerCatalogGrid cards={4} />
                ) : branches.length === 0 ? (
                    <div className="ws-empty">
                        <Building2 size={48} className="ws-empty-icon"/>
                        <p className="ws-empty-text" style={{ fontWeight: 600 }}>No branches yet. Create your first branch portal.</p>
                    </div>
                ) : visibleBranches.length === 0 ? (
                    <div className="ws-empty">
                        <Building2 size={48} className="ws-empty-icon"/>
                        <p className="ws-empty-text" style={{ fontWeight: 600 }}>No branch matches the current sidebar filter.</p>
                    </div>
                ) : (
                    <div className="ws-branches-grid">
                        {visibleBranches.map(branch => {
                            const perm = getBranchPerm(branch.id);
                            const empCount = countEmployees(branch);
                            const approvalSt = String(branch.approvalStatus ?? '').toLowerCase();
                            const pendingSuperAdmin = approvalSt === 'pending';
                            return (
                                <div key={branch.id} className="ws-branch-card">
                                    <div className="ws-branch-card-body">
                                        <div className="ws-branch-header">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div className="ws-branch-icon-wrap"><Building2 size={20}/></div>
                                                <div>
                                                    <p className="ws-branch-name">{branch.name}</p>
                                                    {branch.code && <p className="ws-branch-code">{branch.code}</p>}
                                                </div>
                                            </div>
                                            {pendingSuperAdmin ? (
                                                <span
                                                    className="ws-branch-badge-active ws-branch-badge--pending-approval"
                                                    title="Super admin must approve this branch before it is fully active."
                                                >
                                                    Pending approval
                                                </span>
                                            ) : (
                                                <div
                                                    className="ws-branch-active-toggle"
                                                    title={branchOperationalActive(branch) ? 'Branch portal is active' : 'Branch portal is inactive'}
                                                >
                                                    <span
                                                        className={`ws-branch-active-toggle-label ${!branchOperationalActive(branch) ? 'is-on' : ''}`}
                                                    >
                                                        Inactive
                                                    </span>
                                                    <label
                                                        className={`ws-duty-toggle ${togglingBranchId != null ? 'ws-duty-toggle--disabled' : ''}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={branchOperationalActive(branch)}
                                                            disabled={togglingBranchId != null}
                                                            onChange={(e) =>
                                                                handleBranchActiveToggle(branch, e.target.checked)
                                                            }
                                                        />
                                                        <span className="ws-toggle-slider" />
                                                    </label>
                                                    <span
                                                        className={`ws-branch-active-toggle-label ${branchOperationalActive(branch) ? 'is-on' : ''}`}
                                                    >
                                                        Active
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {pendingSuperAdmin && (
                                            <p className="ws-branch-pending-note">
                                                Awaiting super admin approval. Cashiers and technicians require an approved branch.
                                            </p>
                                        )}
                                        <div className="ws-branch-contact">
                                            {branch.address && <div className="ws-branch-contact-row"><MapPin size={14}/><span>{branch.address}</span></div>}
                                            {branch.phone && <div className="ws-branch-contact-row"><Phone size={14}/><span>{branch.phone}</span></div>}
                                            {branch.email && <div className="ws-branch-contact-row"><Mail size={14}/><span>{branch.email}</span></div>}
                                        </div>
                                        <div className="ws-branch-emp-row">
                                            <Users size={16}/>
                                            <span>{empCount} employees</span>
                                            <span className={`ws-branch-admin-badge ${perm ? 'set' : 'none'}`}>{perm ? 'Admin set' : 'No admin'}</span>
                                        </div>
                                        {perm && (perm.permissions || []).length > 0 && (
                                            <div className="ws-branch-perms">
                                                {(perm.permissions || []).map(p => <span key={p} className="ws-branch-perm-tag">{p}</span>)}
                                            </div>
                                        )}
                                        <div className="ws-branch-actions">
                                            <button type="button" className="ws-branch-btn-edit" onClick={() => { setEditBranch(branch); setShowBranchForm(true); }}><Edit size={14}/> Edit</button>
                                            <button type="button" className="ws-branch-btn-access" onClick={() => setShowAccessForm(true)}><Key size={14}/> Set Access</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {activeTab === 'access' && (
                <div className="ws-section">
                    {rolePermissions
                        .filter(r => r.role_name?.startsWith('branch_admin_'))
                        .filter((r) => {
                            if (!selectedBranchId || selectedBranchId === 'all') return true;
                            const bid = r.role_name.replace('branch_admin_', '');
                            return String(bid) === String(selectedBranchId);
                        }).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
                            <Key size={48} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }}/>
                            <p style={{ margin: '0 0 16px', fontWeight: 600 }}>No branch admin access configured yet.</p>
                            <button className="btn-portal" style={{ background: '#D97706', color: '#fff' }} onClick={() => setShowAccessForm(true)}><Key size={15}/> Grant Branch Access</button>
                        </div>
                    ) : (
                        <table className="ws-table">
                            <thead><tr><th>Branch</th><th>Permitted Sections</th><th>Description</th></tr></thead>
                            <tbody>
                                {rolePermissions
                                    .filter(r => r.role_name?.startsWith('branch_admin_'))
                                    .filter((r) => {
                                        if (!selectedBranchId || selectedBranchId === 'all') return true;
                                        const bid = r.role_name.replace('branch_admin_', '');
                                        return String(bid) === String(selectedBranchId);
                                    })
                                    .map(rp => {
                                    const branchId = rp.role_name.replace('branch_admin_', '');
                                    const branch = branches.find(b => b.id === branchId);
                                    return (
                                        <tr key={rp.id}><td style={{ fontWeight: 700 }}>{branch?.name || branchId}</td>
                                            <td><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(rp.permissions || []).map(p => <span key={p} className="ws-badge ws-badge--blue">{p}</span>)}</div></td>
                                            <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{rp.description}</td></tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {showBranchForm && <BranchFormModal branch={editBranch} isSaving={isSavingBranch} onClose={() => { setShowBranchForm(false); setEditBranch(null); }} onSave={handleBranchSave}/>}
            {showAccessForm && <AccessPermissionFormModal branches={branches} onClose={() => setShowAccessForm(false)} onSave={handleAccessSave}/>}
        </div>
    );
}
