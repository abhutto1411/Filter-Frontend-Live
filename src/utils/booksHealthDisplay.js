/**
 * Pure mapping helpers for Books health (P-A9B).
 * Money stays as API decimal strings — format only, no client recompute of totals
 * except integer-halala display sums where noted.
 */

export const BOOKS_HEALTH_PAGE_SIZE = 25;

export function formatCountPending(n) {
    const c = Math.max(0, Number(n) || 0);
    return `${c}`;
}

export function outboxStateChip(row) {
    const status = String(row?.status || '').toLowerCase();
    if (status === 'posted') return { tone: 'ok', key: 'bh.outbox.posted' };
    if (status === 'failed' || status === 'dead') {
        return { tone: 'bad', key: 'bh.outbox.failed', reason: row?.lastError || '' };
    }
    if (status === 'pending' || status === 'processing' || status === 'queued') {
        return { tone: 'info', key: 'bh.outbox.queued' };
    }
    return { tone: 'warn', key: 'bh.outbox.queued' };
}

export function canRetryOutboxRow(row) {
    const status = String(row?.status || '').toLowerCase();
    return status === 'failed' || status === 'dead';
}

export function slicePage(rows, page, pageSize = BOOKS_HEALTH_PAGE_SIZE) {
    const list = Array.isArray(rows) ? rows : [];
    const size = Math.max(1, Number(pageSize) || BOOKS_HEALTH_PAGE_SIZE);
    const pageCount = Math.max(1, Math.ceil(list.length / size));
    const current = Math.min(Math.max(1, Number(page) || 1), pageCount);
    const start = (current - 1) * size;
    return {
        rows: list.slice(start, start + size),
        page: current,
        pageCount,
        total: list.length,
        from: list.length === 0 ? 0 : start + 1,
        to: Math.min(list.length, start + size),
    };
}

/** Map API summary → top 4 mockup cards (start date / locked = — until P-A10A). */
export function mapBooksHealthSummaryCards(summary) {
    const s = summary && typeof summary === 'object' ? summary : {};
    const pending = Number(s.pendingPostings ?? 0);
    const failed = Number(s.deadPostings ?? 0);
    return [
        {
            key: 'startDate',
            labelKey: 'bh.card.startDate',
            value: s.accountingStartDate != null && s.accountingStartDate !== ''
                ? String(s.accountingStartDate)
                : '—',
            metaKey: null,
            tone: 'neutral',
        },
        {
            key: 'lockedUpTo',
            labelKey: 'bh.card.lockedUpTo',
            value: s.lockedUpTo != null && s.lockedUpTo !== ''
                ? String(s.lockedUpTo)
                : '—',
            metaKey: null,
            tone: 'neutral',
        },
        {
            key: 'pending',
            labelKey: 'bh.card.posQueue',
            value: formatCountPending(pending),
            metaKey: 'bh.card.pendingSuffix',
            tone: pending > 0 ? 'warn' : 'ok',
        },
        {
            key: 'failed',
            labelKey: 'bh.card.failed',
            value: formatCountPending(failed),
            metaKey: 'bh.card.alertSuffix',
            tone: failed > 0 ? 'bad' : 'ok',
        },
    ];
}

/** Planned-fix i18n key from noncash finding reason (labels only). */
export function noncashPlannedFixKey(reason) {
    const r = String(reason || '');
    if (r === 'duplicate') return 'bh.noncash.fix.reverseOnly';
    if (r === 'not_approved') return 'bh.noncash.fix.reverseRepost';
    if (r === 'legacy_petty_cash') return 'bh.noncash.fix.reverseRepost';
    return 'bh.noncash.fix.reverseRepost';
}

export function noncashProblemKey(reason) {
    const r = String(reason || '');
    if (r === 'duplicate') return 'bh.noncash.problem.duplicate';
    if (r === 'not_approved') return 'bh.noncash.problem.notApproved';
    if (r === 'legacy_petty_cash') return 'bh.noncash.problem.legacy';
    return 'bh.noncash.problem.unknown';
}

/**
 * Sum finding.amount strings as integer halalas for display only.
 * Returns a decimal string with 2 places.
 */
export function sumAmountStringsHalalas(amounts) {
    let halalas = 0;
    for (const raw of amounts || []) {
        const s = String(raw ?? '0').trim();
        if (!s) continue;
        const neg = s.startsWith('-');
        const cleaned = s.replace(/[^0-9.]/g, '');
        const [whole, frac = ''] = cleaned.split('.');
        const w = Number(whole || '0');
        const f = Number((frac + '00').slice(0, 2));
        if (!Number.isFinite(w) || !Number.isFinite(f)) continue;
        const h = w * 100 + f;
        halalas += neg ? -h : h;
    }
    const sign = halalas < 0 ? '-' : '';
    const abs = Math.abs(halalas);
    const whole = Math.floor(abs / 100);
    const frac = String(abs % 100).padStart(2, '0');
    return `${sign}${whole}.${frac}`;
}

export function mapNoncashRepairCards(result) {
    const r = result && typeof result === 'object' ? result : {};
    const findings = Array.isArray(r.findings) ? r.findings : [];
    const count =
        r.noncash_invalid_postings != null
            ? Number(r.noncash_invalid_postings)
            : findings.length;
    const amount = sumAmountStringsHalalas(findings.map((f) => f.amount));
    return {
        invalidCount: Number.isFinite(count) ? count : findings.length,
        amountAffected: amount,
        voidedAutomatically: '0',
        lastCheck: r.checkedAt != null ? String(r.checkedAt) : null,
        findings,
        dryRun: r.dryRun !== false,
    };
}

export function mapOutboxRow(row) {
    const r = row && typeof row === 'object' ? row : {};
    return {
        id: r.id != null ? String(r.id) : '',
        source: r.source != null ? String(r.source) : '—',
        ref:
            r.idempotencyKey != null
                ? String(r.idempotencyKey)
                : r.sourceId != null
                  ? String(r.sourceId)
                  : '—',
        time: r.updatedAt || r.createdAt || r.nextAttemptAt || null,
        status: r.status != null ? String(r.status) : '',
        lastError: r.lastError != null ? String(r.lastError) : '',
        raw: r,
    };
}
