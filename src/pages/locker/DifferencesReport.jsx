import React, { useCallback, useEffect, useState } from 'react';
import { DollarSign, FileText, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';

const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export default function DifferencesReport() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch('/locker/financial/analytics');
            setData(res);
        } catch (e) {
            setError(e?.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

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
                    onClick={load}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {error ? <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div> : null}

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
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recent.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    No variances recorded
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
