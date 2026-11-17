import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { usePagedRows } from '../../hooks/usePagedRows';
import LockerTablePager from './LockerTablePager';
import { useLockerPortal } from './useLockerPortal';
import {
    buildChargeToOptions,
    formatCitMoneyLatn,
    mapVarianceApprovalRows,
} from '../../utils/lockerCitDisplay';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import SearchSelect from '../../components/SearchSelect';

/**
 * Approvals (variances) — mockup 33 table + inline Reject & charge.
 * Used standalone in locker portal and embedded on Record collection page.
 */
export default function ApprovalsScreen({
    selectedBranchId = 'all',
    branchLockedId = null,
    embedded = false,
    hideHeader = false,
} = {}) {
    const { t, can, money } = useLockerPortal();
    const canDecide = can('approvals.decide');
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState('');
    const [rejectId, setRejectId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [chargeTo, setChargeTo] = useState('none');
    const listTopRef = useRef(null);
    const { pagedRows, pagerProps } = usePagedRows(approvals, {
        resetKey: `${selectedBranchId}|${branchLockedId ?? ''}`,
        scrollRef: listTopRef,
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const scope =
                branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : undefined);
            const q = scope ? `?branchId=${encodeURIComponent(scope)}` : '';
            const res = await apiFetch(`/locker/approvals${q}`);
            setApprovals(res?.approvals || []);
        } catch (e) {
            const status = Number(e?.status);
            if (status === 404) setError(t('approvals.notDeployed'));
            else setError(e?.message || t('approvals.loadError'));
            setApprovals([]);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, branchLockedId, t]);

    useEffect(() => {
        load();
    }, [load]);

    const rows = useMemo(() => mapVarianceApprovalRows(pagedRows), [pagedRows]);

    const startReject = (row) => {
        setRejectId(row.id);
        setRejectReason('');
        setChargeTo(row.defaultChargeTo || 'none');
        setError('');
    };

    const cancelReject = () => {
        setRejectId(null);
        setRejectReason('');
        setChargeTo('none');
    };

    const review = async (row, status) => {
        const raw = row.raw || row;
        let rejectionReason;
        let bodyChargeTo;
        if (status === 'rejected') {
            rejectionReason = String(rejectReason || '').trim();
            if (!rejectionReason) {
                setError(t('approvals.rejectReasonRequired'));
                return;
            }
            bodyChargeTo = chargeTo || row.defaultChargeTo || 'none';
        }
        setBusyId(row.id);
        setError('');
        try {
            const body = {
                collectionId: row.kind === 'handover' ? undefined : row.id,
                handoverId:
                    row.kind === 'handover' ? raw.handoverId || row.id : undefined,
                kind: row.kind === 'handover' ? 'handover' : 'collection',
                status,
                rejectionReason,
                chargeTo: bodyChargeTo,
            };
            const res = await apiFetch('/locker/approve-difference', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (res?.success === false) {
                throw new Error(res?.message || t('approvals.updateError'));
            }
            cancelReject();
            await load();
        } catch (e) {
            setError(e?.message || t('approvals.updateError'));
        } finally {
            setBusyId(null);
        }
    };

    const kindLabel = (badge) => {
        if (badge?.key === 'handover') return t('approvals.kindHandover');
        if (badge?.key === 'pickup') return t('approvals.kindPickup');
        return t('emdash');
    };

    const rejectRow = rows.find((r) => r.id === rejectId);

    return (
        <div className={embedded ? 'cit-approvals-embed' : undefined}>
            {!hideHeader ? (
                <div
                    className="ws-page-header"
                    style={{ alignItems: 'center', marginBottom: embedded ? 8 : undefined }}
                >
                    <div>
                        <h2
                            className="ws-page-title"
                            style={embedded ? { fontSize: '1rem', margin: 0 } : undefined}
                        >
                            {t('approvals.variancesTitle')}
                        </h2>
                        {!embedded ? (
                            <p className="ws-page-sub">{t('approvals.sub')}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={load}
                        disabled={loading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />{' '}
                        {t('common.refresh')}
                    </button>
                </div>
            ) : null}

            {error ? (
                <div className="wlk-error" role="alert" style={{ marginBottom: 12 }}>
                    {error}{' '}
                    <button type="button" className="btn-portal-outline" onClick={() => void load()}>
                        {t('common.refresh')}
                    </button>
                </div>
            ) : null}

            <div ref={listTopRef} />

            {loading && approvals.length === 0 ? (
                <p style={{ color: '#64748b' }}>{t('approvals.loading')}</p>
            ) : null}

            {!loading && approvals.length === 0 && !error ? (
                <div
                    className="ws-section"
                    style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}
                >
                    {t('approvals.empty')}
                </div>
            ) : null}

            {rows.length > 0 ? (
                <WsTableScroll>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th className="table-th">{t('approvals.col.kind')}</th>
                                <th className="table-th">{t('approvals.col.ref')}</th>
                                <th className="table-th">{t('approvals.col.officer')}</th>
                                <th className="table-th" style={{ textAlign: 'end' }}>
                                    {t('approvals.col.diff')}
                                </th>
                                <th className="table-th">{t('approvals.col.action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={`${row.kind}-${row.id}`}>
                                    <td className="table-cell">
                                        <span
                                            className={`ws-badge ${
                                                row.kindBadge.tone === 'warn'
                                                    ? 'ws-badge--red'
                                                    : 'ws-badge--blue'
                                            }`}
                                        >
                                            {kindLabel(row.kindBadge)}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        {row.ref != null ? row.ref : t('emdash')}
                                    </td>
                                    <td className="table-cell">
                                        {row.officerName || t('emdash')}
                                    </td>
                                    <td
                                        className="table-cell"
                                        style={{
                                            textAlign: 'end',
                                            color:
                                                Number(row.difference) < 0 ? '#DC2626' : undefined,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {row.difference != null
                                            ? formatCitMoneyLatn(row.difference) ||
                                              money(row.difference)
                                            : t('emdash')}
                                    </td>
                                    <td className="table-cell">
                                        {canDecide && rejectId !== row.id ? (
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    className="ws-btn-approve"
                                                    onClick={() => review(row, 'approved')}
                                                    disabled={busyId === row.id}
                                                >
                                                    {t('common.approve')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ws-btn-reject"
                                                    onClick={() => startReject(row)}
                                                    disabled={busyId === row.id}
                                                >
                                                    {t('common.reject')}
                                                </button>
                                            </div>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </WsTableScroll>
            ) : null}

            {canDecide && rejectRow ? (
                <div
                    style={{
                        marginTop: 12,
                        padding: 12,
                        background: '#FEF3C7',
                        border: '1px solid #F59E0B',
                        borderRadius: 8,
                    }}
                    role="group"
                    aria-label={t('approvals.rejectPanel')}
                >
                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
                        {t('approvals.rejectHeading', {
                            ref: rejectRow.ref || rejectRow.id,
                        })}
                    </p>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                        {t('approvals.rejectReason')}
                    </label>
                    <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        style={{
                            width: '100%',
                            borderRadius: 8,
                            border: '1px solid #CBD5E1',
                            padding: 8,
                            marginBottom: 8,
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelReject();
                            }
                        }}
                    />
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                        {t('approvals.chargeTo')}
                    </label>
                    <SearchSelect
                        options={buildChargeToOptions({
                            ...rejectRow,
                            cashierName: rejectRow.raw?.cashierName,
                        }).map((o) => ({
                            value: o.id,
                            label:
                                o.id === 'cashier'
                                    ? t('approvals.chargeCashierNamed', {
                                          name: o.label,
                                      })
                                    : o.id === 'officer'
                                      ? t('approvals.chargeOfficerNamed', {
                                            name: o.label,
                                        })
                                      : t('approvals.chargeNone'),
                        }))}
                        value={chargeTo}
                        onChange={(v) => setChargeTo(String(v || 'none'))}
                        ariaLabel={t('approvals.chargeTo')}
                        placeholder={t('approvals.chargeTo')}
                        emptyHint={t('common.noMatches')}
                        menuMinWidth={240}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={cancelReject}
                            disabled={busyId === rejectRow.id}
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            className="ws-btn-reject"
                            onClick={() => review(rejectRow, 'rejected')}
                            disabled={busyId === rejectRow.id}
                        >
                            {t('approvals.rejectAndCharge')}
                        </button>
                    </div>
                </div>
            ) : null}

            {!embedded ? <LockerTablePager {...pagerProps} /> : null}
            {embedded && approvals.length > 25 ? (
                <LockerTablePager {...pagerProps} />
            ) : null}
        </div>
    );
}
