import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { usePagedRows } from '../../hooks/usePagedRows';
import LockerTablePager from './LockerTablePager';
import { useLockerPortal } from './useLockerPortal';

export default function ApprovalsScreen({
    selectedBranchId = 'all',
    branchLockedId = null,
} = {}) {
    const { t, can, money, dateTime, statusLabel } = useLockerPortal();
    const canDecide = can('approvals.decide');
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState('');
    const listTopRef = useRef(null);
    const { pagedRows, pagerProps } = usePagedRows(approvals, {
        resetKey: `${selectedBranchId}|${branchLockedId ?? ''}`,
        scrollRef: listTopRef,
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const scope = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : undefined);
            const q = scope ? `?branchId=${encodeURIComponent(scope)}` : '';
            const res = await apiFetch(`/locker/approvals${q}`);
            setApprovals(res?.approvals || []);
        } catch (e) {
            setError(e?.message || t('approvals.loadError'));
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, branchLockedId, t]);

    useEffect(() => {
        load();
    }, [load]);

    const review = async (collectionId, status) => {
        let rejectionReason;
        if (status === 'rejected') {
            rejectionReason = window.prompt(t('common.rejectPrompt')) || '';
            if (!rejectionReason.trim()) return;
        }
        setBusyId(collectionId);
        try {
            const res = await apiFetch('/locker/approve-difference', {
                method: 'POST',
                body: JSON.stringify({ collectionId, status, rejectionReason }),
            });
            if (res?.success === false) throw new Error(res?.message || t('approvals.updateError'));
            await load();
        } catch (e) {
            alert(e?.message || t('approvals.updateError'));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">{t('approvals.title')}</h2>
                    <p className="ws-page-sub">{t('approvals.sub')}</p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={load}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('common.refresh')}
                </button>
            </div>

            {error ? <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div> : null}

            <div ref={listTopRef} />
            {approvals.length === 0 ? (
                <div className="ws-section" style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                    {t('approvals.empty')}
                </div>
            ) : (
                pagedRows.map((a) => (
                    <div key={a.id} className="ws-approval-card">
                        <div className="ws-approval-top">
                            <div>
                                <p className="ws-approval-title">
                                    {a.branchName} — {a.cashierName}
                                </p>
                                <p className="ws-approval-meta">
                                    {t('approvals.officer', { name: a.officerName || t('emdash') })} ·{' '}
                                    {t('approvals.expected', { amount: money(a.expectedAmount) })} ·{' '}
                                    {t('approvals.received', { amount: money(a.receivedAmount) })} ·{' '}
                                    {t('approvals.diff', { amount: money(a.difference) })}
                                    {a.notes ? ` · ${a.notes}` : ''} · {dateTime(a.date)}
                                </p>
                            </div>
                            <span
                                className={`ws-badge ${
                                    a.status === 'short' ? 'ws-badge--red' : 'ws-badge--green'
                                }`}
                            >
                                {statusLabel(a.status)}
                            </span>
                        </div>
                        {canDecide ? (
                            <div className="ws-approval-actions">
                                <button
                                    className="ws-btn-approve"
                                    onClick={() => review(a.id, 'approved')}
                                    disabled={busyId === a.id}
                                >
                                    {t('common.approve')}
                                </button>
                                <button
                                    className="ws-btn-reject"
                                    onClick={() => review(a.id, 'rejected')}
                                    disabled={busyId === a.id}
                                >
                                    {t('common.reject')}
                                </button>
                            </div>
                        ) : null}
                    </div>
                ))
            )}
            <LockerTablePager {...pagerProps} />
        </div>
    );
}
