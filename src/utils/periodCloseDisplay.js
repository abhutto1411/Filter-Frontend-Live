/**
 * Pure helpers for Period lock & month close (P-A16B mockup 14).
 * No client money maths — only calendar / status mapping from API fields.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function parseYmd(value) {
    const s = String(value || '').trim().slice(0, 10);
    return YMD.test(s) ? s : null;
}

/** Last calendar day of YYYY-MM (UTC date-only). */
export function lastDayOfMonthYmd(year, month1to12) {
    const y = Number(year);
    const m = Number(month1to12);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function dayBeforeYmd(ymd) {
    const s = parseYmd(ymd);
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
}

export function formatMonthLabelEn(ymd) {
    const s = parseYmd(ymd);
    if (!s) return '—';
    const [y, m] = s.split('-');
    const names = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ];
    return `${names[Number(m) - 1]} ${y}`;
}

/**
 * Build month rows for the table from lockedUpTo + period close history.
 * Months: from Jan of locked year (or current year) through current month + 1 open.
 */
export function buildPeriodCloseMonthRows({
    lockedUpTo,
    periodCloses = [],
    asOfYmd,
}) {
    const asOf = parseYmd(asOfYmd) || new Date().toISOString().slice(0, 10);
    const lock = parseYmd(lockedUpTo);
    const asOfY = Number(asOf.slice(0, 4));
    const asOfM = Number(asOf.slice(5, 7));

    let startY = asOfY;
    let startM = 1;
    if (lock) {
        const ly = Number(lock.slice(0, 4));
        const lm = Number(lock.slice(5, 7));
        // Show from first month of lock year, or 6 months before asOf.
        startY = Math.min(ly, asOfY);
        startM = ly < asOfY ? 1 : Math.max(1, lm - 2);
    }

    const endY = asOfY;
    const endM = Math.min(12, asOfM + 1);

    const closeByMonthEnd = new Map();
    for (const pc of periodCloses) {
        const end = parseYmd(pc?.periodEndDate);
        if (!end) continue;
        closeByMonthEnd.set(end, pc);
    }

    const rows = [];
    let y = startY;
    let m = startM;
    while (y < endY || (y === endY && m <= endM)) {
        const monthEnd = lastDayOfMonthYmd(y, m);
        const locked = Boolean(lock && monthEnd <= lock);
        const close = closeByMonthEnd.get(monthEnd) || null;
        rows.push({
            key: `${y}-${String(m).padStart(2, '0')}`,
            year: y,
            month: m,
            monthEndYmd: monthEnd,
            label: formatMonthLabelEn(monthEnd),
            status: locked ? 'locked' : 'open',
            closeId: close?.id != null ? String(close.id) : null,
            closingJournalId:
                close?.closingJournalId != null
                    ? String(close.closingJournalId)
                    : null,
            closingJournalEntryNumber: close?.closingJournalEntryNumber || null,
            canRestore: Boolean(close?.canRestore),
            restoredAt: close?.restoredAt || null,
            /** Month checks are not returned by API yet. */
            checks: null,
        });
        m += 1;
        if (m > 12) {
            m = 1;
            y += 1;
        }
    }
    return rows;
}

export function summarizePeriodCloseCards(rows, lockedUpTo, asOfYmd) {
    const lock = parseYmd(lockedUpTo);
    const asOf = parseYmd(asOfYmd) || new Date().toISOString().slice(0, 10);
    const open = (rows || []).filter((r) => r.status === 'open');
    const firstOpen = open[0] || null;
    const pendingChecks = (rows || []).filter(
        (r) => r.status === 'open' && r.checks == null,
    ).length;
    const year = Number(asOf.slice(0, 4));
    const yearEndYmd = `${year}-12-31`;
    const yearEndRow = (rows || []).find((r) => r.monthEndYmd === yearEndYmd);
    const yearEndPosted = Boolean(
        yearEndRow?.closingJournalId || yearEndRow?.closingJournalEntryNumber,
    );
    return {
        lockedUpTo: lock,
        openMonthsLabel: firstOpen ? firstOpen.label : null,
        openMonthsCount: open.length,
        pendingChecks,
        yearEndYmd,
        yearEndPosted,
        yearEndEntryNumber: yearEndRow?.closingJournalEntryNumber || null,
        yearEndCloseId: yearEndRow?.closeId || null,
    };
}
