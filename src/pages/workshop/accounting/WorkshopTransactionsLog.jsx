import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, RefreshCw, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import {
    listCashBankTransactionsLog,
    listLogFilterUsers,
} from '../../../services/accountingLogsApi';
import '../../../styles/admin/AccountingPage.css';

const METHOD_OPTIONS = [
    { value: 'all', label: 'All Methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'bank', label: 'Bank' },
    { value: 'petty_cash', label: 'Petty Cash' },
];

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function sidebarBranchToFilter(selectedBranchId) {
    return selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '';
}

function formatFilterUserLabel(u) {
    const name = u.name || u.email || u.id;
    const role = u.role ? String(u.role).replace(/_/g, ' ') : '';
    return role ? `${name} (${role})` : name;
}

const methodChip = (kind, type) => {
    const label = type === 'PETTY_CASH'
        ? 'Petty cash'
        : type === 'BANK'
            ? 'Bank'
            : type === 'CASH'
                ? 'Cash'
                : type ?? '—';
    const color = type === 'PETTY_CASH'
        ? { bg: '#F0FDF4', fg: '#166534' }
        : type === 'BANK'
            ? { bg: '#EFF6FF', fg: '#1E40AF' }
            : { bg: '#FEF3C7', fg: '#92400E' };
    return (
        <span style={{
            display: 'inline-flex',
            background: color.bg,
            color: color.fg,
            padding: '2px 10px',
            borderRadius: 12,
            fontSize: '0.7rem',
            fontWeight: 600,
        }}>
            {label}{kind && kind !== 'OPERATING' ? ` · sys` : ''}
        </span>
    );
};

export default function WorkshopTransactionsLog({
    direction = 'all',
    title,
    subtitle,
    emptyHint = 'No transactions in this period.',
    branches = [],
    selectedBranchId = 'all',
}) {
    const [method, setMethod] = useState('all');
    const [branchId, setBranchId] = useState(() => sidebarBranchToFilter(selectedBranchId));
    const [userId, setUserId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listCashBankTransactionsLog({
                direction,
                method,
                branchId: branchId || undefined,
                userId: userId || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                search: search.trim() || undefined,
                limit: 200,
            });
            setRows(res?.items ?? []);
            setTotal(res?.total ?? 0);
        } catch (e) {
            setError(e?.message || 'Could not load transactions.');
        } finally {
            setLoading(false);
        }
    }, [direction, method, branchId, userId, dateFrom, dateTo, search]);

    useEffect(() => {
        setBranchId(sidebarBranchToFilter(selectedBranchId));
    }, [selectedBranchId]);

    const branchScopeForUsers = branchId || undefined;

    useEffect(() => {
        listLogFilterUsers({ branchId: branchScopeForUsers })
            .then((res) => {
                const nextUsers = res?.users ?? [];
                setUsers(nextUsers);
                setUserId((prev) => (prev && nextUsers.some((u) => String(u.id) === String(prev)) ? prev : ''));
            })
            .catch(() => {
                setUsers([]);
                setUserId('');
            });
    }, [branchScopeForUsers]);

    useEffect(() => { reload(); }, [reload]);

    const totals = useMemo(() => {
        const inSum = rows.filter((r) => r.direction === 'in').reduce((s, r) => s + Number(r.amount), 0);
        const outSum = rows.filter((r) => r.direction === 'out').reduce((s, r) => s + Number(r.amount), 0);
        return { inSum, outSum };
    }, [rows]);

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title">
                    {direction === 'in' ? <ArrowDownCircle size={20} style={{ marginRight: 8, color: '#16A34A' }} /> :
                        direction === 'out' ? <ArrowUpCircle size={20} style={{ marginRight: 8, color: '#DC2626' }} /> : null}
                    {title}
                </h2>
                {subtitle ? <p className="cash-bank-desc">{subtitle}</p> : null}
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}

            <section style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: 12,
                background: '#fafafa',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
            }}>
                <div>
                    <label className="form-label">Method</label>
                    <select className="form-input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
                        {METHOD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="form-label">Branch</label>
                    <select className="form-input-field" value={branchId} onChange={(e) => {
                        setBranchId(e.target.value);
                        setUserId('');
                    }}>
                        <option value="">All branches</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="form-label">User (owner)</label>
                    <select className="form-input-field" value={userId} onChange={(e) => setUserId(e.target.value)}>
                        <option value="">All users</option>
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>{formatFilterUserLabel(u)}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="form-label">From</label>
                    <input type="date" className="form-input-field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">To</label>
                    <input type="date" className="form-input-field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">Search</label>
                    <input type="text" className="form-input-field" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Description / reference…" />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-portal" onClick={reload} disabled={loading}>
                        <Filter size={14} style={{ marginRight: 6 }} /> Apply
                    </button>
                </div>
            </section>

            <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
                {direction !== 'out' ? (
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><ArrowDownCircle size={24} color="#16A34A" /></div>
                        <div>
                            <p className="cash-bank-stat-label">Total In</p>
                            <p className="cash-bank-stat-value">SAR {fmt(totals.inSum)}</p>
                        </div>
                    </div>
                ) : null}
                {direction !== 'in' ? (
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><ArrowUpCircle size={24} color="#DC2626" /></div>
                        <div>
                            <p className="cash-bank-stat-label">Total Out</p>
                            <p className="cash-bank-stat-value">SAR {fmt(totals.outSum)}</p>
                        </div>
                    </div>
                ) : null}
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Filter size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Rows</p>
                        <p className="cash-bank-stat-value">{rows.length} / {total}</p>
                    </div>
                </div>
            </div>

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{loading ? 'Loading…' : `${rows.length} entries`}</strong>
                    <button type="button" className="btn-portal-outline" onClick={reload} disabled={loading}>
                        <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh
                    </button>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Direction</th>
                            <th className="table-th">Amount</th>
                            <th className="table-th">Method</th>
                            <th className="table-th">Account</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">Owner</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={9} className="table-cell table-empty">{loading ? 'Loading…' : emptyHint}</td></tr>
                        ) : rows.map((r) => (
                            <tr key={r.id}>
                                <td className="table-cell">{new Date(r.entryDate).toLocaleDateString()}</td>
                                <td className="table-cell" style={{ color: r.direction === 'in' ? '#16A34A' : '#DC2626' }}>
                                    {r.direction === 'in' ? 'In' : 'Out'}
                                </td>
                                <td className="table-cell">SAR {fmt(r.amount)}</td>
                                <td className="table-cell">{methodChip(r.account?.kind, r.account?.type)}</td>
                                <td className="table-cell">{r.account?.name}{r.account?.coaCode ? <span style={{ color: '#94A3B8' }}> · {r.account.coaCode}</span> : null}</td>
                                <td className="table-cell">{r.account?.branchName ?? '—'}</td>
                                <td className="table-cell">{r.account?.ownerUserName ?? '—'}</td>
                                <td className="table-cell">{r.reference ?? r.sourceType ?? '—'}</td>
                                <td className="table-cell" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.description ?? '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
