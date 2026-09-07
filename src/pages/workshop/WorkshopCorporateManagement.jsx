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
import { wcorpT } from '../../utils/workshopCorporateI18n';

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

const STATUS_VALUES = ['active', 'pending', 'rejected'];

function statusLabel(t, status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'active') return t('status.active');
    if (normalized === 'pending') return t('status.pending');
    if (normalized === 'rejected') return t('status.rejected');
    return status || t('status.unknown');
}

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

function EditCorporateAccountModal({ row, branches, onClose, onSaved, t }) {
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
                setSaveError(t('err.noChanges'));
                return;
            }
            await apiFetch(`/workshop-staff/corporate-account/${row.id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
            onSaved?.();
            onClose();
        } catch (e) {
            setSaveError(e.message || t('err.save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title={t('edit.title')}
            onClose={onClose}
            width="520px"
            footer={
                <>
                    <button type="button" className="btn-portal-outline" onClick={onClose} disabled={saving}>
                        {t('btn.cancel')}
                    </button>
                    <button type="button" className="btn-portal" onClick={handleSave} disabled={saving || !form.companyName.trim()}>
                        {saving ? t('btn.saving') : t('btn.saveChanges')}
                    </button>
                </>
            }
        >
            <div style={{ fontSize: '0.875rem' }}>
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    {t('edit.hint')}
                </p>
                {saveError && (
                    <p style={{ margin: '0 0 12px', color: '#B91C1C', fontSize: '0.8125rem' }}>{saveError}</p>
                )}

                <FieldRow icon={Building2} label={t('edit.companyName')}>
                    <input
                        type="text"
                        value={form.companyName}
                        onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={User} label={t('edit.customerName')}>
                    <input
                        type="text"
                        value={form.customerName}
                        onChange={(e) => setPersonName(e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Phone} label={t('edit.mobile')}>
                    <input
                        type="text"
                        value={form.mobile}
                        onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={FileText} label={t('edit.taxId')}>
                    <input
                        type="text"
                        value={form.taxId}
                        onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={FileText} label={t('edit.crNumber')}>
                    <input
                        type="text"
                        value={form.crNumber}
                        onChange={(e) => setForm((f) => ({ ...f, crNumber: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={ToggleLeft} label={t('edit.status')}>
                    <select
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                        {STATUS_VALUES.map((value) => (
                            <option key={value} value={value}>
                                {t(`status.${value}`)}
                            </option>
                        ))}
                    </select>
                </FieldRow>

                <div style={{ marginTop: 8, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.875rem' }}>
                        <Store size={18} style={{ color: 'var(--color-text-muted)' }} />
                        {t('edit.selectBranches')}
                    </div>
                    <span className="ws-nav-badge--yellow" style={{ fontSize: '0.6875rem' }}>
                        {t('edit.selectedCount', { count: form.selectedBranchIds.length })}
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
                            {t('edit.noBranches')}
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

function RegisterCorporateScreen({ branches, selectedBranchId, onClose, onSuccess, t }) {
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
            setSaveError(t('err.requiredRegister'));
            return;
        }
        if (password.length < 8) {
            setSaveError(t('err.passwordLen'));
            return;
        }
        if (!form.selectedBranchIds.length) {
            setSaveError(t('err.selectBranch'));
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
                throw new Error(res.message || t('err.register'));
            }
            onSuccess?.();
            onClose();
        } catch (e) {
            setSaveError(e.message || t('err.register'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <WorkshopSubScreen
            title={t('register.title')}
            subtitle={t('register.subtitle')}
            backLabel={t('register.back')}
            onBack={onClose}
            backDisabled={saving}
            size="form"
            maxWidth="560px"
            footer={(
                <>
                    <button type="button" className="btn-portal-outline" onClick={onClose} disabled={saving}>
                        {t('btn.cancel')}
                    </button>
                    <button type="button" className="btn-portal" onClick={handleSubmit} disabled={saving}>
                        {saving ? t('btn.submitting') : t('btn.submitApproval')}
                    </button>
                </>
            )}
        >
            <div className="ws-section" style={{ padding: 20, fontSize: '0.875rem' }}>
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    {t('register.hint')}
                </p>
                {saveError && (
                    <p style={{ margin: '0 0 12px', color: '#B91C1C', fontSize: '0.8125rem' }}>{saveError}</p>
                )}

                <FieldRow icon={Building2} label={t('register.companyName')}>
                    <input
                        type="text"
                        value={form.companyName}
                        onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={User} label={t('register.contactPerson')}>
                    <input
                        type="text"
                        value={form.contactPerson}
                        onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Phone} label={t('register.mobile')}>
                    <input
                        type="text"
                        value={form.mobile}
                        onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Mail} label={t('register.email')}>
                    <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        autoComplete="email"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Lock} label={t('register.password')}>
                    <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        autoComplete="new-password"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={FileText} label={t('register.vat')}>
                    <input
                        type="text"
                        value={form.vatNumber}
                        onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={FileText} label={t('register.crNumber')}>
                    <input
                        type="text"
                        value={form.crNumber}
                        onChange={(e) => setForm((f) => ({ ...f, crNumber: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={User} label={t('register.referral')}>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={form.referralId}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, referralId: e.target.value.replace(/\D/g, '') }))
                        }
                        placeholder={t('register.referralPlaceholder')}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>

                <div style={{ marginTop: 8, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.875rem' }}>
                        <Store size={18} style={{ color: 'var(--color-text-muted)' }} />
                        {t('register.linkedBranches')}
                    </div>
                    <span className="ws-nav-badge--yellow" style={{ fontSize: '0.6875rem' }}>
                        {t('register.selectedCount', { count: form.selectedBranchIds.length })}
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
                            {t('register.noBranches')}
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

function AddCorporateUserModal({ row, onClose, onSuccess, t }) {
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
            setSaveError(t('err.requiredUser'));
            return;
        }
        if (password.length < 8) {
            setSaveError(t('err.passwordLen'));
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
            setSaveError(e.message || t('err.createUser'));
        } finally {
            setSaving(false);
        }
    };

    const accountName = row.companyName || row.customer?.name || t('emdash');

    return (
        <Modal
            title={t('addUser.title')}
            onClose={onClose}
            width="480px"
            footer={
                <>
                    <button type="button" className="btn-portal-outline" onClick={onClose} disabled={saving}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal"
                        onClick={handleCreate}
                        disabled={saving || !form.name.trim() || !form.email.trim() || !form.password}
                    >
                        {saving ? t('btn.creating') : t('btn.createUser')}
                    </button>
                </>
            }
        >
            <div style={{ fontSize: '0.875rem' }}>
                <p style={{ margin: '0 0 8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    {t('addUser.accountLabel')} <strong>{accountName}</strong>
                </p>
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                    {t('addUser.hint', { id: String(row.id) })}
                </p>
                {saveError && (
                    <p style={{ margin: '0 0 12px', color: '#B91C1C', fontSize: '0.8125rem' }}>{saveError}</p>
                )}
                <FieldRow icon={User} label={t('addUser.name')}>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        autoComplete="name"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Mail} label={t('addUser.email')}>
                    <input
                        type="email"
                        value={form.email}
                        onChange={(e) => set('email', e.target.value)}
                        autoComplete="email"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Lock} label={t('addUser.password')}>
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

export default function WorkshopCorporateManagement({
    selectedBranchId = 'all',
    branches: branchesFromLayout = [],
    locale: localeProp,
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wcorpT(locale, key, vars), [locale]);

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
        if (!selectedBranchId || selectedBranchId === 'all') return t('branch.all');
        return (
            mergedBranches.find((b) => String(b.id) === String(selectedBranchId))?.name || t('branch.fallback')
        );
    }, [mergedBranches, selectedBranchId, t]);

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
            const { list, total: totalCount } = parseCorporateCustomersResponse(response);
            if (response?.success === false && list.length === 0) {
                throw new Error(response.message || t('err.load'));
            }
            setCustomers(list);
            setTotal(totalCount > 0 ? totalCount : list.length);
        } catch (err) {
            setError(err.message || t('err.load'));
            setCustomers([]);
            setTotal(0);
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId, t]);

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
                t={t}
            />
        );
    }

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">
                        {t('page.subtitleBefore')} <strong>{branchLabel}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" className="btn-portal-outline" onClick={() => setRegisterOpen(true)}>
                        <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        {t('btn.register')}
                    </button>
                    <button type="button" className="btn-portal" onClick={loadCorporateCustomers} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? t('btn.refreshing') : t('btn.refresh')}
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
                        <p className="ws-kpi-label">{t('kpi.total')}</p>
                        <p className="ws-kpi-value">{(selectedBranchId && selectedBranchId !== 'all' ? visibleCustomers.length : total)}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">{t('kpi.badge')}</div>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <WsTableScroll style={{ padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>{t('th.company')}</th>
                                <th>{t('th.contact')}</th>
                                <th>{t('th.mobile')}</th>
                                <th>{t('th.vat')}</th>
                                <th>{t('th.creditLimit')}</th>
                                <th>{t('th.dueBalance')}</th>
                                <th>{t('th.branches')}</th>
                                <th>{t('th.status')}</th>
                                <th style={{ textAlign: 'right' }}>{t('th.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && visibleCustomers.length === 0 ? (
                                <ShimmerTableBodyRows rows={6} columns={9} />
                            ) : visibleCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        {t('empty.none')}
                                    </td>
                                </tr>
                            ) : (
                                visibleCustomers.map((row) => {
                                    const isPending = String(row.status || '').toLowerCase() === 'pending';
                                    return (
                                    <tr key={row.id ?? row.corporate_account_id ?? row.companyName}>
                                        <td><strong>{row.companyName || row.customer?.name || t('emdash')}</strong></td>
                                        <td>{row.contactPerson || t('emdash')}</td>
                                        <td>{row.customer?.mobile || t('emdash')}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                            {row.customer?.vatNumber || row.customer?.taxId || t('emdash')}
                                        </td>
                                        <td>{t('money.sar', { amount: toNumber(row.creditLimit).toLocaleString() })}</td>
                                        <td>{t('money.sar', { amount: toNumber(row.dueBalance).toLocaleString() })}</td>
                                        <td style={{ fontSize: '0.8125rem', maxWidth: 220 }}>
                                            {(() => {
                                                const ids = row.selectedBranchIds ?? row.selected_branch_ids ?? [];
                                                if (!Array.isArray(ids) || ids.length === 0) return t('emdash');
                                                return ids
                                                    .map((id) => branchNameById.get(String(id)) || String(id))
                                                    .join(', ');
                                            })()}
                                        </td>
                                        <td>
                                            <span className={`ws-badge ${statusBadgeClass(row.status)}`}>
                                                {statusLabel(t, row.status)}
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
                                                            ? t('title.addUserPending')
                                                            : undefined
                                                    }
                                                >
                                                    <UserPlus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                                    {t('btn.addUser')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline"
                                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                    onClick={() => setEditing(row)}
                                                    disabled={isPending}
                                                    title={
                                                        isPending
                                                            ? t('title.editPending')
                                                            : undefined
                                                    }
                                                >
                                                    <Pencil size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                                    {t('btn.edit')}
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
                    t={t}
                />
            )}
            {addUserFor && (
                <AddCorporateUserModal
                    key={addUserFor.id}
                    row={addUserFor}
                    onClose={() => setAddUserFor(null)}
                    onSuccess={loadCorporateCustomers}
                    t={t}
                />
            )}
        </div>
    );
}
