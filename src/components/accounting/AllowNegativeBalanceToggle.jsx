import { useState } from 'react';
import {
    buildAllowNegativePatch,
    canEditAllowNegative,
    permissionTooltipKey,
    reasonAcceptable,
    reduceAllowNegative,
} from '../../utils/allowNegativeBalance';

/**
 * Per-register "Allow negative balance" toggle.
 * Turning ON asks for a reason in a confirm dialog. Turning OFF asks for a reason only.
 */
export default function AllowNegativeBalanceToggle({
    account,
    user,
    isHq = false,
    hasPermission,
    t,
    locale = 'en',
    onSave,
    onSaved,
}) {
    const on = account?.allowNegativeBalance === true;
    const canChange = canEditAllowNegative({ user, isHq, hasPermission });
    const [state, setState] = useState({ on, pending: null, reason: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const view = state.on === on || state.pending ? state : { on, pending: null, reason: '' };
    const tooltip = canChange ? t('cb.neg.label') : t(permissionTooltipKey());

    const request = (nextOn) => {
        setError('');
        setToast('');
        setState((s) =>
            reduceAllowNegative(
                { ...s, on },
                { type: nextOn ? 'request-on' : 'request-off', canChange },
            ),
        );
    };

    const confirm = async () => {
        if (!reasonAcceptable(view.reason)) return;
        const next = view.pending === 'on';
        setBusy(true);
        setError('');
        try {
            await onSave(account.id, buildAllowNegativePatch({
                allowNegativeBalance: next,
                reason: view.reason,
            }));
            setState({ on: next, pending: null, reason: '' });
            setToast(t('cb.neg.saved'));
            onSaved?.(next);
        } catch (e) {
            const isAr = String(locale || '').startsWith('ar');
            setError((isAr && (e?.messageAr || e?.body?.messageAr)) || e?.message || t('cb.neg.label'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ marginTop: 6 }} dir="auto">
            <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                title={tooltip}
            >
                <input
                    type="checkbox"
                    checked={on}
                    disabled={!canChange || busy}
                    onChange={(e) => request(e.target.checked)}
                    aria-label={t('cb.neg.label')}
                />
                <span>{t('cb.neg.label')}</span>
            </label>
            {on ? (
                <span
                    style={{
                        marginInlineStart: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#92400e',
                        background: '#fef3c7',
                        borderRadius: 4,
                        padding: '1px 6px',
                    }}
                >
                    {t('cb.neg.chip')}
                </span>
            ) : null}
            {view.pending ? (
                <div role="dialog" aria-modal="true" style={{ marginTop: 8, maxWidth: 360 }}>
                    {view.pending === 'on' ? (
                        <p role="alert" style={{ margin: '0 0 8px', color: '#92400e', fontSize: 12 }}>
                            {t('cb.neg.confirmOn')}
                        </p>
                    ) : null}
                    <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                        <span>{t('cb.neg.reason')}</span>
                        <input
                            type="text"
                            value={view.reason}
                            onChange={(e) =>
                                setState((s) => reduceAllowNegative(s, { type: 'reason', reason: e.target.value }))
                            }
                        />
                    </label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button type="button" disabled={busy || !reasonAcceptable(view.reason)} onClick={confirm}>
                            {t('cb.neg.save')}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setState((s) => reduceAllowNegative(s, { type: 'cancel' }))}
                        >
                            {t('cb.neg.cancel')}
                        </button>
                    </div>
                </div>
            ) : null}
            {error ? (
                <p role="alert" style={{ color: '#b91c1c', fontSize: 12, margin: '6px 0 0' }}>{error}</p>
            ) : null}
            {toast ? (
                <p role="status" style={{ color: '#047857', fontSize: 12, margin: '6px 0 0' }}>{toast}</p>
            ) : null}
        </div>
    );
}
