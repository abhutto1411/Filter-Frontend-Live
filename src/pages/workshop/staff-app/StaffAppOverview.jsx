import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getStaffAppOverview } from '../../../services/staffAppApi';
import { branchScopeParams } from '../../../services/workshopStaffApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';
import { useStaffAppI18n } from '../../../utils/staffAppI18n';

export default function StaffAppOverview({ selectedBranchId = 'all', onNavigate }) {
    const scope = useStaffAppScope();
    const { locale, t } = useStaffAppI18n();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getStaffAppOverview(
                staffAppQueryParams(branchScopeParams(selectedBranchId), scope),
            );
            setData(res?.data ?? res);
        } catch (e) {
            setError(e?.message || t('overview.errLoad'));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, scope, t]);

    useEffect(() => { load(); }, [load]);

    const stats = data?.counts ?? data ?? {};

    const cards = [
        { key: 'pendingApprovals', labelKey: 'overview.pendingApprovals', tab: 'approvals' },
        { key: 'openRequests', labelKey: 'overview.openRequests', tab: 'sap-requests' },
        {
            key: 'walletFloat',
            labelKey: 'overview.walletFloat',
            tab: 'my-petty-cash',
            format: (v) => Number(v || 0).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-SA', { minimumFractionDigits: 2 }),
        },
        { key: 'appUsers', labelKey: 'overview.appUsers', tab: 'employees' },
        { key: 'pendingLeave', labelKey: 'overview.pendingLeave', tab: 'sap-leave' },
        { key: 'openTasks', labelKey: 'overview.openTasks', tab: 'sap-tasks' },
    ];

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>{t('overview.title')}</h2>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} style={{ verticalAlign: 'middle' }} /> {t('common.refresh')}
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</p>}
            {loading && !data ? (
                <p className="staff-app-empty">{t('common.loading')}</p>
            ) : (
                <div className="staff-app-card-grid">
                    {cards.map(({ key, labelKey, tab, format }) => {
                        const raw = stats[key] ?? 0;
                        const display = format ? format(raw) : String(raw);
                        return (
                            <button
                                key={key}
                                type="button"
                                className="staff-app-stat-card"
                                style={{ cursor: 'pointer', textAlign: locale === 'ar' ? 'right' : 'left' }}
                                onClick={() => onNavigate?.(tab)}
                            >
                                <h3>{t(labelKey)}</h3>
                                <p>{display}</p>
                            </button>
                        );
                    })}
                </div>
            )}
            <p style={{ marginTop: 16, fontSize: '0.8125rem', color: '#666' }}>
                {t('overview.hint')}
            </p>
        </div>
    );
}
