import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Boxes, ChevronRight } from 'lucide-react';
import Modal from '../../../components/Modal';
import { ShimmerTable } from '../../../components/supplier/Shimmer';
import {
    createStorageBrand,
    listStorageBrands,
} from '../../../services/storageFacilityApi';
import '../../../styles/admin/AccountingPage.css';

function readPortalScope() {
    try {
        const u = JSON.parse(localStorage.getItem('filter_auth_user') || '{}');
        return u?.supplier?.portalScope ?? 'owner';
    } catch {
        return 'owner';
    }
}

export default function SupplierStorageFacilityBrands() {
    const navigate = useNavigate();
    const isOwner = readPortalScope() !== 'storage_brand';
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({
        name: '',
        code: '',
        contactPerson: '',
        email: '',
        mobile: '',
    });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listStorageBrands();
            setRows(Array.isArray(res?.brands) ? res.brands : []);
        } catch (e) {
            setErr(e?.message || 'Failed to load brands');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!isOwner && rows.length === 1) {
            navigate(`/supplier/storage_facility?brand=${rows[0].id}`, { replace: true });
        }
    }, [isOwner, rows, navigate]);

    const openBrand = (id) => {
        navigate(`/supplier/storage_facility?brand=${encodeURIComponent(id)}`);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            await createStorageBrand(form);
            setModalOpen(false);
            setForm({ name: '', code: '', contactPerson: '', email: '', mobile: '' });
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Could not create brand');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mgr-si-page">
            <header className="mgr-si-header">
                <h2 className="mgr-si-title">Storage Facility</h2>
                <p className="mgr-si-subtitle">
                    Sub-warehouses for brands (Castrol, Shell, Fuchs, etc.). Each brand has isolated
                    products, stock, movements, and AR. Withdrawal invoices can map stock into your main
                    warehouse catalog.
                </p>
            </header>

            {err ? <div className="mgr-si-error">{err}</div> : null}

            {isOwner ? (
                <div style={{ marginBottom: 16 }}>
                    <button type="button" className="mgr-si-btn-new" onClick={() => setModalOpen(true)}>
                        <Plus size={16} /> Add brand
                    </button>
                </div>
            ) : null}

            <div className="premium-table mgr-si-table-wrap">
                {loading ? (
                    <div style={{ padding: 16 }}>
                        <ShimmerTable rows={6} columns={6} />
                    </div>
                ) : (
                    <table className="mgr-si-table">
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-th">Brand</th>
                                <th className="table-th">Products</th>
                                <th className="table-th">Total qty</th>
                                <th className="table-th">AR balance</th>
                                <th className="table-th">Users</th>
                                <th className="table-th" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="table-cell table-empty">
                                        <Boxes
                                            size={36}
                                            style={{
                                                opacity: 0.25,
                                                margin: '0 auto 12px',
                                                display: 'block',
                                            }}
                                        />
                                        No storage brands yet. Add Castrol, Shell, or any lessee.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((b) => (
                                    <tr
                                        key={b.id}
                                        className="table-row"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => openBrand(b.id)}
                                    >
                                        <td className="table-cell cell-main-text">{b.name}</td>
                                        <td className="table-cell">{b.productCount}</td>
                                        <td className="table-cell">{b.totalQty}</td>
                                        <td className="table-cell mgr-si-cell-balance">
                                            SAR {Number(b.arBalance || 0).toLocaleString()}
                                        </td>
                                        <td className="table-cell">{b.userCount}</td>
                                        <td className="table-cell">
                                            <ChevronRight size={18} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {modalOpen ? (
                <Modal title="Add storage brand" onClose={() => !saving && setModalOpen(false)}>
                    <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label>
                            Brand name *
                            <input
                                className="mgr-si-search-input"
                                style={{ width: '100%', marginTop: 4 }}
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Castrol"
                                required
                            />
                        </label>
                        <label>
                            Code
                            <input
                                className="mgr-si-search-input"
                                style={{ width: '100%', marginTop: 4 }}
                                value={form.code}
                                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                            />
                        </label>
                        <label>
                            Contact
                            <input
                                className="mgr-si-search-input"
                                style={{ width: '100%', marginTop: 4 }}
                                value={form.contactPerson}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, contactPerson: e.target.value }))
                                }
                            />
                        </label>
                        <button type="submit" className="mgr-si-btn-new" disabled={saving}>
                            {saving ? 'Saving…' : 'Create brand'}
                        </button>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
