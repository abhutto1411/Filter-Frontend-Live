import React, { useState } from 'react';
import { validateReverseReason } from '../../../utils/journalAuditDisplay';

/**
 * Inline Reverse confirm (no modal): date + reason 3–500 + Confirm / Cancel.
 * Date left empty uses the server default (original date if the period is open).
 */
export default function JournalReversePanel({
    t,
    defaultDate = '',
    busy = false,
    error = '',
    onConfirm,
    onCancel,
}) {
    const [date, setDate] = useState(defaultDate || '');
    const [reason, setReason] = useState('');

    const check = validateReverseReason(reason);

    const submit = (e) => {
        e?.preventDefault?.();
        if (busy || !check.ok) return;
        onConfirm?.({ date: date || undefined, reason: check.value });
    };

    return (
        <form className="gj-reverse-panel" onSubmit={submit}>
            <p className="gj-reverse-panel__lead">{t('gj.reverse.sure')}</p>
            <label className="gj-field">
                <span>{t('gj.reverse.date')}</span>
                <input
                    type="date"
                    value={date}
                    disabled={busy}
                    onChange={(e) => setDate(e.target.value)}
                />
            </label>
            <label className="gj-field">
                <span>{t('gj.reverse.reason')}</span>
                <textarea
                    rows={3}
                    value={reason}
                    disabled={busy}
                    maxLength={500}
                    placeholder={t('gj.reverse.reasonPh')}
                    onChange={(e) => setReason(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.stopPropagation();
                            onCancel?.();
                        }
                    }}
                />
            </label>
            {reason.trim() && !check.ok ? (
                <p className="gj-inline-err" role="alert">{t(check.errorKey)}</p>
            ) : null}
            {error ? (
                <p className="gj-inline-err" role="alert">{error}</p>
            ) : null}
            <div className="gj-reverse-panel__actions">
                <button
                    type="submit"
                    className="btn-submit btn-dark"
                    disabled={busy || !check.ok}
                >
                    {busy ? t('gj.reverse.saving') : t('gj.reverse.confirm')}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={busy}
                    onClick={() => onCancel?.()}
                >
                    {t('gj.reverse.cancel')}
                </button>
            </div>
        </form>
    );
}
