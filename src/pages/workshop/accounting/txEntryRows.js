/**
 * Row checks shared by the PE / RV / JE entry grids (manual entry, import and paste).
 * Pure helpers (node --test).
 */

const filled = (v) => String(v ?? '').trim() !== '';

/**
 * True when the user typed / imported something on a PE / RV line. An account the form
 * auto-suggested (payee-type default) on an untouched line does not count.
 */
export function payRowStarted(r) {
    const userAccount = filled(r?.accountId) && String(r.accountId) !== String(r?.accountAutoFilled ?? '');
    return (
        userAccount ||
        filled(r?.amount) ||
        filled(r?.payeeId) ||
        filled(r?.payeeName) ||
        filled(r?.ref) ||
        filled(r?.notes)
    );
}

/**
 * 1-based numbers of PE / RV lines that were started but cannot be saved
 * (some data entered, but no account or no amount > 0). Untouched lines are ignored.
 */
export function incompletePayRows(rows) {
    const out = [];
    (Array.isArray(rows) ? rows : []).forEach((r, i) => {
        const amountOk = Number(r?.amount) > 0;
        const accountOk = filled(r?.accountId);
        if (payRowStarted(r) && !(amountOk && accountOk)) out.push(i + 1);
    });
    return out;
}

/**
 * 1-based numbers of JE lines that were started but are not a valid line
 * (needs an account and exactly one of Dr / Cr > 0). Fully blank lines are ignored.
 */
export function incompleteJournalRows(rows) {
    const out = [];
    (Array.isArray(rows) ? rows : []).forEach((r, i) => {
        const dr = Number(r?.debit) || 0;
        const cr = Number(r?.credit) || 0;
        const started = filled(r?.accountId) || filled(r?.debit) || filled(r?.credit) || filled(r?.description) || filled(r?.payeeId);
        const ok = filled(r?.accountId) && ((dr > 0) !== (cr > 0)) && dr >= 0 && cr >= 0;
        if (started && !ok) out.push(i + 1);
    });
    return out;
}
