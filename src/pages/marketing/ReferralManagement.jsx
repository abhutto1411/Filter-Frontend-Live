import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { AlertTriangle, Inbox, Plus, Wallet } from 'lucide-react';
import {
  marketingGetWallet,
  marketingListBudgetRequests,
  marketingListWalletTransactions,
} from '../../services/superAdminMarketingApi';
import { refMgtStatusLabel, refMgtT } from '../../utils/referralManagementI18n';
import { marketingSectionPath } from './marketingRouteUtils';
import { BUSINESS_TIMEZONE } from '../../utils/riyadhBusinessRange';
import '../../styles/ui.css';

/** Both panels show a recent slice, not a full history. */
const RECENT_LIMIT = 20;

const initialWallet = {
  balance: 0,
  totalFunded: 0,
  totalSpent: 0,
  currencyCode: 'SAR',
};

function formatSar(value, locale = 'en') {
  const n = Number(value);
  const numberLocale = locale === 'ar' ? 'ar-SA' : undefined;

  if (!Number.isFinite(n)) {
    return refMgtT(locale, 'format.sar', { amount: '0' });
  }

  return refMgtT(locale, 'format.sar', {
    amount: n.toLocaleString(numberLocale, {
      maximumFractionDigits: 0,
    }),
  });
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

function normalizeTransactionsPayload(payload, locale = 'en') {
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
      refMgtT(locale, 'tx.fallbackTitle'),
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

/**
 * Rendered in the business timezone with an explicit format. A bare
 * toLocaleDateString() follows the viewer's own zone, so a top-up taken late
 * in the Riyadh day read as the day before on a machine set west of it.
 */
function formatDate(value, locale = 'en') {
  if (!value) return refMgtT(locale, 'dash');

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return refMgtT(locale, 'dash');

  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_TONE = {
  pending: 'warn',
  approved: 'ok',
  rejected: 'dang',
  completed: 'ok',
  cancelled: 'dang',
};

const StatusBadge = ({ status, locale }) => {
  const value = String(status || 'pending').toLowerCase();
  return (
    <span className={`ui-pill ui-pill--${STATUS_TONE[value] || 'warn'}`}>
      {refMgtStatusLabel(locale, value)}
    </span>
  );
};

/** The shape of a panel's rows while they load. */
const PanelSkeleton = ({ rows }) => (
  <ul className="ui-list" aria-busy="true">
    {Array.from({ length: rows }).map((_, i) => (
      <li key={`sk-${i}`} className="ui-list-row ui-sk-row">
        <div className="ui-list-main">
          <div className="ui-sk ui-sk--strong ui-sk--w40" />
          <div className="ui-sk ui-sk--text ui-sk--w70" />
        </div>
        <div className="ui-sk ui-sk--pill" />
      </li>
    ))}
  </ul>
);

export const ReferralManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => refMgtT(locale, key, vars), [locale]);

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
    return {
      pending: normalizeBudgetRequestsPayload(
        res?.pendingRequests || res?.pending_requests || [],
      ),
      transactions: normalizeTransactionsPayload(
        res?.recentTransactions || res?.recent_transactions || [],
        locale,
      ),
    };
  }, [locale]);

  const loadBudgetRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await marketingListBudgetRequests({
        limit: RECENT_LIMIT,
        offset: 0,
        status: 'all',
      });
      return { rows: normalizeBudgetRequestsPayload(res), ok: true };
    } catch (err) {
      setError(err?.message || t('err.loadRequests'));
      return { rows: [], ok: false };
    } finally {
      setRequestsLoading(false);
    }
  }, [t]);

  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const res = await marketingListWalletTransactions({
        limit: RECENT_LIMIT,
        offset: 0,
      });
      return { rows: normalizeTransactionsPayload(res, locale), ok: true };
    } catch (err) {
      setError(err?.message || t('err.loadTransactions'));
      return { rows: [], ok: false };
    } finally {
      setTransactionsLoading(false);
    }
  }, [locale, t]);

  const loadPageData = useCallback(async () => {
    setPageLoading(true);
    setError('');

    try {
      const [walletExtras, requests, txs] = await Promise.all([
        loadWallet().catch((err) => {
          setError(err?.message || t('err.loadWallet'));
          return { pending: [], transactions: [] };
        }),
        loadBudgetRequests(),
        loadTransactions(),
      ]);

      // The list wins when it answered; otherwise fall back to the copy the
      // wallet payload carries, so a failed list is not a blank panel.
      setBudgetRequests(
        requests.ok && requests.rows.length ? requests.rows : walletExtras.pending,
      );
      setTransactions(
        txs.ok && txs.rows.length ? txs.rows : walletExtras.transactions,
      );
    } finally {
      setPageLoading(false);
    }
  }, [loadWallet, loadBudgetRequests, loadTransactions, t]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const openBudgetRequestPage = () => {
    navigate(`${walletBase}/budget-request`);
  };

  const numberLocale = locale === 'ar' ? 'ar-SA' : undefined;
  const currencyDisplay =
    wallet.currencyCode === 'SAR' || !wallet.currencyCode
      ? t('wallet.currencySar')
      : wallet.currencyCode;

  return (
    <div className="ui-root ui-root--flush ui-stack" dir={locale === 'ar' ? 'rtl' : undefined}>
      <section className="ui-panel ui-panel-pad">
        <div className="ui-row">
          <div className="ui-stack-sm">
            <div className="ui-label">{t('wallet.label')}</div>

            <div className="ui-hero-figure">
              <span className="ui-hero-amount">
                {pageLoading ? (
                  <span className="ui-sk ui-sk--title ui-sk--w70" />
                ) : (
                  Number(wallet.balance).toLocaleString(numberLocale, {
                    maximumFractionDigits: 0,
                  })
                )}
              </span>
              <span className="ui-hero-unit">{currencyDisplay}</span>
            </div>

            <div className="ui-meta">
              <span>
                {t('wallet.totalFunded', {
                  amount: formatSar(wallet.totalFunded, locale),
                })}
              </span>
              <span>
                {t('wallet.totalSpent', {
                  amount: formatSar(wallet.totalSpent, locale),
                })}
              </span>
            </div>

            <div>
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                onClick={openBudgetRequestPage}
              >
                <Plus size={15} /> {t('wallet.requestTopup')}
              </button>
            </div>
          </div>

          <div className="ui-toolbar-end">
            <Wallet size={48} strokeWidth={1.6} className="ui-hero-icon" aria-hidden />
          </div>
        </div>
      </section>

      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="ui-panels">
        <section className="ui-panel">
          <div className="ui-panel-head">
            <span className="ui-panel-title">{t('requests.title')}</span>
          </div>

          {requestsLoading || pageLoading ? (
            <PanelSkeleton rows={3} />
          ) : budgetRequests.length === 0 ? (
            <div className="ui-empty">
              <div className="ui-empty-icon"><Inbox size={18} /></div>
              <div className="ui-empty-title">{t('requests.empty')}</div>
            </div>
          ) : (
            <ul className="ui-list">
              {budgetRequests.map((request) => (
                <li key={request.id} className="ui-list-row">
                  <div className="ui-list-main">
                    <span className="ui-list-title">
                      {formatSar(request.amount, locale)}
                    </span>
                    <span className="ui-list-meta">
                      {request.purpose || t('dash')}
                    </span>
                    {(request.accountName || request.accountCode) ? (
                      <span className="ui-list-meta">
                        {request.accountName}
                        {request.accountCode ? ` - ${request.accountCode}` : ''}
                      </span>
                    ) : null}
                    {request.createdAt ? (
                      <span className="ui-list-meta">
                        {formatDate(request.createdAt, locale)}
                      </span>
                    ) : null}
                  </div>

                  <div className="ui-list-end">
                    <StatusBadge status={request.status} locale={locale} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ui-panel">
          <div className="ui-panel-head">
            <span className="ui-panel-title">{t('tx.title')}</span>
          </div>

          {transactionsLoading || pageLoading ? (
            <PanelSkeleton rows={4} />
          ) : transactions.length === 0 ? (
            <div className="ui-empty">
              <div className="ui-empty-icon"><Inbox size={18} /></div>
              <div className="ui-empty-title">{t('tx.empty')}</div>
            </div>
          ) : (
            <ul className="ui-list">
              {transactions.map((transaction) => {
                const isDebit =
                  String(transaction.direction || '').toLowerCase() === 'debit' ||
                  String(transaction.type || '').toLowerCase() === 'spent';

                return (
                  <li key={transaction.id} className="ui-list-row">
                    <div className="ui-list-main">
                      <span className="ui-list-title">{transaction.title}</span>
                      <span className="ui-list-meta">
                        {formatDate(transaction.date, locale)}
                      </span>
                    </div>

                    <div
                      className={`ui-list-amount ui-money ui-money--${isDebit ? 'out' : 'in'}`}
                    >
                      {isDebit ? '-' : '+'}
                      {formatSar(transaction.amount, locale)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default ReferralManagement;
