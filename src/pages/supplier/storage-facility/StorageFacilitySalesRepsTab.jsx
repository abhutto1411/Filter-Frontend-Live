import React, { useCallback, useEffect, useState } from 'react';
import { BarChart2, Pencil, Plus, Trash2, UserCircle } from 'lucide-react';
import Modal from '../../../components/Modal';
import { ShimmerTable } from '../../../components/supplier/Shimmer';
import {
    createStorageSalesRep,
    deleteStorageSalesRep,
    listStorageSalesReps,
    updateStorageSalesRep,
} from '../../../services/storageFacilityApi';
import StorageFacilitySalesRepPerformancePanel from './StorageFacilitySalesRepPerformancePanel';

export default function StorageFacilitySalesRepsTab({ brandId }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', code: '', mobile: '', email: '' });
    const [busy, setBusy] = useState(false);
    const [filterRepId, setFilterRepId] = useState('');
    const [performanceKey, setPerformanceKey] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listStorageSalesReps(brandId);
            setRows(res?.salesReps ?? []);
        } catch (e) {
            setErr(e?.message || 'Failed to load sales reps');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [brandId]);

    useEffect(() => {
        load();
    }, [load]);

    const openAdd = () => {
        setEditing(null);
        setForm({ name: '', code: '', mobile: '', email: '' });
        setModalOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        setForm({
            name: row.name || '',
            code: row.code || '',
            mobile: row.mobile || '',
            email: row.email || '',
        });
        setModalOpen(true);
    };

    const save = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setBusy(true);
        try {
            if (editing) {
                await updateStorageSalesRep(brandId, editing.id, form);
            } else {
                await createStorageSalesRep(brandId, form);
            }
            setModalOpen(false);
            await load();
            setPerformanceKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || 'Could not save');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (row) => {
        if (!window.confirm(`Remove sales rep "${row.name}"?`)) return;
        try {
            await deleteStorageSalesRep(brandId, row.id);
            if (filterRepId === row.id) setFilterRepId('');
            await load();
            setPerformanceKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || 'Could not delete');
        }
    };

    const viewPerformance = (repId) => {
        setFilterRepId(repId);
        setPerformanceKey((k) => k + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="sf-sales-reps-hub">
            <StorageFacilitySalesRepPerformancePanel
                key={`${performanceKey}-${filterRepId}`}
                brandId={brandId}
                initialSalesRepId={filterRepId}
                onSalesRepIdChange={setFilterRepId}
            />

            <div
                className="sf-sales-reps-manage"
                style={{
                    marginTop: 28,
                    paddingTop: 24,
                    borderTop: '2px solid #e2e8f0',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 12,
                    }}
                >
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <UserCircle size={18} /> Manage representatives
                        </h3>
                        <p className="mgr-si-subtitle" style={{ margin: '4px 0 0' }}>
                            Add reps here; assign them on stock-out movements. Use &quot;View
                            performance&quot; to filter analytics above.
                        </p>
                    </div>
                    <button type="button" className="mgr-si-btn-new" onClick={openAdd}>
                        <Plus size={14} /> Add sales rep
                    </button>
                </div>

                {err ? <div className="mgr-si-error" style={{ marginBottom: 12 }}>{err}</div> : null}

                {loading && rows.length === 0 ? (
                    <ShimmerTable rows={4} columns={5} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Mobile</th>
                                    <th>Email</th>
                                    <th style={{ minWidth: 200 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id}>
                                        <td>
                                            <strong>{r.name}</strong>
                                        </td>
                                        <td>{r.code || '—'}</td>
                                        <td>{r.mobile || '—'}</td>
                                        <td>{r.email || '—'}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="mgr-si-record-pay"
                                                style={{ marginRight: 6 }}
                                                onClick={() => viewPerformance(r.id)}
                                            >
                                                <BarChart2 size={12} /> View performance
                                            </button>
                                            <button
                                                type="button"
                                                className="mgr-si-record-pay"
                                                style={{ marginRight: 6 }}
                                                onClick={() => openEdit(r)}
                                            >
                                                <Pencil size={12} /> Edit
                                            </button>
                                            <button
                                                type="button"
                                                className="mgr-si-record-pay"
                                                style={{ color: '#b91c1c' }}
                                                onClick={() => remove(r)}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {rows.length === 0 && !loading ? (
                    <p style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
                        No sales reps yet — add one to track performance on stock sales.
                    </p>
                ) : null}
            </div>

            {modalOpen ? (
                <Modal
                    title={editing ? 'Edit sales rep' : 'Add sales rep'}
                    width="440px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !busy && setModalOpen(false)}
                >
                    <form className="sf-simple-form" onSubmit={save}>
                        <div className="sf-form-field">
                            <label>Name *</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="sf-form-field">
                            <label>Code</label>
                            <input
                                value={form.code}
                                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                            />
                        </div>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label>Mobile</label>
                                <input
                                    value={form.mobile}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, mobile: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="sf-form-field">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, email: e.target.value }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="sf-form-actions">
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
