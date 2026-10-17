/** Display helpers for internal staff transfers ("Transferred - date" tags). */

export function formatTransferDate(iso, locale = 'en') {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/** "Workshop — Branch" when the move crossed workshops, otherwise just the branch. */
export function transferPlaceLabel(transfer, side) {
    if (!transfer) return '';
    const ws = transfer[`${side}_workshop_name`];
    const br = transfer[`${side}_branch_name`];
    if (transfer.cross_workshop && ws) return br ? `${ws} — ${br}` : ws;
    return br || ws || '';
}

/** Map the row's recordType to the transfer API `kind`. */
export function staffTransferKind(emp) {
    const rt = String(emp?.recordType || '').toLowerCase();
    if (rt === 'employee' || rt === 'cashier' || rt === 'portal_user') return rt;
    if (emp?._source === 'technician') return 'employee';
    return 'cashier';
}
