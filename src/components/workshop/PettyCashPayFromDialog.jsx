import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fundSourceForRegister,
  payFromOptionLabel,
} from '../../utils/pettyCashWalletsDisplay';
import { listPayFromOptions } from '../../services/employeeExpenseApi';
import CashBalanceHint, {
  cashHintBlocksPost,
} from '../accounting/CashBalanceHint';
import { useCashBalance } from '../../hooks/useCashBalance';
import RiyalIcon from '../RiyalIcon';

function FmtMoney({ amount }) {
  const v = Number(amount);
  if (!Number.isFinite(v)) {
    return (
      <>
        <RiyalIcon size={12} /> <bdi dir="ltr">—</bdi>
      </>
    );
  }
  return (
    <>
      <RiyalIcon size={12} />{' '}
      <bdi dir="ltr">{v.toFixed(2)}</bdi>
    </>
  );
}

function fmtMoneyText(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(2);
}

/**
 * Shared approve dialog: forces pay-from (Top Up = account only;
 * expense/advance can choose wallet or company account).
 * D9: no unscoped fallback; stable scope key; keep selection on busy/error.
 */
export default function PettyCashPayFromDialog({
  open,
  request,
  locale = 'en',
  onCancel,
  onConfirm,
  busy = false,
  error = '',
  scopeParams = {},
}) {
  const ar = String(locale || '').toLowerCase().startsWith('ar');
  const isTopUp =
    request?.payToType === 'fund_replenishment' ||
    request?.kind === 'fund_request' ||
    request?.isTopUp;
  const isExpense =
    !isTopUp &&
    (request?.payToType === 'other' ||
      request?.payToType === 'salary_advance' ||
      request?.isExpense);
  const isAdvance = request?.payToType === 'salary_advance';

  const [mode, setMode] = useState(isTopUp ? 'account' : '');
  const [accounts, setAccounts] = useState([]);
  const [walletOption, setWalletOption] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(false);

  const scopeKey = useMemo(
    () => JSON.stringify(scopeParams || {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(scopeParams || {})],
  );

  const t = useCallback(
    (en, arText) => (ar ? arText : en),
    [ar],
  );

  useEffect(() => {
    if (!open || !request?.id) return undefined;
    // D9: never clear selection while busy (parent re-render during approve).
    if (busy) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadErr('');
      try {
        const res = await listPayFromOptions(
          request.id,
          JSON.parse(scopeKey || '{}'),
        );
        if (cancelled) return;
        const opts = Array.isArray(res?.options) ? res.options : [];
        setAccounts(opts);
        setWalletOption(res?.walletOption || null);
        const suggested = res?.suggestedAccountId
          ? String(res.suggestedAccountId)
          : '';
        setSelectedId((prev) => {
          if (prev && opts.some((a) => String(a.id) === String(prev))) {
            return prev;
          }
          if (suggested && opts.some((a) => String(a.id) === suggested)) {
            return suggested;
          }
          return '';
        });
        setMode((prev) => {
          if (isTopUp) return 'account';
          if (prev === 'wallet' || prev === 'account') return prev;
          return '';
        });
      } catch (e) {
        if (cancelled) return;
        setAccounts([]);
        setWalletOption(null);
        setLoadErr(
          e?.message || t('Failed to load accounts', 'تعذر تحميل الحسابات'),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, request?.id, isTopUp, scopeKey, busy, t]);

  const selected = useMemo(
    () => accounts.find((a) => String(a.id) === String(selectedId)),
    [accounts, selectedId],
  );

  const amount = Number(request?.amount ?? request?.grandTotal ?? 0);

  const live = useCashBalance({
    cashBankAccountId: mode === 'account' ? selectedId : null,
    enabled: open && mode === 'account' && Boolean(selectedId),
  });

  const available =
    mode === 'wallet'
      ? walletOption?.available
      : live.available != null
        ? live.available
        : selected?.available;
  const allowNegative =
    mode === 'wallet' ? false : Boolean(selected?.allowNegative ?? live.allowNegative);

  const hintBlocked = cashHintBlocksPost({
    available,
    required: amount,
    allowNegative,
  });

  const canApprove =
    !busy &&
    !loading &&
    !loadErr &&
    !hintBlocked &&
    ((mode === 'wallet' && isExpense && walletOption) ||
      (mode === 'account' && selected));

  const entryHint = useMemo(() => {
    if (mode === 'wallet') {
      return t(
        'Dr Expense / Cr Requester petty-cash wallet',
        'مدين مصروف / دائن محفظة العهدة',
      );
    }
    if (selected) {
      const name = selected.name || selected.label || selected.id;
      if (isExpense || isAdvance) {
        const dr = isAdvance
          ? t('employee advance', 'سلفة موظف')
          : t('expense', 'مصروف');
        return t(
          `Dr ${dr} / Cr ${name}`,
          `مدين ${dr} / دائن ${name}`,
        );
      }
      return t(
        `Dr Petty cash wallet / Cr ${name}`,
        `مدين محفظة العهدة / دائن ${name}`,
      );
    }
    return '';
  }, [mode, selected, t, isExpense, isAdvance]);

  if (!open || !request) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          maxWidth: 440,
          width: '100%',
          padding: 20,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          fontFamily: ar ? '"Noto Naskh Arabic", serif' : 'inherit',
        }}
      >
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: 18,
            fontFamily: ar ? 'Cairo, sans-serif' : 'inherit',
          }}
        >
          {t('Choose pay-from', 'اختر مصدر الدفع')}
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>
          {t('Amount', 'المبلغ')}: <FmtMoney amount={amount} />
          {request.description ? ` · ${request.description}` : ''}
        </p>

        {isExpense ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="radio"
                name="payFromMode"
                checked={mode === 'wallet'}
                onChange={() => {
                  setMode('wallet');
                  setSelectedId('');
                }}
              />
              {t("From requester's wallet", 'من محفظة مقدم الطلب')}
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="radio"
                name="payFromMode"
                checked={mode === 'account'}
                onChange={() => setMode('account')}
              />
              {t('From a company account', 'من حساب الشركة')}
            </label>
          </div>
        ) : null}

        {mode === 'wallet' && walletOption ? (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, margin: '0 0 6px' }}>
              {walletOption.name} · <FmtMoney amount={walletOption.available} />
            </p>
            <CashBalanceHint
              locale={locale}
              available={walletOption.available}
              required={amount}
              allowNegative={false}
              loading={false}
            />
          </div>
        ) : null}

        {(mode === 'account' || isTopUp) && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
              {t('Paying account', 'حساب الدفع')}
            </label>
            {loading ? (
              <p style={{ fontSize: 13 }}>{t('Loading…', 'جاري التحميل…')}</p>
            ) : (
              <select
                className="form-input"
                style={{ width: '100%', minHeight: 42 }}
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">
                  {t('Select account…', 'اختر حساباً…')}
                </option>
                {accounts.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {payFromOptionLabel(a, null)}
                    {a.available != null ? ` · ${fmtMoneyText(a.available)}` : ''}
                  </option>
                ))}
              </select>
            )}
            {selected ? (
              <CashBalanceHint
                locale={locale}
                available={available}
                required={amount}
                allowNegative={allowNegative}
                loading={live.loading}
                className="pc-payfrom-hint"
              />
            ) : null}
          </div>
        )}

        {entryHint ? (
          <p
            style={{
              fontSize: 13,
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '8px 10px',
              marginBottom: 12,
            }}
          >
            {entryHint}
          </p>
        ) : null}

        {(error || loadErr) && (
          <p role="alert" style={{ color: '#B91C1C', fontSize: 13 }}>
            {error || loadErr}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn-portal-outline" onClick={onCancel} disabled={busy}>
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            type="button"
            className="btn-submit btn-dark"
            disabled={!canApprove}
            onClick={() => {
              if (mode === 'wallet') {
                onConfirm({ payFromMode: 'wallet' });
                return;
              }
              if (!selected) return;
              onConfirm({
                payFromMode: 'account',
                payFromAccountId: String(selected.id),
                fundSource: fundSourceForRegister(selected),
              });
            }}
          >
            {busy ? t('Approving…', 'جاري الاعتماد…') : t('Approve', 'اعتماد')}
          </button>
        </div>
      </div>
    </div>
  );
}
