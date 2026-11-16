import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
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
import {
  bulkTransactionRoutes,
  hasBulkTransactionRoutes,
} from '../../../utils/txEmployeePurpose';
import '../../../styles/admin/AccountingPage.css';

const TABS = [
  { id: 'Payments', icon: Banknote, labelKey: 'tx.tab.paymentPe' },
  { id: 'Receipts', icon: FileText, labelKey: 'tx.tab.receiptRv' },
  { id: 'Journal', icon: ArrowLeftRight, labelKey: 'tx.tab.journalJe' },
];

function titleKeyForTab(tab) {
  if (tab === 'Receipts') return 'tx.title.receiptRv';
  if (tab === 'Journal') return 'tx.title.journalJe';
  return 'tx.title.paymentPe';
}

export default function WorkshopTransactionEntryPage({
  branches = [],
  selectedBranchId = 'all',
  locale: localeProp,
}) {
  const { isAdminHqBooks } = useHqAdminBooksScope();
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
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
        listAcctPayees('employee', { includeInactive: 'true' }),
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

  useEffect(() => {
    reloadLookups();
  }, [reloadLookups]);

  const handlePosted = useCallback(() => {
    setRefreshToken((n) => n + 1);
    reloadLookups();
  }, [reloadLookups]);

  const clearEdit = useCallback(() => {
    setEditTxn(null);
    setEditJournal(null);
  }, []);

  const handleEditFromLog = useCallback(
    async (row, tab) => {
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
    },
    [t],
  );

  const logTab =
    activeTab === 'Payments' ? 'payments' : activeTab === 'Receipts' ? 'receipts' : 'journals';

  const bulkRoutes = bulkTransactionRoutes();
  const showBulkBtns = hasBulkTransactionRoutes();

  const formCard = (
    <>
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
              purposeAccounts={coaAll}
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

      {activeTab === 'Journal' ? (
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
    </>
  );

  return (
    <div className="module-container" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header style={{ marginBottom: 8 }}>
        <p className="form-help-text" style={{ marginBottom: 4 }}>
          <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
          {' / '}
          <span>{t('tx.crumb.transactions')}</span>
        </p>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
          {t(titleKeyForTab(activeTab))}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
          {isAdminHqBooks ? t('tx.sub.hq') : t('tx.sub.ws')}
        </p>
      </header>

      <section
        className="acct-panel"
        style={{
          marginBottom: 14,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          background: '#F8FAFC',
        }}
      >
        <div>
          <strong style={{ display: 'block', marginBottom: 4 }}>{t('tx.bulk.needMany')}</strong>
          <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.45 }}>
            {t('tx.bulk.blurb')}
          </p>
        </div>
        {showBulkBtns ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {bulkRoutes.newMany ? (
              <Link to={bulkRoutes.newMany} className="btn-submit btn-dark" style={{ textDecoration: 'none' }}>
                {t('tx.bulk.newMany')}
              </Link>
            ) : null}
            {bulkRoutes.importCsv ? (
              <Link to={bulkRoutes.importCsv} className="btn-portal-outline" style={{ textDecoration: 'none' }}>
                {t('tx.bulk.import')}
              </Link>
            ) : null}
            {bulkRoutes.batches ? (
              <Link to={bulkRoutes.batches} className="btn-portal-outline" style={{ textDecoration: 'none' }}>
                {t('tx.bulk.batches')}
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '14px 0' }}>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.9fr)',
          gap: 16,
          alignItems: 'start',
        }}
        className="ws-tx-entry-layout"
      >
        <div>{formCard}</div>
        <AcctCard title={t('tx.recent.title')}>
          <WorkshopTransactionLogPanel
            tab={logTab}
            locale={locale}
            t={t}
            refreshToken={refreshToken}
            cashBankAccounts={cashBankAccounts}
            payees={payees}
            onEdit={handleEditFromLog}
            onChanged={handlePosted}
            compact
          />
        </AcctCard>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .ws-tx-entry-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
