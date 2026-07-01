import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Book, Filter, RefreshCw, Search } from 'lucide-react';
import { getAccountLedger, getAccountsList } from '../../../services/ledgerApi';
import '../../../styles/admin/AccountingPage.css';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function WorkshopLedgerView() {
    const [accounts, setAccounts] = useState([]);
    const [accountId, setAccountId] = useState('');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [ledger, setLedger] = useState(null);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [error, setError] = useState('');
    const accountsRef = useRef([]);

    const loadAccounts = useCallback(async () => {
        setLoadingAccounts(true);
        try {
            const res = await getAccountsList({ limit: 1000 });
            const list = Array.isArray(res) ? res : (res?.items ?? res?.accounts ?? []);
            accountsRef.current = list;
            setAccounts(list);
        } catch (e) {
            setError(e?.message || 'Could not load accounts.');
        } finally {
            setLoadingAccounts(false);
        }
    }, []);

    useEffect(() => { loadAccounts(); }, [loadAccounts]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return accounts.slice(0, 400);
        return accounts.filter((a) =>
            String(a.code || '').toLowerCase().includes(term) ||
            String(a.name || '').toLowerCase().includes(term),
        ).slice(0, 400);
    }, [accounts, search]);

    const loadLedger = useCallback(async () => {
        if (!accountId) {
            setLedger(null);
            return;
        }
        setLoadingLedger(true);
        setError('');
        try {
            const res = await getAccountLedger(accountId, {
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                limit: 500,
            });
            setLedger(res);
        } catch (e) {
            setError(e?.message || 'Could not load ledger.');
        } finally {
            setLoadingLedger(false);
        }
    }, [accountId, dateFrom, dateTo]);

    useEffect(() => { loadLedger(); }, [loadLedger]);

    const totals = useMemo(() => {
        if (!ledger?.lines) return { debit: 0, credit: 0 };
        return ledger.lines.reduce(
            (acc, l) => ({ debit: acc.debit + Number(l.debit), credit: acc.credit + Number(l.credit) }),
            { debit: 0, credit: 0 },
        );
    }, [ledger]);

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title"><Book size={20} style={{ marginRight: 8 }} />General Ledger</h2>
                <p className="cash-bank-desc">
                    Pick a COA account to see every journal line touching it, with a running balance.
                </p>
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}

            <section style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: 12,
                background: '#fafafa',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
            }}>
                <div>
                    <label className="form-label">Search accounts</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', top: 12, left: 10, color: '#94A3B8' }} />
                        <input
                            type="text"
                            className="form-input-field"
                            style={{ paddingLeft: 30 }}
                            value={search}
                            placeholder="Code or name…"
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <label className="form-label">Account *</label>
                    <select className="form-input-field" value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={loadingAccounts}>
                        <option value="">{loadingAccounts ? 'Loading…' : 'Select account'}</option>
                        {filtered.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.code} · {a.name}
                            </option>
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
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-portal" onClick={loadLedger} disabled={loadingLedger}>
                        <Filter size={14} style={{ marginRight: 6 }} /> Apply
                    </button>
                </div>
            </section>

            {ledger?.account ? (
                <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><Book size={24} /></div>
                        <div>
                            <p className="cash-bank-stat-label">{ledger.account.code} · {ledger.account.name}</p>
                            <p className="cash-bank-stat-value">SAR {fmt(ledger.closingRunningBalance)}</p>
                            <p className="cash-bank-stat-meta">
                                {ledger.account.type} · normal {ledger.account.normalBalance}
                                {ledger.truncated ? ` · showing last ${ledger.returnedLines} of ${ledger.totalLines}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><RefreshCw size={24} /></div>
                        <div>
                            <p className="cash-bank-stat-label">Period Movement</p>
                            <p className="cash-bank-stat-value">DR SAR {fmt(totals.debit)}</p>
                            <p className="cash-bank-stat-meta">CR SAR {fmt(totals.credit)}</p>
                        </div>
                    </div>
                </div>
            ) : null}

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>
                        {loadingLedger ? 'Loading…' :
                            ledger?.lines?.length ? `${ledger.returnedLines} lines` : 'No data'}
                    </strong>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Entry #</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Source</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>Debit</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>Credit</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>Running Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!accountId ? (
                            <tr><td colSpan={8} className="table-cell table-empty">Pick an account to view its ledger.</td></tr>
                        ) : (ledger?.lines ?? []).length === 0 ? (
                            <tr><td colSpan={8} className="table-cell table-empty">No ledger entries for the selected period.</td></tr>
                        ) : ledger.lines.map((l) => (
                            <tr key={l.id}>
                                <td className="table-cell">{new Date(l.date).toLocaleDateString()}</td>
                                <td className="table-cell" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{l.entryNumber}</td>
                                <td className="table-cell">{l.journalType}</td>
                                <td className="table-cell" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {l.lineDescription || l.journalDescription || '—'}
                                </td>
                                <td className="table-cell">{l.source ?? '—'}</td>
                                <td className="table-cell" style={{ textAlign: 'right' }}>{l.debit ? `SAR ${fmt(l.debit)}` : '—'}</td>
                                <td className="table-cell" style={{ textAlign: 'right' }}>{l.credit ? `SAR ${fmt(l.credit)}` : '—'}</td>
                                <td className="table-cell" style={{ textAlign: 'right', fontWeight: 600 }}>SAR {fmt(l.runningBalance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
