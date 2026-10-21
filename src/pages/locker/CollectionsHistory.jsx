import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { useServerPaging } from '../../hooks/usePagedRows';
import LockerFilterBar from './LockerFilterBar';
import LockerTablePager from './LockerTablePager';
import { buildLockerFilterQuery, defaultHistoryDateRange } from './lockerFilterUtils';
import { useLockerPortal } from './useLockerPortal';

const EMPTY_FILTERS = {
    from: '',
    to: '',
    branchId: 'all',
    cashierId: 'all',
    officerId: 'all',
};

export default function CollectionsHistory({
    selectedBranchId = 'all',
    branches: layoutBranches = null,
    branchLockedId = null,
} = {}) {
    const { t, money, dateTime, statusLabel } = useLockerPortal();
    const dash = t('emdash');
    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [filters, setFilters] = useState(() => {
        const d = defaultHistoryDateRange();
        return { ...EMPTY_FILTERS, from: d.from, to: d.to, branchId: scopeBranch };
    });
    const [appliedFilters, setAppliedFilters] = useState(() => {
        const d = defaultHistoryDateRange();
        return { ...EMPTY_FILTERS, from: d.from, to: d.to, branchId: scopeBranch };
    });
    const [branches, setBranches] = useState([]);
    const [cashiers, setCashiers] = useState([]);
    const [officers, setOfficers] = useState([]);
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
            apiFetch('/locker/field-officers').then((r) => r?.officers || []).catch(() => []),
        ]).then(([b, c, o]) => {
            setBranches(b);
            setCashiers(c);
            setOfficers(o);
        });
    }, [layoutBranches]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/financial/history${qs(
                    buildLockerFilterQuery(appliedFilters, { page, limit: pageSize }),
                )}`,
            );
            const raw =
                res?.items ||
                res?.auditLogs ||
                res?.rows ||
                res?.data?.items ||
                [];
            const list = Array.isArray(raw) ? raw : [];
            const count = Number(res?.total) || 0;
            if (!list.length && count > 0 && page > 1) {
                setPage(Math.ceil(count / pageSize));
                return;
            }
            setRows(list);
            setTotal(count || list.length);
            setSummary(res?.summary || null);
        } catch (e) {
            setError(e?.message || t('hist.loadError'));
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, page, pageSize, setPage, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const applyFilters = () => setAppliedFilters({ ...filters });
    const resetFilters = () => {
        const d = defaultHistoryDateRange();
        const next = {
            ...EMPTY_FILTERS,
            from: d.from,
            to: d.to,
            branchId: branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all'),
        };
        setFilters(next);
        setAppliedFilters(next);
    };

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">{t('hist.title')}</h2>
                    <p className="ws-page-sub">{t('hist.sub')}</p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={() => void load()}
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
                officers={officers}
                showOfficer
                loading={loading}
                branchLockedId={branchLockedId}
            />

            <div className="ws-kpi-grid wlk-summary-kpi">
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{t('hist.expected')}</p>
                        <p className="ws-kpi-value">{money(summary?.totalExpected)}</p>
                        <p className="ws-kpi-sub">{t('hist.expectedSub')}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">
                        <DollarSign size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{t('hist.received')}</p>
                        <p className="ws-kpi-value">{money(summary?.totalReceived)}</p>
                        <p className="ws-kpi-sub">{t('hist.receivedSub')}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">
                        <DollarSign size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{t('hist.diff')}</p>
                        <p className="ws-kpi-value">{money(summary?.totalDifference)}</p>
                        <p className="ws-kpi-sub">
                            {t('hist.diffSub', {
                                over: summary?.overCount ?? 0,
                                overAmount: money(summary?.overAmount),
                                short: summary?.shortCount ?? 0,
                                shortAmount: money(summary?.shortAmount),
                                matched: summary?.matchedCount ?? 0,
                            })}
                        </p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--yellow">
                        <TrendingUp size={22} />
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
                            <th>{t('common.date')}</th>
                            <th>{t('common.expected')}</th>
                            <th>{t('common.received')}</th>
                            <th>{t('common.difference')}</th>
                            <th>{t('hist.match')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    {loading ? t('common.loading') : t('hist.empty')}
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
                                    <td>{c.branchName || dash}</td>
                                    <td>{c.cashierName || c.cashier?.name || dash}</td>
                                    <td>{c.officerName || dash}</td>
                                    <td style={{ fontSize: '0.8rem' }}>
                                        {dateTime(c.collectedAt)}
                                    </td>
                                    <td>{money(c.expectedAmount)}</td>
                                    <td>
                                        <strong>{money(c.receivedAmount ?? c.receivedFund)}</strong>
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
                                        {Number(c.difference) === 0 ? dash : money(c.difference)}
                                    </td>
                                    <td>{statusLabel(c.matchStatus || c.status)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </WsTableScroll>
                <LockerTablePager {...pagerFor(total)} />
            </div>
        </div>
    );
}
