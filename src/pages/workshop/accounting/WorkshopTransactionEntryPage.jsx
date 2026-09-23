import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowLeftRight, Banknote, FileText } from 'lucide-react';
import { accT } from '../../../utils/accountingI18n';
import {
    listCashBankAccounts as listAcctCashBank,
    listCoaAccounts as listAcctCoa,
    listPayees as listAcctPayees,
    getPayment as getAcctPayment,
    getReceipt as getAcctReceipt,
    getJournalEntry as getAcctJournalEntry,
} from '../../../services/workshopAccountingApi';
import { useHqAdminBooksScope } from '../../../hooks/useHqAdminBooksScope';
import {
    AcctCard,
    AcctError,
    AcctLoading,
    outlineBtnStyle,
    primaryBtnStyle,
} from '../../supplier/accounting/SupplierAccountingShared';
import WorkshopPayReceiptGrid from './WorkshopPayReceiptGrid';
import WorkshopJournalGrid from './WorkshopJournalGrid';
import WorkshopTransactionLogPanel from './WorkshopTransactionLogPanel';
import '../../../styles/admin/AccountingPage.css';

const TABS = [
    { id: 'Payments', icon: Banknote, labelKey: 'tx.tab.payments' },
    { id: 'Receipts', icon: FileText, labelKey: 'tx.tab.receipts' },
    { id: 'Journal Entry', icon: ArrowLeftRight, labelKey: 'tx.tab.journal' },
];

export default function WorkshopTransactionEntryPage({
    branches = [],
    selectedBranchId = 'all',
    locale: localeProp,
}) {
    const { isAdminHqBooks } = useHqAdminBooksScope();
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp
        || outletCtx.locale
        || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null)
        || 'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

    const [activeTab, setActiveTab] = useState('Payments');
    const [cashBankAccounts, setCashBankAccounts] = useState([]);
    const [coaPayableExpense, setCoaPayableExpense] = useState([]);
    const [coaReceivableRevenue, setCoaReceivableRevenue] = useState([]);
    const [coaAll, setCoaAll] = useState([]);
    const [payees, setPayees] = useState({ supplier: [], employee: [], customer: [] });
    const [loading, setLoading] = useState(true);
    const [lookupErr, setLookupErr] = useState('');
    const [refreshToken, setRefreshToken] = useState(0);
    const [editTxn, setEditTxn] = useState(null);
    const [editJournal, setEditJournal] = useState(null);

    const reloadLookups = useCallback(async () => {
        setLookupErr('');
        try {
            const [cb, payExp, recRev, all, sup, emp, cust] = await Promise.all([
                listAcctCashBank({ excludeCashierTills: '1' }),
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
            setPayees({
                supplier: sup?.payees ?? [],
                employee: emp?.payees ?? [],
                customer: cust?.payees ?? [],
            });
        } catch (e) {
            setLookupErr(e?.message || t('tx.err.lookups'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { reloadLookups(); }, [reloadLookups]);

    const handlePosted = useCallback(() => {
        setRefreshToken((n) => n + 1);
        reloadLookups();
    }, [reloadLookups]);

    const clearEdit = useCallback(() => {
        setEditTxn(null);
        setEditJournal(null);
    }, []);

    const handleEditFromLog = useCallback(async (row, tab) => {
        try {
            if (tab === 'journals') {
                const src = String(row?.source || '').toUpperCase();
                const linked = row?.linkedTransaction;
                if (src === 'PAYMENT' || linked?.transactionType === 'payment') {
                    let id = linked?.id;
                    if (!id) {
                        const full = await getAcctJournalEntry(row.id);
                        id = full?.entry?.linkedTransaction?.id;
                    }
                    if (!id) return;
                    const res = await getAcctPayment(id);
                    setEditJournal(null);
                    setActiveTab('Payments');
                    setEditTxn(res?.row || null);
                    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                if (src === 'RECEIPT' || linked?.transactionType === 'receipt') {
                    let id = linked?.id;
                    if (!id) {
                        const full = await getAcctJournalEntry(row.id);
                        id = full?.entry?.linkedTransaction?.id;
                    }
                    if (!id) return;
                    const res = await getAcctReceipt(id);
                    setEditJournal(null);
                    setActiveTab('Receipts');
                    setEditTxn(res?.row || null);
                    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                const full = await getAcctJournalEntry(row.id);
                setEditTxn(null);
                setEditJournal(full?.entry || row);
                if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            setEditJournal(null);
            setEditTxn(row);
            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
            setLookupErr(t('tx.log.editErr'));
        }
    }, [t]);

    const logTab =
        activeTab === 'Payments' ? 'payments'
            : activeTab === 'Receipts' ? 'receipts'
                : 'journals';

    return (
        <div className="module-container">
            <header style={{ marginBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{t('tx.title')}</h2>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
                    {isAdminHqBooks ? t('tx.sub.hq') : t('tx.sub.ws')}
                </p>
            </header>

            <div className="ws-tx-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '14px 0' }}>
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            style={active ? primaryBtnStyle : outlineBtnStyle}
                            onClick={() => {
                                setActiveTab(tab.id);
                                clearEdit();
                            }}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <Icon size={14} />
                                {t(tab.labelKey)}
                            </span>
                        </button>
                    );
                })}
            </div>

            <AcctError message={lookupErr} />

            {activeTab === 'Payments' ? (
                <AcctCard title={t('tx.new.payments')}>
                    {loading ? (
                        <AcctLoading locale={locale} />
                    ) : (
                        <WorkshopPayReceiptGrid
                            key={editTxn?.id ? `pay-edit-${editTxn.id}` : 'pay-new'}
                            variant="payment"
                            cashBankAccounts={cashBankAccounts}
                            accounts={coaPayableExpense}
                            payees={payees}
                            branches={branches}
                            defaultBranchId={selectedBranchId}
                            isAdminHqBooks={isAdminHqBooks}
                            t={t}
                            onPosted={handlePosted}
                            editRow={editTxn}
                            onCancelEdit={clearEdit}
                        />
                    )}
                </AcctCard>
            ) : null}

            {activeTab === 'Receipts' ? (
                <AcctCard title={t('tx.new.receipts')}>
                    {loading ? (
                        <AcctLoading locale={locale} />
                    ) : (
                        <WorkshopPayReceiptGrid
                            key={editTxn?.id ? `rcpt-edit-${editTxn.id}` : 'rcpt-new'}
                            variant="receipt"
                            cashBankAccounts={cashBankAccounts}
                            accounts={coaReceivableRevenue}
                            payees={payees}
                            branches={branches}
                            defaultBranchId={selectedBranchId}
                            isAdminHqBooks={isAdminHqBooks}
                            t={t}
                            onPosted={handlePosted}
                            editRow={editTxn}
                            onCancelEdit={clearEdit}
                        />
                    )}
                </AcctCard>
            ) : null}

            {activeTab === 'Journal Entry' ? (
                <AcctCard title={t('tx.new.journal')}>
                    {loading ? (
                        <AcctLoading locale={locale} />
                    ) : (
                        <WorkshopJournalGrid
                            key={editJournal?.id ? `je-edit-${editJournal.id}` : 'je-new'}
                            accounts={coaAll}
                            payees={payees}
                            branches={branches}
                            defaultBranchId={selectedBranchId}
                            isAdminHqBooks={isAdminHqBooks}
                            t={t}
                            onPosted={handlePosted}
                            editEntry={editJournal}
                            onCancelEdit={clearEdit}
                        />
                    )}
                </AcctCard>
            ) : null}

            <AcctCard
                title={
                    activeTab === 'Payments'
                        ? t('tx.log.payments')
                        : activeTab === 'Receipts'
                          ? t('tx.log.receipts')
                          : t('tx.log.journal')
                }
            >
                <WorkshopTransactionLogPanel
                    tab={logTab}
                    locale={locale}
                    t={t}
                    refreshToken={refreshToken}
                    cashBankAccounts={cashBankAccounts}
                    payees={payees}
                    onEdit={handleEditFromLog}
                    onChanged={handlePosted}
                />
            </AcctCard>
        </div>
    );
}
