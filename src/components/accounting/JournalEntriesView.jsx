import React, { useEffect, useMemo, useState } from 'react';
import {
    Book,
    CheckCircle,
    ChevronDown,
    Eye,
    FileText,
    Filter,
    Plus,
    Printer,
    Search,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { getAccounts } from '../../services/accountsApi';
import {
    createJournalEntry,
    deleteJournalEntry,
    getJournalEntries,
    getStats,
} from '../../services/journalEntriesApi';

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

const rowDate = (d) =>
    new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

const sar = (v) => `SAR ${Number(v || 0).toFixed(2)}`;

const baseLine = { accountId: '', description: '', debit: 0, credit: 0 };

const printTemplate = (je) => `
            <html>
                <head>
                    <title>Journal Voucher - ${je.entryNumber}</title>
                    <style>
                        body { font-family: 'Poppins', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                        .voucher-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
                        .company-info h1 { margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; }
                        .company-info p { margin: 4px 0; color: #64748b; font-size: 14px; }
                        .voucher-title-box { text-align: right; }
                        .voucher-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; }
                        .voucher-id { font-size: 14px; font-weight: 700; color: #3b82f6; margin-top: 4px; }
                        .details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
                        .detail-item { display: flex; flex-direction: column; }
                        .detail-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
                        .detail-value { font-size: 14px; font-weight: 600; color: #334155; }
                        .description-box { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 40px; border: 1px solid #f1f5f9; }
                        .description-text { margin: 0; font-size: 14px; color: #475569; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                        th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0; }
                        td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
                        .text-right { text-align: right; }
                        .totals-row td { background: #f8fafc; font-weight: 800; font-size: 14px; border-top: 2px solid #e2e8f0; border-bottom: none; }
                        .debit-color { color: #059669; }
                        .credit-color { color: #2563eb; }
                    </style>
                </head>
                <body>
                    <div class="voucher-header">
                        <div class="company-info">
                            <h1>Filter Pos Panels</h1>
                            <p>Premium Automotive Services Portal</p>
                        </div>
                        <div class="voucher-title-box">
                            <h2 class="voucher-title">Journal Voucher</h2>
                            <div class="voucher-id">${je.entryNumber}</div>
                        </div>
                    </div>
                    <div class="details-grid">
                        <div class="detail-item"><span class="detail-label">Entry Date</span><span class="detail-value">${rowDate(je.date)}</span></div>
                        <div class="detail-item"><span class="detail-label">Entry Type</span><span class="detail-value">${je.type}</span></div>
                        <div class="detail-item"><span class="detail-label">Status</span><span class="detail-value">${je.status}</span></div>
                    </div>
                    <div class="description-box"><span class="detail-label">Description / Memo</span><p class="description-text">${je.description || '-'}</p></div>
                    <table>
                        <thead><tr><th>Account Name</th><th>Description</th><th class="text-right">Debit (SAR)</th><th class="text-right">Credit (SAR)</th></tr></thead>
                        <tbody>
                            ${je.lines.map((line) => `<tr><td style="font-weight:700;">${line.accountName || '-'}</td><td style="color:#64748b;">${line.description || '-'}</td><td class="text-right debit-color">${line.debit ? Number(line.debit).toFixed(2) : '—'}</td><td class="text-right credit-color">${line.credit ? Number(line.credit).toFixed(2) : '—'}</td></tr>`).join('')}
                        </tbody>
                        <tfoot><tr class="totals-row"><td colspan="2">Totals</td><td class="text-right debit-color">${Number(je.totalDebit).toFixed(2)}</td><td class="text-right credit-color">${Number(je.totalCredit).toFixed(2)}</td></tr></tfoot>
                    </table>
                </body>
            </html>
`;

export default function JournalEntriesView({ readOnly = false }) {
    const [stats, setStats] = useState({ totalEntries: 0, postedCount: 0, balancedCount: 0, totalDebit: 0 });
    const [entries, setEntries] = useState([]);
    const [coaAccounts, setCoaAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [type, setType] = useState('');
    const [showDateRange, setShowDateRange] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [viewOpen, setViewOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [newOpen, setNewOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [newForm, setNewForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        type: 'General',
        description: '',
        lines: [{ ...baseLine }, { ...baseLine }],
    });

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [statsRes, listRes, accountsRes] = await Promise.all([
                getStats(),
                getJournalEntries({
                    ...(type ? { type } : {}),
                    ...(dateFrom ? { dateFrom } : {}),
                    ...(dateTo ? { dateTo } : {}),
                    ...(debouncedSearch ? { search: debouncedSearch } : {}),
                }),
                getAccounts(),
            ]);
            setStats({
                totalEntries: Number(statsRes.totalEntries || 0),
                postedCount: Number(statsRes.postedCount || 0),
                balancedCount: Number(statsRes.balancedCount || 0),
                totalDebit: Number(statsRes.totalDebit || 0),
            });
            setEntries(parseArr(listRes?.entries ?? listRes));
            setCoaAccounts(parseArr(accountsRes));
        } catch (e) {
            setError(e.message || 'Failed to load journal entries');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [type, dateFrom, dateTo, debouncedSearch]);

    const totals = useMemo(() => {
        const totalDebit = newForm.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
        const totalCredit = newForm.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
        return {
            totalDebit,
            totalCredit,
            diff: Number((totalDebit - totalCredit).toFixed(2)),
        };
    }, [newForm.lines]);

    const invalidCreate =
        totals.diff !== 0 ||
        newForm.lines.some((l) => !l.accountId) ||
        newForm.lines.length < 2;

    const updateLine = (idx, key, value) => {
        setNewForm((f) => ({
            ...f,
            lines: f.lines.map((line, i) => (i === idx ? { ...line, [key]: value } : line)),
        }));
    };

    const addLine = () => setNewForm((f) => ({ ...f, lines: [...f.lines, { ...baseLine }] }));

    const removeLine = (idx) => {
        if (newForm.lines.length <= 2) return;
        setNewForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
    };

    const onCreate = async () => {
        setSubmitting(true);
        setFormError('');
        try {
            await createJournalEntry({
                date: newForm.date,
                type: newForm.type,
                description: newForm.description || undefined,
                lines: newForm.lines.map((l) => ({
                    accountId: l.accountId,
                    description: l.description || undefined,
                    debit: Number(l.debit || 0),
                    credit: Number(l.credit || 0),
                })),
            });
            setNewOpen(false);
            setNewForm({
                date: new Date().toISOString().slice(0, 10),
                type: 'General',
                description: '',
                lines: [{ ...baseLine }, { ...baseLine }],
            });
            await load();
        } catch (e) {
            setFormError(e.message || 'Failed to create journal entry');
        } finally {
            setSubmitting(false);
        }
    };

    const onDelete = async (id) => {
        await deleteJournalEntry(id);
        if (selected?.id === id) {
            setViewOpen(false);
            setSelected(null);
        }
        await load();
    };

    const onPrint = (je) => {
        const w = window.open('', '_blank');
        w.document.write(printTemplate(je));
        w.document.close();
        w.onload = () => w.print();
    };

    const modalOverlay = {
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.62)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    };

    return (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 14 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>General Journal</h2>
                    <p style={{ margin: '6px 0 0 0', color: '#6b7280', fontSize: 14 }}>
                        General journal transaction log — entries recorded via Transaction Entry
                    </p>
                </div>
                {!readOnly && (
                    <button type="button" onClick={() => setNewOpen(true)} style={{ background: '#D4A017', color: '#fff', border: 'none', height: 38, borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, cursor: 'pointer' }}>
                        <Plus size={16} /> New Entry
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, marginBottom: 12 }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'flex', gap: 10 }}>
                    <Book color="#7c3aed" size={20} />
                    <div><div style={{ fontSize: 12, color: '#6b7280' }}>Total Entries</div><div style={{ fontWeight: 800 }}>{stats.totalEntries}</div></div>
                </div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'flex', gap: 10 }}>
                    <CheckCircle color="#16a34a" size={20} />
                    <div><div style={{ fontSize: 12, color: '#6b7280' }}>Posted / Balanced</div><div style={{ fontWeight: 800 }}>{stats.postedCount} / {stats.balancedCount}</div></div>
                </div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'flex', gap: 10 }}>
                    <FileText color="#2563eb" size={20} />
                    <div><div style={{ fontSize: 12, color: '#6b7280' }}>Total Debit</div><div style={{ fontWeight: 800 }}>{sar(stats.totalDebit)}</div></div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', top: 11, left: 10, color: '#9ca3af' }} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entry # or description..." style={{ width: '100%', border: '1px solid #d1d5db', height: 38, borderRadius: 8, padding: '0 10px 0 34px' }} />
                </div>
                <div style={{ position: 'relative' }}>
                    <select value={type} onChange={(e) => setType(e.target.value)} style={{ border: '1px solid #d1d5db', height: 38, borderRadius: 8, padding: '0 34px 0 10px', appearance: 'none' }}>
                        <option value="">All Types</option>
                        <option value="General">General</option>
                        <option value="Adjustment">Adjustment</option>
                        <option value="Opening Balance">Opening Balance</option>
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', top: 11, right: 10, color: '#9ca3af' }} />
                </div>
                <button type="button" onClick={() => setShowDateRange((s) => !s)} style={{ border: '1px solid #d1d5db', height: 38, borderRadius: 8, background: '#fff', padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <Filter size={14} /> Date Range
                </button>
            </div>

            {showDateRange && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ border: '1px solid #d1d5db', height: 36, borderRadius: 8, padding: '0 10px' }} />
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ border: '1px solid #d1d5db', height: 36, borderRadius: 8, padding: '0 10px' }} />
                    <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', padding: '0 10px' }}>Clear</button>
                </div>
            )}

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {['Entry #', 'Date', 'Type', 'Description', 'Lines', 'Total Dr', 'Total Cr', 'Balanced', 'Status', 'Actions'].map((h) => (
                                <th key={h} style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', padding: '10px 8px', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center' }}>Loading...</td></tr>
                            : error ? <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#b91c1c' }}>{error}</td></tr>
                                : entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} style={{ padding: 28, textAlign: 'center', color: '#6b7280' }}>
                                            <Book size={20} style={{ marginBottom: 6 }} />
                                            <div>No journal entries yet</div>
                                        </td>
                                    </tr>
                                ) : entries.map((e) => (
                                    <tr key={e.id}>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', color: '#D4A017', fontWeight: 800, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{e.entryNumber}</td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{rowDate(e.date)}</td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}><span style={{ background: '#f3f4f6', borderRadius: 999, padding: '4px 8px', fontSize: 11 }}>{e.type}</span></td>
                                        <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280', padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{e.description || '-'}</td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}><span style={{ background: '#f3f4f6', borderRadius: 999, padding: '3px 8px', fontSize: 11 }}>{e.lines?.length || 0}</span></td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', color: '#059669', fontWeight: 800 }}>{sar(e.totalDebit)}</td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', color: '#2563eb', fontWeight: 800 }}>{sar(e.totalCredit)}</td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{e.isBalanced ? <CheckCircle size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}</td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}><span style={{ background: '#e5e7eb', color: '#111827', borderRadius: 999, padding: '4px 8px', fontSize: 11 }}>POSTED</span></td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button type="button" onClick={() => { setSelected(e); setViewOpen(true); }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><Eye size={16} /></button>
                                                <button type="button" onClick={() => onPrint(e)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><Printer size={16} /></button>
                                                {!readOnly && <button type="button" onClick={() => onDelete(e.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={16} /></button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div>

            {viewOpen && selected && (
                <div style={modalOverlay}>
                    <div style={{ width: '100%', maxWidth: 900, background: '#fff', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Journal Entry — {selected.entryNumber}</h3>
                            <button type="button" onClick={() => setViewOpen(false)} style={{ border: 'none', background: 'none' }}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                            <div><b>Entry #:</b> {selected.entryNumber}</div>
                            <div><b>Date:</b> {rowDate(selected.date)}</div>
                            <div><b>Type:</b> {selected.type}</div>
                            <div><b>Status:</b> {selected.status}</div>
                            <div><b>Total Debit:</b> {sar(selected.totalDebit)}</div>
                            <div><b>Total Credit:</b> {sar(selected.totalCredit)}</div>
                        </div>
                        <div style={{ marginTop: 10, background: '#f9fafb', borderRadius: 8, padding: 10 }}>{selected.description || '-'}</div>
                        <h4 style={{ marginTop: 14, marginBottom: 8 }}>Journal Lines</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ background: '#f9fafb' }}><th style={{ textAlign: 'left', padding: 8 }}>Account</th><th style={{ textAlign: 'left', padding: 8 }}>Description</th><th style={{ textAlign: 'right', padding: 8 }}>Debit (SAR)</th><th style={{ textAlign: 'right', padding: 8 }}>Credit (SAR)</th></tr></thead>
                            <tbody>
                                {selected.lines.map((l) => (
                                    <tr key={l.id}>
                                        <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{l.accountName || '-'}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{l.description || '-'}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: '#059669' }}>{l.debit ? Number(l.debit).toFixed(2) : '-'}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: '#2563eb' }}>{l.credit ? Number(l.credit).toFixed(2) : '-'}</td>
                                    </tr>
                                ))}
                                <tr style={{ background: '#f9fafb' }}>
                                    <td colSpan={2} style={{ padding: 8, fontWeight: 700 }}>Totals</td>
                                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: '#059669' }}>{Number(selected.totalDebit).toFixed(2)}</td>
                                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{Number(selected.totalCredit).toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                            {!readOnly && <button type="button" onClick={() => onDelete(selected.id)} style={{ border: 'none', background: '#dc2626', color: '#fff', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Trash2 size={14} /> Delete</button>}
                        </div>
                    </div>
                </div>
            )}

            {newOpen && !readOnly && (
                <div style={modalOverlay}>
                    <div style={{ width: '100%', maxWidth: 980, background: '#fff', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>New Journal Entry</h3>
                            <button type="button" onClick={() => setNewOpen(false)} style={{ border: 'none', background: 'none' }}><X size={18} /></button>
                        </div>
                        {formError ? <div style={{ color: '#b91c1c', marginTop: 8 }}>{formError}</div> : null}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                            <input type="date" value={newForm.date} onChange={(e) => setNewForm((f) => ({ ...f, date: e.target.value }))} style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                            <select value={newForm.type} onChange={(e) => setNewForm((f) => ({ ...f, type: e.target.value }))} style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }}>
                                <option>General</option><option>Adjustment</option><option>Opening Balance</option>
                            </select>
                            <textarea value={newForm.description} onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description" style={{ gridColumn: '1 / -1', minHeight: 68, border: '1px solid #d1d5db', borderRadius: 8, padding: 10 }} />
                        </div>
                        <h4 style={{ margin: '12px 0 8px 0' }}>Journal Lines</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ background: '#f9fafb' }}><th style={{ textAlign: 'left', padding: 8 }}>Account</th><th style={{ textAlign: 'left', padding: 8 }}>Description</th><th style={{ textAlign: 'left', padding: 8 }}>Debit</th><th style={{ textAlign: 'left', padding: 8 }}>Credit</th><th style={{ width: 40 }}></th></tr></thead>
                            <tbody>
                                {newForm.lines.map((l, idx) => (
                                    <tr key={idx}>
                                        <td style={{ padding: 8 }}>
                                            <select value={l.accountId} onChange={(e) => updateLine(idx, 'accountId', e.target.value)} style={{ width: '100%', height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 8px' }}>
                                                <option value="">Select account</option>
                                                {coaAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: 8 }}><input value={l.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} style={{ width: '100%', height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 8px' }} /></td>
                                        <td style={{ padding: 8 }}><input type="number" value={l.debit} onChange={(e) => updateLine(idx, 'debit', e.target.value)} style={{ width: '100%', height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 8px' }} /></td>
                                        <td style={{ padding: 8 }}><input type="number" value={l.credit} onChange={(e) => updateLine(idx, 'credit', e.target.value)} style={{ width: '100%', height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 8px' }} /></td>
                                        <td style={{ padding: 8 }}>{newForm.lines.length > 2 ? <button type="button" onClick={() => removeLine(idx)} style={{ border: 'none', background: 'none', color: '#dc2626' }}><X size={14} /></button> : null}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button type="button" onClick={addLine} style={{ marginTop: 8, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', padding: '6px 10px' }}>+ Add Line</button>
                        <div style={{ marginTop: 10, background: '#f9fafb', borderRadius: 8, padding: 10, display: 'flex', gap: 16, fontSize: 13 }}>
                            <span>Total Debit: {sar(totals.totalDebit)}</span>
                            <span>Total Credit: {sar(totals.totalCredit)}</span>
                            <span style={{ color: totals.diff === 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>Difference: {sar(Math.abs(totals.diff))}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                            <button type="button" onClick={() => setNewOpen(false)} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, padding: '8px 12px' }}>Cancel</button>
                            <button title={invalidCreate ? 'Entry must be balanced and all lines need an account' : ''} disabled={invalidCreate || submitting} type="button" onClick={onCreate} style={{ border: 'none', background: '#D4A017', color: '#fff', borderRadius: 8, padding: '8px 12px', opacity: invalidCreate || submitting ? 0.6 : 1 }}>
                                Create Journal Entry
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
