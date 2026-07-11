import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Boxes, ChevronRight } from 'lucide-react';
import Modal from '../../../components/Modal';
import { ShimmerTable } from '../../../components/supplier/Shimmer';
import {
    useStorageFacilityApi,
    useStorageFacilityPortal,
} from './StorageFacilityPortalContext';
import '../../../styles/admin/AccountingPage.css';

export default function SupplierStorageFacilityBrands() {
    const navigate = useNavigate();
    const { routeBase, parentRoute, supplierName, isOwner } = useStorageFacilityPortal();
    const sfApi = useStorageFacilityApi();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [q, setQ] = useState('');
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
            const res = await sfApi.listStorageBrands();
            setRows(Array.isArray(res?.brands) ? res.brands : []);
        } catch (e) {
            setErr(e?.message || 'Failed to load brands');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [sfApi]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!isOwner && rows.length === 1) {
            navigate(`${routeBase}?brand=${rows[0].id}`, { replace: true });
        }
    }, [isOwner, rows, navigate, routeBase]);

    const openBrand = (id) => {
        navigate(`${routeBase}?brand=${encodeURIComponent(id)}`);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            await sfApi.createStorageBrand(form);
            setModalOpen(false);
            setForm({ name: '', code: '', contactPerson: '', email: '', mobile: '' });
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Could not create brand');
        } finally {
            setSaving(false);
        }
    };

    const filtered = rows.filter((b) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return true;
        return String(b.name || '')
            .toLowerCase()
            .includes(needle);
    });

    return (
        <div className="mgr-si-page">
            {parentRoute ? (
                <button
                    type="button"
                    className="btn-portal-outline"
                    style={{ marginBottom: 12 }}
                    onClick={() => navigate(parentRoute)}
                >
                    <ArrowLeft size={14} /> All suppliers
                </button>
            ) : null}

            <header className="mgr-si-header">
                <div className="mgr-si-header-top">
                    <h2 className="mgr-si-title" style={{ margin: 0 }}>
                        {supplierName ? supplierName : 'Storage Facility'}
                    </h2>
                    {isOwner ? (
                        <button type="button" className="mgr-si-btn-new" onClick={() => setModalOpen(true)}>
                            <Plus size={16} /> Add brand
                        </button>
                    ) : null}
                </div>
                <p className="mgr-si-subtitle">
                    Sub-warehouses for brands (Castrol, Shell, Fuchs, etc.). Each brand has isolated
                    products, stock, movements, and AR. Withdrawal invoices can map stock into your main
                    warehouse catalog.
                </p>
            </header>

            {err ? <div className="mgr-si-error">{err}</div> : null}

            <div style={{ marginBottom: 16 }}>
                <input
                    className="mgr-si-search-input"
                    placeholder="Search brands…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ maxWidth: 360 }}
                />
            </div>

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
                            {filtered.length === 0 ? (
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
                                filtered.map((b) => (
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
