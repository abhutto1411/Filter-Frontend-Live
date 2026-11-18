import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupplierJournalsBySource } from '../../services/supplierAccountingApi';
import { spT } from '../../utils/supplierPortalI18n';

/**
 * Money documents must show a journal number or a red “not posted” chip —
 * never a silent hook.
 */
export default function SupplierJournalChip({
    journalEntryNumber,
    journalId,
    locale = 'en',
}) {
    const number = String(journalEntryNumber || '').trim();
    const posted = Boolean(number || journalId);
    const label = posted
        ? number || String(journalId)
        : spT(locale, 'chip.notPosted');
    return (
        <span
            className={`sp-journal-chip${posted ? '' : ' sp-journal-chip--missing'}`}
            data-journal-posted={posted ? '1' : '0'}
            title={label}
        >
            {label}
        </span>
    );
}

/**
 * SP-19 — journal chips on a document header (sales invoice: revenue + COGS; bill: purchase /
 * clearing; expense; return …). Read-only lookup (`journals/by-source`) — it never creates or
 * syncs a journal. Each chip opens the existing journal voucher; no journal ⇒ red "not posted".
 */
export function DocumentJournalChips({ sources, sourceId, locale = 'en' }) {
    const navigate = useNavigate();
    const [journals, setJournals] = useState(null);
    const key = `${(sources || []).join(',')}:${sourceId ?? ''}`;
    useEffect(() => {
        if (!sourceId || !sources?.length) return undefined;
        let cancelled = false;
        getSupplierJournalsBySource(sources, sourceId)
            .then((res) => !cancelled && setJournals(Array.isArray(res?.journals) ? res.journals : []))
            .catch(() => !cancelled && setJournals([]));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    if (!sourceId || journals == null) return null;
    if (!journals.length) return <SupplierJournalChip locale={locale} />;
    return (
        <span className="sp-doc-chips">
            {journals.map((j) => (
                <button
                    key={j.id}
                    type="button"
                    className="sp-doc-chip-btn"
                    title={spT(locale, 'chip.openJournal')}
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(j.href);
                    }}
                >
                    <span className="sp-doc-chip-src">{spT(locale, `chip.src.${j.source}`)}</span>
                    <SupplierJournalChip journalId={j.id} journalEntryNumber={j.entryNumber} locale={locale} />
                </button>
            ))}
        </span>
    );
}
