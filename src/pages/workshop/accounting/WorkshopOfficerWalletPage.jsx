import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import {
  getLockerCitMyWallet,
  getLockerCitOfficerWallet,
  listLockerCitHandovers,
  receiveLockerCit,
} from '../../../services/lockerCitApi';
import { getCashBankAccounts } from '../../../services/cashBankApi';
import { apiFetch } from '../../../services/api';
import {
  LOCKER_CIT_PAGE_SIZE,
  buildReceiveJournalPreview,
  buildStageBExpensesPayload,
  stageBBranchOptions,
  validateStageBExpenseLines,
  daysHeldTone,
  citResponseMatchesApplied,
  fifoSelectCollections,
  fifoToggleThroughIndex,
  formatCitMoneyLatn,
  formatCitStamp,
  lockerCitErrorI18nKey,
  mapOfficerWalletCards,
  sliceCitPage,
} from '../../../utils/lockerCitDisplay';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import { accT } from '../../../utils/accountingI18n';
import { lockerT } from '../../../utils/lockerPortalI18n';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { useAuth } from '../../../context/AuthContext';
import CollectionExpenseLineCard from '../../../components/locker/CollectionExpenseLineCard';
import SystemAccountConflictDialog from '../../../components/accounting/SystemAccountConflictDialog';
import {
  canResolveSystemAccountConflict,
  handleSystemAccountConflict,
} from '../../../utils/systemAccountConflict';
import { recordCollectionPayloadWithinLimit } from '../../../pages/locker/recordCollectionLimits';
import { stageAExpenseLineErrors } from '../../../pages/locker/recordCollectionHelpers';
import useCollectionExpenseMeta from '../../../components/locker/useCollectionExpenseMeta';

const cardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 12,
  marginBottom: 16,
};

const panelStyle = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: 16,
};

const confirmBar = {
  background: '#FEF3C7',
  border: '1px solid #F59E0B',
  borderRadius: 8,
  padding: 12,
  marginTop: 12,
};

function toneColor(tone) {
  if (tone === 'bad') return '#DC2626';
  if (tone === 'warn') return '#D97706';
  if (tone === 'ok') return '#16A34A';
  return '#0F172A';
}

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `cit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function newStageBLine(branchId) {
  return {
    key: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expenseAccountId: '',
    gross: '',
    vat: '',
    amount: '',
    amountMode: 'inc',
    supplierVatNumber: '',
    billNo: '',
    proofUrl: '',
    proofPreview: null,
    proofName: '',
    note: '',
    branchId: branchId || '',
  };
}

function StatCard({ label, value, tone = 'neutral' }) {
  if (value == null || value === '') return null;
  return (
    <div className="cash-bank-stat-card" style={{ padding: 14 }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: toneColor(tone), marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

/**
 * Mockup 32 — Officer wallet + Receive & deposit inline panel.
 * Routes: /workshop/accounting/locker-cash-in-transit/officers/:id
 *         /locker/officers/:id/wallet · /locker/my-wallet
 */
export default function WorkshopOfficerWalletPage({
  locale: localeProp,
  officerId: officerIdProp,
  myWallet = false,
  readOnly = false,
  backPath = '/workshop/accounting/locker-cash-in-transit',
  branches = [],
}) {
  const outletCtx = useOutletContext() || {};
  const params = useParams();
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const canWriteCoa = canResolveSystemAccountConflict({ hasPermission, user });

  const officerId =
    officerIdProp ||
    params.officerId ||
    params.id ||
    null;

  const canReceive =
    !readOnly &&
    !myWallet &&
    (hasPermission('workshop.locker-management.cash-in-transit.receive') ||
      hasPermission('workshop.locker-management.view') ||
      hasPermission('workshop.locker-management.bank-deposits.create'));

  const [tab, setTab] = useState('open');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [handovers, setHandovers] = useState([]);
  const [handoverTotal, setHandoverTotal] = useState(0);
  const [handoverOffset, setHandoverOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [destination, setDestination] = useState('vault');
  const [bankAccountId, setBankAccountId] = useState('');
  const [bankDisplay, setBankDisplay] = useState('');
  const [bankOptions, setBankOptions] = useState([]);
  const [slipNo, setSlipNo] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [countedAmount, setCountedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey());
  const [openPage, setOpenPage] = useState(1);
  const [postError, setPostError] = useState(null);
  const [fromYmd, setFromYmd] = useState(() => toRiyadhDateISO(new Date()));
  const [toYmd, setToYmd] = useState(() => toRiyadhDateISO(new Date()));
  const [rangeGeneration, setRangeGeneration] = useState(() => `cit-${Date.now()}`);
  // Stage B "received with expenses" (E2–E5): receiver only, vault only.
  const [receiveMode, setReceiveMode] = useState('cash_only');
  const [expenseLines, setExpenseLines] = useState([]);
  const [conflictPayload, setConflictPayload] = useState(null);
  const [showLineErrors, setShowLineErrors] = useState(false);
  const expenseMeta = useCollectionExpenseMeta();
  /** Shared expense-line card uses the locker portal 'record.expense.*' keys. */
  const cardT = useCallback(
    (key, vars) => (String(key).startsWith('record.') ? lockerT(locale, key, vars) : accT(locale, key, vars)),
    [locale],
  );
  const receiveRetryRef = useRef(null);

  const resetPanel = useCallback(() => {
    setSelectedIds([]);
    setDestination('vault');
    setBankAccountId('');
    setBankDisplay('');
    setSlipNo('');
    setProofUrl('');
    setCountedAmount('');
    setNotes('');
    setReceiveMode('cash_only');
    setExpenseLines([]);
    setConfirmOpen(false);
    setPostError(null);
    setIdempotencyKey(newIdempotencyKey());
  }, []);

  const loadWallet = useCallback(async () => {
    const generation = rangeGeneration;
    setLoading(true);
    setError(null);
    try {
      const params = { from: fromYmd, to: toYmd, generation };
      const res = myWallet
        ? await getLockerCitMyWallet(params)
        : await getLockerCitOfficerWallet(officerId, params);
      if (
        res?.scope &&
        !citResponseMatchesApplied(res.scope, {
          from: fromYmd,
          to: toYmd,
          generation,
        })
      ) {
        return;
      }
      setWallet(res && typeof res === 'object' ? res : null);
    } catch (err) {
      const status = Number(err?.status);
      if (status === 404) setError(t('cit.error.notDeployed'));
      else if (status === 403) setError(t('cit.error.forbidden'));
      else setError(err?.message || t('cit.error.loadWallet'));
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, [myWallet, officerId, t, fromYmd, toYmd, rangeGeneration]);

  const loadHandovers = useCallback(async () => {
    const oid = myWallet
      ? user?.id
      : officerId;
    try {
      const res = await listLockerCitHandovers({
        officerUserId: oid ? String(oid) : undefined,
        offset: handoverOffset,
        limit: LOCKER_CIT_PAGE_SIZE,
      });
      setHandovers(Array.isArray(res?.items) ? res.items : []);
      setHandoverTotal(Number(res?.total) || 0);
    } catch {
      setHandovers([]);
      setHandoverTotal(0);
    }
  }, [handoverOffset, myWallet, officerId, user?.id]);

  useEffect(() => {
    void loadWallet();
    resetPanel();
  }, [loadWallet, resetPanel]);

  useEffect(() => {
    if (tab === 'history') void loadHandovers();
  }, [tab, loadHandovers]);

  useEffect(() => {
    if (!canReceive) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const rows = await getCashBankAccounts({});
        if (!cancelled) {
          setBankOptions(
            (Array.isArray(rows) ? rows : []).map((a) => ({
              id: String(a.id),
              label: a.name || a.code || String(a.id),
            })),
          );
        }
      } catch {
        if (!cancelled) setBankOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canReceive]);

  const cards = useMemo(() => mapOfficerWalletCards(wallet), [wallet]);
  const openCollections = useMemo(
    () => (Array.isArray(wallet?.openCollections) ? wallet.openCollections : []),
    [wallet],
  );
  const fifo = useMemo(
    () => fifoSelectCollections(openCollections, selectedIds),
    [openCollections, selectedIds],
  );
  const openPaged = useMemo(
    () => sliceCitPage(fifo.sorted, openPage, LOCKER_CIT_PAGE_SIZE),
    [fifo.sorted, openPage],
  );

  const collectionBranchOptions = useMemo(
    () => stageBBranchOptions(openCollections, fifo.selectedIds),
    [openCollections, fifo.selectedIds],
  );
  // Locker portal does not pass branches → load the workshop's active branches once.
  const [fetchedBranches, setFetchedBranches] = useState([]);
  const hasBranchProp = Array.isArray(branches) && branches.length > 0;
  useEffect(() => {
    if (hasBranchProp || !canReceive) return undefined;
    let cancelled = false;
    apiFetch('/locker/branches')
      .then((res) => {
        if (!cancelled) setFetchedBranches(Array.isArray(res?.branches) ? res.branches : []);
      })
      .catch(() => {
        if (!cancelled) setFetchedBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [hasBranchProp, canReceive]);
  const workshopBranches = useMemo(
    () =>
      (hasBranchProp ? branches : fetchedBranches)
        .filter((b) => b && (b.isActive !== false && b.active !== false))
        .map((b) => ({
          id: String(b.id),
          name: b.name || String(b.id),
        })),
    [hasBranchProp, branches, fetchedBranches],
  );
  const branchOptions =
    workshopBranches.length > 0 ? workshopBranches : collectionBranchOptions;
  const defaultExpenseBranchId =
    collectionBranchOptions[0]?.id || branchOptions[0]?.id || '';
  const clearingAccount = wallet?.clearingAccount || null;
  const isLockerCollector = String(user?.lockerPortalRole || '').toLowerCase() === 'collector';
  const canAddStageBExpenses = canReceive && !isLockerCollector && destination === 'vault';
  const activeExpenseLines = useMemo(
    () => (canAddStageBExpenses && receiveMode === 'with_expenses' ? expenseLines : []),
    [canAddStageBExpenses, receiveMode, expenseLines],
  );
  const updateExpenseLine = (idx, patch) => {
    setExpenseLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    setConfirmOpen(false);
  };

  const preview = useMemo(
    () =>
      buildReceiveJournalPreview({
        destination,
        countedAmount: countedAmount === '' ? 0 : Number(countedAmount),
        expectedAmount: fifo.expectedAmount,
        officerCode: cards.accountCode || '1005-O',
        officerName: cards.officerName || '',
        bankLabel: bankOptions.find((b) => b.id === bankAccountId)?.label || 'Bank',
        clearingCode: clearingAccount?.code || null,
        clearingName: clearingAccount?.name || null,
        clearingPendingLabel: t('cit.receive.exp.clearingPending'),
        expenses: activeExpenseLines.map((l) => ({
          gross: l.gross,
          label: l.note || '',
          branchLabel:
            branchOptions.find((b) => String(b.id) === String(l.branchId))?.label ||
            branchOptions.find((b) => String(b.id) === String(l.branchId))?.name ||
            '',
        })),
      }),
    [
      destination,
      countedAmount,
      fifo.expectedAmount,
      cards.accountCode,
      cards.officerName,
      bankOptions,
      bankAccountId,
      activeExpenseLines,
      branchOptions,
      clearingAccount,
      t,
    ],
  );
  const difference = preview.difference;
  const onToggleRow = (indexInSorted) => {
    const next = fifoToggleThroughIndex(openCollections, indexInSorted);
    setSelectedIds(next);
    setConfirmOpen(false);
    setPostError(null);
  };

  const tryReceive = () => {
    setPostError(null);
    if (!fifo.fifoValid || fifo.selectedIds.length === 0) {
      setPostError(t('cit.receive.errFifo'));
      return;
    }
    const counted = Number(countedAmount);
    if (!Number.isFinite(counted) || counted < 0) {
      setPostError(t('cit.receive.errCounted'));
      return;
    }
    if (activeExpenseLines.length > 0 || (canAddStageBExpenses && receiveMode === 'with_expenses')) {
      const v = validateStageBExpenseLines(activeExpenseLines, expenseMeta.vatPercent);
      if (!v.ok) {
        setShowLineErrors(true);
        setPostError(t(v.errorKey, { n: String(v.index + 1) }));
        return;
      }
      // Receipts travel as data URLs — keep the request under the API JSON body limit.
      if (!recordCollectionPayloadWithinLimit({ proofUrl, expenses: activeExpenseLines })) {
        setPostError(t('cit.receive.exp.errPayload'));
        return;
      }
    }
    if (preview.aboveExpected) {
      setPostError(t('cit.receive.exp.errAbove'));
      return;
    }
    if (destination === 'bank') {
      if (!bankAccountId) {
        setPostError(t('cit.receive.errBank'));
        return;
      }
      if (!String(slipNo || '').trim()) {
        setPostError(t('cit.receive.errSlip'));
        return;
      }
    }
    setConfirmOpen(true);
  };

  const doReceive = async () => {
    if (posting) return;
    setPosting(true);
    setPostError(null);
    try {
      const res = await receiveLockerCit({
        officerUserId: String(officerId || wallet?.officer?.id || ''),
        destination,
        countedAmount: Number(countedAmount),
        expectedAmount: fifo.expectedAmount,
        collectionIds: fifo.selectedIds,
        cashBankAccountId: destination === 'bank' ? bankAccountId : undefined,
        slipNo: destination === 'bank' ? String(slipNo).trim() : undefined,
        proofUrl: proofUrl || undefined,
        notes: notes || undefined,
        idempotencyKey,
        ...(activeExpenseLines.length > 0
          ? { expenses: buildStageBExpensesPayload(activeExpenseLines) }
          : {}),
      });
      if (res?.success === false) {
        throw new Error(res?.message || t('cit.receive.errPost'));
      }
      resetPanel();
      await loadWallet();
      if (tab === 'history') await loadHandovers();
    } catch (err) {
      if (handleSystemAccountConflict(err, { onConflict: (p) => setConflictPayload(p) })) {
        // Retry with the SAME idempotency key once the code conflict is resolved.
        receiveRetryRef.current = () => void doReceive();
        setConfirmOpen(false);
        return;
      }
      const mapped = lockerCitErrorI18nKey(err);
      setPostError(mapped ? t(mapped) : err?.message || t('cit.receive.errPost'));
      setConfirmOpen(false);
    } finally {
      setPosting(false);
    }
  };

  const officerTitle = cards.officerName || t('cit.emdash');

  return (
    <div className="locker-cit-wallet" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 8 }}>
        <Link to={backPath}>{t('cit.nav.lockerCit')}</Link>
        {' / '}
        {t('cit.nav.officers')}
        {officerId ? ` / ${officerId}` : ''}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <h2 className="ws-page-title" style={{ margin: 0 }}>
          {t('cit.wallet.title', { name: officerTitle })}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '0.75rem', color: '#64748B' }}>
            {t('cit.filter.from')}
            <input
              type="date"
              value={fromYmd}
              onChange={(e) => {
                setFromYmd(e.target.value);
                setRangeGeneration(`cit-${Date.now()}`);
              }}
              style={{ marginInlineStart: 6, height: 32 }}
            />
          </label>
          <label style={{ fontSize: '0.75rem', color: '#64748B' }}>
            {t('cit.filter.to')}
            <input
              type="date"
              value={toYmd}
              onChange={(e) => {
                setToYmd(e.target.value);
                setRangeGeneration(`cit-${Date.now()}`);
              }}
              style={{ marginInlineStart: 6, height: 32 }}
            />
          </label>
          <button
            type="button"
            className="btn-portal-outline"
            onClick={() => void loadWallet()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" style={{ marginBottom: 12, color: '#B91C1C' }}>
          {error}{' '}
          <button type="button" className="btn-portal-outline" onClick={() => void loadWallet()}>
            {t('cit.btn.retry')}
          </button>
        </div>
      ) : null}

      <div style={cardGrid}>
        <StatCard label={t('cit.wallet.card.officer')} value={cards.officerName} />
        <StatCard
          label={t('cit.wallet.card.balance', { code: cards.accountCode || '1005-O' })}
          value={
            cards.balance != null ? `SAR ${formatCitMoneyLatn(cards.balance)}` : null
          }
        />
        <StatCard label={t('cit.wallet.card.open')} value={String(cards.openCount)} />
        <StatCard
          label={t('cit.wallet.card.oldest')}
          value={
            cards.oldestDays != null
              ? t('cit.days', { n: String(cards.oldestDays) })
              : null
          }
          tone={daysHeldTone(cards.oldestDays)}
        />
        <StatCard
          label={t('cit.wallet.card.handoversMonth')}
          value={String(cards.handoversThisMonth)}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { id: 'open', label: t('cit.wallet.tab.open') },
          { id: 'history', label: t('cit.wallet.tab.history') },
          { id: 'statement', label: t('cit.wallet.tab.statement') },
        ].map((x) => (
          <button
            key={x.id}
            type="button"
            className={tab === x.id ? 'btn-submit btn-dark' : 'btn-portal-outline'}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            canReceive && tab === 'open' ? 'minmax(0, 1fr) minmax(440px, 560px)' : '1fr',
          minWidth: 0,
          gap: 16,
          alignItems: 'start',
        }}
        className="locker-cit-wallet__grid"
      >
        <div style={panelStyle}>
          {loading && !wallet ? <p>{t('cit.loading')}</p> : null}

          {tab === 'open' ? (
            <>
              {openCollections.length === 0 && !loading ? (
                <p style={{ color: '#94A3B8' }}>{t('cit.wallet.emptyOpen')}</p>
              ) : (
                <>
                  <WsTableScroll>
                    <table className="ws-table">
                      <thead>
                        <tr>
                          {canReceive ? <th className="table-th" /> : null}
                          <th className="table-th">{t('cit.wallet.col.collected')}</th>
                          <th className="table-th">{t('cit.wallet.col.ref')}</th>
                          <th className="table-th">{t('cit.wallet.col.branch')}</th>
                          <th className="table-th" style={{ textAlign: 'end' }}>
                            {t('cit.wallet.col.expected')}
                          </th>
                          <th className="table-th" style={{ textAlign: 'end' }}>
                            {t('cit.wallet.col.received')}
                          </th>
                          <th className="table-th">{t('cit.wallet.col.days')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openPaged.rows.map((row) => {
                          const sortedIdx = fifo.sorted.findIndex(
                            (r) => String(r.id) === String(row.id),
                          );
                          const checked = selectedIds.includes(String(row.id));
                          const amt = row.amount ?? row.receivedAmount;
                          const expected = row.expectedAmount;
                          const pendingDiff =
                            expected != null &&
                            amt != null &&
                            Number(expected) !== Number(amt)
                              ? Number(amt) - Number(expected)
                              : null;
                          return (
                            <tr key={row.id}>
                              {canReceive ? (
                                <td className="table-cell">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => onToggleRow(sortedIdx)}
                                    aria-label={t('cit.wallet.selectRow')}
                                  />
                                </td>
                              ) : null}
                              <td className="table-cell">
                                {formatCitStamp(row.collectedAt, true)}
                              </td>
                              <td className="table-cell">{row.referenceCode || t('cit.emdash')}</td>
                              <td className="table-cell">
                                {[row.cashierName, row.branchName].filter(Boolean).join(' · ') ||
                                  t('cit.emdash')}
                              </td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>
                                {expected != null
                                  ? formatCitMoneyLatn(expected)
                                  : t('cit.emdash')}
                              </td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>
                                {formatCitMoneyLatn(amt)}
                                {pendingDiff != null && pendingDiff !== 0 ? (
                                  <span style={{ color: '#DC2626', marginInlineStart: 6 }}>
                                    {formatCitMoneyLatn(pendingDiff)} {t('cit.wallet.pending')}
                                  </span>
                                ) : null}
                              </td>
                              <td
                                className="table-cell"
                                style={{
                                  color: toneColor(daysHeldTone(row.daysHeld)),
                                  fontWeight: 600,
                                }}
                              >
                                {row.daysHeld != null ? String(row.daysHeld) : t('cit.emdash')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </WsTableScroll>
                  <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#64748B' }}>
                    {t('cit.showing', {
                      a: String(openPaged.from),
                      b: String(openPaged.to),
                      n: String(openPaged.total),
                    })}
                  </div>
                  <PaginationControls
                    total={openPaged.total}
                    limit={LOCKER_CIT_PAGE_SIZE}
                    offset={(openPaged.page - 1) * LOCKER_CIT_PAGE_SIZE}
                    onPageChange={(nextOffset) =>
                      setOpenPage(Math.floor(nextOffset / LOCKER_CIT_PAGE_SIZE) + 1)
                    }
                  />
                </>
              )}
            </>
          ) : null}

          {tab === 'history' ? (
            <>
              {handovers.length === 0 ? (
                <p style={{ color: '#94A3B8' }}>{t('cit.wallet.emptyHistory')}</p>
              ) : (
                <>
                  <WsTableScroll>
                    <table className="ws-table">
                      <thead>
                        <tr>
                          <th className="table-th">{t('cit.wallet.col.when')}</th>
                          <th className="table-th">{t('cit.wallet.col.dest')}</th>
                          <th className="table-th" style={{ textAlign: 'end' }}>
                            {t('cit.wallet.col.expected')}
                          </th>
                          <th className="table-th" style={{ textAlign: 'end' }}>
                            {t('cit.wallet.col.counted')}
                          </th>
                          <th className="table-th">{t('cit.wallet.col.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {handovers.map((h) => (
                          <tr key={h.id}>
                            <td className="table-cell">
                              {formatCitStamp(h.receivedAt, true)}
                            </td>
                            <td className="table-cell">{h.destination || t('cit.emdash')}</td>
                            <td className="table-cell" style={{ textAlign: 'end' }}>
                              {formatCitMoneyLatn(h.expectedAmount)}
                            </td>
                            <td className="table-cell" style={{ textAlign: 'end' }}>
                              {formatCitMoneyLatn(h.countedAmount)}
                            </td>
                            <td className="table-cell">{h.status || t('cit.emdash')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </WsTableScroll>
                  <PaginationControls
                    total={handoverTotal}
                    limit={LOCKER_CIT_PAGE_SIZE}
                    offset={handoverOffset}
                    onPageChange={setHandoverOffset}
                  />
                </>
              )}
            </>
          ) : null}

          {tab === 'statement' ? (
            <p style={{ color: '#94A3B8' }}>{t('cit.wallet.statementNeedsBackend')}</p>
          ) : null}
        </div>

        {canReceive && tab === 'open' ? (
          <aside style={{ ...panelStyle, minWidth: 0 }} data-testid="cit-receive-panel">
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>
              {t('cit.receive.title')}
            </h3>

            <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
              <legend style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                {t('cit.receive.destination')}
              </legend>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input
                  type="radio"
                  name="cit-dest"
                  checked={destination === 'vault'}
                  onChange={() => setDestination('vault')}
                />
                {t('cit.receive.destVault')}
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="radio"
                  name="cit-dest"
                  checked={destination === 'bank'}
                  onChange={() => setDestination('bank')}
                />
                {t('cit.receive.destBank')}
              </label>
            </fieldset>

            {destination === 'bank' ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>
                  {t('cit.receive.bank')}
                </label>
                <SearchableEntityCombobox
                  options={bankOptions}
                  value={bankAccountId}
                  displayText={bankDisplay}
                  onDisplayTextChange={setBankDisplay}
                  onSelect={(opt) => {
                    setBankAccountId(opt?.id ? String(opt.id) : '');
                    setBankDisplay('');
                  }}
                  placeholder={t('cit.receive.bankPh')}
                  entityLabel="bank"
                  maxInitial={80}
                  maxFiltered={120}
                />
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, margin: '10px 0 4px' }}>
                  {t('cit.receive.slip')}
                </label>
                <input
                  type="text"
                  value={slipNo}
                  onChange={(e) => setSlipNo(e.target.value)}
                  style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 10px' }}
                />
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, margin: '10px 0 4px' }}>
                  {t('cit.receive.photoUrl')}
                </label>
                <input
                  type="text"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 10px' }}
                />
              </div>
            ) : null}

            <p style={{ fontSize: '0.85rem', color: '#475569' }}>
              {t('cit.receive.selected', {
                n: String(fifo.selectedIds.length),
                amount: formatCitMoneyLatn(fifo.expectedAmount) || '0.00',
              })}
            </p>

            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>
              {t('cit.receive.counted')}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={countedAmount}
              onChange={(e) => {
                setCountedAmount(e.target.value);
                setConfirmOpen(false);
              }}
              style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 10px', marginBottom: 12 }}
            />

            {canAddStageBExpenses ? (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>
                  {t('cit.receive.exp.mode')}
                </div>
                <label style={{ marginInlineEnd: 16, fontSize: '0.85rem' }}>
                  <input
                    type="radio"
                    name="stageBMode"
                    checked={receiveMode === 'cash_only'}
                    onChange={() => {
                      if (expenseLines.some((l) => l.gross) && !window.confirm(t('cit.receive.exp.clearConfirm'))) return;
                      setReceiveMode('cash_only');
                      setExpenseLines([]);
                      setConfirmOpen(false);
                    }}
                  />{' '}
                  {t('cit.receive.exp.cashOnly')}
                </label>
                <label style={{ fontSize: '0.85rem' }}>
                  <input
                    type="radio"
                    name="stageBMode"
                    checked={receiveMode === 'with_expenses'}
                    onChange={() => {
                      setReceiveMode('with_expenses');
                      if (expenseLines.length === 0)
                        setExpenseLines([newStageBLine(defaultExpenseBranchId)]);
                      setConfirmOpen(false);
                    }}
                  />{' '}
                  {t('cit.receive.exp.withExpenses')}
                </label>
                {receiveMode === 'with_expenses' ? (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0 0 6px' }}>
                      {t('cit.receive.exp.hint')}
                    </p>
                    {expenseLines.map((ln, idx) => (
                      <CollectionExpenseLineCard
                        key={ln.key}
                        line={ln}
                        index={idx}
                        t={cardT}
                        locale={locale}
                        branches={branchOptions}
                        disabled={posting}
                        idPrefix="cit-exp"
                        errors={stageAExpenseLineErrors(ln, locale, expenseMeta.vatPercent)}
                        touched={showLineErrors ? { gross: true, expenseAccountId: true } : {}}
                        canRemove
                        onPatch={(patch) => updateExpenseLine(idx, patch)}
                        onProofError={(msg) => setPostError(msg || null)}
                        onRemove={() => {
                          setExpenseLines((prev) => prev.filter((_, i) => i !== idx));
                          setConfirmOpen(false);
                        }}
                      />
                    ))}
                    {expenseLines.length < 10 ? (
                      <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => setExpenseLines((prev) => [...prev, newStageBLine(defaultExpenseBranchId)])}
                      >
                        {t('cit.receive.exp.add')}
                      </button>
                    ) : null}
                    <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: 6 }}>
                      {t('cit.receive.exp.total', { amount: formatCitMoneyLatn(preview.expensesTotal) || '0.00' })}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {preview.aboveExpected ? (
              <div role="alert" style={{ color: '#B91C1C', fontSize: '0.8rem', marginBottom: 8 }}>
                {t('cit.receive.exp.errAbove')}
              </div>
            ) : null}

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                {t('cit.receive.difference')}
              </div>
              <div
                style={{
                  fontWeight: 700,
                  color: difference < 0 ? '#DC2626' : difference > 0 ? '#16A34A' : '#0F172A',
                }}
              >
                {formatCitMoneyLatn(difference)}
              </div>
              {difference < 0 ? (
                <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4 }}>
                  {t('cit.receive.shortageHint', { code: cards.accountCode || '1005-O' })}
                </p>
              ) : null}
            </div>

            <div className="cit-receive-preview" data-testid="cit-receive-preview" style={{ width: '100%', minWidth: 0 }}>
              <table className="ws-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <colgroup>
                  <col />
                  <col style={{ width: 104 }} />
                  <col style={{ width: 104 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="table-th" style={{ textAlign: 'start' }}>{t('cit.receive.col.account')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('cit.receive.col.dr')}
                    </th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('cit.receive.col.cr')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((line, i) => (
                    <tr key={i}>
                      <td
                        className="table-cell"
                        style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'start' }}
                      >
                        {line.account}
                        {line.branchLabel ? ` · ${line.branchLabel}` : ''}
                        {line.pending ? ` (${t('cit.receive.exp.pendingTag')})` : ''}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                        <span dir="ltr">{line.dr != null ? formatCitMoneyLatn(line.dr) : ''}</span>
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                        <span dir="ltr">{line.cr != null ? formatCitMoneyLatn(line.cr) : ''}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.balanced ? (
              <p style={{ fontSize: '0.8rem', color: '#16A34A' }}>{t('cit.receive.balanced')}</p>
            ) : null}

            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, margin: '12px 0 4px' }}>
              {t('cit.receive.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ width: '100%', borderRadius: 8, border: '1px solid #CBD5E1', padding: 8 }}
            />

            {postError ? (
              <div role="alert" style={{ color: '#B91C1C', marginTop: 8 }}>
                {postError}
              </div>
            ) : null}
            {fifo.selectedIds.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#B45309', marginTop: 8 }}>
                {t('cit.receive.needIds')}
              </p>
            ) : null}

            {!confirmOpen ? (
              <button
                type="button"
                className="btn-submit btn-dark"
                style={{ marginTop: 12 }}
                onClick={tryReceive}
                disabled={posting || !fifo.fifoValid || fifo.selectedIds.length === 0}
              >
                {t('cit.receive.btnPrepare')}
              </button>
            ) : (
              <div style={confirmBar} role="group" aria-label={t('cit.receive.confirmGroup')}>
                <p style={{ margin: '0 0 8px', fontSize: '0.875rem' }}>
                  {t('cit.receive.confirm', {
                    amount: formatCitMoneyLatn(countedAmount),
                    name: officerTitle,
                  })}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={() => setConfirmOpen(false)}
                    disabled={posting}
                  >
                    {t('cit.receive.cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn-submit btn-dark"
                    onClick={() => void doReceive()}
                    disabled={posting}
                  >
                    {t('cit.receive.yes')}
                  </button>
                </div>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      <p style={{ marginTop: 16 }}>
        <button type="button" className="btn-portal-outline" onClick={() => navigate(backPath)}>
          {t('cit.btn.back')}
        </button>
      </p>

      <SystemAccountConflictDialog
        open={Boolean(conflictPayload)}
        conflict={conflictPayload}
        locale={locale}
        canWriteCoa={canWriteCoa}
        onClose={() => {
          setConflictPayload(null);
          receiveRetryRef.current = null;
        }}
        onResolved={() => {
          const retry = receiveRetryRef.current;
          receiveRetryRef.current = null;
          setConflictPayload(null);
          retry?.();
        }}
      />

      <style>{`
        @media (max-width: 1279px) {
          .locker-cit-wallet__grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
