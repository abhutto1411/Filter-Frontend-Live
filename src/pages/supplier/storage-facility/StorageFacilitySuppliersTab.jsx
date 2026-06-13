import React, { useCallback, useEffect, useState } from 'react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { Plus } from 'lucide-react';
import Modal from '../../../components/Modal';
import { ShimmerTable } from '../../../components/supplier/Shimmer';


export default function StorageFacilitySuppliersTab({ brandId }) {
    const sfApi = useStorageFacilityApi();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '',
        code: '',
        contactPerson: '',
        email: '',
        mobile: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await sfApi.listStorageSuppliers(brandId);
            setRows(Array.isArray(res?.suppliers) ? res.suppliers : []);
        } catch (e) {
            setErr(e?.message || 'Failed to load suppliers');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [brandId]);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            await sfApi.createStorageSupplier(brandId, form);
            setAddOpen(false);
            setForm({ name: '', code: '', contactPerson: '', email: '', mobile: '' });
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Could not create supplier');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (row) => {
        const next = row.isActive === false;
        try {
            await sfApi.updateStorageSupplier(brandId, row.id, { isActive: next });
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Update failed');
        }
    };

    if (loading && rows.length === 0) {
        return (
            <div style={{ padding: 8 }}>
                <ShimmerTable rows={6} columns={4} />
            </div>
        );
    }

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    gap: 10,
                }}
            >
                <p style={{ margin: 0, color: '#64748b', fontSize: 14, maxWidth: 520 }}>
                    Brand-only payables vendors. These are separate from Supplier Portal super
                    suppliers and appear in Transaction Hub when you choose type Suppliers.
                </p>
                <button type="button" className="mgr-si-btn-new" onClick={() => setAddOpen(true)}>
                    <Plus size={14} /> Add supplier
                </button>
            </div>
            {err ? <div className="mgr-si-error">{err}</div> : null}
            <div className="premium-table mgr-si-table-wrap">
                <table className="mgr-si-table">
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Name</th>
                            <th className="table-th">Code</th>
                            <th className="table-th">Contact</th>
                            <th className="table-th">Mobile</th>
                            <th className="table-th">Status</th>
                            <th className="table-th" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr className="table-row">
                                <td colSpan={6} className="table-cell" style={{ color: '#94a3b8' }}>
                                    No suppliers yet. Add vendors you pay for this storage brand.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id} className="table-row">
                                    <td className="table-cell">{r.name}</td>
                                    <td className="table-cell">{r.code || '—'}</td>
                                    <td className="table-cell">{r.contactPerson || '—'}</td>
                                    <td className="table-cell">{r.mobile || '—'}</td>
                                    <td className="table-cell">
                                        {r.isActive === false ? 'Inactive' : 'Active'}
                                    </td>
                                    <td className="table-cell">
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            style={{ fontSize: 12, padding: '4px 10px' }}
                                            onClick={() => toggleActive(r)}
                                        >
                                            {r.isActive === false ? 'Activate' : 'Deactivate'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {addOpen ? (
                <Modal
                    title="Add storage supplier"
                    width="480px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !saving && setAddOpen(false)}
                >
                    <form className="sf-simple-form" onSubmit={handleCreate}>
                        <div className="sf-form-field">
                            <label>Name *</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label>Code</label>
                                <input
                                    value={form.code}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                />
                            </div>
                            <div className="sf-form-field">
                                <label>Contact person</label>
                                <input
                                    value={form.contactPerson}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, contactPerson: e.target.value }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                />
                            </div>
                            <div className="sf-form-field">
                                <label>Mobile</label>
                                <input
                                    value={form.mobile}
                                    onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={saving}
                                onClick={() => setAddOpen(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="mgr-si-btn-new" disabled={saving}>
                                {saving ? 'Saving…' : 'Save supplier'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
