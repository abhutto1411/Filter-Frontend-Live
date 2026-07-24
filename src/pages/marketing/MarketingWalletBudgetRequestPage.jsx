import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  marketingCreateBudgetRequest,
  marketingGetWallet,
  marketingListWalletCashAccounts,
} from '../../services/superAdminMarketingApi';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import './MarketingUniversal.css';

function formatSar(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0 SAR';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR`;
}

function normalizeWalletPayload(res) {
  return {
    balance: Number(res?.balance ?? res?.walletBalance ?? 0),
    currencyCode: res?.currencyCode || res?.currency_code || 'SAR',
    totalFunded: Number(res?.totalFunded ?? res?.total_funded ?? 0),
    totalSpent: Number(res?.totalSpent ?? res?.total_spent ?? 0),
  };
}

function normalizeCashAccountsPayload(res) {
  const rows = Array.isArray(res)
    ? res
    : Array.isArray(res?.accounts)
      ? res.accounts
      : Array.isArray(res?.cashAccounts)
        ? res.cashAccounts
        : Array.isArray(res?.data)
          ? res.data
          : [];

  return rows.map((row) => {
    const id = String(row.id || row.accountId || row.account_id || '');
    const name = row.name || row.accountName || row.account_name || 'Account';
    const code = row.code || row.accountCode || row.account_code || '';
    return {
      id,
      name,
      label: code ? `${name} (${code})` : name,
      balance: Number(row.balance ?? row.currentBalance ?? 0),
    };
  });
}

export default function MarketingWalletBudgetRequestPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const section = location.pathname.includes('marketing-wallet')
    ? 'marketing-wallet'
    : 'referral-management';
  const listPath = marketingSectionPath(location.pathname, section);

  const [wallet, setWallet] = useState({ currencyCode: 'SAR' });
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [sourceCashAccountId, setSourceCashAccountId] = useState('');
  const [cashAccounts, setCashAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedAccount = useMemo(
    () => cashAccounts.find((account) => account.id === sourceCashAccountId),
    [cashAccounts, sourceCashAccountId],
  );

  const goBack = () => navigate(listPath);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const walletRes = await marketingGetWallet();
        if (!cancelled) setWallet(normalizeWalletPayload(walletRes));
      } catch {
        /* optional */
      }

      try {
        setAccountsLoading(true);
        setAccountsError('');
        const res = await marketingListWalletCashAccounts();
        if (cancelled) return;
        const normalized = normalizeCashAccountsPayload(res);
        setCashAccounts(normalized);
        if (normalized.length > 0) {
          setSourceCashAccountId(normalized[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setAccountsError(err?.message || 'Failed to load cash accounts.');
        }
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
    try {
      await marketingCreateBudgetRequest({
        amount: value,
        purpose: purpose.trim(),
        sourceAccountId: sourceCashAccountId,
        sourceAccountName: selectedAccount?.name || '',
        currencyCode: wallet.currencyCode || 'SAR',
      });
      alert('Budget top-up request has been sent to Super Admin Approvals.');
      goBack();
    } catch (err) {
      alert(err?.message || 'Failed to submit budget request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingFormShell
      title="Request Budget Top-up"
      subtitle="Submit a wallet top-up request. Balance updates only after Super Admin approval."
      backLabel="Back to Marketing Wallet"
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      <form onSubmit={handleSubmit} className="mkp-form-page-body">
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
          {accountsError ? <div className="mk-field-error">{accountsError}</div> : null}
          {!accountsLoading && cashAccounts.length === 0 ? (
            <div className="mk-field-error">
              No cash/bank accounts found. Add account from accounting module first.
            </div>
          ) : null}
        </div>

        <div className="mk-wallet-request-note">
          This request will be sent to Super Admin Approvals. Wallet balance will update only
          after approval.
        </div>

        <div className="mkp-form-page-footer">
          <button
            type="button"
            className="mk-btn-secondary"
            onClick={goBack}
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
    </MarketingFormShell>
  );
}
