import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Receipt, RefreshCw, CheckCircle, AlertTriangle, Plus, Trash2, ClipboardList,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import { LOCKER_EXPENSE_CATEGORIES } from './lockerExpenseCategories';
import { defaultHistoryDateRange, fmtSar } from './lockerFilterUtils';

const todayISO = () => new Date().toISOString().slice(0, 10);

function emptyLine(defaults = {}) {
    return {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        branchId: defaults.branchId || '',
        category: defaults.category || LOCKER_EXPENSE_CATEGORIES[0] || '',
        amount: '',
        expenseDate: defaults.expenseDate || todayISO(),
        description: '',
        proofUrl: '',
        branchText: defaults.branchText || '',
        categoryText: defaults.categoryText || defaults.category || LOCKER_EXPENSE_CATEGORIES[0] || '',
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

function statusLabel(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'posted') return 'Posted';
    if (s === 'rejected') return 'Rejected';
    if (s === 'pending') return 'Pending approval';
    return status || '—';
}

export default function LockerExpenses() {
    const [pageTab, setPageTab] = useState('record');
    const [branches, setBranches] = useState([]);
    const [categories, setCategories] = useState(LOCKER_EXPENSE_CATEGORIES);
    const [expenses, setExpenses] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);

    const defaults = useMemo(() => defaultHistoryDateRange(), []);
    const [filters, setFilters] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: 'all',
        category: 'all',
        status: 'all',
        branchText: 'All branches',
        categoryText: 'All categories',
        statusText: 'All statuses',
    });
    const [applied, setApplied] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: 'all',
        category: 'all',
        status: 'all',
    });

    const [lines, setLines] = useState(() => [emptyLine()]);

    const branchOpts = useMemo(
        () =>
            (branches || []).map((b) => ({
                id: String(b.id),
                label: b.name,
                searchText: b.name,
            })),
        [branches],
    );

    const filterBranchOpts = useMemo(
        () => [
            { id: 'all', label: 'All branches', searchText: 'All branches' },
            ...branchOpts,
        ],
        [branchOpts],
    );

    const categoryOpts = useMemo(
        () =>
            (categories || []).map((c) => ({
                id: c,
                label: c,
                searchText: c,
            })),
        [categories],
    );

    const filterCategoryOpts = useMemo(
        () => [
            { id: 'all', label: 'All categories', searchText: 'All categories' },
            ...categoryOpts,
        ],
        [categoryOpts],
    );

    const filterStatusOpts = useMemo(
        () => [
            { id: 'all', label: 'All statuses', searchText: 'All statuses' },
            { id: 'pending', label: 'Pending approval', searchText: 'Pending' },
            { id: 'posted', label: 'Posted', searchText: 'Posted approved' },
            { id: 'rejected', label: 'Rejected', searchText: 'Rejected' },
        ],
        [],
    );

    const loadMeta = useCallback(async () => {
        const [brRes, catRes] = await Promise.all([
            apiFetch('/locker/branches').catch(() => ({ branches: [] })),
            apiFetch('/locker/expense-categories').catch(() => null),
        ]);
        const branchList = brRes?.branches || [];
        setBranches(Array.isArray(branchList) ? branchList : []);
        const cats = catRes?.categories;
        if (Array.isArray(cats) && cats.length) {
            setCategories(cats);
        }
        setLines((prev) => {
            if (!prev.length) return prev;
            const firstBranch = branchList[0];
            return prev.map((ln, idx) => {
                if (idx !== 0 || ln.branchId) return ln;
                if (!firstBranch) return ln;
                return {
                    ...ln,
                    branchId: String(firstBranch.id),
                    branchText: firstBranch.name,
                };
            });
        });
    }, []);

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
                    limit: 100,
                })}`,
            );
            setExpenses(Array.isArray(res?.expenses) ? res.expenses : []);
            setSummary(res?.summary || null);
        } catch (e) {
            setError(e?.message || 'Failed to load expenses');
        } finally {
            setLoading(false);
        }
    }, [applied]);

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
                branchText: base.branchText,
                category: base.category,
                categoryText: base.categoryText,
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
                setError(`Line ${i + 1}: select a branch`);
                return;
            }
            if (!ln.category) {
                setError(`Line ${i + 1}: select a category`);
                return;
            }
            if (!(amt > 0)) {
                setError(`Line ${i + 1}: amount must be greater than 0`);
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
                `Bulk total ${fmtSar(linesTotal)} exceeds locker vault balance ${fmtSar(lockerBalance)}. Submit for approval anyway?`,
            );
            if (!ok) return;
        }

        setSubmitting(true);
        try {
            const res = await apiFetch('/locker/expenses/bulk', {
                method: 'POST',
                body: JSON.stringify({ items }),
            });
            if (res?.success === false) throw new Error(res?.message || 'Submit failed');
            setSuccess(res);
            const keep = lines[0] || {};
            setLines([
                emptyLine({
                    branchId: keep.branchId,
                    branchText: keep.branchText,
                    category: keep.category,
                    categoryText: keep.categoryText,
                    expenseDate: keep.expenseDate || todayISO(),
                }),
            ]);
            await loadLog(applied);
            setPageTab('log');
        } catch (err) {
            setError(err?.message || 'Submit failed');
        } finally {
            setSubmitting(false);
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
        const next = {
            from: d.from,
            to: d.to,
            branchId: 'all',
            category: 'all',
            status: 'all',
            branchText: 'All branches',
            categoryText: 'All categories',
            statusText: 'All statuses',
        };
        setFilters(next);
        setApplied({
            from: d.from,
            to: d.to,
            branchId: 'all',
            category: 'all',
            status: 'all',
        });
    };

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">Expenses</h2>
                    <p className="wlk-subtitle">
                        Record expenses for Super Admin / Workshop Admin approval. After approval, books post
                        (DR [6110] / CR [1004]) and the locker vault balance decreases.
                    </p>
                </div>
                <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => void loadLog(applied)}
                    disabled={loading}
                >
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Receipt size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Locker vault balance</div>
                        <div className="wlk-stat-value">{fmtSar(lockerBalance)}</div>
                        <div className="wlk-stat-hint">1004 Cash in Transit — Locker</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Posted expenses (filtered)</div>
                        <div className="wlk-stat-value">{fmtSar(summary?.totalAmount)}</div>
                        <div className="wlk-stat-hint">Approved &amp; posted to books</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Posted count</div>
                        <div className="wlk-stat-value">{summary?.expenseCount ?? 0}</div>
                        <div className="wlk-stat-hint">Lines in filter (posted)</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Pending approval</div>
                        <div className="wlk-stat-value">{summary?.pendingCount ?? 0}</div>
                        <div className="wlk-stat-hint">Awaiting admin review</div>
                    </div>
                </div>
            </div>

            <div
                className="wlk-segmented"
                role="tablist"
                aria-label="Expenses sections"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={pageTab === 'record'}
                    className={`wlk-segmented__btn${pageTab === 'record' ? ' wlk-segmented__btn--active' : ''}`}
                    onClick={() => setPageTab('record')}
                >
                    <Receipt size={14} />
                    Record expenses
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={pageTab === 'log'}
                    className={`wlk-segmented__btn${pageTab === 'log' ? ' wlk-segmented__btn--active' : ''}`}
                    onClick={() => setPageTab('log')}
                >
                    <ClipboardList size={14} />
                    Expenses log
                    {summary?.pendingCount > 0 ? (
                        <span className="wlk-segmented__badge">{summary.pendingCount}</span>
                    ) : null}
                </button>
            </div>

            {pageTab === 'record' ? (
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
                            {success.message || 'Expenses submitted for approval'}
                            {success.totalAmount != null ? ` · ${fmtSar(success.totalAmount)}` : ''}
                        </div>
                    ) : null}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ color: '#0f172a' }}>Expense lines</strong>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: '#64748b' }}>Lines total: {fmtSar(linesTotal)}</span>
                            <button type="button" className="btn-secondary" onClick={addLine}>
                                <Plus size={14} /> Add line
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
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Line {idx + 1}</span>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => removeLine(ln.key)}
                                        disabled={lines.length <= 1}
                                        title="Remove line"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <label>
                                    <span>Branch</span>
                                    <SearchableEntityCombobox
                                        id={`le-branch-${ln.key}`}
                                        options={branchOpts}
                                        value={ln.branchId}
                                        displayText={ln.branchText || branchOpts.find((o) => o.id === ln.branchId)?.label || ''}
                                        onDisplayTextChange={(text) => updateLine(ln.key, { branchText: text })}
                                        onSelect={(opt) => updateLine(ln.key, {
                                            branchId: opt?.id || '',
                                            branchText: opt?.label || '',
                                        })}
                                        placeholder="Search branch…"
                                        entityLabel="branch"
                                        maxInitial={40}
                                        maxFiltered={60}
                                        disabled={submitting}
                                    />
                                </label>
                                <label>
                                    <span>Category</span>
                                    <SearchableEntityCombobox
                                        id={`le-cat-${ln.key}`}
                                        options={categoryOpts}
                                        value={ln.category}
                                        displayText={ln.categoryText || ln.category || ''}
                                        onDisplayTextChange={(text) => updateLine(ln.key, { categoryText: text })}
                                        onSelect={(opt) => updateLine(ln.key, {
                                            category: opt?.id || '',
                                            categoryText: opt?.label || '',
                                        })}
                                        placeholder="Search category…"
                                        entityLabel="category"
                                        maxInitial={30}
                                        maxFiltered={40}
                                        disabled={submitting}
                                    />
                                </label>
                                <label>
                                    <span>Amount (SAR)</span>
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
                                    <span>Expense date</span>
                                    <input
                                        type="date"
                                        value={ln.expenseDate}
                                        onChange={(e) => updateLine(ln.key, { expenseDate: e.target.value })}
                                    />
                                </label>
                                <label>
                                    <span>Description (optional)</span>
                                    <input
                                        type="text"
                                        value={ln.description}
                                        onChange={(e) => updateLine(ln.key, { description: e.target.value })}
                                        placeholder="Notes"
                                    />
                                </label>
                                <label>
                                    <span>Proof URL (optional)</span>
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
                                ? 'Submitting…'
                                : `Submit ${lines.length} line${lines.length === 1 ? '' : 's'} for approval`}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="wlk-section">
                    <div className="wlk-section-header">
                        <h3>
                            Expenses log
                            <span className="wlk-count">{expenses.length}</span>
                        </h3>
                    </div>
                    {error ? (
                        <div className="wlk-error" style={{ margin: '0 0 12px' }}>
                            <AlertTriangle size={14} /> {error}
                        </div>
                    ) : null}
                    <div className="wlk-filter-bar" style={{ margin: '0 0 12px' }}>
                        <div className="wlk-filter-bar__head">
                            <span className="wlk-filter-bar__title">Filters</span>
                            <div className="wlk-filter-bar__actions">
                                <button type="button" className="btn-secondary" onClick={resetFilters} disabled={loading}>
                                    Reset
                                </button>
                                <button type="button" className="btn-submit" onClick={applyFilters} disabled={loading}>
                                    Apply
                                </button>
                            </div>
                        </div>
                        <div className="wlk-filter-grid">
                            <div className="ws-field">
                                <label>From date</label>
                                <input
                                    type="date"
                                    value={filters.from || ''}
                                    onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                                />
                            </div>
                            <div className="ws-field">
                                <label>To date</label>
                                <input
                                    type="date"
                                    value={filters.to || ''}
                                    onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                                />
                            </div>
                            <div className="ws-field">
                                <label>Branch</label>
                                <SearchableEntityCombobox
                                    id="le-filter-branch"
                                    options={filterBranchOpts}
                                    value={filters.branchId || 'all'}
                                    displayText={filters.branchText || ''}
                                    onDisplayTextChange={(text) => setFilters((f) => ({ ...f, branchText: text }))}
                                    onSelect={(opt) => setFilters((f) => ({
                                        ...f,
                                        branchId: opt?.id || 'all',
                                        branchText: opt?.label || '',
                                    }))}
                                    placeholder="All branches — type to search"
                                    entityLabel="branch"
                                    maxInitial={40}
                                    maxFiltered={60}
                                    disabled={loading}
                                />
                            </div>
                            <div className="ws-field">
                                <label>Category</label>
                                <SearchableEntityCombobox
                                    id="le-filter-category"
                                    options={filterCategoryOpts}
                                    value={filters.category || 'all'}
                                    displayText={filters.categoryText || ''}
                                    onDisplayTextChange={(text) => setFilters((f) => ({ ...f, categoryText: text }))}
                                    onSelect={(opt) => setFilters((f) => ({
                                        ...f,
                                        category: opt?.id || 'all',
                                        categoryText: opt?.label || '',
                                    }))}
                                    placeholder="All categories — type to search"
                                    entityLabel="category"
                                    maxInitial={30}
                                    maxFiltered={40}
                                    disabled={loading}
                                />
                            </div>
                            <div className="ws-field">
                                <label>Status</label>
                                <SearchableEntityCombobox
                                    id="le-filter-status"
                                    options={filterStatusOpts}
                                    value={filters.status || 'all'}
                                    displayText={filters.statusText || ''}
                                    onDisplayTextChange={(text) => setFilters((f) => ({ ...f, statusText: text }))}
                                    onSelect={(opt) => setFilters((f) => ({
                                        ...f,
                                        status: opt?.id || 'all',
                                        statusText: opt?.label || '',
                                    }))}
                                    placeholder="All statuses"
                                    entityLabel="status"
                                    maxInitial={10}
                                    maxFiltered={10}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="wlk-section-body">
                        <table className="wlk-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Branch</th>
                                    <th>Category</th>
                                    <th>Description</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Recorded by</th>
                                    <th>JE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ color: '#64748B', textAlign: 'center' }}>
                                            {loading ? 'Loading…' : 'No locker expenses for these filters.'}
                                        </td>
                                    </tr>
                                ) : (
                                    expenses.map((r) => (
                                        <tr key={r.id}>
                                            <td>{r.expenseDate}</td>
                                            <td>{r.branchName || '—'}</td>
                                            <td>{r.category}</td>
                                            <td>
                                                {r.description || '—'}
                                                {r.status === 'rejected' && r.rejectionReason ? (
                                                    <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                                                        {r.rejectionReason}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td>{fmtSar(r.amount)}</td>
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
                                                    {statusLabel(r.status)}
                                                </span>
                                            </td>
                                            <td>{r.createdByName || '—'}</td>
                                            <td>{r.journalEntryNumber || '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
