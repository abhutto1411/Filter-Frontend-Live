import { useState, useEffect } from 'react';
import { Plus, Pencil, ChevronDown, Loader } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/SuppliersPage.css';
import { getSuppliers, getSupplier, createSupplier, updateSupplier } from '../../services/superAdminApi';

export default function SuppliersPage() {
    const normalizeCategory = (value) => {
        const v = String(value ?? '').trim().toLowerCase();
        if (v === 'supplier') return 'supplier';
        if (v === 'warehouse') return 'warehouse';
        if (v === 'other') return 'other';
        if (v === 'parts' || v === 'lubricants' || v === 'tires' || v === 'equipment') return 'supplier';
        return 'supplier';
    };

    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);

    const normalize = (s) => ({
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
    });

    const reload = () =>
        getSuppliers({}).then((d) => setSuppliers((Array.isArray(d) ? d : (d?.suppliers ?? [])).map(normalize)));

    useEffect(() => {
        reload().catch(() => {}).finally(() => setLoading(false));
    }, []);

    const [supplierForm, setSupplierForm] = useState({
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
    });

    const resetForm = () => {
        setSupplierForm({
            name: '', category: 'supplier', vatId: '', crNumber: '', contactPerson: '',
            phone: '', email: '', address: '', bankName: '', bankIban: '',
            street: '', cityDistrict: '', status: 'active', password: ''
        });
    };

    const openEdit = async (s) => {
        setSaving(true);
        try {
            const detail = await getSupplier(String(s.id));
            const payload = detail?.data && typeof detail.data === 'object' ? detail.data : detail;
            setEditingSupplier(normalize(payload || s));
            setEditOpen(true);
        } catch {
            setEditingSupplier({ ...s });
            setEditOpen(true);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNew = async () => {
        if (!String(supplierForm.password || '').trim()) {
            alert('Password is required for login-ready supplier.');
            return;
        }
        setSaving(true);
        try {
            await createSupplier({
                name: supplierForm.name,
                registrationType: normalizeCategory(supplierForm.category) || undefined,
                category: normalizeCategory(supplierForm.category) || undefined,
                vatId: supplierForm.vatId || undefined,
                tradeLicenseNo: supplierForm.crNumber || undefined,
                contactPerson: supplierForm.contactPerson || undefined,
                mobile: supplierForm.phone || undefined,
                email: supplierForm.email,
                address: supplierForm.address,
                bankName: supplierForm.bankName || undefined,
                iban: supplierForm.bankIban || undefined,
                street: supplierForm.street || undefined,
                cityDistrict: supplierForm.cityDistrict || undefined,
                isActive: supplierForm.status === 'active',
                password: supplierForm.password,
            });
            await reload();
            setCreateOpen(false);
            resetForm();
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingSupplier) return;
        setSaving(true);
        try {
            await updateSupplier(editingSupplier.id, {
                name: editingSupplier.name,
                registrationType: normalizeCategory(editingSupplier.category) || undefined,
                category: normalizeCategory(editingSupplier.category) || undefined,
                vatId: editingSupplier.vatId || undefined,
                tradeLicenseNo: editingSupplier.crNumber || undefined,
                contactPerson: editingSupplier.contactPerson || undefined,
                mobile: editingSupplier.phone || undefined,
                email: editingSupplier.email || undefined,
                address: editingSupplier.address || undefined,
                bankName: editingSupplier.bankName || undefined,
                iban: editingSupplier.bankIban || undefined,
                street: editingSupplier.street || undefined,
                cityDistrict: editingSupplier.cityDistrict || undefined,
                isActive: editingSupplier.status === 'active',
                password: String(editingSupplier.password || '').trim() || undefined,
            });
            await reload();
            setEditOpen(false);
            setEditingSupplier(null);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="suppliers-page module-container">
            <header className="suppliers-page-header">
                <div>
                    <h1 className="suppliers-title">Suppliers</h1>
                    <p className="suppliers-count">{suppliers.length} suppliers registered</p>
                </div>
                <button type="button" className="btn-portal" onClick={() => { resetForm(); setCreateOpen(true); }}><Plus size={16} /> Add Supplier</button>
            </header>

            <div className="suppliers-filters">
                <button type="button" className="suppliers-filter-pill active">All Categories</button>
            </div>

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

            <AnimatePresence>
                {createOpen && (
                    <Modal
                        title="Add New Supplier"
                        onClose={() => setCreateOpen(false)}
                        className="supplier-modal-wide"
                        footer={
                            <div className="modal-footer-actions">
                                <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                                <button type="button" className="btn-portal btn-black" onClick={handleSaveNew} disabled={saving}>{saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Create Supplier'}</button>
                            </div>
                        }
                    >
                        <div className="product-form-container">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Company Name *</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="e.g. Al-Fahd Trading"
                                        value={supplierForm.name}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <div className="select-wrapper">
                                        <select
                                            className="form-input-field"
                                            value={supplierForm.category}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                                        >
                                            <option value="supplier">Supplier</option>
                                            <option value="warehouse">Warehouse</option>
                                            <option value="other">Other</option>
                                        </select>
                                        <ChevronDown className="select-icon" size={16} />
                                    </div>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">VAT ID</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="Enter VAT ID"
                                        value={supplierForm.vatId}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, vatId: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">CR Number</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="Enter CR Number"
                                        value={supplierForm.crNumber}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, crNumber: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Street (optional)</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="Street"
                                        value={supplierForm.street || ''}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, street: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">City / District (optional)</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="City / District"
                                        value={supplierForm.cityDistrict || ''}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, cityDistrict: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Contact Person</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="Person name"
                                        value={supplierForm.contactPerson}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="+966..."
                                        value={supplierForm.phone}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input-field"
                                        placeholder="email@example.com"
                                        value={supplierForm.email}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="Office address"
                                        value={supplierForm.address}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Password *</label>
                                    <input
                                        type="password"
                                        className="form-input-field"
                                        placeholder="Set login password"
                                        value={supplierForm.password}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Bank Name</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="e.g. Al Rajhi Bank"
                                        value={supplierForm.bankName}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, bankName: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Bank IBAN</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="SA..."
                                        value={supplierForm.bankIban}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, bankIban: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <div className="select-wrapper">
                                    <select
                                        className="form-input-field"
                                        value={supplierForm.status}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.value })}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                    <ChevronDown className="select-icon" size={16} />
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}

                {editOpen && editingSupplier && (
                    <Modal
                        title="Edit Supplier"
                        onClose={() => { setEditOpen(false); setEditingSupplier(null); }}
                        className="supplier-modal-wide"
                        footer={
                            <div className="modal-footer-actions">
                                <button type="button" className="btn-secondary" onClick={() => { setEditOpen(false); setEditingSupplier(null); }}>Cancel</button>
                                <button type="button" className="btn-portal btn-black" onClick={handleSaveEdit} disabled={saving}>{saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Save Changes'}</button>
                            </div>
                        }
                    >
                        <div className="product-form-container">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Company Name *</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingSupplier.name}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <div className="select-wrapper">
                                        <select
                                            className="form-input-field"
                                            value={editingSupplier.category}
                                            onChange={(e) => setEditingSupplier({ ...editingSupplier, category: e.target.value })}
                                        >
                                            <option value="supplier">Supplier</option>
                                            <option value="warehouse">Warehouse</option>
                                            <option value="other">Other</option>
                                        </select>
                                        <ChevronDown className="select-icon" size={16} />
                                    </div>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">VAT ID</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingSupplier.vatId}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, vatId: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">CR Number</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingSupplier.crNumber}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, crNumber: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Street (optional)</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="Street"
                                        value={editingSupplier.street || ''}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, street: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">City / District (optional)</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="City / District"
                                        value={editingSupplier.cityDistrict || ''}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, cityDistrict: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Contact Person</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingSupplier.contactPerson}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, contactPerson: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingSupplier.phone}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input-field"
                                        value={editingSupplier.email}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingSupplier.address}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Password</label>
                                    <input
                                        type="password"
                                        className="form-input-field"
                                        placeholder="Leave blank to keep current password"
                                        value={editingSupplier.password || ''}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Bank Name</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingSupplier.bankName}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, bankName: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Bank IBAN</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={editingSupplier.bankIban}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, bankIban: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <div className="select-wrapper">
                                    <select
                                        className="form-input-field"
                                        value={editingSupplier.status}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, status: e.target.value })}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                    <ChevronDown className="select-icon" size={16} />
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
