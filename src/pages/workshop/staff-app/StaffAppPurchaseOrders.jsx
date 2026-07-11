import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import {
    listWorkshopPurchaseOrders,
    createWorkshopPurchaseOrder,
    submitWorkshopPurchaseOrder,
} from '../../../services/staffAppApi';
import { getWorkshopSuppliers, branchScopeParams } from '../../../services/workshopStaffApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';

function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--draft';
    if (['confirmed', 'delivered', 'completed'].includes(s)) cls = 'staff-app-badge--approved';
    if (s === 'cancelled' || s === 'rejected') cls = 'staff-app-badge--rejected';
    if (s === 'sent' || s === 'submitted') cls = 'staff-app-badge--pending';
    return <span className={`staff-app-badge ${cls}`}>{status || '—'}</span>;
}

export default function StaffAppPurchaseOrders({ selectedBranchId = 'all', branches = [] }) {
    const scope = useStaffAppScope();
    const [rows, setRows] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({
        supplierId: '',
        branchId: '',
        productName: '',
        qty: '1',
        unitPrice: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listWorkshopPurchaseOrders(
                staffAppQueryParams({ limit: 100 }, scope),
            );
            setRows(res?.orders ?? res?.purchaseOrders ?? res?.items ?? res?.data ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load purchase orders.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [scope]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        getWorkshopSuppliers(staffAppQueryParams({ limit: 200 }, scope))
            .then((res) => setSuppliers(res?.suppliers ?? res?.items ?? []))
            .catch(() => setSuppliers([]));
    }, [scope]);

    const handleCreate = async () => {
        const branchId =
            form.branchId ||
            (selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '');
        if (!form.supplierId || !form.productName.trim() || !branchId) {
            setError('Supplier, product name, and branch are required.');
            return;
        }
        const qty = Number(form.qty);
        const unitPrice = Number(form.unitPrice);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
            setError('Valid quantity and unit price required.');
            return;
        }
        setError('');
        try {
            const body = {
                supplierId: form.supplierId,
                branchId,
                items: [{
                    productName: form.productName.trim(),
                    qty,
                    unitPrice,
                }],
            };
            const res = await createWorkshopPurchaseOrder(body, scope.scopeParams());
            const id = res?.order?.id ?? res?.id;
            if (id) await submitWorkshopPurchaseOrder(id, scope.scopeParams());
            setFormOpen(false);
            setForm({ supplierId: '', branchId: '', productName: '', qty: '1', unitPrice: '' });
            await load();
        } catch (e) {
            setError(e?.message || 'Create PO failed.');
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>Purchase Orders</h2>
                <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => setFormOpen(true)}>
                    <Plus size={14} /> New PO
                </button>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
            {formOpen && (
                <div className="staff-app-table-wrap" style={{ padding: 16, marginBottom: 12 }}>
                    <h3 style={{ marginTop: 0 }}>New purchase order</h3>
                    <div style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
                        <select className="staff-app-btn" value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}>
                            <option value="">Select supplier</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={String(s.id)}>{s.name || s.supplierName}</option>
                            ))}
                        </select>
                        {branches.length > 0 && (
                            <select className="staff-app-btn" value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
                                <option value="">Branch</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={String(b.id)}>{b.name}</option>
                                ))}
                            </select>
                        )}
                        <input className="staff-app-btn" placeholder="Product name" value={form.productName} onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} />
                        <input className="staff-app-btn" placeholder="Qty" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
                        <input className="staff-app-btn" placeholder="Unit price (SAR)" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleCreate}>Create &amp; send</button>
                            <button type="button" className="staff-app-btn" onClick={() => setFormOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="staff-app-table-wrap">
                {loading ? (
                    <p className="staff-app-empty">Loading…</p>
                ) : rows.length === 0 ? (
                    <p className="staff-app-empty">No purchase orders.</p>
                ) : (
                    <table className="staff-app-table">
                        <thead>
                            <tr>
                                <th>PO #</th>
                                <th>Supplier</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.poNumber || row.orderNumber || row.id}</td>
                                    <td>{row.supplierName || row.supplier?.name || '—'}</td>
                                    <td>{statusBadge(row.status)}</td>
                                    <td>{Number(row.totalAmount ?? row.amount ?? 0).toLocaleString('en-SA')}</td>
                                    <td>{row.createdAt?.slice?.(0, 10) || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
