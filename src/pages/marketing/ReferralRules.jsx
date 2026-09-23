import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { Search, Plus, Pencil } from 'lucide-react';
import { marketingListExpenses } from '../../services/superAdminMarketingApi';
import {
  mktExpCategoryLabel,
  mktExpT,
} from '../../utils/marketingExpensesI18n';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  canEditExpense,
  ExpenseStatus,
  extractExpenses,
  formatDate,
  formatSar,
} from './expenseShared';
import './MarketingUniversal.css';

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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadExpenses = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await marketingListExpenses({
        limit: 100,
        offset: 0,
        status: 'all',
        search: search.trim(),
      });
      setExpenses(extractExpenses(res));
    } catch (err) {
      setError(err?.message || t('err.loadList'));
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;

    return expenses.filter((item) => {
      const text = [
        item.expenseNumber,
        item.campaignName,
        item.expenseCategory,
        mktExpCategoryLabel(locale, item.expenseCategory),
        item.vendorName,
        item.description,
        item.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }, [expenses, search, locale]);

  const dash = t('dash');

  return (
    <div className="mk-page">
      <div className="mk-page-actions">
        <label className="mk-search-field">
          <Search size={15} color="#94A3B8" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadExpenses();
            }}
            placeholder={t('search.placeholder')}
          />
        </label>

        <button
          type="button"
          className="mk-btn-primary"
          onClick={() => navigate(`${listPath}/new`)}
        >
          <Plus size={16} strokeWidth={2.5} />
          {t('btn.newExpense')}
        </button>
      </div>

      {error ? <div className="mk-error-text">{error}</div> : null}

      <section className="mk-table-card">
        <table className="mk-table mk-expenses-table">
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
              <tr>
                <td colSpan={8} className="mk-empty-table">{t('empty.loading')}</td>
              </tr>
            ) : filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={8} className="mk-empty-table">{t('empty.none')}</td>
              </tr>
            ) : (
              filteredExpenses.map((item) => {
                const editable = canEditExpense(item.status);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="mk-table-title">
                        {item.expenseNumber || `#${item.id}`}
                      </div>
                    </td>
                    <td>{item.campaignName === '—' ? dash : item.campaignName || dash}</td>
                    <td>{mktExpCategoryLabel(locale, item.expenseCategory)}</td>
                    <td>{item.vendorName === '—' ? dash : item.vendorName || dash}</td>
                    <td>{formatSar(item.amount)}</td>
                    <td>{formatDate(item.expenseDate, locale)}</td>
                    <td>
                      <ExpenseStatus status={item.status} locale={locale} />
                    </td>
                    <td>
                      <div className="mk-icon-actions mk-expense-actions">
                        {editable ? (
                          <button
                            type="button"
                            title={t('action.edit')}
                            className="mk-action-edit"
                            onClick={() => navigate(`${listPath}/${item.id}/edit`)}
                          >
                            <Pencil size={15} />
                          </button>
                        ) : (
                          <span className="mk-action-empty">{dash}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default ReferralRules;
