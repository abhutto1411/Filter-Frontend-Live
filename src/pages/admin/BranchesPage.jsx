import { useMemo, useState, useEffect } from 'react';
import { Plus, Building2, MapPin, Phone, Mail, Loader } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/BranchesPage.css';
import { getBranches, getBranch, createBranch, updateBranch, getWorkshopOptions } from '../../services/superAdminApi';

export default function BranchesPage() {
    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');

    const normalizeWorkshop = (w) => ({
        id: String(w?.id ?? w?.value ?? ''),
        name: w?.name ?? w?.label ?? `Workshop ${w?.id ?? ''}`,
        status: String(w?.status ?? '').toLowerCase(),
    });

    const normalizeBranch = (b) => ({
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
            : (b?.workshopId != null ? [String(b.workshopId)] : []),
        workshops: Array.isArray(b?.workshops)
            ? b.workshops.map((w) => ({ id: String(w?.id ?? ''), name: w?.name ?? '' }))
            : [],
    });

    useEffect(() => {
        getWorkshopOptions()
            .then((workshopData) => {
                const workshopRows = Array.isArray(workshopData)
                    ? workshopData
                    : (workshopData?.options ?? workshopData?.workshops ?? workshopData?.data ?? []);
                setWorkshops(workshopRows.map(normalizeWorkshop).filter((w) => w.id));
            })
            .catch(() => {});
    }, []);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [newBranch, setNewBranch] = useState({
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
    });
    const [editingBranch, setEditingBranch] = useState(null);
    const workshopDropdownOptions = useMemo(
        () => workshops.filter((w) => w.status === 'approved'),
        [workshops],
    );

    const openEdit = async (b) => {
        setSaving(true);
        try {
            const detail = await getBranch(String(b.id));
            const row = detail?.data && typeof detail.data === 'object' ? detail.data : detail;
            setEditingBranch(normalizeBranch(row || b));
        } catch {
            setEditingBranch({ ...b });
        } finally {
            setSaving(false);
            setEditOpen(true);
        }
    };
    const refreshBranches = (workshopId = selectedWorkshopId) =>
        getBranches(workshopId ? { workshopId } : {}).then((d) => {
            const rows = Array.isArray(d) ? d : (d?.branches ?? d?.data ?? []);
            setBranches(rows.map(normalizeBranch));
        });

    useEffect(() => {
        setLoading(true);
        refreshBranches(selectedWorkshopId)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [selectedWorkshopId]);

    const handleSaveNew = async () => {
        const name = String(newBranch.name || '').trim();
        if (!name) {
            alert('Branch name is required.');
            return;
        }
        setSaving(true);
        try {
            const workshopIds = Array.isArray(newBranch.workshopIds)
                ? newBranch.workshopIds.filter(Boolean).map((id) => String(id))
                : [];
            const mainWorkshopId = String(newBranch.mainWorkshopId || workshopIds[0] || '');
            if (!mainWorkshopId) {
                alert('Main workshop is required.');
                return;
            }
            const mergedWorkshopIds = Array.from(new Set([mainWorkshopId, ...workshopIds].filter(Boolean)));
            await createBranch({
                workshopId: mainWorkshopId,
                workshopIds: mergedWorkshopIds,
                name,
                branchCode: String(newBranch.branchCode || '').trim() || undefined,
                address: String(newBranch.address || '').trim() || undefined,
                gpsLat: newBranch.gpsLat || undefined,
                gpsLng: newBranch.gpsLng || undefined,
                contactPerson: String(newBranch.contactPerson || '').trim() || undefined,
                phone: String(newBranch.phone || '').trim() || undefined,
                email: String(newBranch.email || '').trim() || undefined,
                vatId: String(newBranch.vatId || '').trim() || undefined,
                crNumber: String(newBranch.crNumber || '').trim() || undefined,
                isActive: newBranch.status === 'active',
            });
            await refreshBranches();
            setCreateOpen(false);
            setNewBranch({
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
            });
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingBranch) return;
        setSaving(true);
        try {
            await updateBranch(editingBranch.id ?? editingBranch._id, {
                workshopId: editingBranch.mainWorkshopId || editingBranch.workshopIds?.[0] || undefined,
                workshopIds: Array.from(
                    new Set([
                        editingBranch.mainWorkshopId || editingBranch.workshopIds?.[0] || '',
                        ...((Array.isArray(editingBranch.workshopIds)
                            ? editingBranch.workshopIds.filter(Boolean).map((id) => String(id))
                            : [])),
                    ].filter(Boolean)),
                ),
                name: editingBranch.name,
                branchCode: editingBranch.branchCode,
                address: editingBranch.address,
                gpsLat: editingBranch.gpsLat || undefined,
                gpsLng: editingBranch.gpsLng || undefined,
                contactPerson: editingBranch.contactPerson,
                phone: editingBranch.phone,
                email: editingBranch.email,
                vatId: editingBranch.vatId,
                crNumber: editingBranch.crNumber,
                isActive: editingBranch.status === 'active',
            });
            await refreshBranches();
            setEditOpen(false);
            setEditingBranch(null);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const WorkshopMultiSelect = ({ value = [], onChange, options = [] }) => {
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
                <button type="button" className="wsms-trigger" onClick={() => setOpen(v => !v)}>
                    <div className="wsms-chips">
                        {selected.length === 0 ? (
                            <span className="wsms-placeholder">Select workshops…</span>
                        ) : (
                            selected.slice(0, 3).map((s) => (
                                <span key={s} className="wsms-chip">
                                    {getNameById(s)}
                                    <span
                                        className="wsms-chip-x"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(s); }}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        ×
                                    </span>
                                </span>
                            ))
                        )}
                        {selected.length > 3 && <span className="wsms-more">+{selected.length - 3} more</span>}
                    </div>
                    <span className="wsms-caret">{open ? '▴' : '▾'}</span>
                </button>

                {open && (
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
                                <div className="wsms-empty">No results</div>
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
                                            <span className={`wsms-box ${checked ? 'checked' : ''}`}>{checked ? '✓' : ''}</span>
                                            <span className="wsms-label">{opt.name}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        <div className="wsms-footer">
                            <button type="button" className="wsms-clear" onClick={() => onChange([])} disabled={selected.length === 0}>Clear</button>
                            <button type="button" className="wsms-done" onClick={() => setOpen(false)}>Done</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="branches-page module-container">
            <header className="branches-page-header">
                <div>
                    <h1 className="branches-title">Branches</h1>
                    <p className="branches-count">{branches.length} branches</p>
                </div>
                <div className="branches-header-actions">
                    <select
                        className="form-input-field branches-workshop-filter"
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                    >
                        <option value="">All Workshops</option>
                        {workshopDropdownOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <button type="button" className="btn-portal" onClick={() => setCreateOpen(true)}><Plus size={16} /> Add Branch</button>
                </div>
            </header>
            <section className="premium-table branches-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Branch</th>
                            <th className="table-th">Address</th>
                            <th className="table-th">Main Workshop</th>
                            <th className="table-th">Contact</th>
                            <th className="table-th">VAT ID</th>
                            <th className="table-th">CR No</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : branches.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="table-cell table-empty">No branches yet. Add your first branch.</td>
                            </tr>
                        ) : (
                            branches.map((b) => (
                                <tr key={b.id} className="table-row">
                                    <td className="table-cell">
                                        <div className="branch-info-cell">
                                            <div className="branch-icon-box">
                                                <Building2 size={18} />
                                            </div>
                                            <div>
                                                <p className="branch-name">{b.name}</p>
                                                <p className="branch-code-sub">{b.branchCode}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="address-info-cell">
                                            <MapPin size={14} className="info-icon" />
                                            <span className="address-text">{b.address}</span>
                                        </div>
                                    </td>
                                    <td className="table-cell">{b.mainWorkshopName || '—'}</td>
                                    <td className="table-cell">
                                        <div className="contact-info-cell">
                                            <div className="contact-item">
                                                <Phone size={14} className="info-icon" />
                                                <span>{b.phone}</span>
                                            </div>
                                            <div className="contact-item">
                                                <Mail size={14} className="info-icon" />
                                                <span>{b.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">{b.vatId}</td>
                                    <td className="table-cell">{b.crNumber}</td>
                                    <td className="table-cell"><span className="status-badge status-completed">{b.isActive ? 'Active' : 'Inactive'}</span></td>
                                    <td className="table-cell"><button type="button" className="btn-edit" onClick={() => openEdit(b)}>Edit</button></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {createOpen && (
                    <Modal
                        title="Add New Branch"
                        onClose={() => setCreateOpen(false)}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                                <button type="button" className="btn-submit-branch" onClick={handleSaveNew} disabled={saving}>
                            {saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Create Branch'}
                        </button>
                            </>
                        }
                    >
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Branch Name *</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="Enter branch name"
                                    value={newBranch.name}
                                    onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Branch Code</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g., RYD-01"
                                    value={newBranch.branchCode}
                                    onChange={(e) => setNewBranch({ ...newBranch, branchCode: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Main Workshop</label>
                                <select
                                    className="form-input-field"
                                    value={newBranch.mainWorkshopId}
                                    onChange={(e) => setNewBranch({ ...newBranch, mainWorkshopId: e.target.value })}
                                >
                                    <option value="">Select workshop</option>
                                    {workshopDropdownOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>Single selection (default workshop).</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Workshops (Multiple)</label>
                                <WorkshopMultiSelect
                                    options={workshopDropdownOptions}
                                    value={newBranch.workshopIds}
                                    onChange={(next) => setNewBranch({ ...newBranch, workshopIds: next })}
                                />
                                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>Select multiple workshops linked to this branch.</p>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Address</label>
                            <input
                                type="text"
                                className="form-input-field"
                                placeholder="Full address"
                                value={newBranch.address}
                                onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                            />
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">GPS Latitude</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g. 24.7136"
                                    value={newBranch.gpsLat}
                                    onChange={(e) => setNewBranch({ ...newBranch, gpsLat: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">GPS Longitude</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g. 46.6753"
                                    value={newBranch.gpsLng}
                                    onChange={(e) => setNewBranch({ ...newBranch, gpsLng: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Contact Person</label>
                            <input
                                type="text"
                                className="form-input-field"
                                placeholder="Name"
                                value={newBranch.contactPerson}
                                onChange={(e) => setNewBranch({ ...newBranch, contactPerson: e.target.value })}
                            />
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="Phone number"
                                    value={newBranch.phone}
                                    onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-input-field"
                                    placeholder="Email address"
                                    value={newBranch.email}
                                    onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">VAT ID</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="VAT number"
                                    value={newBranch.vatId}
                                    onChange={(e) => setNewBranch({ ...newBranch, vatId: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">CR Number</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="Commercial registration"
                                    value={newBranch.crNumber}
                                    onChange={(e) => setNewBranch({ ...newBranch, crNumber: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={newBranch.status}
                                onChange={(e) => setNewBranch({ ...newBranch, status: e.target.value })}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </Modal>
                )}

                {editOpen && editingBranch && (
                    <Modal
                        title="Edit Branch"
                        onClose={() => { setEditOpen(false); setEditingBranch(null); }}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => { setEditOpen(false); setEditingBranch(null); }}>Cancel</button>
                                <button type="button" className="btn-submit-branch" onClick={handleSaveEdit} disabled={saving}>
                                    {saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Update Branch'}
                                </button>
                            </>
                        }
                    >
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Branch Name *</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.name}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Branch Code</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.branchCode}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, branchCode: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Main Workshop</label>
                                <select
                                    className="form-input-field"
                                    value={editingBranch.mainWorkshopId || ''}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, mainWorkshopId: e.target.value })}
                                >
                                    <option value="">Select workshop</option>
                                    {workshopDropdownOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>Single selection (default workshop).</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Workshops (Multiple)</label>
                                <WorkshopMultiSelect
                                    options={workshopDropdownOptions}
                                    value={editingBranch.workshopIds}
                                    onChange={(next) => setEditingBranch({ ...editingBranch, workshopIds: next })}
                                />
                                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>Select multiple workshops linked to this branch.</p>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Address</label>
                            <input
                                type="text"
                                className="form-input-field"
                                value={editingBranch.address}
                                onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })}
                            />
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">GPS Latitude</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.gpsLat}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, gpsLat: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">GPS Longitude</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.gpsLng}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, gpsLng: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Contact Person</label>
                            <input
                                type="text"
                                className="form-input-field"
                                value={editingBranch.contactPerson}
                                onChange={(e) => setEditingBranch({ ...editingBranch, contactPerson: e.target.value })}
                            />
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.phone}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-input-field"
                                    value={editingBranch.email}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">VAT ID</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.vatId}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, vatId: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">CR Number</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.crNumber}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, crNumber: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={editingBranch.status}
                                onChange={(e) => setEditingBranch({ ...editingBranch, status: e.target.value })}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
