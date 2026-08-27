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
import { scbT } from '../../utils/supplierCashBankI18n';

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
            name: a.name ?? a.accountName ?? '',
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
        type: r.direction === 'debit' ? 'receipt' : 'payment',
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
        type: 'receipt',
        description: p.notes ?? '',
        _paymentRef: p.invoiceNo ?? p.invoiceId ?? '',
        reference: String(p.reference ?? p.invoiceId ?? ''),
        debit: '',
        credit: Number(p.amount ?? 0).toFixed(2),
    }));
}

export default function SupplierCashBank({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => scbT(locale, key, vars), [locale]);
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
            warnings.push(t('warn.accounts', { msg: accResult.reason?.message || t('warn.requestFailed') }));
        }

        if (ledResult.status === 'fulfilled') {
            ledgerPayload = ledResult.value;
        } else {
            warnings.push(t('warn.ledger', { msg: ledResult.reason?.message || t('warn.requestFailed') }));
        }

        if (payResult.status === 'fulfilled') {
            paymentsPayload = payResult.value;
        } else {
            warnings.push(t('warn.payments', { msg: payResult.reason?.message || t('warn.requestFailed') }));
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
            setBootstrapError(accResult.reason?.message || t('err.loadAccounts'));
        } else {
            setBootstrapError('');
        }

        return { warnings, accountCount: rawAccounts.length };
    }, [t]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setBootstrapLoading(true);
            setBootstrapError('');
            try {
                await reloadCashBankData();
            } catch (err) {
                if (!cancelled) {
                    setBootstrapError(err?.message || t('err.loadData'));
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
            setAccountSaveError(err?.message || t('err.createAccount'));
        }
    };

    const handleRecordReceipt = async () => {
        setReceiveSubmitError('');
        if (!receiveForm.accountId || !receiveForm.amount || !receiveForm.date) {
            setReceiveSubmitError(t('err.requiredFields'));
            return;
        }
        const amount = Number(receiveForm.amount);
        if (!(amount > 0)) {
            setReceiveSubmitError(t('err.validAmount'));
            return;
        }

        setReceiveSubmitting(true);
        try {
            await createSupplierCashBankLedgerEntry({
                accountId: String(receiveForm.accountId),
                direction: 'debit',
                amount,
                description: receiveForm.description?.trim() || t('desc.defaultReceipt'),
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
            setReceiveSubmitError(err?.message || t('err.recordReceipt'));
        } finally {
            setReceiveSubmitting(false);
        }
    };

    const handleRecordPayment = async () => {
        setPaySubmitError('');
        if (!payForm.accountId || !payForm.amount || !payForm.date) {
            setPaySubmitError(t('err.requiredFields'));
            return;
        }
        const amount = Number(payForm.amount);
        if (!(amount > 0)) {
            setPaySubmitError(t('err.validAmount'));
            return;
        }

        setPaySubmitting(true);
        try {
            await createSupplierCashBankLedgerEntry({
                accountId: String(payForm.accountId),
                direction: 'credit',
                amount,
                description: payForm.description?.trim() || t('desc.defaultPayment'),
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
            setPaySubmitError(err?.message || t('err.recordPayment'));
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
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">{t('page.sub')}</p>
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
                    <strong>{t('err.couldNotLoad')}</strong> {bootstrapError}
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
                    <strong>{t('warn.partial')}</strong> {partialLoadWarnings.join(' · ')}
                </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#ECFDF3', border: '1px solid #BBF7D0', borderRadius: 14, padding: 14 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', margin: 0 }}>{t('kpi.totalCash')}</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 900, margin: '6px 0 0 0', color: '#14532D', minHeight: 28 }}>
                        {bootstrapLoading ? (
                            <Shimmer style={{ display: 'inline-block', height: 22, width: 100, borderRadius: 6 }} />
                        ) : (
                            t('money.sar', { amount: totalCash.toLocaleString() })
                        )}
                    </p>
                </div>
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14, padding: 14 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563EB', margin: 0 }}>{t('kpi.totalBank')}</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 900, margin: '6px 0 0 0', color: '#1D4ED8', minHeight: 28 }}>
                        {bootstrapLoading ? (
                            <Shimmer style={{ display: 'inline-block', height: 22, width: 100, borderRadius: 6 }} />
                        ) : (
                            t('money.sar', { amount: totalBank.toLocaleString() })
                        )}
                    </p>
                </div>
                <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 14, padding: 14 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>{t('kpi.totalBalance')}</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 900, margin: '6px 0 0 0', color: '#0F172A', minHeight: 28 }}>
                        {bootstrapLoading ? (
                            <Shimmer style={{ display: 'inline-block', height: 22, width: 100, borderRadius: 6 }} />
                        ) : (
                            t('money.sar', { amount: totalBalance.toLocaleString() })
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
                    {t('btn.receive')}
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
                    {t('btn.makePay')}
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
                    <Plus size={15} /> {t('btn.addAccount')}
                </button>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12, borderBottom: '1px solid var(--color-border-light)' }}>
                {['accounts', 'ledger'].map((tabKey) => (
                    <button
                        key={tabKey}
                        type="button"
                        onClick={() => setActiveTab(tabKey)}
                        style={{
                            padding: '8px 14px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: activeTab === tabKey ? 700 : 500,
                            color: activeTab === tabKey ? '#111827' : 'var(--color-text-muted)',
                            borderBottom: activeTab === tabKey ? '2px solid #2563EB' : '2px solid transparent',
                            marginBottom: -1,
                        }}
                    >
                        {tabKey === 'accounts' ? t('tab.accounts') : t('tab.ledger')}
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
                            {bootstrapError ? t('empty.couldNotLoad') : t('empty.noAccounts')}
                        </p>
                        {!bootstrapError ? (
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                {t('empty.hint')}
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
                                    <p style={{ fontWeight: 700, margin: 0, fontSize: '0.9375rem' }}>
                                        {a.name || t('fallback.account')}
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                                        <span className="ws-badge ws-badge--blue" style={{ fontSize: '0.65rem', marginRight: 6 }}>
                                            {a.type === 'Cash' ? t('type.cash') : t('type.bank')}
                                        </span>
                                        {a.bankName}
                                        {a.bankName && (a.iban || a.number) ? ' · ' : ''}
                                        {a.iban || a.number}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                        {t('label.currentBalance')}
                                    </p>
                                    <p style={{ fontWeight: 800, margin: '2px 0 0 0', color: '#111827' }}>
                                        {t('money.sar', { amount: (a.balance || 0).toLocaleString() })}
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
                                <th>{t('th.date')}</th>
                                <th>{t('th.account')}</th>
                                <th>{t('th.type')}</th>
                                <th>{t('th.description')}</th>
                                <th>{t('th.reference')}</th>
                                <th>{t('th.debit')}</th>
                                <th>{t('th.credit')}</th>
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
                                        {bootstrapError ? t('empty.noLedgerData') : t('empty.noLedger')}
                                    </td>
                                </tr>
                            ) : (
                                ledger.map((row) => (
                                    <tr key={String(row.id)}>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{row.date}</td>
                                        <td>{row.account}</td>
                                        <td>
                                            {row.type === 'receipt'
                                                ? t('type.receipt')
                                                : row.type === 'payment'
                                                  ? t('type.payment')
                                                  : row.type}
                                        </td>
                                        <td>
                                            {row.description ||
                                                (row._paymentRef
                                                    ? t('desc.paymentFor', { ref: row._paymentRef })
                                                    : '')}
                                        </td>
                                        <td>{row.reference}</td>
                                        <td>{row.debit ? t('money.sar', { amount: row.debit }) : ''}</td>
                                        <td>{row.credit ? t('money.sar', { amount: row.credit }) : ''}</td>
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
                        title={t('modal.addTitle')}
                        onClose={() => {
                            setAddModalOpen(false);
                            setAccountSaveError('');
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-portal-outline" onClick={() => { setAddModalOpen(false); setAccountSaveError(''); }}>
                                    {t('btn.cancel')}
                                </button>
                                <button
                                    className="btn-portal"
                                    style={{ background: '#2563EB', color: '#fff', border: 'none' }}
                                    disabled={!addForm.name}
                                    onClick={handleAddAccount}
                                >
                                    {t('btn.addAccountSubmit')}
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
                                <label>{t('modal.accountName')}</label>
                                <input
                                    value={addForm.name}
                                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder={t('modal.accountNamePh')}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.accountType')}</label>
                                <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}>
                                    <option value="Bank">{t('type.bank')}</option>
                                    <option value="Cash">{t('type.cash')}</option>
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.bankName')}</label>
                                <input value={addForm.bankName} onChange={(e) => setAddForm((f) => ({ ...f, bankName: e.target.value }))} />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.iban')}</label>
                                <input value={addForm.iban} onChange={(e) => setAddForm((f) => ({ ...f, iban: e.target.value }))} placeholder={t('modal.ibanPh')} />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.accountNumber')}</label>
                                <input value={addForm.number} onChange={(e) => setAddForm((f) => ({ ...f, number: e.target.value }))} />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.openingBalance')}</label>
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
                        title={t('modal.receiveTitle')}
                        onClose={() => {
                            setReceiveModalOpen(false);
                            setReceiveSubmitError('');
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-portal-outline" onClick={() => { setReceiveModalOpen(false); setReceiveSubmitError(''); }}>
                                    {t('btn.cancel')}
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
                                    {receiveSubmitting ? t('btn.saving') : t('btn.recordReceipt')}
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
                                {t('modal.needAccountReceipt')}
                            </p>
                        ) : null}
                        <div className="ws-form-grid">
                            <div className="ws-field">
                                <label>{t('modal.account')}</label>
                                <select
                                    value={receiveForm.accountId}
                                    onChange={(e) => setReceiveForm((f) => ({ ...f, accountId: e.target.value }))}
                                >
                                    <option value="">{t('modal.selectAccount')}</option>
                                    {accounts.map((a) => (
                                        <option key={String(a.id)} value={String(a.id)}>
                                            {t('modal.accountOption', {
                                                name: a.name,
                                                type: a.type === 'Cash' ? t('type.cash') : t('type.bank'),
                                            })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.amount')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={receiveForm.amount}
                                    onChange={(e) => setReceiveForm((f) => ({ ...f, amount: e.target.value }))}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.date')}</label>
                                <input
                                    type="date"
                                    value={receiveForm.date}
                                    onChange={(e) => setReceiveForm((f) => ({ ...f, date: e.target.value }))}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.description')}</label>
                                <input
                                    value={receiveForm.description}
                                    onChange={(e) => setReceiveForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder={t('modal.receiveDescPh')}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.reference')}</label>
                                <input
                                    value={receiveForm.reference}
                                    onChange={(e) => setReceiveForm((f) => ({ ...f, reference: e.target.value }))}
                                    placeholder={t('modal.refPh')}
                                />
                            </div>
                        </div>
                    </Modal>
                )}

                {payModalOpen && (
                    <Modal
                        title={t('modal.payTitle')}
                        onClose={() => {
                            setPayModalOpen(false);
                            setPaySubmitError('');
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-portal-outline" onClick={() => { setPayModalOpen(false); setPaySubmitError(''); }}>
                                    {t('btn.cancel')}
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
                                    {paySubmitting ? t('btn.saving') : t('btn.recordPayment')}
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
                                {t('modal.needAccountPay')}
                            </p>
                        ) : null}
                        <div className="ws-form-grid">
                            <div className="ws-field">
                                <label>{t('modal.account')}</label>
                                <select value={payForm.accountId} onChange={(e) => setPayForm((f) => ({ ...f, accountId: e.target.value }))}>
                                    <option value="">{t('modal.selectAccount')}</option>
                                    {accounts.map((a) => (
                                        <option key={String(a.id)} value={String(a.id)}>
                                            {t('modal.accountOption', {
                                                name: a.name,
                                                type: a.type === 'Cash' ? t('type.cash') : t('type.bank'),
                                            })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.amount')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={payForm.amount}
                                    onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.date')}</label>
                                <input type="date" value={payForm.date} onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))} />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.description')}</label>
                                <input
                                    value={payForm.description}
                                    onChange={(e) => setPayForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder={t('modal.payDescPh')}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.reference')}</label>
                                <input
                                    value={payForm.reference}
                                    onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
                                    placeholder={t('modal.refPh')}
                                />
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
