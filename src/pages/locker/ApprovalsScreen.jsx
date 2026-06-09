import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';

const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export default function ApprovalsScreen() {
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch('/locker/approvals');
            setApprovals(res?.approvals || []);
        } catch (e) {
            setError(e?.message || 'Failed to load approvals');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const review = async (collectionId, status) => {
        let rejectionReason;
        if (status === 'rejected') {
            rejectionReason = window.prompt('Reason for rejection?') || '';
            if (!rejectionReason.trim()) return;
        }
        setBusyId(collectionId);
        try {
            const res = await apiFetch('/locker/approve-difference', {
                method: 'POST',
                body: JSON.stringify({ collectionId, status, rejectionReason }),
            });
            if (res?.success === false) throw new Error(res?.message || 'Failed');
            await load();
        } catch (e) {
            alert(e?.message || 'Failed to update approval');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">Pending Approvals</h2>
                    <p className="ws-page-sub">Cash difference approvals</p>
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

            {approvals.length === 0 ? (
                <div className="ws-section" style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                    No variance awaiting approval
                </div>
            ) : (
                approvals.map((a) => (
                    <div key={a.id} className="ws-approval-card">
                        <div className="ws-approval-top">
                            <div>
                                <p className="ws-approval-title">
                                    {a.branchName} — {a.cashierName}
                                </p>
                                <p className="ws-approval-meta">
                                    Officer: {a.officerName} · Expected {fmtSar(a.expectedAmount)} ·
                                    Received {fmtSar(a.receivedAmount)} · Diff {fmtSar(a.difference)}
                                    {a.notes ? ` · ${a.notes}` : ''} ·{' '}
                                    {new Date(a.date).toLocaleString()}
                                </p>
                            </div>
                            <span
                                className={`ws-badge ${
                                    a.status === 'short' ? 'ws-badge--red' : 'ws-badge--green'
                                }`}
                            >
                                {a.status}
                            </span>
                        </div>
                        <div className="ws-approval-actions">
                            <button
                                className="ws-btn-approve"
                                onClick={() => review(a.id, 'approved')}
                                disabled={busyId === a.id}
                            >
                                Approve
                            </button>
                            <button
                                className="ws-btn-reject"
                                onClick={() => review(a.id, 'rejected')}
                                disabled={busyId === a.id}
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
