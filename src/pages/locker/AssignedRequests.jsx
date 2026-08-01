import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';

const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;

function rowCashierName(row) {
    return (
        row?.cashierName ||
        row?.cashier?.name ||
        row?.cashierUser?.name ||
        '—'
    );
}

export default function AssignedRequests({ onTabChange }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/collection-requests${qs({
                    view: 'collector',
                    status: 'assigned',
                    limit: 50,
                })}`,
            );
            const list = res?.items || res?.rows || res?.data || [];
            setRows(list);
        } catch (e) {
            setError(e?.message || 'Failed to load assigned requests');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const goToCollect = (requestId) => {
        onTabChange?.(`record?requestId=${encodeURIComponent(requestId)}`);
    };

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">Assigned Requests</h2>
                    <p className="ws-page-sub">
                        Collections assigned to you by the locker supervisor
                    </p>
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
                            <th>Assigned</th>
                            <th>Expected</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    No assigned collections — supervisor will forward requests here
                                </td>
                            </tr>
                        ) : (
                            rows.map((p) => (
                                <tr key={p.id}>
                                    <td>
                                        <strong style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {p.referenceCode}
                                        </strong>
                                    </td>
                                    <td>{p.branchName}</td>
                                    <td>{rowCashierName(p)}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                                    </td>
                                    <td>
                                        <strong>{fmtSar(p.expectedAmount)}</strong>
                                    </td>
                                    <td>
                                        <span className="ws-badge ws-badge--blue">assigned</span>
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="wlk-action-btn wlk-action-btn--record"
                                            onClick={() => goToCollect(p.id)}
                                        >
                                            <span>Collect cash</span>
                                            <ArrowRight size={14} />
                                        </button>
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
