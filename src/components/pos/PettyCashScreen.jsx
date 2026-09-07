import { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, Plus, TrendingDown, TrendingUp, History, Check } from 'lucide-react';
import { apiFetch } from '../../services/api';

const DEFAULT_CATEGORIES = [
    { value: 'placeholder_supplies', label: 'Supplies' },
    { value: 'placeholder_cleaning', label: 'Cleaning' },
    { value: 'placeholder_food', label: 'Food & Drinks' },
    { value: 'placeholder_transport', label: 'Transport' },
    { value: 'placeholder_maintenance', label: 'Maintenance' },
    { value: 'placeholder_other', label: 'Other' },
];

export default function PettyCashScreen({ onBack }) {
    const [tab, setTab] = useState('expense');
    const [balance, setBalance] = useState(null);
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
    const [history, setHistory] = useState([]);
    const [histLoading, setHistLoading] = useState(true);

    const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', categoryId: '', notes: '' });
    const [fundForm, setFundForm] = useState({ amount: '', reason: '' });
    const [submitting, setSubmitting] = useState(false);

    const loadHistory = () => {
        setHistLoading(true);
        apiFetch('/cashier/expense/history?limit=20')
            .then(d => {
                const list = d.items || d.requests || d.history || d.expenses || d.data || d || [];
                setHistory(Array.isArray(list) ? list : []);
            })
            .catch(() => setHistory([]))
            .finally(() => setHistLoading(false));
    };

    const loadBalance = () => {
        // Reference endpoint: GET /cashier/wallet/balance?currency=SAR
        apiFetch('/cashier/wallet/balance?currency=SAR')
            .then(d => setBalance(parseFloat(d.balance ?? d.amount ?? d.data?.balance ?? 0)))
            .catch(() => setBalance(0));
    };

    useEffect(() => {
        loadBalance();
        
        const fetchCats = async () => {
            const endpoints = [
                '/cashier/expense-categories',
                '/cashier/expense/categories',
                '/workshop-staff/expense-categories'
            ];
            
            for (const ep of endpoints) {
                try {
                    const d = await apiFetch(ep);
                    let list = [];
                    if (Array.isArray(d)) {
                        list = d;
                    } else if (d && typeof d === 'object') {
                        // Extract list from various possible response keys
                        const raw = d.categories || d.data || d.items || d.results || d.payload || d.expenseCategories || [];
                        if (Array.isArray(raw)) {
                            list = raw;
                        } else if (d.data && d.data.categories && Array.isArray(d.data.categories)) {
                            list = d.data.categories;
                        }
                    }
                    
                    if (list && list.length > 0) {
                        setCategories(list.map(c => ({ 
                            value: String(c.id || c.value || ''), 
                            label: String(c.name || c.label || c.title || 'Unknown') 
                        })));
                        return; // Found categories, stop searching
                    }
                } catch (err) {
                    // Try next endpoint
                }
            }
        };

        fetchCats();
        loadHistory();
    }, []);

    const submitExpense = async (e) => {
        e.preventDefault();
        const amt = parseFloat(expenseForm.amount);
        if (!expenseForm.description || !amt) return alert('Please fill description and amount');
        
        if (!expenseForm.categoryId) return alert('Please select a category');
        
        if (String(expenseForm.categoryId).startsWith('placeholder_')) {
            return alert('The selected category is a placeholder. Please set up "Expense Accounts" in the Workshop Portal first so they appear here with valid IDs.');
        }

        setSubmitting(true);
        try {
            const body = {
                amount: amt,
                categoryId: expenseForm.categoryId,
                description: expenseForm.description,
                notes: expenseForm.notes || '',
            };

            await apiFetch('/cashier/expense/submit', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            setExpenseForm({ description: '', amount: '', categoryId: '', notes: '' });
            alert('Expense recorded successfully');
            loadBalance();
            loadHistory();
        } catch (err) {
            alert('Server Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const submitFund = async (e) => {
        e.preventDefault();
        const amt = parseFloat(fundForm.amount);
        if (!amt || !fundForm.reason) return alert('Please fill amount and reason');
        setSubmitting(true);
        try {
            await apiFetch('/cashier/petty-cash/request', {
                method: 'POST',
                body: JSON.stringify({ type: 'fund', amount: amt, reason: fundForm.reason, description: fundForm.reason }),
            });
            setFundForm({ amount: '', reason: '' });
            alert('Fund request submitted');
            loadBalance();
            loadHistory();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ width: '100%', minHeight: '100%', background: '#F8FAF9', padding: 24, boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                {onBack && <button onClick={onBack} style={iconBtnStyle}><ArrowLeft size={18} /></button>}
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#1E2124' }}>Petty Cash Management</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Record expenditures and manage workshop liquidity</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 2fr)', gap: 32 }}>
                {/* LEFT: Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Balance Widget */}
                    <div style={{ background: '#23262D', borderRadius: 32, padding: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', right: -20, top: -20, opacity: 0.1 }}>
                            <Wallet size={120} color="#FCC247" />
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#FCC247', fontWeight: 900, letterSpacing: 1.5 }}>CURRENT BALANCE</p>
                        <p style={{ margin: 0, fontSize: '2.8rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                            <span style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.4)', marginRight: 6 }}>SAR</span>
                            {balance === null ? '—' : balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                            Ready for workshop operations
                        </div>
                    </div>

                    {/* Interactive Area (Tabs + Forms) */}
                    <div style={{ background: '#fff', borderRadius: 28, padding: 24, border: '1.5px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#F8FAF9', padding: 4, borderRadius: 16 }}>
                            <TabBtn active={tab === 'expense'} onClick={() => setTab('expense')} icon={<TrendingDown size={14} />} label="Expense" />
                            <TabBtn active={tab === 'fund'} onClick={() => setTab('fund')} icon={<TrendingUp size={14} />} label="Top-Up" />
                        </div>

                        {tab === 'expense' ? (
                            <form onSubmit={submitExpense} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <Field label="DESCRIPTION *">
                                    <input style={fieldInput} placeholder="e.g., Cleaning Supplies" value={expenseForm.description}
                                        onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} />
                                </Field>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <Field label="AMOUNT (SAR) *">
                                        <input style={fieldInput} type="number" step="0.01" placeholder="0.00" value={expenseForm.amount}
                                            onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
                                    </Field>
                                    <Field label="CATEGORY">
                                        <select style={fieldInput} value={expenseForm.categoryId}
                                            onChange={e => setExpenseForm(f => ({ ...f, categoryId: e.target.value }))}>
                                            <option value="">Select...</option>
                                            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                        </select>
                                    </Field>
                                </div>
                                <Field label="NOTES (OPTIONAL)">
                                    <textarea style={{ ...fieldInput, height: 80, padding: '12px 16px', resize: 'none' }} placeholder="Add context..."
                                        value={expenseForm.notes} onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))} />
                                </Field>
                                <button type="submit" disabled={submitting} style={submitBtnStyle}>
                                    <Plus size={18} /> {submitting ? 'RECORDING…' : 'RECORD EXPENSE'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={submitFund} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <Field label="TOP-UP AMOUNT (SAR) *">
                                    <input style={fieldInput} type="number" step="0.01" placeholder="0.00" value={fundForm.amount}
                                        onChange={e => setFundForm(f => ({ ...f, amount: e.target.value }))} />
                                </Field>
                                <Field label="REASON FOR REQUEST *">
                                    <textarea style={{ ...fieldInput, height: 120, padding: '12px 16px', resize: 'none' }} placeholder="Explain why funds are required..."
                                        value={fundForm.reason} onChange={e => setFundForm(f => ({ ...f, reason: e.target.value }))} />
                                </Field>
                                <button type="submit" disabled={submitting} style={submitBtnStyle}>
                                    <Check size={18} /> {submitting ? 'SUBMITTING…' : 'REQUEST TOP-UP'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* RIGHT: History */}
                <div style={{ background: '#fff', borderRadius: 32, padding: 32, border: '1.5px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 20, borderBottom: '1.5px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#F8FAF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <History size={20} color="#64748b" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#1E2124' }}>Recent Transactions</h3>
                        </div>
                        <button onClick={loadHistory} style={{ fontSize: '0.8rem', fontWeight: 800, color: '#FCC247', background: '#23262D', border: 'none', padding: '6px 14px', borderRadius: 10, cursor: 'pointer' }}>Refresh</button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }} className="hide-scroll">
                        {histLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 80, borderRadius: 20, background: '#F8FAF9', animation: 'pulse 1.5s infinite' }} />)}
                            </div>
                        ) : history.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px 0', opacity: 0.4 }}>
                                <History size={48} style={{ marginBottom: 16 }} />
                                <p style={{ fontWeight: 800, fontSize: '1rem' }}>No activity logged yet</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {history.map((h, i) => {
                                    const kind = (h.kind || h.type || '').toLowerCase();
                                    const isFund = kind === 'fund' || kind === 'fund_request';
                                    const amount = parseFloat(h.amount) || 0;
                                    
                                    const categoryLabel = typeof h.category === 'object' 
                                        ? (h.category.name || h.category.id) 
                                        : (h.category || h.categoryName || (isFund ? 'Fund' : 'Misc'));

                                    const description = h.description || h.reason || h.notes || 'Workshop Transaction';
                                    const dateStr = h.createdAt || h.requestedAt || h.submittedAt;

                                    return (
                                        <div key={h.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderRadius: 20, background: '#fff', border: '1.5px solid #f1f5f9', transition: '0.2s' }} className="history-row">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <div style={{ width: 48, height: 48, borderRadius: 16, background: isFund ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {isFund ? <TrendingUp size={22} color="#15803D" /> : <TrendingDown size={22} color="#b91c1c" />}
                                                </div>
                                                <div>
                                                    <p style={{ margin: '0 0 4px', fontWeight: 900, fontSize: '0.9rem', color: '#1E2124' }}>{description}</p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: '#F1F5F9', color: '#64748b', textTransform: 'uppercase' }}>
                                                            {categoryLabel}
                                                        </span>
                                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>{dateStr ? new Date(dateStr).toLocaleDateString('en-SA', { day: '2-digit', month: 'short' }) : '--'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span style={{ fontWeight: 950, fontSize: '1.1rem', color: isFund ? '#15803D' : '#b91c1c' }}>
                                                {isFund ? '+' : '-'} {amount.toFixed(2)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .hide-scroll::-webkit-scrollbar { display: none; }
                .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                .history-row:hover { border-color: #23262D; transform: translateX(4px); }
            `}</style>
        </div>
    );
}

function TabBtn({ active, onClick, icon, label }) {
    return (
        <button onClick={onClick}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 12, border: 'none',
                background: active ? '#23262D' : 'transparent', color: active ? '#FCC247' : '#64748b',
                fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', transition: '0.15s' }}>
            {icon} {label}
        </button>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label style={{ display: 'block', margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 900, color: '#94a3b8', letterSpacing: 0.5 }}>{label}</label>
            {children}
        </div>
    );
}

const iconBtnStyle = { width: 44, height: 44, background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };
const fieldInput = { width: '100%', padding: '14px 18px', border: '1.5px solid #e5e7eb', borderRadius: 14, fontSize: '0.9rem', fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff', transition: '0.2s' };
const submitBtnStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', height: 52, background: '#23262D', color: '#FCC247',
    border: 'none', borderRadius: 16, fontWeight: 900, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
};
