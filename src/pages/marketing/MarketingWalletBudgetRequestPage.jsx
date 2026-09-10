import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  marketingCreateBudgetRequest,
  marketingGetWallet,
  marketingListWalletCashAccounts,
} from '../../services/superAdminMarketingApi';
import { refMgtT } from '../../utils/referralManagementI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import './MarketingUniversal.css';

function formatSar(value, locale = 'en') {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return refMgtT(locale, 'format.sar', { amount: '0' });
  }
  return refMgtT(locale, 'format.sar', {
    amount: n.toLocaleString(locale === 'ar' ? 'ar-SA' : undefined, {
      maximumFractionDigits: 0,
    }),
  });
}

function normalizeWalletPayload(res) {
  return {
    balance: Number(res?.balance ?? res?.walletBalance ?? 0),
    currencyCode: res?.currencyCode || res?.currency_code || 'SAR',
    totalFunded: Number(res?.totalFunded ?? res?.total_funded ?? 0),
    totalSpent: Number(res?.totalSpent ?? res?.total_spent ?? 0),
  };
}

function normalizeCashAccountsPayload(res, locale = 'en') {
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
    const name =
      row.name ||
      row.accountName ||
      row.account_name ||
      refMgtT(locale, 'form.fallbackAccount');
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
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => refMgtT(locale, key, vars), [locale]);

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
        const normalized = normalizeCashAccountsPayload(res, locale);
        setCashAccounts(normalized);
        if (normalized.length > 0) {
          setSourceCashAccountId(normalized[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setAccountsError(err?.message || t('err.loadAccounts'));
        }
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      alert(t('alert.amountInvalid'));
      return;
    }
    if (!purpose.trim()) {
      alert(t('alert.purposeRequired'));
      return;
    }
    if (!sourceCashAccountId) {
      alert(t('alert.selectAccount'));
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
      alert(t('alert.success'));
      goBack();
    } catch (err) {
      alert(err?.message || t('err.submit'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingFormShell
      title={t('form.title')}
      subtitle={t('form.subtitle')}
      backLabel={t('form.back')}
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      <form
        onSubmit={handleSubmit}
        className="mkp-form-page-body"
        dir={locale === 'ar' ? 'rtl' : undefined}
      >
        <div className="mk-form-group">
          <label className="mk-label">{t('form.amount')}</label>
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
          <label className="mk-label">{t('form.purpose')}</label>
          <input
            type="text"
            className="mk-input"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={t('form.purposePlaceholder')}
          />
        </div>

        <div className="mk-form-group">
          <label className="mk-label">{t('form.sourceAccount')}</label>
          <select
            className="mk-input mk-input-focus"
            value={sourceCashAccountId}
            onChange={(e) => setSourceCashAccountId(e.target.value)}
            disabled={accountsLoading}
          >
            <option value="">
              {accountsLoading ? t('form.loadingAccounts') : t('form.selectAccount')}
            </option>
            {cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
                {Number.isFinite(account.balance)
                  ? ` — ${formatSar(account.balance, locale)}`
                  : ''}
              </option>
            ))}
          </select>
          {accountsError ? <div className="mk-field-error">{accountsError}</div> : null}
          {!accountsLoading && cashAccounts.length === 0 ? (
            <div className="mk-field-error">{t('form.noAccounts')}</div>
          ) : null}
        </div>

        <div className="mk-wallet-request-note">{t('form.note')}</div>

        <div className="mkp-form-page-footer">
          <button
            type="button"
            className="mk-btn-secondary"
            onClick={goBack}
            disabled={saving}
          >
            {t('form.cancel')}
          </button>
          <button
            type="submit"
            className="mk-btn-primary"
            disabled={saving || accountsLoading || cashAccounts.length === 0}
          >
            {saving ? t('form.submitting') : t('form.submit')}
          </button>
        </div>
      </form>
    </MarketingFormShell>
  );
}
