import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { listLeaveRequests, createLeaveRequest, updateLeaveRequest } from '../../../services/staffAppApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';
import {
    LEAVE_TYPE_KEYS,
    staffAppStatusLabel,
    useStaffAppI18n,
} from '../../../utils/staffAppI18n';

function StatusBadge({ status, locale }) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--pending';
    if (s.includes('approved')) cls = 'staff-app-badge--approved';
    if (s === 'rejected') cls = 'staff-app-badge--rejected';
    return <span className={`staff-app-badge ${cls}`}>{staffAppStatusLabel(locale, status)}</span>;
}

export default function StaffAppLeave({ selectedBranchId = 'all' }) {
    const scope = useStaffAppScope();
    const { locale, t } = useStaffAppI18n();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({
        leaveType: LEAVE_TYPE_KEYS[0].value,
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
            setError(e?.message || t('leave.errLoad'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [scope, t]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!form.startDate || !form.endDate) {
            setError(t('leave.errDates'));
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
            setError(e?.message || t('leave.errCreate'));
        }
    };

    const handleApprove = async (id, action) => {
        try {
            await updateLeaveRequest(id, { action }, scope.scopeParams());
            await load();
        } catch (e) {
            setError(e?.message || t('leave.errAction'));
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>{t('leave.title')}</h2>
                <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => setFormOpen(true)}>
                    <Plus size={14} /> {t('leave.new')}
                </button>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
            {formOpen && (
                <div className="staff-app-table-wrap" style={{ padding: 16, marginBottom: 12 }}>
                    <select className="staff-app-btn" value={form.leaveType} onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))}>
                        {LEAVE_TYPE_KEYS.map((lt) => <option key={lt.value} value={lt.value}>{t(lt.labelKey)}</option>)}
                    </select>
                    <input type="date" className="staff-app-btn" style={{ marginTop: 8 }} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                    <input type="date" className="staff-app-btn" style={{ marginTop: 8 }} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                    <textarea className="staff-app-btn" rows={2} style={{ marginTop: 8, width: '100%' }} placeholder={t('leave.ph.reason')} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleCreate}>{t('common.submit')}</button>
                        <button type="button" className="staff-app-btn" onClick={() => setFormOpen(false)}>{t('common.cancel')}</button>
                    </div>
                </div>
            )}
            <div className="staff-app-table-wrap">
                {loading ? <p className="staff-app-empty">{t('common.loading')}</p> : rows.length === 0 ? (
                    <p className="staff-app-empty">{t('leave.empty')}</p>
                ) : (
                    <table className="staff-app-table">
                        <thead>
                            <tr>
                                <th>{t('leave.th.employee')}</th>
                                <th>{t('leave.th.type')}</th>
                                <th>{t('leave.th.from')}</th>
                                <th>{t('leave.th.to')}</th>
                                <th>{t('leave.th.days')}</th>
                                <th>{t('leave.th.status')}</th>
                                <th>{t('leave.th.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.employeeName || row.employeeId || t('common.emdash')}</td>
                                    <td>{LEAVE_TYPE_KEYS.find((x) => x.value === row.leaveType) ? t(LEAVE_TYPE_KEYS.find((x) => x.value === row.leaveType).labelKey) : row.leaveType}</td>
                                    <td>{row.startDate}</td>
                                    <td>{row.endDate}</td>
                                    <td>{row.days ?? t('common.emdash')}</td>
                                    <td><StatusBadge status={row.status} locale={locale} /></td>
                                    <td>
                                        {row.status === 'Pending' && (
                                            <>
                                                <button type="button" className="staff-app-btn staff-app-btn--primary" style={{ marginRight: 4 }} onClick={() => handleApprove(row.id, 'manager_approve')}>{t('leave.managerOk')}</button>
                                                <button type="button" className="staff-app-btn" onClick={() => handleApprove(row.id, 'reject')}>{t('common.reject')}</button>
                                            </>
                                        )}
                                        {row.status === 'Manager Approved' && (
                                            <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => handleApprove(row.id, 'hr_approve')}>{t('leave.hrApprove')}</button>
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
