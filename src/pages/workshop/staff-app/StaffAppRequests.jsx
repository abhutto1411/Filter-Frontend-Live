import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import {
    listStaffDemands,
    createStaffDemand,
    submitStaffDemand,
    updateStaffDemand,
} from '../../../services/staffAppApi';
import { branchScopeParams } from '../../../services/workshopStaffApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';

const REQUEST_TYPES = [
    'Material Request',
    'Purchase Request',
    'Vehicle Request',
    'Maintenance Request',
    'Office Request',
    'Cash Request',
    'Marketing Request',
];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--draft';
    if (['approved', 'completed'].includes(s)) cls = 'staff-app-badge--approved';
    if (s === 'rejected') cls = 'staff-app-badge--rejected';
    if (['submitted', 'under review', 'pending'].includes(s)) cls = 'staff-app-badge--pending';
    return <span className={`staff-app-badge ${cls}`}>{status || '—'}</span>;
}

export default function StaffAppRequests({ selectedBranchId = 'all', branches = [] }) {
    const scope = useStaffAppScope();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState('active');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({
        title: '',
        type: REQUEST_TYPES[0],
        priority: 'Medium',
        description: '',
        targetDate: '',
        estimatedCost: '',
        branchId: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listStaffDemands(
                staffAppQueryParams({ ...branchScopeParams(selectedBranchId), view }, scope),
            );
            setRows(res?.items ?? res?.data?.items ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load requests.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, view, scope]);

    useEffect(() => { load(); }, [load]);

    const branchOptions = useMemo(
        () => branches.filter((b) => b.id != null),
        [branches],
    );

    const handleCreate = async () => {
        if (!form.title.trim()) {
            setError('Title is required.');
            return;
        }
        setError('');
        try {
            const body = {
                title: form.title.trim(),
                type: form.type,
                priority: form.priority,
                description: form.description.trim() || undefined,
                targetDate: form.targetDate || undefined,
                estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
                branchId: form.branchId || undefined,
            };
            const res = await createStaffDemand(body, scope.scopeParams());
            const id = res?.demand?.id ?? res?.data?.id ?? res?.id;
            if (id) await submitStaffDemand(id, scope.scopeParams());
            setFormOpen(false);
            setForm({
                title: '',
                type: REQUEST_TYPES[0],
                priority: 'Medium',
                description: '',
                targetDate: '',
                estimatedCost: '',
                branchId: '',
            });
            await load();
        } catch (e) {
            setError(e?.message || 'Create failed.');
        }
    };

    const handleStatus = async (id, status) => {
        try {
            await updateStaffDemand(id, { status }, scope.scopeParams());
            await load();
        } catch (e) {
            setError(e?.message || 'Update failed.');
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>Requests</h2>
                <select className="staff-app-btn" value={view} onChange={(e) => setView(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="history">History</option>
                </select>
                <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => setFormOpen(true)}>
                    <Plus size={14} /> New request
                </button>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
            {formOpen && (
                <div className="staff-app-table-wrap" style={{ padding: 16, marginBottom: 12 }}>
                    <h3 style={{ marginTop: 0 }}>New request</h3>
                    <div style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
                        <input className="staff-app-btn" style={{ width: '100%' }} placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                        <select className="staff-app-btn" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                            {REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select className="staff-app-btn" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input type="date" className="staff-app-btn" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} />
                        <input className="staff-app-btn" placeholder="Estimated cost (SAR)" value={form.estimatedCost} onChange={(e) => setForm((f) => ({ ...f, estimatedCost: e.target.value }))} />
                        {branchOptions.length > 0 && (
                            <select className="staff-app-btn" value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
                                <option value="">Branch (optional)</option>
                                {branchOptions.map((b) => (
                                    <option key={b.id} value={String(b.id)}>{b.name}</option>
                                ))}
                            </select>
                        )}
                        <textarea className="staff-app-btn" rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleCreate}>Submit</button>
                            <button type="button" className="staff-app-btn" onClick={() => setFormOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="staff-app-table-wrap">
                {loading ? (
                    <p className="staff-app-empty">Loading…</p>
                ) : rows.length === 0 ? (
                    <p className="staff-app-empty">No requests.</p>
                ) : (
                    <table className="staff-app-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Title</th>
                                <th>Type</th>
                                <th>Priority</th>
                                <th>Target</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.requestNumber || row.id}</td>
                                    <td>{row.title}</td>
                                    <td>{row.type}</td>
                                    <td>{row.priority}</td>
                                    <td>{row.targetDate || '—'}</td>
                                    <td>{statusBadge(row.status)}</td>
                                    <td>
                                        {['Submitted', 'Under Review', 'Approved'].includes(row.status) && (
                                            <button type="button" className="staff-app-btn" onClick={() => handleStatus(row.id, 'Completed')}>
                                                Complete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
