import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeftRight,
    BookOpen,
    FileText,
    Plus,
    Save,
    Trash2,
} from 'lucide-react';
import CoaAccountSearchCombobox, { CashBankAccountSearchCombobox } from './CoaAccountSearchCombobox';
import { getAccounts } from '../../services/accountsApi';
import { apiFetch } from '../../services/api';
import { createJournalEntry } from '../../services/journalEntriesApi';
import { createPayments, createReceipts, getRecentTransactions } from '../../services/transactionsApi';

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

const makeRow = (prefix, idx) => ({
    id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    voucher: `${prefix}${String(idx).padStart(4, '0')}`,
    date: new Date().toISOString().slice(0, 10),
    payeeType: prefix === 'PE' ? 'Supplier' : 'Customer',
    payeeName: '',
    accountId: '',
    amount: '',
    reference: '',
    notes: '',
});

export default function TransactionEntryView({ readOnly = false }) {
    const [activeTab, setActiveTab] = useState('Payments');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [generalNote, setGeneralNote] = useState('');
    const [selectedPaidFromAccountId, setSelectedPaidFromAccountId] = useState('');
    const [selectedReceivedIntoAccountId, setSelectedReceivedIntoAccountId] = useState('');
    const [cashBankAccounts, setCashBankAccounts] = useState([]);
    const [allAccounts, setAllAccounts] = useState([]);
    const [paymentsRows, setPaymentsRows] = useState([makeRow('PE', 1), makeRow('PE', 2)]);
    const [receiptsRows, setReceiptsRows] = useState([makeRow('RV', 1), makeRow('RV', 2)]);
    const [journalMemo, setJournalMemo] = useState('');
    const [journalRows, setJournalRows] = useState([
        { id: 'je-1', accountId: '', description: '', debit: '', credit: '' },
        { id: 'je-2', accountId: '', description: '', debit: '', credit: '' },
    ]);
    const [recent, setRecent] = useState([]);
    const [statusMsg, setStatusMsg] = useState('');

    useEffect(() => {
        apiFetch('/cash-bank/accounts')
            .then((raw) => {
                const parsed = parseArr(raw);
                console.log('setCashBankAccounts called with:', parsed.length, 'items');
                setCashBankAccounts(parsed);
            })
            .catch(() => setCashBankAccounts([]));
    }, []);

    /** COA (GET /accounts) — mount only; parseArr on response. */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const raw = await getAccounts({ leafOnly: true });
                if (!cancelled) setAllAccounts(parseArr(raw));
            } catch {
                if (!cancelled) setAllAccounts([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const type = activeTab === 'Payments' ? 'payment' : activeTab === 'Receipts' ? 'receipt' : '';
        if (!type) {
            setRecent([]);
            return;
        }
        getRecentTransactions({ type, limit: 5 })
            .then((r) => setRecent(parseArr(r)))
            .catch(() => setRecent([]));
    }, [activeTab]);

    const paymentAccounts = useMemo(
        () => allAccounts.filter((a) => a.type === 'EXPENSE' || a.type === 'LIABILITY' || a.type === 'EQUITY'),
        [allAccounts],
    );
    const receiptAccounts = useMemo(
        () => allAccounts.filter((a) => a.type === 'INCOME' || a.type === 'ASSET' || a.type === 'EQUITY'),
        [allAccounts],
    );

    const coaOptionsFrom = (list) =>
        list.map((a) => ({
            id: String(a.id),
            code: a.code,
            name: a.name,
            type: a.type,
            label: `${a.code} — ${a.name}`,
        }));

    const paymentValid = paymentsRows.filter((r) => Number(r.amount) > 0).length;
    const paymentTotal = paymentsRows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const receiptValid = receiptsRows.filter((r) => Number(r.amount) > 0).length;
    const receiptTotal = receiptsRows.reduce((s, r) => s + Number(r.amount || 0), 0);

    const journalTotals = useMemo(() => ({
        debit: journalRows.reduce((s, r) => s + Number(r.debit || 0), 0),
        credit: journalRows.reduce((s, r) => s + Number(r.credit || 0), 0),
    }), [journalRows]);

    const updateRows = (setter, rows, id, key, value) => {
        setter(rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    };

    const savePayments = async () => {
        const paidFromCashBankId = String(selectedPaidFromAccountId || '').trim();
        if (!paidFromCashBankId) {
            setStatusMsg('⚠️ Select Paid From cash/bank account first.');
            return;
        }
        const validRows = paymentsRows.filter((r) => Number(r.amount) > 0);
        if (validRows.length === 0) {
            setStatusMsg('⚠️ Add at least one row with amount > 0.');
            return;
        }
        const rows = validRows.map((r) => ({
            payeeType: r.payeeType,
            payeeName: (r.payeeName || '').trim() || undefined,
            accountId: r.accountId ? String(r.accountId) : undefined,
            amount: Number(r.amount),
            reference: r.reference || undefined,
            notes: r.notes || undefined,
        }));
        try {
            const res = await createPayments({
                date,
                cashBankAccountId: paidFromCashBankId,
                generalNote: generalNote || '',
                branchId: null,
                rows,
            });
            setStatusMsg(`✅ Saved ${res.saved} payment(s)`);
            if (res.saved > 0) {
                setPaymentsRows([makeRow('PE', 1), makeRow('PE', 2)]);
            }
        } catch (e) {
            setStatusMsg(`❌ Error: ${e.message}`);
        }
    };

    const saveReceipts = async () => {
        const headerDate = date;
        const receivedIntoCashBankId = String(selectedReceivedIntoAccountId || '').trim();
        if (!receivedIntoCashBankId) {
            setStatusMsg('Select Received Into cash/bank account.');
            return;
        }
        const rows = receiptsRows
            .filter((r) => Number(r.amount) > 0)
            .map((r) => ({
                payeeType: r.payeeType,
                payeeName: (r.payeeName || '').trim() || undefined,
                accountId: r.accountId ? String(r.accountId) : undefined,
                amount: Number(r.amount || 0),
                reference: r.reference || undefined,
                notes: r.notes || undefined,
            }));
        const body = {
            date: headerDate,
            cashBankAccountId: receivedIntoCashBankId,
            receivedIntoAccountId: receivedIntoCashBankId,
            generalNote: generalNote || '',
            branchId: null,
            rows,
        };
        const res = await createReceipts(body);
        setStatusMsg(`Saved ${res.saved} receipts`);
        setReceiptsRows([makeRow('RV', 1), makeRow('RV', 2)]);
    };

    const postJournal = async () => {
        await createJournalEntry({
            date,
            type: 'General',
            description: journalMemo || undefined,
            lines: journalRows.map((r) => ({
                accountId: r.accountId,
                description: r.description || undefined,
                debit: Number(r.debit || 0),
                credit: Number(r.credit || 0),
            })),
        });
        setStatusMsg('Journal entry posted');
        setJournalRows([
            { id: 'je-1', accountId: '', description: '', debit: '', credit: '' },
            { id: 'je-2', accountId: '', description: '', debit: '', credit: '' },
        ]);
        setJournalMemo('');
    };

    const tableInput = { height: 34, border: '1px solid #d1d5db', borderRadius: 6, padding: '0 8px', width: '100%' };
    const headerGridCols = activeTab === 'Journal Entry' ? '1fr 1fr' : '1fr 1fr 1fr';

    return (
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: headerGridCols, gap: 8 }}>
                    <div><div style={{ fontSize: 12, marginBottom: 4 }}>Date *</div><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...tableInput, outlineColor: '#D4A017' }} /></div>
                    <div><div style={{ fontSize: 12, marginBottom: 4 }}>General Note</div><input value={generalNote} onChange={(e) => setGeneralNote(e.target.value)} placeholder="Optional note for all entries" style={{ ...tableInput, outlineColor: '#D4A017' }} /></div>
                    {activeTab !== 'Journal Entry' && (
                        <div>
                            <div style={{ fontSize: 12, marginBottom: 4 }}>
                                {activeTab === 'Payments' ? '💳 Paid From Account' : '💳 Received Into Account'}
                            </div>
                            <CashBankAccountSearchCombobox
                                accounts={cashBankAccounts}
                                value={activeTab === 'Payments' ? selectedPaidFromAccountId : selectedReceivedIntoAccountId}
                                onChange={(id) => {
                                    if (activeTab === 'Payments') setSelectedPaidFromAccountId(id);
                                    else setSelectedReceivedIntoAccountId(id);
                                }}
                                placeholder="Select account — type to search"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {['Payments', 'Receipts', 'Journal Entry'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} type="button" style={{ borderRadius: 999, border: '1px solid #d1d5db', background: activeTab === tab ? '#111827' : '#fff', color: activeTab === tab ? '#fff' : '#374151', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {tab === 'Payments' ? <FileText size={14} /> : tab === 'Receipts' ? <ArrowLeftRight size={14} /> : <BookOpen size={14} />}
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'Payments' && (
                <div>
                    <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 6 }}>Payments — Dr: Payable/Expense | Cr: Cash/Bank <span style={{ color: '#9ca3af' }}>Tab on last field adds new row automatically</span></div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr>{['Voucher #', 'Date', 'Type', 'Payee name', 'Account Dr — Payable/Expense', 'Amount (SAR)', 'Reference', 'Notes', ''].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 12, padding: 8, borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
                            <tbody>
                                {paymentsRows.map((r) => (
                                    <tr key={r.id}>
                                        <td style={{ padding: 6 }}><input readOnly value={r.voucher} style={{ ...tableInput, background: '#FEF3C7' }} /></td>
                                        <td style={{ padding: 6 }}><input type="date" value={r.date} onChange={(e) => updateRows(setPaymentsRows, paymentsRows, r.id, 'date', e.target.value)} style={tableInput} /></td>
                                        <td style={{ padding: 6 }}><select value={r.payeeType} onChange={(e) => updateRows(setPaymentsRows, paymentsRows, r.id, 'payeeType', e.target.value)} style={tableInput}><option>Supplier</option><option>Employee</option><option>Customer</option><option>Other</option></select></td>
                                        <td style={{ padding: 6 }}><input value={r.payeeName} onChange={(e) => updateRows(setPaymentsRows, paymentsRows, r.id, 'payeeName', e.target.value)} placeholder="Payee name" style={tableInput} /></td>
                                        <td style={{ padding: 6 }}>
                                            <CoaAccountSearchCombobox
                                                accounts={coaOptionsFrom(paymentAccounts)}
                                                value={r.accountId}
                                                onChange={(accountId) => updateRows(setPaymentsRows, paymentsRows, r.id, 'accountId', accountId)}
                                            />
                                        </td>
                                        <td style={{ padding: 6 }}><input type="number" min="0" step="0.01" value={r.amount} onChange={(e) => updateRows(setPaymentsRows, paymentsRows, r.id, 'amount', e.target.value)} style={tableInput} /></td>
                                        <td style={{ padding: 6 }}><input value={r.reference} onChange={(e) => updateRows(setPaymentsRows, paymentsRows, r.id, 'reference', e.target.value)} style={tableInput} /></td>
                                        <td style={{ padding: 6 }}><input value={r.notes} onChange={(e) => updateRows(setPaymentsRows, paymentsRows, r.id, 'notes', e.target.value)} style={tableInput} /></td>
                                        <td style={{ padding: 6 }}><button type="button" disabled={readOnly} onClick={() => setPaymentsRows(paymentsRows.filter((x) => x.id !== r.id))} style={{ border: 'none', background: 'none', color: '#dc2626' }}><Trash2 size={16} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>{paymentValid} valid rows · Total: SAR {paymentTotal.toFixed(2)}</div>
                        <button type="button" disabled={readOnly} onClick={savePayments} style={{ border: 'none', background: '#111827', color: '#fff', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Save size={14} /> Save All Payments</button>
                    </div>
                </div>
            )}

            {activeTab === 'Receipts' && (
                <div>
                    <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 6 }}>Receipts — Dr: Cash/Bank | Cr: Receivable/Revenue <span style={{ color: '#9ca3af' }}>Tab on last field adds new row automatically</span></div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr>{['Voucher #', 'Date', 'Type', 'Received from (name)', 'Account Cr — Receivable/Revenue', 'Amount (SAR)', 'Reference', 'Notes', ''].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 12, padding: 8, borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
                            <tbody>
                                {receiptsRows.map((r) => (
                                    <tr key={r.id}>
                                        <td style={{ padding: 6 }}><input readOnly value={r.voucher} style={{ ...tableInput, background: '#DCFCE7' }} /></td>
                                        <td style={{ padding: 6 }}><input type="date" value={r.date} onChange={(e) => updateRows(setReceiptsRows, receiptsRows, r.id, 'date', e.target.value)} style={tableInput} /></td>
                                        <td style={{ padding: 6 }}><select value={r.payeeType} onChange={(e) => updateRows(setReceiptsRows, receiptsRows, r.id, 'payeeType', e.target.value)} style={tableInput}><option>Customer</option><option>Supplier</option><option>Employee</option><option>Other</option></select></td>
                                        <td style={{ padding: 6 }}><input value={r.payeeName} onChange={(e) => updateRows(setReceiptsRows, receiptsRows, r.id, 'payeeName', e.target.value)} placeholder="Payer name" style={tableInput} /></td>
                                        <td style={{ padding: 6 }}>
                                            <CoaAccountSearchCombobox
                                                accounts={coaOptionsFrom(receiptAccounts)}
                                                value={r.accountId}
                                                onChange={(accountId) => updateRows(setReceiptsRows, receiptsRows, r.id, 'accountId', accountId)}
                                            />
                                        </td>
                                        <td style={{ padding: 6 }}><input type="number" min="0" step="0.01" value={r.amount} onChange={(e) => updateRows(setReceiptsRows, receiptsRows, r.id, 'amount', e.target.value)} style={tableInput} /></td>
                                        <td style={{ padding: 6 }}><input value={r.reference} onChange={(e) => updateRows(setReceiptsRows, receiptsRows, r.id, 'reference', e.target.value)} style={tableInput} /></td>
                                        <td style={{ padding: 6 }}><input value={r.notes} onChange={(e) => updateRows(setReceiptsRows, receiptsRows, r.id, 'notes', e.target.value)} style={tableInput} /></td>
                                        <td style={{ padding: 6 }}><button type="button" disabled={readOnly} onClick={() => setReceiptsRows(receiptsRows.filter((x) => x.id !== r.id))} style={{ border: 'none', background: 'none', color: '#dc2626' }}><Trash2 size={16} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>{receiptValid} valid rows · Total: SAR {receiptTotal.toFixed(2)}</div>
                        <button type="button" disabled={readOnly} onClick={saveReceipts} style={{ border: 'none', background: '#111827', color: '#fff', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Save size={14} /> Save All Receipts</button>
                    </div>
                </div>
            )}

            {activeTab === 'Journal Entry' && (
                <div>
                    <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 6 }}>Journal Entry · JE0001 · Tab on Credit field adds new line</div>
                    <input value={journalMemo} onChange={(e) => setJournalMemo(e.target.value)} placeholder="Journal entry description / memo" style={{ ...tableInput, marginBottom: 8 }} />
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>{['Account', 'Line Description', 'Debit (SAR)', 'Credit (SAR)', ''].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 12, padding: 8, borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {journalRows.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ padding: 6 }}>
                                        <CoaAccountSearchCombobox
                                            accounts={coaOptionsFrom(allAccounts)}
                                            value={r.accountId}
                                            onChange={(accountId) => setJournalRows(journalRows.map((x) => (x.id === r.id ? { ...x, accountId } : x)))}
                                        />
                                    </td>
                                    <td style={{ padding: 6 }}><input value={r.description} onChange={(e) => setJournalRows(journalRows.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)))} style={tableInput} /></td>
                                    <td style={{ padding: 6 }}><input type="number" value={r.debit} onChange={(e) => setJournalRows(journalRows.map((x) => (x.id === r.id ? { ...x, debit: e.target.value } : x)))} style={tableInput} /></td>
                                    <td style={{ padding: 6 }}><input type="number" value={r.credit} onChange={(e) => setJournalRows(journalRows.map((x) => (x.id === r.id ? { ...x, credit: e.target.value } : x)))} style={tableInput} /></td>
                                    <td style={{ padding: 6 }}>{journalRows.length > 2 ? <button type="button" disabled={readOnly} onClick={() => setJournalRows(journalRows.filter((x) => x.id !== r.id))} style={{ border: 'none', background: 'none', color: '#dc2626' }}><Trash2 size={16} /></button> : null}</td>
                                </tr>
                            ))}
                            <tr style={{ background: '#f9fafb' }}>
                                <td colSpan={2} style={{ padding: 8, fontWeight: 700 }}>Totals</td>
                                <td style={{ padding: 8, fontWeight: 700 }}>SAR {journalTotals.debit.toFixed(2)}</td>
                                <td style={{ padding: 8, fontWeight: 700 }}>SAR {journalTotals.credit.toFixed(2)}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <button type="button" disabled={readOnly} onClick={() => setJournalRows([...journalRows, { id: `je-${Date.now()}`, accountId: '', description: '', debit: '', credit: '' }])} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 5 }}><Plus size={14} /> Add Line</button>
                        <button type="button" disabled={readOnly || journalTotals.debit !== journalTotals.credit || journalRows.some((r) => !r.accountId)} onClick={postJournal} style={{ border: 'none', background: '#111827', color: '#fff', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={14} /> Post Journal Entry</button>
                    </div>
                </div>
            )}

            <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent {activeTab}</div>
                {recent.map((r) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                        <div>{r.voucherNumber} · {new Date(r.date).toLocaleDateString()}</div>
                        <div>SAR {Number(r.amount || 0).toFixed(2)} · <span style={{ background: '#e5e7eb', borderRadius: 999, padding: '2px 6px', fontSize: 11 }}>{r.status}</span></div>
                    </div>
                ))}
                {statusMsg ? <div style={{ marginTop: 8, color: '#16a34a', fontSize: 13 }}>{statusMsg}</div> : null}
            </div>
        </div>
    );
}
