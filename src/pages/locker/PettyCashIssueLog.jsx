import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import { defaultHistoryDateRange, fmtSar } from './lockerFilterUtils';

/**
 * Dedicated log of locker vault → cashier petty cash float issues.
 * Filters: date range, branch, cashier (searchable combobox + ↑↓).
 */
export default function PettyCashIssueLog({
    selectedBranchId = 'all',
    branches: layoutBranches = null,
    branchLockedId = null,
} = {}) {
    const defaults = useMemo(() => defaultHistoryDateRange(), []);
    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
    const [filters, setFilters] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: scopeBranch,
        cashierId: 'all',
        branchText: '',
        cashierText: 'All cashiers',
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

    useEffect(() => {
        const next = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
        setFilters((f) => ({ ...f, branchId: next, branchText: '' }));
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
            ...(branchLockedId
                ? []
                : [{ id: 'all', label: 'All branches', searchText: 'All branches' }]),
            ...(branches || []).map((b) => ({
                id: String(b.id),
                label: b.name,
                searchText: b.name,
            })),
        ],
        [branches, branchLockedId],
    );

    const cashierOpts = useMemo(
        () => [
            { id: 'all', label: 'All cashiers', searchText: 'All cashiers' },
            ...(cashiers || []).map((c) => {
                const id = String(c.userId || c.id);
                const label = `${c.name || c.email || `Cashier ${id}`}${c.branchName ? ` — ${c.branchName}` : ''}`;
                return { id, label, searchText: label };
            }),
        ],
        [cashiers],
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
                    limit: 100,
                })}`,
            );
            setIssues(Array.isArray(res?.issues) ? res.issues : []);
            setSummary(res?.summary || null);
        } catch (e) {
            setError(e?.message || 'Failed to load petty cash issue log');
            setIssues([]);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [applied]);

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
            branchText: '',
            cashierText: 'All cashiers',
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
                    <h2 className="wlk-title">Petty Cash Issue Log</h2>
                    <p className="wlk-subtitle">
                        History of floats issued from the locker vault (1004) to cashier petty cash wallets.
                        KPIs follow the selected date range, branch, and cashier.
                    </p>
                </div>
                <button className="btn-secondary" type="button" onClick={() => void load(applied)} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {error ? <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div> : null}

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Coins size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Locker vault balance</div>
                        <div className="wlk-stat-value">{fmtSar(summary?.lockerVaultBalance)}</div>
                        <div className="wlk-stat-hint">1004 Cash in Transit — Locker</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Total issued (filtered)</div>
                        <div className="wlk-stat-value">{fmtSar(summary?.totalAmount)}</div>
                        <div className="wlk-stat-hint">Selected period / filters</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Issue count</div>
                        <div className="wlk-stat-value">{summary?.issueCount ?? 0}</div>
                        <div className="wlk-stat-hint">Floats in filter</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Average issue</div>
                        <div className="wlk-stat-value">{fmtSar(summary?.averageAmount)}</div>
                        <div className="wlk-stat-hint">Per float</div>
                    </div>
                </div>
            </div>

            <div className="wlk-filter-bar" style={{ marginBottom: 14 }}>
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
                            id="pci-filter-branch"
                            options={branchOpts}
                            value={branchLockedId || filters.branchId || 'all'}
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
                            disabled={loading || Boolean(branchLockedId)}
                        />
                    </div>
                    <div className="ws-field">
                        <label>Cashier</label>
                        <SearchableEntityCombobox
                            id="pci-filter-cashier"
                            options={cashierOpts}
                            value={filters.cashierId || 'all'}
                            displayText={filters.cashierText || ''}
                            onDisplayTextChange={(text) => setFilters((f) => ({ ...f, cashierText: text }))}
                            onSelect={(opt) => setFilters((f) => ({
                                ...f,
                                cashierId: opt?.id || 'all',
                                cashierText: opt?.label || '',
                            }))}
                            placeholder="All cashiers — type to search"
                            entityLabel="cashier"
                            maxInitial={40}
                            maxFiltered={60}
                            disabled={loading}
                        />
                    </div>
                </div>
            </div>

            <div className="wlk-section">
                <div className="wlk-section-header">
                    <h3>
                        Issued floats
                        <span className="wlk-count">{issues.length}</span>
                    </h3>
                </div>
                <div className="wlk-section-body">
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Branch</th>
                                <th>Cashier</th>
                                <th>Amount</th>
                                <th>Reference</th>
                                <th>JE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {issues.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ color: '#64748B', textAlign: 'center' }}>
                                        {loading ? 'Loading…' : 'No petty cash issues for these filters.'}
                                    </td>
                                </tr>
                            ) : (
                                issues.map((r) => (
                                    <tr key={r.id}>
                                        <td>{r.date}</td>
                                        <td>{r.branchName || '—'}</td>
                                        <td>{r.cashierName || '—'}</td>
                                        <td>{fmtSar(r.amount)}</td>
                                        <td>{r.description || '—'}</td>
                                        <td>{r.journalEntryNumber || '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
