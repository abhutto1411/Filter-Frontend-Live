import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Plus,
    Building2,
    MapPin,
    Phone,
    Mail,
    Loader,
    Search,
    GitBranch,
    UserCheck,
    Pencil,
    ChevronDown,
} from 'lucide-react';
import BranchesPageShell from '../../components/admin/BranchesPageShell';
import { ShimmerTable } from '../../components/supplier/Shimmer';
import '../../styles/admin/BranchesPage.css';
import '../../styles/admin/ApprovalsPage.css';
import {
    getBranches,
    getBranch,
    createBranch,
    updateBranch,
    getWorkshopOptions,
} from '../../services/superAdminApi';
import { parseBranchesRoute, branchesRoutes, BRANCHES_BASE } from '../../utils/branchesRoutes';

const EMPTY_BRANCH = {
    name: '',
    branchCode: '',
    address: '',
    gpsLat: '',
    gpsLng: '',
    contactPerson: '',
    phone: '',
    email: '',
    vatId: '',
    crNumber: '',
    status: 'active',
    mainWorkshopId: '',
    workshopIds: [],
};

const STATUS_TABS = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
];

function normalizeWorkshop(w) {
    return {
        id: String(w?.id ?? w?.value ?? ''),
        name: w?.name ?? w?.label ?? `Workshop ${w?.id ?? ''}`,
        status: String(w?.status ?? '').toLowerCase(),
    };
}

function normalizeBranch(b) {
    return {
        id: String(b?.id ?? b?._id ?? ''),
        name: b?.name ?? '—',
        branchCode: b?.branchCode ?? b?.code ?? '',
        address: b?.address ?? '',
        gpsLat: b?.gpsLat ?? '',
        gpsLng: b?.gpsLng ?? '',
        contactPerson: b?.contactPerson ?? '',
        phone: b?.phone ?? '',
        email: b?.email ?? '',
        vatId: b?.vatId ?? '',
        crNumber: b?.crNumber ?? b?.crNo ?? '',
        isActive: b?.isActive !== false,
        status: b?.status ?? (b?.isActive === false ? 'inactive' : 'active'),
        mainWorkshopId: String(b?.mainWorkshopId ?? b?.workshopId ?? ''),
        mainWorkshopName: b?.mainWorkshopName ?? b?.workshopName ?? b?.workshops?.[0]?.name ?? '',
        workshopIds: Array.isArray(b?.workshopIds)
            ? b.workshopIds.map((x) => String(x))
            : b?.workshopId != null
              ? [String(b.workshopId)]
              : [],
        workshops: Array.isArray(b?.workshops)
            ? b.workshops.map((w) => ({ id: String(w?.id ?? ''), name: w?.name ?? '' }))
            : [],
    };
}

function branchToForm(b) {
    return {
        name: b.name === '—' ? '' : b.name,
        branchCode: b.branchCode || '',
        address: b.address || '',
        gpsLat: b.gpsLat || '',
        gpsLng: b.gpsLng || '',
        contactPerson: b.contactPerson || '',
        phone: b.phone || '',
        email: b.email || '',
        vatId: b.vatId || '',
        crNumber: b.crNumber || '',
        status: b.isActive === false ? 'inactive' : 'active',
        mainWorkshopId: b.mainWorkshopId || '',
        workshopIds: Array.isArray(b.workshopIds) ? [...b.workshopIds] : [],
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

function WorkshopMultiSelect({ value = [], onChange, options = [] }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const filtered = useMemo(
        () => options.filter((o) => String(o.name || '').toLowerCase().includes(q.trim().toLowerCase())),
        [options, q],
    );
    const selected = Array.isArray(value) ? value : [];

    const getNameById = (id) => options.find((o) => String(o.id) === String(id))?.name || id;

    const toggle = (optId) => {
        const stringId = String(optId);
        const next = selected.includes(stringId)
            ? selected.filter((x) => x !== stringId)
            : [...selected, stringId];
        onChange(next);
    };

    return (
        <div className="wsms">
            <button type="button" className="wsms-trigger" onClick={() => setOpen((v) => !v)}>
                <div className="wsms-chips">
                    {selected.length === 0 ? (
                        <span className="wsms-placeholder">Select linked workshops…</span>
                    ) : (
                        selected.slice(0, 4).map((s) => (
                            <span key={s} className="wsms-chip">
                                {getNameById(s)}
                                <span
                                    className="wsms-chip-x"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggle(s);
                                    }}
                                    role="button"
                                    tabIndex={0}
                                >
                                    ×
                                </span>
                            </span>
                        ))
                    )}
                    {selected.length > 4 ? (
                        <span className="wsms-more">+{selected.length - 4} more</span>
                    ) : null}
                </div>
                <span className="wsms-caret">{open ? '▴' : '▾'}</span>
            </button>

            {open ? (
                <div className="wsms-pop">
                    <input
                        className="wsms-search"
                        placeholder="Search workshops…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        autoFocus
                    />
                    <div className="wsms-list">
                        {filtered.length === 0 ? (
                            <div className="wsms-empty">No workshops found</div>
                        ) : (
                            filtered.map((opt) => {
                                const optId = String(opt.id);
                                const checked = selected.includes(optId);
                                return (
                                    <button
                                        key={optId}
                                        type="button"
                                        className={`wsms-item ${checked ? 'checked' : ''}`}
                                        onClick={() => toggle(optId)}
                                    >
                                        <span className={`wsms-box ${checked ? 'checked' : ''}`}>
                                            {checked ? '✓' : ''}
                                        </span>
                                        <span className="wsms-label">{opt.name}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                    <div className="wsms-footer">
                        <button
                            type="button"
                            className="wsms-clear"
                            onClick={() => onChange([])}
                            disabled={selected.length === 0}
                        >
                            Clear
                        </button>
                        <button type="button" className="wsms-done" onClick={() => setOpen(false)}>
                            Done
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function BranchFormFields({ values, onChange, workshopOptions }) {
    const set = (field) => (e) => onChange(field, e.target.value);

    return (
        <div className="branches-form-layout">
            <section className="branches-form-section">
                <h2 className="branches-form-section-title">Branch details</h2>
                <div className="branches-form-grid branches-form-grid--4">
                    <div className="form-group span-2">
                        <label className="form-label">Branch name *</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="e.g. Riyadh Main"
                            value={values.name}
                            onChange={set('name')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Branch code</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="RYD-01"
                            value={values.branchCode}
                            onChange={set('branchCode')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <SelectField value={values.status} onChange={set('status')}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </SelectField>
                    </div>
                </div>
            </section>

            <section className="branches-form-section">
                <h2 className="branches-form-section-title">Workshop assignment</h2>
                <div className="branches-form-grid branches-form-grid--2">
                    <div className="form-group">
                        <label className="form-label">Main workshop *</label>
                        <SelectField value={values.mainWorkshopId} onChange={set('mainWorkshopId')}>
                            <option value="">Select workshop</option>
                            {workshopOptions.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}
                                </option>
                            ))}
                        </SelectField>
                        <p className="branches-form-hint">Primary workshop for this branch.</p>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Linked workshops</label>
                        <WorkshopMultiSelect
                            options={workshopOptions}
                            value={values.workshopIds}
                            onChange={(next) => onChange('workshopIds', next)}
                        />
                        <p className="branches-form-hint">Optional — share branch across multiple workshops.</p>
                    </div>
                </div>
            </section>

            <section className="branches-form-section">
                <h2 className="branches-form-section-title">Location</h2>
                <div className="branches-form-grid branches-form-grid--3">
                    <div className="form-group span-3">
                        <label className="form-label">Address</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Street, district, city"
                            value={values.address}
                            onChange={set('address')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">GPS latitude</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="24.7136"
                            value={values.gpsLat}
                            onChange={set('gpsLat')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">GPS longitude</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="46.6753"
                            value={values.gpsLng}
                            onChange={set('gpsLng')}
                        />
                    </div>
                </div>
            </section>

            <section className="branches-form-section">
                <h2 className="branches-form-section-title">Contact</h2>
                <div className="branches-form-grid branches-form-grid--3">
                    <div className="form-group">
                        <label className="form-label">Contact person</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Branch manager"
                            value={values.contactPerson}
                            onChange={set('contactPerson')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="05XXXXXXXX"
                            value={values.phone}
                            onChange={set('phone')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input-field"
                            placeholder="branch@workshop.com"
                            value={values.email}
                            onChange={set('email')}
                        />
                    </div>
                </div>
            </section>

            <section className="branches-form-section">
                <h2 className="branches-form-section-title">Registration</h2>
                <div className="branches-form-grid branches-form-grid--2">
                    <div className="form-group">
                        <label className="form-label">VAT ID</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="VAT number"
                            value={values.vatId}
                            onChange={set('vatId')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">CR number</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Commercial registration"
                            value={values.crNumber}
                            onChange={set('crNumber')}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

function buildBranchPayload(form) {
    const workshopIds = Array.isArray(form.workshopIds)
        ? form.workshopIds.filter(Boolean).map(String)
        : [];
    const mainWorkshopId = String(form.mainWorkshopId || workshopIds[0] || '');
    const mergedWorkshopIds = Array.from(new Set([mainWorkshopId, ...workshopIds].filter(Boolean)));

    return {
        workshopId: mainWorkshopId,
        workshopIds: mergedWorkshopIds,
        name: String(form.name || '').trim(),
        branchCode: String(form.branchCode || '').trim() || undefined,
        address: String(form.address || '').trim() || undefined,
        gpsLat: form.gpsLat || undefined,
        gpsLng: form.gpsLng || undefined,
        contactPerson: String(form.contactPerson || '').trim() || undefined,
        phone: String(form.phone || '').trim() || undefined,
        email: String(form.email || '').trim() || undefined,
        vatId: String(form.vatId || '').trim() || undefined,
        crNumber: String(form.crNumber || '').trim() || undefined,
        isActive: form.status === 'active',
    };
}

export default function BranchesPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const route = parseBranchesRoute(location.pathname);
    const pageMode = Boolean(route);

    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_BRANCH);
    const [editLoading, setEditLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [workshopFilter, setWorkshopFilter] = useState('');

    const goBack = useCallback(() => navigate(BRANCHES_BASE), [navigate]);

    const onFormField = useCallback((field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    }, []);

    const workshopDropdownOptions = useMemo(
        () => workshops.filter((w) => w.status === 'approved' || !w.status),
        [workshops],
    );

    const refreshBranches = useCallback(
        (workshopId = workshopFilter) =>
            getBranches(workshopId ? { workshopId } : {}).then((d) => {
                const rows = Array.isArray(d) ? d : (d?.branches ?? d?.data ?? []);
                setBranches(rows.map(normalizeBranch));
            }),
        [workshopFilter],
    );

    useEffect(() => {
        getWorkshopOptions()
            .then((workshopData) => {
                const workshopRows = Array.isArray(workshopData)
                    ? workshopData
                    : (workshopData?.options ?? workshopData?.workshops ?? workshopData?.data ?? []);
                setWorkshops(workshopRows.map(normalizeWorkshop).filter((w) => w.id));
            })
            .catch(() => setWorkshops([]));
    }, []);

    useEffect(() => {
        if (pageMode) return;
        setLoading(true);
        refreshBranches(workshopFilter)
            .catch(() => setBranches([]))
            .finally(() => setLoading(false));
    }, [pageMode, workshopFilter, refreshBranches]);

    useEffect(() => {
        if (route?.screen !== 'create') return;
        setForm(EMPTY_BRANCH);
    }, [route?.screen]);

    useEffect(() => {
        if (route?.screen !== 'edit' || !route.id) return;

        const fromNav = location.state?.branch;
        if (fromNav && String(fromNav.id) === String(route.id)) {
            setForm(branchToForm(normalizeBranch(fromNav)));
            return;
        }

        let cancelled = false;
        setEditLoading(true);
        (async () => {
            try {
                const detail = await getBranch(route.id);
                const row = detail?.data && typeof detail.data === 'object' ? detail.data : detail;
                if (!cancelled) setForm(branchToForm(normalizeBranch(row)));
            } catch {
                if (!cancelled) setForm(EMPTY_BRANCH);
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
        return branches.filter((b) => {
            if (statusFilter === 'active' && !b.isActive) return false;
            if (statusFilter === 'inactive' && b.isActive) return false;
            if (!needle) return true;
            return [
                b.name,
                b.branchCode,
                b.address,
                b.mainWorkshopName,
                b.phone,
                b.email,
                b.vatId,
                b.crNumber,
            ]
                .join(' ')
                .toLowerCase()
                .includes(needle);
        });
    }, [branches, search, statusFilter]);

    const total = branches.length;
    const activeCount = branches.filter((b) => b.isActive).length;
    const workshopCount = useMemo(
        () => new Set(branches.map((b) => b.mainWorkshopId).filter(Boolean)).size,
        [branches],
    );

    const handleSaveCreate = async () => {
        const name = String(form.name || '').trim();
        if (!name) {
            window.alert('Branch name is required.');
            return;
        }
        const mainWorkshopId = String(form.mainWorkshopId || form.workshopIds?.[0] || '');
        if (!mainWorkshopId) {
            window.alert('Main workshop is required.');
            return;
        }
        setSaving(true);
        try {
            await createBranch(buildBranchPayload(form));
            await refreshBranches();
            goBack();
        } catch (err) {
            window.alert(err?.message || 'Could not create branch');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!route?.id) return;
        setSaving(true);
        try {
            await updateBranch(route.id, buildBranchPayload(form));
            await refreshBranches();
            goBack();
        } catch (err) {
            window.alert(err?.message || 'Could not update branch');
        } finally {
            setSaving(false);
        }
    };

    if (route?.screen === 'create') {
        return (
            <BranchesPageShell
                title="Add Branch"
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
                                'Create Branch'
                            )}
                        </button>
                    </>
                }
            >
                <p className="branches-form-lead">
                    Register a workshop branch with location, contact details, and optional multi-workshop
                    linking.
                </p>
                <BranchFormFields
                    values={form}
                    onChange={onFormField}
                    workshopOptions={workshopDropdownOptions}
                />
            </BranchesPageShell>
        );
    }

    if (route?.screen === 'edit') {
        return (
            <BranchesPageShell
                title="Edit Branch"
                onClose={goBack}
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={goBack}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-submit"
                            onClick={handleSaveEdit}
                            disabled={saving || editLoading}
                        >
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
                        <Loader size={18} className="spin" /> Loading branch…
                    </div>
                ) : (
                    <>
                        <p className="branches-form-lead">
                            Update branch profile, workshop links, and registration details.
                        </p>
                        <BranchFormFields
                            values={form}
                            onChange={onFormField}
                            workshopOptions={workshopDropdownOptions}
                        />
                    </>
                )}
            </BranchesPageShell>
        );
    }

    return (
        <div className="branches-page module-container">
            <header className="branches-page-header">
                <div className="branches-page-header-text">
                    <h1 className="branches-title">Branches</h1>
                    <p className="branches-subtitle">Workshop locations across the platform</p>
                </div>
                <button
                    type="button"
                    className="btn-portal branches-header-add"
                    onClick={() => navigate(branchesRoutes.create())}
                >
                    <Plus size={16} /> Add Branch
                </button>
            </header>

            <div className="branches-stats-grid">
                <div className="branches-stat-card">
                    <span className="branches-stat-icon branches-stat-icon--total">
                        <GitBranch size={18} />
                    </span>
                    <div>
                        <p className="branches-stat-label">Total</p>
                        <p className="branches-stat-value">{total}</p>
                    </div>
                </div>
                <div className="branches-stat-card">
                    <span className="branches-stat-icon branches-stat-icon--active">
                        <UserCheck size={18} />
                    </span>
                    <div>
                        <p className="branches-stat-label">Active</p>
                        <p className="branches-stat-value">{activeCount}</p>
                    </div>
                </div>
                <div className="branches-stat-card">
                    <span className="branches-stat-icon branches-stat-icon--workshops">
                        <Building2 size={18} />
                    </span>
                    <div>
                        <p className="branches-stat-label">Workshops</p>
                        <p className="branches-stat-value">{workshopCount}</p>
                    </div>
                </div>
            </div>

            <div className="branches-filter-bar">
                <div className="search-bar-mini branches-search">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search branch, code, address…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="branches-segment" role="tablist" aria-label="Filter by status">
                    {STATUS_TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={statusFilter === t.id}
                            className={`branches-segment-btn ${statusFilter === t.id ? 'active' : ''}`}
                            onClick={() => setStatusFilter(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <SelectField
                    value={workshopFilter}
                    onChange={(e) => setWorkshopFilter(e.target.value)}
                    className="branches-filter-select"
                >
                    <option value="">All workshops</option>
                    {workshopDropdownOptions.map((w) => (
                        <option key={w.id} value={w.id}>
                            {w.name}
                        </option>
                    ))}
                </SelectField>
            </div>

            <section className="premium-table branches-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Branch</th>
                            <th className="table-th">Address</th>
                            <th className="table-th">Workshop</th>
                            <th className="table-th">Contact</th>
                            <th className="table-th">VAT / CR</th>
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
                                <td colSpan={7} className="table-cell table-empty branches-empty">
                                    <Building2 size={40} strokeWidth={1.25} />
                                    <p>No branches found</p>
                                    <span>Adjust filters or add a new branch.</span>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((b) => (
                                <tr key={b.id} className="table-row">
                                    <td className="table-cell">
                                        <div className="branch-info-cell">
                                            <div className="branch-icon-box">
                                                <Building2 size={18} />
                                            </div>
                                            <div>
                                                <p className="branch-name">{b.name}</p>
                                                {b.branchCode ? (
                                                    <p className="branch-code-sub">{b.branchCode}</p>
                                                ) : null}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        {b.address ? (
                                            <div className="address-info-cell" title={b.address}>
                                                <MapPin size={14} className="info-icon" />
                                                <span className="address-text">{b.address}</span>
                                            </div>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="table-cell">{b.mainWorkshopName || '—'}</td>
                                    <td className="table-cell">
                                        <div className="contact-info-cell">
                                            {b.phone ? (
                                                <div className="contact-item">
                                                    <Phone size={14} className="info-icon" />
                                                    <span>{b.phone}</span>
                                                </div>
                                            ) : null}
                                            {b.email ? (
                                                <div className="contact-item">
                                                    <Mail size={14} className="info-icon" />
                                                    <span>{b.email}</span>
                                                </div>
                                            ) : null}
                                            {!b.phone && !b.email ? '—' : null}
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="branches-reg-cell">
                                            {b.vatId ? <span>VAT: {b.vatId}</span> : null}
                                            {b.crNumber ? <span>CR: {b.crNumber}</span> : null}
                                            {!b.vatId && !b.crNumber ? '—' : null}
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <span
                                            className={`status-badge ${
                                                b.isActive ? 'status-completed' : 'status-warning'
                                            }`}
                                        >
                                            {b.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="table-cell branches-actions-cell">
                                        <button
                                            type="button"
                                            className="btn-edit-icon"
                                            title="Edit"
                                            onClick={() =>
                                                navigate(branchesRoutes.edit(b.id), {
                                                    state: { branch: b },
                                                })
                                            }
                                        >
                                            <Pencil size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
