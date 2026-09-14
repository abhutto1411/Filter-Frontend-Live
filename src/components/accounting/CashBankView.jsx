import React, { useEffect, useMemo, useState } from 'react';
import {
    Banknote,
    BookOpen,
    Building2,
    Link,
    Pencil,
    Plus,
    Search,
    Wallet,
    X,
} from 'lucide-react';
import {
    createAccount,
    createTransaction,
    getAccounts,
    getSummary,
    getTransactions,
    updateAccount,
} from '../../services/cashBankApi';
import { getAccounts as getCoaAccounts } from '../../services/accountsApi';
import { getBranches } from '../../services/superAdminApi';
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

const tabs = [
    { id: 'ALL', label: 'All Accounts' },
    { id: 'CASH', label: 'Cash' },
    { id: 'BANK', label: 'Bank' },
    { id: 'PETTY_CASH', label: 'Petty Cash' },
];

const baseAccountForm = {
    name: '',
    type: 'CASH',
    branchId: '',
    coaAccountId: '',
    bankName: '',
    iban: '',
    accountNumber: '',
    openingBalance: 0,
    status: 'active',
};

const baseTxnForm = {
    accountId: '',
    type: 'credit',
    amount: '',
    entryDate: new Date().toISOString().slice(0, 10),
    description: '',
    reference: '',
};

const modalStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17,24,39,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 24,
};

function money(v) {
    return `SAR ${Number(v || 0).toFixed(2)}`;
}

function normalizeAccount(a) {
    return {
        ...a,
        id: String(a.id),
        type: a.type || 'CASH',
        openingBalance: Number(a.openingBalance || 0),
        currentBalance: Number(a.currentBalance || 0),
        bankName: a.bankName || '',
        iban: a.iban || '',
        accountNumber: a.accountNumber || '',
        status: a.status || 'active',
    };
}

export default function CashBankView({ readOnly = false }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('ALL');
    const [summary, setSummary] = useState({
        cashTotal: 0,
        bankTotal: 0,
        pettyCashTotal: 0,
        cashCount: 0,
        bankCount: 0,
        pettyCashCount: 0,
    });
    const [accounts, setAccounts] = useState([]);
    const [branches, setBranches] = useState([]);
    const [coaAccounts, setCoaAccounts] = useState([]);
    const [ledgerOpenFor, setLedgerOpenFor] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [txnLoading, setTxnLoading] = useState(false);

    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [accountForm, setAccountForm] = useState(baseAccountForm);
    const [accountSubmitError, setAccountSubmitError] = useState('');
    const [accountSubmitting, setAccountSubmitting] = useState(false);

    const [txnModalOpen, setTxnModalOpen] = useState(false);
    const [txnForm, setTxnForm] = useState(baseTxnForm);
    const [txnSubmitting, setTxnSubmitting] = useState(false);
    const [txnSubmitError, setTxnSubmitError] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [summaryRes, accountsRes, branchesRes, coaRes] = await Promise.all([
                getSummary(),
                getAccounts(),
                getBranches(),
                getCoaAccounts({ type: 'ASSET', leafOnly: true }),
            ]);
            setSummary({
                cashTotal: Number(summaryRes.cashTotal || 0),
                bankTotal: Number(summaryRes.bankTotal || 0),
                pettyCashTotal: Number(summaryRes.pettyCashTotal || 0),
                cashCount: Number(summaryRes.cashCount || 0),
                bankCount: Number(summaryRes.bankCount || 0),
                pettyCashCount: Number(summaryRes.pettyCashCount || 0),
            });
            setAccounts(parseArr(accountsRes).map(normalizeAccount));
            setBranches(filterPortalVisibleBranches(parseArr(branchesRes?.branches ?? branchesRes)));
            const coaList = parseArr(coaRes).filter(
                (a) => a.type === 'ASSET' && a.subType === 'CURRENT',
            );
            setCoaAccounts(coaList);
        } catch (e) {
            setError(e.message || 'Failed to load cash & bank data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredAccounts = useMemo(() => {
        const q = search.trim().toLowerCase();
        return accounts.filter((a) => {
            const tabMatch = activeTab === 'ALL' ? true : a.type === activeTab;
            const searchMatch = q
                ? `${a.name} ${a.bankName} ${a.accountNumber} ${a.iban}`.toLowerCase().includes(q)
                : true;
            return tabMatch && searchMatch;
        });
    }, [accounts, activeTab, search]);

    const loadTransactions = async (accountId) => {
        setTxnLoading(true);
        try {
            const rows = await getTransactions({ accountId, limit: 500 });
            setTransactions(parseArr(rows));
        } catch (e) {
            setTransactions([]);
        } finally {
            setTxnLoading(false);
        }
    };

    const openCreate = () => {
        setEditingAccount(null);
        setAccountForm(baseAccountForm);
        setAccountSubmitError('');
        setAccountModalOpen(true);
    };

    const openEdit = (account) => {
        setEditingAccount(account);
        setAccountForm({
            name: account.name || '',
            type: account.type || 'CASH',
            branchId: account.branchId || '',
            coaAccountId: account.coaAccountId || '',
            bankName: account.bankName || '',
            iban: account.iban || '',
            accountNumber: account.accountNumber || '',
            openingBalance: Number(account.openingBalance || 0),
            status: account.status || 'active',
        });
        setAccountSubmitError('');
        setAccountModalOpen(true);
    };

    const submitAccount = async () => {
        setAccountSubmitting(true);
        setAccountSubmitError('');
        try {
            const payload = {
                ...accountForm,
                openingBalance: Number(accountForm.openingBalance || 0),
                branchId: accountForm.branchId || undefined,
                coaAccountId: accountForm.coaAccountId || undefined,
                bankName: accountForm.bankName || undefined,
                iban: accountForm.iban || undefined,
                accountNumber: accountForm.accountNumber || undefined,
            };
            if (editingAccount) {
                await updateAccount(editingAccount.id, payload);
            } else {
                await createAccount(payload);
            }
            setAccountModalOpen(false);
            await loadData();
        } catch (e) {
            setAccountSubmitError(e.message || 'Failed to save account');
        } finally {
            setAccountSubmitting(false);
        }
    };

    const openTxnModal = (account) => {
        setTxnForm({ ...baseTxnForm, accountId: String(account.id) });
        setTxnSubmitError('');
        setTxnModalOpen(true);
    };

    const submitTransaction = async () => {
        setTxnSubmitting(true);
        setTxnSubmitError('');
        try {
            await createTransaction({
                ...txnForm,
                amount: Number(txnForm.amount || 0),
            });
            setTxnModalOpen(false);
            await Promise.all([loadData(), loadTransactions(txnForm.accountId)]);
        } catch (e) {
            setTxnSubmitError(e.message || 'Failed to create transaction');
        } finally {
            setTxnSubmitting(false);
        }
    };

    const runningRows = useMemo(() => {
        if (!ledgerOpenFor) return [];
        const acc = accounts.find((a) => String(a.id) === String(ledgerOpenFor));
        const opening = Number(acc?.openingBalance || 0);
        const asc = [...transactions].sort(
            (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime(),
        );
        let balance = opening;
        const withRun = asc.map((t) => {
            const amt = Number(t.amount || 0);
            balance = t.type === 'credit' ? balance + amt : balance - amt;
            return { ...t, runningBalance: balance };
        });
        return withRun.reverse();
    }, [transactions, ledgerOpenFor, accounts]);

    return (
        <div style={{ width: '100%', background: '#ffffff', borderRadius: 14, padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 26, color: '#111827', fontWeight: 800 }}>Cash, Bank & Petty Cash</h2>
                <p style={{ margin: '6px 0 0 0', color: '#6b7280', fontSize: 14 }}>
                    Manage all financial accounts and balances — linked to Chart of Accounts
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#ECFDF5', borderRadius: 12, padding: 14, border: '1px solid #A7F3D0', display: 'flex', gap: 10 }}>
                    <Banknote size={22} color="#16A34A" />
                    <div>
                        <div style={{ color: '#16A34A', fontWeight: 700, fontSize: 13 }}>Cash on Hand</div>
                        <div style={{ color: '#111827', fontSize: 22, fontWeight: 800 }}>{money(summary.cashTotal)}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{summary.cashCount} accounts</div>
                    </div>
                </div>
                <div style={{ background: '#EFF6FF', borderRadius: 12, padding: 14, border: '1px solid #BFDBFE', display: 'flex', gap: 10 }}>
                    <Building2 size={22} color="#2563EB" />
                    <div>
                        <div style={{ color: '#2563EB', fontWeight: 700, fontSize: 13 }}>Bank Balance</div>
                        <div style={{ color: '#111827', fontSize: 22, fontWeight: 800 }}>{money(summary.bankTotal)}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{summary.bankCount} accounts</div>
                    </div>
                </div>
                <div style={{ background: '#FFFBEB', borderRadius: 12, padding: 14, border: '1px solid #FDE68A', display: 'flex', gap: 10 }}>
                    <Wallet size={22} color="#D97706" />
                    <div>
                        <div style={{ color: '#D97706', fontWeight: 700, fontSize: 13 }}>Petty Cash</div>
                        <div style={{ color: '#111827', fontSize: 22, fontWeight: 800 }}>{money(summary.pettyCashTotal)}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{summary.pettyCashCount} accounts</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', minWidth: 280, flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#9ca3af' }} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid #d1d5db', padding: '0 12px 0 34px', outline: 'none' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTab(t.id)}
                            style={{
                                borderRadius: 999,
                                height: 36,
                                padding: '0 14px',
                                border: activeTab === t.id ? '1px solid #D4A017' : '1px solid #d1d5db',
                                background: activeTab === t.id ? '#D4A017' : '#ffffff',
                                color: activeTab === t.id ? '#ffffff' : '#6b7280',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                {!readOnly && (
                    <button
                        type="button"
                        onClick={openCreate}
                        style={{ marginLeft: 'auto', height: 40, borderRadius: 10, border: 'none', background: '#111827', color: '#fff', padding: '0 14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                    >
                        <Plus size={16} /> New Account
                    </button>
                )}
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {['Account', 'Type', 'Branch', 'COA Link', 'Opening Balance', 'Current Balance', 'Status', 'Actions'].map((h) => (
                                <th key={h} style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 700, padding: '12px 10px', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Loading accounts...</td></tr>
                        ) : error ? (
                            <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#b91c1c' }}>{error}</td></tr>
                        ) : filteredAccounts.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No accounts found</td></tr>
                        ) : filteredAccounts.map((a) => {
                            const typeStyle = a.type === 'CASH'
                                ? { bg: '#DCFCE7', color: '#16A34A', label: 'Cash' }
                                : a.type === 'BANK'
                                    ? { bg: '#DBEAFE', color: '#2563EB', label: 'Bank' }
                                    : { bg: '#FEF3C7', color: '#D97706', label: 'Petty Cash' };
                            const subtitle = [a.bankName, a.accountNumber || a.iban].filter(Boolean).join(' · ');
                            return (
                                <tr key={a.id}>
                                    <td style={{ padding: '12px 10px', borderBottom: '1px solid #f3f4f6' }}>
                                        <div style={{ fontWeight: 700, color: '#111827' }}>{a.name}</div>
                                        <div style={{ color: '#9ca3af', fontSize: 12 }}>{subtitle || '—'}</div>
                                    </td>
                                    <td style={{ padding: '12px 10px', borderBottom: '1px solid #f3f4f6' }}>
                                        <span style={{ background: typeStyle.bg, color: typeStyle.color, padding: '4px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{typeStyle.label}</span>
                                    </td>
                                    <td style={{ padding: '12px 10px', borderBottom: '1px solid #f3f4f6' }}>{a.branch?.name || '—'}</td>
                                    <td style={{ padding: '12px 10px', borderBottom: '1px solid #f3f4f6' }}>
                                        {a.coaAccount ? (
                                            <button type="button" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D4A017', display: 'flex', alignItems: 'center', gap: 5, padding: 0 }}>
                                                <Link size={14} /> {a.coaAccount.name}
                                            </button>
                                        ) : (
                                            <span style={{ color: '#9ca3af', fontSize: 12 }}>Auto-linked</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 10px', borderBottom: '1px solid #f3f4f6' }}>{money(a.openingBalance)}</td>
                                    <td style={{ padding: '12px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 800, color: a.currentBalance > 0 ? '#16a34a' : a.currentBalance < 0 ? '#dc2626' : '#6b7280' }}>{money(a.currentBalance)}</td>
                                    <td style={{ padding: '12px 10px', borderBottom: '1px solid #f3f4f6' }}>
                                        <span style={{ background: a.status === 'active' ? '#DCFCE7' : '#E5E7EB', color: a.status === 'active' ? '#16A34A' : '#6b7280', padding: '4px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{a.status}</span>
                                    </td>
                                    <td style={{ padding: '12px 10px', borderBottom: '1px solid #f3f4f6' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {!readOnly && (
                                                <button type="button" onClick={() => openEdit(a)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Pencil size={14} /> Edit
                                                </button>
                                            )}
                                            <button type="button" onClick={async () => { setLedgerOpenFor(a.id); await loadTransactions(a.id); }} style={{ border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#111827', borderRadius: 8, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <BookOpen size={14} /> Ledger
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {ledgerOpenFor && (
                <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 16, color: '#111827' }}>
                            Transactions — {accounts.find((a) => a.id === String(ledgerOpenFor))?.name || ''}
                        </h3>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {!readOnly && (
                                <button type="button" onClick={() => openTxnModal(accounts.find((a) => a.id === String(ledgerOpenFor)))} style={{ border: 'none', background: '#111827', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                                    + New Transaction
                                </button>
                            )}
                            <button type="button" onClick={() => setLedgerOpenFor(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                {['Date', 'Type', 'Description', 'Reference', 'Debit', 'Credit', 'Running Balance'].map((h) => (
                                    <th key={h} style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 700, padding: '10px 8px', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {txnLoading ? (
                                <tr><td colSpan={7} style={{ padding: 14, textAlign: 'center', color: '#6b7280' }}>Loading transactions...</td></tr>
                            ) : runningRows.length === 0 ? (
                                <tr><td colSpan={7} style={{ padding: 14, textAlign: 'center', color: '#6b7280' }}>No transactions found</td></tr>
                            ) : runningRows.map((t) => (
                                <tr key={t.id}>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{String(t.entryDate).slice(0, 10)}</td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', textTransform: 'capitalize' }}>{t.type}</td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{t.description || '—'}</td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{t.reference || '—'}</td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{t.type === 'debit' ? money(t.amount) : '—'}</td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{t.type === 'credit' ? money(t.amount) : '—'}</td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>{money(t.runningBalance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {accountModalOpen && (
                <div style={modalStyle}>
                    <div style={{ width: '100%', maxWidth: 860, background: '#fff', borderRadius: 12, padding: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 style={{ margin: 0 }}>{editingAccount ? 'Edit Cash / Bank Account' : 'New Cash / Bank Account'}</h3>
                            <button type="button" onClick={() => setAccountModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        {accountSubmitError ? <div style={{ marginBottom: 10, color: '#b91c1c', fontSize: 13 }}>{accountSubmitError}</div> : null}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <input placeholder="Account Name *" value={accountForm.name} onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }} />
                            <select value={accountForm.type} onChange={(e) => setAccountForm((f) => ({ ...f, type: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }}>
                                <option value="CASH">Cash</option>
                                <option value="BANK">Bank</option>
                                <option value="PETTY_CASH">Petty Cash</option>
                            </select>
                            <select value={accountForm.branchId} onChange={(e) => setAccountForm((f) => ({ ...f, branchId: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }}>
                                <option value="">Select Branch</option>
                                {branches.map((b) => <option key={String(b.id)} value={String(b.id)}>{b.name}</option>)}
                            </select>
                            <input type="number" placeholder="Opening Balance SAR" value={accountForm.openingBalance} onChange={(e) => setAccountForm((f) => ({ ...f, openingBalance: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }} />
                            <div style={{ gridColumn: '1 / -1' }}>
                                <select value={accountForm.coaAccountId} onChange={(e) => setAccountForm((f) => ({ ...f, coaAccountId: e.target.value }))} style={{ width: '100%', height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }}>
                                    <option value="">Link to Chart of Account</option>
                                    {coaAccounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{a.code} — {a.name}</option>)}
                                </select>
                                <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12 }}>Leave blank to auto-create a new Current Asset account in COA</div>
                            </div>
                            <select value={accountForm.status} onChange={(e) => setAccountForm((f) => ({ ...f, status: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            <input placeholder="Bank Name (optional)" value={accountForm.bankName} onChange={(e) => setAccountForm((f) => ({ ...f, bankName: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }} />
                            <input placeholder="IBAN (optional)" value={accountForm.iban} onChange={(e) => setAccountForm((f) => ({ ...f, iban: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }} />
                            <input placeholder="Account Number (optional)" value={accountForm.accountNumber} onChange={(e) => setAccountForm((f) => ({ ...f, accountNumber: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                            <button type="button" onClick={() => setAccountModalOpen(false)} style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', padding: '0 12px', cursor: 'pointer' }}>Cancel</button>
                            <button type="button" disabled={accountSubmitting} onClick={submitAccount} style={{ height: 38, border: 'none', borderRadius: 8, background: '#111827', color: '#fff', padding: '0 12px', cursor: 'pointer' }}>
                                {accountSubmitting ? 'Saving...' : editingAccount ? 'Save Account' : 'Create Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {txnModalOpen && (
                <div style={modalStyle}>
                    <div style={{ width: '100%', maxWidth: 640, background: '#fff', borderRadius: 12, padding: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 style={{ margin: 0 }}>New Transaction</h3>
                            <button type="button" onClick={() => setTxnModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        {txnSubmitError ? <div style={{ marginBottom: 10, color: '#b91c1c', fontSize: 13 }}>{txnSubmitError}</div> : null}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <select value={txnForm.accountId} onChange={(e) => setTxnForm((f) => ({ ...f, accountId: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }}>
                                <option value="">Account *</option>
                                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            <select value={txnForm.type} onChange={(e) => setTxnForm((f) => ({ ...f, type: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }}>
                                <option value="debit">Debit</option>
                                <option value="credit">Credit</option>
                            </select>
                            <input type="number" placeholder="Amount SAR *" value={txnForm.amount} onChange={(e) => setTxnForm((f) => ({ ...f, amount: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }} />
                            <input type="date" value={txnForm.entryDate} onChange={(e) => setTxnForm((f) => ({ ...f, entryDate: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017' }} />
                            <input placeholder="Description" value={txnForm.description} onChange={(e) => setTxnForm((f) => ({ ...f, description: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017', gridColumn: '1 / -1' }} />
                            <input placeholder="Reference" value={txnForm.reference} onChange={(e) => setTxnForm((f) => ({ ...f, reference: e.target.value }))} style={{ height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', outlineColor: '#D4A017', gridColumn: '1 / -1' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                            <button type="button" onClick={() => setTxnModalOpen(false)} style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', padding: '0 12px', cursor: 'pointer' }}>Cancel</button>
                            <button type="button" disabled={txnSubmitting} onClick={submitTransaction} style={{ height: 38, border: 'none', borderRadius: 8, background: '#111827', color: '#fff', padding: '0 12px', cursor: 'pointer' }}>
                                {txnSubmitting ? 'Saving...' : 'Create Transaction'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
