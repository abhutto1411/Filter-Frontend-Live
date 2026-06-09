import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Wallet,
  Plus,
  X,
} from 'lucide-react';
import {
  marketingCreateBudgetRequest,
  marketingGetWallet,
  marketingListBudgetRequests,
  marketingListWalletCashAccounts,
  marketingListWalletTransactions,
} from '../../services/superAdminMarketingApi';
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

export const ReferralManagement = ({
  showAdd: propsShowAdd,
  setShowAdd: propsSetShowAdd,
}) => {
  const ctx = useOutletContext() || {};

  const showAdd =
    propsShowAdd !== undefined ? propsShowAdd : ctx.showAddModal;

  const setShowAdd = propsSetShowAdd || ctx.setShowAddModal;

  const [wallet, setWallet] = useState(initialWallet);
  const [budgetRequests, setBudgetRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [localModalOpen, setLocalModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [sourceCashAccountId, setSourceCashAccountId] = useState('');

  const [cashAccounts, setCashAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState('');

  const [pageLoading, setPageLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');

  const isModalOpen = localModalOpen || !!showAdd;

  const selectedAccount = useMemo(
    () => cashAccounts.find((account) => account.id === sourceCashAccountId),
    [cashAccounts, sourceCashAccountId],
  );

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

  const loadCashAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError('');

    try {
      const res = await marketingListWalletCashAccounts();
      const normalized = normalizeCashAccountsPayload(res);

      setCashAccounts(normalized);

      if (normalized.length > 0) {
        setSourceCashAccountId((prev) => prev || normalized[0].id);
      }
    } catch (err) {
      setCashAccounts([]);
      setAccountsError(err?.message || 'Failed to load cash accounts.');
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    if (isModalOpen) {
      loadCashAccounts();
    }
  }, [isModalOpen, loadCashAccounts]);

  const openModal = () => {
    setLocalModalOpen(true);
    if (setShowAdd) setShowAdd(true);
  };

  const closeModal = () => {
    if (saving) return;

    setLocalModalOpen(false);
    if (setShowAdd) setShowAdd(false);

    setAmount('');
    setPurpose('');
    setSourceCashAccountId('');
    setAccountsError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      alert('Enter valid amount.');
      return;
    }

    if (!purpose.trim()) {
      alert('Purpose is required.');
      return;
    }

    if (!sourceCashAccountId) {
      alert('Select source cash account.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await marketingCreateBudgetRequest({
        amount: value,
        purpose: purpose.trim(),
        sourceAccountId: sourceCashAccountId,
        sourceAccountName: selectedAccount?.name || '',
        currencyCode: wallet.currencyCode || 'SAR',
      });

      closeModal();
      await loadPageData();

      alert('Budget top-up request has been sent to Admin Approvals.');
    } catch (err) {
      alert(err?.message || 'Failed to submit budget request.');
    } finally {
      setSaving(false);
    }
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
            onClick={openModal}
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

      {isModalOpen ? (
        <div className="mk-modal-overlay mk-modal-top">
          <div className="mk-modal-card mk-modal-sm">
            <div className="mk-modal-header">
              <h2>Request Budget Top-up</h2>

              <button
                type="button"
                className="mk-modal-close"
                onClick={closeModal}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mk-form-group">
                <label className="mk-label">Amount (SAR)</label>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  className="mk-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="mk-form-group">
                <label className="mk-label">Purpose</label>
                <input
                  type="text"
                  className="mk-input"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Meta ads campaign budget"
                />
              </div>

              <div className="mk-form-group">
                <label className="mk-label">Source Cash Account</label>
                <select
                  className="mk-input mk-input-focus"
                  value={sourceCashAccountId}
                  onChange={(e) => setSourceCashAccountId(e.target.value)}
                  disabled={accountsLoading}
                >
                  <option value="">
                    {accountsLoading ? 'Loading accounts...' : 'Select account...'}
                  </option>

                  {cashAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                      {Number.isFinite(account.balance)
                        ? ` — ${formatSar(account.balance)}`
                        : ''}
                    </option>
                  ))}
                </select>

                {accountsError ? (
                  <div className="mk-field-error">{accountsError}</div>
                ) : null}

                {!accountsLoading && cashAccounts.length === 0 ? (
                  <div className="mk-field-error">
                    No cash/bank accounts found. Add account from accounting module first.
                  </div>
                ) : null}
              </div>

              <div className="mk-wallet-request-note">
                This request will be sent to Admin Approvals. Wallet balance will update only after approval.
              </div>

              <div className="mk-modal-footer">
                <button
                  type="button"
                  className="mk-btn-secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="mk-btn-primary"
                  disabled={saving || accountsLoading || cashAccounts.length === 0}
                >
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style>
        {`
          .mk-wallet-request-note {
            margin-top: 10px;
            padding: 9px 10px;
            border-radius: 7px;
            border: 1px solid #fde68a;
            background: #fffbeb;
            color: #92400e;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.4;
          }
        `}
      </style>
    </div>
  );
};

export default ReferralManagement;