import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Users,
  Wallet,
} from 'lucide-react';
import {
  listCashBankAccounts,
  listPettyCashReconciliation,
  listPettyCashWalletsReport,
  getPettyCashWalletStatement,
} from '../../../services/workshopAccountingApi';
import {
  approveExpenseRequest,
  listWorkshopExpenseRequests,
  rejectExpenseRequest,
} from '../../../services/employeeExpenseApi';
import {
  PETTY_CASH_WALLETS_PAGE_SIZE,
  balanceAfterFundApproval,
  clearsPayableAmount,
  filterPayFromRegisters,
  formatPayableToLabel,
  formatSarLatn,
  fundSourceForRegister,
  isNegativeClosing,
  mapPettyCashApiError,
  payFromOptionLabel,
  slicePage,
} from '../../../utils/pettyCashWalletsDisplay';
import { accT } from '../../../utils/accountingI18n';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import SearchSelect from '../../../components/SearchSelect';
import PettyCashPayFromDialog from '../../../components/workshop/PettyCashPayFromDialog';
import { useAuth } from '../../../context/AuthContext';

const fieldWrap = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 };
const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#64748B' };
const inputStyle = {
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  padding: '0 10px',
  fontSize: '0.875rem',
  background: '#fff',
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartYmd() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export default function WorkshopPettyCashWalletsPage({
  locale: localeProp,
  selectedBranchId: selectedBranchIdProp = 'all',
  branches: branchesProp = [],
}) {
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const { hasPermission } = useAuth();
  const canView = hasPermission('workshop.accounting.expenses.view');
  const canApprove =
    hasPermission('workshop.accounting.expenses.create') ||
    hasPermission('workshop.my-petty-cash.issue') ||
    hasPermission('workshop.accounting.journal-entries.create');

  const layoutBranch =
    selectedBranchIdProp || outletCtx.selectedBranchId || 'all';
  const branches = useMemo(
    () =>
      branchesProp?.length ? branchesProp : outletCtx.branches || [],
    [branchesProp, outletCtx.branches],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const tabRaw = searchParams.get('tab');
  const tab =
    tabRaw === 'recon' || tabRaw === 'funds' ? tabRaw : 'wallets';

  const [draftRole, setDraftRole] = useState(searchParams.get('role') || 'all');
  const [draftHolder, setDraftHolder] = useState(searchParams.get('holderId') || '');
  const [draftBranch, setDraftBranch] = useState(
    searchParams.get('branchId') ||
      (layoutBranch !== 'all' ? String(layoutBranch) : 'all'),
  );
  const [draftFrom, setDraftFrom] = useState(searchParams.get('from') || monthStartYmd());
  const [draftTo, setDraftTo] = useState(searchParams.get('to') || todayYmd());
  const [applied, setApplied] = useState({
    role: draftRole,
    holderId: draftHolder,
    branchId: draftBranch,
    from: draftFrom,
    to: draftTo,
  });
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statementUser, setStatementUser] = useState(null);
  const [statement, setStatement] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState('');
  const [statementPage, setStatementPage] = useState(1);

  const [reconItems, setReconItems] = useState([]);
  const [legacyPools, setLegacyPools] = useState([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState('');
  const [reconAsOf, setReconAsOf] = useState(todayYmd());
  const [reconBranch, setReconBranch] = useState(
    layoutBranch !== 'all' ? String(layoutBranch) : 'all',
  );
  const [reconPage, setReconPage] = useState(1);

  const [fundRequests, setFundRequests] = useState([]);
  const [fundsLoading, setFundsLoading] = useState(false);
  const [fundsError, setFundsError] = useState('');
  const [approveTarget, setApproveTarget] = useState(null);
  const [payFromId, setPayFromId] = useState('');
  const [payFromAccounts, setPayFromAccounts] = useState([]);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [approveMsg, setApproveMsg] = useState('');

  const setTab = (next) => {
    const p = new URLSearchParams(searchParams);
    if (next === 'wallets') p.delete('tab');
    else p.set('tab', next);
    setSearchParams(p, { replace: true });
  };

  const loadWallets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        from: applied.from,
        to: applied.to,
        page: String(page),
        pageSize: String(PETTY_CASH_WALLETS_PAGE_SIZE),
      };
      if (applied.role && applied.role !== 'all') params.role = applied.role;
      if (applied.holderId) params.holderId = applied.holderId;
      if (applied.branchId && applied.branchId !== 'all') {
        params.branchId = applied.branchId;
      }
      const res = await listPettyCashWalletsReport(params);
      setItems(Array.isArray(res?.items) ? res.items : []);
      setSummary(res?.summary || null);
      setTotal(Number(res?.total || 0));
    } catch (e) {
      const status = e?.status || e?.response?.status;
      setItems([]);
      setSummary(null);
      setTotal(0);
      setError(
        status === 404 || status === 403
          ? t('pcw.err.unavailable')
          : e?.message || t('pcw.err.load'),
      );
    } finally {
      setLoading(false);
    }
  }, [applied, page, t]);

  const loadRecon = useCallback(async () => {
    setReconLoading(true);
    setReconError('');
    try {
      const params = {
        asOf: reconAsOf,
        page: String(reconPage),
        pageSize: String(PETTY_CASH_WALLETS_PAGE_SIZE),
      };
      if (reconBranch && reconBranch !== 'all') params.branchId = reconBranch;
      const res = await listPettyCashReconciliation(params);
      setReconItems(Array.isArray(res?.items) ? res.items : []);
      setLegacyPools(Array.isArray(res?.legacyPools) ? res.legacyPools : []);
    } catch (e) {
      const status = e?.status || e?.response?.status;
      setReconItems([]);
      setLegacyPools([]);
      setReconError(
        status === 404 || status === 403
          ? t('pcw.err.unavailable')
          : e?.message || t('pcw.err.load'),
      );
    } finally {
      setReconLoading(false);
    }
  }, [reconAsOf, reconBranch, reconPage, t]);

  const loadFunds = useCallback(async () => {
    setFundsLoading(true);
    setFundsError('');
    try {
      const [reqRes, cashRes] = await Promise.all([
        listWorkshopExpenseRequests({ limit: 100, status: 'pending' }),
        listCashBankAccounts({}).catch(() => ({ accounts: [] })),
      ]);
      const all = Array.isArray(reqRes?.items) ? reqRes.items : [];
      setFundRequests(
        all.filter(
          (r) =>
            r.kind === 'fund_request' ||
            r.payToType === 'fund_replenishment',
        ),
      );
      const accounts = Array.isArray(cashRes?.accounts)
        ? cashRes.accounts
        : Array.isArray(cashRes?.items)
          ? cashRes.items
          : Array.isArray(cashRes)
            ? cashRes
            : [];
      setPayFromAccounts(filterPayFromRegisters(accounts));
    } catch (e) {
      setFundRequests([]);
      setFundsError(e?.message || t('pcw.err.load'));
    } finally {
      setFundsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (tab === 'wallets') void loadWallets();
  }, [tab, loadWallets]);

  useEffect(() => {
    if (tab === 'recon') void loadRecon();
  }, [tab, loadRecon]);

  useEffect(() => {
    if (tab === 'funds') void loadFunds();
  }, [tab, loadFunds]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setStatementUser(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openStatement = async (row) => {
    setStatementUser(row);
    setStatement(null);
    setStatementPage(1);
    setStatementLoading(true);
    setStatementError('');
    try {
      const res = await getPettyCashWalletStatement(row.userId, {
        from: applied.from,
        to: applied.to,
        page: '1',
        pageSize: String(PETTY_CASH_WALLETS_PAGE_SIZE),
      });
      setStatement(res);
    } catch (e) {
      const status = e?.status || e?.response?.status;
      setStatementError(
        status === 404 || status === 403
          ? t('pcw.err.unavailable')
          : e?.message || t('pcw.err.load'),
      );
    } finally {
      setStatementLoading(false);
    }
  };

  const applyFilters = (e) => {
    e?.preventDefault?.();
    setApplied({
      role: draftRole,
      holderId: draftHolder,
      branchId: draftBranch,
      from: draftFrom,
      to: draftTo,
    });
    setPage(1);
  };

  const showAll = () => {
    setDraftRole('all');
    setDraftHolder('');
    setDraftBranch('all');
    setDraftFrom(monthStartYmd());
    setDraftTo(todayYmd());
    setApplied({
      role: 'all',
      holderId: '',
      branchId: 'all',
      from: monthStartYmd(),
      to: todayYmd(),
    });
    setPage(1);
  };

  const holderOpts = useMemo(
    () => [
      { value: '', label: t('pcw.filter.allHolders') },
      ...items.map((r) => ({
        value: String(r.userId),
        label: r.name,
      })),
    ],
    [items, t],
  );

  const branchOpts = useMemo(
    () => [
      { value: 'all', label: t('pcw.filter.allBranches') },
      ...branches.map((b) => ({
        value: String(b.id),
        label: b.name || `#${b.id}`,
      })),
    ],
    [branches, t],
  );

  const payFromOpts = useMemo(
    () =>
      payFromAccounts.map((a) => ({
        value: String(a.id),
        label: payFromOptionLabel(a, t),
        raw: a,
      })),
    [payFromAccounts, t],
  );

  const selectedPayFrom = payFromAccounts.find(
    (a) => String(a.id) === String(payFromId),
  );

  const runApprove = async (body) => {
    if (!approveTarget) return;
    setApproveBusy(true);
    setApproveMsg('');
    try {
      await approveExpenseRequest(approveTarget.id, body);
      setApproveTarget(null);
      setConfirmApprove(false);
      setPayFromId('');
      await loadFunds();
      if (tab === 'wallets') await loadWallets();
    } catch (e) {
      setApproveMsg(mapPettyCashApiError(e, locale));
      throw e;
    } finally {
      setApproveBusy(false);
    }
  };

  const runReject = async (row) => {
    setApproveBusy(true);
    try {
      await rejectExpenseRequest(row.id, { reason: 'Rejected' });
      await loadFunds();
    } catch (e) {
      setFundsError(mapPettyCashApiError(e, locale));
    } finally {
      setApproveBusy(false);
    }
  };

  const statementSlice = useMemo(() => {
    const rows = Array.isArray(statement?.items) ? statement.items : [];
    return slicePage(rows, statementPage, PETTY_CASH_WALLETS_PAGE_SIZE);
  }, [statement, statementPage]);

  const reconSlice = useMemo(
    () => slicePage(reconItems, reconPage, PETTY_CASH_WALLETS_PAGE_SIZE),
    [reconItems, reconPage],
  );

  if (!canView) {
    return (
      <p role="alert" className="form-help-text">
        {t('pcw.err.forbidden')}
      </p>
    );
  }

  const cards = [
    {
      key: 'issued',
      icon: <ArrowUpCircle size={22} />,
      label: t('pcw.card.issued'),
      value: summary?.totalIssued,
    },
    {
      key: 'spent',
      icon: <ArrowDownCircle size={22} />,
      label: t('pcw.card.spent'),
      value: summary?.totalSpent,
    },
    {
      key: 'payable',
      icon: <AlertTriangle size={22} />,
      label: t('pcw.card.payable'),
      value: summary?.totalNegativeOwed,
      amber: true,
    },
    {
      key: 'roles',
      icon: <Users size={22} />,
      label: t('pcw.card.byRole'),
      value: null,
      meta: summary?.byRole
        ? `${formatSarLatn(summary.byRole.CASHIER?.closingPositive)} / ${formatSarLatn(
            `-${summary.byRole.PURCHASER?.closingNegative || 0}`.replace('--', '-'),
          )} / ${formatSarLatn(`-${summary.byRole.STAFF?.closingNegative || 0}`.replace('--', '-'))}`
        : null,
      roleTriple: summary?.byRole,
    },
  ];

  return (
    <div>
      <nav className="cash-bank-desc" style={{ marginBottom: 6 }}>
        <Link to="/workshop/accounting/cash-bank">{t('pcw.crumb.accounting')}</Link>
        {' / '}
        <span>{t('pcw.crumb.wallets')}</span>
      </nav>
      <header className="cash-bank-header">
        <h2 className="cash-bank-title">{t('pcw.title')}</h2>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { id: 'wallets', label: t('pcw.tab.wallets') },
          { id: 'recon', label: t('pcw.tab.recon') },
          { id: 'funds', label: t('pcw.tab.funds') },
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

      {tab === 'wallets' ? (
        <>
          <form className="acct-filter-bar" onSubmit={applyFilters}>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="pcw-role">{t('pcw.filter.role')}</label>
              <select
                id="pcw-role"
                style={inputStyle}
                value={draftRole}
                onChange={(e) => setDraftRole(e.target.value)}
              >
                <option value="all">{t('pcw.role.all')}</option>
                <option value="CASHIER">{t('pcw.role.cashier')}</option>
                <option value="PURCHASER">{t('pcw.role.purchaser')}</option>
                <option value="STAFF">{t('pcw.role.staff')}</option>
              </select>
            </div>
            <div style={{ ...fieldWrap, minWidth: 180 }}>
              <label style={labelStyle} htmlFor="pcw-holder">{t('pcw.filter.holder')}</label>
              <SearchSelect
                id="pcw-holder"
                options={holderOpts}
                value={draftHolder}
                onChange={(v) => setDraftHolder(String(v || ''))}
                placeholder={t('pcw.filter.holderPh')}
              />
            </div>
            <div style={{ ...fieldWrap, minWidth: 160 }}>
              <label style={labelStyle} htmlFor="pcw-branch">{t('pcw.filter.branch')}</label>
              <SearchSelect
                id="pcw-branch"
                options={branchOpts}
                value={draftBranch}
                onChange={(v) => setDraftBranch(String(v || 'all'))}
              />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="pcw-from">{t('pcw.filter.from')}</label>
              <input
                id="pcw-from"
                type="date"
                style={inputStyle}
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="pcw-to">{t('pcw.filter.to')}</label>
              <input
                id="pcw-to"
                type="date"
                style={inputStyle}
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-submit btn-dark">{t('pcw.btn.apply')}</button>
            <button type="button" className="btn-portal-outline" onClick={showAll}>
              {t('pcw.btn.showAll')}
            </button>
          </form>

          <div className="cash-bank-stats" style={{ marginBottom: 16 }}>
            {cards.map((c) => (
              <div
                key={c.key}
                className="acct-kpi-card acct-kpi-card--with-icon"
                style={c.amber ? { borderColor: '#F59E0B', background: '#FFFBEB' } : undefined}
              >
                <div className="acct-kpi-icon cash-bank-stat-icon">{c.icon}</div>
                <div className="acct-kpi-body">
                  <p className="acct-kpi-label" title={c.label}>{c.label}</p>
                  {c.roleTriple ? (
                    <p className="acct-kpi-value" title={`${formatSarLatn(c.roleTriple.CASHIER?.closingPositive)} / -${formatSarLatn(c.roleTriple.PURCHASER?.closingNegative)} / -${formatSarLatn(c.roleTriple.STAFF?.closingNegative)}`}>
                      {formatSarLatn(c.roleTriple.CASHIER?.closingPositive)}
                      {' / '}
                      <span style={{ color: '#B91C1C' }}>
                        -{formatSarLatn(c.roleTriple.PURCHASER?.closingNegative)}
                      </span>
                      {' / '}
                      <span style={{ color: '#B91C1C' }}>
                        -{formatSarLatn(c.roleTriple.STAFF?.closingNegative)}
                      </span>
                    </p>
                  ) : (
                    <p className="acct-kpi-value" title={c.value != null ? t('pcw.money.sar', { amount: formatSarLatn(c.value) }) : '—'}>
                      {c.value != null ? t('pcw.money.sar', { amount: formatSarLatn(c.value) }) : '—'}
                    </p>
                  )}
                  {c.key === 'roles' ? (
                    <p className="acct-kpi-meta">{t('pcw.card.byRoleMeta')}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {error ? (
            <div role="alert" style={{ color: '#B45309', marginBottom: 12 }}>
              {error}{' '}
              <button type="button" className="btn-portal-outline" onClick={loadWallets}>
                {t('pcw.btn.retry')}
              </button>
            </div>
          ) : null}

          <div
            className="pcw-split"
            style={{
              display: 'grid',
              gridTemplateColumns: statementUser
                ? 'minmax(0, 1.2fr) minmax(0, 1fr)'
                : '1fr',
              gap: 16,
            }}
          >
            <section className="premium-table cash-bank-table">
              <WsTableScroll>
                <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="table-header-row">
                      <th className="table-th">{t('pcw.th.holder')}</th>
                      <th className="table-th">{t('pcw.th.role')}</th>
                      <th className="table-th">{t('pcw.th.branch')}</th>
                      <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.opening')}</th>
                      <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.issued')}</th>
                      <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.spent')}</th>
                      <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.closing')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="table-cell table-empty">{t('pcw.loading')}</td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="table-cell table-empty">{t('pcw.empty.wallets')}</td>
                      </tr>
                    ) : (
                      items.map((row) => {
                        const neg = isNegativeClosing(row.closing);
                        const cashierZero =
                          row.role === 'CASHIER' && Math.abs(Number(row.closing)) < 0.005;
                        return (
                          <tr
                            key={row.userId}
                            style={{ cursor: 'pointer' }}
                            onClick={() => openStatement(row)}
                          >
                            <td className="table-cell">{row.name}</td>
                            <td className="table-cell">{t(`pcw.role.${String(row.role || '').toLowerCase()}`)}</td>
                            <td className="table-cell">{row.branchName || '—'}</td>
                            <td className="table-cell" style={{ textAlign: 'end' }}>{formatSarLatn(row.opening)}</td>
                            <td className="table-cell" style={{ textAlign: 'end' }}>{formatSarLatn(row.issued)}</td>
                            <td className="table-cell" style={{ textAlign: 'end' }}>{formatSarLatn(row.spent)}</td>
                            <td
                              className="table-cell"
                              style={{
                                textAlign: 'end',
                                color: neg ? '#B91C1C' : undefined,
                                fontWeight: neg ? 600 : undefined,
                              }}
                            >
                              {formatSarLatn(row.closing)}
                              {neg ? (
                                <div style={{ fontSize: '0.75rem' }}>
                                  {formatPayableToLabel(row.name, locale)}
                                </div>
                              ) : null}
                              {cashierZero ? (
                                <div style={{ fontSize: '0.75rem', color: '#A16207' }}>
                                  {t('pcw.hint.cashierFloor')}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </WsTableScroll>
              <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: '#64748B' }}>
                {t('pcw.showing', {
                  a: total ? (page - 1) * PETTY_CASH_WALLETS_PAGE_SIZE + 1 : 0,
                  b: Math.min(page * PETTY_CASH_WALLETS_PAGE_SIZE, total),
                  n: total,
                })}
              </div>
              <PaginationControls
                total={total}
                limit={PETTY_CASH_WALLETS_PAGE_SIZE}
                offset={(page - 1) * PETTY_CASH_WALLETS_PAGE_SIZE}
                onPageChange={(nextOffset) =>
                  setPage(Math.floor(nextOffset / PETTY_CASH_WALLETS_PAGE_SIZE) + 1)
                }
                loading={loading}
              />
            </section>

            {statementUser ? (
              <section className="premium-table cash-bank-table">
                <header
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <strong>
                    {t('pcw.statement.title', { name: statementUser.name })}
                  </strong>
                  <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={() => setStatementUser(null)}
                  >
                    {t('pcw.btn.close')}
                  </button>
                </header>
                {statementError ? (
                  <div role="alert" style={{ padding: 12, color: '#B45309' }}>
                    {statementError}
                  </div>
                ) : null}
                <WsTableScroll>
                  <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="table-header-row">
                        <th className="table-th">{t('pcw.th.date')}</th>
                        <th className="table-th">{t('pcw.th.ref')}</th>
                        <th className="table-th">{t('pcw.th.type')}</th>
                        <th className="table-th">{t('pcw.th.purpose')}</th>
                        <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.debit')}</th>
                        <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.credit')}</th>
                        <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.balance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementLoading ? (
                        <tr>
                          <td colSpan={7} className="table-cell table-empty">{t('pcw.loading')}</td>
                        </tr>
                      ) : (
                        <>
                          {statement?.opening ? (
                            <tr>
                              <td className="table-cell">{statement.opening.date}</td>
                              <td className="table-cell">—</td>
                              <td className="table-cell">{t('pcw.type.opening')}</td>
                              <td className="table-cell" />
                              <td className="table-cell" />
                              <td className="table-cell" />
                              <td className="table-cell" style={{ textAlign: 'end' }}>
                                {formatSarLatn(statement.opening.runningBalance)}
                              </td>
                            </tr>
                          ) : null}
                          {statementSlice.items.map((ln, idx) => (
                            <tr key={`${ln.ref}-${idx}`}>
                              <td className="table-cell">{ln.date}</td>
                              <td className="table-cell">{ln.ref}</td>
                              <td className="table-cell">{ln.type}</td>
                              <td className="table-cell">
                                {ln.purpose || ln.source || '—'}
                                {String(ln.type).toLowerCase().includes('advance') ? (
                                  <span
                                    style={{
                                      marginInlineStart: 6,
                                      fontSize: '0.7rem',
                                      background: '#DBEAFE',
                                      color: '#1E40AF',
                                      padding: '1px 6px',
                                      borderRadius: 999,
                                    }}
                                  >
                                    {t('pcw.badge.advance')}
                                  </span>
                                ) : null}
                              </td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>
                                {Number(ln.debit) ? formatSarLatn(ln.debit) : ''}
                              </td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>
                                {Number(ln.credit) ? formatSarLatn(ln.credit) : ''}
                              </td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>
                                {formatSarLatn(ln.runningBalance)}
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                </WsTableScroll>
                <PaginationControls
                  total={statementSlice.total}
                  limit={statementSlice.pageSize}
                  offset={(statementSlice.page - 1) * statementSlice.pageSize}
                  onPageChange={(nextOffset) =>
                    setStatementPage(
                      Math.floor(nextOffset / statementSlice.pageSize) + 1,
                    )
                  }
                  loading={statementLoading}
                />
              </section>
            ) : null}
          </div>
          <style>{`
            @media (max-width: 1100px) {
              .pcw-split { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </>
      ) : null}

      {tab === 'recon' ? (
        <>
          <form
            className="acct-filter-bar"
            onSubmit={(e) => {
              e.preventDefault();
              setReconPage(1);
              void loadRecon();
            }}
          >
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="pcw-recon-branch">{t('pcw.filter.branch')}</label>
              <SearchSelect
                id="pcw-recon-branch"
                options={branchOpts}
                value={reconBranch}
                onChange={(v) => setReconBranch(String(v || 'all'))}
              />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="pcw-recon-asof">{t('pcw.filter.asOf')}</label>
              <input
                id="pcw-recon-asof"
                type="date"
                style={inputStyle}
                value={reconAsOf}
                onChange={(e) => setReconAsOf(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-submit btn-dark">{t('pcw.btn.apply')}</button>
            <button
              type="button"
              className="btn-portal-outline"
              onClick={() => {
                setReconBranch('all');
                setReconAsOf(todayYmd());
                setReconPage(1);
              }}
            >
              {t('pcw.btn.showAll')}
            </button>
          </form>
          {reconError ? (
            <div role="alert" style={{ color: '#B45309', marginBottom: 12 }}>
              {reconError}{' '}
              <button type="button" className="btn-portal-outline" onClick={loadRecon}>
                {t('pcw.btn.retry')}
              </button>
            </div>
          ) : null}
          <section className="premium-table cash-bank-table">
            <WsTableScroll>
              <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="table-header-row">
                    <th className="table-th">{t('pcw.th.holder')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.app')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.register')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.gl')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.diff')}</th>
                    <th className="table-th">{t('pcw.th.hints')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reconLoading ? (
                    <tr>
                      <td colSpan={6} className="table-cell table-empty">{t('pcw.loading')}</td>
                    </tr>
                  ) : reconSlice.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-cell table-empty">{t('pcw.empty.recon')}</td>
                    </tr>
                  ) : (
                    reconSlice.items.map((row) => (
                      <tr key={row.userId}>
                        <td className="table-cell">{row.name}</td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>{formatSarLatn(row.appBalance)}</td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>{formatSarLatn(row.registerBalance)}</td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>{formatSarLatn(row.glBalance)}</td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>{formatSarLatn(row.appMinusGl)}</td>
                        <td className="table-cell">
                          {(row.hints || []).join(', ') || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </WsTableScroll>
            <PaginationControls
              total={reconSlice.total}
              limit={reconSlice.pageSize}
              offset={(reconSlice.page - 1) * reconSlice.pageSize}
              onPageChange={(nextOffset) =>
                setReconPage(Math.floor(nextOffset / reconSlice.pageSize) + 1)
              }
              loading={reconLoading}
            />
          </section>
          {legacyPools.length ? (
            <section style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: '1rem' }}>{t('pcw.legacy.title')}</h3>
              <ul>
                {legacyPools.map((p) => (
                  <li key={p.coaCode}>
                    {p.label} · {p.coaCode} · {formatSarLatn(p.glBalance)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === 'funds' ? (
        <>
          {fundsError ? (
            <div role="alert" style={{ color: '#B45309', marginBottom: 12 }}>
              {fundsError}
            </div>
          ) : null}
          <section className="premium-table cash-bank-table">
            <WsTableScroll>
              <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="table-header-row">
                    <th className="table-th">{t('pcw.th.ref')}</th>
                    <th className="table-th">{t('pcw.th.holder')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>{t('pcw.th.amount')}</th>
                    <th className="table-th">{t('pcw.th.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fundsLoading ? (
                    <tr>
                      <td colSpan={4} className="table-cell table-empty">{t('pcw.loading')}</td>
                    </tr>
                  ) : fundRequests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="table-cell table-empty">{t('pcw.empty.funds')}</td>
                    </tr>
                  ) : (
                    fundRequests.map((r) => (
                      <tr key={r.id}>
                        <td className="table-cell">{r.requestNumber || r.id}</td>
                        <td className="table-cell">
                          {r.requestedBy?.name || r.requesterName || '—'}
                        </td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>
                          {formatSarLatn(r.amount)}
                        </td>
                        <td className="table-cell">
                          {canApprove ? (
                            <button
                              type="button"
                              className="btn-submit btn-dark"
                              onClick={() => {
                                setApproveTarget(r);
                                setConfirmApprove(false);
                                setApproveMsg('');
                                setPayFromId('');
                              }}
                            >
                              {t('pcw.btn.approve')}
                            </button>
                          ) : null}
                          {canApprove ? (
                            <button
                              type="button"
                              className="btn-portal-outline"
                              style={{ marginInlineStart: 8 }}
                              disabled={approveBusy}
                              onClick={() => void runReject(r)}
                            >
                              {t('pcw.btn.reject')}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </WsTableScroll>
          </section>

          <PettyCashPayFromDialog
            open={Boolean(approveTarget)}
            request={approveTarget}
            locale={locale}
            busy={approveBusy}
            error={approveMsg}
            onCancel={() => {
              if (approveBusy) return;
              setApproveTarget(null);
              setApproveMsg('');
              setConfirmApprove(false);
              setPayFromId('');
            }}
            onConfirm={(body) => void runApprove(body)}
          />
        </>
      ) : null}
    </div>
  );
}
