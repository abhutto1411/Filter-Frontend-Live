import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DollarSign, RefreshCw, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import SearchSelect from '../../components/SearchSelect';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { useServerPaging } from '../../hooks/usePagedRows';
import LockerFilterBar from './LockerFilterBar';
import LockerTablePager from './LockerTablePager';
import { buildLockerFilterQuery } from './lockerFilterUtils';
import { useLockerPortal } from './useLockerPortal';

function rowCashierName(row, fallback) {
    return (
        row?.cashierName ||
        row?.cashier?.name ||
        row?.cashierUser?.name ||
        fallback
    );
}

function rowStatus(row) {
    return row?.status ?? row?.requestStatus ?? '';
}

function isPendingStatus(row) {
    return String(rowStatus(row)).toLowerCase() === 'pending';
}

const EMPTY_FILTERS = {
    from: '',
    to: '',
    branchId: 'all',
    cashierId: 'all',
    minExpected: '',
    maxExpected: '',
};

export default function PendingRequests({
    onTabChange,
    selectedBranchId = 'all',
    branches: layoutBranches = null,
    branchLockedId = null,
} = {}) {
    const { t, can, moneyWhole, dateTime, statusLabel } = useLockerPortal();
    const dash = t('emdash');
    const canAssign = can('collections.assign');
    const canRecord = can('collections.record');
    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [filters, setFilters] = useState({ ...EMPTY_FILTERS, branchId: scopeBranch });
    const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS, branchId: scopeBranch });
    const [branches, setBranches] = useState([]);
    const [cashiers, setCashiers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [forwardModal, setForwardModal] = useState(null);
    const [officers, setOfficers] = useState([]);
    const [officersLoading, setOfficersLoading] = useState(false);
    const [selectedOfficerId, setSelectedOfficerId] = useState('');
    const [forwardSubmitting, setForwardSubmitting] = useState(false);
    const [forwardError, setForwardError] = useState('');
    const [total, setTotal] = useState(0);
    const tableTopRef = useRef(null);
    const { page, pageSize, setPage, pagerFor } = useServerPaging({
        resetKey: JSON.stringify(appliedFilters),
        scrollRef: tableTopRef,
    });

    useEffect(() => {
        const next = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
        setFilters((f) => ({ ...f, branchId: next }));
        setAppliedFilters((f) => ({ ...f, branchId: next }));
    }, [selectedBranchId, branchLockedId]);

    useEffect(() => {
        Promise.all([
            Array.isArray(layoutBranches) && layoutBranches.length
                ? Promise.resolve(layoutBranches)
                : apiFetch('/locker/branches').then((r) => r?.branches || []).catch(() => []),
            apiFetch('/locker/cashiers').then((r) => r?.cashiers || []).catch(() => []),
        ]).then(([b, c]) => {
            setBranches(b);
            setCashiers(c);
        });
    }, [layoutBranches]);

    const load = useCallback(async (activeFilters = appliedFilters) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/collection-requests${qs(
                    buildLockerFilterQuery(activeFilters, {
                        view: 'supervisor',
                        status: 'open',
                        page,
                        limit: pageSize,
                    }),
                )}`,
            );
            const items = res?.items || res?.rows || res?.data || [];
            const count = Number(res?.total ?? items.length);
            if (!items.length && count > 0 && page > 1) {
                setPage(Math.ceil(count / pageSize));
                return;
            }
            setRows(items);
            setTotal(count);
            setSummary(res?.summary || null);
        } catch (e) {
            setError(e?.message || t('pending.loadError'));
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, page, pageSize, setPage, t]);

    useEffect(() => {
        load(appliedFilters);
    }, [appliedFilters, load]);

    const applyFilters = () => setAppliedFilters({ ...filters });
    const resetFilters = () => {
        const next = {
            ...EMPTY_FILTERS,
            branchId: branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all'),
        };
        setFilters(next);
        setAppliedFilters(next);
    };

    const loadOfficers = useCallback(async () => {
        setOfficersLoading(true);
        setForwardError('');
        try {
            const res = await apiFetch('/locker/field-officers');
            const list = res?.officers || [];
            setOfficers(list);
            if (list.length === 1) setSelectedOfficerId(String(list[0].id));
        } catch (e) {
            setForwardError(e?.message || t('pending.errLoadCollectors'));
        } finally {
            setOfficersLoading(false);
        }
    }, [t]);

    const openForwardModal = (row) => {
        setForwardModal({
            id: row.id,
            referenceCode: row.referenceCode,
            branchName: row.branchName,
            cashierName: rowCashierName(row, dash),
        });
        setSelectedOfficerId('');
        setForwardError('');
        loadOfficers();
    };

    const closeForwardModal = () => {
        if (forwardSubmitting) return;
        setForwardModal(null);
        setSelectedOfficerId('');
        setForwardError('');
    };

    const submitForward = async () => {
        if (!forwardModal?.id) return;
        if (!selectedOfficerId) {
            setForwardError(t('pending.errSelectCollector'));
            return;
        }
        setForwardSubmitting(true);
        setForwardError('');
        try {
            const res = await apiFetch(
                `/locker/collection-requests/${forwardModal.id}/assign`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ officerUserId: selectedOfficerId }),
                },
            );
            if (res?.success === false) throw new Error(res?.message || t('pending.errForward'));
            setForwardModal(null);
            setSelectedOfficerId('');
            await load(appliedFilters);
        } catch (e) {
            setForwardError(e?.message || t('pending.errForward'));
        } finally {
            setForwardSubmitting(false);
        }
    };

    const goToRecordCollection = (requestId) => {
        onTabChange?.(`record?requestId=${encodeURIComponent(requestId)}`);
    };

    const showActions = canAssign || canRecord;
    const officerOptions = useMemo(
        () =>
            officers.map((o) => ({
                value: String(o.id),
                label: o.displayCode ? `${o.name} (${o.displayCode})` : o.name,
            })),
        [officers],
    );

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">{t('pending.title')}</h2>
                    <p className="ws-page-sub">{t('pending.sub')}</p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={() => load(appliedFilters)}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('common.refresh')}
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
                showExpectedRange
                loading={loading}
                branchLockedId={branchLockedId}
            />

            <div className="ws-kpi-grid wlk-summary-kpi" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{t('pending.totalExpected')}</p>
                        <p className="ws-kpi-value">{moneyWhole(summary?.totalExpected)}</p>
                        <p className="ws-kpi-sub">
                            {t('pending.inRange', { count: summary?.requestCount ?? total })}
                        </p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--yellow">
                        <DollarSign size={22} />
                    </div>
                </div>
            </div>

            <div className="ws-section" ref={tableTopRef}>
                <WsTableScroll>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>{t('common.requestNo')}</th>
                            <th>{t('common.branch')}</th>
                            <th>{t('common.cashier')}</th>
                            <th>{t('common.officer')}</th>
                            <th>{t('common.requested')}</th>
                            <th>{t('common.expected')}</th>
                            <th>{t('common.status')}</th>
                            {showActions ? <th>{t('common.action')}</th> : null}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={showActions ? 8 : 7} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    {t('pending.empty')}
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
                                    <td>{rowCashierName(p, dash)}</td>
                                    <td>{p.assignedOfficerName || dash}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {dateTime(p.createdAt)}
                                    </td>
                                    <td>
                                        <strong>{moneyWhole(p.expectedAmount)}</strong>
                                    </td>
                                    <td>
                                        <span
                                            className={`ws-badge ${
                                                rowStatus(p) === 'assigned'
                                                    ? 'ws-badge--blue'
                                                    : 'ws-badge--yellow'
                                            }`}
                                        >
                                            {statusLabel(rowStatus(p))}
                                        </span>
                                    </td>
                                    {showActions ? (
                                        <td>
                                            <div className="wlk-action-group">
                                                {canAssign ? (
                                                    <button
                                                        type="button"
                                                        className="wlk-action-btn wlk-action-btn--forward"
                                                        onClick={() => openForwardModal(p)}
                                                        disabled={!isPendingStatus(p)}
                                                        title={
                                                            isPendingStatus(p)
                                                                ? t('pending.forwardHint')
                                                                : t('pending.alreadyForwarded')
                                                        }
                                                    >
                                                        {t('pending.forward')}
                                                    </button>
                                                ) : null}
                                                {canRecord ? (
                                                    <button
                                                        type="button"
                                                        className="wlk-action-btn wlk-action-btn--record"
                                                        onClick={() => goToRecordCollection(p.id)}
                                                    >
                                                        {t('pending.record')}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </td>
                                    ) : null}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </WsTableScroll>
                <LockerTablePager {...pagerFor(total)} />
            </div>

            {forwardModal ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.5)',
                        display: 'grid',
                        placeItems: 'center',
                        zIndex: 80,
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            width: 520,
                            maxWidth: '96vw',
                            background: '#fff',
                            borderRadius: 12,
                            padding: 20,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 12,
                            }}
                        >
                            <div>
                                <h3 style={{ margin: 0 }}>{t('pending.modalTitle')}</h3>
                                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                                    {forwardModal.referenceCode} · {forwardModal.branchName} ·{' '}
                                    {forwardModal.cashierName}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeForwardModal}
                                disabled={forwardSubmitting}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {forwardError ? (
                            <div className="wlk-error" style={{ marginTop: 12 }}>{forwardError}</div>
                        ) : null}

                        <div className="ws-field" style={{ marginTop: 16 }}>
                            <label>{t('pending.collector')}</label>
                            <SearchSelect
                                options={officerOptions}
                                value={selectedOfficerId}
                                onChange={(v) => setSelectedOfficerId(String(v))}
                                disabled={officersLoading || forwardSubmitting}
                                ariaLabel={t('pending.collector')}
                                placeholder={
                                    officersLoading ? t('pending.loadingCollectors') : t('pending.selectCollector')
                                }
                                emptyHint={t('common.noMatches')}
                            />
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                gap: 10,
                                justifyContent: 'flex-end',
                                marginTop: 20,
                            }}
                        >
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={closeForwardModal}
                                disabled={forwardSubmitting}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn-submit"
                                onClick={submitForward}
                                disabled={forwardSubmitting || officersLoading}
                            >
                                {forwardSubmitting ? t('pending.forwarding') : t('pending.forwardBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
