import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { usePagedRows } from '../../hooks/usePagedRows';
import LockerTablePager from './LockerTablePager';
import { useLockerPortal } from './useLockerPortal';
import {
    buildChargeToOptions,
    formatCitMoneyLatn,
    formatRiyadhDateTime,
    isLockerExpenseClaimRow,
    mapVarianceApprovalRows,
} from '../../utils/lockerCitDisplay';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import SearchSelect from '../../components/SearchSelect';

const STAGE_OPTIONS = [
    { value: 'all', labelKey: 'approvals.stage.all' },
    { value: 'pickup', labelKey: 'approvals.stage.pickup' },
    { value: 'vault_receive', labelKey: 'approvals.stage.vaultReceive' },
    { value: 'expense_claim', labelKey: 'approvals.stage.expenseClaim' },
];

/**
 * Approvals (variances) — mockup 33 table + inline Reject & charge.
 * Used standalone in locker portal and embedded on Record collection page.
 */
export default function ApprovalsScreen({
    selectedBranchId = 'all',
    branchLockedId = null,
    embedded = false,
    hideHeader = false,
    requestIdFromUrl = null,
} = {}) {
    const { t, can, money, locale } = useLockerPortal();
    const stampLang = locale === 'ar' ? 'ar' : 'en';
    const dash = t('emdash');
    const canDecide = can('approvals.decide');
    const [searchParams, setSearchParams] = useSearchParams();
    const stageFilter = searchParams.get('stage') || 'all';
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState('');
    const [rejectId, setRejectId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [chargeTo, setChargeTo] = useState('none');
    const listTopRef = useRef(null);
    const { pagedRows, pagerProps } = usePagedRows(approvals, {
        resetKey: `${selectedBranchId}|${branchLockedId ?? ''}|${stageFilter}|${requestIdFromUrl ?? ''}`,
        scrollRef: listTopRef,
    });

    const stageOptions = useMemo(
        () =>
            STAGE_OPTIONS.map((o) => ({
                value: o.value,
                label: t(o.labelKey),
            })),
        [t],
    );

    const onStageChange = (value) => {
        const next = String(value || 'all');
        setSearchParams((prev) => {
            const sp = new URLSearchParams(prev);
            if (!next || next === 'all') sp.delete('stage');
            else sp.set('stage', next);
            return sp;
        });
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const scope =
                branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : undefined);
            const q = new URLSearchParams();
            if (scope) q.set('branchId', scope);
            if (requestIdFromUrl) q.set('requestId', String(requestIdFromUrl));
            if (stageFilter && stageFilter !== 'all') q.set('stage', stageFilter);
            const query = q.toString() ? `?${q.toString()}` : '';
            const res = await apiFetch(`/locker/approvals${query}`);
            setApprovals(res?.approvals || []);
        } catch (e) {
            const status = Number(e?.status);
            if (status === 404) setError(t('approvals.notDeployed'));
            else setError(e?.message || t('approvals.loadError'));
            setApprovals([]);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, branchLockedId, stageFilter, requestIdFromUrl, t]);

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
        if (isLockerExpenseClaimRow(row)) {
            // Claims are decided by the workshop admin (expenses approval), never via approve-difference.
            setError(t('approvals.expenseClaimAdminOnly'));
            return;
        }
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

    const stageLabel = (stage) => {
        const s = String(stage || '').toLowerCase();
        if (s === 'pickup') return t('approvals.stage.pickup');
        if (s === 'vault_receive') return t('approvals.stage.vaultReceive');
        if (s === 'expense_claim') return t('approvals.stage.expenseClaim');
        return dash;
    };

    const stageBadgeClass = (stage) => {
        const s = String(stage || '').toLowerCase();
        if (s === 'vault_receive') return 'ws-badge--yellow';
        if (s === 'expense_claim') return 'ws-badge--green';
        return 'ws-badge--blue';
    };

    const whoTransfer = (row) => {
        if (row.kind === 'handover') {
            const from = row.officerName || dash;
            const to = row.receiverName || dash;
            return `${from} → ${to}`;
        }
        const from = row.cashierName || dash;
        const to = row.officerName || row.citOfficerName || dash;
        return `${from} → ${to}`;
    };

    const branchCell = (row) =>
        row.branchNames?.length ? row.branchNames.join(', ') : row.branchName || dash;

    const diffColor = (row) => {
        const n = Number(row.difference);
        if (!Number.isFinite(n) || n === 0) return '#15803D';
        return n < 0 ? '#DC2626' : '#B45309';
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

            <div
                style={{
                    marginBottom: 10,
                    padding: 10,
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    color: '#1E3A8A',
                    lineHeight: 1.45,
                }}
            >
                {t('approvals.infoBox')}
            </div>

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 10,
                }}
            >
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {t('approvals.col.stage')}
                </label>
                <div style={{ minWidth: 200, flex: '1 1 200px', maxWidth: 280 }}>
                    <SearchSelect
                        options={stageOptions}
                        value={stageFilter}
                        onChange={onStageChange}
                        ariaLabel={t('approvals.col.stage')}
                        placeholder={t('approvals.stage.all')}
                        emptyHint={t('common.noMatches')}
                        menuMinWidth={240}
                    />
                </div>
            </div>

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
                                <th className="table-th">{t('approvals.col.stage')}</th>
                                <th className="table-th">{t('approvals.col.ref')}</th>
                                <th className="table-th">{t('approvals.col.session')}</th>
                                <th className="table-th">{t('approvals.col.transfer')}</th>
                                <th className="table-th">{t('approvals.col.branch')}</th>
                                <th className="table-th">{t('approvals.col.date')}</th>
                                <th className="table-th" style={{ textAlign: 'end' }}>
                                    {t('approvals.col.expectedActual')}
                                </th>
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
                                            className={`ws-badge ${stageBadgeClass(row.stage)}`}
                                        >
                                            {stageLabel(row.stage || row.kind)}
                                            {isLockerExpenseClaimRow(row) && row.claimStage
                                                ? ` · ${stageLabel(row.claimStage)}`
                                                : ''}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        {row.ref != null ? row.ref : dash}
                                    </td>
                                    <td className="table-cell">
                                        {row.posSessionNo || dash}
                                    </td>
                                    <td className="table-cell">{whoTransfer(row)}</td>
                                    <td className="table-cell">{branchCell(row)}</td>
                                    <td className="table-cell">
                                        {row.date
                                            ? formatRiyadhDateTime(row.date, stampLang)
                                            : dash}
                                    </td>
                                    <td className="table-cell" style={{ textAlign: 'end' }}>
                                        {row.expected != null && row.actual != null
                                            ? `${formatCitMoneyLatn(row.expected) || money(row.expected)} → ${formatCitMoneyLatn(row.actual) || money(row.actual)}`
                                            : dash}
                                    </td>
                                    <td
                                        className="table-cell"
                                        style={{
                                            textAlign: 'end',
                                            color: diffColor(row),
                                            fontWeight: 600,
                                        }}
                                    >
                                        {row.difference != null
                                            ? formatCitMoneyLatn(row.difference) ||
                                              money(row.difference)
                                            : dash}
                                    </td>
                                    <td className="table-cell">
                                        {isLockerExpenseClaimRow(row) ? (
                                            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                                {t('approvals.expenseClaimAdminOnly')}
                                            </span>
                                        ) : canDecide && rejectId !== row.id ? (
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