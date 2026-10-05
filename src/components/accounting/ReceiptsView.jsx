import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, Banknote, Building2, CreditCard, Eye, Filter, Search, Trash2, X } from 'lucide-react';
import { getAccounts as getCashBankAccounts } from '../../services/cashBankApi';
import { getLedgerAccounts, getSummary, getTransactions } from '../../services/transactionsApi';

const parseArr = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.list)) return res.list;
    if (res && Array.isArray(res.entries)) return res.entries;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && typeof res === 'object') {
        return Object.values(res).filter(
            (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && v.id,
        );
    }
    return [];
};

const methodTabs = ['All', 'Cash', 'Bank', 'Card', 'Cheque'];

export default function ReceiptsView({ readOnly = false }) {
    const [summary, setSummary] = useState({ totalReceived: 0, cashTotal: 0, bankTotal: 0, cardTotal: 0 });
    const [rows, setRows] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [cashBankAccounts, setCashBankAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [methodTab, setMethodTab] = useState('All');
    const [showFilters, setShowFilters] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [accountId, setAccountId] = useState('');
    const [cashBankAccountId, setCashBankAccountId] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [sum, txRes, ledgerAccounts, cbAccounts] = await Promise.all([
                getSummary(),
                getTransactions({ type: 'receipt', dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 500 }),
                getLedgerAccounts(),
                getCashBankAccounts(),
            ]);
            setSummary(sum?.receipts || { totalReceived: 0, cashTotal: 0, bankTotal: 0, cardTotal: 0 });
            setRows(parseArr(txRes?.list ?? txRes));
            setAccounts(parseArr(ledgerAccounts));
            setCashBankAccounts(parseArr(cbAccounts));
        } catch (e) {
            setError(e.message || 'Failed to load receipts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [dateFrom, dateTo]);

    const filtered = useMemo(() => rows.filter((r) => {
        const q = search.trim().toLowerCase();
        const method = (r.notes || '').toLowerCase();
        const matchSearch = !q || (r.payeeName || '').toLowerCase().includes(q) || (r.voucherNumber || '').toLowerCase().includes(q) || (r.reference || '').toLowerCase().includes(q);
        const matchMethod = methodTab === 'All'
            || (methodTab === 'Cash' && method.includes('cash'))
            || (methodTab === 'Bank' && (method.includes('bank') || method.includes('transfer')))
            || (methodTab === 'Card' && method.includes('card'))
            || (methodTab === 'Cheque' && method.includes('cheque'));
        const matchAccount = !accountId || r.accountId === accountId;
        const matchCashBank = !cashBankAccountId || r.cashBankAccountId === cashBankAccountId;
        return matchSearch && matchMethod && matchAccount && matchCashBank;
    }), [rows, search, methodTab, accountId, cashBankAccountId]);

    const tableCell = { padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#111827' };
    const badgeForMethod = (m) => {
        const v = (m || '').toLowerCase();
        if (v.includes('cash')) return { bg: '#dcfce7', fg: '#166534', text: 'Cash' };
        if (v.includes('bank') || v.includes('transfer')) return { bg: '#dbeafe', fg: '#1d4ed8', text: 'Bank Transfer' };
        if (v.includes('card')) return { bg: '#ede9fe', fg: '#6d28d9', text: 'Card' };
        if (v.includes('cheque')) return { bg: '#f1f5f9', fg: '#334155', text: 'Cheque' };
        return { bg: '#f1f5f9', fg: '#334155', text: 'Other' };
    };

    return (
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Receipts</div>
                <div style={{ color: '#64748b' }}>Receipt transaction log — entries recorded via Transaction Entry</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ border: '1px solid #dcfce7', background: '#f0fdf4', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontSize: 12 }}><ArrowDownLeft size={15} /> Total Received</div>
                    <div style={{ marginTop: 6, color: '#15803d', fontWeight: 800, fontSize: 20 }}>SAR {Number(summary.totalReceived || 0).toFixed(2)}</div>
                </div>
                <div style={{ border: '1px solid #dcfce7', background: '#f0fdf4', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontSize: 12 }}><Banknote size={15} /> Cash</div>
                    <div style={{ marginTop: 6, color: '#15803d', fontWeight: 800, fontSize: 20 }}>SAR {Number(summary.cashTotal || 0).toFixed(2)}</div>
                </div>
                <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1d4ed8', fontSize: 12 }}><Building2 size={15} /> Bank Transfer</div>
                    <div style={{ marginTop: 6, color: '#1d4ed8', fontWeight: 800, fontSize: 20 }}>SAR {Number(summary.bankTotal || 0).toFixed(2)}</div>
                </div>
                <div style={{ border: '1px solid #e9d5ff', background: '#faf5ff', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7e22ce', fontSize: 12 }}><CreditCard size={15} /> Card</div>
                    <div style={{ marginTop: 6, color: '#7e22ce', fontWeight: 800, fontSize: 20 }}>SAR {Number(summary.cardTotal || 0).toFixed(2)}</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by payer or receipt #..." style={{ width: '100%', height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px 0 32px' }} />
                </div>
                {methodTabs.map((t) => (
                    <button key={t} onClick={() => setMethodTab(t)} style={{ border: 'none', background: 'transparent', borderBottom: methodTab === t ? '2px solid #D4A017' : '2px solid transparent', padding: '6px 2px' }}>{t}</button>
                ))}
                <button onClick={() => setShowFilters((v) => !v)} style={{ height: 34, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6 }}><Filter size={14} /> Filters</button>
            </div>

            {showFilters && (
                <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8 }}>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                    <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }}><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select>
                    <select value={cashBankAccountId} onChange={(e) => setCashBankAccountId(e.target.value)} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }}><option value="">All (Cash/Bank/Petty)</option>{cashBankAccounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{a.name}</option>)}</select>
                    <button onClick={() => { setDateFrom(''); setDateTo(''); setAccountId(''); setCashBankAccountId(''); setSearch(''); setMethodTab('All'); }} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> Clear Filters</button>
                </div>
            )}

            {loading ? <div style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>Loading receipts...</div> : error ? <div style={{ padding: 28, textAlign: 'center', color: '#dc2626' }}>{error}</div> : (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>{['Receipt #', 'Date', 'Received From', 'Description', 'Method', 'Amount (SAR)', 'Status', 'Actions'].map((h) => <th key={h} style={{ ...tableCell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 700 }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {filtered.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 34, color: '#94a3b8' }}>No receipts found</td></tr> : filtered.map((r) => {
                                const method = badgeForMethod(r.notes || '');
                                return (
                                    <tr key={r.id}>
                                        <td style={{ ...tableCell, color: '#D4A017', fontWeight: 700, fontFamily: 'monospace' }}>{r.voucherNumber}</td>
                                        <td style={tableCell}>{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</td>
                                        <td style={tableCell}>{r.payeeName || '-'}</td>
                                        <td style={{ ...tableCell, color: '#6b7280' }}>{r.reference || '-'}</td>
                                        <td style={tableCell}><span style={{ borderRadius: 999, padding: '4px 8px', fontSize: 11, background: method.bg, color: method.fg }}>{method.text}</span></td>
                                        <td style={{ ...tableCell, color: '#15803d', fontWeight: 700 }}>SAR {Number(r.amount || 0).toFixed(2)}</td>
                                        <td style={tableCell}><span style={{ borderRadius: 999, padding: '4px 8px', fontSize: 11, background: '#dcfce7', color: '#166534' }}>{r.status || 'posted'}</span></td>
                                        <td style={tableCell}>
                                            <button style={{ border: 'none', background: 'transparent' }}><Eye size={16} /></button>
                                            {!readOnly && <button style={{ border: 'none', background: 'transparent', color: '#dc2626' }}><Trash2 size={16} /></button>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
