import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { AlertTriangle, Receipt, Search, Plus, Pencil } from 'lucide-react';
import { marketingListExpenses } from '../../services/superAdminMarketingApi';
import {
  mktExpCategoryLabel,
  mktExpT,
} from '../../utils/marketingExpensesI18n';
import { marketingSectionPath } from './marketingRouteUtils';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import {
  canEditExpense,
  ExpenseStatus,
  extractExpenses,
  formatDate,
  formatSar,
} from './expenseShared';
import '../../styles/ui.css';

export const ReferralRules = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktExpT(locale, key, vars), [locale]);
  const listPath = marketingSectionPath(location.pathname, 'expenses');

  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { page, pageSize, pagerFor } = useServerPaging({ resetKey: debouncedSearch });

  /**
   * One page at a time, searched by the server.
   *
   * This fetched `limit: 100, offset: 0` once on mount and never again unless
   * Enter was pressed, then filtered those 100 rows in the browser — so typing
   * narrowed only what had already arrived, Enter quietly refetched, and an
   * expense past the hundredth could not be reached or edited at all.
   */
  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await marketingListExpenses({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        status: 'all',
        search: debouncedSearch || undefined,
      });
      const rows = extractExpenses(res);
      setExpenses(rows);
      const count = Number(res?.total ?? res?.data?.total);
      setTotal(Number.isFinite(count) ? count : rows.length);
    } catch (err) {
      setError(err?.message || t('err.loadList'));
      setExpenses([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, pageSize, t]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const dash = t('dash');

  return (
    <div className="ui-root ui-root--flush ui-stack">
      <div className="ui-row ui-row--fields">
        <div className="ui-field ui-field--grow">
          <label htmlFor="exp-search">{t('search.label')}</label>
          <div className="ui-search">
            <Search size={15} />
            <input
              id="exp-search"
              className="ui-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search.placeholder')}
            />
          </div>
        </div>

        <div className="ui-toolbar-end">
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={() => navigate(`${listPath}/new`)}
          >
            <Plus size={15} /> {t('btn.newExpense')}
          </button>
        </div>
      </div>

      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="ui-table-wrap ui-table-wrap--scroll">
        <table className="ui-table">
          <thead>
            <tr>
              <th>{t('th.expenseNumber')}</th>
              <th>{t('th.campaign')}</th>
              <th>{t('th.category')}</th>
              <th>{t('th.vendor')}</th>
              <th>{t('th.amount')}</th>
              <th>{t('th.date')}</th>
              <th>{t('th.status')}</th>
              <th>{t('th.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} className="ui-sk-row">
                  <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                  <td><div className="ui-sk ui-sk--pill" /></td>
                  <td><div className="ui-sk ui-sk--btn" /></td>
                </tr>
              ))
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="ui-empty">
                    <div className="ui-empty-icon"><Receipt size={18} /></div>
                    <div className="ui-empty-title">{t('empty.none')}</div>
                    <button
                      type="button"
                      className="ui-btn ui-btn--primary"
                      onClick={() => navigate(`${listPath}/new`)}
                    >
                      <Plus size={14} /> {t('btn.newExpense')}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              expenses.map((item) => {
                const editable = canEditExpense(item.status);
                return (
                  <tr key={item.id}>
                    <td data-label={t('th.expenseNumber')} className="ui-strong">
                      {item.expenseNumber || `#${item.id}`}
                    </td>
                    <td data-label={t('th.campaign')}>
                      {item.campaignName === '—' ? dash : item.campaignName || dash}
                    </td>
                    <td data-label={t('th.category')}>
                      {mktExpCategoryLabel(locale, item.expenseCategory)}
                    </td>
                    <td data-label={t('th.vendor')}>
                      {item.vendorName === '—' ? dash : item.vendorName || dash}
                    </td>
                    <td data-label={t('th.amount')} className="ui-num ui-money ui-money--out">
                      {formatSar(item.amount, locale)}
                    </td>
                    <td data-label={t('th.date')} className="ui-nowrap">
                      {formatDate(item.expenseDate, locale)}
                    </td>
                    <td data-label={t('th.status')}>
                      <ExpenseStatus status={item.status} locale={locale} />
                    </td>
                    <td data-label={t('th.actions')}>
                      {editable ? (
                        <button
                          type="button"
                          className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                          title={t('action.edit')}
                          aria-label={t('action.edit')}
                          onClick={() => navigate(`${listPath}/${item.id}/edit`)}
                        >
                          <Pencil size={14} />
                        </button>
                      ) : (
                        <span className="ui-meta">{dash}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <UiPager {...pagerFor(total)} />
      </div>
    </div>
  );
};

export default ReferralRules;
