import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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

function rowRequestStatus(row) {
    const raw = row?.status ?? row?.requestStatus ?? '';
    if (!raw) return '—';
    return String(raw).replace(/_/g, ' ');
}

export default function PendingRequests({ onTabChange }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/collection-requests${qs({
                    view: 'supervisor',
                    status: 'open',
                    limit: 50,
                })}`,
            );
            const list = res?.items || res?.rows || res?.data || [];
            setRows(list);
        } catch (e) {
            setError(e?.message || 'Failed to load pending requests');
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
                    <h2 className="ws-page-title">Pending Requests</h2>
                    <p className="ws-page-sub">
                        Branch cash collection requests awaiting pickup
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
                            <th>Officer</th>
                            <th>Requested</th>
                            <th>Expected</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    No pending requests
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
                                    <td>{p.assignedOfficerName || '—'}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                                    </td>
                                    <td>
                                        <strong>{fmtSar(p.expectedAmount)}</strong>
                                    </td>
                                    <td>
                                        <span
                                            className={`ws-badge ${
                                                (p.status ?? p.requestStatus) === 'assigned'
                                                    ? 'ws-badge--blue'
                                                    : 'ws-badge--yellow'
                                            }`}
                                        >
                                            {rowRequestStatus(p)}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => onTabChange?.('record')}
                                            style={{
                                                padding: '6px 14px',
                                                background: '#16A34A',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: 8,
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                            }}
                                        >
                                            Record Collection
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
