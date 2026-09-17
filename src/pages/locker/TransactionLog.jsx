import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowDownLeft, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight,
    FileSpreadsheet, FileText, RefreshCw, Wallet,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';
import { LOCKER_EXPENSE_CATEGORIES } from './lockerExpenseCategories';
import { fmtSar } from './lockerFilterUtils';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

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

function fmtWhen(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return String(iso);
    }
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

function mapExportRows(list) {
    return (list || []).map((r) => [
        fmtWhen(r.at),
        r.typeLabel || r.type || '',
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
}

const EXPORT_HEADERS = [
    'Date & time',
    'Type',
    'Branch',
    'Received from',
    'Paid to',
    'Category',
    'Reference',
    'IN',
    'OUT',
    'Running balance',
    'Description',
];

/**
 * Complete locker vault register (IN / OUT) with running balance.
 */
function TransactionLog({
    selectedBranchId = 'all',
    branches: layoutBranches = null,
    branchLockedId = null,
} = {}) {
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
        // Keep search text empty so closed field shows selectedLabel and open list shows all options
        branchText: '',
        categoryText: '',
        paidToText: '',
        receivedFromText: '',
        typeText: '',
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
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const next = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
        setFilters((f) => ({ ...f, branchId: next, branchText: '' }));
        setApplied((a) => ({ ...a, branchId: next }));
        setPage(1);
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
                    { id: 'all', label: 'All branches', searchText: 'All branches' },
                    { id: 'hq', label: 'HQ / Workshop expenses', searchText: 'HQ Workshop' },
                ]),
            ...(branches || []).map((b) => ({
                id: String(b.id),
                label: b.name,
                searchText: b.name,
            })),
        ],
        [branches, branchLockedId],
    );

    const categoryOpts = useMemo(
        () => [
            { id: 'all', label: 'All categories', searchText: 'All categories' },
            ...LOCKER_EXPENSE_CATEGORIES.map((c) => ({
                id: c,
                label: c,
                searchText: c,
            })),
        ],
        [],
    );

    const typeOpts = useMemo(
        () => [
            { id: 'all', label: 'All types', searchText: 'All types' },
            { id: 'collection', label: 'Collection (IN)', searchText: 'Collection' },
            { id: 'bank_deposit', label: 'Bank deposit (OUT)', searchText: 'Bank deposit' },
            { id: 'petty_cash', label: 'Petty cash issue (OUT)', searchText: 'Petty cash' },
            { id: 'expense', label: 'Expense (OUT)', searchText: 'Expense' },
        ],
        [],
    );

    const paidToOpts = useMemo(
        () => [
            { id: 'all', label: 'All paid to', searchText: 'All paid to' },
            ...(partyOpts.paidTo || []).map((name) => ({
                id: name,
                label: name,
                searchText: name,
            })),
        ],
        [partyOpts.paidTo],
    );

    const receivedFromOpts = useMemo(
        () => [
            { id: 'all', label: 'All received from', searchText: 'All received from' },
            ...(partyOpts.receivedFrom || []).map((name) => ({
                id: name,
                label: name,
                searchText: name,
            })),
        ],
        [partyOpts.receivedFrom],
    );

    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

    const load = useCallback(async (active = applied, pageNum = page, size = pageSize) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/vault/transactions${qs(buildQueryParams(active, { page: pageNum, limit: size }))}`,
            );
            setRows(Array.isArray(res?.transactions) ? res.transactions : []);
            setSummary(res?.summary || null);
            setTotal(Number(res?.total || 0));
            setPartyOpts({
                paidTo: res?.filterOptions?.paidTo || [],
                receivedFrom: res?.filterOptions?.receivedFrom || [],
            });
        } catch (e) {
            setError(e?.message || 'Failed to load transaction log');
            setRows([]);
            setSummary(null);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [applied, page, pageSize]);

    useEffect(() => {
        void load(applied, page, pageSize);
    }, [applied, page, pageSize, load]);

    const applyFilters = () => {
        setPage(1);
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
        setFilters({
            from: d.from,
            to: d.to,
            branchId: 'all',
            category: 'all',
            paidTo: 'all',
            receivedFrom: 'all',
            type: 'all',
            branchText: '',
            categoryText: '',
            paidToText: '',
            receivedFromText: '',
            typeText: '',
        });
        setPage(1);
        setApplied({
            from: d.from,
            to: d.to,
            branchId: 'all',
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

    const exportData = async (kind) => {
        setExporting(true);
        setError('');
        try {
            const list = await fetchAllForExport();
            const body = mapExportRows(list);
            const subtitle = `From ${applied.from || '—'} to ${applied.to || '—'} · ${list.length} transactions`;
            if (kind === 'pdf') {
                exportRowsToPdf({
                    title: 'Locker wallet transaction log',
                    subtitle,
                    headers: EXPORT_HEADERS,
                    rows: body,
                    filenameBase: 'locker-transaction-log',
                });
            } else {
                exportRowsToExcel({
                    sheetName: 'Transaction log',
                    headers: EXPORT_HEADERS,
                    rows: body,
                    filenameBase: 'locker-transaction-log',
                });
            }
        } catch (e) {
            setError(e?.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const fromIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const toIdx = Math.min(page * pageSize, total);

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">Transaction log</h2>
                    <p className="wlk-subtitle">
                        Complete locker wallet register — every IN &amp; OUT with running balance
                        (collections, bank deposits, petty cash, expenses).
                    </p>
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
                        onClick={() => void load(applied, page, pageSize)}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><ArrowDownLeft size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">IN</div>
                        <div className="wlk-stat-value">{fmtSar(summary?.totalIn)}</div>
                        <div className="wlk-stat-hint">Into locker (filtered range)</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-icon"><ArrowUpRight size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">OUT</div>
                        <div className="wlk-stat-value">{fmtSar(summary?.totalOut)}</div>
                        <div className="wlk-stat-hint">Out of locker (filtered range)</div>
                    </div>
                </div>
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Wallet size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Available balance</div>
                        <div className="wlk-stat-value">{fmtSar(summary?.availableBalance)}</div>
                        <div className="wlk-stat-hint">Vault as of range end (1004)</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-icon"><BookOpen size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Opening → Closing</div>
                        <div className="wlk-stat-value" style={{ fontSize: 16 }}>
                            {fmtSar(summary?.openingBalance)} → {fmtSar(summary?.closingBalance)}
                        </div>
                        <div className="wlk-stat-hint">Period vault movement</div>
                    </div>
                </div>
            </div>

            <div className="wlk-section">
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
                            <label>From date &amp; time</label>
                            <input
                                type="datetime-local"
                                value={filters.from || ''}
                                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                            />
                        </div>
                        <div className="ws-field">
                            <label>To date &amp; time</label>
                            <input
                                type="datetime-local"
                                value={filters.to || ''}
                                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                            />
                        </div>
                        <div className="ws-field">
                            <label>Branch</label>
                            <SearchableEntityCombobox
                                id="tl-branch"
                                options={branchOpts}
                                value={filters.branchId || 'all'}
                                displayText={filters.branchText || ''}
                                onDisplayTextChange={(text) => setFilters((f) => ({ ...f, branchText: text }))}
                                onSelect={(opt) => setFilters((f) => ({
                                    ...f,
                                    branchId: opt?.id || 'all',
                                    branchText: '',
                                }))}
                                placeholder="All branches — type to search"
                                entityLabel="branch"
                                maxInitial={40}
                                maxFiltered={60}
                            />
                        </div>
                        <div className="ws-field">
                            <label>Type</label>
                            <SearchableEntityCombobox
                                id="tl-type"
                                options={typeOpts}
                                value={filters.type || 'all'}
                                displayText={filters.typeText || ''}
                                onDisplayTextChange={(text) => setFilters((f) => ({ ...f, typeText: text }))}
                                onSelect={(opt) => setFilters((f) => ({
                                    ...f,
                                    type: opt?.id || 'all',
                                    typeText: '',
                                }))}
                                placeholder="All types — type to search"
                                entityLabel="type"
                                maxInitial={10}
                                maxFiltered={10}
                            />
                        </div>
                        <div className="ws-field">
                            <label>Expense category</label>
                            <SearchableEntityCombobox
                                id="tl-category"
                                options={categoryOpts}
                                value={filters.category || 'all'}
                                displayText={filters.categoryText || ''}
                                onDisplayTextChange={(text) => setFilters((f) => ({ ...f, categoryText: text }))}
                                onSelect={(opt) => setFilters((f) => ({
                                    ...f,
                                    category: opt?.id || 'all',
                                    categoryText: '',
                                }))}
                                placeholder="All categories — type to search"
                                entityLabel="category"
                                maxInitial={30}
                                maxFiltered={40}
                            />
                        </div>
                        <div className="ws-field">
                            <label>Paid to</label>
                            <SearchableEntityCombobox
                                id="tl-paid-to"
                                options={paidToOpts}
                                value={filters.paidTo || 'all'}
                                displayText={filters.paidToText || ''}
                                onDisplayTextChange={(text) => setFilters((f) => ({ ...f, paidToText: text }))}
                                onSelect={(opt) => setFilters((f) => ({
                                    ...f,
                                    paidTo: opt?.id || 'all',
                                    paidToText: '',
                                }))}
                                placeholder="All paid to — type to search"
                                entityLabel="payee"
                                maxInitial={40}
                                maxFiltered={60}
                            />
                        </div>
                        <div className="ws-field">
                            <label>Received from</label>
                            <SearchableEntityCombobox
                                id="tl-received-from"
                                options={receivedFromOpts}
                                value={filters.receivedFrom || 'all'}
                                displayText={filters.receivedFromText || ''}
                                onDisplayTextChange={(text) => setFilters((f) => ({ ...f, receivedFromText: text }))}
                                onSelect={(opt) => setFilters((f) => ({
                                    ...f,
                                    receivedFrom: opt?.id || 'all',
                                    receivedFromText: '',
                                }))}
                                placeholder="All received from — type to search"
                                entityLabel="payer"
                                maxInitial={40}
                                maxFiltered={60}
                            />
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div>
                ) : null}

                <div className="wlk-section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                    <h3>
                        Register
                        <span className="wlk-count">{total}</span>
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
                            Per page
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPage(1);
                                    setPageSize(Number(e.target.value) || 25);
                                }}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #d1d5db',
                                    background: '#fff',
                                    fontSize: 13,
                                }}
                            >
                                {PAGE_SIZE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </label>
                        <span style={{ fontSize: 13, color: '#64748b' }}>
                            {total === 0 ? '0' : `${fromIdx}–${toIdx}`} of {total}
                        </span>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={loading || page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            title="Previous page"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 72, textAlign: 'center' }}>
                            Page {Math.min(page, totalPages)} / {totalPages}
                        </span>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={loading || page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            title="Next page"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="wlk-table-wrap">
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>Date &amp; time</th>
                                <th>Type</th>
                                <th>Branch</th>
                                <th>Received from</th>
                                <th>Paid to</th>
                                <th>Category</th>
                                <th>Reference</th>
                                <th>IN</th>
                                <th>OUT</th>
                                <th>Running balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td>{fmtWhen(r.at)}</td>
                                    <td>{r.typeLabel || r.type}</td>
                                    <td>{r.branchName || '—'}</td>
                                    <td>{r.receivedFrom || '—'}</td>
                                    <td>{r.paidTo || '—'}</td>
                                    <td>{r.expenseCategory || '—'}</td>
                                    <td>
                                        <div style={{ fontSize: 12 }}>
                                            {r.reference || '—'}
                                            {r.journalEntryNumber ? (
                                                <div style={{ color: '#64748b' }}>{r.journalEntryNumber}</div>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td style={{ color: r.direction === 'IN' ? '#15803d' : undefined, fontWeight: 600 }}>
                                        {r.direction === 'IN' ? fmtSar(r.amount) : '—'}
                                    </td>
                                    <td style={{ color: r.direction === 'OUT' ? '#b91c1c' : undefined, fontWeight: 600 }}>
                                        {r.direction === 'OUT' ? fmtSar(r.amount) : '—'}
                                    </td>
                                    <td style={{ fontWeight: 700 }}>{fmtSar(r.runningBalance)}</td>
                                </tr>
                            ))}
                            {!loading && !rows.length ? (
                                <tr>
                                    <td colSpan={10}>No vault transactions for these filters.</td>
                                </tr>
                            ) : null}
                            {loading ? (
                                <tr>
                                    <td colSpan={10}>Loading…</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                {total > 0 ? (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: 10,
                            marginTop: 12,
                            flexWrap: 'wrap',
                        }}
                    >
                        <span style={{ fontSize: 13, color: '#64748b' }}>
                            Showing {fromIdx}–{toIdx} of {total}
                        </span>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={loading || page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft size={16} /> Prev
                        </button>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={loading || page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default TransactionLog;

