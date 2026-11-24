import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../services/api';

/**
 * H6: debounced live cash/bank balance hint data.
 * Refetch after posts and after the negative-cash toggle changes.
 */
export function useCashBalance({
  cashBankAccountId,
  coaAccountId,
  branchId,
  enabled = true,
  debounceMs = 300,
} = {}) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    available: null,
    allowNegative: false,
    accountCode: null,
    accountName: null,
  });
  const timer = useRef(null);
  const gen = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || (!cashBankAccountId && !coaAccountId)) {
      setState((s) => ({
        ...s,
        loading: false,
        available: null,
        error: null,
      }));
      return;
    }
    const my = ++gen.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const qs = new URLSearchParams();
      if (cashBankAccountId) qs.set('cashBankAccountId', String(cashBankAccountId));
      if (coaAccountId) qs.set('coaAccountId', String(coaAccountId));
      if (branchId) qs.set('branchId', String(branchId));
      const res = await apiFetch(
        `/workshop-accounting/cash-balance?${qs.toString()}`,
      );
      if (my !== gen.current) return;
      setState({
        loading: false,
        error: null,
        available: Number(res?.available ?? 0),
        allowNegative: Boolean(res?.allowNegative),
        accountCode: res?.accountCode ?? null,
        accountName: res?.accountName ?? null,
      });
    } catch (err) {
      if (my !== gen.current) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: err,
      }));
    }
  }, [enabled, cashBankAccountId, coaAccountId, branchId]);

  const refetch = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void load();
    }, debounceMs);
  }, [load, debounceMs]);

  useEffect(() => {
    refetch();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refetch]);

  return { ...state, refetch, reload: refetch };
}

/** Shared 409 handler for INSUFFICIENT_CASH_BALANCE. */
export function handleCashGuard409(err, locale = 'en') {
  const body = err?.body || err?.data || err || {};
  const code = body?.code || body?.error?.code;
  if (code !== 'INSUFFICIENT_CASH_BALANCE') return null;
  const isAr = String(locale).toLowerCase().startsWith('ar');
  return {
    code,
    available: body.available,
    required: body.required,
    shortBy: body.shortBy,
    canSaveDraft: Boolean(body.canSaveDraft),
    message:
      (isAr ? body.messageAr : body.messageEn) ||
      body.message ||
      (isAr
        ? 'الرصيد غير كافٍ — يمكن الحفظ كمسودة فقط ولا يمكن الترحيل'
        : 'Insufficient balance — can be saved as draft only, cannot be posted'),
  };
}
