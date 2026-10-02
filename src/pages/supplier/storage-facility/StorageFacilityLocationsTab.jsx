import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import Modal from '../../../components/Modal';
import RowActionsMenu from '../../../components/RowActionsMenu';
import { ShimmerTable } from '../../../components/supplier/Shimmer';
const KIND_LABEL = {
    brand_storage: 'Storage facility',
    brand_site: 'Transfer source (factory / external site)',
    owner_warehouse: 'Your main warehouse',
};

export default function StorageFacilityLocationsTab({ brandId }) {
    const sfApi = useStorageFacilityApi();
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
            const res = await sfApi.listStorageLocations(brandId);
            setLocations(res?.locations ?? []);
        } catch (e) {
            setErr(e?.message || 'Failed to load locations');
            setLocations([]);
        } finally {
            setLoading(false);
        }
    }, [brandId, sfApi]);

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
                await sfApi.updateStorageLocation(brandId, editing.id, {
                    name: form.name.trim(),
                    code: form.code.trim() || undefined,
                    companyName: form.companyName.trim() || undefined,
                });
            } else {
                await sfApi.createStorageLocation(brandId, {
                    name: form.name.trim(),
                    code: form.code.trim() || undefined,
                    companyName: form.companyName.trim() || undefined,
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
            await sfApi.deleteStorageLocation(brandId, loc.id);
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
                Add transfer sources for brand factories or off-site depots (e.g. Riyadh, CASTROL).
                Receive stock from those locations into your storage facility via Stock transfers.
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
                                    <RowActionsMenu
                                        ariaLabel={`Actions for ${loc.name || 'location'}`}
                                        items={[
                                            {
                                                label: 'Edit',
                                                onClick: () => openEdit(loc),
                                            },
                                            {
                                                label: 'Delete',
                                                onClick: () => remove(loc),
                                                hidden: Boolean(loc.isSystem),
                                                danger: true,
                                            },
                                        ]}
                                    />
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
                                placeholder="e.g. Riyadh depot, CASTROL factory"
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
