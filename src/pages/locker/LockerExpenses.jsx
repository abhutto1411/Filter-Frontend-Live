import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Receipt, RefreshCw, CheckCircle, AlertTriangle, Plus, Trash2, ClipboardList,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import SearchSelect from '../../components/SearchSelect';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { useServerPaging } from '../../hooks/usePagedRows';
import LockerTablePager from './LockerTablePager';
import { LOCKER_EXPENSE_CATEGORIES } from './lockerExpenseCategories';
import { defaultHistoryDateRange } from './lockerFilterUtils';
import { useLockerPortal } from './useLockerPortal';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';

const todayISO = () => toRiyadhDateISO();

function emptyLine(defaults = {}) {
    return {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        branchId: defaults.branchId || '',
        category: defaults.category || LOCKER_EXPENSE_CATEGORIES[0] || '',
        amount: '',
        expenseDate: defaults.expenseDate || todayISO(),
        description: '',
        proofUrl: '',
    };
}

function statusBadgeStyle(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'posted' || s === 'approved') {
        return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
    }
    if (s === 'rejected') {
        return { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' };
    }
    return { background: '#fef9c3', color: '#a16207', border: '1px solid #fde68a' };
}

function expenseStatusLabel(status, t) {
    const s = String(status || '').toLowerCase();
    if (s === 'posted') return t('status.posted');
    if (s === 'rejected') return t('status.rejected');
    if (s === 'pending') return t('status.pendingApproval');
    return status || t('emdash');
}

export default function LockerExpenses({
    selectedBranchId = 'all',
    branches: layoutBranches = null,
    branchLockedId = null,
} = {}) {
    const { t, can, money } = useLockerPortal();
    const dash = t('emdash');
    const canCreate = can('expenses.create');
    const canDecide = can('expenses.decide');
    const [pageTab, setPageTab] = useState(canCreate ? 'record' : 'log');
    const [branches, setBranches] = useState([]);
    const [categories, setCategories] = useState(LOCKER_EXPENSE_CATEGORIES);
    const [expenses, setExpenses] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [decidingId, setDecidingId] = useState(null);
    const [decisionMsg, setDecisionMsg] = useState('');

    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');

    const defaults = useMemo(() => defaultHistoryDateRange(), []);
    const [filters, setFilters] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: scopeBranch,
        category: 'all',
        status: 'all',
    });
    const [applied, setApplied] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: scopeBranch,
        category: 'all',
        status: 'all',
    });
    const [total, setTotal] = useState(0);
    const logTopRef = useRef(null);
    const { page, pageSize, setPage, pagerFor } = useServerPaging({
        resetKey: JSON.stringify(applied),
        scrollRef: logTopRef,
    });

    const [lines, setLines] = useState(() => [emptyLine()]);

    useEffect(() => {
        if (!canCreate && pageTab === 'record') setPageTab('log');
    }, [canCreate, pageTab]);

    const branchOpts = useMemo(
        () => (branches || []).map((b) => ({ value: String(b.id), label: b.name })),
        [branches],
    );

    const filterBranchOpts = useMemo(
        () => [
            ...(branchLockedId ? [] : [{ value: 'all', label: t('common.allBranches') }]),
            ...branchOpts,
        ],
        [branchOpts, branchLockedId, t],
    );

    const categoryOpts = useMemo(
        () => (categories || []).map((c) => ({ value: c, label: c })),
        [categories],
    );

    const filterCategoryOpts = useMemo(
        () => [{ value: 'all', label: t('common.allCategories') }, ...categoryOpts],
        [categoryOpts, t],
    );

    const filterStatusOpts = useMemo(
        () => [
            { value: 'all', label: t('common.allStatuses') },
            { value: 'pending', label: t('status.pendingApproval'), searchText: 'pending' },
            { value: 'posted', label: t('status.posted'), searchText: 'posted approved' },
            { value: 'rejected', label: t('status.rejected'), searchText: 'rejected' },
        ],
        [t],
    );

    useEffect(() => {
        const next = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
        setFilters((f) => ({ ...f, branchId: next }));
        setApplied((a) => ({ ...a, branchId: next }));
        setLines((prev) => prev.map((ln) => {
            if (next === 'all') return ln;
            return { ...ln, branchId: String(next) };
        }));
    }, [selectedBranchId, branchLockedId]);

    const loadMeta = useCallback(async () => {
        const [brRes, catRes] = await Promise.all([
            Array.isArray(layoutBranches) && layoutBranches.length
                ? Promise.resolve({ branches: layoutBranches })
                : apiFetch('/locker/branches').catch(() => ({ branches: [] })),
            apiFetch('/locker/expense-categories').catch(() => null),
        ]);
        const branchList = brRes?.branches || [];
        setBranches(Array.isArray(branchList) ? branchList : []);
        const cats = catRes?.categories;
        if (Array.isArray(cats) && cats.length) {
            setCategories(cats);
        }
        const preferredId =
            branchLockedId
            || (selectedBranchId !== 'all' ? selectedBranchId : null)
            || (branchList[0] ? String(branchList[0].id) : null);
        setLines((prev) => {
            if (!prev.length) return prev;
            return prev.map((ln, idx) => {
                if (idx !== 0 || ln.branchId) return ln;
                if (!preferredId) return ln;
                return {
                    ...ln,
                    branchId: String(preferredId),
                };
            });
        });
    }, [layoutBranches, branchLockedId, selectedBranchId]);

    const loadLog = useCallback(async (active = applied) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/expenses${qs({
                    from: active.from || undefined,
                    to: active.to || undefined,
                    branchId: active.branchId && active.branchId !== 'all' ? active.branchId : undefined,
                    category: active.category && active.category !== 'all' ? active.category : undefined,
                    status: active.status && active.status !== 'all' ? active.status : undefined,
                    page,
                    limit: pageSize,
                })}`,
            );
            const list = Array.isArray(res?.expenses) ? res.expenses : [];
            const count = Number(res?.total) || 0;
            if (!list.length && count > 0 && page > 1) {
                setPage(Math.ceil(count / pageSize));
                return;
            }
            setExpenses(list);
            setTotal(count || list.length);
            setSummary(res?.summary || null);
        } catch (e) {
            setError(e?.message || t('exp.errLoad'));
        } finally {
            setLoading(false);
        }
    }, [applied, t, page, pageSize, setPage]);

    useEffect(() => {
        void loadMeta();
    }, [loadMeta]);

    useEffect(() => {
        void loadLog(applied);
    }, [applied, loadLog]);

    const lockerBalance = summary?.lockerVaultBalance ?? 0;
    const linesTotal = lines.reduce((s, ln) => s + (Number(ln.amount) || 0), 0);

    const updateLine = (key, patch) => {
        setLines((prev) => prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)));
    };

    const addLine = () => {
        const base = lines[0] || {};
        setLines((prev) => [
            ...prev,
            emptyLine({
                branchId: base.branchId,
                category: base.category,
                expenseDate: base.expenseDate || todayISO(),
            }),
        ]);
    };

    const removeLine = (key) => {
        setLines((prev) => (prev.length <= 1 ? prev : prev.filter((ln) => ln.key !== key)));
    };

    const submitBulk = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(null);

        const items = [];
        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            const amt = Number(ln.amount);
            if (!ln.branchId) {
                setError(t('exp.errLineBranch', { n: i + 1 }));
                return;
            }
            if (!ln.category) {
                setError(t('exp.errLineCategory', { n: i + 1 }));
                return;
            }
            if (!(amt > 0)) {
                setError(t('exp.errLineAmount', { n: i + 1 }));
                return;
            }
            items.push({
                branchId: ln.branchId,
                category: ln.category,
                amount: amt,
                description: ln.description || undefined,
                expenseDate: ln.expenseDate || undefined,
                proofUrl: ln.proofUrl || undefined,
            });
        }

        if (linesTotal > lockerBalance + 0.01) {
            const ok = window.confirm(
                t('exp.confirmOverVault', { total: money(linesTotal), balance: money(lockerBalance) }),
            );
            if (!ok) return;
        }

        setSubmitting(true);
        try {
            const res = await apiFetch('/locker/expenses/bulk', {
                method: 'POST',
                body: JSON.stringify({ items }),
            });
            if (res?.success === false) throw new Error(res?.message || t('exp.errSubmit'));
            setSuccess({ ...res, lineCount: items.length });
            const keep = lines[0] || {};
            setLines([
                emptyLine({
                    branchId: keep.branchId,
                    category: keep.category,
                    expenseDate: keep.expenseDate || todayISO(),
                }),
            ]);
            await loadLog(applied);
            setPageTab('log');
        } catch (err) {
            setError(err?.message || t('exp.errSubmit'));
        } finally {
            setSubmitting(false);
        }
    };

    const decide = async (row, status) => {
        let rejectionReason;
        if (status === 'rejected') {
            rejectionReason = window.prompt(t('common.rejectPrompt')) || '';
            if (!rejectionReason.trim()) return;
        }
        setDecidingId(row.id);
        setError('');
        setDecisionMsg('');
        try {
            const res = await apiFetch(
                `/locker/expenses/${encodeURIComponent(row.id)}/${status === 'approved' ? 'approve' : 'reject'}`,
                {
                    method: 'POST',
                    body: JSON.stringify(status === 'rejected' ? { rejectionReason } : {}),
                },
            );
            if (res?.success === false) throw new Error(res?.message || t('exp.errDecide'));
            setDecisionMsg(status === 'approved' ? t('exp.approved') : t('exp.rejected'));
            await loadLog(applied);
        } catch (err) {
            setError(err?.message || t('exp.errDecide'));
        } finally {
            setDecidingId(null);
        }
    };

    const applyFilters = () => {
        setApplied({
            from: filters.from,
            to: filters.to,
            branchId: filters.branchId || 'all',
            category: filters.category || 'all',
            status: filters.status || 'all',
        });
    };

    const resetFilters = () => {
        const d = defaultHistoryDateRange();
        const nextBranch = branchLockedId || 'all';
        const next = {
            from: d.from,
            to: d.to,
            branchId: nextBranch,
            category: 'all',
            status: 'all',
        };
        setFilters(next);
        setApplied({
            from: d.from,
            to: d.to,
            branchId: nextBranch,
            category: 'all',
            status: 'all',
        });
    };

    const logColumns = canDecide ? 9 : 8;

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">{t('exp.title')}</h2>
                    <p className="wlk-subtitle">{canDecide ? t('exp.subAdmin') : t('exp.sub')}</p>
                </div>
                <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => void loadLog(applied)}
                    disabled={loading}
                >
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> {t('common.refresh')}
                </button>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Receipt size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('common.vaultBalance')}</div>
                        <div className="wlk-stat-value">{money(lockerBalance)}</div>
                        <div className="wlk-stat-hint">{t('common.vaultHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('exp.posted')}</div>
                        <div className="wlk-stat-value">{money(summary?.totalAmount)}</div>
                        <div className="wlk-stat-hint">{t('exp.postedHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('exp.postedCount')}</div>
                        <div className="wlk-stat-value">{summary?.expenseCount ?? 0}</div>
                        <div className="wlk-stat-hint">{t('exp.postedCountHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('exp.pending')}</div>
                        <div className="wlk-stat-value">{summary?.pendingCount ?? 0}</div>
                        <div className="wlk-stat-hint">{t('exp.pendingHint')}</div>
                    </div>
                </div>
            </div>

            <div
                className="wlk-segmented"
                role="tablist"
                aria-label={t('exp.sections')}
            >
                {canCreate ? (
                    <button
                        type="button"
                        role="tab"
                        aria-selected={pageTab === 'record'}
                        className={`wlk-segmented__btn${pageTab === 'record' ? ' wlk-segmented__btn--active' : ''}`}
                        onClick={() => setPageTab('record')}
                    >
                        <Receipt size={14} />
                        {t('exp.tabRecord')}
                    </button>
                ) : null}
                <button
                    type="button"
                    role="tab"
                    aria-selected={pageTab === 'log'}
                    className={`wlk-segmented__btn${pageTab === 'log' ? ' wlk-segmented__btn--active' : ''}`}
                    onClick={() => setPageTab('log')}
                >
                    <ClipboardList size={14} />
                    {t('exp.tabLog')}
                    {summary?.pendingCount > 0 ? (
                        <span className="wlk-segmented__badge">{summary.pendingCount}</span>
                    ) : null}
                </button>
            </div>

            {pageTab === 'record' && canCreate ? (
                <form className="wlk-create-user" onSubmit={submitBulk}>
                    {error ? (
                        <div className="wlk-error" style={{ marginBottom: 12 }}>
                            <AlertTriangle size={14} /> {error}
                        </div>
                    ) : null}
                    {success ? (
                        <div
                            className="wlk-error"
                            style={{
                                marginBottom: 12,
                                background: '#dcfce7',
                                color: '#15803d',
                                borderColor: '#bbf7d0',
                            }}
                        >
                            <CheckCircle size={14} />{' '}
                            {success.lineCount
                                ? t('exp.submittedCount', { count: success.lineCount })
                                : t('exp.submitted')}
                            {success.totalAmount != null ? ` · ${money(success.totalAmount)}` : ''}
                        </div>
                    ) : null}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ color: '#0f172a' }}>{t('exp.lines')}</strong>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: '#64748b' }}>
                                {t('exp.linesTotal', { amount: money(linesTotal) })}
                            </span>
                            <button type="button" className="btn-secondary" onClick={addLine}>
                                <Plus size={14} /> {t('exp.addLine')}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {lines.map((ln, idx) => (
                            <div
                                key={ln.key}
                                className="wlk-grid wlk-grid--form"
                                style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 12,
                                    padding: 12,
                                    background: '#f8fafc',
                                }}
                            >
                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                                        {t('exp.line', { n: idx + 1 })}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => removeLine(ln.key)}
                                        disabled={lines.length <= 1}
                                        title={t('exp.removeLine')}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <label>
                                    <span>{t('common.branch')}</span>
                                    <SearchSelect
                                        id={`le-branch-${ln.key}`}
                                        options={branchOpts}
                                        value={ln.branchId}
                                        onChange={(v) => updateLine(ln.key, { branchId: String(v || '') })}
                                        required
                                        placeholder={t('exp.searchBranch')}
                                        emptyHint={t('common.noMatches')}
                                        disabled={submitting || Boolean(branchLockedId)}
                                        title={branchLockedId ? t('common.branchLocked') : undefined}
                                    />
                                </label>
                                <label>
                                    <span>{t('common.category')}</span>
                                    <SearchSelect
                                        id={`le-cat-${ln.key}`}
                                        options={categoryOpts}
                                        value={ln.category}
                                        onChange={(v) => updateLine(ln.key, { category: String(v || '') })}
                                        required
                                        placeholder={t('exp.searchCategory')}
                                        emptyHint={t('common.noMatches')}
                                        disabled={submitting}
                                    />
                                </label>
                                <label>
                                    <span>{t('common.amountSar')}</span>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={ln.amount}
                                        onChange={(e) => updateLine(ln.key, { amount: e.target.value })}
                                        required
                                    />
                                </label>
                                <label>
                                    <span>{t('exp.date')}</span>
                                    <input
                                        type="date"
                                        value={ln.expenseDate}
                                        onChange={(e) => updateLine(ln.key, { expenseDate: e.target.value })}
                                    />
                                </label>
                                <label>
                                    <span>{t('exp.descOptional')}</span>
                                    <input
                                        type="text"
                                        value={ln.description}
                                        onChange={(e) => updateLine(ln.key, { description: e.target.value })}
                                        placeholder={t('exp.notesPh')}
                                    />
                                </label>
                                <label>
                                    <span>{t('exp.proofUrl')}</span>
                                    <input
                                        type="url"
                                        value={ln.proofUrl}
                                        onChange={(e) => updateLine(ln.key, { proofUrl: e.target.value })}
                                        placeholder="https://…"
                                    />
                                </label>
                            </div>
                        ))}
                    </div>

                    <div className="wlk-create-user-footer">
                        <button className="btn-primary" type="submit" disabled={submitting}>
                            <Receipt size={14} />{' '}
                            {submitting
                                ? t('exp.submitting')
                                : t('exp.submitLines', { count: lines.length })}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="wlk-section" ref={logTopRef}>
                    <div className="wlk-section-header">
                        <h3>
                            {t('exp.tabLog')}
                            <span className="wlk-count">{total}</span>
                        </h3>
                    </div>
                    {error ? (
                        <div className="wlk-error" style={{ margin: '0 0 12px' }}>
                            <AlertTriangle size={14} /> {error}
                        </div>
                    ) : null}
                    {decisionMsg ? (
                        <div
                            className="wlk-error"
                            style={{
                                margin: '0 0 12px',
                                background: '#dcfce7',
                                color: '#15803d',
                                borderColor: '#bbf7d0',
                            }}
                        >
                            <CheckCircle size={14} /> {decisionMsg}
                        </div>
                    ) : null}
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
                                <label htmlFor="le-filter-branch">{t('common.branch')}</label>
                                <SearchSelect
                                    id="le-filter-branch"
                                    size="sm"
                                    options={filterBranchOpts}
                                    value={branchLockedId || filters.branchId || 'all'}
                                    onChange={(v) => setFilters((f) => ({ ...f, branchId: String(v || 'all') }))}
                                    placeholder={t('common.searchBranches')}
                                    emptyHint={t('common.noMatches')}
                                    disabled={loading || Boolean(branchLockedId)}
                                    title={branchLockedId ? t('common.branchLocked') : undefined}
                                />
                            </div>
                            <div className="ws-field">
                                <label htmlFor="le-filter-category">{t('common.category')}</label>
                                <SearchSelect
                                    id="le-filter-category"
                                    size="sm"
                                    options={filterCategoryOpts}
                                    value={filters.category || 'all'}
                                    onChange={(v) => setFilters((f) => ({ ...f, category: String(v || 'all') }))}
                                    placeholder={t('common.searchCategories')}
                                    emptyHint={t('common.noMatches')}
                                    disabled={loading}
                                />
                            </div>
                            <div className="ws-field">
                                <label htmlFor="le-filter-status">{t('common.status')}</label>
                                <SearchSelect
                                    id="le-filter-status"
                                    size="sm"
                                    options={filterStatusOpts}
                                    value={filters.status || 'all'}
                                    onChange={(v) => setFilters((f) => ({ ...f, status: String(v || 'all') }))}
                                    placeholder={t('common.allStatuses')}
                                    emptyHint={t('common.noMatches')}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="wlk-section-body">
                        <WsTableScroll>
                        <table className="wlk-table">
                            <thead>
                                <tr>
                                    <th>{t('common.date')}</th>
                                    <th>{t('common.branch')}</th>
                                    <th>{t('common.category')}</th>
                                    <th>{t('common.description')}</th>
                                    <th>{t('common.amount')}</th>
                                    <th>{t('common.status')}</th>
                                    <th>{t('exp.recordedBy')}</th>
                                    <th>{t('common.je')}</th>
                                    {canDecide ? <th>{t('common.actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={logColumns} style={{ color: '#64748B', textAlign: 'center' }}>
                                            {loading ? t('common.loading') : t('exp.empty')}
                                        </td>
                                    </tr>
                                ) : (
                                    expenses.map((r) => {
                                        const isPending = String(r.status || '').toLowerCase() === 'pending';
                                        return (
                                            <tr key={r.id}>
                                                <td>{r.expenseDate}</td>
                                                <td>{r.branchName || dash}</td>
                                                <td>{r.category}</td>
                                                <td>
                                                    {r.description || dash}
                                                    {r.status === 'rejected' && r.rejectionReason ? (
                                                        <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                                                            {r.rejectionReason}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td>{money(r.amount)}</td>
                                                <td>
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            padding: '2px 8px',
                                                            borderRadius: 999,
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            ...statusBadgeStyle(r.status),
                                                        }}
                                                    >
                                                        {expenseStatusLabel(r.status, t)}
                                                    </span>
                                                </td>
                                                <td>{r.createdByName || dash}</td>
                                                <td>{r.journalEntryNumber || dash}</td>
                                                {canDecide ? (
                                                    <td>
                                                        {isPending ? (
                                                            <div className="wlk-action-group">
                                                                <button
                                                                    type="button"
                                                                    className="wlk-action-btn wlk-action-btn--record"
                                                                    onClick={() => decide(r, 'approved')}
                                                                    disabled={decidingId === r.id}
                                                                >
                                                                    {t('exp.approve')}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="wlk-action-btn wlk-action-btn--reject"
                                                                    onClick={() => decide(r, 'rejected')}
                                                                    disabled={decidingId === r.id}
                                                                >
                                                                    {t('common.reject')}
                                                                </button>
                                                            </div>
                                                        ) : dash}
                                                    </td>
                                                ) : null}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        <LockerTablePager {...pagerFor(total)} />
                    </div>
                </div>
            )}
        </div>
    );
}
