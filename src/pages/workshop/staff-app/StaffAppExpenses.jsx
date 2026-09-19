import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
    listWorkshopExpenseRequests,
    approveExpenseRequest,
    rejectExpenseRequest,
} from '../../../services/employeeExpenseApi';
import { branchScopeParams } from '../../../services/workshopStaffApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';
import { staffAppStatusLabel, useStaffAppI18n } from '../../../utils/staffAppI18n';

const fmt = (n, locale) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function StatusBadge({ status, locale }) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--draft';
    if (s === 'approved') cls = 'staff-app-badge--approved';
    if (s === 'rejected') cls = 'staff-app-badge--rejected';
    if (s === 'pending') cls = 'staff-app-badge--pending';
    return <span className={`staff-app-badge ${cls}`}>{staffAppStatusLabel(locale, status)}</span>;
}

export default function StaffAppExpenses({ selectedBranchId = 'all' }) {
    const scope = useStaffAppScope();
    const { locale, t } = useStaffAppI18n();
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
            setError(e?.message || t('expenses.errLoad'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, scope, t]);

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
            setError(e?.message || t('expenses.errApprove'));
        } finally {
            setActionId(null);
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt(t('expenses.promptReject'));
        if (!reason?.trim()) return;
        setActionId(id);
        try {
            await rejectExpenseRequest(id, { reason: reason.trim() }, scope.scopeParams());
            await load();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (e) {
            setError(e?.message || t('expenses.errReject'));
        } finally {
            setActionId(null);
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>{t('expenses.title')}</h2>
                <select
                    className="staff-app-btn"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">{t('expenses.allStatuses')}</option>
                    <option value="pending">{t('status.pending')}</option>
                    <option value="approved">{t('status.approved')}</option>
                    <option value="rejected">{t('status.rejected')}</option>
                </select>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
            <div className="staff-app-table-wrap">
                {loading ? (
                    <p className="staff-app-empty">{t('common.loading')}</p>
                ) : filtered.length === 0 ? (
                    <p className="staff-app-empty">{t('expenses.empty')}</p>
                ) : (
                    <table className="staff-app-table">
                        <thead>
                            <tr>
                                <th>{t('expenses.th.date')}</th>
                                <th>{t('expenses.th.employee')}</th>
                                <th>{t('expenses.th.category')}</th>
                                <th>{t('expenses.th.amount')}</th>
                                <th>{t('expenses.th.status')}</th>
                                <th>{t('expenses.th.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.expenseDate || row.createdAt?.slice?.(0, 10) || t('common.emdash')}</td>
                                    <td>{row.requestedByName || row.requestedByUserId || t('common.emdash')}</td>
                                    <td>{row.categoryName || row.category?.name || t('common.emdash')}</td>
                                    <td>{fmt(row.totalAmount ?? row.amount, locale)}</td>
                                    <td><StatusBadge status={row.status} locale={locale} /></td>
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
                                                    {t('common.approve')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="staff-app-btn"
                                                    disabled={actionId === row.id}
                                                    onClick={() => handleReject(row.id)}
                                                >
                                                    {t('common.reject')}
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
