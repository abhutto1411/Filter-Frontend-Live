import React, { useEffect, useMemo, useState } from 'react';
import {
    ChevronDown,
    Download,
    LayoutTemplate,
    TrendingDown,
    TrendingUp,
    X,
} from 'lucide-react';
import { getLedger, getLedgerAccounts } from '../../services/transactionsApi';

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

const formatDate = (v) =>
    new Date(v).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

const sar = (v) => `SAR ${Number(v || 0).toFixed(2)}`;

export default function LedgerView({ readOnly = false }) {
    const [accountId, setAccountId] = useState('');
    const [type, setType] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({ totalDebit: 0, totalCredit: 0, netBalance: 0 });
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const [acc, led] = await Promise.all([
                getLedgerAccounts(),
                getLedger({ accountId: accountId || undefined, type: type || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
            ]);
            setAccounts(parseArr(acc));
            setRows(Array.isArray(led.rows) ? led.rows : []);
            setSummary(led.summary || { totalDebit: 0, totalCredit: 0, netBalance: 0 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [accountId, type, dateFrom, dateTo]);

    const exportCsv = () => {
        const header = ['DATE', 'ACCOUNT', 'DESCRIPTION', 'REFERENCE', 'DEBIT (DR)', 'CREDIT (CR)', 'BALANCE'];
        const lines = rows.map((r) => [formatDate(r.date), r.account || '', r.description || '', r.reference || '', r.debit || 0, r.credit || 0, r.balance || 0]);
        const csv = [header, ...lines].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `general-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const tableRows = useMemo(() => rows, [rows]);

    return (
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>General Ledger</h2>
                    <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>View all financial transactions — linked to Chart of Accounts</p>
                </div>
                <button type="button" onClick={exportCsv} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Download size={14} /> Export
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 10 }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'flex', gap: 8 }}><TrendingUp size={18} color="#16a34a" /><div><div style={{ fontSize: 12, color: '#6b7280' }}>Total Debits</div><div style={{ color: '#16a34a', fontWeight: 800 }}>{sar(summary.totalDebit)}</div></div></div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'flex', gap: 8 }}><TrendingDown size={18} color="#dc2626" /><div><div style={{ fontSize: 12, color: '#6b7280' }}>Total Credits</div><div style={{ color: '#dc2626', fontWeight: 800 }}>{sar(summary.totalCredit)}</div></div></div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'flex', gap: 8 }}><LayoutTemplate size={18} color="#2563eb" /><div><div style={{ fontSize: 12, color: '#6b7280' }}>Net Balance</div><div style={{ color: '#374151', fontWeight: 800 }}>{sar(summary.netBalance)}</div></div></div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                    <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 30px 0 10px', appearance: 'none' }}>
                        <option value="">All Accounts</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: 11, color: '#9ca3af' }} />
                </div>
                <div style={{ position: 'relative' }}>
                    <select value={type} onChange={(e) => setType(e.target.value)} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 30px 0 10px', appearance: 'none' }}>
                        <option value="">All Types</option>
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: 11, color: '#9ca3af' }} />
                </div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                <button type="button" onClick={() => { setAccountId(''); setType(''); setDateFrom(''); setDateTo(''); }} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 4 }}><X size={14} /> Clear</button>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ textAlign: 'center', fontWeight: 800, paddingTop: 12 }}>Main Warehouse — General Ledger</div>
                <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 12, paddingBottom: 8 }}>{dateFrom || dateTo ? `${dateFrom || '...'} to ${dateTo || '...'}` : 'All Dates'}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {['DATE', 'ACCOUNT', 'DESCRIPTION', 'REFERENCE', 'DEBIT (DR)', 'CREDIT (CR)', 'BALANCE'].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', padding: '10px 8px', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 22 }}>Loading...</td></tr> :
                            tableRows.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 22, color: '#6b7280' }}>No ledger entries found for the selected filters</td></tr> :
                                tableRows.map((r, i) => (
                                    <tr key={`${r.reference}-${i}`}>
                                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f3f4f6' }}>{formatDate(r.date)}</td>
                                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.account}</td>
                                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{r.description || '-'}</td>
                                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{r.reference || '-'}</td>
                                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f3f4f6', color: '#16a34a' }}>{Number(r.debit) > 0 ? sar(r.debit) : '—'}</td>
                                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f3f4f6', color: '#dc2626' }}>{Number(r.credit) > 0 ? sar(r.credit) : '—'}</td>
                                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f3f4f6' }}>{sar(r.balance)}</td>
                                    </tr>
                                ))}
                        {!loading && tableRows.length > 0 && (
                            <tr style={{ background: '#f9fafb', fontWeight: 800 }}>
                                <td colSpan={4} style={{ padding: '10px 8px' }}>Totals</td>
                                <td style={{ padding: '10px 8px', color: '#16a34a' }}>{sar(summary.totalDebit)}</td>
                                <td style={{ padding: '10px 8px', color: '#dc2626' }}>{sar(summary.totalCredit)}</td>
                                <td style={{ padding: '10px 8px', color: '#D4A017' }}>{sar(summary.netBalance)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
