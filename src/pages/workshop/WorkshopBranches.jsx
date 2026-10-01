import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Key, Plus, MapPin, Phone, Mail, Users, Edit, RefreshCw } from 'lucide-react';
import Modal from '../../components/Modal';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { ShimmerCatalogGrid } from '../../components/supplier/Shimmer';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { wbrT } from '../../utils/workshopBranchesI18n';

const BRANCH_TABS = [
    { id: 'branches', labelKey: 'tab.branches', permission: 'workshop.branches.branch-portals.view' },
    { id: 'access',   labelKey: 'tab.access',   permission: 'workshop.branches.access-permissions.view' },
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

function BranchFormModal({ branch, onClose, onSave, isSaving, t }) {
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
        egs_serial: branch?.egsSerial ?? branch?.egs_serial ?? '',
        contact_person: branch?.contactPerson ?? branch?.contact_person ?? '',
        status: branch?.status || (branch?.isActive === false ? 'inactive' : 'active'),
        gpsLat: branch?.gpsLat ?? '',
        gpsLng: branch?.gpsLng ?? '',
    });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const handleSave = () => { onSave?.({ ...form, id: branch?.id }); };
    return (
        <Modal title={branch?.id ? t('form.editTitle') : t('form.newTitle')} onClose={isSaving ? () => {} : onClose} width="560px"
            footer={<>
                <button className="btn-portal-outline" onClick={onClose} disabled={isSaving}>{t('btn.cancel')}</button>
                <button className="btn-portal" disabled={!form.name.trim() || isSaving} onClick={handleSave}>
                    {isSaving
                        ? (branch?.id ? t('btn.updating') : t('btn.creating'))
                        : (branch?.id ? t('btn.updateBranch') : t('btn.createBranch'))}
                </button>
            </>}>
            <div style={{ fontSize: '0.875rem' }}>
                <p style={{ padding: '12px 14px', background: '#EFF6FF', borderRadius: 10, color: '#1E40AF', margin: '0 0 16px', fontSize: '0.75rem' }}>
                    {t('form.intro.before')}<strong>{t('form.intro.portal')}</strong>{t('form.intro.mid')}<strong>{t('form.intro.pos')}</strong>{t('form.intro.after')}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.branchName')}</label>
                        <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('form.branchNamePh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/>
                    </div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.branchCode')}</label><input type="text" value={form.code} onChange={e => set('code', e.target.value)} placeholder={t('form.branchCodePh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.status')}</label><select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}><option value="active">{t('status.active')}</option><option value="inactive">{t('status.inactive')}</option></select></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.phone')}</label><input type="text" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder={t('form.phonePh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.email')}</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.gpsLat')}</label><input type="number" value={form.gpsLat} onChange={e => set('gpsLat', e.target.value)} placeholder={t('form.gpsLatPh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.gpsLng')}</label><input type="number" value={form.gpsLng} onChange={e => set('gpsLng', e.target.value)} placeholder={t('form.gpsLngPh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.contactPerson')}</label><input type="text" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                </div>

                <div style={{ marginTop: 18, padding: 14, borderRadius: 10, border: '1px solid #BFDBFE', background: '#F8FAFC' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1E40AF' }}>
                        {t('form.zatcaSection')}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.vatId')}</label>
                            <input type="text" value={form.vat_id} onChange={e => set('vat_id', e.target.value)} placeholder={t('form.vatIdPh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff' }}/>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.crNumber')}</label>
                            <input type="text" value={form.cr_no} onChange={e => set('cr_no', e.target.value)} placeholder={t('form.crNumberPh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff' }}/>
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.egsSerial')}</label>
                            <input type="text" value={form.egs_serial} onChange={e => set('egs_serial', e.target.value)} placeholder={t('form.egsSerialPh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff' }}/>
                            <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                {t('form.egsHelp.before')}<code>1-Filter|2-EGS|3-branch-01</code>
                            </p>
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('form.address')}</label>
                            <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} placeholder={t('form.addressPh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', resize: 'vertical', background: '#fff' }}/>
                        </div>
                    </div>
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

function AccessPermissionFormModal({ branches, onClose, onSave, t }) {
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
        <Modal title={t('access.title')} onClose={onClose} width="420px"
            footer={<>
                <button className="btn-portal-outline" onClick={onClose}>{t('btn.cancel')}</button>
                <button className="btn-portal" disabled={!form.branch_id || form.permissions.length === 0} onClick={handleSave}>{t('btn.grantAccess')}</button>
            </>}>
            <div style={{ fontSize: '0.875rem' }}>
                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('access.branch')}</label>
                    <select value={form.branch_id} onChange={e => set('branch_id', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                        <option value="">{t('access.selectBranch')}</option>
                        {selectableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {selectableBranches.length === 0 && (branches || []).length > 0 && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#B45309' }}>
                            {t('access.noApproved')}
                        </p>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('access.adminName')}</label><input type="text" value={form.admin_name} onChange={e => set('admin_name', e.target.value)} placeholder={t('access.adminNamePh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('access.adminEmail')}</label><input type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder={t('access.adminEmailPh')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                </div>
                <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>{t('access.permittedSections')}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {BRANCH_PERMISSIONS.map(p => {
                            const Icon = p.icon;
                            const checked = form.permissions.includes(p.key);
                            return (
                                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${checked ? '#3B82F6' : 'var(--color-border)'}`, background: checked ? '#EFF6FF' : '#fff', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <input type="checkbox" checked={checked} onChange={() => togglePerm(p.key)}/>
                                    <Icon size={16} style={{ color: checked ? '#2563EB' : 'var(--color-text-muted)' }}/>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: checked ? 600 : 500, color: checked ? '#1E40AF' : 'var(--color-text-body)' }}>{t(`perm.${p.key}`)}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export default function WorkshopBranches({ selectedBranchId = 'all', locale: localeProp }) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wbrT(locale, key, vars), [locale]);
    const { hasPermission } = useAuth();
    const visibleBranchTabs = BRANCH_TABS.filter((tab) => hasPermission(tab.permission));
    const [branches, setBranches] = useState([]);
    const [rolePermissions, setRolePermissions] = useState(MOCK_ROLE_PERMISSIONS);
    const [activeTab, setActiveTab] = useState(() => visibleBranchTabs[0]?.id ?? 'branches');

    useEffect(() => {
        if (visibleBranchTabs.length === 0) return;
        if (!visibleBranchTabs.some((tab) => tab.id === activeTab)) {
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
                throw new Error(response.message || t('err.invalidResponse'));
            }
            // Mirror the BE-canonical keys onto a few legacy aliases the rest
            // of the page already reads (status, code) so we don't have to
            // rewrite every consumer downstream.
            setBranches(
                rawList.map((branch) => ({
                    ...branch,
                    id: branch.id ?? branch._id,
                    name: branch.name ?? branch.branchName ?? t('fallback.branch'),
                    status: branch.status || (branch.isActive ? 'active' : 'inactive'),
                    code: branch.branchCode ?? branch.code ?? '',
                    approvalStatus: branch.approvalStatus ?? branch.approval_status ?? null,
                    approvalRequestedAt: branch.approvalRequestedAt ?? branch.approval_requested_at ?? null,
                })),
            );
        } catch (error) {
            setLoadError(error.message || t('err.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

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
            egsSerial: optStr(data.egs_serial),
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
            setLoadError(error.message || t('err.updateStatus'));
        } finally {
            setTogglingBranchId(null);
        }
    };

    const handleBranchSave = async (data) => {
        if (!data.name?.trim()) {
            setLoadError(t('err.nameRequired'));
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
            setLoadError(error.message || (data.id ? t('err.updateFailed') : t('err.createFailed')));
        } finally {
            setIsSavingBranch(false);
        }
    };
    const handleAccessSave = (data) => {
        setRolePermissions(prev => [...prev, {
            id: Date.now(), role_name: `branch_admin_${data.branch_id}`,
            permissions: data.permissions,
            description: t('access.desc', {
                name: data.admin_name || t('emdash'),
                email: data.admin_email || t('emdash'),
                branch: data.branchName || t('emdash'),
            }),
        }]);
    };

    const permLabel = (key) => {
        const translated = t(`perm.${key}`);
        return translated === `perm.${key}` ? key : translated;
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">
                        {t('page.subtitle')}
                        {selectedBranchId && selectedBranchId !== 'all' ? t('page.subtitleFiltered') : ''}
                    </p>
                </div>
                <div className="ws-page-header-actions">
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => { loadBranches(); loadEmployeesCount(); }}
                        disabled={isLoading}
                    >
                        <RefreshCw size={15} />
                        {isLoading ? t('btn.refreshing') : t('btn.refresh')}
                    </button>
                    {hasPermission('workshop.branches.access-permissions.edit') && (
                        <button type="button" className="btn-portal-outline" onClick={() => setShowAccessForm(true)}>
                            <Key size={15} />
                            {t('btn.grantAccess')}
                        </button>
                    )}
                    {hasPermission('workshop.branches.branch-portals.view') && hasPermission('workshop.branches.access-permissions.edit') && (
                        <button
                            type="button"
                            className="btn-portal"
                            onClick={() => { setEditBranch(null); setShowBranchForm(true); }}
                            disabled={isSavingBranch}
                        >
                            <Plus size={15} />
                            {isSavingBranch ? t('btn.creating') : t('btn.newBranch')}
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
                {visibleBranchTabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`ws-branches-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {t(tab.labelKey)}
                    </button>
                ))}
            </div>

            {activeTab === 'branches' && (
                isLoading && branches.length === 0 ? (
                    <ShimmerCatalogGrid cards={4} />
                ) : branches.length === 0 ? (
                    <div className="ws-empty">
                        <Building2 size={48} className="ws-empty-icon"/>
                        <p className="ws-empty-text" style={{ fontWeight: 600 }}>{t('empty.noBranches')}</p>
                    </div>
                ) : visibleBranches.length === 0 ? (
                    <div className="ws-empty">
                        <Building2 size={48} className="ws-empty-icon"/>
                        <p className="ws-empty-text" style={{ fontWeight: 600 }}>{t('empty.noMatch')}</p>
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
                                                    title={t('tip.pendingApproval')}
                                                >
                                                    {t('badge.pendingApproval')}
                                                </span>
                                            ) : (
                                                <div
                                                    className="ws-branch-active-toggle"
                                                    title={branchOperationalActive(branch) ? t('tip.portalActive') : t('tip.portalInactive')}
                                                >
                                                    <span
                                                        className={`ws-branch-active-toggle-label ${!branchOperationalActive(branch) ? 'is-on' : ''}`}
                                                    >
                                                        {t('status.inactive')}
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
                                                        {t('status.active')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {pendingSuperAdmin && (
                                            <p className="ws-branch-pending-note">
                                                {t('note.pending')}
                                            </p>
                                        )}
                                        <div className="ws-branch-contact">
                                            {branch.address && <div className="ws-branch-contact-row"><MapPin size={14}/><span>{branch.address}</span></div>}
                                            {branch.phone && <div className="ws-branch-contact-row"><Phone size={14}/><span>{branch.phone}</span></div>}
                                            {branch.email && <div className="ws-branch-contact-row"><Mail size={14}/><span>{branch.email}</span></div>}
                                        </div>
                                        <div className="ws-branch-emp-row">
                                            <Users size={16}/>
                                            <span>{t('employees.count', { count: empCount })}</span>
                                            <span className={`ws-branch-admin-badge ${perm ? 'set' : 'none'}`}>{perm ? t('admin.set') : t('admin.none')}</span>
                                        </div>
                                        {perm && (perm.permissions || []).length > 0 && (
                                            <div className="ws-branch-perms">
                                                {(perm.permissions || []).map(p => <span key={p} className="ws-branch-perm-tag">{permLabel(p)}</span>)}
                                            </div>
                                        )}
                                        <div className="ws-branch-actions">
                                            <button type="button" className="ws-branch-btn-edit" onClick={() => { setEditBranch(branch); setShowBranchForm(true); }}><Edit size={14}/> {t('btn.edit')}</button>
                                            <button type="button" className="ws-branch-btn-access" onClick={() => setShowAccessForm(true)}><Key size={14}/> {t('btn.setAccess')}</button>
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
                            <p style={{ margin: '0 0 16px', fontWeight: 600 }}>{t('empty.noAccess')}</p>
                            <button className="btn-portal" style={{ background: '#D97706', color: '#fff' }} onClick={() => setShowAccessForm(true)}><Key size={15}/> {t('btn.grantBranchAccess')}</button>
                        </div>
                    ) : (
                        <WsTableScroll>
                        <table className="ws-table">
                            <thead><tr><th>{t('th.branch')}</th><th>{t('th.permittedSections')}</th><th>{t('th.description')}</th></tr></thead>
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
                                            <td><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(rp.permissions || []).map(p => <span key={p} className="ws-badge ws-badge--blue">{permLabel(p)}</span>)}</div></td>
                                            <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{rp.description}</td></tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </WsTableScroll>
                    )}
                </div>
            )}

            {showBranchForm && <BranchFormModal branch={editBranch} isSaving={isSavingBranch} onClose={() => { setShowBranchForm(false); setEditBranch(null); }} onSave={handleBranchSave} t={t}/>}
            {showAccessForm && <AccessPermissionFormModal branches={branches} onClose={() => setShowAccessForm(false)} onSave={handleAccessSave} t={t}/>}
        </div>
    );
}
