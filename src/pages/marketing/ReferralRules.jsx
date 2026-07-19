import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Pencil } from 'lucide-react';
import { marketingListExpenses } from '../../services/superAdminMarketingApi';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  canEditExpense,
  ExpenseStatus,
  extractExpenses,
  formatDate,
  formatSar,
  humanize,
} from './expenseShared';
import './MarketingUniversal.css';

export const ReferralRules = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
      setError(err?.message || 'Failed to load expenses.');
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
        item.vendorName,
        item.description,
        item.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }, [expenses, search]);

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
            placeholder="Search expenses..."
          />
        </label>

        <button
          type="button"
          className="mk-btn-primary"
          onClick={() => navigate(`${listPath}/new`)}
        >
          <Plus size={16} strokeWidth={2.5} />
          New Expense
        </button>
      </div>

      {error ? <div className="mk-error-text">{error}</div> : null}

      <section className="mk-table-card">
        <table className="mk-table mk-expenses-table">
          <thead>
            <tr>
              <th>Expense #</th>
              <th>Campaign</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="mk-empty-table">Loading expenses...</td>
              </tr>
            ) : filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={8} className="mk-empty-table">No expenses found</td>
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
                    <td>{item.campaignName || '—'}</td>
                    <td>{humanize(item.expenseCategory)}</td>
                    <td>{item.vendorName || '—'}</td>
                    <td>{formatSar(item.amount)}</td>
                    <td>{formatDate(item.expenseDate)}</td>
                    <td>
                      <ExpenseStatus status={item.status} />
                    </td>
                    <td>
                      <div className="mk-icon-actions mk-expense-actions">
                        {editable ? (
                          <button
                            type="button"
                            title="Edit"
                            className="mk-action-edit"
                            onClick={() => navigate(`${listPath}/${item.id}/edit`)}
                          >
                            <Pencil size={15} />
                          </button>
                        ) : (
                          <span className="mk-action-empty">—</span>
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
