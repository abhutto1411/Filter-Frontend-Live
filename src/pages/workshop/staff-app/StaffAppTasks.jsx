import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { listStaffTasks, createStaffTask, updateStaffTask } from '../../../services/staffAppApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';
import {
    PRIORITY_KEYS,
    TASK_STATUS_KEYS,
    staffAppStatusLabel,
    useStaffAppI18n,
} from '../../../utils/staffAppI18n';

function StatusBadge({ status, locale }) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--pending';
    if (s === 'completed') cls = 'staff-app-badge--approved';
    if (s === 'open') cls = 'staff-app-badge--draft';
    return <span className={`staff-app-badge ${cls}`}>{staffAppStatusLabel(locale, status)}</span>;
}

export default function StaffAppTasks({ selectedBranchId = 'all' }) {
    const scope = useStaffAppScope();
    const { locale, t } = useStaffAppI18n();
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
            setError(e?.message || t('tasks.errLoad'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [scope, t]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!form.title.trim()) {
            setError(t('tasks.errTitle'));
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
            setError(e?.message || t('tasks.errCreate'));
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>{t('tasks.title')}</h2>
                <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => setFormOpen(true)}>
                    <Plus size={14} /> {t('tasks.new')}
                </button>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
            {formOpen && (
                <div className="staff-app-table-wrap" style={{ padding: 16, marginBottom: 12 }}>
                    <input className="staff-app-btn" style={{ width: '100%', marginBottom: 8 }} placeholder={t('tasks.ph.title')} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    <textarea className="staff-app-btn" rows={2} style={{ width: '100%', marginBottom: 8 }} placeholder={t('tasks.ph.description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                    <select className="staff-app-btn" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                        {PRIORITY_KEYS.map((p) => <option key={p.value} value={p.value}>{t(p.labelKey)}</option>)}
                    </select>
                    <input type="date" className="staff-app-btn" style={{ marginTop: 8 }} value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleCreate}>{t('common.create')}</button>
                        <button type="button" className="staff-app-btn" onClick={() => setFormOpen(false)}>{t('common.cancel')}</button>
                    </div>
                </div>
            )}
            <div className="staff-app-table-wrap">
                {loading ? <p className="staff-app-empty">{t('common.loading')}</p> : rows.length === 0 ? (
                    <p className="staff-app-empty">{t('tasks.empty')}</p>
                ) : (
                    <table className="staff-app-table">
                        <thead>
                            <tr>
                                <th>{t('tasks.th.title')}</th>
                                <th>{t('tasks.th.priority')}</th>
                                <th>{t('tasks.th.deadline')}</th>
                                <th>{t('tasks.th.status')}</th>
                                <th>{t('tasks.th.update')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.title}</td>
                                    <td>{PRIORITY_KEYS.find((x) => x.value === row.priority) ? t(PRIORITY_KEYS.find((x) => x.value === row.priority).labelKey) : row.priority}</td>
                                    <td>{row.deadline || t('common.emdash')}</td>
                                    <td><StatusBadge status={row.status} locale={locale} /></td>
                                    <td>
                                        <select
                                            className="staff-app-btn"
                                            value={row.status}
                                            onChange={(e) => updateStaffTask(row.id, { status: e.target.value }, scope.scopeParams()).then(load)}
                                        >
                                            {TASK_STATUS_KEYS.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
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
