import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
    listWorkshopExpenseRequests,
    approveExpenseRequest,
    rejectExpenseRequest,
} from '../../../services/employeeExpenseApi';
import { branchScopeParams } from '../../../services/workshopStaffApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--draft';
    if (s === 'approved') cls = 'staff-app-badge--approved';
    if (s === 'rejected') cls = 'staff-app-badge--rejected';
    if (s === 'pending') cls = 'staff-app-badge--pending';
    return <span className={`staff-app-badge ${cls}`}>{status || '—'}</span>;
}

export default function StaffAppExpenses({ selectedBranchId = 'all' }) {
    const scope = useStaffAppScope();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [actionId, setActionId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listWorkshopExpenseRequests(
                staffAppQueryParams({ ...branchScopeParams(selectedBranchId), limit: 200 }, scope),
            );
            setRows(res?.items ?? res?.data?.items ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load expenses.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, scope]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        if (statusFilter === 'all') return rows;
        return rows.filter((r) => String(r.status).toLowerCase() === statusFilter);
    }, [rows, statusFilter]);

    const handleApprove = async (id) => {
        setActionId(id);
        try {
            await approveExpenseRequest(id, {}, scope.scopeParams());
            await load();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (e) {
            setError(e?.message || 'Approve failed.');
        } finally {
            setActionId(null);
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt('Rejection reason:');
        if (!reason?.trim()) return;
        setActionId(id);
        try {
            await rejectExpenseRequest(id, { rejectionReason: reason.trim() }, scope.scopeParams());
            await load();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (e) {
            setError(e?.message || 'Reject failed.');
        } finally {
            setActionId(null);
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>Expenses</h2>
                <select
                    className="staff-app-btn"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
            <div className="staff-app-table-wrap">
                {loading ? (
                    <p className="staff-app-empty">Loading…</p>
                ) : filtered.length === 0 ? (
                    <p className="staff-app-empty">No expense requests.</p>
                ) : (
                    <table className="staff-app-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Employee</th>
                                <th>Category</th>
                                <th>Amount (SAR)</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.expenseDate || row.createdAt?.slice?.(0, 10) || '—'}</td>
                                    <td>{row.requestedByName || row.requestedByUserId || '—'}</td>
                                    <td>{row.categoryName || row.category?.name || '—'}</td>
                                    <td>{fmt(row.totalAmount ?? row.amount)}</td>
                                    <td>{statusBadge(row.status)}</td>
                                    <td>
                                        {String(row.status).toLowerCase() === 'pending' && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="staff-app-btn staff-app-btn--primary"
                                                    style={{ marginRight: 6 }}
                                                    disabled={actionId === row.id}
                                                    onClick={() => handleApprove(row.id)}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    className="staff-app-btn"
                                                    disabled={actionId === row.id}
                                                    onClick={() => handleReject(row.id)}
                                                >
                                                    Reject
                                                </button>
                                            </>
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
