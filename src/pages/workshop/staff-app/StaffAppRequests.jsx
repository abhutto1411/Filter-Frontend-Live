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
import {
    REQUEST_TYPE_KEYS,
    PRIORITY_KEYS,
    staffAppStatusLabel,
    useStaffAppI18n,
} from '../../../utils/staffAppI18n';

function StatusBadge({ status, locale }) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--draft';
    if (['approved', 'completed'].includes(s)) cls = 'staff-app-badge--approved';
    if (s === 'rejected') cls = 'staff-app-badge--rejected';
    if (['submitted', 'under review', 'pending'].includes(s)) cls = 'staff-app-badge--pending';
    return <span className={`staff-app-badge ${cls}`}>{staffAppStatusLabel(locale, status)}</span>;
}

export default function StaffAppRequests({ selectedBranchId = 'all', branches = [] }) {
    const scope = useStaffAppScope();
    const { locale, t } = useStaffAppI18n();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState('active');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({
        title: '',
        type: REQUEST_TYPE_KEYS[0].value,
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
            setError(e?.message || t('requests.errLoad'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, view, scope, t]);

    useEffect(() => { load(); }, [load]);

    const branchOptions = useMemo(
        () => branches.filter((b) => b.id != null),
        [branches],
    );

    const handleCreate = async () => {
        if (!form.title.trim()) {
            setError(t('requests.errTitle'));
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
                type: REQUEST_TYPE_KEYS[0].value,
                priority: 'Medium',
                description: '',
                targetDate: '',
                estimatedCost: '',
                branchId: '',
            });
            await load();
        } catch (e) {
            setError(e?.message || t('requests.errCreate'));
        }
    };

    const handleStatus = async (id, status) => {
        try {
            await updateStaffDemand(id, { status }, scope.scopeParams());
            await load();
        } catch (e) {
            setError(e?.message || t('requests.errUpdate'));
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>{t('requests.title')}</h2>
                <select className="staff-app-btn" value={view} onChange={(e) => setView(e.target.value)}>
                    <option value="active">{t('requests.active')}</option>
                    <option value="history">{t('requests.history')}</option>
                </select>
                <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => setFormOpen(true)}>
                    <Plus size={14} /> {t('requests.new')}
                </button>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
            {formOpen && (
                <div className="staff-app-table-wrap" style={{ padding: 16, marginBottom: 12 }}>
                    <h3 style={{ marginTop: 0 }}>{t('requests.new')}</h3>
                    <div style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
                        <input className="staff-app-btn" style={{ width: '100%' }} placeholder={t('requests.ph.title')} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                        <select className="staff-app-btn" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                            {REQUEST_TYPE_KEYS.map((rt) => <option key={rt.value} value={rt.value}>{t(rt.labelKey)}</option>)}
                        </select>
                        <select className="staff-app-btn" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                            {PRIORITY_KEYS.map((p) => <option key={p.value} value={p.value}>{t(p.labelKey)}</option>)}
                        </select>
                        <input type="date" className="staff-app-btn" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} />
                        <input className="staff-app-btn" placeholder={t('requests.ph.cost')} value={form.estimatedCost} onChange={(e) => setForm((f) => ({ ...f, estimatedCost: e.target.value }))} />
                        {branchOptions.length > 0 && (
                            <select className="staff-app-btn" value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
                                <option value="">{t('common.branchOptional')}</option>
                                {branchOptions.map((b) => (
                                    <option key={b.id} value={String(b.id)}>{b.name}</option>
                                ))}
                            </select>
                        )}
                        <textarea className="staff-app-btn" rows={3} placeholder={t('requests.ph.description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleCreate}>{t('common.submit')}</button>
                            <button type="button" className="staff-app-btn" onClick={() => setFormOpen(false)}>{t('common.cancel')}</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="staff-app-table-wrap">
                {loading ? (
                    <p className="staff-app-empty">{t('common.loading')}</p>
                ) : rows.length === 0 ? (
                    <p className="staff-app-empty">{t('requests.empty')}</p>
                ) : (
                    <table className="staff-app-table">
                        <thead>
                            <tr>
                                <th>{t('requests.th.num')}</th>
                                <th>{t('requests.th.title')}</th>
                                <th>{t('requests.th.type')}</th>
                                <th>{t('requests.th.priority')}</th>
                                <th>{t('requests.th.target')}</th>
                                <th>{t('requests.th.status')}</th>
                                <th>{t('requests.th.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.requestNumber || row.id}</td>
                                    <td>{row.title}</td>
                                    <td>{REQUEST_TYPE_KEYS.find((x) => x.value === row.type) ? t(REQUEST_TYPE_KEYS.find((x) => x.value === row.type).labelKey) : row.type}</td>
                                    <td>{PRIORITY_KEYS.find((x) => x.value === row.priority) ? t(PRIORITY_KEYS.find((x) => x.value === row.priority).labelKey) : row.priority}</td>
                                    <td>{row.targetDate || t('common.emdash')}</td>
                                    <td><StatusBadge status={row.status} locale={locale} /></td>
                                    <td>
                                        {['Submitted', 'Under Review', 'Approved'].includes(row.status) && (
                                            <button type="button" className="staff-app-btn" onClick={() => handleStatus(row.id, 'Completed')}>
                                                {t('common.complete')}
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
