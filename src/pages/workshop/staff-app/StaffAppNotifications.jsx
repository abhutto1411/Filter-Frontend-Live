import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { listStaffAppNotifications } from '../../../services/staffAppApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';
import { useStaffAppI18n } from '../../../utils/staffAppI18n';

export default function StaffAppNotifications({ selectedBranchId = 'all' }) {
    const scope = useStaffAppScope();
    const { t } = useStaffAppI18n();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listStaffAppNotifications(staffAppQueryParams({ limit: 100 }, scope));
            setRows(res?.items ?? res?.notifications ?? []);
        } catch (e) {
            setError(e?.message || t('notif.errLoad'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [scope, t]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>{t('notif.title')}</h2>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
            <div className="staff-app-table-wrap">
                {loading ? <p className="staff-app-empty">{t('common.loading')}</p> : rows.length === 0 ? (
                    <p className="staff-app-empty">{t('notif.empty')}</p>
                ) : (
                    <table className="staff-app-table">
                        <thead>
                            <tr>
                                <th>{t('notif.th.when')}</th>
                                <th>{t('notif.th.user')}</th>
                                <th>{t('notif.th.title')}</th>
                                <th>{t('notif.th.message')}</th>
                                <th>{t('notif.th.type')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.createdAt?.slice?.(0, 16)?.replace('T', ' ') || t('common.emdash')}</td>
                                    <td>{row.userName || row.userId || t('common.emdash')}</td>
                                    <td>{row.title}</td>
                                    <td>{row.message}</td>
                                    <td>{row.type}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
