import React, { useEffect, useMemo, useState } from 'react';
import {
    Calendar,
    Camera,
    Check,
    CheckCircle,
    Clock,
    Plus,
    Search,
    Trash2,
    Upload,
    X,
    XCircle,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import {
    approveExpense,
    createExpense,
    createExpenseAccount,
    deleteExpense,
    getExpenseAccounts,
    getExpenses,
    getSummary,
} from '../../services/expensesApi';
import { getAccounts } from '../../services/accountsApi';
import { filterPortalVisibleBranches } from '../../services/workshopStaffApi';

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

const categories = ['Utilities', 'Repairs', 'Supplies', 'Rent', 'Salaries', 'Petty Cash', 'Transport', 'Maintenance', 'Marketing', 'Admin', 'Other'];

export default function ExpensesView({ readOnly = false }) {
    const [summary, setSummary] = useState({ totalApproved: 0, pendingApproval: 0, thisMonthCount: 0 });
    const [rows, setRows] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [coaAccounts, setCoaAccounts] = useState([]);
    const [branches, setBranches] = useState([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All Categories');
    const [status, setStatus] = useState('all');
    const [openAccount, setOpenAccount] = useState(false);
    const [openExpense, setOpenExpense] = useState(false);
    const [newAccount, setNewAccount] = useState({ name: '', code: '', category: 'Other', monthlyBudget: '', description: '' });
    const [expenseForm, setExpenseForm] = useState({ expenseAccountId: '', coaAccountId: '', category: 'Other', amount: '', date: new Date().toISOString().slice(0, 10), paymentMethod: 'Cash', branchId: '', description: '', proofUrl: '' });

    const load = async () => {
        const [s, e, a, coa, b] = await Promise.all([
            getSummary().catch(() => ({})),
            getExpenses({ search, category, status }).catch(() => ({ list: [] })),
            getExpenseAccounts().catch(() => []),
            getAccounts({ leafOnly: true }).catch(() => []),
            apiFetch('/super-admin/branches').catch(() => []),
        ]);
        setSummary({ totalApproved: Number(s.totalApproved || 0), pendingApproval: Number(s.pendingApproval || 0), thisMonthCount: Number(s.thisMonthCount || 0) });
        setRows(parseArr(e?.list ?? e));
        setAccounts(parseArr(a));
        setCoaAccounts(parseArr(coa));
        setBranches(filterPortalVisibleBranches(parseArr(b?.branches ?? b)));
    };
    useEffect(() => { load(); }, [search, category, status]);

    const filtered = useMemo(() => rows, [rows]);
    const small = { height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' };

    return (
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>Expenses</div>
                    <div style={{ color: '#64748b' }}>Track and manage business expenses</div>
                </div>
                {!readOnly && <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setOpenAccount(true)} style={{ ...small, background: '#fff' }}>New Expense Account</button>
                    <button onClick={() => setOpenExpense(true)} style={{ ...small, border: 'none', background: '#D4A017', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Add Expense</button>
                </div>}
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ border: '1px solid #dcfce7', background: '#f0fdf4', borderRadius: 10, padding: 12 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a' }}><CheckCircle size={16} /> Total Approved</div><div style={{ marginTop: 6, color: '#16a34a', fontWeight: 800, fontSize: 20 }}>SAR {summary.totalApproved.toFixed(2)}</div></div>
                <div style={{ border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 10, padding: 12 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ea580c' }}><Clock size={16} /> Pending Approval</div><div style={{ marginTop: 6, color: '#ea580c', fontWeight: 800, fontSize: 20 }}>SAR {summary.pendingApproval.toFixed(2)}</div></div>
                <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 10, padding: 12 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb' }}><Calendar size={16} /> This Month</div><div style={{ marginTop: 6, color: '#2563eb', fontWeight: 800, fontSize: 20 }}>{summary.thisMonthCount}</div><div style={{ fontSize: 12, color: '#1d4ed8' }}>Total submissions</div></div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses..." style={{ ...small, width: '100%', paddingLeft: 32 }} /></div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={small}><option>All Categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 16, borderBottom: '1px solid #e2e8f0' }}>
                {['all', 'pending', 'approved', 'rejected'].map((s) => <button key={s} onClick={() => setStatus(s)} style={{ border: 'none', background: 'transparent', padding: '0 0 10px', textTransform: 'capitalize', borderBottom: status === s ? '2px solid #D4A017' : '2px solid transparent' }}>{s}</button>)}
            </div>

            <div style={{ marginTop: 10, overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['DATE', 'CATEGORY', 'ACCOUNT', 'AMOUNT', 'PAYMENT METHOD', 'BRANCH', 'STATUS', 'ACTIONS'].map((h) => <th key={h} style={{ padding: 10, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12 }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {filtered.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No expenses found</td></tr> : filtered.map((r) => {
                            const pending = r.status === 'pending';
                            return <tr key={r.id}>
                                <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</td>
                                <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}><span style={{ background: '#f1f5f9', borderRadius: 999, padding: '4px 8px', fontSize: 12 }}>{r.category}</span></td>
                                <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{r.expenseAccountName || '-'}</td>
                                <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>SAR {Number(r.amount || 0).toFixed(2)}</td>
                                <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{r.paymentMethod}</td>
                                <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{r.branchName || '-'}</td>
                                <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}><span style={{ borderRadius: 999, padding: '4px 8px', fontSize: 12, background: r.status === 'approved' ? '#dcfce7' : r.status === 'rejected' ? '#fee2e2' : '#fef3c7', color: r.status === 'approved' ? '#166534' : r.status === 'rejected' ? '#991b1b' : '#92400e' }}>{r.status}</span></td>
                                <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
                                    {!readOnly && pending && <>
                                        <button onClick={() => approveExpense(r.id, { approved: true }).then(load)} style={{ border: 'none', background: 'transparent', color: '#16a34a' }}><Check size={16} /></button>
                                        <button onClick={() => approveExpense(r.id, { approved: false, rejectionReason: 'Rejected' }).then(load)} style={{ border: 'none', background: 'transparent', color: '#dc2626' }}><XCircle size={16} /></button>
                                    </>}
                                    {!readOnly && <button onClick={() => deleteExpense(r.id).then(load)} style={{ border: 'none', background: 'transparent', color: '#dc2626' }}><Trash2 size={16} /></button>}
                                </td>
                            </tr>;
                        })}
                    </tbody>
                </table>
            </div>

            {openAccount && <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', zIndex: 80 }}>
                <div style={{ width: 560, maxWidth: '95vw', background: '#fff', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0 }}>New Expense Account</h3><button onClick={() => setOpenAccount(false)} style={{ border: 'none', background: 'transparent' }}><X /></button></div>
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input placeholder="Account Name *" value={newAccount.name} onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })} style={small} />
                        <input placeholder="Account Code" value={newAccount.code} onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })} style={small} />
                    </div>
                    <select value={newAccount.category} onChange={(e) => setNewAccount({ ...newAccount, category: e.target.value })} style={{ ...small, width: '100%', marginTop: 8 }}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
                    <input type="number" placeholder="Monthly Budget SAR (optional)" value={newAccount.monthlyBudget} onChange={(e) => setNewAccount({ ...newAccount, monthlyBudget: e.target.value })} style={{ ...small, width: '100%', marginTop: 8 }} />
                    <textarea placeholder="Description" value={newAccount.description} onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })} style={{ marginTop: 8, width: '100%', minHeight: 70, border: '1px solid #d1d5db', borderRadius: 8, padding: 10 }} />
                    <button onClick={() => createExpenseAccount({ ...newAccount, monthlyBudget: newAccount.monthlyBudget ? Number(newAccount.monthlyBudget) : undefined }).then(() => { setOpenAccount(false); load(); })} style={{ marginTop: 8, ...small, border: 'none', background: '#D4A017', color: '#fff' }}>Create Account</button>
                </div>
            </div>}

            {openExpense && <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', zIndex: 80 }}>
                <div style={{ width: 680, maxWidth: '96vw', background: '#fff', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0 }}>Submit Expense</h3><button onClick={() => setOpenExpense(false)} style={{ border: 'none', background: 'transparent' }}><X /></button></div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>Scan Receipt (optional — auto-fills fields)</div>
                    <div style={{ marginTop: 8, border: '1px dashed #cbd5e1', borderRadius: 10, padding: 14, textAlign: 'center' }}><Camera size={20} /><div>Scan a receipt</div><div style={{ color: '#94a3b8' }}>Drag & drop or click</div><button style={{ marginTop: 8, ...small, width: 140, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Upload size={14} /> Choose Image</button></div>
                    <select value={expenseForm.expenseAccountId} onChange={(e) => setExpenseForm({ ...expenseForm, expenseAccountId: e.target.value })} style={{ ...small, width: '100%', marginTop: 8 }}><option value="">Expense Account *</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} style={small}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
                        <input type="number" placeholder="Amount SAR *" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} style={small} />
                    </div>
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} style={small} />
                        <select value={expenseForm.paymentMethod} onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })} style={small}><option>Cash</option><option>Bank Transfer</option><option>Petty Cash</option></select>
                    </div>
                    <select value={expenseForm.branchId} onChange={(e) => setExpenseForm({ ...expenseForm, branchId: e.target.value })} style={{ ...small, width: '100%', marginTop: 8 }}><option value="">Branch</option>{branches.map((b) => <option key={String(b.id)} value={String(b.id)}>{b.name}</option>)}</select>
                    <select value={expenseForm.coaAccountId} onChange={(e) => setExpenseForm({ ...expenseForm, coaAccountId: e.target.value })} style={{ ...small, width: '100%', marginTop: 8 }}><option value="">COA Account (optional)</option>{coaAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select>
                    <textarea placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} style={{ marginTop: 8, width: '100%', minHeight: 70, border: '1px solid #d1d5db', borderRadius: 8, padding: 10 }} />
                    <button onClick={() => createExpense({ ...expenseForm, amount: Number(expenseForm.amount || 0), branchId: expenseForm.branchId || undefined, coaAccountId: expenseForm.coaAccountId || undefined, expenseAccountId: expenseForm.expenseAccountId || undefined }).then(() => { setOpenExpense(false); load(); })} style={{ marginTop: 10, ...small, border: 'none', background: '#D4A017', color: '#fff' }}>Submit for Approval</button>
                </div>
            </div>}
        </div>
    );
}
