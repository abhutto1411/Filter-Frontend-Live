import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Wallet, Plus } from 'lucide-react';
import {
  marketingGetWallet,
  marketingListBudgetRequests,
  marketingListWalletTransactions,
} from '../../services/superAdminMarketingApi';
import { marketingSectionPath } from './marketingRouteUtils';
import './MarketingUniversal.css';

const initialWallet = {
  balance: 0,
  totalFunded: 0,
  totalSpent: 0,
  currencyCode: 'SAR',
};

function formatSar(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return '0 SAR';

  return `${n.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })} SAR`;
}

function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function normalizeWalletPayload(payload) {
  const wallet = payload?.wallet || payload?.data?.wallet || payload?.data || payload || {};

  return {
    balance: Number(wallet.balance ?? payload?.balance ?? 0),
    totalFunded: Number(
      wallet.totalFunded ??
        wallet.total_funded ??
        payload?.totalFunded ??
        payload?.total_funded ??
        0,
    ),
    totalSpent: Number(
      wallet.totalSpent ??
        wallet.total_spent ??
        payload?.totalSpent ??
        payload?.total_spent ??
        0,
    ),
    currencyCode:
      wallet.currencyCode ||
      wallet.currency_code ||
      payload?.currencyCode ||
      payload?.currency_code ||
      'SAR',
  };
}

function normalizeCashAccountsPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.accounts)
      ? payload.accounts
      : Array.isArray(payload?.cashAccounts)
        ? payload.cashAccounts
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.data?.accounts)
              ? payload.data.accounts
              : Array.isArray(payload?.data?.cashAccounts)
                ? payload.data.cashAccounts
                : Array.isArray(payload?.data?.items)
                  ? payload.data.items
                  : [];

  return rows
    .map((account) => {
      const id =
        account.id ??
        account._id ??
        account.accountId ??
        account.cashAccountId ??
        account.code ??
        account.accountCode;

      const name =
        account.name ??
        account.accountName ??
        account.account_name ??
        account.title ??
        account.label ??
        'Cash Account';

      const code =
        account.code ??
        account.accountCode ??
        account.account_code ??
        account.number ??
        account.accountNumber ??
        '';

      const balance =
        account.currentBalance ??
        account.current_balance ??
        account.balance ??
        0;

      return {
        id: id != null ? String(id) : '',
        name: String(name),
        code: code != null ? String(code) : '',
        balance: Number(balance || 0),
        label: code ? `${name} - ${code}` : String(name),
      };
    })
    .filter((account) => account.id);
}

function normalizeBudgetRequestsPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.budgetRequests)
      ? payload.budgetRequests
      : Array.isArray(payload?.requests)
        ? payload.requests
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.data?.budgetRequests)
              ? payload.data.budgetRequests
              : Array.isArray(payload?.data?.requests)
                ? payload.data.requests
                : Array.isArray(payload?.data?.items)
                  ? payload.data.items
                  : [];

  return rows.map((request) => ({
    id: safeString(request.id ?? request._id ?? request.requestId ?? ''),
    amount: Number(
      request.amount ??
        request.requestedAmount ??
        request.requested_amount ??
        request.budgetAmount ??
        request.budget_amount ??
        0,
    ),
    purpose: request.purpose ?? request.notes ?? request.reason ?? '',
    accountName:
      request.sourceAccountName ??
      request.source_account_name ??
      request.sourceCashAccountName ??
      request.cashAccountName ??
      request.accountName ??
      request.sourceCashAccount?.name ??
      '',
    accountCode:
      request.sourceCashAccountCode ??
      request.cashAccountCode ??
      request.accountCode ??
      request.sourceCashAccount?.code ??
      '',
    status: request.status ?? 'pending',
    requestedByName:
      request.requestedByName ??
      request.requested_by_name ??
      request.requestedBy ??
      request.requested_by ??
      '',
    createdAt:
      request.createdAt ??
      request.created_at ??
      request.createdDate ??
      request.created_date ??
      '',
    rejectionReason:
      request.rejectionReason ??
      request.rejection_reason ??
      '',
  }));
}

function normalizeTransactionsPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.transactions)
      ? payload.transactions
      : Array.isArray(payload?.recentTransactions)
        ? payload.recentTransactions
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.data?.transactions)
              ? payload.data.transactions
              : Array.isArray(payload?.data?.items)
                ? payload.data.items
                : [];

  return rows.map((transaction) => ({
    id: safeString(transaction.id ?? transaction._id ?? transaction.transactionId ?? ''),
    title:
      transaction.description ||
      transaction.title ||
      transaction.purpose ||
      transaction.type ||
      'Wallet Transaction',
    date:
      transaction.createdAt ||
      transaction.created_at ||
      transaction.date ||
      '',
    type: transaction.type || 'transaction',
    direction: transaction.direction || 'credit',
    amount: Number(transaction.amount ?? 0),
    status: transaction.status || 'completed',
  }));
}

function formatDate(value) {
  if (!value) return '—';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleDateString();
}

function humanizeStatus(value) {
  return String(value || 'pending')
    .toLowerCase()
    .replace(/_/g, ' ');
}

const StatusBadge = ({ status }) => {
  const value = String(status || 'pending').toLowerCase();

  const classNameMap = {
    pending: 'mk-status-pending',
    approved: 'mk-status-approved',
    rejected: 'mk-status-rejected',
    completed: 'mk-status-approved',
    cancelled: 'mk-status-rejected',
  };

  return (
    <span className={`mk-status ${classNameMap[value] || 'mk-status-pending'}`}>
      {humanizeStatus(value)}
    </span>
  );
};

export const ReferralManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const walletBase = location.pathname.includes('marketing-wallet')
    ? marketingSectionPath(location.pathname, 'marketing-wallet')
    : marketingSectionPath(location.pathname, 'referral-management');

  const [wallet, setWallet] = useState(initialWallet);
  const [budgetRequests, setBudgetRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [pageLoading, setPageLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const [error, setError] = useState('');

  const loadWallet = useCallback(async () => {
    const res = await marketingGetWallet();

    setWallet(normalizeWalletPayload(res));

    const pendingFromWallet = normalizeBudgetRequestsPayload(
      res?.pendingRequests || res?.pending_requests || [],
    );

    const transactionsFromWallet = normalizeTransactionsPayload(
      res?.recentTransactions || res?.recent_transactions || [],
    );

    if (pendingFromWallet.length > 0) {
      setBudgetRequests((prev) => {
        const existingIds = new Set(prev.map((item) => String(item.id)));
        const unique = pendingFromWallet.filter(
          (item) => !existingIds.has(String(item.id)),
        );

        return [...unique, ...prev];
      });
    }

    if (transactionsFromWallet.length > 0) {
      setTransactions(transactionsFromWallet);
    }
  }, []);

  const loadBudgetRequests = useCallback(async () => {
    setRequestsLoading(true);

    try {
      const res = await marketingListBudgetRequests({
        limit: 20,
        offset: 0,
        status: 'all',
      });

      setBudgetRequests(normalizeBudgetRequestsPayload(res));
    } catch (err) {
      setBudgetRequests([]);
      setError(err?.message || 'Failed to load budget requests.');
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true);

    try {
      const res = await marketingListWalletTransactions({
        limit: 20,
        offset: 0,
      });

      setTransactions(normalizeTransactionsPayload(res));
    } catch (err) {
      setTransactions([]);
      setError(err?.message || 'Failed to load transactions.');
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  const loadPageData = useCallback(async () => {
    setPageLoading(true);
    setError('');

    try {
      await Promise.all([
        loadWallet(),
        loadBudgetRequests(),
        loadTransactions(),
      ]);
    } catch (err) {
      setError(err?.message || 'Failed to load marketing wallet.');
    } finally {
      setPageLoading(false);
    }
  }, [loadWallet, loadBudgetRequests, loadTransactions]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const openBudgetRequestPage = () => {
    navigate(`${walletBase}/budget-request`);
  };

  return (
    <div className="mk-page">
      <section className="mk-wallet-hero">
        <div>
          <div className="mk-wallet-hero-label">Marketing Wallet</div>

          <div className="mk-wallet-balance-row">
            <span className="mk-wallet-balance">
              {Number(wallet.balance).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </span>

            <span className="mk-wallet-currency">
              {wallet.currencyCode || 'SAR'}
            </span>
          </div>

          <div className="mk-wallet-meta">
            <span>Total Funded: {formatSar(wallet.totalFunded)}</span>
            <span>Total Spent: {formatSar(wallet.totalSpent)}</span>
          </div>

          <button
            type="button"
            className="mk-wallet-topup-btn"
            onClick={openBudgetRequestPage}
          >
            <Plus size={16} strokeWidth={2.5} />
            Request Budget Top-up
          </button>
        </div>

        <Wallet className="mk-wallet-hero-icon" size={55} strokeWidth={1.8} />
      </section>

      {error ? <div className="mk-error-text">{error}</div> : null}

      <div className="mk-wallet-grid">
        <section className="mk-card mk-wallet-panel">
          <h3 className="mk-card-title">Budget Requests</h3>

          {requestsLoading || pageLoading ? (
            <div className="mk-panel-empty">Loading requests...</div>
          ) : budgetRequests.length === 0 ? (
            <div className="mk-panel-empty">No budget requests yet</div>
          ) : (
            <div className="mk-wallet-list">
              {budgetRequests.map((request) => (
                <div key={request.id} className="mk-wallet-list-item">
                  <div>
                    <div className="mk-wallet-request-amount">
                      {formatSar(request.amount)}
                    </div>

                    <div className="mk-wallet-request-purpose">
                      {request.purpose || '—'}
                    </div>

                    {(request.accountName || request.accountCode) ? (
                      <div className="mk-wallet-request-account">
                        {request.accountName}
                        {request.accountCode ? ` - ${request.accountCode}` : ''}
                      </div>
                    ) : null}

                    {request.createdAt ? (
                      <div className="mk-wallet-request-account">
                        {formatDate(request.createdAt)}
                      </div>
                    ) : null}
                  </div>

                  <div className="mk-wallet-request-right">
                    <StatusBadge status={request.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mk-card mk-wallet-panel">
          <h3 className="mk-card-title">Transaction History</h3>

          {transactionsLoading || pageLoading ? (
            <div className="mk-panel-empty">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="mk-panel-empty">No transactions yet</div>
          ) : (
            <div className="mk-wallet-list">
              {transactions.map((transaction) => {
                const isDebit =
                  String(transaction.direction || '').toLowerCase() === 'debit' ||
                  String(transaction.type || '').toLowerCase() === 'spent';

                return (
                  <div key={transaction.id} className="mk-wallet-list-item">
                    <div>
                      <div className="mk-wallet-request-amount">
                        {transaction.title}
                      </div>

                      <div className="mk-wallet-request-purpose">
                        {formatDate(transaction.date)}
                      </div>
                    </div>

                    <div
                      className={
                        isDebit ? 'mk-amount-negative' : 'mk-amount-positive'
                      }
                    >
                      {isDebit ? '-' : '+'}
                      {formatSar(transaction.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ReferralManagement;