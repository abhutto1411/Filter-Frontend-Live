import React, { useCallback, useEffect, useState } from 'react';
import { DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import LockerFilterBar from './LockerFilterBar';
import { buildLockerFilterQuery, defaultHistoryDateRange, fmtSar } from './lockerFilterUtils';

const EMPTY_FILTERS = {
    from: '',
    to: '',
    branchId: 'all',
    cashierId: 'all',
    officerId: 'all',
};

export default function CollectionsHistory() {
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [filters, setFilters] = useState(() => {
        const d = defaultHistoryDateRange();
        return { ...EMPTY_FILTERS, from: d.from, to: d.to };
    });
    const [appliedFilters, setAppliedFilters] = useState(() => {
        const d = defaultHistoryDateRange();
        return { ...EMPTY_FILTERS, from: d.from, to: d.to };
    });
    const [branches, setBranches] = useState([]);
    const [cashiers, setCashiers] = useState([]);
    const [officers, setOfficers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([
            apiFetch('/locker/branches').then((r) => r?.branches || []).catch(() => []),
            apiFetch('/locker/cashiers').then((r) => r?.cashiers || []).catch(() => []),
            apiFetch('/locker/field-officers').then((r) => r?.officers || []).catch(() => []),
        ]).then(([b, c, o]) => {
            setBranches(b);
            setCashiers(c);
            setOfficers(o);
        });
    }, []);

    const load = useCallback(async (activeFilters = appliedFilters) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/financial/history${qs(
                    buildLockerFilterQuery(activeFilters, { page: 1, limit: 100 }),
                )}`,
            );
            const list =
                res?.items ||
                res?.auditLogs ||
                res?.rows ||
                res?.data?.items ||
                [];
            setRows(Array.isArray(list) ? list : []);
            setSummary(res?.summary || null);
        } catch (e) {
            setError(e?.message || 'Failed to load history');
        } finally {
            setLoading(false);
        }
    }, [appliedFilters]);

    useEffect(() => {
        load(appliedFilters);
    }, [appliedFilters, load]);

    const applyFilters = () => setAppliedFilters({ ...filters });
    const resetFilters = () => {
        const d = defaultHistoryDateRange();
        const next = { ...EMPTY_FILTERS, from: d.from, to: d.to };
        setFilters(next);
        setAppliedFilters(next);
    };

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">Collections History</h2>
                    <p className="ws-page-sub">Past cash collection records</p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={() => load(appliedFilters)}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
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
            />

            <div className="ws-kpi-grid wlk-summary-kpi">
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Expected Amount</p>
                        <p className="ws-kpi-value">{fmtSar(summary?.totalExpected)}</p>
                        <p className="ws-kpi-sub">Filtered collections</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">
                        <DollarSign size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Received Amount</p>
                        <p className="ws-kpi-value">{fmtSar(summary?.totalReceived)}</p>
                        <p className="ws-kpi-sub">Cash collected</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">
                        <DollarSign size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Differences</p>
                        <p className="ws-kpi-value">{fmtSar(summary?.totalDifference)}</p>
                        <p className="ws-kpi-sub">
                            Over {summary?.overCount ?? 0} ({fmtSar(summary?.overAmount)}) · Short{' '}
                            {summary?.shortCount ?? 0} ({fmtSar(summary?.shortAmount)}) · Matched{' '}
                            {summary?.matchedCount ?? 0}
                        </p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--yellow">
                        <TrendingUp size={22} />
                    </div>
                </div>
            </div>

            <div className="ws-section">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Request #</th>
                            <th>Branch</th>
                            <th>Cashier</th>
                            <th>Officer</th>
                            <th>Date</th>
                            <th>Expected</th>
                            <th>Received</th>
                            <th>Difference</th>
                            <th>Match</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    No history matches filters
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
                                    <td>{c.branchName || '—'}</td>
                                    <td>{c.cashierName || c.cashier?.name || '—'}</td>
                                    <td>{c.officerName || '—'}</td>
                                    <td style={{ fontSize: '0.8rem' }}>
                                        {c.collectedAt ? new Date(c.collectedAt).toLocaleString() : '—'}
                                    </td>
                                    <td>{fmtSar(c.expectedAmount)}</td>
                                    <td>
                                        <strong>{fmtSar(c.receivedAmount ?? c.receivedFund)}</strong>
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
                                        {Number(c.difference) === 0 ? '—' : fmtSar(c.difference)}
                                    </td>
                                    <td>{c.matchStatus || c.status || '—'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
