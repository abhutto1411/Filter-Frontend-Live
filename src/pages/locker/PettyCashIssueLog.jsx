import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import SearchSelect from '../../components/SearchSelect';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { useServerPaging } from '../../hooks/usePagedRows';
import { defaultHistoryDateRange } from './lockerFilterUtils';
import LockerTablePager from './LockerTablePager';
import { useLockerPortal } from './useLockerPortal';

/**
 * Dedicated log of locker vault → cashier petty cash float issues.
 * Filters: date range, branch, cashier (searchable combobox + ↑↓).
 */
export default function PettyCashIssueLog({
    selectedBranchId = 'all',
    branches: layoutBranches = null,
    branchLockedId = null,
} = {}) {
    const { t, money } = useLockerPortal();
    const dash = t('emdash');
    const allCashiersLabel = t('common.allCashiers');
    const defaults = useMemo(() => defaultHistoryDateRange(), []);
    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
    const [filters, setFilters] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: scopeBranch,
        cashierId: 'all',
    });
    const [applied, setApplied] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: scopeBranch,
        cashierId: 'all',
    });
    const [branches, setBranches] = useState([]);
    const [cashiers, setCashiers] = useState([]);
    const [issues, setIssues] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [total, setTotal] = useState(0);
    const tableTopRef = useRef(null);
    const { page, pageSize, setPage, pagerFor } = useServerPaging({
        resetKey: JSON.stringify(applied),
        scrollRef: tableTopRef,
    });

    useEffect(() => {
        const next = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
        setFilters((f) => ({ ...f, branchId: next }));
        setApplied((a) => ({ ...a, branchId: next }));
    }, [selectedBranchId, branchLockedId]);

    useEffect(() => {
        Promise.all([
            Array.isArray(layoutBranches) && layoutBranches.length
                ? Promise.resolve(layoutBranches)
                : apiFetch('/locker/branches').then((r) => r?.branches || []).catch(() => []),
            apiFetch('/locker/cashiers').then((r) => r?.cashiers || []).catch(() => []),
        ]).then(([b, c]) => {
            setBranches(Array.isArray(b) ? b : []);
            setCashiers(Array.isArray(c) ? c : []);
        });
    }, [layoutBranches]);

    const branchOpts = useMemo(
        () => [
            ...(branchLockedId ? [] : [{ value: 'all', label: t('common.allBranches') }]),
            ...(branches || []).map((b) => ({ value: String(b.id), label: b.name })),
        ],
        [branches, branchLockedId, t],
    );

    const cashierOpts = useMemo(
        () => [
            { value: 'all', label: allCashiersLabel },
            ...(cashiers || []).map((c) => {
                const id = String(c.userId || c.id);
                return {
                    value: id,
                    label: c.name || c.email || t('common.cashierFallback', { id }),
                    hint: c.branchName || undefined,
                };
            }),
        ],
        [cashiers, allCashiersLabel, t],
    );

    const load = useCallback(async (active = applied) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/petty-cash-issues${qs({
                    from: active.from || undefined,
                    to: active.to || undefined,
                    branchId: active.branchId && active.branchId !== 'all' ? active.branchId : undefined,
                    cashierId: active.cashierId && active.cashierId !== 'all' ? active.cashierId : undefined,
                    page,
                    limit: pageSize,
                })}`,
            );
            const items = Array.isArray(res?.issues) ? res.issues : [];
            const count = Number(res?.total ?? items.length);
            if (!items.length && count > 0 && page > 1) {
                setPage(Math.ceil(count / pageSize));
                return;
            }
            setIssues(items);
            setTotal(count);
            setSummary(res?.summary || null);
        } catch (e) {
            setError(e?.message || t('pcl.loadError'));
            setIssues([]);
            setTotal(0);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [applied, page, pageSize, setPage, t]);

    useEffect(() => {
        void load(applied);
    }, [applied, load]);

    const applyFilters = () => {
        setApplied({
            from: filters.from,
            to: filters.to,
            branchId: filters.branchId || 'all',
            cashierId: filters.cashierId || 'all',
        });
    };

    const resetFilters = () => {
        const d = defaultHistoryDateRange();
        const nextBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
        const next = {
            from: d.from,
            to: d.to,
            branchId: nextBranch,
            cashierId: 'all',
        };
        setFilters(next);
        setApplied({
            from: d.from,
            to: d.to,
            branchId: nextBranch,
            cashierId: 'all',
        });
    };

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">{t('pcl.title')}</h2>
                    <p className="wlk-subtitle">{t('pcl.sub')}</p>
                </div>
                <button className="btn-secondary" type="button" onClick={() => void load(applied)} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> {t('common.refresh')}
                </button>
            </div>

            {error ? <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div> : null}

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Coins size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('common.vaultBalance')}</div>
                        <div className="wlk-stat-value">{money(summary?.lockerVaultBalance)}</div>
                        <div className="wlk-stat-hint">{t('common.vaultHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('pcl.total')}</div>
                        <div className="wlk-stat-value">{money(summary?.totalAmount)}</div>
                        <div className="wlk-stat-hint">{t('pcl.totalHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('pcl.count')}</div>
                        <div className="wlk-stat-value">{summary?.issueCount ?? 0}</div>
                        <div className="wlk-stat-hint">{t('pcl.countHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('pcl.avg')}</div>
                        <div className="wlk-stat-value">{money(summary?.averageAmount)}</div>
                        <div className="wlk-stat-hint">{t('pcl.avgHint')}</div>
                    </div>
                </div>
            </div>

            <div className="wlk-filter-bar" style={{ marginBottom: 14 }}>
                <div className="wlk-filter-bar__head">
                    <span className="wlk-filter-bar__title">{t('common.filters')}</span>
                    <div className="wlk-filter-bar__actions">
                        <button type="button" className="btn-secondary" onClick={resetFilters} disabled={loading}>
                            {t('common.reset')}
                        </button>
                        <button type="button" className="btn-submit" onClick={applyFilters} disabled={loading}>
                            {t('common.apply')}
                        </button>
                    </div>
                </div>
                <div className="wlk-filter-grid">
                    <div className="ws-field">
                        <label>{t('common.fromDate')}</label>
                        <input
                            type="date"
                            value={filters.from || ''}
                            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                        />
                    </div>
                    <div className="ws-field">
                        <label>{t('common.toDate')}</label>
                        <input
                            type="date"
                            value={filters.to || ''}
                            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                        />
                    </div>
                    <div className="ws-field">
                        <label htmlFor="pci-filter-branch">{t('common.branch')}</label>
                        <SearchSelect
                            id="pci-filter-branch"
                            size="sm"
                            options={branchOpts}
                            value={branchLockedId || filters.branchId || 'all'}
                            onChange={(v) => setFilters((f) => ({ ...f, branchId: String(v || 'all') }))}
                            placeholder={t('common.searchBranches')}
                            emptyHint={t('common.noMatches')}
                            disabled={loading || Boolean(branchLockedId)}
                            title={branchLockedId ? t('common.branchLocked') : undefined}
                        />
                    </div>
                    <div className="ws-field">
                        <label htmlFor="pci-filter-cashier">{t('common.cashier')}</label>
                        <SearchSelect
                            id="pci-filter-cashier"
                            size="sm"
                            options={cashierOpts}
                            value={filters.cashierId || 'all'}
                            onChange={(v) => setFilters((f) => ({ ...f, cashierId: String(v || 'all') }))}
                            placeholder={t('common.searchCashiers')}
                            emptyHint={t('common.noMatches')}
                            disabled={loading}
                            menuMinWidth={300}
                        />
                    </div>
                </div>
            </div>

            <div className="wlk-section" ref={tableTopRef}>
                <div className="wlk-section-header">
                    <h3>
                        {t('pcl.issued')}
                        <span className="wlk-count">{total}</span>
                    </h3>
                </div>
                <div className="wlk-section-body">
                    <WsTableScroll>
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>{t('common.date')}</th>
                                <th>{t('common.branch')}</th>
                                <th>{t('common.cashier')}</th>
                                <th>{t('common.amount')}</th>
                                <th>{t('common.reference')}</th>
                                <th>{t('common.je')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {issues.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ color: '#64748B', textAlign: 'center' }}>
                                        {loading ? t('common.loading') : t('pcl.empty')}
                                    </td>
                                </tr>
                            ) : (
                                issues.map((r) => (
                                    <tr key={r.id}>
                                        <td>{r.date}</td>
                                        <td>{r.branchName || dash}</td>
                                        <td>{r.cashierName || dash}</td>
                                        <td>{money(r.amount)}</td>
                                        <td>{r.description || dash}</td>
                                        <td>{r.journalEntryNumber || dash}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </WsTableScroll>
                    <LockerTablePager {...pagerFor(total)} />
                </div>
            </div>
        </div>
    );
}
