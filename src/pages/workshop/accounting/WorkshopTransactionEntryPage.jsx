import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, FileText, Banknote, Settings, ArrowLeftRight, Book, Shield } from 'lucide-react';
import { accT } from '../../../utils/accountingI18n';
import {
    listCashBankAccounts as listAcctCashBank,
    listCoaAccounts as listAcctCoa,
    listPayees as listAcctPayees,
    createPayments as createAcctPayments,
    createReceipts as createAcctReceipts,
    createJournalEntry as createAcctJournalEntry,
    previewNextVouchers as previewAcctNextVouchers,
    listPayments as listAcctPayments,
    listReceipts as listAcctReceipts,
    listJournalEntries as listAcctJournalEntries,
} from '../../../services/workshopAccountingApi';
import { useHqAdminBooksScope } from '../../../hooks/useHqAdminBooksScope';
import {
    PAYEE_TYPES,
    blankPaymentRow,
    blankReceiptRow,
    blankJournalRow,
    assignVouchersFromPool,
    buildRowsFromVoucherPool,
    todayIsoDate,
} from './workshopAccountingShared';
import '../../../styles/admin/AccountingPage.css';

export default function WorkshopTransactionEntryPage({ branches = [] }) {
    const { isAdminHqBooks } = useHqAdminBooksScope();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const [activeTab, setActiveTab] = useState('Payments');
    const [paymentsRows, setPaymentsRows] = useState(() => buildRowsFromVoucherPool(blankPaymentRow, ['PE0001', 'PE0002']));
    const [receiptsRows, setReceiptsRows] = useState(() => buildRowsFromVoucherPool(blankReceiptRow, ['RV0001', 'RV0002']));
    const [journalEntryRows, setJournalEntryRows] = useState(() => [blankJournalRow(0), blankJournalRow(1)]);
    const [peVoucherPool, setPeVoucherPool] = useState(['PE0001', 'PE0002', 'PE0003', 'PE0004', 'PE0005']);
    const [rvVoucherPool, setRvVoucherPool] = useState(['RV0001', 'RV0002', 'RV0003', 'RV0004', 'RV0005']);
    const [journalMemo, setJournalMemo] = useState('');
    const [headerDate, setHeaderDate] = useState(todayIsoDate());
    const [headerBranchId, setHeaderBranchId] = useState('');
    const [generalNote, setGeneralNote] = useState('');
    const [paidFromAccountId, setPaidFromAccountId] = useState('');

    const [cashBankAccounts, setCashBankAccounts] = useState([]);
    const [coaPayableExpense, setCoaPayableExpense] = useState([]);
    const [coaReceivableRevenue, setCoaReceivableRevenue] = useState([]);
    const [coaAll, setCoaAll] = useState([]);
    const [payeesBySupplier, setPayeesBySupplier] = useState([]);
    const [payeesByEmployee, setPayeesByEmployee] = useState([]);
    const [payeesByCustomer, setPayeesByCustomer] = useState([]);
    const [recentRows, setRecentRows] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [okMsg, setOkMsg] = useState('');

    const reloadLookups = useCallback(async () => {
        try {
            const [cb, payExp, recRev, all, sup, emp, cust] = await Promise.all([
                listAcctCashBank(),
                listAcctCoa('payable_expense'),
                listAcctCoa('receivable_revenue'),
                listAcctCoa('all'),
                listAcctPayees('supplier'),
                listAcctPayees('employee'),
                listAcctPayees('customer'),
            ]);
            setCashBankAccounts(cb?.accounts ?? []);
            setCoaPayableExpense(payExp?.accounts ?? []);
            setCoaReceivableRevenue(recRev?.accounts ?? []);
            setCoaAll(all?.accounts ?? []);
            setPayeesBySupplier(sup?.payees ?? []);
            setPayeesByEmployee(emp?.payees ?? []);
            setPayeesByCustomer(cust?.payees ?? []);
        } catch (e) {
            console.error('Failed to load accounting lookups', e);
            setError(e?.message || t('tx.err.lookups'));
        }
    }, [t]);

    const reloadVoucherPreviews = useCallback(async (rowCount = 2) => {
        try {
            const need = Math.max(rowCount + 3, 5);
            const [peRes, rvRes] = await Promise.all([
                previewAcctNextVouchers('PE', need),
                previewAcctNextVouchers('RV', need),
            ]);
            const pePool = Array.isArray(peRes?.vouchers) ? peRes.vouchers : [];
            const rvPool = Array.isArray(rvRes?.vouchers) ? rvRes.vouchers : [];
            if (pePool.length) setPeVoucherPool(pePool);
            if (rvPool.length) setRvVoucherPool(rvPool);
            setPaymentsRows((prev) => assignVouchersFromPool(prev, pePool.length ? pePool : peVoucherPool, 'PE'));
            setReceiptsRows((prev) => assignVouchersFromPool(prev, rvPool.length ? rvPool : rvVoucherPool, 'RV'));
            return { pePool, rvPool };
        } catch (e) {
            console.error('Failed to load voucher previews', e);
            return { pePool: peVoucherPool, rvPool: rvVoucherPool };
        }
    }, [peVoucherPool, rvVoucherPool]);

    useEffect(() => { reloadLookups(); }, [reloadLookups]);

    useEffect(() => {
        reloadVoucherPreviews(2).then(({ pePool, rvPool }) => {
            if (pePool?.length) {
                setPaymentsRows(buildRowsFromVoucherPool(blankPaymentRow, pePool, 2));
            }
            if (rvPool?.length) {
                setReceiptsRows(buildRowsFromVoucherPool(blankReceiptRow, rvPool, 2));
            }
        });
    }, []);

    // Whenever Paid From Account changes, sync the branch field with the
    // register's branch so the user doesn't need to set it twice.
    useEffect(() => {
        if (!paidFromAccountId) return;
        const acc = cashBankAccounts.find((a) => String(a.id) === String(paidFromAccountId));
        if (acc?.branchId) setHeaderBranchId(String(acc.branchId));
    }, [paidFromAccountId, cashBankAccounts]);

    const reloadRecent = useCallback(async (tab) => {
        try {
            if (tab === 'Payments') {
                const res = await listAcctPayments({ limit: 8 });
                setRecentRows(res?.rows ?? []);
            } else if (tab === 'Receipts') {
                const res = await listAcctReceipts({ limit: 8 });
                setRecentRows(res?.rows ?? []);
            } else {
                const res = await listAcctJournalEntries({ limit: 8 });
                setRecentRows((res?.entries ?? []).map((e) => ({
                    id: e.id,
                    voucherNumber: e.entryNumber,
                    transactionType: 'journal',
                    date: e.date,
                    amount: e.totalDebit,
                    status: e.status,
                    payeeName: e.description,
                })));
            }
        } catch (e) {
            console.error('Failed to load recent', e);
            setRecentRows([]);
        }
    }, []);
    useEffect(() => { reloadRecent(activeTab); }, [activeTab, reloadRecent]);

    const payeeOptionsForType = (t) => {
        if (t === 'Supplier') return payeesBySupplier;
        if (t === 'Employee') return payeesByEmployee;
        if (t === 'Customer') return payeesByCustomer;
        return [];
    };

    const addRow = useCallback(() => {
        if (activeTab === 'Payments') {
            setPaymentsRows((prev) => {
                const nextPool = peVoucherPool;
                const nextIdx = prev.length;
                return [...prev, blankPaymentRow(nextIdx, nextPool[nextIdx])];
            });
        } else if (activeTab === 'Receipts') {
            setReceiptsRows((prev) => {
                const nextPool = rvVoucherPool;
                const nextIdx = prev.length;
                return [...prev, blankReceiptRow(nextIdx, nextPool[nextIdx])];
            });
        } else {
            setJournalEntryRows((prev) => [...prev, blankJournalRow(prev.length)]);
        }
    }, [activeTab, peVoucherPool, rvVoucherPool]);

    const removeRow = (id) => {
        if (activeTab === 'Payments') {
            setPaymentsRows((prev) =>
                assignVouchersFromPool(prev.filter((r) => r.id !== id), peVoucherPool, 'PE'),
            );
        } else if (activeTab === 'Receipts') {
            setReceiptsRows((prev) =>
                assignVouchersFromPool(prev.filter((r) => r.id !== id), rvVoucherPool, 'RV'),
            );
        } else {
            setJournalEntryRows((prev) => prev.filter((r) => r.id !== id));
        }
    };

    const updatePaymentRow = (id, patch) => {
        setPaymentsRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };
    const updateReceiptRow = (id, patch) => {
        setReceiptsRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };
    const updateJournalRow = (id, patch) => {
        setJournalEntryRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };

    // Tab on the very last input of the very last row appends a new row.
    const handleLastFieldKeyDown = (rowIdx, totalRows) => (e) => {
        if (e.key !== 'Tab' || e.shiftKey) return;
        if (rowIdx !== totalRows - 1) return;
        e.preventDefault();
        addRow();
    };

    const calculateJournalTotals = () => {
        const debit = journalEntryRows.reduce((sum, row) => sum + (parseFloat(row.debit) || 0), 0);
        const credit = journalEntryRows.reduce((sum, row) => sum + (parseFloat(row.credit) || 0), 0);
        return { debit: debit.toFixed(2), credit: credit.toFixed(2), isBalanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
    };
    const journalTotals = calculateJournalTotals();

    const validRowCountPayments = paymentsRows.filter((r) => Number(r.amount) > 0 && r.accountId).length;
    const validRowCountReceipts = receiptsRows.filter((r) => Number(r.amount) > 0 && r.accountId).length;
    const totalPayments = paymentsRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalReceipts = receiptsRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const handleSavePayments = async () => {
        setError(''); setOkMsg('');
        if (!paidFromAccountId) { setError(t('tx.err.paidFrom')); return; }
        const valid = paymentsRows.filter((r) => Number(r.amount) > 0 && r.accountId);
        if (!valid.length) { setError(t('tx.err.row')); return; }
        setSaving(true);
        try {
            const res = await createAcctPayments({
                date: headerDate,
                ...(isAdminHqBooks ? {} : { branchId: headerBranchId || undefined }),
                generalNote: generalNote || undefined,
                cashBankAccountId: paidFromAccountId,
                rows: valid.map((r) => ({
                    voucherHint: r.voucher,
                    date: r.date || headerDate,
                    payeeType: r.type,
                    payeeId: r.payeeId || undefined,
                    payeeName: r.payeeName || undefined,
                    accountId: r.accountId,
                    amount: Number(r.amount),
                    reference: r.ref || undefined,
                    notes: r.notes || undefined,
                })),
            });
            setOkMsg(t('tx.ok.payments', { n: res?.saved ?? valid.length, total: (res?.total ?? 0).toFixed(2) }));
            await reloadRecent('Payments');
            await reloadLookups();
            const { pePool } = await reloadVoucherPreviews(1);
            if (pePool?.length) {
                setPaymentsRows(buildRowsFromVoucherPool(blankPaymentRow, pePool, 1));
            } else {
                setPaymentsRows(buildRowsFromVoucherPool(blankPaymentRow, peVoucherPool, 1));
            }
        } catch (e) {
            setError(e?.message || t('tx.err.savePay'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveReceipts = async () => {
        setError(''); setOkMsg('');
        if (!paidFromAccountId) { setError(t('tx.err.receivedInto')); return; }
        const valid = receiptsRows.filter((r) => Number(r.amount) > 0 && r.accountId);
        if (!valid.length) { setError(t('tx.err.row')); return; }
        setSaving(true);
        try {
            const res = await createAcctReceipts({
                date: headerDate,
                ...(isAdminHqBooks ? {} : { branchId: headerBranchId || undefined }),
                generalNote: generalNote || undefined,
                cashBankAccountId: paidFromAccountId,
                rows: valid.map((r) => ({
                    voucherHint: r.voucher,
                    date: r.date || headerDate,
                    payeeType: r.type,
                    payeeId: r.payeeId || undefined,
                    payeeName: r.payeeName || undefined,
                    accountId: r.accountId,
                    amount: Number(r.amount),
                    reference: r.ref || undefined,
                    notes: r.notes || undefined,
                })),
            });
            setOkMsg(t('tx.ok.receipts', { n: res?.saved ?? valid.length, total: (res?.total ?? 0).toFixed(2) }));
            await reloadRecent('Receipts');
            await reloadLookups();
            const { rvPool } = await reloadVoucherPreviews(1);
            if (rvPool?.length) {
                setReceiptsRows(buildRowsFromVoucherPool(blankReceiptRow, rvPool, 1));
            } else {
                setReceiptsRows(buildRowsFromVoucherPool(blankReceiptRow, rvVoucherPool, 1));
            }
        } catch (e) {
            setError(e?.message || t('tx.err.saveRcpt'));
        } finally {
            setSaving(false);
        }
    };

    const handlePostJournal = async () => {
        setError(''); setOkMsg('');
        const lines = journalEntryRows.filter((r) => r.accountId && (Number(r.debit) > 0 || Number(r.credit) > 0));
        if (lines.length < 2) { setError(t('tx.err.jeLines')); return; }
        if (!journalTotals.isBalanced) {
            setError(t('tx.err.jeBalance', { debit: journalTotals.debit, credit: journalTotals.credit }));
            return;
        }
        setSaving(true);
        try {
            const res = await createAcctJournalEntry({
                date: headerDate,
                ...(isAdminHqBooks ? {} : { branchId: headerBranchId || undefined }),
                description: journalMemo || undefined,
                lines: lines.map((l) => ({
                    accountId: l.accountId,
                    description: l.description || undefined,
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                })),
            });
            setJournalEntryRows([blankJournalRow(0), blankJournalRow(1)]);
            setJournalMemo('');
            setOkMsg(t('tx.ok.journal', {
                code: res?.entry?.entryNumber || t('tx.tab.journal'),
                dr: res?.entry?.totalDebit?.toFixed?.(2) ?? journalTotals.debit,
                cr: res?.entry?.totalCredit?.toFixed?.(2) ?? journalTotals.credit,
            }));
            await reloadRecent('Journal Entry');
        } catch (e) {
            setError(e?.message || t('tx.err.postJe'));
        } finally {
            setSaving(false);
        }
    };

    const paidFromLabel = activeTab === 'Receipts' ? t('tx.receivedInto') : t('tx.paidFrom');
    const cashBankPlaceholder = activeTab === 'Receipts'
        ? t('tx.selectDeposit')
        : t('tx.selectCb');
    const tabLabel =
        activeTab === 'Payments'
            ? t('tx.tab.payments')
            : activeTab === 'Receipts'
              ? t('tx.tab.receipts')
              : t('tx.tab.journal');

    const renderPayeeSelect = (row, update) => {
        const options = payeeOptionsForType(row.type);
        if (row.type === 'Other') {
            return (
                <input
                    type="text"
                    className="table-input-field"
                    placeholder={t('tx.payeeNamePh')}
                    value={row.payeeName}
                    onChange={(e) => update(row.id, { payeeName: e.target.value, payeeId: '' })}
                />
            );
        }
        return (
            <select
                className="table-input-field"
                value={row.payeeId}
                onChange={(e) => {
                    const pid = e.target.value;
                    const opt = options.find((o) => String(o.id) === String(pid));
                    update(row.id, { payeeId: pid, payeeName: opt?.name ?? '' });
                }}
            >
                <option value="">{t('tx.selectPayee', { type: t(`tx.payee.${row.type}`).toLowerCase() })}</option>
                {options.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}{o.sublabel ? ` — ${o.sublabel}` : ''}</option>
                ))}
            </select>
        );
    };

    const renderAccountSelect = (row, update, options) => (
        <select
            className="table-input-field"
            value={row.accountId}
            onChange={(e) => update(row.id, { accountId: e.target.value })}
        >
            <option value="">{t('tx.selectAccount')}</option>
            {options.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
            ))}
        </select>
    );

    const formatRecentDate = (d) => {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString(); } catch { return String(d); }
    };

    return (
        <div className="transaction-entry-view">
            <header className="trans-entry-header">
                <div>
                    <h2 className="trans-entry-title">{t('tx.title')}</h2>
                    <p className="trans-entry-subtitle">
                        {isAdminHqBooks ? t('tx.sub.hq') : t('tx.sub.ws')}
                    </p>
                </div>
            </header>

            <div className="trans-entry-form-header">
                <div className="form-row-grid-trans">
                    <div className="form-group">
                        <label className="form-label">{t('tx.date')}</label>
                        <div className="input-with-icon">
                            <input
                                type="date"
                                className="form-input-field"
                                value={headerDate}
                                onChange={(e) => setHeaderDate(e.target.value)}
                            />
                        </div>
                    </div>
                    {!isAdminHqBooks ? (
                    <div className="form-group">
                        <label className="form-label">{t('tx.branch')}</label>
                        <select
                            className="form-input-field"
                            value={headerBranchId}
                            onChange={(e) => setHeaderBranchId(e.target.value)}
                        >
                            <option value="">{t('tx.allBranches')}</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    ) : null}
                    <div className="form-group">
                        <label className="form-label">{t('tx.note')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('tx.notePh')}
                            value={generalNote}
                            onChange={(e) => setGeneralNote(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">
                            <div className="label-with-settings">
                                <Settings size={14} className="settings-icon-label" />
                                <span>{paidFromLabel}</span>
                            </div>
                        </label>
                        <select
                            className="form-input-field"
                            value={paidFromAccountId}
                            onChange={(e) => setPaidFromAccountId(e.target.value)}
                        >
                            <option value="">{cashBankPlaceholder}</option>
                            {cashBankAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name} ({a.type}) — SAR {Number(a.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="trans-tabs-container">
                <button
                    className={`trans-tab-item ${activeTab === 'Payments' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('Payments'); setError(''); setOkMsg(''); }}
                >
                    <Banknote size={16} /> {t('tx.tab.payments')}
                </button>
                <button
                    className={`trans-tab-item ${activeTab === 'Receipts' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('Receipts'); setError(''); setOkMsg(''); }}
                >
                    <FileText size={16} /> {t('tx.tab.receipts')}
                </button>
                <button
                    className={`trans-tab-item ${activeTab === 'Journal Entry' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('Journal Entry'); setError(''); setOkMsg(''); }}
                >
                    <ArrowLeftRight size={16} /> {t('tx.tab.journal')}
                </button>
            </div>

            <div className="trans-table-card">
                {activeTab === 'Journal Entry' && (
                    <div className="journal-memo-container">
                        <div className="journal-id-badge">
                            {t('tx.tab.journal')} • <small>{journalTotals.isBalanced ? t('tx.je.balanced') : t('tx.je.diff', { n: (parseFloat(journalTotals.debit) - parseFloat(journalTotals.credit)).toFixed(2) })}</small>
                            {' '}• <span className="memo-help">{t('tx.je.tabHelp')}</span>
                        </div>
                        <input
                            type="text"
                            className="journal-memo-input"
                            placeholder={t('tx.je.memoPh')}
                            value={journalMemo}
                            onChange={(e) => setJournalMemo(e.target.value)}
                        />
                    </div>
                )}
                <div className="trans-table-header-info">
                    {activeTab === 'Payments' && <span>{t('tx.hint.payments')}</span>}
                    {activeTab === 'Receipts' && <span>{t('tx.hint.receipts')}</span>}
                    {activeTab === 'Journal Entry' && null}
                </div>
                <div className="premium-table-container">
                    <table className="trans-entry-table">
                        <thead>
                            {activeTab === 'Journal Entry' ? (
                                <tr>
                                    <th style={{ width: '25%' }}>{t('tx.th.account')}</th>
                                    <th>{t('tx.th.lineDesc')}</th>
                                    <th style={{ width: '150px' }}>{t('tx.th.debit')}</th>
                                    <th style={{ width: '150px' }}>{t('tx.th.credit')}</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            ) : (
                                <tr>
                                    <th style={{ width: '120px' }}>{t('tx.th.voucher')}</th>
                                    <th style={{ width: '150px' }}>{t('tx.th.date')}</th>
                                    <th style={{ width: '150px' }}>{t('tx.th.type')}</th>
                                    <th>{activeTab === 'Payments' ? t('tx.th.payeeTo') : t('tx.th.receivedFrom')}</th>
                                    <th>{activeTab === 'Payments' ? t('tx.th.accountDr') : t('tx.th.accountCr')}</th>
                                    <th style={{ width: '120px' }}>{t('tx.th.amount')}</th>
                                    <th>{t('tx.th.ref')}</th>
                                    <th>{t('tx.th.notes')}</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {activeTab === 'Payments' && paymentsRows.map((row, idx) => (
                                <tr key={row.id}>
                                    <td><input type="text" className="table-input-field voucher-input" value={row.voucher} readOnly /></td>
                                    <td><input type="date" className="table-input-field" value={row.date} onChange={(e) => updatePaymentRow(row.id, { date: e.target.value })} /></td>
                                    <td>
                                        <select className="table-input-field" value={row.type} onChange={(e) => updatePaymentRow(row.id, { type: e.target.value, payeeId: '', payeeName: '' })}>
                                            {PAYEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </td>
                                    <td>{renderPayeeSelect(row, updatePaymentRow)}</td>
                                    <td>{renderAccountSelect(row, updatePaymentRow, coaPayableExpense)}</td>
                                    <td><input type="number" step="0.01" min="0" className="table-input-field" value={row.amount} onChange={(e) => updatePaymentRow(row.id, { amount: e.target.value })} placeholder="0.00" /></td>
                                    <td><input type="text" className="table-input-field" placeholder="Ref #" value={row.ref} onChange={(e) => updatePaymentRow(row.id, { ref: e.target.value })} /></td>
                                    <td>
                                        <input
                                            type="text"
                                            className="table-input-field"
                                            placeholder="Notes"
                                            value={row.notes}
                                            onChange={(e) => updatePaymentRow(row.id, { notes: e.target.value })}
                                            onKeyDown={handleLastFieldKeyDown(idx, paymentsRows.length)}
                                        />
                                    </td>
                                    <td>
                                        <button className="btn-row-delete" onClick={() => removeRow(row.id)} title="Delete row">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {activeTab === 'Receipts' && receiptsRows.map((row, idx) => (
                                <tr key={row.id}>
                                    <td><input type="text" className="table-input-field voucher-input receipt-voucher" value={row.voucher} readOnly /></td>
                                    <td>
                                        <div className="table-input-with-icon">
                                            <input type="date" className="table-input-field" value={row.date} onChange={(e) => updateReceiptRow(row.id, { date: e.target.value })} />
                                        </div>
                                    </td>
                                    <td>
                                        <select className="table-input-field" value={row.type} onChange={(e) => updateReceiptRow(row.id, { type: e.target.value, payeeId: '', payeeName: '' })}>
                                            {PAYEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </td>
                                    <td>{renderPayeeSelect(row, updateReceiptRow)}</td>
                                    <td>{renderAccountSelect(row, updateReceiptRow, coaReceivableRevenue)}</td>
                                    <td><input type="number" step="0.01" min="0" className="table-input-field" value={row.amount} onChange={(e) => updateReceiptRow(row.id, { amount: e.target.value })} placeholder="0.00" /></td>
                                    <td><input type="text" className="table-input-field" placeholder="Ref #" value={row.ref} onChange={(e) => updateReceiptRow(row.id, { ref: e.target.value })} /></td>
                                    <td>
                                        <input
                                            type="text"
                                            className="table-input-field"
                                            placeholder="Notes"
                                            value={row.notes}
                                            onChange={(e) => updateReceiptRow(row.id, { notes: e.target.value })}
                                            onKeyDown={handleLastFieldKeyDown(idx, receiptsRows.length)}
                                        />
                                    </td>
                                    <td>
                                        <button className="btn-row-delete" onClick={() => removeRow(row.id)} title="Delete row">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {activeTab === 'Journal Entry' && (
                                <>
                                    {journalEntryRows.map((row, idx) => (
                                        <tr key={row.id}>
                                            <td>{renderAccountSelect(row, updateJournalRow, coaAll)}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="table-input-field"
                                                    placeholder="Line description"
                                                    value={row.description}
                                                    onChange={(e) => updateJournalRow(row.id, { description: e.target.value })}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="table-input-field"
                                                    value={row.debit}
                                                    onChange={(e) => updateJournalRow(row.id, { debit: e.target.value, credit: e.target.value ? '' : row.credit })}
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="table-input-field"
                                                    value={row.credit}
                                                    onChange={(e) => updateJournalRow(row.id, { credit: e.target.value, debit: e.target.value ? '' : row.debit })}
                                                    placeholder="0.00"
                                                    onKeyDown={handleLastFieldKeyDown(idx, journalEntryRows.length)}
                                                />
                                            </td>
                                            <td>
                                                <button className="btn-row-delete" onClick={() => removeRow(row.id)} title="Delete row">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="totals-row">
                                        <td colSpan={2} className="totals-label">Totals</td>
                                        <td className="total-value">SAR {journalTotals.debit}</td>
                                        <td className="total-value">SAR {journalTotals.credit}</td>
                                        <td></td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {(error || okMsg) && (
                    <div style={{ padding: '8px 12px', fontSize: 13 }}>
                        {error && <div style={{ color: '#B91C1C', fontWeight: 600 }}>{error}</div>}
                        {okMsg && <div style={{ color: '#047857', fontWeight: 600 }}>{okMsg}</div>}
                    </div>
                )}

                <div className="trans-table-footer">
                    <div className="trans-total-summary">
                        {activeTab === 'Payments' && `${validRowCountPayments} valid row${validRowCountPayments === 1 ? '' : 's'} — Total: SAR ${totalPayments.toFixed(2)}`}
                        {activeTab === 'Receipts' && `${validRowCountReceipts} valid row${validRowCountReceipts === 1 ? '' : 's'} — Total: SAR ${totalReceipts.toFixed(2)}`}
                        {activeTab === 'Journal Entry' && (
                            journalTotals.isBalanced
                                ? `Balanced — SAR ${journalTotals.debit}`
                                : `Unbalanced — Dr ${journalTotals.debit} / Cr ${journalTotals.credit}`
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="btn-portal-outline"
                            onClick={addRow}
                            disabled={saving}
                            style={{ padding: '8px 14px' }}
                        >
                            <Plus size={14} /> Add row
                        </button>
                        <button
                            className="btn-save-all"
                            disabled={saving}
                            onClick={() => {
                                if (activeTab === 'Payments') return handleSavePayments();
                                if (activeTab === 'Receipts') return handleSaveReceipts();
                                return handlePostJournal();
                            }}
                        >
                            {activeTab === 'Journal Entry' ? <Book size={16} /> : <Shield size={16} />}
                            {saving ? 'Saving…' : (activeTab === 'Journal Entry' ? 'Post Journal Entry' : `Save All ${activeTab}`)}
                        </button>
                    </div>
                </div>
            </div>


            <section className="recent-transactions">
                <h3 className="recent-trans-title">Recent {activeTab}</h3>
                <div className="recent-trans-placeholder">
                    {recentRows.length === 0 ? (
                        <div style={{ color: '#94A3B8', padding: 20, textAlign: 'center', fontSize: 13 }}>
                            No recent {activeTab.toLowerCase()} yet.
                        </div>
                    ) : (
                        recentRows.map((r) => (
                            <div key={r.id} className="recent-je-item">
                                <div className="je-item-info">
                                    <span className="je-code">{r.voucherNumber || r.entryNumber}</span>
                                    <span className="je-date">
                                        {formatRecentDate(r.date)}
                                        {r.payeeName ? ` • ${r.payeeName}` : ''}
                                    </span>
                                </div>
                                <div className="je-item-status">
                                    <span className="je-amount">SAR {Number(r.amount || 0).toFixed(2)}</span>
                                    <span className={`je-posted-badge ${r.status === 'posted' ? '' : ''}`}>
                                        {(r.status || 'posted').toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

        </div>
    );
}
