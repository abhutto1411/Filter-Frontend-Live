import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Loader2, ShieldMinus } from 'lucide-react';
import {
    reconcileAdminWalletToGl,
    setAdminWalletNegativeLimit,
} from '../../services/adminWalletApi';

const fmt = (n) =>
    Number(n ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

/**
 * W2/W3: books (GL) balance, wallet-vs-books drift with "Reconcile to books",
 * and the wallet's minus limit. Inline only (no modals). Mutations are
 * Super Admin only on the server; other roles see the server's message.
 */
export default function WalletBooksPanel({ userId, wallet, onChanged, t }) {
    const glBalance = wallet?.glBalance;
    const cached = Number(wallet?.balance ?? 0);
    const drift = Number(wallet?.drift ?? 0);
    const hasGl = glBalance != null;

    const [limitInput, setLimitInput] = useState('');
    const [limitReason, setLimitReason] = useState('');
    const [reconReason, setReconReason] = useState('');
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');

    useEffect(() => {
        setLimitInput(String(Number(wallet?.negativeLimit ?? 0)));
        setLimitReason('');
        setReconReason('');
        setMsg('');
        setErr('');
    }, [userId, wallet?.negativeLimit]);

    if (!wallet) return null;

    const run = async (kind, fn) => {
        setBusy(kind);
        setErr('');
        setMsg('');
        try {
            const res = await fn();
            setMsg(res?.message || t('books.saved'));
            if (onChanged) await onChanged();
        } catch (e) {
            setErr(e?.message || t('books.failed'));
        } finally {
            setBusy('');
        }
    };

    const limitNum = Number(limitInput);
    const limitValid = limitInput !== '' && Number.isFinite(limitNum) && limitNum >= 0;
    const limitChanged = limitValid && limitNum !== Number(wallet?.negativeLimit ?? 0);

    return (
        <div className="ui-stack" style={{ gap: 10 }}>
            {hasGl ? (
                <div className="ui-fieldro">
                    <span className="ui-fieldro-label">
                        <BookOpen size={12} /> {t('books.glBalance')}
                    </span>
                    <span
                        className="ui-fieldro-value"
                        style={{ color: Number(glBalance) < 0 ? '#b91c1c' : undefined, fontWeight: 700 }}
                    >
                        SAR {fmt(glBalance)}
                    </span>
                </div>
            ) : null}

            {hasGl && Math.abs(drift) >= 0.005 ? (
                <div className="ui-banner ui-banner--warn" role="status" style={{ alignItems: 'flex-start' }}>
                    <AlertTriangle size={15} />
                    <div style={{ flex: 1 }}>
                        <div>
                            {t('books.drift', {
                                wallet: fmt(cached),
                                gl: fmt(glBalance),
                                drift: fmt(drift),
                            })}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            <input
                                className="ui-input"
                                style={{ flex: '1 1 220px', minWidth: 0 }}
                                placeholder={t('books.reasonPh')}
                                value={reconReason}
                                onChange={(e) => setReconReason(e.target.value)}
                                disabled={busy !== ''}
                            />
                            <button
                                type="button"
                                className="ui-btn ui-btn--primary"
                                disabled={busy !== '' || reconReason.trim().length < 5}
                                onClick={() =>
                                    run('recon', () => reconcileAdminWalletToGl(userId, reconReason.trim()))
                                }
                            >
                                {busy === 'recon' ? <Loader2 className="ui-spin" size={14} /> : null}
                                {t('books.reconcile')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="ui-fieldro" style={{ alignItems: 'flex-start' }}>
                <span className="ui-fieldro-label">
                    <ShieldMinus size={12} /> {t('books.minusLimit')}
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                    <input
                        className="ui-input"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        style={{ width: 120 }}
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        disabled={busy !== ''}
                        aria-label={t('books.minusLimit')}
                    />
                    {limitChanged ? (
                        <>
                            <input
                                className="ui-input"
                                style={{ flex: '1 1 160px', minWidth: 0 }}
                                placeholder={t('books.limitReasonPh')}
                                value={limitReason}
                                onChange={(e) => setLimitReason(e.target.value)}
                                disabled={busy !== ''}
                            />
                            <button
                                type="button"
                                className="ui-btn ui-btn--primary"
                                disabled={busy !== ''}
                                onClick={() =>
                                    run('limit', () =>
                                        setAdminWalletNegativeLimit(userId, limitNum, limitReason.trim()),
                                    )
                                }
                            >
                                {busy === 'limit' ? <Loader2 className="ui-spin" size={14} /> : null}
                                {t('books.saveLimit')}
                            </button>
                        </>
                    ) : null}
                </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{t('books.limitHelp')}</p>

            {msg ? <div className="ui-banner ui-banner--ok" role="status">{msg}</div> : null}
            {err ? <div className="ui-banner ui-banner--dang" role="alert">{err}</div> : null}
        </div>
    );
}
