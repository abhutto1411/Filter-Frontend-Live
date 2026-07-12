import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Building2, FileText, Lock, Mail, Pencil, Phone, Plus, RefreshCw, Store, User, UserPlus, ToggleLeft,
} from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import Modal from '../../components/Modal';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';
import { apiFetch } from '../../services/api';
import {
    getWorkshopCorporateCustomers,
    postCorporateRegister,
    workshopCorporateCustomersParams,
    filterPortalVisibleBranches,
} from '../../services/workshopStaffApi';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const statusBadgeClass = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'active') return 'ws-badge--green';
    if (normalized === 'pending') return 'ws-badge--yellow';
    if (normalized === 'rejected') return 'ws-badge--red';
    return 'ws-badge--gray';
};

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'rejected', label: 'Rejected' },
];

function buildEditForm(row) {
    const person = (row.contactPerson || row.customer?.name || '').trim() || (row.customer?.name || '');
    return {
        companyName: row.companyName || '',
        customerName: person,
        contactPerson: person,
        mobile: row.customer?.mobile || '',
        taxId: row.customer?.taxId || row.customer?.vatNumber || '',
        crNumber: row.customer?.crNumber || '',
        status: String(row.status || 'active').toLowerCase(),
        selectedBranchIds: (row.selectedBranchIds || []).map((id) => String(id)),
    };
}

function FieldRow({ icon: Icon, label, children }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F3F4F6', borderRadius: 10, padding: '10px 12px', border: '1px solid transparent' }}>
                {Icon && <Icon size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
            </div>
        </div>
    );
}

function sameIdSet(a, b) {
    const sa = [...a].map(String).sort().join(',');
    const sb = [...b].map(String).sort().join(',');
    return sa === sb;
}

function buildPatchBody(form, initial) {
    const body = {};
    if (form.companyName.trim() !== initial.companyName) body.companyName = form.companyName.trim();
    if (form.customerName.trim() !== initial.customerName) body.customerName = form.customerName.trim();
    if (form.contactPerson.trim() !== initial.contactPerson) body.contactPerson = form.contactPerson.trim();
    if (form.mobile.trim() !== initial.mobile) body.mobile = form.mobile.trim();
    if (form.taxId.trim() !== initial.taxId) body.taxId = form.taxId.trim();
    if (form.crNumber.trim() !== initial.crNumber) body.crNumber = form.crNumber.trim();
    if (form.status !== initial.status) body.status = form.status;
    if (!sameIdSet(form.selectedBranchIds, initial.selectedBranchIds)) {
        body.selectedBranchIds = form.selectedBranchIds;
    }
    return body;
}

function EditCorporateAccountModal({ row, branches, onClose, onSaved }) {
    const [form, setForm] = useState(() => buildEditForm(row));
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const initialRef = useRef(buildEditForm(row));

    useEffect(() => {
        const next = buildEditForm(row);
        setForm(next);
        initialRef.current = next;
        setSaveError('');
    }, [row]);

    const setPersonName = (v) => {
        setForm((f) => ({ ...f, customerName: v, contactPerson: v }));
    };

    const toggleBranch = (branchId) => {
        const sid = String(branchId);
        setForm((f) => {
            const has = f.selectedBranchIds.includes(sid);
            return {
                ...f,
                selectedBranchIds: has
                    ? f.selectedBranchIds.filter((x) => x !== sid)
                    : [...f.selectedBranchIds, sid],
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveError('');
        try {
            const body = buildPatchBody(form, initialRef.current);
            if (Object.keys(body).length === 0) {
                setSaveError('No changes to save.');
                return;
            }
            await apiFetch(`/workshop-staff/corporate-account/${row.id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
            onSaved?.();
            onClose();
        } catch (e) {
            setSaveError(e.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title="Edit Corporate Account"
            onClose={onClose}
            width="520px"
            footer={
                <>
                    <button type="button" className="btn-portal-outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button type="button" className="btn-portal" onClick={handleSave} disabled={saving || !form.companyName.trim()}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </>
            }
        >
            <div style={{ fontSize: '0.875rem' }}>
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    Update the details below. Only changed fields will be sent.
                </p>
                {saveError && (
                    <p style={{ margin: '0 0 12px', color: '#B91C1C', fontSize: '0.8125rem' }}>{saveError}</p>
                )}

                <FieldRow icon={Building2} label="Company Name">
                    <input
                        type="text"
                        value={form.companyName}
                        onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={User} label="Customer Name">
                    <input
                        type="text"
                        value={form.customerName}
                        onChange={(e) => setPersonName(e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Phone} label="Mobile">
                    <input
                        type="text"
                        value={form.mobile}
                        onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={FileText} label="Tax ID (VAT)">
                    <input
                        type="text"
                        value={form.taxId}
                        onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={FileText} label="CR number">
                    <input
                        type="text"
                        value={form.crNumber}
                        onChange={(e) => setForm((f) => ({ ...f, crNumber: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={ToggleLeft} label="Status">
                    <select
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                        {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </FieldRow>

                <div style={{ marginTop: 8, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.875rem' }}>
                        <Store size={18} style={{ color: 'var(--color-text-muted)' }} />
                        Select Branches
                    </div>
                    <span className="ws-nav-badge--yellow" style={{ fontSize: '0.6875rem' }}>
                        {form.selectedBranchIds.length} selected
                    </span>
                </div>
                <div
                    style={{
                        maxHeight: 220,
                        overflowY: 'auto',
                        border: '1px solid var(--color-border)',
                        borderRadius: 10,
                        padding: 8,
                        background: '#fff',
                    }}
                >
                    {branches.length === 0 ? (
                        <p style={{ margin: 12, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                            No branches loaded. Refresh the page or add branches first.
                        </p>
                    ) : (
                        branches.map((b) => {
                            const idStr = String(b.id);
                            const checked = form.selectedBranchIds.includes(idStr);
                            return (
                                <label
                                    key={idStr}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 10,
                                        padding: '10px 8px',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        background: checked ? 'rgba(255,214,0,0.12)' : 'transparent',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleBranch(b.id)}
                                        style={{ marginTop: 3 }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{b.name || idStr}</div>
                                        {b.address ? (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{b.address}</div>
                                        ) : null}
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
}

function parseCorporateCustomersResponse(response) {
    if (response == null || typeof response !== 'object') return { list: [], total: 0 };
    const list =
        response.corporateCustomers ??
        response.corporate_customers ??
        response.data?.corporateCustomers ??
        response.data?.corporate_customers ??
        (Array.isArray(response.data) ? response.data : null) ??
        (Array.isArray(response.items) ? response.items : null) ??
        [];
    const arr = Array.isArray(list) ? list : [];
    const total = toNumber(response.total ?? response.count ?? arr.length);
    return { list: arr, total };
}

function RegisterCorporateScreen({ branches, selectedBranchId, onClose, onSuccess }) {
    const defaultBranches = useMemo(() => {
        if (selectedBranchId && selectedBranchId !== 'all') return [String(selectedBranchId)];
        return [];
    }, [selectedBranchId]);

    const [form, setForm] = useState({
        companyName: '',
        contactPerson: '',
        mobile: '',
        email: '',
        password: '',
        vatNumber: '',
        crNumber: '',
        referralId: '',
        selectedBranchIds: defaultBranches,
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    useEffect(() => {
        setForm({
            companyName: '',
            contactPerson: '',
            mobile: '',
            email: '',
            password: '',
            vatNumber: '',
            crNumber: '',
            referralId: '',
            selectedBranchIds: defaultBranches,
        });
        setSaveError('');
    }, [defaultBranches]);

    const toggleBranch = (branchId) => {
        const sid = String(branchId);
        setForm((f) => {
            const has = f.selectedBranchIds.includes(sid);
            return {
                ...f,
                selectedBranchIds: has ? f.selectedBranchIds.filter((x) => x !== sid) : [...f.selectedBranchIds, sid],
            };
        });
    };

    const handleSubmit = async () => {
        const companyName = form.companyName.trim();
        const contactPerson = form.contactPerson.trim();
        const mobile = form.mobile.trim();
        const email = form.email.trim();
        const password = form.password;
        const vatNumber = form.vatNumber.trim();
        const crNumber = form.crNumber.trim();
        const referralId = form.referralId.trim();
        if (!companyName || !contactPerson || !mobile || !email || !password) {
            setSaveError('Company, contact, mobile, email, and password are required.');
            return;
        }
        if (password.length < 8) {
            setSaveError('Password must be at least 8 characters.');
            return;
        }
        if (!form.selectedBranchIds.length) {
            setSaveError('Select at least one branch to link this corporate account.');
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            const payload = {
                companyName,
                contactPerson,
                mobile,
                email,
                password,
                selectedStoreIds: form.selectedBranchIds.map(String),
            };
            if (vatNumber) payload.vatNumber = vatNumber;
            if (crNumber) payload.crNumber = crNumber;
            if (referralId) payload.referralId = referralId;
            const res = await postCorporateRegister(payload);
            if (res && res.success === false) {
                throw new Error(res.message || 'Registration failed.');
            }
            onSuccess?.();
            onClose();
        } catch (e) {
            setSaveError(e.message || 'Registration failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <WorkshopSubScreen
            title="Register corporate customer"
            subtitle="Signup request for super-admin approval — link branches in your workshop."
            backLabel="Back to Corporate Management"
            onBack={onClose}
            backDisabled={saving}
            size="form"
            maxWidth="560px"
            footer={(
                <>
                    <button type="button" className="btn-portal-outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button type="button" className="btn-portal" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Submitting...' : 'Submit for approval'}
                    </button>
                </>
            )}
        >
            <div className="ws-section" style={{ padding: 20, fontSize: '0.875rem' }}>
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    Sends a signup request for super-admin approval. You can link only branches in your workshop here;
                    the administrator can attach additional branches when approving.
                </p>
                {saveError && (
                    <p style={{ margin: '0 0 12px', color: '#B91C1C', fontSize: '0.8125rem' }}>{saveError}</p>
                )}

                <FieldRow icon={Building2} label="Company name *">
                    <input
                        type="text"
                        value={form.companyName}
                        onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={User} label="Contact person *">
                    <input
                        type="text"
                        value={form.contactPerson}
                        onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Phone} label="Mobile *">
                    <input
                        type="text"
                        value={form.mobile}
                        onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Mail} label="Portal email *">
                    <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        autoComplete="email"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Lock} label="Portal password *">
                    <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        autoComplete="new-password"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={FileText} label="VAT number">
                    <input
                        type="text"
                        value={form.vatNumber}
                        onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={FileText} label="CR number">
                    <input
                        type="text"
                        value={form.crNumber}
                        onChange={(e) => setForm((f) => ({ ...f, crNumber: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={User} label="Referral ID (optional)">
                    <input
                        type="text"
                        inputMode="numeric"
                        value={form.referralId}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, referralId: e.target.value.replace(/\D/g, '') }))}
                        placeholder="Referral row ID"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>

                <div style={{ marginTop: 8, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.875rem' }}>
                        <Store size={18} style={{ color: 'var(--color-text-muted)' }} />
                        Linked branches *
                    </div>
                    <span className="ws-nav-badge--yellow" style={{ fontSize: '0.6875rem' }}>
                        {form.selectedBranchIds.length} selected
                    </span>
                </div>
                <div
                    style={{
                        maxHeight: 220,
                        overflowY: 'auto',
                        border: '1px solid var(--color-border)',
                        borderRadius: 10,
                        padding: 8,
                        background: '#fff',
                    }}
                >
                    {branches.length === 0 ? (
                        <p style={{ margin: 12, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                            No branches loaded. Refresh the page or open again after branches load.
                        </p>
                    ) : (
                        branches.map((b) => {
                            const idStr = String(b.id);
                            const checked = form.selectedBranchIds.includes(idStr);
                            return (
                                <label
                                    key={idStr}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 10,
                                        padding: '10px 8px',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        background: checked ? 'rgba(255,214,0,0.12)' : 'transparent',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleBranch(b.id)}
                                        style={{ marginTop: 3 }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{b.name || idStr}</div>
                                        {b.address ? (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{b.address}</div>
                                        ) : null}
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>
            </div>
        </WorkshopSubScreen>
    );
}

function AddCorporateUserModal({ row, onClose, onSuccess }) {
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    useEffect(() => {
        setForm({ name: '', email: '', password: '' });
        setSaveError('');
    }, [row?.id]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const handleCreate = async () => {
        const name = form.name.trim();
        const email = form.email.trim();
        const password = form.password;
        if (!name || !email || !password) {
            setSaveError('Name, email, and password are required.');
            return;
        }
        if (password.length < 8) {
            setSaveError('Password must be at least 8 characters.');
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            await apiFetch('/workshop-staff/corporate-user/create', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    corporateAccountId: String(row.id),
                }),
            });
            onSuccess?.();
            onClose();
        } catch (e) {
            setSaveError(e.message || 'Failed to create user.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title="Add corporate portal user"
            onClose={onClose}
            width="480px"
            footer={
                <>
                    <button type="button" className="btn-portal-outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-portal"
                        onClick={handleCreate}
                        disabled={saving || !form.name.trim() || !form.email.trim() || !form.password}
                    >
                        {saving ? 'Creating...' : 'Create user'}
                    </button>
                </>
            }
        >
            <div style={{ fontSize: '0.875rem' }}>
                <p style={{ margin: '0 0 8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    Account: <strong>{row.companyName || row.customer?.name || '—'}</strong>
                </p>
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                    Creates a corporate user linked to this corporate account ({String(row.id)}).
                </p>
                {saveError && (
                    <p style={{ margin: '0 0 12px', color: '#B91C1C', fontSize: '0.8125rem' }}>{saveError}</p>
                )}
                <FieldRow icon={User} label="Name">
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        autoComplete="name"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Mail} label="Email">
                    <input
                        type="email"
                        value={form.email}
                        onChange={(e) => set('email', e.target.value)}
                        autoComplete="email"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Lock} label="Password">
                    <input
                        type="password"
                        value={form.password}
                        onChange={(e) => set('password', e.target.value)}
                        autoComplete="new-password"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
            </div>
        </Modal>
    );
}

export default function WorkshopCorporateManagement({ selectedBranchId = 'all', branches: branchesFromLayout = [] }) {
    const [customers, setCustomers] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [branches, setBranches] = useState([]);
    const [editing, setEditing] = useState(null);
    const [addUserFor, setAddUserFor] = useState(null);
    const [registerOpen, setRegisterOpen] = useState(false);

    const mergedBranches = useMemo(
        () =>
            filterPortalVisibleBranches(
                branchesFromLayout.length > 0 ? branchesFromLayout : branches,
            ),
        [branchesFromLayout, branches],
    );

    const branchNameById = useMemo(() => {
        const m = new Map();
        for (const b of mergedBranches) {
            m.set(String(b.id), b.name || String(b.id));
        }
        return m;
    }, [mergedBranches]);

    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return (
            mergedBranches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch'
        );
    }, [mergedBranches, selectedBranchId]);

    const visibleCustomers = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return customers;
        const bid = String(selectedBranchId);
        return customers.filter((row) => {
            const ids = row.selectedBranchIds ?? row.selected_branch_ids ?? [];
            if (!Array.isArray(ids) || ids.length === 0) return true;
            return ids.some((id) => String(id) === bid);
        });
    }, [customers, selectedBranchId]);

    const loadBranches = useCallback(async () => {
        try {
            const response = await apiFetch('/workshop-staff/branches');
            if (response?.success && Array.isArray(response.branches)) {
                setBranches(filterPortalVisibleBranches(response.branches));
            }
        } catch {
            setBranches([]);
        }
    }, []);

    const loadCorporateCustomers = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = workshopCorporateCustomersParams(selectedBranchId);
            const response = await getWorkshopCorporateCustomers(params);
            const { list, total: t } = parseCorporateCustomersResponse(response);
            if (response?.success === false && list.length === 0) {
                throw new Error(response.message || 'Failed to load corporate customers.');
            }
            setCustomers(list);
            setTotal(t > 0 ? t : list.length);
        } catch (err) {
            setError(err.message || 'Failed to load corporate customers.');
            setCustomers([]);
            setTotal(0);
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadCorporateCustomers();
    }, [loadCorporateCustomers]);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    if (registerOpen) {
        return (
            <RegisterCorporateScreen
                branches={mergedBranches}
                selectedBranchId={selectedBranchId}
                onClose={() => setRegisterOpen(false)}
                onSuccess={loadCorporateCustomers}
            />
        );
    }

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Corporate Management</h2>
                    <p className="ws-page-sub">
                        Corporate customers linked to your workshop · <strong>{branchLabel}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" className="btn-portal-outline" onClick={() => setRegisterOpen(true)}>
                        <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        Register corporate
                    </button>
                    <button type="button" className="btn-portal" onClick={loadCorporateCustomers} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Total Corporate Customers</p>
                        <p className="ws-kpi-value">{(selectedBranchId && selectedBranchId !== 'all' ? visibleCustomers.length : total)}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">CORP</div>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <WsTableScroll style={{ padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Contact</th>
                                <th>Mobile</th>
                                <th>VAT</th>
                                <th>Credit Limit</th>
                                <th>Due Balance</th>
                                <th>Branches</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && visibleCustomers.length === 0 ? (
                                <ShimmerTableBodyRows rows={6} columns={9} />
                            ) : visibleCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        No corporate customers found
                                    </td>
                                </tr>
                            ) : (
                                visibleCustomers.map((row) => {
                                    const isPending = String(row.status || '').toLowerCase() === 'pending';
                                    return (
                                    <tr key={row.id ?? row.corporate_account_id ?? row.companyName}>
                                        <td><strong>{row.companyName || row.customer?.name || '—'}</strong></td>
                                        <td>{row.contactPerson || '—'}</td>
                                        <td>{row.customer?.mobile || '—'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                            {row.customer?.vatNumber || row.customer?.taxId || '—'}
                                        </td>
                                        <td>SAR {toNumber(row.creditLimit).toLocaleString()}</td>
                                        <td>SAR {toNumber(row.dueBalance).toLocaleString()}</td>
                                        <td style={{ fontSize: '0.8125rem', maxWidth: 220 }}>
                                            {(() => {
                                                const ids = row.selectedBranchIds ?? row.selected_branch_ids ?? [];
                                                if (!Array.isArray(ids) || ids.length === 0) return '—';
                                                return ids
                                                    .map((id) => branchNameById.get(String(id)) || String(id))
                                                    .join(', ');
                                            })()}
                                        </td>
                                        <td>
                                            <span className={`ws-badge ${statusBadgeClass(row.status)}`}>
                                                {row.status || 'unknown'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline"
                                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                    onClick={() => setAddUserFor(row)}
                                                    disabled={isPending}
                                                    title={
                                                        isPending
                                                            ? 'Available after super admin approves registration'
                                                            : undefined
                                                    }
                                                >
                                                    <UserPlus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                                    Add user
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline"
                                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                    onClick={() => setEditing(row)}
                                                    disabled={isPending}
                                                    title={
                                                        isPending
                                                            ? 'Edit after super admin approval'
                                                            : undefined
                                                    }
                                                >
                                                    <Pencil size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                                    Edit
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </WsTableScroll>
            </div>

            {editing && (
                <EditCorporateAccountModal
                    key={editing.id}
                    row={editing}
                    branches={mergedBranches}
                    onClose={() => setEditing(null)}
                    onSaved={loadCorporateCustomers}
                />
            )}
            {addUserFor && (
                <AddCorporateUserModal
                    key={addUserFor.id}
                    row={addUserFor}
                    onClose={() => setAddUserFor(null)}
                    onSuccess={loadCorporateCustomers}
                />
            )}
        </div>
    );
}
