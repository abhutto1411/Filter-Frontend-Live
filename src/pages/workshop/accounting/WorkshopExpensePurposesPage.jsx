import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  HelpCircle,
  ShoppingBag,
  User,
  Users,
} from 'lucide-react';
import {
  listCoaAccounts,
  listExpensePurposesAdmin,
  listExpenseReviewQueue,
  patchExpensePurposeAdmin,
  reclassExpenseReviewItem,
} from '../../../services/workshopAccountingApi';
import {
  EXPENSE_PURPOSES_PAGE_SIZE,
  filterPurposesByRole,
  filterPurposesBySearch,
  formatSarLatn,
  isOtherPurpose,
  mapPurposeRoleCards,
  purposeDisplayName,
  purposeRolesLabel,
  slicePage,
} from '../../../utils/expensePurposesDisplay';
import { accT } from '../../../utils/accountingI18n';
import CoaAccountSearchCombobox from '../../../components/accounting/CoaAccountSearchCombobox';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { useAuth } from '../../../context/AuthContext';

const fieldWrap = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 };
const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#64748B' };
const inputStyle = {
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  padding: '0 10px',
  fontSize: '0.875rem',
  background: '#fff',
};

export default function WorkshopExpensePurposesPage({
  locale: localeProp,
  selectedBranchId: selectedBranchIdProp = 'all',
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
  const canEdit =
    hasPermission('workshop.accounting.expenses.create') ||
    hasPermission('workshop.accounting.journal-entries.create') ||
    hasPermission('workshop.accounting.chart-of-accounts.create');

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab =
    searchParams.get('tab') === 'review' ||
    /\/expenses\/review\/?$/.test(location.pathname)
      ? 'review'
      : 'mappings';

  const [draftRole, setDraftRole] = useState(searchParams.get('role') || 'all');
  const [draftSearch, setDraftSearch] = useState(searchParams.get('q') || '');
  const [appliedRole, setAppliedRole] = useState(searchParams.get('role') || 'all');
  const [appliedSearch, setAppliedSearch] = useState(searchParams.get('q') || '');
  const [mapPage, setMapPage] = useState(1);

  const [items, setItems] = useState([]);
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');

  const [reviewItems, setReviewItems] = useState([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewPage, setReviewPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState({});
  const [assignAccount, setAssignAccount] = useState({});
  const [reclassReason, setReclassReason] = useState('');
  const [confirmReclass, setConfirmReclass] = useState(false);
  const [reclassBusy, setReclassBusy] = useState(false);

  const layoutBranch =
    selectedBranchIdProp || outletCtx.selectedBranchId || 'all';

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, coa] = await Promise.all([
        listExpensePurposesAdmin({
          page: 1,
          pageSize: 200,
          active: 'true',
        }),
        listCoaAccounts('payable_expense').catch(() => null),
      ]);
      setItems(Array.isArray(res?.items) ? res.items : []);
      const accounts = Array.isArray(coa?.accounts)
        ? coa.accounts
        : Array.isArray(coa?.items)
          ? coa.items
          : Array.isArray(coa)
            ? coa
            : [];
      setCoaAccounts(
        accounts.filter((a) => !a.hasChildren && a.isPostable !== false),
      );
    } catch (e) {
      const status = e?.status || e?.response?.status;
      setItems([]);
      if (status === 404 || status === 403) {
        setError(t('ep.err.unavailable'));
      } else {
        setError(e?.message || t('ep.err.load'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadReview = useCallback(async () => {
    setReviewLoading(true);
    setReviewError('');
    try {
      const params = {
        status: 'open',
        page: reviewPage,
        pageSize: EXPENSE_PURPOSES_PAGE_SIZE,
      };
      if (layoutBranch && layoutBranch !== 'all') {
        params.branch = String(layoutBranch);
      }
      const res = await listExpenseReviewQueue(params);
      setReviewItems(Array.isArray(res?.items) ? res.items : []);
      setReviewTotal(Number(res?.total || 0));
    } catch (e) {
      const status = e?.status || e?.response?.status;
      setReviewItems([]);
      setReviewTotal(0);
      if (status === 404 || status === 403) {
        setReviewError(t('ep.err.reviewUnavailable'));
      } else {
        setReviewError(e?.message || t('ep.err.load'));
      }
    } finally {
      setReviewLoading(false);
    }
  }, [t, reviewPage, layoutBranch]);

  useEffect(() => {
    void loadMappings();
  }, [loadMappings]);

  useEffect(() => {
    if (tab === 'review') void loadReview();
  }, [tab, loadReview]);

  const filtered = useMemo(() => {
    let rows = filterPurposesByRole(items, appliedRole);
    rows = filterPurposesBySearch(rows, appliedSearch, locale);
    return rows;
  }, [items, appliedRole, appliedSearch, locale]);

  const cards = useMemo(() => mapPurposeRoleCards(items), [items]);
  const mapSlice = useMemo(
    () => slicePage(filtered, mapPage, EXPENSE_PURPOSES_PAGE_SIZE),
    [filtered, mapPage],
  );

  const setTab = (next) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'review') nextParams.set('tab', 'review');
    else nextParams.delete('tab');
    setSearchParams(nextParams, { replace: true });
  };

  const applyFilters = (e) => {
    e?.preventDefault?.();
    setAppliedRole(draftRole);
    setAppliedSearch(draftSearch);
    setMapPage(1);
    const next = new URLSearchParams(searchParams);
    if (draftRole && draftRole !== 'all') next.set('role', draftRole);
    else next.delete('role');
    if (draftSearch.trim()) next.set('q', draftSearch.trim());
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const showAll = () => {
    setDraftRole('all');
    setDraftSearch('');
    setAppliedRole('all');
    setAppliedSearch('');
    setMapPage(1);
    const next = new URLSearchParams(searchParams);
    next.delete('role');
    next.delete('q');
    setSearchParams(next, { replace: true });
    void loadMappings();
  };

  const patchAccount = async (row, accountId) => {
    if (!canEdit || !row?.id) return;
    setSavingId(String(row.id));
    try {
      await patchExpensePurposeAdmin(row.id, {
        coaAccountId: accountId ? String(accountId) : null,
      });
      await loadMappings();
    } catch (e) {
      setError(e?.message || t('ep.err.save'));
    } finally {
      setSavingId('');
    }
  };

  const toggleSelect = (id) => {
    setSelectedReview((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedIds = Object.entries(selectedReview)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const runReclass = async () => {
    if (!selectedIds.length) return;
    setReclassBusy(true);
    setReviewError('');
    try {
      for (const id of selectedIds) {
        const acct = assignAccount[id];
        if (!acct) {
          setReviewError(t('ep.err.assignAccount'));
          setReclassBusy(false);
          return;
        }
        await reclassExpenseReviewItem(id, {
          accountId: String(acct),
          reason: reclassReason.trim() || undefined,
        });
      }
      setSelectedReview({});
      setAssignAccount({});
      setReclassReason('');
      setConfirmReclass(false);
      await loadReview();
      await loadMappings();
    } catch (e) {
      setReviewError(e?.message || t('ep.err.reclass'));
    } finally {
      setReclassBusy(false);
    }
  };

  if (!canView) {
    return (
      <p role="alert" className="form-help-text">
        {t('ep.err.forbidden')}
      </p>
    );
  }

  return (
    <div>
      <nav className="cash-bank-desc" style={{ marginBottom: 6 }}>
        <Link to="/workshop/accounting/cash-bank">{t('ep.crumb.accounting')}</Link>
        {' / '}
        <span>{t('ep.crumb.purposes')}</span>
      </nav>
      <header className="cash-bank-header">
        <h2 className="cash-bank-title">{t('ep.title')}</h2>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={tab === 'mappings' ? 'btn-submit btn-dark' : 'btn-portal-outline'}
          onClick={() => setTab('mappings')}
        >
          {t('ep.tab.mappings')}
        </button>
        <button
          type="button"
          className={tab === 'review' ? 'btn-submit btn-dark' : 'btn-portal-outline'}
          onClick={() => setTab('review')}
        >
          {t('ep.tab.review', { n: reviewTotal || cards.other || 0 })}
        </button>
      </div>

      {tab === 'mappings' ? (
        <>
          <form className="acct-filter-bar" onSubmit={applyFilters}>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="ep-used-by">
                {t('ep.filter.usedBy')}
              </label>
              <select
                id="ep-used-by"
                style={inputStyle}
                value={draftRole}
                onChange={(e) => setDraftRole(e.target.value)}
              >
                <option value="all">{t('ep.role.all')}</option>
                <option value="cashier">{t('ep.role.cashier')}</option>
                <option value="purchaser">{t('ep.role.purchaser')}</option>
                <option value="staff">{t('ep.role.staff')}</option>
              </select>
            </div>
            <div style={{ ...fieldWrap, minWidth: 220, flex: 1 }}>
              <label style={labelStyle} htmlFor="ep-search">
                {t('ep.filter.search')}
              </label>
              <input
                id="ep-search"
                style={inputStyle}
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder={t('ep.filter.searchPh')}
              />
            </div>
            <button type="submit" className="btn-submit btn-dark">
              {t('ep.btn.apply')}
            </button>
            <button type="button" className="btn-portal-outline" onClick={showAll}>
              {t('ep.btn.showAll')}
            </button>
          </form>

          <div className="cash-bank-stats" style={{ marginBottom: 16 }}>
            {[
              {
                key: 'cashier',
                icon: <User size={22} />,
                label: t('ep.card.cashier'),
                value: cards.cashier,
              },
              {
                key: 'purchaser',
                icon: <ShoppingBag size={22} />,
                label: t('ep.card.purchaser'),
                value: cards.purchaser,
              },
              {
                key: 'staff',
                icon: <Users size={22} />,
                label: t('ep.card.staff'),
                value: cards.staff,
              },
              {
                key: 'other',
                icon: <HelpCircle size={22} />,
                label: t('ep.card.other'),
                value: cards.other,
                amber: true,
              },
            ].map((c) => (
              <div
                key={c.key}
                className="acct-kpi-card acct-kpi-card--with-icon"
                style={c.amber ? { borderColor: '#F59E0B', background: '#FFFBEB' } : undefined}
              >
                <div className="cash-bank-stat-icon">{c.icon}</div>
                <div>
                  <p className="acct-kpi-label">{c.label}</p>
                  <p className="acct-kpi-value">{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {error ? (
            <div role="alert" style={{ color: '#B45309', marginBottom: 12 }}>
              {error}{' '}
              <button type="button" className="btn-portal-outline" onClick={loadMappings}>
                {t('ep.btn.retry')}
              </button>
            </div>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
              gap: 16,
            }}
            className="ep-split"
          >
            <section className="premium-table cash-bank-table">
              <WsTableScroll>
                <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="table-header-row">
                      <th className="table-th">{t('ep.th.purpose')}</th>
                      <th className="table-th">{t('ep.th.usedBy')}</th>
                      <th className="table-th">{t('ep.th.mapped')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="table-cell table-empty">
                          {t('ep.loading')}
                        </td>
                      </tr>
                    ) : mapSlice.items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="table-cell table-empty">
                          {t('ep.empty.mappings')}
                        </td>
                      </tr>
                    ) : (
                      mapSlice.items.map((row) => (
                        <tr key={row.id}>
                          <td className="table-cell">
                            {purposeDisplayName(row, locale)}
                            {row.nameAr && locale !== 'ar' ? (
                              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                {row.nameAr}
                              </div>
                            ) : null}
                          </td>
                          <td className="table-cell">
                            {purposeRolesLabel(row.roles, t)}
                          </td>
                          <td className="table-cell">
                            {isOtherPurpose(row) ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                {t('ep.chip.goesToReview')}
                              </span>
                            ) : canEdit ? (
                              <CoaAccountSearchCombobox
                                accounts={coaAccounts}
                                value={row.coaAccountId || row.coaAccount?.id || ''}
                                onChange={(id) => patchAccount(row, id)}
                                disabled={savingId === String(row.id)}
                                placeholder={t('ep.mapped.search')}
                              />
                            ) : row.coaAccount ? (
                              `${row.coaAccount.code} ${row.coaAccount.name}`
                            ) : (
                              t('ep.emDash')
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </WsTableScroll>
              <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: '#64748B' }}>
                {t('ep.showing', {
                  a: mapSlice.from,
                  b: mapSlice.to,
                  n: mapSlice.total,
                })}
              </div>
              <PaginationControls
                total={mapSlice.total}
                limit={mapSlice.pageSize}
                offset={(mapSlice.page - 1) * mapSlice.pageSize}
                onPageChange={(nextOffset) =>
                  setMapPage(Math.floor(nextOffset / mapSlice.pageSize) + 1)
                }
                loading={loading}
              />
            </section>

            <section className="premium-table cash-bank-table">
              <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                <strong>{t('ep.review.panelTitle')}</strong>
                <p className="form-help-text" style={{ margin: '4px 0 0' }}>
                  {t('ep.review.panelHint')}
                </p>
              </header>
              <div style={{ padding: 12 }}>
                <button
                  type="button"
                  className="btn-portal-outline"
                  onClick={() => setTab('review')}
                >
                  <AlertTriangle size={14} style={{ marginInlineEnd: 6 }} />
                  {t('ep.tab.review', { n: reviewTotal || cards.other || 0 })}
                </button>
              </div>
            </section>
          </div>
          <style>{`
            @media (max-width: 1100px) {
              .ep-split { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </>
      ) : (
        <>
          {reviewError ? (
            <div role="alert" style={{ color: '#B45309', marginBottom: 12 }}>
              {reviewError}{' '}
              <button type="button" className="btn-portal-outline" onClick={loadReview}>
                {t('ep.btn.retry')}
              </button>
            </div>
          ) : null}

          <section className="premium-table cash-bank-table">
            <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
              <strong>{t('ep.review.title')}</strong>
            </header>
            <WsTableScroll>
              <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="table-header-row">
                    <th className="table-th" />
                    <th className="table-th">{t('ep.th.date')}</th>
                    <th className="table-th">{t('ep.th.by')}</th>
                    <th className="table-th">{t('ep.th.note')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('ep.th.sar')}
                    </th>
                    <th className="table-th">{t('ep.th.assign')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewLoading ? (
                    <tr>
                      <td colSpan={6} className="table-cell table-empty">
                        {t('ep.loading')}
                      </td>
                    </tr>
                  ) : reviewItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-cell table-empty">
                        {t('ep.empty.review')}
                      </td>
                    </tr>
                  ) : (
                    reviewItems.map((row) => (
                      <tr key={row.id}>
                        <td className="table-cell">
                          <input
                            type="checkbox"
                            checked={!!selectedReview[row.id]}
                            onChange={() => toggleSelect(row.id)}
                            aria-label={t('ep.review.selectRow')}
                          />
                        </td>
                        <td className="table-cell">{row.date || t('ep.emDash')}</td>
                        <td className="table-cell">{row.source || t('ep.emDash')}</td>
                        <td className="table-cell">{row.description || t('ep.emDash')}</td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>
                          {formatSarLatn(row.amount)}
                        </td>
                        <td className="table-cell">
                          {canEdit ? (
                            <CoaAccountSearchCombobox
                              accounts={coaAccounts}
                              value={assignAccount[row.id] || ''}
                              onChange={(id) =>
                                setAssignAccount((prev) => ({
                                  ...prev,
                                  [row.id]: id,
                                }))
                              }
                              placeholder={t('ep.mapped.search')}
                            />
                          ) : (
                            t('ep.emDash')
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </WsTableScroll>
            <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: '#64748B' }}>
              {t('ep.showing', {
                a: reviewItems.length
                  ? (reviewPage - 1) * EXPENSE_PURPOSES_PAGE_SIZE + 1
                  : 0,
                b: Math.min(
                  reviewPage * EXPENSE_PURPOSES_PAGE_SIZE,
                  reviewTotal,
                ),
                n: reviewTotal,
              })}
            </div>
            <PaginationControls
              total={reviewTotal}
              limit={EXPENSE_PURPOSES_PAGE_SIZE}
              offset={(reviewPage - 1) * EXPENSE_PURPOSES_PAGE_SIZE}
              onPageChange={(nextOffset) =>
                setReviewPage(
                  Math.floor(nextOffset / EXPENSE_PURPOSES_PAGE_SIZE) + 1,
                )
              }
              loading={reviewLoading}
            />
          </section>

          {canEdit && selectedIds.length > 0 ? (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                background: '#fff',
              }}
            >
              <label className="form-label" htmlFor="ep-reclass-reason">
                {t('ep.review.reason')}
              </label>
              <input
                id="ep-reclass-reason"
                className="form-input-field"
                style={{ ...inputStyle, width: '100%', marginBottom: 10 }}
                value={reclassReason}
                onChange={(e) => setReclassReason(e.target.value)}
              />
              {!confirmReclass ? (
                <button
                  type="button"
                  className="btn-submit btn-dark"
                  onClick={() => setConfirmReclass(true)}
                >
                  {t('ep.btn.reclassSelected')}
                </button>
              ) : (
                <div role="alert" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>{t('ep.review.confirm')}</span>
                  <button
                    type="button"
                    className="btn-submit btn-dark"
                    disabled={reclassBusy}
                    onClick={runReclass}
                  >
                    {t('ep.btn.confirm')}
                  </button>
                  <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={() => setConfirmReclass(false)}
                  >
                    {t('ep.btn.cancel')}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
