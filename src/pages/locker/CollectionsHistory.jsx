import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';

const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export default function CollectionsHistory() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/financial/history${qs({ page: 1, limit: 100 })}`,
            );
            const list =
                res?.items ||
                res?.auditLogs ||
                res?.rows ||
                res?.data?.items ||
                [];
            setRows(Array.isArray(list) ? list : []);
        } catch (e) {
            setError(e?.message || 'Failed to load history');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">Collections History</h2>
                    <p className="ws-page-sub">Past cash collection records</p>
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

            <div className="ws-section">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Request #</th>
                            <th>Branch</th>
                            <th>Cashier</th>
                            <th>Officer</th>
                            <th>Date</th>
                            <th>Expected</th>
                            <th>Received</th>
                            <th>Difference</th>
                            <th>Match</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    No history available
                                </td>
                            </tr>
                        ) : (
                            rows.map((c) => (
                                <tr key={c.id || c.collectionId}>
                                    <td>
                                        <strong style={{ fontFamily: 'monospace' }}>
                                            {c.referenceCode || c.requestReference || c.id}
                                        </strong>
                                    </td>
                                    <td>{c.branchName || '—'}</td>
                                    <td>{c.cashierName || c.cashier?.name || '—'}</td>
                                    <td>{c.officerName || '—'}</td>
                                    <td style={{ fontSize: '0.8rem' }}>
                                        {c.collectedAt ? new Date(c.collectedAt).toLocaleString() : '—'}
                                    </td>
                                    <td>{fmtSar(c.expectedAmount)}</td>
                                    <td>
                                        <strong>{fmtSar(c.receivedAmount ?? c.receivedFund)}</strong>
                                    </td>
                                    <td
                                        style={{
                                            fontWeight: 700,
                                            color:
                                                Number(c.difference) === 0
                                                    ? '#16A34A'
                                                    : Number(c.difference) < 0
                                                    ? '#DC2626'
                                                    : '#059669',
                                        }}
                                    >
                                        {Number(c.difference) === 0 ? '—' : fmtSar(c.difference)}
                                    </td>
                                    <td>{c.matchStatus || c.status || '—'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
