import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import {
    createSupplierCashBankAccount,
    createSupplierCashBankLedgerEntry,
    listSupplierCashBankAccounts,
    listSupplierCashBankLedger,
    listSupplierPayments,
} from '../../services/supplierApi';
import { Shimmer, ShimmerListRows, ShimmerTable } from '../../components/supplier/Shimmer';

/** Backend may nest lists under different keys or return an array directly. */
function extractArray(res, keys) {
    if (!res || typeof res !== 'object') return [];
    if (Array.isArray(res)) return res;
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
    }
    return [];
}

function mapAccountsFromApi(rows) {
    return rows.map((a) => {
        const rawType = String(a.accountType ?? a.type ?? 'bank').toLowerCase();
        const type = rawType === 'cash' ? 'Cash' : 'Bank';
        const id = a.id ?? a.accountId;
        return {
            id,
            name: a.name ?? a.accountName ?? 'Account',
            type,
            bankName: a.bankName ?? '',
            iban: a.iban ?? '',
            number: a.accountNumber ?? a.number ?? '',
            openingBalance: Number(a.openingBalance ?? a.opening_balance ?? 0),
            balance: Number(a.balance ?? a.currentBalance ?? a.current_balance ?? 0),
        };
    }).filter((row) => row.id != null);
}

function mapLedgerFromApi(ledgerRows) {
    return ledgerRows.map((r) => ({
        id: r.id ?? `${r.accountId}-${r.entryDate}-${r.amount}`,
        date: (r.entryDate ?? r.transactionDate ?? r.createdAt)?.slice?.(0, 10) ?? '-',
        account: r.accountName ?? r.account?.name ?? '-',
        type: r.direction === 'debit' ? 'Receipt' : 'Payment',
        description: r.description ?? r.sourceType ?? '-',
        reference: String(r.reference ?? r.sourceId ?? r.referenceNumber ?? ''),
        debit: r.direction === 'credit' ? Number(r.amount ?? 0).toFixed(2) : '',
        credit: r.direction === 'debit' ? Number(r.amount ?? 0).toFixed(2) : '',
    }));
}

function mapPaymentsFallback(payments) {
    return payments.map((p) => ({
        id: p.id,
        date: (p.paymentDate ?? p.paidAt ?? '').toString().slice(0, 10),
        account: p.method ?? '-',
        type: 'Receipt',
        description: p.notes ?? `Payment for ${p.invoiceNo ?? p.invoiceId ?? ''}`,
        reference: String(p.reference ?? p.invoiceId ?? ''),
        debit: '',
        credit: Number(p.amount ?? 0).toFixed(2),
    }));
}

export default function SupplierCashBank() {
    const [accounts, setAccounts] = useState([]);
    const [activeTab, setActiveTab] = useState('accounts');
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [receiveModalOpen, setReceiveModalOpen] = useState(false);
    const [payModalOpen, setPayModalOpen] = useState(false);

    const [addForm, setAddForm] = useState({
        name: '',
        type: 'Bank',
        bankName: '',
        iban: '',
        number: '',
        openingBalance: '0',
    });
    const [receiveForm, setReceiveForm] = useState({
        accountId: '',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        description: '',
        reference: '',
    });
    const [payForm, setPayForm] = useState({
        accountId: '',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        description: '',
        reference: '',
    });
    const [ledger, setLedger] = useState([]);
    const [bootstrapLoading, setBootstrapLoading] = useState(true);
    const [bootstrapError, setBootstrapError] = useState('');
    const [partialLoadWarnings, setPartialLoadWarnings] = useState([]);
    const [accountSaveError, setAccountSaveError] = useState('');
    const [receiveSubmitting, setReceiveSubmitting] = useState(false);
    const [receiveSubmitError, setReceiveSubmitError] = useState('');
    const [paySubmitting, setPaySubmitting] = useState(false);
    const [paySubmitError, setPaySubmitError] = useState('');

    const totalCash = accounts.filter((a) => a.type === 'Cash').reduce((s, a) => s + (a.balance || 0), 0);
    const totalBank = accounts.filter((a) => a.type === 'Bank').reduce((s, a) => s + (a.balance || 0), 0);
    const totalBalance = totalCash + totalBank;

    const reloadCashBankData = useCallback(async () => {
        const warnings = [];
        let accountsPayload = null;
        let ledgerPayload = null;
        let paymentsPayload = null;

        const [accResult, ledResult, payResult] = await Promise.allSettled([
            listSupplierCashBankAccounts(),
            listSupplierCashBankLedger({ limit: 200 }),
            listSupplierPayments({ limit: 200 }),
        ]);

        if (accResult.status === 'fulfilled') {
            accountsPayload = accResult.value;
        } else {
            warnings.push(`Accounts: ${accResult.reason?.message || 'request failed'}`);
        }

        if (ledResult.status === 'fulfilled') {
            ledgerPayload = ledResult.value;
        } else {
            warnings.push(`Ledger: ${ledResult.reason?.message || 'request failed'}`);
        }

        if (payResult.status === 'fulfilled') {
            paymentsPayload = payResult.value;
        } else {
            warnings.push(`Payments: ${payResult.reason?.message || 'request failed'}`);
        }

        const rawAccounts = extractArray(accountsPayload, ['accounts', 'list', 'items', 'data']);
        setAccounts(mapAccountsFromApi(rawAccounts));

        const rawLedger = extractArray(ledgerPayload, ['ledger', 'entries', 'list', 'items', 'transactions']);
        const ledgerMapped = mapLedgerFromApi(rawLedger);

        if (ledgerMapped.length > 0) {
            setLedger(ledgerMapped);
        } else {
            const payments = extractArray(paymentsPayload, ['payments', 'list', 'items']);
            setLedger(payments.length ? mapPaymentsFallback(payments) : []);
        }

        setPartialLoadWarnings(warnings);
        if (rawAccounts.length === 0 && accResult.status === 'rejected') {
            setBootstrapError(accResult.reason?.message || 'Failed to load accounts');
        } else {
            setBootstrapError('');
        }

        return { warnings, accountCount: rawAccounts.length };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setBootstrapLoading(true);
            setBootstrapError('');
            try {
                await reloadCashBankData();
            } catch (err) {
                if (!cancelled) {
                    setBootstrapError(err?.message || 'Failed to load cash & bank data');
                    setAccounts([]);
                    setLedger([]);
                }
            } finally {
                if (!cancelled) setBootstrapLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [reloadCashBankData]);

    const handleAddAccount = async () => {
        if (!addForm.name) return;
        const opening = Number(addForm.openingBalance) || 0;
        setAccountSaveError('');
        try {
            const created = await createSupplierCashBankAccount({
                name: addForm.name,
                accountType: String(addForm.type || 'Bank').toLowerCase() === 'cash' ? 'cash' : 'bank',
                openingBalance: opening,
            });
            const row = {
                id: created?.account?.id ?? created?.id ?? Date.now(),
                name: addForm.name,
                type:
                    String(created?.account?.accountType || addForm.type || 'Bank').toLowerCase() === 'cash'
                        ? 'Cash'
                        : 'Bank',
                bankName: addForm.bankName || '',
                iban: addForm.iban || '',
                number: addForm.number || '',
                openingBalance: Number(created?.account?.openingBalance ?? opening),
                balance: Number(created?.account?.balance ?? opening),
            };
            setAccounts((prev) => [...prev, row]);
            setAddModalOpen(false);
            setAddForm({ name: '', type: 'Bank', bankName: '', iban: '', number: '', openingBalance: '0' });
            await reloadCashBankData();
        } catch (err) {
            console.error('Create supplier cash/bank account failed:', err);
            setAccountSaveError(err?.message || 'Could not create account');
        }
    };

    const handleRecordReceipt = async () => {
        setReceiveSubmitError('');
        if (!receiveForm.accountId || !receiveForm.amount || !receiveForm.date) {
            setReceiveSubmitError('Account, amount, and date are required.');
            return;
        }
        const amount = Number(receiveForm.amount);
        if (!(amount > 0)) {
            setReceiveSubmitError('Enter a valid amount greater than zero.');
            return;
        }

        setReceiveSubmitting(true);
        try {
            await createSupplierCashBankLedgerEntry({
                accountId: String(receiveForm.accountId),
                direction: 'debit',
                amount,
                description: receiveForm.description?.trim() || 'Payment received from workshop',
                sourceType: 'manual_receipt',
                entryDate: receiveForm.date,
                reference: receiveForm.reference?.trim() || undefined,
            });
            await reloadCashBankData();
            setReceiveModalOpen(false);
            setReceiveForm({
                accountId: '',
                amount: '',
                date: new Date().toISOString().slice(0, 10),
                description: '',
                reference: '',
            });
            setActiveTab('ledger');
        } catch (err) {
            console.error('Record receipt failed:', err);
            setReceiveSubmitError(err?.message || 'Could not record receipt');
        } finally {
            setReceiveSubmitting(false);
        }
    };

    const handleRecordPayment = async () => {
        setPaySubmitError('');
        if (!payForm.accountId || !payForm.amount || !payForm.date) {
            setPaySubmitError('Account, amount, and date are required.');
            return;
        }
        const amount = Number(payForm.amount);
        if (!(amount > 0)) {
            setPaySubmitError('Enter a valid amount greater than zero.');
            return;
        }

        setPaySubmitting(true);
        try {
            await createSupplierCashBankLedgerEntry({
                accountId: String(payForm.accountId),
                direction: 'credit',
                amount,
                description: payForm.description?.trim() || 'Payment to vendor / expense',
                sourceType: 'manual_payment',
                entryDate: payForm.date,
                reference: payForm.reference?.trim() || undefined,
            });
            await reloadCashBankData();
            setPayModalOpen(false);
            setPayForm({
                accountId: '',
                amount: '',
                date: new Date().toISOString().slice(0, 10),
                description: '',
                reference: '',
            });
            setActiveTab('ledger');
        } catch (err) {
            console.error('Record payment failed:', err);
            setPaySubmitError(err?.message || 'Could not record payment');
        } finally {
            setPaySubmitting(false);
        }
    };

    const list = accounts || [];
    const noAccounts = !bootstrapLoading && list.length === 0 && !bootstrapError;

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Cash & Bank</h2>
                    <p className="ws-page-sub">Manage cash and bank accounts</p>
                </div>
            </div>

            {bootstrapError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: 14,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 12,
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                    }}
                >
                    <strong>Could not load accounts:</strong> {bootstrapError}
                </div>
            ) : null}

            {partialLoadWarnings.length > 0 && !bootstrapError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: 12,
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        borderRadius: 12,
                        color: '#92400E',
                        fontSize: '0.8125rem',
                    }}
                >
                    <strong>Partial load:</strong> {partialLoadWarnings.join(' · ')}
                </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#ECFDF3', border: '1px solid #BBF7D0', borderRadius: 14, padding: 14 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', margin: 0 }}>Total Cash</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 900, margin: '6px 0 0 0', color: '#14532D', minHeight: 28 }}>
                        {bootstrapLoading ? (
                            <Shimmer style={{ display: 'inline-block', height: 22, width: 100, borderRadius: 6 }} />
                        ) : (
                            <>SAR {totalCash.toLocaleString()}</>
                        )}
                    </p>
                </div>
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14, padding: 14 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563EB', margin: 0 }}>Total Bank</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 900, margin: '6px 0 0 0', color: '#1D4ED8', minHeight: 28 }}>
                        {bootstrapLoading ? (
                            <Shimmer style={{ display: 'inline-block', height: 22, width: 100, borderRadius: 6 }} />
                        ) : (
                            <>SAR {totalBank.toLocaleString()}</>
                        )}
                    </p>
                </div>
                <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 14, padding: 14 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Total Balance</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 900, margin: '6px 0 0 0', color: '#0F172A', minHeight: 28 }}>
                        {bootstrapLoading ? (
                            <Shimmer style={{ display: 'inline-block', height: 22, width: 100, borderRadius: 6 }} />
                        ) : (
                            <>SAR {totalBalance.toLocaleString()}</>
                        )}
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button
                    type="button"
                    className="btn-portal"
                    style={{ background: '#16A34A', border: 'none' }}
                    onClick={() => {
                        setReceiveSubmitError('');
                        setReceiveForm((f) => ({ ...f, date: f.date || new Date().toISOString().slice(0, 10) }));
                        setReceiveModalOpen(true);
                    }}
                    disabled={bootstrapLoading || !!bootstrapError}
                >
                    Receive Payment
                </button>
                <button
                    type="button"
                    className="btn-portal"
                    style={{ background: '#DC2626', border: 'none' }}
                    onClick={() => {
                        setPaySubmitError('');
                        setPayForm((f) => ({ ...f, date: f.date || new Date().toISOString().slice(0, 10) }));
                        setPayModalOpen(true);
                    }}
                    disabled={bootstrapLoading || !!bootstrapError}
                >
                    Make Payment
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={() => {
                        setAccountSaveError('');
                        setAddModalOpen(true);
                    }}
                    disabled={bootstrapLoading && !!bootstrapError}
                >
                    <Plus size={15} /> Add Cash / Bank Account
                </button>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12, borderBottom: '1px solid var(--color-border-light)' }}>
                {['accounts', 'ledger'].map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setActiveTab(t)}
                        style={{
                            padding: '8px 14px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: activeTab === t ? 700 : 500,
                            color: activeTab === t ? '#111827' : 'var(--color-text-muted)',
                            borderBottom: activeTab === t ? '2px solid #2563EB' : '2px solid transparent',
                            marginBottom: -1,
                        }}
                    >
                        {t === 'accounts' ? 'Accounts' : 'Transaction Ledger'}
                    </button>
                ))}
            </div>
            {activeTab === 'accounts' &&
                (bootstrapLoading && list.length === 0 ? (
                    <div className="ws-section" style={{ padding: '12px 0' }}>
                        <ShimmerListRows rows={5} />
                    </div>
                ) : list.length === 0 ? (
                    <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                        <Wallet size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                            {bootstrapError ? 'Accounts could not be loaded.' : 'No accounts yet'}
                        </p>
                        {!bootstrapError ? (
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                Use &quot;Add Cash / Bank Account&quot; to create one. Totals stay at SAR 0 until accounts exist.
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <div className="ws-section">
                        {list.map((a) => (
                            <div
                                key={String(a.id)}
                                style={{
                                    border: '1px solid var(--color-border-light)',
                                    borderRadius: 14,
                                    padding: 16,
                                    marginBottom: 12,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <div>
                                    <p style={{ fontWeight: 700, margin: 0, fontSize: '0.9375rem' }}>{a.name}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                                        <span className="ws-badge ws-badge--blue" style={{ fontSize: '0.65rem', marginRight: 6 }}>
                                            {a.type}
                                        </span>
                                        {a.bankName}
                                        {a.bankName && (a.iban || a.number) ? ' · ' : ''}
                                        {a.iban || a.number}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>Current Balance</p>
                                    <p style={{ fontWeight: 800, margin: '2px 0 0 0', color: '#111827' }}>
                                        SAR {(a.balance || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

            {activeTab === 'ledger' && (
                <div className="ws-section">
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Account</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Reference</th>
                                <th>Debit</th>
                                <th>Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bootstrapLoading && ledger.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: 16, verticalAlign: 'top' }}>
                                        <ShimmerTable rows={10} columns={7} />
                                    </td>
                                </tr>
                            ) : ledger.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                        {bootstrapError ? 'No ledger data loaded.' : 'No transactions recorded.'}
                                    </td>
                                </tr>
                            ) : (
                                ledger.map((t) => (
                                    <tr key={String(t.id)}>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t.date}</td>
                                        <td>{t.account}</td>
                                        <td>{t.type}</td>
                                        <td>{t.description}</td>
                                        <td>{t.reference}</td>
                                        <td>{t.debit ? `SAR ${t.debit}` : ''}</td>
                                        <td>{t.credit ? `SAR ${t.credit}` : ''}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            <AnimatePresence>
                {addModalOpen && (
                    <Modal
                        title="Add Cash / Bank Account"
                        onClose={() => {
                            setAddModalOpen(false);
                            setAccountSaveError('');
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-portal-outline" onClick={() => { setAddModalOpen(false); setAccountSaveError(''); }}>
                                    Cancel
                                </button>
                                <button
                                    className="btn-portal"
                                    style={{ background: '#2563EB', color: '#fff', border: 'none' }}
                                    disabled={!addForm.name}
                                    onClick={handleAddAccount}
                                >
                                    Add Account
                                </button>
                            </div>
                        }
                    >
                        {accountSaveError ? (
                            <p style={{ margin: '0 0 12px 0', padding: 10, background: '#FEF2F2', borderRadius: 8, color: '#B91C1C', fontSize: '0.8125rem' }}>
                                {accountSaveError}
                            </p>
                        ) : null}
                        <div className="ws-form-grid">
                            <div className="ws-field">
                                <label>Account Name *</label>
                                <input
                                    value={addForm.name}
                                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Petty Cash, Riyad Bank"
                                />
                            </div>
                            <div className="ws-field">
                                <label>Account Type</label>
                                <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}>
                                    <option value="Bank">Bank</option>
                                    <option value="Cash">Cash</option>
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>Bank Name</label>
                                <input value={addForm.bankName} onChange={(e) => setAddForm((f) => ({ ...f, bankName: e.target.value }))} />
                            </div>
                            <div className="ws-field">
                                <label>IBAN</label>
                                <input value={addForm.iban} onChange={(e) => setAddForm((f) => ({ ...f, iban: e.target.value }))} placeholder="SA..." />
                            </div>
                            <div className="ws-field">
                                <label>Account Number</label>
                                <input value={addForm.number} onChange={(e) => setAddForm((f) => ({ ...f, number: e.target.value }))} />
                            </div>
                            <div className="ws-field">
                                <label>Opening Balance (SAR)</label>
                                <input
                                    type="number"
                                    value={addForm.openingBalance}
                                    onChange={(e) => setAddForm((f) => ({ ...f, openingBalance: e.target.value }))}
                                />
                            </div>
                        </div>
                    </Modal>
                )}

                {receiveModalOpen && (
                    <Modal
                        title="Receive Payment (from Workshop)"
                        onClose={() => {
                            setReceiveModalOpen(false);
                            setReceiveSubmitError('');
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-portal-outline" onClick={() => { setReceiveModalOpen(false); setReceiveSubmitError(''); }}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    style={{ background: '#16A34A', color: '#fff', border: 'none', opacity: receiveSubmitting ? 0.7 : 1 }}
                                    disabled={
                                        receiveSubmitting ||
                                        noAccounts ||
                                        !receiveForm.accountId ||
                                        !receiveForm.amount ||
                                        !receiveForm.date
                                    }
                                    onClick={handleRecordReceipt}
                                >
                                    {receiveSubmitting ? 'Saving…' : 'Record Receipt'}
                                </button>
                            </div>
                        }
                    >
                        {receiveSubmitError ? (
                            <p style={{ margin: '0 0 12px 0', padding: 10, background: '#FEF2F2', borderRadius: 8, color: '#B91C1C', fontSize: '0.8125rem' }}>
                                {receiveSubmitError}
                            </p>
                        ) : null}
                        {noAccounts ? (
                            <p style={{ margin: '0 0 12px 0', padding: 12, background: '#FFFBEB', borderRadius: 8, color: '#92400E', fontSize: '0.8125rem' }}>
                                Add a cash or bank account first, then record receipts against it.
                            </p>
                        ) : null}
                        <div className="ws-form-grid">
                            <div className="ws-field">
                                <label>Account *</label>
                                <select
                                    value={receiveForm.accountId}
                                    onChange={(e) => setReceiveForm((f) => ({ ...f, accountId: e.target.value }))}
                                >
                                    <option value="">Select account</option>
                                    {accounts.map((a) => (
                                        <option key={String(a.id)} value={String(a.id)}>
                                            {a.name} ({a.type})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>Amount (SAR) *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={receiveForm.amount}
                                    onChange={(e) => setReceiveForm((f) => ({ ...f, amount: e.target.value }))}
                                />
                            </div>
                            <div className="ws-field">
                                <label>Date *</label>
                                <input
                                    type="date"
                                    value={receiveForm.date}
                                    onChange={(e) => setReceiveForm((f) => ({ ...f, date: e.target.value }))}
                                />
                            </div>
                            <div className="ws-field">
                                <label>Description</label>
                                <input
                                    value={receiveForm.description}
                                    onChange={(e) => setReceiveForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="e.g. Payment received from Workshop A"
                                />
                            </div>
                            <div className="ws-field">
                                <label>Reference / TXN</label>
                                <input
                                    value={receiveForm.reference}
                                    onChange={(e) => setReceiveForm((f) => ({ ...f, reference: e.target.value }))}
                                    placeholder="Bank TXN or cheque #"
                                />
                            </div>
                        </div>
                    </Modal>
                )}

                {payModalOpen && (
                    <Modal
                        title="Make Payment (to Vendor / Expense)"
                        onClose={() => {
                            setPayModalOpen(false);
                            setPaySubmitError('');
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-portal-outline" onClick={() => { setPayModalOpen(false); setPaySubmitError(''); }}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    style={{ background: '#DC2626', color: '#fff', border: 'none', opacity: paySubmitting ? 0.7 : 1 }}
                                    disabled={
                                        paySubmitting ||
                                        noAccounts ||
                                        !payForm.accountId ||
                                        !payForm.amount ||
                                        !payForm.date
                                    }
                                    onClick={handleRecordPayment}
                                >
                                    {paySubmitting ? 'Saving…' : 'Record Payment'}
                                </button>
                            </div>
                        }
                    >
                        {paySubmitError ? (
                            <p style={{ margin: '0 0 12px 0', padding: 10, background: '#FEF2F2', borderRadius: 8, color: '#B91C1C', fontSize: '0.8125rem' }}>
                                {paySubmitError}
                            </p>
                        ) : null}
                        {noAccounts ? (
                            <p style={{ margin: '0 0 12px 0', padding: 12, background: '#FFFBEB', borderRadius: 8, color: '#92400E', fontSize: '0.8125rem' }}>
                                Add a cash or bank account first.
                            </p>
                        ) : null}
                        <div className="ws-form-grid">
                            <div className="ws-field">
                                <label>Account *</label>
                                <select value={payForm.accountId} onChange={(e) => setPayForm((f) => ({ ...f, accountId: e.target.value }))}>
                                    <option value="">Select account</option>
                                    {accounts.map((a) => (
                                        <option key={String(a.id)} value={String(a.id)}>
                                            {a.name} ({a.type})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>Amount (SAR) *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={payForm.amount}
                                    onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                                />
                            </div>
                            <div className="ws-field">
                                <label>Date *</label>
                                <input type="date" value={payForm.date} onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))} />
                            </div>
                            <div className="ws-field">
                                <label>Description</label>
                                <input
                                    value={payForm.description}
                                    onChange={(e) => setPayForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="e.g. Payment to Vendor"
                                />
                            </div>
                            <div className="ws-field">
                                <label>Reference / TXN</label>
                                <input
                                    value={payForm.reference}
                                    onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
                                    placeholder="Bank TXN or cheque #"
                                />
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
