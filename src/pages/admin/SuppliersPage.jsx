import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Pencil, ChevronDown, Loader } from 'lucide-react';
import SuppliersPageShell from '../../components/admin/SuppliersPageShell';
import '../../styles/admin/SuppliersPage.css';
import '../../styles/admin/ApprovalsPage.css';
import { getSuppliers, getSupplier, createSupplier, updateSupplier } from '../../services/superAdminApi';
import { parseSuppliersRoute, suppliersRoutes, SUPPLIERS_BASE } from '../../utils/suppliersRoutes';

const EMPTY_SUPPLIER_FORM = {
    name: '',
    category: 'supplier',
    vatId: '',
    crNumber: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    bankName: '',
    bankIban: '',
    street: '',
    cityDistrict: '',
    status: 'active',
    password: '',
};

function normalizeCategory(value) {
    const v = String(value ?? '').trim().toLowerCase();
    if (v === 'supplier') return 'supplier';
    if (v === 'warehouse') return 'warehouse';
    if (v === 'other') return 'other';
    if (v === 'parts' || v === 'lubricants' || v === 'tires' || v === 'equipment') return 'supplier';
    return 'supplier';
}

function normalizeSupplier(s) {
    return {
        id: String(s.id ?? s._id ?? ''),
        name: s.name ?? '—',
        category: normalizeCategory(s.registrationType ?? s.category ?? 'supplier'),
        vatId: s.vatId ?? s.taxId ?? '',
        crNumber: s.tradeLicenseNo ?? s.crNumber ?? '',
        contactPerson: s.contactPerson ?? s.ownerName ?? '',
        phone: s.mobile ?? s.phone ?? '',
        email: s.email ?? '',
        address: s.address ?? '',
        bankName: s.bankName ?? '',
        bankIban: s.iban ?? s.bankIban ?? '',
        street: s.street ?? '',
        cityDistrict: s.cityDistrict ?? '',
        status: s.status ?? (s.isActive === false ? 'inactive' : 'active'),
        password: '',
    };
}

function CategorySelect({ value, onChange }) {
    return (
        <div className="select-wrapper">
            <select className="form-input-field" value={value} onChange={onChange}>
                <option value="supplier">Supplier</option>
                <option value="warehouse">Warehouse</option>
                <option value="other">Other</option>
            </select>
            <ChevronDown className="select-icon" size={16} />
        </div>
    );
}

function StatusSelect({ value, onChange }) {
    return (
        <div className="select-wrapper">
            <select className="form-input-field" value={value} onChange={onChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>
            <ChevronDown className="select-icon" size={16} />
        </div>
    );
}

function SupplierFormFields({ values, onFieldChange, isEdit = false }) {
    const set = (field) => (e) => onFieldChange(field, e.target.value);

    return (
        <div className="suppliers-form-layout">
            <section className="suppliers-form-section">
                <h2 className="suppliers-form-section-title">Company & registration</h2>
                <div className="suppliers-form-grid suppliers-form-grid--4">
                    <div className="form-group span-2">
                        <label className="form-label">Company name *</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="e.g. Al-Fahd Trading"
                            value={values.name}
                            onChange={set('name')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Category</label>
                        <CategorySelect value={values.category} onChange={set('category')} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <StatusSelect value={values.status} onChange={set('status')} />
                    </div>
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

            <section className="suppliers-form-section">
                <h2 className="suppliers-form-section-title">Contact</h2>
                <div className="suppliers-form-grid suppliers-form-grid--3">
                    <div className="form-group">
                        <label className="form-label">Contact person</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Primary contact"
                            value={values.contactPerson}
                            onChange={set('contactPerson')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="+966..."
                            value={values.phone}
                            onChange={set('phone')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input-field"
                            placeholder="login@supplier.com"
                            autoComplete="off"
                            value={values.email}
                            onChange={set('email')}
                        />
                    </div>
                </div>
            </section>

            <section className="suppliers-form-section">
                <h2 className="suppliers-form-section-title">Address</h2>
                <div className="suppliers-form-grid suppliers-form-grid--3">
                    <div className="form-group">
                        <label className="form-label">Street</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Street"
                            value={values.street || ''}
                            onChange={set('street')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">City / district</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="City or district"
                            value={values.cityDistrict || ''}
                            onChange={set('cityDistrict')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Full address</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Office address"
                            value={values.address}
                            onChange={set('address')}
                        />
                    </div>
                </div>
            </section>

            <section className="suppliers-form-section">
                <h2 className="suppliers-form-section-title">Portal login</h2>
                <div className="suppliers-form-grid">
                    <div className="form-group">
                        <label className="form-label">{isEdit ? 'New password' : 'Password *'}</label>
                        <input
                            type="password"
                            className="form-input-field"
                            placeholder={isEdit ? 'Leave blank to keep current password' : 'Set login password'}
                            autoComplete={isEdit ? 'new-password' : 'new-password'}
                            value={values.password || ''}
                            onChange={set('password')}
                        />
                    </div>
                </div>
            </section>

            <section className="suppliers-form-section">
                <h2 className="suppliers-form-section-title">Banking</h2>
                <div className="suppliers-form-grid">
                    <div className="form-group">
                        <label className="form-label">Bank name</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="e.g. Al Rajhi Bank"
                            value={values.bankName}
                            onChange={set('bankName')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Bank IBAN</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="SA..."
                            value={values.bankIban}
                            onChange={set('bankIban')}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

export default function SuppliersPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const route = parseSuppliersRoute(location.pathname);
    const pageMode = Boolean(route);

    const goBack = useCallback(() => {
        navigate(SUPPLIERS_BASE);
    }, [navigate]);

    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editFormLoading, setEditFormLoading] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);

    const reload = () =>
        getSuppliers({}).then((d) => setSuppliers((Array.isArray(d) ? d : (d?.suppliers ?? [])).map(normalizeSupplier)));

    useEffect(() => {
        reload().catch(() => {}).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (route?.screen === 'create') {
            setSupplierForm(EMPTY_SUPPLIER_FORM);
        }
    }, [route?.screen]);

    useEffect(() => {
        if (route?.screen !== 'edit' || !route.id) return;

        const fromState = location.state?.supplier;
        if (fromState && String(fromState.id) === route.id) {
            setEditingSupplier(normalizeSupplier(fromState));
            return;
        }

        const fromList = suppliers.find((s) => String(s.id) === route.id);
        if (fromList) {
            setEditingSupplier({ ...fromList });
        }

        let cancelled = false;
        setEditFormLoading(true);
        getSupplier(String(route.id))
            .then((detail) => {
                if (cancelled) return;
                const payload = detail?.data && typeof detail.data === 'object' ? detail.data : detail;
                setEditingSupplier(normalizeSupplier(payload || fromList || { id: route.id }));
            })
            .catch(() => {
                if (!cancelled && fromList) setEditingSupplier({ ...fromList });
            })
            .finally(() => {
                if (!cancelled) setEditFormLoading(false);
            });

        return () => { cancelled = true; };
    }, [route?.screen, route?.id, location.state, suppliers]);

    const handleSupplierFormField = (field, value) => {
        setSupplierForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleEditingField = (field, value) => {
        setEditingSupplier((prev) => (prev ? { ...prev, [field]: value } : prev));
    };

    const buildSupplierPayload = (form) => ({
        name: form.name,
        registrationType: normalizeCategory(form.category) || undefined,
        category: normalizeCategory(form.category) || undefined,
        vatId: form.vatId || undefined,
        tradeLicenseNo: form.crNumber || undefined,
        contactPerson: form.contactPerson || undefined,
        mobile: form.phone || undefined,
        email: form.email,
        address: form.address,
        bankName: form.bankName || undefined,
        iban: form.bankIban || undefined,
        street: form.street || undefined,
        cityDistrict: form.cityDistrict || undefined,
        isActive: form.status === 'active',
        password: String(form.password || '').trim() || undefined,
    });

    const handleSaveNew = async () => {
        if (!String(supplierForm.password || '').trim()) {
            alert('Password is required for login-ready supplier.');
            return;
        }
        if (!String(supplierForm.name || '').trim()) {
            alert('Company name is required.');
            return;
        }
        setSaving(true);
        try {
            await createSupplier(buildSupplierPayload(supplierForm));
            await reload();
            goBack();
            setSupplierForm(EMPTY_SUPPLIER_FORM);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingSupplier) return;
        if (!String(editingSupplier.name || '').trim()) {
            alert('Company name is required.');
            return;
        }
        setSaving(true);
        try {
            await updateSupplier(editingSupplier.id, buildSupplierPayload(editingSupplier));
            await reload();
            goBack();
            setEditingSupplier(null);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (s) => {
        navigate(suppliersRoutes.edit(s.id), { state: { supplier: s } });
    };

    const closeEdit = () => {
        goBack();
        setEditingSupplier(null);
        setEditFormLoading(false);
    };

    const formFooter = (onCancel, onSave, saveLabel, disabled) => (
        <>
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="button" className="btn-portal btn-black" onClick={onSave} disabled={disabled}>
                {saving ? <><Loader size={14} className="spin" /> Saving…</> : saveLabel}
            </button>
        </>
    );

    if (pageMode) {
        return (
            <>
                {route?.screen === 'create' && (
                    <SuppliersPageShell
                        title="Add New Supplier"
                        onClose={goBack}
                        backDisabled={saving}
                        footer={formFooter(goBack, handleSaveNew, 'Create Supplier', saving)}
                    >
                        <p className="suppliers-form-lead">
                            Register a supplier or warehouse with portal login. All fields except company name and password are optional unless noted.
                        </p>
                        <SupplierFormFields
                            values={supplierForm}
                            onFieldChange={handleSupplierFormField}
                        />
                    </SuppliersPageShell>
                )}

                {route?.screen === 'edit' && (
                    <SuppliersPageShell
                        title="Edit Supplier"
                        onClose={closeEdit}
                        backDisabled={saving}
                        footer={formFooter(closeEdit, handleSaveEdit, 'Save Changes', saving || editFormLoading || !editingSupplier)}
                    >
                        {editFormLoading && !editingSupplier ? (
                            <div className="table-empty"><Loader size={18} className="spin" /> Loading supplier…</div>
                        ) : editingSupplier ? (
                            <>
                                <p className="suppliers-form-lead">
                                    Update supplier profile, contact details, and portal credentials.
                                </p>
                                <SupplierFormFields
                                    values={editingSupplier}
                                    onFieldChange={handleEditingField}
                                    isEdit
                                />
                            </>
                        ) : (
                            <div className="table-empty">Supplier not found.</div>
                        )}
                    </SuppliersPageShell>
                )}
            </>
        );
    }

    return (
        <div className="suppliers-page module-container">
            <header className="suppliers-page-header">
                <div>
                    <h1 className="suppliers-title">Suppliers</h1>
                    <p className="suppliers-count">{suppliers.length} suppliers registered</p>
                </div>
                <button
                    type="button"
                    className="btn-portal"
                    onClick={() => navigate(suppliersRoutes.create())}
                >
                    <Plus size={16} /> Add Supplier
                </button>
            </header>

            <section className="premium-table suppliers-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Supplier</th>
                            <th className="table-th">Category</th>
                            <th className="table-th">Phone</th>
                            <th className="table-th">VAT ID</th>
                            <th className="table-th">CR Number</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : suppliers.length === 0 ? (
                            <tr><td colSpan={7} className="table-cell table-empty">No suppliers yet. Add your first supplier.</td></tr>
                        ) : (
                            suppliers.map((s) => (
                                <tr key={s.id} className="table-row">
                                    <td className="table-cell">
                                        <div className="cell-main-text">{s.name}</div>
                                        <div className="cell-sub-text">{s.contactPerson}</div>
                                    </td>
                                    <td className="table-cell"><span className="cat-badge">{s.category}</span></td>
                                    <td className="table-cell">{s.phone}</td>
                                    <td className="table-cell font-mono">{s.vatId || '—'}</td>
                                    <td className="table-cell font-mono">{s.crNumber || '—'}</td>
                                    <td className="table-cell">
                                        <span className={`status-badge ${s.status === 'active' ? 'status-completed' : 'status-warning'}`}>
                                            {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <button type="button" className="btn-icon" onClick={() => openEdit(s)}><Pencil size={16} /></button>
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
