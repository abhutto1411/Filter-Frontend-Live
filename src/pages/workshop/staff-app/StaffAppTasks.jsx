import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { listStaffTasks, createStaffTask, updateStaffTask } from '../../../services/staffAppApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['Open', 'Assigned', 'In Progress', 'Waiting', 'Completed'];

function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--pending';
    if (s === 'completed') cls = 'staff-app-badge--approved';
    if (s === 'open') cls = 'staff-app-badge--draft';
    return <span className={`staff-app-badge ${cls}`}>{status || '—'}</span>;
}

export default function StaffAppTasks({ selectedBranchId = 'all' }) {
    const scope = useStaffAppScope();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({
        title: '',
        description: '',
        priority: 'Medium',
        deadline: '',
        assignedToUserId: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listStaffTasks(staffAppQueryParams({ limit: 100 }, scope));
            setRows(res?.items ?? res?.data?.items ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load tasks.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [scope]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!form.title.trim()) {
            setError('Title required.');
            return;
        }
        try {
            await createStaffTask({
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                priority: form.priority,
                deadline: form.deadline || undefined,
                assignedToUserId: form.assignedToUserId || undefined,
            }, scope.scopeParams());
            setFormOpen(false);
            setForm({ title: '', description: '', priority: 'Medium', deadline: '', assignedToUserId: '' });
            await load();
        } catch (e) {
            setError(e?.message || 'Create failed.');
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>Tasks</h2>
                <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => setFormOpen(true)}>
                    <Plus size={14} /> New task
                </button>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
            {formOpen && (
                <div className="staff-app-table-wrap" style={{ padding: 16, marginBottom: 12 }}>
                    <input className="staff-app-btn" style={{ width: '100%', marginBottom: 8 }} placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    <textarea className="staff-app-btn" rows={2} style={{ width: '100%', marginBottom: 8 }} placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                    <select className="staff-app-btn" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input type="date" className="staff-app-btn" style={{ marginTop: 8 }} value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleCreate}>Create</button>
                        <button type="button" className="staff-app-btn" onClick={() => setFormOpen(false)}>Cancel</button>
                    </div>
                </div>
            )}
            <div className="staff-app-table-wrap">
                {loading ? <p className="staff-app-empty">Loading…</p> : rows.length === 0 ? (
                    <p className="staff-app-empty">No tasks.</p>
                ) : (
                    <table className="staff-app-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Priority</th>
                                <th>Deadline</th>
                                <th>Status</th>
                                <th>Update</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.title}</td>
                                    <td>{row.priority}</td>
                                    <td>{row.deadline || '—'}</td>
                                    <td>{statusBadge(row.status)}</td>
                                    <td>
                                        <select
                                            className="staff-app-btn"
                                            value={row.status}
                                            onChange={(e) => updateStaffTask(row.id, { status: e.target.value }, scope.scopeParams()).then(load)}
                                        >
                                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
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
