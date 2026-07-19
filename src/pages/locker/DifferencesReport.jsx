import React, { useCallback, useEffect, useState } from 'react';
import { DollarSign, FileText, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import LockerFilterBar from './LockerFilterBar';
import { buildLockerFilterQuery, defaultHistoryDateRange, fmtSar } from './lockerFilterUtils';

const EMPTY_FILTERS = {
    from: '',
    to: '',
    branchId: 'all',
    cashierId: 'all',
};

export default function DifferencesReport() {
    const [data, setData] = useState(null);
    const [filters, setFilters] = useState(() => {
        const d = defaultHistoryDateRange();
        return { ...EMPTY_FILTERS, from: d.from, to: d.to };
    });
    const [appliedFilters, setAppliedFilters] = useState(() => {
        const d = defaultHistoryDateRange();
        return { ...EMPTY_FILTERS, from: d.from, to: d.to };
    });
    const [branches, setBranches] = useState([]);
    const [cashiers, setCashiers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([
            apiFetch('/locker/branches').then((r) => r?.branches || []).catch(() => []),
            apiFetch('/locker/cashiers').then((r) => r?.cashiers || []).catch(() => []),
        ]).then(([b, c]) => {
            setBranches(b);
            setCashiers(c);
        });
    }, []);

    const load = useCallback(async (activeFilters = appliedFilters) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/financial/analytics${qs(buildLockerFilterQuery(activeFilters))}`,
            );
            setData(res);
        } catch (e) {
            setError(e?.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [appliedFilters]);

    useEffect(() => {
        load(appliedFilters);
    }, [appliedFilters, load]);

    const applyFilters = () => setAppliedFilters({ ...filters });
    const resetFilters = () => {
        const d = defaultHistoryDateRange();
        const next = { ...EMPTY_FILTERS, from: d.from, to: d.to };
        setFilters(next);
        setAppliedFilters(next);
    };

    const summary = data?.differencesSummary || {};
    const short = Number(data?.totalShort ?? summary.totalShort ?? 0);
    const over = Number(data?.totalOver ?? summary.totalOver ?? 0);
    const net = Number(
        data?.netVariance ?? summary.netDifference ?? summary.netVariance ?? over - short,
    );
    const recent = data?.recentVariances || data?.items || data?.variances || [];

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">Differences Report</h2>
                    <p className="ws-page-sub">Cash variance analysis</p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={() => load(appliedFilters)}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {error ? <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div> : null}

            <LockerFilterBar
                filters={filters}
                onChange={setFilters}
                onApply={applyFilters}
                onReset={resetFilters}
                branches={branches}
                cashiers={cashiers}
                loading={loading}
            />

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Total Shorts</p>
                        <p className="ws-kpi-value">{fmtSar(short)}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--red">
                        <DollarSign size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Total Overs</p>
                        <p className="ws-kpi-value">{fmtSar(over)}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">
                        <DollarSign size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Net Variance</p>
                        <p className="ws-kpi-value">{fmtSar(net)}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">
                        <FileText size={22} />
                    </div>
                </div>
            </div>

            <div className="ws-section">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Collection</th>
                            <th>Branch</th>
                            <th>Cashier</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recent.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    No variances match filters
                                </td>
                            </tr>
                        ) : (
                            recent.map((a, idx) => (
                                <tr key={a.id || idx}>
                                    <td>
                                        {a.referenceCode ||
                                            a.requestReference ||
                                            a.collectionId ||
                                            a.id}
                                    </td>
                                    <td>{a.branchName || a.branch || '—'}</td>
                                    <td>{a.cashierName || '—'}</td>
                                    <td>
                                        <span
                                            className={`ws-badge ${
                                                (a.type || a.status) === 'short' ? 'ws-badge--red' : 'ws-badge--green'
                                            }`}
                                        >
                                            {a.type || a.status || '—'}
                                        </span>
                                    </td>
                                    <td>{fmtSar(a.amount ?? a.difference)}</td>
                                    <td>
                                        {a.date
                                            ? new Date(a.date).toLocaleDateString()
                                            : a.collectedAt
                                            ? new Date(a.collectedAt).toLocaleDateString()
                                            : '—'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
