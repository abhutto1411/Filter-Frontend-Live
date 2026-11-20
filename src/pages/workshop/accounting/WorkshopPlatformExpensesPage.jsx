import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { accT } from '../../../utils/accountingI18n';
import { useAuth } from '../../../context/AuthContext';
import { useAccountingWorkshopScope } from '../../../context/AccountingWorkshopScopeContext';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { listCashBankAccounts } from '../../../services/workshopAccountingApi';
import {
  createIntercompanySettlement,
  createPlatformExpense,
  getIntercompanyReport,
  lookupPlatformExpenseAccounts,
} from '../../../services/platformExpensesApi';
import {
  buildIcReportQuery,
  emptyIcReportFilters,
  formatSarLatn,
  mapIcSummaryRows,
  newIdempotencyKey,
  previewBookLines,
  validateSettlementAmount,
} from '../../../utils/platformExpensesDisplay';
import '../../../styles/admin/AccountingPage.css';

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function WorkshopPlatformExpensesPage({
  branches = [],
  selectedBranchId = 'all',
  locale: localeProp,
}) {
  const { hasPermission, user } = useAuth();
  const scope = useAccountingWorkshopScope() || {};
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('portal-locale')
      : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const isHq =
    Boolean(scope.hqBooks) ||
    user?.userType === 'platform_admin' ||
    Boolean(user?.workshop?.isPlatformHq);
  const canPost =
    hasPermission('workshop.accounting.expenses.create') ||
    hasPermission('workshop.accounting.journal-entries.create') ||
    hasPermission('workshop.accounting.transactions.create') ||
    hasPermission('workshop.accounting.expenses.view');
  const canSettle =
    hasPermission('workshop.accounting.journal-entries.approve') ||
    hasPermission('workshop.accounting.journal-entries.create') ||
    hasPermission('workshop.accounting.transactions.view');

  const [tab, setTab] = useState('new'); // new | report — mobile focus; both visible on wide

  // --- New expense form ---
  const [purposeId, setPurposeId] = useState('');
  const [purposeLabel, setPurposeLabel] = useState('');
  const [purposeOpts, setPurposeOpts] = useState([]);
  const [amount, setAmount] = useState('');
  const [paidFromId, setPaidFromId] = useState('');
  const [paidFromLabel, setPaidFromLabel] = useState('');
  const [cashOpts, setCashOpts] = useState([]);
  const [branchId, setBranchId] = useState(
    selectedBranchId !== 'all' ? String(selectedBranchId) : '',
  );
  const [expenseDate, setExpenseDate] = useState(todayYmd());
  const [description, setDescription] = useState('');
  const [confirmPost, setConfirmPost] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState('');
  const [postInfo, setPostInfo] = useState(null);
  const idemRef = useRef(newIdempotencyKey());

  // --- Report ---
  const [draft, setDraft] = useState(() => emptyIcReportFilters());
  const [applied, setApplied] = useState(() => emptyIcReportFilters());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [reportErr, setReportErr] = useState('');
  const [summaryRows, setSummaryRows] = useState([]);
  const [total, setTotal] = useState(0);

  // --- Inline settle ---
  const [settleRow, setSettleRow] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [hqCashId, setHqCashId] = useState('');
  const [hqCashLabel, setHqCashLabel] = useState('');
  const [wsCashId, setWsCashId] = useState('');
  const [wsCashLabel, setWsCashLabel] = useState('');
  const [settleBusy, setSettleBusy] = useState(false);
  const [settleErr, setSettleErr] = useState('');
  const [settleInfo, setSettleInfo] = useState('');
  const settleIdem = useRef(newIdempotencyKey());

  const loadLookups = useCallback(async () => {
    try {
      const [purposes, cash] = await Promise.all([
        lookupPlatformExpenseAccounts({ search: '' }),
        listCashBankAccounts({ excludeCashierTills: '1' }),
      ]);
      const pItems = Array.isArray(purposes?.items)
        ? purposes.items
        : Array.isArray(purposes)
          ? purposes
          : [];
      setPurposeOpts(
        pItems.map((p) => ({
          id: String(p.id),
          name: p.name || p.code || String(p.id),
          label: p.name || p.code || String(p.id),
        })),
      );
      const cItems = Array.isArray(cash?.items)
        ? cash.items
        : Array.isArray(cash)
          ? cash
          : Array.isArray(cash?.accounts)
            ? cash.accounts
            : [];
      setCashOpts(
        cItems.map((c) => ({
          id: String(c.id),
          name: c.name || c.label || String(c.id),
          label: c.name || c.label || String(c.id),
        })),
      );
    } catch {
      setPurposeOpts([]);
      setCashOpts([]);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setReportErr('');
    try {
      const res = await getIntercompanyReport(
        buildIcReportQuery(applied, page),
      );
      setSummaryRows(mapIcSummaryRows(res?.summary));
      setTotal(
        Number(res?.total) ||
          (Array.isArray(res?.summary) ? res.summary.length : 0),
      );
    } catch (e) {
      setSummaryRows([]);
      setTotal(0);
      setReportErr(e?.message || t('pe.err.report'));
    } finally {
      setLoading(false);
    }
  }, [applied, page, t]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const preview = useMemo(
    () =>
      previewBookLines({
        amount,
        paidFromLabel: paidFromLabel || t('pe.preview.register'),
        workshopLabel: t('pe.preview.thisWorkshop'),
      }),
    [amount, paidFromLabel, t],
  );

  async function onSavePost() {
    if (!canPost || !purposeId || !paidFromId || !amount) {
      setPostErr(t('pe.err.required'));
      return;
    }
    if (!confirmPost) {
      setConfirmPost(true);
      return;
    }
    setPosting(true);
    setPostErr('');
    setPostInfo(null);
    try {
      const res = await createPlatformExpense({
        date: expenseDate,
        amount: String(amount).replace(/,/g, ''),
        globalExpenseAccountId: purposeId,
        paidFromCashBankAccountId: paidFromId,
        branchId: branchId || undefined,
        description: description || undefined,
        idempotencyKey: idemRef.current,
      });
      setPostInfo(res);
      setConfirmPost(false);
      idemRef.current = newIdempotencyKey();
      setAmount('');
      await loadReport();
    } catch (e) {
      setPostErr(e?.message || t('pe.err.post'));
    } finally {
      setPosting(false);
    }
  }

  function openSettle(row) {
    setSettleRow(row);
    setSettleAmount(row.balance || '');
    setSettleErr('');
    setSettleInfo('');
    settleIdem.current = newIdempotencyKey();
    setTab('report');
  }

  async function onPostSettlement() {
    if (!canSettle || !settleRow) return;
    const v = validateSettlementAmount(settleAmount, settleRow.balance);
    if (!v.ok) {
      setSettleErr(
        v.code === 'SETTLEMENT_EXCEEDS_BALANCE'
          ? t('pe.err.exceeds')
          : t('pe.err.amount'),
      );
      return;
    }
    if (!hqCashId || !wsCashId) {
      setSettleErr(t('pe.err.viaRequired'));
      return;
    }
    setSettleBusy(true);
    setSettleErr('');
    try {
      const res = await createIntercompanySettlement({
        workshopId: settleRow.workshopId,
        date: todayYmd(),
        amount: String(settleAmount).replace(/,/g, ''),
        hqPaidFromCashBankAccountId: hqCashId,
        workshopReceivedInCashBankAccountId: wsCashId,
        idempotencyKey: settleIdem.current,
      });
      setSettleInfo(
        t('pe.info.settled', { ref: res?.ref || '' }),
      );
      setSettleRow(null);
      settleIdem.current = newIdempotencyKey();
      await loadReport();
    } catch (e) {
      const code = e?.code || e?.response?.data?.code;
      setSettleErr(
        code === 'SETTLEMENT_EXCEEDS_BALANCE'
          ? t('pe.err.exceeds')
          : e?.message || t('pe.err.settle'),
      );
    } finally {
      setSettleBusy(false);
    }
  }

  const rangeFrom = total === 0 ? 0 : (page - 1) * 25 + 1;
  const rangeTo = Math.min(page * 25, total);

  return (
    <div className="module-container platform-expenses-page" dir={dir}>
      <header style={{ marginBottom: 12 }}>
        <p className="form-help-text" style={{ marginBottom: 4 }}>
          <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
          {' / '}
          <span>{t('pe.crumb')}</span>
        </p>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
          {t('pe.title')}
        </h2>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={tab === 'new' ? 'btn-submit btn-dark' : 'btn-portal-outline'}
          onClick={() => {
            setTab('new');
            document.getElementById('pe-new-expense')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }}
        >
          {t('pe.tab.new')}
        </button>
        <button
          type="button"
          className={tab === 'report' ? 'btn-submit btn-dark' : 'btn-portal-outline'}
          onClick={() => {
            setTab('report');
            document.getElementById('pe-ic-report')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }}
        >
          {t('pe.tab.report')}
        </button>
      </div>

      <div
        className="pe-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <section
          id="pe-new-expense"
          className="acct-panel"
          style={{
            outline: tab === 'new' ? '2px solid #FCC245' : undefined,
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 16 }}>{t('pe.form.title')}</h3>

          <div className="acct-form-grid">
          <label>
            <span className="form-help-text">{t('pe.form.date')}</span>
            <input
              className="form-input"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </label>

          <label>
            <span className="form-help-text">{t('pe.form.purpose')}</span>
            <SearchableEntityCombobox
              options={purposeOpts}
              value={purposeId}
              displayText={purposeLabel}
              onDisplayTextChange={setPurposeLabel}
              onSelect={(opt) => {
                setPurposeId(opt?.id ? String(opt.id) : '');
                setPurposeLabel(opt?.name || opt?.label || '');
              }}
              placeholder={t('pe.form.purposePh')}
            />
          </label>

          <label>
            <span className="form-help-text">{t('pe.form.amount')}</span>
            <input
              className="form-input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>

          <label>
            <span className="form-help-text">{t('pe.form.paidFrom')}</span>
            <SearchableEntityCombobox
              options={cashOpts}
              value={paidFromId}
              displayText={paidFromLabel}
              onDisplayTextChange={setPaidFromLabel}
              onSelect={(opt) => {
                setPaidFromId(opt?.id ? String(opt.id) : '');
                setPaidFromLabel(opt?.name || opt?.label || '');
              }}
              placeholder={t('pe.form.paidFromPh')}
            />
          </label>

          {branches?.length ? (
            <label>
              <span className="form-help-text">{t('pe.form.branch')}</span>
              <select
                className="form-input"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">{t('pe.form.branchAll')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name || b.id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            <span className="form-help-text">{t('pe.form.description')}</span>
            <input
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          </div>

          <div
            className="acct-form-note"
            style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 8,
              padding: 10,
              marginBottom: 12,
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            <p style={{ margin: '0 0 6px' }}>{preview.workshopLine}</p>
            <p style={{ margin: 0 }}>{preview.platformLine}</p>
            <p className="form-help-text" style={{ marginTop: 8, marginBottom: 0 }}>
              {t('pe.form.hint')}
            </p>
          </div>

          {postErr ? (
            <div role="alert" style={{ color: '#B91C1C', marginBottom: 8 }}>
              {postErr}
            </div>
          ) : null}
          {postInfo ? (
            <div role="status" style={{ color: '#166534', marginBottom: 8, fontSize: 13 }}>
              {t('pe.info.posted', { ref: postInfo.ref || '' })}
              {postInfo.workshopJournalId ? (
                <span>
                  {' '}
                  · WS JE {postInfo.workshopJournalId}
                </span>
              ) : null}
              {postInfo.hqJournalId ? (
                <span>
                  {' '}
                  · HQ JE {postInfo.hqJournalId}
                </span>
              ) : null}
            </div>
          ) : null}

          {confirmPost ? (
            <div
              style={{
                background: '#FEF3C7',
                borderRadius: 8,
                padding: 10,
                marginBottom: 10,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13 }}>{t('pe.confirm.post')}</span>
              <button
                type="button"
                className="btn-portal-outline"
                disabled={posting}
                onClick={() => setConfirmPost(false)}
              >
                {t('pe.act.cancel')}
              </button>
              <button
                type="button"
                className="btn-submit btn-dark"
                disabled={posting || !canPost}
                onClick={onSavePost}
              >
                {posting ? t('pe.act.posting') : t('pe.act.confirm')}
              </button>
            </div>
          ) : canPost ? (
            <button
              type="button"
              className="btn-submit btn-dark acct-submit-full"
              disabled={posting}
              onClick={onSavePost}
            >
              {t('pe.act.savePost')}
            </button>
          ) : null}
        </section>

        <section
          id="pe-ic-report"
          className="acct-panel"
          style={{
            outline: tab === 'report' ? '2px solid #FCC245' : undefined,
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 16 }}>{t('pe.report.title')}</h3>

          <form
            className="acct-filter-bar"
            style={{
              marginBottom: 12,
            }}
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setApplied({ ...draft });
            }}
          >
            {isHq ? (
              <label style={{ minWidth: 140 }}>
                <span className="form-help-text">{t('pe.report.workshop')}</span>
                <input
                  className="form-input"
                  value={draft.workshopId}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, workshopId: e.target.value }))
                  }
                  placeholder={t('pe.report.workshopPh')}
                />
              </label>
            ) : null}
            <label>
              <span className="form-help-text">{t('pe.report.from')}</span>
              <input
                className="form-input"
                type="date"
                value={draft.from}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
              />
            </label>
            <label>
              <span className="form-help-text">{t('pe.report.to')}</span>
              <input
                className="form-input"
                type="date"
                value={draft.to}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              />
            </label>
            <button type="submit" className="btn-submit btn-dark">
              {t('pe.report.apply')}
            </button>
            <button
              type="button"
              className="btn-portal-outline"
              onClick={() => {
                const cleared = emptyIcReportFilters();
                setDraft(cleared);
                setApplied(cleared);
                setPage(1);
              }}
            >
              {t('pe.report.showAll')}
            </button>
          </form>

          {reportErr ? (
            <div role="alert" style={{ color: '#B91C1C', marginBottom: 8 }}>
              {reportErr}{' '}
              <button type="button" className="btn-portal-outline" onClick={loadReport}>
                {t('pe.retry')}
              </button>
            </div>
          ) : null}
          {settleInfo ? (
            <p role="status" style={{ color: '#166534', fontSize: 13 }}>
              {settleInfo}
            </p>
          ) : null}

          {loading ? (
            <p role="status">{t('pe.loading')}</p>
          ) : summaryRows.length === 0 ? (
            <p role="status">{t('pe.report.empty')}</p>
          ) : (
            <WsTableScroll>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th className="table-th">{t('pe.th.workshop')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('pe.th.paid')}
                    </th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('pe.th.settled')}
                    </th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('pe.th.balance')}
                    </th>
                    <th className="table-th" />
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={row.workshopId}>
                      <td className="table-cell">{row.workshopName}</td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {row.paidForHq != null
                          ? formatSarLatn(row.paidForHq)
                          : '—'}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {row.settled != null ? formatSarLatn(row.settled) : '—'}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {row.balance != null ? formatSarLatn(row.balance) : '—'}
                      </td>
                      <td className="table-cell">
                        {canSettle && row.canSettle ? (
                          <button
                            type="button"
                            className="btn-portal-outline"
                            style={{ fontSize: 12, padding: '4px 8px' }}
                            onClick={() => openSettle(row)}
                          >
                            {t('pe.act.settle')}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </WsTableScroll>
          )}

          {!loading && total > 0 ? (
            <div style={{ marginTop: 10 }}>
              <p className="form-help-text" style={{ marginBottom: 6 }}>
                {t('bb.showing', { a: rangeFrom, b: rangeTo, n: total })}
              </p>
              <PaginationControls
                total={total}
                limit={25}
                offset={(page - 1) * 25}
                loading={loading}
                onPageChange={(offset) => setPage(Math.floor(offset / 25) + 1)}
              />
            </div>
          ) : null}

          {settleRow ? (
            <div
              className="acct-panel"
              style={{
                marginTop: 14,
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
              }}
            >
              <h4 style={{ marginTop: 0, fontSize: 15 }}>
                {t('pe.settle.title', { name: settleRow.workshopName })}
              </h4>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <span className="form-help-text">{t('pe.settle.amount')}</span>
                <input
                  className="form-input"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <span className="form-help-text">{t('pe.settle.hqVia')}</span>
                <SearchableEntityCombobox
                  options={cashOpts}
                  value={hqCashId}
                  displayText={hqCashLabel}
                  onDisplayTextChange={setHqCashLabel}
                  onSelect={(opt) => {
                    setHqCashId(opt?.id ? String(opt.id) : '');
                    setHqCashLabel(opt?.name || opt?.label || '');
                  }}
                  placeholder={t('pe.settle.hqViaPh')}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <span className="form-help-text">{t('pe.settle.wsVia')}</span>
                <SearchableEntityCombobox
                  options={cashOpts}
                  value={wsCashId}
                  displayText={wsCashLabel}
                  onDisplayTextChange={setWsCashLabel}
                  onSelect={(opt) => {
                    setWsCashId(opt?.id ? String(opt.id) : '');
                    setWsCashLabel(opt?.name || opt?.label || '');
                  }}
                  placeholder={t('pe.settle.wsViaPh')}
                />
              </label>
              {settleErr ? (
                <div role="alert" style={{ color: '#B91C1C', marginBottom: 8 }}>
                  {settleErr}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-portal-outline"
                  onClick={() => setSettleRow(null)}
                >
                  {t('pe.act.cancel')}
                </button>
                <button
                  type="button"
                  className="btn-submit btn-dark"
                  disabled={settleBusy}
                  onClick={onPostSettlement}
                >
                  {settleBusy ? t('pe.act.posting') : t('pe.act.postSettle')}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
