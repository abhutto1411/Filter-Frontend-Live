import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  getAccountingBatch,
  closeAccountingBatch,
} from '../../../services/workshopAccountingApi';
import TxImportPanel from './TxImportPanel';
import { readImportFile } from './txImportFile';
import { batchDraftRowsToImportText, buildTxImport } from '../../../utils/txImport';
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
import { bulkTransactionRoutes } from '../../../utils/txEmployeePurpose';
import '../../../styles/admin/AccountingPage.css';

const TAB_FOR_TYPE = { payment: 'Payments', receipt: 'Receipts', journal: 'Journal' };

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
  /** Open a saved batch draft's unposted rows on these screens (from /transactions/batch/:id). */
  batchDraftId = null,
  /**
   * 'entry'  — Transactions page (PE / RV / JE + Recent).
   * 'batch'  — "New transactions (one or many)": same forms, full width, several lines,
   *            import / paste on top, no Recent panel.
   * 'import' — same as batch, opened from "Import CSV / Excel".
   */
  mode = 'entry',
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
  const batchMode = mode === 'batch' || mode === 'import' || Boolean(batchDraftId);
  /** Blank lines a fresh form starts with (batch entry starts with several). */
  const payRowsStart = batchMode ? 5 : 1;
  const jeRowsStart = batchMode ? 4 : 2;
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
      const [cb, postable, all, sup, emp, cust] = await Promise.all([
        listAcctCashBank({ excludeCashierTills: '1' }),
        listAcctCoa('postable', { includeOtherBranches: '1' }),
        listAcctCoa('all', { includeOtherBranches: '1' }),
        listAcctPayees('supplier'),
        listAcctPayees('employee', { includeInactive: 'true' }),
        listAcctPayees('customer'),
      ]);
      setCashBankAccounts(cb?.accounts ?? []);
      // PE/RV Account columns use the full postable pool (all types + other branches).
      setCoaPayableExpense(postable?.accounts ?? []);
      setCoaReceivableRevenue(postable?.accounts ?? []);
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

  // ---- Import (CSV / Excel / saved batch draft) into the same PE / RV / JE forms ----
  const [imported, setImported] = useState(null);
  const [activeSeed, setActiveSeed] = useState(null); // { entryKey, tab, seed }
  const [importBusy, setImportBusy] = useState(false);
  const formRef = useRef(null);

  const importLookups = useMemo(() => {
    const byId = new Map();
    for (const a of [...(coaPayableExpense || []), ...(coaAll || [])]) {
      if (a?.id != null && !byId.has(String(a.id))) byId.set(String(a.id), a);
    }
    return { accounts: [...byId.values()], cashBankAccounts, payees, branches };
  }, [coaPayableExpense, coaAll, cashBankAccounts, payees, branches]);

  const openEntry = useCallback((entry) => {
    const tab = TAB_FOR_TYPE[entry.type] || 'Payments';
    clearEdit();
    setActiveTab(tab);
    setActiveSeed({
      entryKey: entry.key,
      tab,
      seed: { key: `${entry.key}#${Date.now()}`, header: entry.header, rows: entry.rows },
    });
    queueMicrotask(() => formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }, [clearEdit]);

  const loadImportText = useCallback((text, source) => {
    const res = buildTxImport(text, importLookups);
    const entries = res.entries.map((e) => ({ ...e, status: 'ready' }));
    setImported({ source, entries, issues: res.issues, counts: res.counts, notice: '', noticeTone: '' });
    setActiveSeed(null);
    if (entries.length === 1) openEntry(entries[0]);
  }, [importLookups, openEntry]);

  const handleImportFile = useCallback(async (file) => {
    setImportBusy(true);
    try {
      const text = await readImportFile(file);
      loadImportText(text, { kind: 'file', name: file.name });
    } catch (e) {
      setImported({
        source: { kind: 'file', name: file?.name || '' },
        entries: [],
        issues: [{ line: 0, key: 'tx.imp.err.read', value: e?.message || '' }],
        counts: { rows: 0, loaded: 0, skipped: 0 },
      });
    } finally {
      setImportBusy(false);
    }
  }, [loadImportText]);

  // Saved batch draft → its unposted rows open here (once lookups are loaded).
  const draftLoadedRef = useRef(null);
  useEffect(() => {
    if (!batchDraftId || loading || draftLoadedRef.current === batchDraftId) return;
    draftLoadedRef.current = batchDraftId;
    (async () => {
      try {
        const res = await getAccountingBatch(batchDraftId);
        const { text } = batchDraftRowsToImportText(res?.rows || []);
        loadImportText(text, {
          kind: 'draft',
          batchId: String(batchDraftId),
          batchNo: res?.batchNo || '',
          version: res?.version,
        });
      } catch (e) {
        setLookupErr(e?.message || t('br.err.load'));
      }
    })();
  }, [batchDraftId, loading, loadImportText, t]);

  /** A form saved: mark its imported group saved; close the batch draft once every group is saved. */
  const handleFormPosted = useCallback((tab) => async (res) => {
    handlePosted(res);
    if (!activeSeed || activeSeed.tab !== tab || !imported) return;
    const entries = imported.entries.map((e) => (e.key === activeSeed.entryKey ? { ...e, status: 'saved' } : e));
    setActiveSeed(null);
    let notice = '';
    let noticeTone = '';
    const allSaved = entries.length > 0 && entries.every((e) => e.status === 'saved');
    if (allSaved && imported.source?.kind === 'draft' && imported.source.batchId) {
      try {
        await closeAccountingBatch(imported.source.batchId, { version: imported.source.version });
        notice = t('tx.imp.draftClosed', { no: imported.source.batchNo || imported.source.batchId });
        noticeTone = 'ok';
      } catch (e) {
        notice = t('tx.imp.draftCloseFail', { msg: e?.message || '' });
        noticeTone = 'error';
      }
    }
    setImported({ ...imported, entries, notice, noticeTone });
  }, [activeSeed, imported, handlePosted, t]);

  const seedFor = (tab) => (activeSeed && activeSeed.tab === tab ? activeSeed.seed : null);
  const registerName = useCallback(
    (id) => (id ? cashBankAccounts.find((c) => String(c.id) === String(id))?.name || '' : ''),
    [cashBankAccounts],
  );
  const branchName = useCallback(
    (id) => (id ? branches.find((b) => String(b.id) === String(id))?.name || '' : ''),
    [branches],
  );

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
              onPosted={handleFormPosted('Payments')}
              editRow={editTxn}
              onCancelEdit={clearEdit}
              seed={seedFor('Payments')}
              initialRowCount={payRowsStart}
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
              onPosted={handleFormPosted('Receipts')}
              editRow={editTxn}
              onCancelEdit={clearEdit}
              seed={seedFor('Receipts')}
              initialRowCount={payRowsStart}
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
              onPosted={handleFormPosted('Journal')}
              editEntry={editJournal}
              onCancelEdit={clearEdit}
              seed={seedFor('Journal')}
              initialRowCount={jeRowsStart}
            />
          )}
        </AcctCard>
      ) : null}
    </>
  );

  return (
    <div className="module-container" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {batchMode ? (
        <header style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }} data-testid="tx-batch-header">
          <div style={{ minWidth: 0 }}>
            <p className="form-help-text" style={{ marginBottom: 4 }}>
              <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
              {' / '}
              <Link to="/workshop/accounting/transactions">{t('tx.crumb.transactions')}</Link>
              {' / '}
              <Link to={bulkRoutes.batches}>{t('bb.crumb.batches')}</Link>
              {' / '}
              <span>
                {batchDraftId
                  ? imported?.source?.batchNo || `#${batchDraftId}`
                  : mode === 'import'
                    ? t('tx.batch.crumbImport')
                    : t('tx.batch.crumbNew')}
              </span>
            </p>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
              {batchDraftId
                ? t('tx.batch.titleDraft', { no: imported?.source?.batchNo || `#${batchDraftId}` })
                : mode === 'import'
                  ? t('tx.batch.titleImport')
                  : t('tx.batch.titleNew')}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B', maxWidth: 900, lineHeight: 1.5 }}>
              {t('tx.batch.sub')}
            </p>
          </div>
          <Link to={bulkRoutes.batches} className="btn-portal-outline" style={{ textDecoration: 'none' }}>
            {t('tx.batch.back')}
          </Link>
        </header>
      ) : (
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
      )}

      {batchMode ? (
        <TxImportPanel
          t={t}
          imported={imported}
          activeKey={activeSeed?.entryKey || null}
          busy={importBusy || loading}
          batchesRoute={null}
          dropzone
          highlight={mode === 'import' && !imported}
          onFile={handleImportFile}
          onOpen={openEntry}
          onClear={() => {
            setImported(null);
            setActiveSeed(null);
          }}
          registerName={registerName}
          branchName={branchName}
        />
      ) : (
        <section className="acct-panel tx-many-card" data-testid="tx-many-card">
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>{t('tx.bulk.needMany')}</strong>
            <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.45 }}>{t('tx.bulk.blurb')}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Link to={bulkRoutes.newMany} className="btn-submit btn-dark" style={{ textDecoration: 'none' }} data-testid="tx-new-many">
              {t('tx.bulk.newMany')}
            </Link>
            <Link to={bulkRoutes.importCsv} className="btn-portal-outline" style={{ textDecoration: 'none' }}>
              {t('tx.bulk.import')}
            </Link>
            <Link to={bulkRoutes.batches} className="btn-portal-outline" style={{ textDecoration: 'none' }}>
              {t('tx.bulk.batches')}
            </Link>
          </div>
        </section>
      )}

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
          // Imported groups: give the form the full width (all columns visible); Recent goes below.
          gridTemplateColumns: batchMode ? 'minmax(0, 1fr)' : 'minmax(0, 1.4fr) minmax(280px, 0.9fr)',
          gap: 16,
          alignItems: 'start',
        }}
        className="ws-tx-entry-layout"
      >
        <div ref={formRef}>{formCard}</div>
        {batchMode ? null : (
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
        )}
      </div>

      <style>{`
        .tx-many-card {
          margin-bottom: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          background: #F8FAFC;
        }
        @media (max-width: 1100px) {
          .ws-tx-entry-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
