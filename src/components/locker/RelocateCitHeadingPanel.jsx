import React, { useState } from 'react';
import { apiFetch } from '../../services/api';
import {
    citRelocateDryRunView,
    isRelocateReasonValid,
    lockerCitErrorI18nKey,
} from '../../utils/lockerCitDisplay';

const RELOCATE_PATH = '/locker/cit/namespace/relocate';

/**
 * CIT heading relocate (owner / platform SA): reason → dry-run (full result shown,
 * nothing written) → explicit "Apply relocate". The colliding 1005 account is never
 * renamed, reparented or deleted by the backend.
 */
export default function RelocateCitHeadingPanel({ t, onApplied }) {
    const [reason, setReason] = useState('');
    const [dry, setDry] = useState(null);
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [confirmApply, setConfirmApply] = useState(false);
    const reasonOk = isRelocateReasonValid(reason);

    const errorText = (e) => {
        const key = lockerCitErrorI18nKey(e);
        return (key ? t(key) : '') || e?.message || t('record.relocateFailed');
    };

    const runDry = async () => {
        if (!reasonOk || busy) return;
        setBusy('dry');
        setErr('');
        setMsg('');
        setDry(null);
        try {
            const res = await apiFetch(RELOCATE_PATH, {
                method: 'POST',
                body: JSON.stringify({ dryRun: true, reason: reason.trim() }),
            });
            setDry(citRelocateDryRunView(res));
        } catch (e) {
            setErr(errorText(e));
        } finally {
            setBusy('');
        }
    };

    const runApply = async () => {
        if (!reasonOk || busy || !dry || dry.idempotent) return;
        setConfirmApply(false);
        setBusy('apply');
        setErr('');
        try {
            const res = await apiFetch(RELOCATE_PATH, {
                method: 'POST',
                body: JSON.stringify({ dryRun: false, reason: reason.trim() }),
            });
            const code = res?.heading?.code || dry.proposedCode || '';
            setDry(null);
            setMsg(t('record.relocateDone', { code }));
            if (typeof onApplied === 'function') await onApplied(res);
        } catch (e) {
            setErr(errorText(e));
        } finally {
            setBusy('');
        }
    };

    const box = {
        marginTop: 8,
        padding: 10,
        border: '1px solid #FCD34D',
        borderRadius: 8,
        background: '#FFFBEB',
        fontSize: '0.8rem',
        color: '#78350F',
    };

    return (
        <div style={{ marginTop: 8 }} data-testid="cit-relocate-panel">
            <p style={{ margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 600 }}>
                {t('record.relocateAction')}
            </p>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
                {t('record.relocateReasonLabel')}
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                    aria-label={t('record.relocateReasonLabel')}
                />
            </label>
            {!reasonOk ? (
                <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: '#64748B' }}>
                    {t('record.relocateReasonHint')}
                </p>
            ) : null}
            <button
                type="button"
                className="btn-secondary"
                disabled={!reasonOk || !!busy}
                onClick={() => void runDry()}
            >
                {busy === 'dry' ? t('record.relocateDryRunBusy') : t('record.relocateDryRun')}
            </button>

            {dry ? (
                <div style={box} role="region" aria-label={t('record.relocateDryTitle')}>
                    <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{t('record.relocateDryTitle')}</p>
                    {dry.idempotent ? (
                        <p style={{ margin: 0 }}>{t('record.relocateIdempotent', { code: dry.headingCode || '—' })}</p>
                    ) : (
                        <>
                            <p style={{ margin: '0 0 6px' }}>
                                {t('record.relocateProposed', { code: dry.proposedCode || '—' })}
                            </p>
                            {dry.colliding ? (
                                <div style={{ margin: '0 0 6px' }}>
                                    <p style={{ margin: '0 0 2px', fontWeight: 600 }}>
                                        {t('record.relocateCollidingTitle', { code: dry.colliding.code })}
                                    </p>
                                    <p style={{ margin: 0 }} data-testid="cit-relocate-colliding">
                                        {t('record.relocateCollidingLine', {
                                            id: dry.colliding.id,
                                            code: dry.colliding.code,
                                            name: dry.colliding.name || '—',
                                            type: dry.colliding.type || '—',
                                            lines: dry.colliding.postedLineCount,
                                            balance: dry.colliding.glBalance,
                                        })}
                                    </p>
                                </div>
                            ) : null}
                        </>
                    )}
                    <p style={{ margin: '6px 0 2px', fontWeight: 600 }}>{t('record.relocateOfficersTitle')}</p>
                    {dry.officers.length === 0 ? (
                        <p style={{ margin: 0 }}>{t('record.relocateNoOfficers')}</p>
                    ) : (
                        <ul style={{ margin: 0, paddingInlineStart: 18 }} data-testid="cit-relocate-officers">
                            {dry.officers.map((o) => (
                                <li key={o.officerUserId}>
                                    {o.code} — {o.name || o.officerUserId}
                                </li>
                            ))}
                        </ul>
                    )}
                    {!dry.idempotent ? (
                        confirmApply ? (
                            <div
                                role="dialog"
                                aria-labelledby="cit-relocate-confirm-title"
                                style={{ marginTop: 8, padding: 8, border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff' }}
                            >
                                <p id="cit-relocate-confirm-title" style={{ margin: '0 0 4px', fontWeight: 700 }}>
                                    {t('record.relocateConfirmTitle')}
                                </p>
                                <p style={{ margin: '0 0 8px' }}>{t('record.relocateConfirmBody')}</p>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        className="btn-primary"
                                        disabled={!reasonOk || !!busy}
                                        onClick={() => void runApply()}
                                    >
                                        {busy === 'apply' ? t('record.relocateApplyBusy') : t('record.relocateConfirmYes')}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        disabled={!!busy}
                                        onClick={() => setConfirmApply(false)}
                                    >
                                        {t('record.relocateConfirmNo')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="btn-primary"
                                style={{ marginTop: 8 }}
                                disabled={!reasonOk || !!busy}
                                onClick={() => setConfirmApply(true)}
                            >
                                {t('record.relocateApply')}
                            </button>
                        )
                    ) : null}
                </div>
            ) : null}

            {msg ? <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#15803D' }}>{msg}</p> : null}
            {err ? (
                <p role="alert" style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#B91C1C' }}>
                    {err}
                </p>
            ) : null}
        </div>
    );
}
