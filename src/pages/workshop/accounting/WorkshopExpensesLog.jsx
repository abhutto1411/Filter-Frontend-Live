import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Clock,
  Filter,
  HandCoins,
  Users,
  Wallet,
} from 'lucide-react';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { PaginationControls } from '../../../components/PaginationControls';
import {
  listLogFilterUsers,
  listPettyCashExpensesLog,
} from '../../../services/accountingLogsApi';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import { expLogT } from '../../../utils/expensesLogI18n';
import { riyadhBoundToApiIso } from '../../../utils/riyadhBusinessRange';
import {
  METHOD_OPTIONS,
  PETTY_EXPENSE_PAGE_SIZE,
  TYPE_FILTER_ALL,
  filterExpenseRowsByMethod,
  filterExpenseRowsByType,
  formatBusinessDate,
  formatSarLatn,
  isAdvanceExpenseRow,
  mapExpenseEmployee,
  mapExpenseHolder,
  mapExpensePurpose,
  mapExpenseRef,
  mapExpenseTypeKind,
  mapExpenseVat,
  mapPettyExpenseCards,
} from '../../../utils/pettyExpenseDisplay';
import '../../../styles/admin/AccountingPage.css';

/** Cap when Type/Method need client-side filtering (API has no type/method query). */
const CLIENT_FILTER_FETCH_CAP = 500;

function sidebarBranchToFilter(selectedBranchId) {
  return selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '';
}

function formatFilterUserLabel(u) {
  const name = u.name || u.email || u.id;
  const role = u.role ? String(u.role).replace(/_/g, ' ') : '';
  return role ? `${name} (${role})` : name;
}

function sourceLabel(source, t) {
  if (source === 'admin_wallet') return t('source.adminWallet');
  if (source === 'locker') return t('source.locker');
  if (source === 'petty_cash') return t('source.pettyCash');
  return null;
}

const emptyApplied = () => ({
  branchId: '',
  userId: '',
  dateFrom: '',
  dateTo: '',
  method: 'all',
  type: TYPE_FILTER_ALL,
});

/**
 * Petty cash expenses log — mockup 27.
 * Advances never counted in the Expenses card (API summary fields only).
 */
export default function WorkshopExpensesLog({
  branches = [],
  selectedBranchId = 'all',
  locale: localeProp,
}) {
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => expLogT(locale, key, vars), [locale]);
  const tableTopRef = useRef(null);

  const [branchId, setBranchId] = useState(() => sidebarBranchToFilter(selectedBranchId));
  const [branchDisplay, setBranchDisplay] = useState('');
  const [userId, setUserId] = useState('');
  const [userDisplay, setUserDisplay] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [method, setMethod] = useState('all');
  const [methodDisplay, setMethodDisplay] = useState('');
  const [typeFilter, setTypeFilter] = useState(TYPE_FILTER_ALL);
  const [applied, setApplied] = useState(() => ({
    ...emptyApplied(),
    branchId: sidebarBranchToFilter(selectedBranchId),
  }));
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [payloadExtra, setPayloadExtra] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMoreCols, setShowMoreCols] = useState(false);

  const needsClientFilter =
    (applied.method && applied.method !== 'all') ||
    (applied.type && applied.type !== TYPE_FILTER_ALL);

  const branchComboOptions = useMemo(
    () => [
      { id: 'all', label: t('opt.allBranches') },
      ...branches.map((b) => ({ id: String(b.id), label: b.name || String(b.id) })),
    ],
    [branches, t],
  );

  const userComboOptions = useMemo(
    () => [
      { id: 'all', label: t('opt.allUsers') },
      ...users.map((u) => ({ id: String(u.id), label: formatFilterUserLabel(u) })),
    ],
    [users, t],
  );

  const methodComboOptions = useMemo(
    () =>
      METHOD_OPTIONS.map((m) => ({
        id: m.id,
        label: t(m.labelKey),
      })),
    [t],
  );

  const cards = useMemo(() => mapPettyExpenseCards(payloadExtra), [payloadExtra]);

  const cardMeta = useMemo(
    () => ({
      expenses: { label: t('card.expenses'), Icon: Wallet, money: true },
      advances: { label: t('card.advances'), Icon: HandCoins, money: true },
      pending: { label: t('card.pending'), Icon: Clock, money: false },
      holders: { label: t('card.holders'), Icon: Users, money: false },
    }),
    [t],
  );

  const showVatCol = useMemo(
    () => rows.some((r) => mapExpenseVat(r) != null),
    [rows],
  );

  const buildListParams = useCallback((filters, { limit, offset: off }) => ({
    branchId: filters.branchId || undefined,
    userId: filters.userId || undefined,
    dateFrom: filters.dateFrom
      ? riyadhBoundToApiIso(filters.dateFrom, 'start')
      : undefined,
    dateTo: filters.dateTo
      ? riyadhBoundToApiIso(filters.dateTo, 'end')
      : undefined,
    limit,
    offset: off,
  }), []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const clientMode = needsClientFilter;
      const res = await listPettyCashExpensesLog(
        buildListParams(applied, {
          limit: clientMode ? CLIENT_FILTER_FETCH_CAP : PETTY_EXPENSE_PAGE_SIZE,
          offset: clientMode ? 0 : offset,
        }),
      );
      const rawItems = Array.isArray(res?.items) ? res.items : [];
      let filtered = filterExpenseRowsByMethod(rawItems, applied.method);
      filtered = filterExpenseRowsByType(filtered, applied.type);

      if (clientMode) {
        const page = filtered.slice(offset, offset + PETTY_EXPENSE_PAGE_SIZE);
        setRows(page);
        setTotal(filtered.length);
      } else {
        setRows(rawItems);
        setTotal(Number(res?.total ?? 0));
      }

      setPayloadExtra({
        total: res?.total,
        totalAmount: res?.totalAmount,
        summary: res?.summary,
        expenseTotal: res?.expenseTotal,
        advanceTotal: res?.advanceTotal,
        pendingCount: res?.pendingCount,
        holdersCount: res?.holdersCount,
      });
    } catch (e) {
      setRows([]);
      setTotal(0);
      setPayloadExtra({});
      setError(e?.message || t('err.load'));
    } finally {
      setLoading(false);
    }
  }, [applied, offset, needsClientFilter, buildListParams, t]);

  useEffect(() => {
    const nextBranch = sidebarBranchToFilter(selectedBranchId);
    setBranchId(nextBranch);
    setBranchDisplay('');
    setUserDisplay('');
    setApplied((prev) => ({ ...prev, branchId: nextBranch, userId: '' }));
    setUserId('');
    setOffset(0);
  }, [selectedBranchId]);

  const branchScopeForUsers = branchId || undefined;

  useEffect(() => {
    listLogFilterUsers({
      branchId: branchScopeForUsers,
      walletOrCashier: true,
    })
      .then((res) => {
        const nextUsers = res?.users ?? [];
        setUsers(nextUsers);
        setUserId((prev) => {
          if (prev && nextUsers.some((u) => String(u.id) === String(prev))) return prev;
          setUserDisplay('');
          return '';
        });
      })
      .catch(() => {
        setUsers([]);
        setUserId('');
        setUserDisplay('');
      });
  }, [branchScopeForUsers]);

  useEffect(() => {
    reload();
  }, [reload]);

  const applyFilters = () => {
    setApplied({
      branchId,
      userId,
      dateFrom,
      dateTo,
      method,
      type: typeFilter,
    });
    setOffset(0);
  };

  const showAll = () => {
    const cleared = {
      ...emptyApplied(),
      branchId: sidebarBranchToFilter(selectedBranchId),
    };
    setBranchId(cleared.branchId);
    setBranchDisplay('');
    setUserId('');
    setUserDisplay('');
    setDateFrom('');
    setDateTo('');
    setMethod('all');
    setMethodDisplay('');
    setTypeFilter(TYPE_FILTER_ALL);
    setApplied(cleared);
    setOffset(0);
  };

  const onFilterKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyFilters();
    }
  };

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PETTY_EXPENSE_PAGE_SIZE, total);

  const colCount =
    7 + (showVatCol ? 1 : 0) + (showMoreCols ? 4 : 0);

  return (
    <div className="accounting-page module-container" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="cash-bank-header">
        <p className="form-help-text" style={{ marginBottom: 4 }}>
          <Link to="/workshop/accounting">{t('crumb.accounting')}</Link>
          {' / '}
          <span>{t('crumb.page')}</span>
        </p>
        <h2 className="cash-bank-title">
          <Wallet size={20} style={{ marginInlineEnd: 8 }} />
          {t('title')}
        </h2>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            padding: 12,
            marginBottom: 12,
            color: '#B45309',
            background: '#FFFBEB',
            borderRadius: 8,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button type="button" className="btn-portal-outline" onClick={reload}>
            {t('btn.retry')}
          </button>
        </div>
      ) : null}

      <section
        className="acct-filter-bar"
        onKeyDown={onFilterKeyDown}
      >
        <div>
          <label className="form-label" htmlFor="exp-from">
            {t('label.from')}
          </label>
          <input
            id="exp-from"
            type="date"
            className="form-input-field"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="exp-to">
            {t('label.to')}
          </label>
          <input
            id="exp-to"
            type="date"
            className="form-input-field"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">{t('label.branch')}</label>
          <SearchableEntityCombobox
            options={branchComboOptions}
            value={branchId || 'all'}
            displayText={branchDisplay}
            onDisplayTextChange={setBranchDisplay}
            onSelect={(opt) => {
              const next = !opt?.id || opt.id === 'all' ? '' : String(opt.id);
              setBranchId(next);
              setBranchDisplay('');
              setUserId('');
              setUserDisplay('');
            }}
            placeholder={t('search.branchPh')}
            entityLabel="branch"
            maxInitial={80}
            maxFiltered={120}
            menuMinWidth={220}
          />
        </div>
        <div>
          <label className="form-label">{t('label.user')}</label>
          <SearchableEntityCombobox
            options={userComboOptions}
            value={userId || 'all'}
            displayText={userDisplay}
            onDisplayTextChange={setUserDisplay}
            onSelect={(opt) => {
              const next = !opt?.id || opt.id === 'all' ? '' : String(opt.id);
              setUserId(next);
              setUserDisplay('');
            }}
            placeholder={t('search.userPh')}
            entityLabel="user"
            maxInitial={80}
            maxFiltered={120}
            menuMinWidth={220}
          />
        </div>
        <div>
          <label className="form-label">{t('label.method')}</label>
          <SearchableEntityCombobox
            options={methodComboOptions}
            value={method}
            displayText={methodDisplay}
            onDisplayTextChange={setMethodDisplay}
            onSelect={(opt) => {
              setMethod(String(opt?.id || 'all'));
              setMethodDisplay('');
            }}
            placeholder={t('search.methodPh')}
            entityLabel="method"
            maxInitial={20}
            maxFiltered={20}
            menuMinWidth={200}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="exp-type">
            {t('label.type')}
          </label>
          <select
            id="exp-type"
            className="form-input-field"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value={TYPE_FILTER_ALL}>{t('opt.typeAll')}</option>
            <option value="expenses">{t('opt.typeExpenses')}</option>
            <option value="advances">{t('opt.typeAdvances')}</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <button
            type="button"
            className="btn-submit btn-dark"
            onClick={applyFilters}
            disabled={loading}
          >
            <Filter size={14} style={{ marginInlineEnd: 6 }} />
            {t('btn.apply')}
          </button>
          <button
            type="button"
            className="btn-portal-outline"
            onClick={showAll}
            disabled={loading}
          >
            {t('btn.showAll')}
          </button>
        </div>
      </section>

      {cards.length > 0 ? (
        <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
          {cards.map((c) => {
            const meta = cardMeta[c.id] || cardMeta.expenses;
            const Icon = meta.Icon;
            return (
              <div key={c.id} className="acct-kpi-card">
                <div className="cash-bank-stat-icon">
                  <Icon size={24} />
                </div>
                <div>
                  <p className="acct-kpi-label">{meta.label}</p>
                  <p className="acct-kpi-value">
                    {meta.money
                      ? t('money.sar', { n: formatSarLatn(c.value) })
                      : String(c.value ?? 0)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          className="btn-portal-outline"
          onClick={() => setShowMoreCols((v) => !v)}
        >
          {showMoreCols ? t('btn.hideMoreCols') : t('btn.moreCols')}
        </button>
      </div>

      <section className="premium-table cash-bank-table" ref={tableTopRef}>
        <WsTableScroll>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="table-header-row">
                <th className="table-th">{t('th.date')}</th>
                <th className="table-th">{t('th.ref')}</th>
                <th className="table-th">{t('th.holder')}</th>
                <th className="table-th">{t('th.purpose')}</th>
                <th className="table-th">{t('th.employee')}</th>
                <th className="table-th" style={{ textAlign: 'end' }}>
                  {t('th.amount')}
                </th>
                {showVatCol ? (
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('th.vat')}
                  </th>
                ) : null}
                <th className="table-th">{t('th.type')}</th>
                {showMoreCols ? (
                  <>
                    <th className="table-th">{t('th.approved')}</th>
                    <th className="table-th">{t('th.branch')}</th>
                    <th className="table-th">{t('th.approvedBy')}</th>
                    <th className="table-th">{t('th.description')}</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="table-cell table-empty">
                    {loading ? t('loading') : t('empty')}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const kind = mapExpenseTypeKind(r);
                  const emp = mapExpenseEmployee(r);
                  const vat = mapExpenseVat(r);
                  const isAdv = kind === 'advance' || isAdvanceExpenseRow(r);
                  return (
                    <tr key={r.id}>
                      <td className="table-cell">
                        {formatBusinessDate(
                          r.expenseDate || r.approvedAt || r.requestedAt || r.createdAt,
                        )}
                      </td>
                      <td className="table-cell">{mapExpenseRef(r)}</td>
                      <td className="table-cell">{mapExpenseHolder(r)}</td>
                      <td className="table-cell">{mapExpensePurpose(r)}</td>
                      <td className="table-cell">{emp || '—'}</td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {formatSarLatn(r.amount)}
                      </td>
                      {showVatCol ? (
                        <td className="table-cell" style={{ textAlign: 'end' }}>
                          {vat != null ? formatSarLatn(vat) : '—'}
                        </td>
                      ) : null}
                      <td className="table-cell">
                        {isAdv ? (
                          <Link
                            to="/workshop/accounting/advances"
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              background: '#EFF6FF',
                              color: '#1E40AF',
                              textDecoration: 'none',
                            }}
                          >
                            {t('type.advanceLink')}
                          </Link>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              background: '#ECFDF5',
                              color: '#047857',
                            }}
                          >
                            {t('type.expense')}
                          </span>
                        )}
                      </td>
                      {showMoreCols ? (
                        <>
                          <td className="table-cell">
                            {formatBusinessDate(r.approvedAt)}
                          </td>
                          <td className="table-cell">{r.branch?.name || '—'}</td>
                          <td className="table-cell">
                            {r.approvedBy?.name || '—'}
                          </td>
                          <td
                            className="table-cell"
                            style={{
                              maxWidth: 280,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {r.description || '—'}
                            {sourceLabel(r.source, t) ? (
                              <span
                                style={{
                                  marginInlineStart: 6,
                                  color: '#64748B',
                                  fontSize: '0.7rem',
                                }}
                              >
                                · {sourceLabel(r.source, t)}
                              </span>
                            ) : null}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </WsTableScroll>
        <p className="form-help-text" style={{ margin: '8px 0 0' }}>
          {t('showing', { from: showingFrom, to: showingTo, total })}
        </p>
        <PaginationControls
          total={total}
          limit={PETTY_EXPENSE_PAGE_SIZE}
          offset={offset}
          loading={loading}
          onPageChange={(nextOffset) => {
            setOffset(nextOffset);
            tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      </section>
    </div>
  );
}
