import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import { ShimmerTable } from '../../../components/supplier/Shimmer';
import {
    createStorageLocation,
    deleteStorageLocation,
    listStorageLocations,
    updateStorageLocation,
} from '../../../services/storageFacilityApi';

const KIND_LABEL = {
    brand_storage: 'Brand storage',
    owner_warehouse: 'Your main warehouse',
};

export default function StorageFacilityLocationsTab({ brandId }) {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', code: '', companyName: '' });
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listStorageLocations(brandId);
            setLocations(res?.locations ?? []);
        } catch (e) {
            setErr(e?.message || 'Failed to load locations');
            setLocations([]);
        } finally {
            setLoading(false);
        }
    }, [brandId]);

    useEffect(() => {
        load();
    }, [load]);

    const openAdd = () => {
        setEditing(null);
        setForm({ name: '', code: '', companyName: '' });
        setModalOpen(true);
    };

    const openEdit = (loc) => {
        setEditing(loc);
        setForm({
            name: loc.name || '',
            code: loc.code || '',
            companyName: loc.companyName || '',
        });
        setModalOpen(true);
    };

    const save = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setBusy(true);
        try {
            if (editing) {
                await updateStorageLocation(brandId, editing.id, {
                    name: form.name.trim(),
                    code: form.code.trim() || undefined,
                });
            } else {
                await createStorageLocation(brandId, {
                    name: form.name.trim(),
                    code: form.code.trim() || undefined,
                });
            }
            setModalOpen(false);
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Could not save location');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (loc) => {
        if (loc.isSystem) {
            window.alert('System locations cannot be deleted.');
            return;
        }
        if (!window.confirm(`Delete location "${loc.name}"?`)) return;
        try {
            await deleteStorageLocation(brandId, loc.id);
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Could not delete');
        }
    };

    if (loading && locations.length === 0) {
        return (
            <div className="ws-section">
                <ShimmerTable rows={5} columns={4} />
            </div>
        );
    }

    return (
        <div>
            {err ? <div className="mgr-si-error" style={{ marginBottom: 12 }}>{err}</div> : null}

            <p className="mgr-si-subtitle" style={{ marginBottom: 12 }}>
                Manage where stock can move. System rows include brand storage and your main
                warehouse; add custom bins or sites for transfers between locations.
            </p>

            <button type="button" className="mgr-si-btn-new" style={{ marginBottom: 16 }} onClick={openAdd}>
                <Plus size={14} /> Add location
            </button>

            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Company</th>
                            <th>Code</th>
                            <th>Type</th>
                            <th style={{ width: 120 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {locations.map((loc) => (
                            <tr key={loc.id}>
                                <td>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                        <MapPin size={14} style={{ color: '#64748b' }} />
                                        <strong>{loc.name}</strong>
                                        {loc.isSystem ? (
                                            <span className="sf-loc-badge">System</span>
                                        ) : null}
                                    </span>
                                </td>
                                <td>{loc.companyName || '—'}</td>
                                <td>{loc.code || '—'}</td>
                                <td>{KIND_LABEL[loc.locationKind] || loc.locationKind}</td>
                                <td>
                                    <button
                                        type="button"
                                        className="mgr-si-record-pay"
                                        style={{ marginRight: 6 }}
                                        onClick={() => openEdit(loc)}
                                    >
                                        <Pencil size={12} style={{ verticalAlign: 'middle' }} /> Edit
                                    </button>
                                    {!loc.isSystem ? (
                                        <button
                                            type="button"
                                            className="mgr-si-record-pay"
                                            style={{ color: '#b91c1c' }}
                                            onClick={() => remove(loc)}
                                        >
                                            <Trash2 size={12} style={{ verticalAlign: 'middle' }} />
                                        </button>
                                    ) : null}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {locations.length === 0 && !loading ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>
                    No locations yet.
                </p>
            ) : null}

            {modalOpen ? (
                <Modal
                    title={editing ? 'Edit location' : 'Add location'}
                    width="440px"
                    onClose={() => !busy && setModalOpen(false)}
                >
                    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label htmlFor="sf-loc-name" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                Name *
                            </label>
                            <input
                                id="sf-loc-name"
                                className="sf-movement-input"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                required
                                placeholder="e.g. Shelf A, Riyadh depot"
                            />
                        </div>
                        <div>
                            <label htmlFor="sf-loc-company" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                Company / supplier name (optional)
                            </label>
                            <input
                                id="sf-loc-company"
                                className="sf-movement-input"
                                value={form.companyName}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, companyName: e.target.value }))
                                }
                                placeholder="e.g. CASTROL, ACME Trading"
                            />
                        </div>
                        <div>
                            <label htmlFor="sf-loc-code" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                Code (optional)
                            </label>
                            <input
                                id="sf-loc-code"
                                className="sf-movement-input"
                                value={form.code}
                                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                placeholder="Short code"
                            />
                        </div>
                        {editing?.isSystem ? (
                            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
                                System location — you can rename it but not delete it.
                            </p>
                        ) : null}
                        <div className="sf-movement-form-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={busy}
                                onClick={() => setModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="mgr-si-btn-new" disabled={busy}>
                                {busy ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
