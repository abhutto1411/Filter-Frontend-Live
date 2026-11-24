import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DollarSign, RefreshCw, ArrowRight } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { useServerPaging } from '../../hooks/usePagedRows';
import LockerFilterBar from './LockerFilterBar';
import LockerTablePager from './LockerTablePager';
import { buildLockerFilterQuery } from './lockerFilterUtils';
import { useLockerPortal } from './useLockerPortal';
import {
    formatAgeHours,
    formatSessionRange,
    rowCountedAmount,
    rowPosSessionLabel,
    rowPreviousAssignee,
} from './collectibleCashDisplay';

function rowCashierName(row, fallback) {
    return (
        row?.cashierName ||
        row?.cashier?.name ||
        row?.cashierUser?.name ||
        fallback
    );
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
    view = 'supervisor',
    layout = 'table',
} = {}) {
    const { t, can, moneyWhole, locale } = useLockerPortal();
    const stampLang = locale === 'ar' ? 'ar' : 'en';
    const dash = t('emdash');
    const isCollector = view === 'collector';
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
                        view: isCollector ? 'collector' : 'supervisor',
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
            setError(e?.message || t('collectible.loadError'));
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, page, pageSize, setPage, t, isCollector]);

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

    const goToRecordCollection = (requestId) => {
        onTabChange?.(`record?requestId=${encodeURIComponent(requestId)}`);
    };

    const byBranchStrip = useMemo(() => {
        const list = summary?.byBranch;
        return Array.isArray(list) ? list : [];
    }, [summary]);

    const titleKey = isCollector ? 'collectible.title' : 'collectible.title';
    const subKey = isCollector ? 'collectible.subCollector' : 'collectible.sub';

    const collectButton = (requestId, large = false) =>
        canRecord ? (
            <button
                type="button"
                className={large ? 'btn-submit' : 'wlk-action-btn wlk-action-btn--record'}
                onClick={() => goToRecordCollection(requestId)}
                style={
                    large
                        ? {
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              minHeight: 44,
                              width: '100%',
                              justifyContent: 'center',
                          }
                        : undefined
                }
            >
                {t('collectible.collect')}
                {large ? <ArrowRight size={16} /> : null}
            </button>
        ) : null;

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">{t(titleKey)}</h2>
                    <p className="ws-page-sub">{t(subKey)}</p>
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
                        <p className="ws-kpi-label">{t('collectible.totalExpected')}</p>
                        <p className="ws-kpi-value">{moneyWhole(summary?.totalExpected)}</p>
                        <p className="ws-kpi-sub">
                            {t('collectible.inRange', { count: summary?.requestCount ?? total })}
                        </p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--yellow">
                        <DollarSign size={22} />
                    </div>
                </div>
            </div>

            {byBranchStrip.length ? (
                <div
                    className="ws-section"
                    style={{ marginBottom: 12, fontSize: '0.85rem' }}
                    role="region"
                    aria-label={t('collectible.byBranch')}
                >
                    <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{t('collectible.byBranch')}</p>
                    <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                        {byBranchStrip.map((b) => (
                            <li key={b.branchId || b.branchName}>
                                {b.branchName || b.branchId}: {moneyWhole(b.totalExpected)} (
                                {b.count ?? 0})
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {layout === 'cards' ? (
                <div className="ws-section" ref={tableTopRef}>
                    {rows.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>{t('collectible.empty')}</p>
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {rows.map((p) => {
                                const prev = rowPreviousAssignee(p);
                                return (
                                    <article
                                        key={p.id}
                                        style={{
                                            border: '1px solid #E2E8F0',
                                            borderRadius: 12,
                                            padding: 14,
                                            background: '#fff',
                                        }}
                                    >
                                        <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{p.branchName}</p>
                                        <p style={{ margin: '0 0 4px', fontSize: '0.85rem' }}>
                                            {t('common.cashier')}: {rowCashierName(p, dash)}
                                        </p>
                                        <p style={{ margin: '0 0 4px', fontSize: '0.85rem' }} dir="ltr">
                                            {t('collectible.colPosSession')}: #{rowPosSessionLabel(p, dash)}
                                        </p>
                                        <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: '#64748B' }} dir="ltr">
                                            {formatSessionRange(p, stampLang, dash)}
                                        </p>
                                        <p style={{ margin: '0 0 4px', fontSize: '0.85rem' }} dir="ltr">
                                            {t('collectible.colCounted')}: {moneyWhole(rowCountedAmount(p))} ·{' '}
                                            {t('common.expected')}: {moneyWhole(p.expectedAmount)}
                                        </p>
                                        <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: '#64748B' }}>
                                            {t('collectible.colAge')}: {formatAgeHours(p.ageHours, t)}
                                        </p>
                                        {prev ? (
                                            <p
                                                style={{
                                                    margin: '0 0 10px',
                                                    fontSize: '0.8rem',
                                                    color: '#94A3B8',
                                                }}
                                            >
                                                {t('collectible.previousAssignee')}: {prev}
                                            </p>
                                        ) : null}
                                        {collectButton(p.id, true)}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                    <LockerTablePager {...pagerFor(total)} />
                </div>
            ) : (
                <div className="ws-section" ref={tableTopRef}>
                    <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>{t('common.branch')}</th>
                                    <th>{t('common.cashier')}</th>
                                    <th>{t('collectible.colPosSession')}</th>
                                    <th>{t('collectible.colSessionTimes')}</th>
                                    <th>{t('collectible.colCounted')}</th>
                                    <th>{t('common.expected')}</th>
                                    <th>{t('collectible.colAge')}</th>
                                    <th>{t('collectible.previousAssignee')}</th>
                                    {canRecord ? <th>{t('common.action')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={canRecord ? 9 : 8}
                                            style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}
                                        >
                                            {t('collectible.empty')}
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((p) => {
                                        const prev = rowPreviousAssignee(p);
                                        return (
                                            <tr key={p.id}>
                                                <td>{p.branchName}</td>
                                                <td>{rowCashierName(p, dash)}</td>
                                                <td dir="ltr">#{rowPosSessionLabel(p, dash)}</td>
                                                <td style={{ fontSize: '0.8rem' }} dir="ltr">
                                                    {formatSessionRange(p, stampLang, dash)}
                                                </td>
                                                <td dir="ltr">
                                                    <strong>{moneyWhole(rowCountedAmount(p))}</strong>
                                                </td>
                                                <td dir="ltr">
                                                    <strong>{moneyWhole(p.expectedAmount)}</strong>
                                                </td>
                                                <td>{formatAgeHours(p.ageHours, t)}</td>
                                                <td style={{ color: '#94A3B8', fontSize: '0.85rem' }}>
                                                    {prev || dash}
                                                </td>
                                                {canRecord ? <td>{collectButton(p.id)}</td> : null}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </WsTableScroll>
                    <LockerTablePager {...pagerFor(total)} />
                </div>
            )}
        </div>
    );
}