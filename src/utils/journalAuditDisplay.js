/**
 * Pure helpers for Journal Entries (mockup 06) + Audit log.
 * Display-only: never recompute money totals from lines.
 */

export const REVERSE_REASON_MIN = 3;
export const REVERSE_REASON_MAX = 500;
export const JOURNAL_PAGE_SIZE = 25;
export const AUDIT_PAGE_SIZE = 25;

export const JOURNAL_SOURCE_OPTIONS = [
    { id: '', labelKey: 'gj.allSources' },
    { id: 'POS', labelKey: 'gj.type.pos' },
    { id: 'counter_closing', labelKey: 'gj.type.counterClosing' },
    { id: 'General', labelKey: 'gj.type.manual' },
    { id: 'reversal', labelKey: 'gj.type.reversal' },
    { id: 'Payment', labelKey: 'gj.type.payment' },
    { id: 'Receipt', labelKey: 'gj.type.receipt' },
    { id: 'Sales', labelKey: 'gj.type.sales' },
    { id: 'sales', labelKey: 'gj.type.salesInvoice' },
    { id: 'PurchaseInvoice', labelKey: 'gj.type.purchaseInvoice' },
    { id: 'OpeningBalance', labelKey: 'gj.type.openingBalance' },
    { id: 'locker_pickup', labelKey: 'gj.type.lockerPickup' },
    { id: 'locker_bank_deposit', labelKey: 'gj.type.lockerBank' },
    { id: 'locker_petty_cash_issue', labelKey: 'gj.type.lockerPetty' },
    { id: 'petty_cash_replenishment', labelKey: 'gj.type.pettyReplenish' },
    { id: 'petty_cash_expense', labelKey: 'gj.type.pettyExpense' },
    { id: 'internal_transfer', labelKey: 'gj.type.internalXfer' },
    { id: 'Commission', labelKey: 'gj.type.commission' },
];

export const AUDIT_ENTITY_OPTIONS = [
    { id: '', labelKey: 'audit.entity.all' },
    { id: 'journal', labelKey: 'audit.entity.journal' },
    { id: 'account', labelKey: 'audit.entity.account' },
    { id: 'period_close', labelKey: 'audit.entity.periodClose' },
];

const MONEY_FMT = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const INT_FMT = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
});

export function formatWesternMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return MONEY_FMT.format(n);
}

export function formatWesternInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return INT_FMT.format(n);
}

export function formatSarDisplay(value) {
    return `SAR ${formatWesternMoney(value)}`;
}

/** Business date YYYY-MM-DD from the API string; never browser-zone convert. */
export function fmtBusinessYmd(value) {
    if (value == null || value === '') return '—';
    const s = String(value).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return s.length >= 10 ? s.slice(0, 10) : s;
}

export function validateReverseReason(reason) {
    const value = String(reason ?? '').trim();
    if (value.length < REVERSE_REASON_MIN) {
        return { ok: false, errorKey: 'gj.reverse.reasonShort', value };
    }
    if (value.length > REVERSE_REASON_MAX) {
        return { ok: false, errorKey: 'gj.reverse.reasonLong', value };
    }
    return { ok: true, errorKey: null, value };
}

export function isForbiddenError(err) {
    if (!err) return false;
    if (Number(err.status) === 403) return true;
    return /missing permission|forbidden|no permission/i.test(String(err.message || ''));
}

export function journalStatusKind(status) {
    const s = String(status || '').toLowerCase().replace(/\s+/g, '_');
    if (s === 'void' || s === 'voided') return 'void';
    if (s === 'draft') return 'draft';
    if (s === 'reversed') return 'reversed';
    return 'posted';
}

export function statusChipKind(status) {
    const k = journalStatusKind(status);
    if (k === 'void') return 'bad';
    if (k === 'draft') return 'warn';
    if (k === 'reversed') return 'info';
    return 'ok';
}

export function isVoidStatus(status) {
    return journalStatusKind(status) === 'void';
}

export function isDraftStatus(status) {
    return journalStatusKind(status) === 'draft';
}

export function isReversalJournal(entry) {
    const src = String(entry?.source || '').toLowerCase();
    const type = String(entry?.type || '').toLowerCase();
    return src === 'reversal' || type === 'reversal';
}

export function isPeriodCloseSource(source) {
    return String(source || '').toUpperCase() === 'PERIOD_CLOSE';
}

export function isAccountingAdminActor(user) {
    if (!user) return false;
    const type = String(user.userType || user.type || '').toLowerCase();
    if (type === 'workshop_owner' || type === 'platform_admin' || type === 'admin') {
        return true;
    }
    const roleName = String(user.role?.name || user.roleName || '').toLowerCase();
    return roleName === 'accountant' || roleName === 'admin' || roleName === 'workshop_owner';
}

export function canShowReverse(entry) {
    if (!entry) return false;
    if (isVoidStatus(entry.status)) return false;
    if (isReversalJournal(entry)) return false;
    if (isPeriodCloseSource(entry.source)) return false;
    if (isDraftStatus(entry.status)) return false;
    return true;
}

export function canShowVoid(entry) {
    if (!entry) return false;
    if (isVoidStatus(entry.status)) return false;
    if (isPeriodCloseSource(entry.source)) return false;
    return true;
}

export function canShowDelete(entry) {
    return isDraftStatus(entry?.status);
}

export function canShowUnvoid() {
    return false;
}

export function journalSourceValue(entry) {
    if (!entry) return '';
    if (entry.source) return String(entry.source);
    if (entry.type) return String(entry.type);
    return '';
}

export function journalAmountValue(entry) {
    if (entry?.totalDebit != null && entry.totalDebit !== '') return entry.totalDebit;
    if (entry?.totalCredit != null && entry.totalCredit !== '') return entry.totalCredit;
    return null;
}

/**
 * Tags from fields the API actually returns.
 * `reversedById` is not on toJournalResponse — only emitted when present.
 */
export function journalTags(entry) {
    const tags = [];
    if (!entry) return tags;
    if (isReversalJournal(entry)) {
        const fromDesc = String(entry.description || '').match(/Reversal of\s+([A-Za-z0-9._-]+)/i);
        tags.push({
            kind: 'reversalOf',
            entryNumber: fromDesc?.[1] || null,
            sourceId: entry.sourceId != null ? String(entry.sourceId) : null,
        });
    }
    if (entry.reversedById != null || entry.reversedByEntryNumber) {
        tags.push({
            kind: 'reversedBy',
            entryNumber: entry.reversedByEntryNumber || null,
            id: entry.reversedById != null ? String(entry.reversedById) : null,
        });
    }
    return tags;
}

/**
 * Mockup 06 cards from list summary. Hide any card whose field is absent.
 * Manual / Voided-reversed are not in the current API summary.
 */
export function journalCardsFromSummary(summary) {
    const s = summary && typeof summary === 'object' ? summary : {};
    const cards = [];
    if (s.totalEntries != null) {
        cards.push({ id: 'entries', field: 'totalEntries', value: s.totalEntries, labelKey: 'gj.stat.entries' });
    }
    if (s.manualCount != null) {
        cards.push({ id: 'manual', field: 'manualCount', value: s.manualCount, labelKey: 'gj.stat.manual' });
    }
    if (s.voidedCount != null || s.reversedCount != null) {
        const value =
            s.voidedCount != null && s.reversedCount != null
                ? Number(s.voidedCount) + Number(s.reversedCount)
                : s.voidedCount != null
                  ? s.voidedCount
                  : s.reversedCount;
        cards.push({
            id: 'voided',
            field: s.voidedCount != null ? 'voidedCount' : 'reversedCount',
            value,
            labelKey: 'gj.stat.voidedReversed',
        });
    }
    if (s.totalDebit != null) {
        cards.push({
            id: 'debits',
            field: 'totalDebit',
            value: s.totalDebit,
            labelKey: 'gj.stat.totalDebits',
            money: true,
        });
    }
    return cards;
}

export function showingRange(total, limit, offset) {
    const t = Math.max(Number(total) || 0, 0);
    const lim = Math.max(Number(limit) || 0, 0);
    const off = Math.max(Number(offset) || 0, 0);
    if (t === 0 || lim === 0) return { from: 0, to: 0, total: t };
    return { from: off + 1, to: Math.min(off + lim, t), total: t };
}

export function slicePage(rows, limit, offset) {
    const list = Array.isArray(rows) ? rows : [];
    const lim = Math.max(Number(limit) || 0, 0);
    const off = Math.max(Number(offset) || 0, 0);
    return list.slice(off, off + lim);
}

export function auditActionCounts(rows) {
    const counts = {};
    for (const r of rows || []) {
        const action = String(r?.action || 'unknown');
        counts[action] = (counts[action] || 0) + 1;
    }
    return Object.entries(counts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
}

function asPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
}

export function auditDiffRows(before, after) {
    const b = asPlainObject(before);
    const a = asPlainObject(after);
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
    return keys.map((key) => {
        const beforeVal = Object.prototype.hasOwnProperty.call(b, key) ? b[key] : null;
        const afterVal = Object.prototype.hasOwnProperty.call(a, key) ? a[key] : null;
        return {
            key,
            before: beforeVal,
            after: afterVal,
            changed: JSON.stringify(beforeVal) !== JSON.stringify(afterVal),
        };
    });
}

export function formatDiffValue(value) {
    if (value == null) return '—';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export function messageFromJournalError(err, fallbackKey = 'gj.loadFailed') {
    if (isForbiddenError(err)) return { key: 'gj.noPermission', code: 'FORBIDDEN' };
    const code = String(err?.code || '').trim();
    const known = {
        USE_REVERSE: 'gj.err.useReverse',
        ALREADY_REVERSED: 'gj.err.alreadyReversed',
        CANNOT_REVERSE_REVERSAL: 'gj.err.cannotReverseReversal',
        PERIOD_LOCKED: 'gj.err.periodLocked',
        JOURNAL_VOID: 'gj.err.journalVoid',
        JOURNAL_NOT_FOUND: 'gj.err.notFound',
        COMMISSION_JOURNAL_NOT_REVERSIBLE: 'gj.err.commission',
    };
    if (code && known[code]) {
        const out = { key: known[code], code };
        if (code === 'PERIOD_LOCKED') {
            // Extract date from message (api.js does not forward lockedUpTo).
            const msg = String(err?.message || '');
            const m =
                msg.match(/lockedUpTo\s+(\d{4}-\d{2}-\d{2})/i) ||
                msg.match(/locked through\s+(\d{4}-\d{2}-\d{2})/i) ||
                msg.match(/up to\s+(\d{4}-\d{2}-\d{2})/i);
            out.vars = { date: m ? m[1] : '—' };
        }
        return out;
    }
    return { key: fallbackKey, code: code || null, fallbackMessage: err?.message || '' };
}

export function resolveJournalIdForReverse(row, isJournal) {
    if (!row) return '';
    if (isJournal) return row.id != null ? String(row.id) : '';
    if (row.journalId != null && String(row.journalId)) return String(row.journalId);
    return '';
}
