import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowDownLeft, ArrowUpRight, BookOpen,
    FileSpreadsheet, FileText, RefreshCw, Wallet,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import SearchSelect from '../../components/SearchSelect';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { useServerPaging } from '../../hooks/usePagedRows';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';
import { LOCKER_EXPENSE_CATEGORIES } from './lockerExpenseCategories';
import LockerTablePager from './LockerTablePager';
import { useLockerPortal } from './useLockerPortal';

const TX_TYPES = [
    'collection',
    'bank_deposit',
    'petty_cash',
    'expense',
    'payment',
    'receipt',
    'advance',
    'salary',
    'coa_adjust',
    'opening_balance',
    'manual_journal',
    'other',
];

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toDatetimeLocalValue(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function defaultDateTimeRange() {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return {
        from: toDatetimeLocalValue(start),
        to: toDatetimeLocalValue(end),
    };
}

function localToIso(local) {
    if (!local) return undefined;
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
}

function buildQueryParams(active, { page, limit }) {
    return {
        from: localToIso(active.from),
        to: localToIso(active.to),
        branchId:
            active.branchId && active.branchId !== 'all' ? active.branchId : undefined,
        category:
            active.category && active.category !== 'all' ? active.category : undefined,
        paidTo: active.paidTo && active.paidTo !== 'all' ? active.paidTo : undefined,
        receivedFrom:
            active.receivedFrom && active.receivedFrom !== 'all'
                ? active.receivedFrom
                : undefined,
        type: active.type && active.type !== 'all' ? active.type : undefined,
        page,
        limit,
    };
}

/**
 * Complete locker vault register (IN / OUT) with running balance.
 * `allowHq` is false when the caller is limited to specific branches
 * (HQ-level expenses are outside a branch-scoped admin's view).
 */
function TransactionLog({
    selectedBranchId = 'all',
    branches: layoutBranches = null,
    branchLockedId = null,
    allowHq = true,
} = {}) {
    const { t, money, dateTime, isRtl } = useLockerPortal();
    const dash = t('emdash');
    const defaults = useMemo(() => defaultDateTimeRange(), []);
    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
    const [filters, setFilters] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: scopeBranch,
        category: 'all',
        paidTo: 'all',
        receivedFrom: 'all',
        type: 'all',
    });
    const [applied, setApplied] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: scopeBranch,
        category: 'all',
        paidTo: 'all',
        receivedFrom: 'all',
        type: 'all',
    });
    const [branches, setBranches] = useState([]);
    const [partyOpts, setPartyOpts] = useState({ paidTo: [], receivedFrom: [] });
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [total, setTotal] = useState(0);
    const registerRef = useRef(null);
    const { page, pageSize, setPage, pagerFor } = useServerPaging({
        resetKey: JSON.stringify(applied),
        scrollRef: registerRef,
    });
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    const typeLabel = useCallback(
        (r) => (TX_TYPES.includes(r?.type) ? t(`tl.label.${r.type}`) : r?.typeLabel || r?.type || ''),
        [t],
    );

    useEffect(() => {
        const next = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
        setFilters((f) => ({ ...f, branchId: next }));
        setApplied((a) => ({ ...a, branchId: next }));
    }, [selectedBranchId, branchLockedId]);

    useEffect(() => {
        if (Array.isArray(layoutBranches) && layoutBranches.length) {
            setBranches(layoutBranches);
            return;
        }
        apiFetch('/locker/branches')
            .then((r) => setBranches(Array.isArray(r?.branches) ? r.branches : []))
            .catch(() => setBranches([]));
    }, [layoutBranches]);

    const branchOpts = useMemo(
        () => [
            ...(branchLockedId
                ? []
                : [
                    { value: 'all', label: t('common.allBranches') },
                    ...(allowHq ? [{ value: 'hq', label: t('tl.hq'), searchText: 'hq workshop' }] : []),
                ]),
            ...(branches || []).map((b) => ({ value: String(b.id), label: b.name })),
        ],
        [branches, branchLockedId, allowHq, t],
    );

    const categoryOpts = useMemo(
        () => [
            { value: 'all', label: t('common.allCategories') },
            ...LOCKER_EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
        ],
        [t],
    );

    const typeOpts = useMemo(
        () => [
            { value: 'all', label: t('tl.allTypes') },
            ...TX_TYPES.map((id) => ({
                value: id,
                label: t(`tl.type.${id}`),
                searchText: id.replace(/_/g, ' '),
            })),
        ],
        [t],
    );

    const paidToOpts = useMemo(
        () => [
            { value: 'all', label: t('tl.allPaidTo') },
            ...(partyOpts.paidTo || []).map((name) => ({ value: name, label: name })),
        ],
        [partyOpts.paidTo, t],
    );

    const receivedFromOpts = useMemo(
        () => [
            { value: 'all', label: t('tl.allReceivedFrom') },
            ...(partyOpts.receivedFrom || []).map((name) => ({ value: name, label: name })),
        ],
        [partyOpts.receivedFrom, t],
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/vault/transactions${qs(buildQueryParams(applied, { page, limit: pageSize }))}`,
            );
            const list = Array.isArray(res?.transactions) ? res.transactions : [];
            const count = Number(res?.total || 0);
            if (!list.length && count > 0 && page > 1) {
                setPage(Math.ceil(count / pageSize));
                return;
            }
            setRows(list);
            setSummary(res?.summary || null);
            setTotal(count);
            setPartyOpts({
                paidTo: res?.filterOptions?.paidTo || [],
                receivedFrom: res?.filterOptions?.receivedFrom || [],
            });
        } catch (e) {
            setError(e?.message || t('tl.loadError'));
            setRows([]);
            setSummary(null);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [applied, page, pageSize, setPage, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const applyFilters = () => {
        setApplied({
            from: filters.from,
            to: filters.to,
            branchId: filters.branchId || 'all',
            category: filters.category || 'all',
            paidTo: filters.paidTo || 'all',
            receivedFrom: filters.receivedFrom || 'all',
            type: filters.type || 'all',
        });
    };

    const resetFilters = () => {
        const d = defaultDateTimeRange();
        const nextBranch = branchLockedId || 'all';
        setFilters({
            from: d.from,
            to: d.to,
            branchId: nextBranch,
            category: 'all',
            paidTo: 'all',
            receivedFrom: 'all',
            type: 'all',
        });
        setApplied({
            from: d.from,
            to: d.to,
            branchId: nextBranch,
            category: 'all',
            paidTo: 'all',
            receivedFrom: 'all',
            type: 'all',
        });
    };

    const fetchAllForExport = async () => {
        const batch = 500;
        let pageNum = 1;
        let all = [];
        let reportedTotal = Infinity;
        while (all.length < reportedTotal && pageNum <= 40) {
            const res = await apiFetch(
                `/locker/vault/transactions${qs(
                    buildQueryParams(applied, { page: pageNum, limit: batch }),
                )}`,
            );
            const chunk = Array.isArray(res?.transactions) ? res.transactions : [];
            reportedTotal = Number(res?.total ?? chunk.length);
            all = all.concat(chunk);
            if (!chunk.length || all.length >= reportedTotal) break;
            pageNum += 1;
        }
        return all;
    };

    const exportHeaders = () => [
        t('tl.dateTime'),
        t('tl.type'),
        t('common.branch'),
        t('tl.receivedFrom'),
        t('tl.paidTo'),
        t('common.category'),
        t('common.reference'),
        t('tl.in'),
        t('tl.out'),
        t('tl.running'),
        t('common.description'),
    ];

    const mapExportRows = (list) =>
        (list || []).map((r) => [
            r.at ? dateTime(r.at) : dash,
            typeLabel(r),
            r.branchName || '',
            r.receivedFrom || '',
            r.paidTo || '',
            r.expenseCategory || '',
            r.reference || r.journalEntryNumber || '',
            r.direction === 'IN' ? Number(r.amount || 0) : '',
            r.direction === 'OUT' ? Number(r.amount || 0) : '',
            Number(r.runningBalance || 0),
            r.description || '',
        ]);

    const exportData = async (kind) => {
        setExporting(true);
        setError('');
        try {
            const list = await fetchAllForExport();
            const body = mapExportRows(list);
            const subtitle = t('tl.exportSubtitle', {
                from: applied.from || dash,
                to: applied.to || dash,
                count: list.length,
            });
            if (kind === 'pdf') {
                exportRowsToPdf({
                    title: t('tl.exportTitle'),
                    subtitle,
                    headers: exportHeaders(),
                    rows: body,
                    filenameBase: 'locker-transaction-log',
                });
            } else {
                exportRowsToExcel({
                    sheetName: t('tl.sheet'),
                    headers: exportHeaders(),
                    rows: body,
                    filenameBase: 'locker-transaction-log',
                });
            }
        } catch (e) {
            setError(e?.message || t('tl.errExport'));
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">{t('tl.title')}</h2>
                    <p className="wlk-subtitle">{t('tl.sub')}</p>
                </div>
                <div className="wlk-topbar-actions">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void exportData('pdf')}
                        disabled={loading || exporting || total === 0}
                    >
                        <FileText size={16} /> PDF
                    </button>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void exportData('excel')}
                        disabled={loading || exporting || total === 0}
                    >
                        <FileSpreadsheet size={16} /> Excel
                    </button>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void load()}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> {t('common.refresh')}
                    </button>
                </div>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><ArrowDownLeft size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('tl.in')}</div>
                        <div className="wlk-stat-value">{money(summary?.totalIn)}</div>
                        <div className="wlk-stat-hint">{t('tl.inHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-icon"><ArrowUpRight size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('tl.out')}</div>
                        <div className="wlk-stat-value">{money(summary?.totalOut)}</div>
                        <div className="wlk-stat-hint">{t('tl.outHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Wallet size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('tl.available')}</div>
                        <div className="wlk-stat-value">{money(summary?.availableBalance)}</div>
                        <div className="wlk-stat-hint">{t('tl.availableHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-icon"><BookOpen size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('tl.openClose')}</div>
                        <div className="wlk-stat-value" style={{ fontSize: 16 }}>
                            {money(summary?.openingBalance)} {isRtl ? '←' : '→'} {money(summary?.closingBalance)}
                        </div>
                        <div className="wlk-stat-hint">{t('tl.openCloseHint')}</div>
                    </div>
                </div>
            </div>

            <div className="wlk-section">
                <div className="wlk-filter-bar" style={{ margin: '0 0 12px' }}>
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
                            <label>{t('tl.fromDt')}</label>
                            <input
                                type="datetime-local"
                                value={filters.from || ''}
                                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                            />
                        </div>
                        <div className="ws-field">
                            <label>{t('tl.toDt')}</label>
                            <input
                                type="datetime-local"
                                value={filters.to || ''}
                                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                            />
                        </div>
                        <div className="ws-field">
                            <label htmlFor="tl-branch">{t('common.branch')}</label>
                            <SearchSelect
                                id="tl-branch"
                                size="sm"
                                options={branchOpts}
                                value={branchLockedId || filters.branchId || 'all'}
                                onChange={(v) => setFilters((f) => ({ ...f, branchId: String(v || 'all') }))}
                                placeholder={t('common.searchBranches')}
                                emptyHint={t('common.noMatches')}
                                disabled={Boolean(branchLockedId)}
                                title={branchLockedId ? t('common.branchLocked') : undefined}
                            />
                        </div>
                        <div className="ws-field">
                            <label htmlFor="tl-type">{t('tl.type')}</label>
                            <SearchSelect
                                id="tl-type"
                                size="sm"
                                options={typeOpts}
                                value={filters.type || 'all'}
                                onChange={(v) => setFilters((f) => ({ ...f, type: String(v || 'all') }))}
                                placeholder={t('tl.searchTypes')}
                                emptyHint={t('common.noMatches')}
                            />
                        </div>
                        <div className="ws-field">
                            <label htmlFor="tl-category">{t('tl.expenseCategory')}</label>
                            <SearchSelect
                                id="tl-category"
                                size="sm"
                                options={categoryOpts}
                                value={filters.category || 'all'}
                                onChange={(v) => setFilters((f) => ({ ...f, category: String(v || 'all') }))}
                                placeholder={t('common.searchCategories')}
                                emptyHint={t('common.noMatches')}
                            />
                        </div>
                        <div className="ws-field">
                            <label htmlFor="tl-paid-to">{t('tl.paidTo')}</label>
                            <SearchSelect
                                id="tl-paid-to"
                                size="sm"
                                options={paidToOpts}
                                value={filters.paidTo || 'all'}
                                onChange={(v) => setFilters((f) => ({ ...f, paidTo: String(v || 'all') }))}
                                placeholder={t('tl.searchPaidTo')}
                                emptyHint={t('common.noMatches')}
                                moreHint={t('common.moreMatches')}
                                menuMinWidth={280}
                            />
                        </div>
                        <div className="ws-field">
                            <label htmlFor="tl-received-from">{t('tl.receivedFrom')}</label>
                            <SearchSelect
                                id="tl-received-from"
                                size="sm"
                                options={receivedFromOpts}
                                value={filters.receivedFrom || 'all'}
                                onChange={(v) => setFilters((f) => ({ ...f, receivedFrom: String(v || 'all') }))}
                                placeholder={t('tl.searchReceivedFrom')}
                                emptyHint={t('common.noMatches')}
                                moreHint={t('common.moreMatches')}
                                menuMinWidth={280}
                            />
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div>
                ) : null}

                <div className="wlk-section-header" ref={registerRef}>
                    <h3>
                        {t('tl.register')}
                        <span className="wlk-count">{total}</span>
                    </h3>
                </div>

                <WsTableScroll>
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>{t('tl.dateTime')}</th>
                                <th>{t('tl.type')}</th>
                                <th>{t('common.branch')}</th>
                                <th>{t('tl.receivedFrom')}</th>
                                <th>{t('tl.paidTo')}</th>
                                <th>{t('common.category')}</th>
                                <th>{t('common.reference')}</th>
                                <th>{t('tl.in')}</th>
                                <th>{t('tl.out')}</th>
                                <th>{t('tl.running')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td>{dateTime(r.at)}</td>
                                    <td>{typeLabel(r)}</td>
                                    <td>{r.branchName || dash}</td>
                                    <td>{r.receivedFrom || dash}</td>
                                    <td>{r.paidTo || dash}</td>
                                    <td>{r.expenseCategory || dash}</td>
                                    <td>
                                        <div style={{ fontSize: 12 }}>
                                            {r.reference || dash}
                                            {r.journalEntryNumber ? (
                                                <div style={{ color: '#64748b' }}>{r.journalEntryNumber}</div>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td style={{ color: r.direction === 'IN' ? '#15803d' : undefined, fontWeight: 600 }}>
                                        {r.direction === 'IN' ? money(r.amount) : dash}
                                    </td>
                                    <td style={{ color: r.direction === 'OUT' ? '#b91c1c' : undefined, fontWeight: 600 }}>
                                        {r.direction === 'OUT' ? money(r.amount) : dash}
                                    </td>
                                    <td style={{ fontWeight: 700 }}>{money(r.runningBalance)}</td>
                                </tr>
                            ))}
                            {!loading && !rows.length ? (
                                <tr>
                                    <td colSpan={10}>{t('tl.empty')}</td>
                                </tr>
                            ) : null}
                            {loading ? (
                                <tr>
                                    <td colSpan={10}>{t('common.loading')}</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </WsTableScroll>
                <LockerTablePager {...pagerFor(total)} />
            </div>
        </div>
    );
}

export default TransactionLog;
