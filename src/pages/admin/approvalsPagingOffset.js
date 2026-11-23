/** Entity types loaded from dedicated approval APIs (not GET /admin/approvals std queue). */
export const DEDICATED_APPROVAL_ENTITY_TYPES = new Set([
    'corporate_payment_approval',
    'corporate_generated_bill_payment',
    'corporate_generated_bill_deletion',
    'sales_return',
    'marketing_budget_request',
    'marketing_promotion',
    'marketing_promo_code',
    'marketing_referrer_payout',
]);

export function isStdApprovalQueueItem(item) {
    const et = item?.entityType ?? item?.type ?? '';
    return et && !DEDICATED_APPROVAL_ENTITY_TYPES.has(et);
}

/** Count std-queue rows still present (next listApprovals offset after removals). */
export function countStdApprovalsInList(items) {
    if (!Array.isArray(items)) return 0;
    return items.filter(isStdApprovalQueueItem).length;
}

export function nextStdApprovalsListOffset(items) {
    return countStdApprovalsInList(items);
}

function submittedAtMs(item) {
    const raw = item?.date ?? item?.raw?.submittedAt ?? item?.raw?.createdAt ?? '';
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
}

function requestIdSortKey(item) {
    const id = String(item?.id ?? item?.raw?.requestId ?? item?.raw?.id ?? '');
    if (/^\d+$/.test(id)) {
        try {
            return BigInt(id);
        } catch {
            /* fall through */
        }
    }
    return id;
}

/** submittedAt desc, else requestId desc (matches std approvals API ordering). */
export function compareApprovalsBySubmitted(a, b) {
    const db = submittedAtMs(b);
    const da = submittedAtMs(a);
    if (db !== da) return db - da;

    const idB = requestIdSortKey(b);
    const idA = requestIdSortKey(a);
    if (typeof idB === 'bigint' && typeof idA === 'bigint') {
        if (idB > idA) return 1;
        if (idB < idA) return -1;
        return 0;
    }
    return String(idB).localeCompare(String(idA), undefined, { numeric: true }) * -1;
}

export function approvalItemDedupeKey(item) {
    return `${item?.entityType ?? ''}:${item?.id ?? ''}`;
}

export function mergeApprovalsAppendDedupeSorted(existing, incoming) {
    const seen = new Set((existing || []).map(approvalItemDedupeKey));
    const extra = (incoming || []).filter((item) => {
        const key = approvalItemDedupeKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const merged = extra.length ? [...(existing || []), ...extra] : [...(existing || [])];
    return merged.sort(compareApprovalsBySubmitted);
}