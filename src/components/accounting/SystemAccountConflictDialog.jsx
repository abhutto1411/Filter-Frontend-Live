import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../services/api';
import { accT } from '../../utils/accountingI18n';
import {
  mergeSystemAccountConflict,
  pickSystemAccountConflictDetails,
  systemAccountConflictType,
} from '../../utils/systemAccountConflict';

/**
 * Resolve SYSTEM_ACCOUNT_CODE_CONFLICT: show which account holds the code, pick a free
 * code (suggested or typed), POST resolve, then the caller retries with the same key.
 * Incomplete 409 payloads (older API) are completed from GET /accounts/system-accounts/conflicts;
 * a missing suggestion is fetched from GET /accounts/next-code.
 */
export default function SystemAccountConflictDialog({
  open,
  conflict,
  locale = 'en',
  canWriteCoa = true,
  onClose,
  onResolved,
}) {
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const [details, setDetails] = useState(conflict || null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [suggested, setSuggested] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [code, setCode] = useState('');
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const typedRef = useRef(false);

  const fetchSuggestion = useCallback(async (d) => {
    const qs = new URLSearchParams({ type: systemAccountConflictType(d) });
    if (d?.roleSubType) qs.set('subType', String(d.roleSubType));
    if (d?.preferredCode) qs.set('near', String(d.preferredCode));
    const res = await apiFetch(`/accounts/next-code?${qs.toString()}`);
    return String(res?.suggestedCode || res?.code || '');
  }, []);

  // Open: complete the payload if needed, then make sure there is a suggestion and prefill it.
  useEffect(() => {
    if (!open || !conflict) return undefined;
    let cancelled = false;
    typedRef.current = false;
    setDetails(conflict);
    setSuggested(String(conflict.suggestedCode || ''));
    setCode(String(conflict.suggestedCode || ''));
    setCheck(null);
    setErr('');
    (async () => {
      let d = conflict;
      if (!d.role || !d.conflictingAccount?.name) {
        setLoadingDetails(true);
        try {
          const list = await apiFetch('/accounts/system-accounts/conflicts');
          d = mergeSystemAccountConflict(d, pickSystemAccountConflictDetails(list, d));
        } catch {
          /* keep what we have */
        } finally {
          if (!cancelled) setLoadingDetails(false);
        }
        if (cancelled) return;
        setDetails(d);
      }
      let s = String(d.suggestedCode || '');
      if (!s && d.resolvable !== false && canWriteCoa) {
        setSuggesting(true);
        try {
          s = await fetchSuggestion(d);
        } catch {
          s = '';
        } finally {
          if (!cancelled) setSuggesting(false);
        }
      }
      if (cancelled) return;
      setSuggested(s);
      if (!typedRef.current) setCode(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, conflict, canWriteCoa, fetchSuggestion]);

  // Live availability check of the code in the box.
  useEffect(() => {
    if (!open || !code.trim() || details?.resolvable === false) {
      setCheck(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({
          type: systemAccountConflictType(details),
          check: code.trim(),
        });
        if (details?.roleSubType) qs.set('subType', String(details.roleSubType));
        if (details?.preferredCode) qs.set('near', String(details.preferredCode));
        const res = await apiFetch(`/accounts/next-code?${qs.toString()}`);
        if (!cancelled) setCheck(res);
      } catch {
        if (!cancelled) setCheck(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, open, details]);

  if (!open || !conflict) return null;

  const d = details || conflict;
  const conflicting = d.conflictingAccount || {};
  const canPickCode = canWriteCoa && d.resolvable !== false;
  const available = check ? check.available !== false && !check.reason : null;
  const roleKnown = Boolean(d.role);

  const useSuggested = async () => {
    typedRef.current = false;
    setErr('');
    if (suggested) {
      setCode(suggested);
      return;
    }
    setSuggesting(true);
    try {
      const s = await fetchSuggestion(d);
      setSuggested(s);
      if (s) setCode(s);
      else setErr(t('sysAcct.conflict.noSuggestion'));
    } catch (e) {
      setErr(e?.message || t('sysAcct.conflict.noSuggestion'));
    } finally {
      setSuggesting(false);
    }
  };

  const resolve = async () => {
    if (!canWriteCoa || !roleKnown) return;
    setBusy(true);
    setErr('');
    try {
      const res = await apiFetch('/accounts/system-accounts/resolve', {
        method: 'POST',
        body: JSON.stringify({ role: d.role, code: code.trim() }),
      });
      onResolved?.(res);
      onClose?.();
    } catch (e) {
      setErr(e?.message || t('sysAcct.err.resolve'));
    } finally {
      setBusy(false);
    }
  };

  const box = {
    margin: '0 0 12px',
    padding: '10px 12px',
    borderRadius: 8,
    background: '#FFF7ED',
    border: '1px solid #FED7AA',
    fontSize: '0.875rem',
    color: '#7C2D12',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sys-acct-conflict-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose?.();
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          direction: locale === 'ar' ? 'rtl' : 'ltr',
        }}
      >
        <h2 id="sys-acct-conflict-title" style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>
          {t('sysAcct.conflict.title')}
        </h2>

        {loadingDetails ? (
          <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.875rem' }}>{t('sysAcct.conflict.loading')}</p>
        ) : (
          <>
            <p style={{ margin: '0 0 10px', color: '#334155', fontSize: '0.9rem' }} data-testid="sys-acct-conflict-needs">
              {t('sysAcct.conflict.needs', {
                roleLabel: d.roleLabel || d.role || t('sysAcct.conflict.unknownRole'),
                preferredCode: d.preferredCode || '—',
              })}
            </p>
            <div style={box} data-testid="sys-acct-conflict-holder">
              <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>
                {t('sysAcct.conflict.usedBy', { code: conflicting.code || d.preferredCode || '—' })}
              </div>
              <div style={{ fontWeight: 700 }}>
                <bdi dir="ltr">{conflicting.code || d.preferredCode || '—'}</bdi> — {conflicting.name || '—'}
                {conflicting.type ? (
                  <span style={{ fontWeight: 400, color: '#9A3412' }}> · {conflicting.type}</span>
                ) : null}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: 4 }}>{t('sysAcct.conflict.keep')}</div>
            </div>
          </>
        )}

        {d.resolvable === false ? (
          <p style={{ color: '#b45309' }}>{t('sysAcct.conflict.renameOther')}</p>
        ) : !canWriteCoa ? (
          <p style={{ color: '#b45309' }}>{t('sysAcct.conflict.askOwner')}</p>
        ) : (
          <>
            <label htmlFor="sys-acct-conflict-code" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
              {t('sysAcct.conflict.codeLabel')}
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <input
                id="sys-acct-conflict-code"
                dir="ltr"
                autoFocus
                inputMode="numeric"
                autoComplete="off"
                aria-label={t('sysAcct.conflict.codeLabel')}
                value={code}
                placeholder={suggested || ''}
                onChange={(e) => {
                  typedRef.current = true;
                  setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 10));
                }}
                style={{
                  flex: '1 1 160px',
                  minWidth: 0,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  padding: '0 10px',
                }}
              />
              <button
                type="button"
                onClick={useSuggested}
                disabled={suggesting || busy}
                data-testid="sys-acct-use-suggested"
                style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}
              >
                {suggesting
                  ? t('sysAcct.conflict.suggesting')
                  : suggested
                    ? t('sysAcct.conflict.useSuggestedCode', { code: suggested })
                    : t('sysAcct.conflict.useSuggested')}
              </button>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: '#64748b' }}>{t('sysAcct.conflict.typeOwn')}</p>
            {check ? (
              <p
                data-testid="sys-acct-code-check"
                style={{ margin: '0 0 6px', fontSize: '0.75rem', color: available ? '#15803d' : '#dc2626' }}
              >
                {available
                  ? t('sysAcct.conflict.codeOk')
                  : t('sysAcct.conflict.codeBad', {
                      reason: t(`sysAcct.conflict.reason.${check.reason || 'taken'}`),
                    })}
              </p>
            ) : null}
            {!roleKnown && !loadingDetails ? (
              <p style={{ color: '#dc2626', fontSize: '0.8rem' }}>{t('sysAcct.conflict.roleUnknown')}</p>
            ) : null}
            {err ? <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{err}</p> : null}
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}
          >
            {t('sysAcct.conflict.cancel')}
          </button>
          {canPickCode ? (
            <button
              type="button"
              onClick={resolve}
              disabled={busy || !roleKnown || !code.trim() || available === false}
              style={{
                height: 36,
                background: '#0f172a',
                color: '#fff',
                border: 0,
                borderRadius: 8,
                padding: '0 14px',
                opacity: busy || !roleKnown || !code.trim() || available === false ? 0.6 : 1,
              }}
            >
              {busy ? t('sysAcct.conflict.busy') : t('sysAcct.conflict.confirm')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
