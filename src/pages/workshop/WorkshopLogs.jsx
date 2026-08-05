import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listWorkshopLogs, workshopStaffListScopeQuery } from '../../services/workshopStaffApi';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import './Workshop.css';

const PAGE_SIZE = 50;

const CATEGORIES = [
    { value: 'all', label: 'All' },
    { value: 'approvals', label: 'Approvals' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'suppliers', label: 'Suppliers & Purchases' },
    { value: 'pos', label: 'POS' },
    { value: 'cash_bank', label: 'Cash & Bank' },
    { value: 'roster', label: 'Staff & Branches' },
];

function toDateInputValue(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function defaultFrom() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateInputValue(d);
}

function formatWhen(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return String(iso);
    }
}

function categoryLabel(c) {
    return CATEGORIES.find((x) => x.value === c)?.label || c || '—';
}

function pageNumbers(current, totalPages, maxBtn = 7) {
    if (totalPages < 1) return [];
    let start = Math.max(1, current - Math.floor(maxBtn / 2));
    let end = Math.min(totalPages, start + maxBtn - 1);
    start = Math.max(1, end - maxBtn + 1);
    const nums = [];
    for (let n = start; n <= end; n += 1) nums.push(n);
    return nums;
}

export default function WorkshopLogs({ selectedBranchId = 'all', branches = [] }) {
    const initialFrom = defaultFrom();
    const initialTo = toDateInputValue(new Date());

    // Draft = form values (no API until Filter).
    const [categoryDraft, setCategoryDraft] = useState('all');
    const [fromDraft, setFromDraft] = useState(initialFrom);
    const [toDraft, setToDraft] = useState(initialTo);
    const [searchDraft, setSearchDraft] = useState('');

    // Applied = what the API uses.
    const [category, setCategory] = useState('all');
    const [from, setFrom] = useState(initialFrom);
    const [to, setTo] = useState(initialTo);
    const [searchApplied, setSearchApplied] = useState('');

    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const allowedIds = useMemo(
        () => branches.map((b) => String(b.id)).filter(Boolean),
        [branches],
    );

    const filtersDirty =
        categoryDraft !== category ||
        fromDraft !== from ||
        toDraft !== to ||
        searchDraft.trim() !== searchApplied;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
    const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const rangeTo = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const scope = workshopStaffListScopeQuery(selectedBranchId, allowedIds);
            const res = await listWorkshopLogs({
                ...scope,
                category: category === 'all' ? undefined : category,
                from: from || undefined,
                to: to || undefined,
                search: searchApplied || undefined,
                limit: PAGE_SIZE,
                offset: (Math.max(1, page) - 1) * PAGE_SIZE,
            });
            setRows(Array.isArray(res?.items) ? res.items : []);
            setTotal(Number(res?.total) || 0);
        } catch (e) {
            setError(e?.message || 'Failed to load logs.');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, allowedIds, category, from, to, searchApplied, page]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (total === 0) return;
        const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (page > maxPage) setPage(maxPage);
    }, [total, page]);

    // Branch selector lives in layout — reload with applied filters, page 1.
    useEffect(() => {
        setPage(1);
    }, [selectedBranchId]);

    const applyFilters = () => {
        setCategory(categoryDraft);
        setFrom(fromDraft);
        setTo(toDraft);
        setSearchApplied(searchDraft.trim());
        setPage(1);
    };

    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Logs</h2>
                    <p className="ws-page-sub">
                        Workshop activity · <strong>{branchLabel}</strong>
                        {total ? ` · ${total} event${total === 1 ? '' : 's'}` : ''}
                    </p>
                </div>
            </div>

            <div className="ws-logs-filters">
                <label className="ws-logs-filter-field">
                    <span className="ws-logs-filter-label">Category</span>
                    <select
                        className="ws-select ws-logs-select"
                        value={categoryDraft}
                        onChange={(e) => setCategoryDraft(e.target.value)}
                        aria-label="Log category"
                    >
                        {CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </label>
                <label className="ws-logs-filter-field">
                    <span className="ws-logs-filter-label">From</span>
                    <input
                        type="date"
                        className="ws-logs-input"
                        value={fromDraft}
                        onChange={(e) => setFromDraft(e.target.value)}
                        aria-label="From date"
                    />
                </label>
                <label className="ws-logs-filter-field">
                    <span className="ws-logs-filter-label">To</span>
                    <input
                        type="date"
                        className="ws-logs-input"
                        value={toDraft}
                        onChange={(e) => setToDraft(e.target.value)}
                        aria-label="To date"
                    />
                </label>
                <label className="ws-logs-filter-field ws-logs-filter-field--search">
                    <span className="ws-logs-filter-label">Search</span>
                    <div className="ws-logs-search-row">
                        <input
                            type="search"
                            className="ws-logs-input"
                            placeholder="Actor, action, summary…"
                            value={searchDraft}
                            onChange={(e) => setSearchDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && filtersDirty && !loading) applyFilters();
                            }}
                        />
                        <button
                            type="button"
                            className="btn-portal"
                            onClick={applyFilters}
                            disabled={!filtersDirty || loading}
                            title={filtersDirty ? 'Apply filters' : 'Change a filter first'}
                        >
                            {loading && filtersDirty ? 'Loading…' : 'Filter'}
                        </button>
                    </div>
                </label>
            </div>

            {error ? (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            ) : null}

            <div className="ws-section">
                <WsTableScroll style={{ padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>When</th>
                                <th>Category</th>
                                <th>Action</th>
                                <th>Summary</th>
                                <th>Performed by</th>
                                <th>Branch</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        Loading…
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        No logs in this period.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => (
                                    <tr key={row.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatWhen(row.at)}</td>
                                        <td>{categoryLabel(row.category)}</td>
                                        <td>{row.action || '—'}</td>
                                        <td>{row.summary || '—'}</td>
                                        <td>
                                            <strong>{row.actorName || 'Not recorded'}</strong>
                                            {row.actorRole ? (
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: 'var(--color-text-muted)',
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    {row.actorRole}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td>{row.branchName || '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </WsTableScroll>

                {total > 0 ? (
                    <div className="ws-report-pagination" style={{ marginTop: 12, padding: '0 16px 16px' }}>
                        <p className="ws-report-pagination__info">
                            Showing <strong>{rangeFrom}</strong>–<strong>{rangeTo}</strong> of{' '}
                            <strong>{total}</strong>
                            {loading ? <span> · Loading…</span> : null}
                            <span style={{ marginLeft: 8, color: 'var(--color-text-muted)' }}>
                                · {PAGE_SIZE} per page
                            </span>
                        </p>
                        <nav className="ws-report-pagination__nav" aria-label="Logs pages">
                            <button
                                type="button"
                                className="ws-report-pagination__edge"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <div className="ws-report-pagination__pages" role="group" aria-label="Page numbers">
                                {pageNumbers(page, totalPages).map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        className={`ws-report-pagination__page${n === page ? ' ws-report-pagination__page--active' : ''}`}
                                        aria-current={n === page ? 'page' : undefined}
                                        disabled={loading}
                                        onClick={() => setPage(n)}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="ws-report-pagination__edge"
                                disabled={page >= totalPages || loading}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </button>
                        </nav>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
