import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getStaffAppOverview } from '../../../services/staffAppApi';
import { branchScopeParams } from '../../../services/workshopStaffApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';

export default function StaffAppOverview({ selectedBranchId = 'all', onNavigate }) {
    const scope = useStaffAppScope();
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
            setError(e?.message || 'Could not load overview.');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, scope]);

    useEffect(() => { load(); }, [load]);

    const stats = data?.counts ?? data ?? {};

    const cards = [
        { key: 'pendingApprovals', label: 'Pending approvals', tab: 'approvals' },
        { key: 'openRequests', label: 'Open requests', tab: 'sap-requests' },
        { key: 'walletFloat', label: 'Total wallet float (SAR)', tab: 'my-petty-cash', format: (v) => Number(v || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }) },
        { key: 'appUsers', label: 'App users', tab: 'employees' },
        { key: 'pendingLeave', label: 'Pending leave', tab: 'sap-leave' },
        { key: 'openTasks', label: 'Open tasks', tab: 'sap-tasks' },
    ];

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>Staff App Overview</h2>
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} style={{ verticalAlign: 'middle' }} /> Refresh
                </button>
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</p>}
            {loading && !data ? (
                <p className="staff-app-empty">Loading…</p>
            ) : (
                <div className="staff-app-card-grid">
                    {cards.map(({ key, label, tab, format }) => {
                        const raw = stats[key] ?? 0;
                        const display = format ? format(raw) : String(raw);
                        return (
                            <button
                                key={key}
                                type="button"
                                className="staff-app-stat-card"
                                style={{ cursor: 'pointer', textAlign: 'left' }}
                                onClick={() => onNavigate?.(tab)}
                            >
                                <h3>{label}</h3>
                                <p>{display}</p>
                            </button>
                        );
                    })}
                </div>
            )}
            <p style={{ marginTop: 16, fontSize: '0.8125rem', color: '#666' }}>
                Manage outdoor staff, wallets, approvals, and Flutter app workflows from this section.
            </p>
        </div>
    );
}
