import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { listLeaveRequests, createLeaveRequest, updateLeaveRequest } from '../../../services/staffAppApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';

const LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'Emergency Leave', 'Unpaid Leave'];

function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--pending';
    if (s.includes('approved')) cls = 'staff-app-badge--approved';
    if (s === 'rejected') cls = 'staff-app-badge--rejected';
    return <span className={`staff-app-badge ${cls}`}>{status || '—'}</span>;
}

export default function StaffAppLeave({ selectedBranchId = 'all' }) {
    const scope = useStaffAppScope();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({
        leaveType: LEAVE_TYPES[0],
        startDate: '',
        endDate: '',
        reason: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listLeaveRequests(staffAppQueryParams({ limit: 100 }, scope));
            setRows(res?.items ?? res?.data?.items ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load leave requests.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [scope]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!form.startDate || !form.endDate) {
            setError('Start and end dates required.');
            return;
        }
        try {
            await createLeaveRequest({
                leaveType: form.leaveType,
                startDate: form.startDate,
                endDate: form.endDate,
                reason: form.reason.trim() || undefined,
            }, scope.scopeParams());
            setFormOpen(false);
            await load();
        } catch (e) {
            setError(e?.message || 'Create failed.');
        }
    };

    const handleApprove = async (id, action) => {
        try {
            await updateLeaveRequest(id, { action }, scope.scopeParams());
            await load();
        } catch (e) {
            setError(e?.message || 'Action failed.');
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>Leave</h2>
                <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => setFormOpen(true)}>
                    <Plus size={14} /> New leave
                </button>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
            {formOpen && (
                <div className="staff-app-table-wrap" style={{ padding: 16, marginBottom: 12 }}>
                    <select className="staff-app-btn" value={form.leaveType} onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))}>
                        {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="date" className="staff-app-btn" style={{ marginTop: 8 }} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                    <input type="date" className="staff-app-btn" style={{ marginTop: 8 }} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                    <textarea className="staff-app-btn" rows={2} style={{ marginTop: 8, width: '100%' }} placeholder="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleCreate}>Submit</button>
                        <button type="button" className="staff-app-btn" onClick={() => setFormOpen(false)}>Cancel</button>
                    </div>
                </div>
            )}
            <div className="staff-app-table-wrap">
                {loading ? <p className="staff-app-empty">Loading…</p> : rows.length === 0 ? (
                    <p className="staff-app-empty">No leave requests.</p>
                ) : (
                    <table className="staff-app-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Type</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Days</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.employeeName || row.employeeId || '—'}</td>
                                    <td>{row.leaveType}</td>
                                    <td>{row.startDate}</td>
                                    <td>{row.endDate}</td>
                                    <td>{row.days ?? '—'}</td>
                                    <td>{statusBadge(row.status)}</td>
                                    <td>
                                        {row.status === 'Pending' && (
                                            <>
                                                <button type="button" className="staff-app-btn staff-app-btn--primary" style={{ marginRight: 4 }} onClick={() => handleApprove(row.id, 'manager_approve')}>Manager OK</button>
                                                <button type="button" className="staff-app-btn" onClick={() => handleApprove(row.id, 'reject')}>Reject</button>
                                            </>
                                        )}
                                        {row.status === 'Manager Approved' && (
                                            <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => handleApprove(row.id, 'hr_approve')}>HR approve</button>
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
