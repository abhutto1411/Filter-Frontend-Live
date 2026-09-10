export function localDateTimeToIso(localValue) {
    if (!localValue) return '';
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
}

export function parseLocalDateTime(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtPeriodLabel(startIso, endIso, allData) {
    if (allData) return 'All transactions';
    const fmt = (iso) => {
        if (!iso) return '…';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    };
    if (startIso && endIso) return `${fmt(startIso)} — ${fmt(endIso)}`;
    if (startIso) return `From ${fmt(startIso)}`;
    if (endIso) return `Until ${fmt(endIso)}`;
    return 'All transactions';
}

export function fmtBillingMoney(n) {
    return Number(n ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function fmtBillingCellAmount(val) {
    if (val == null || val === '') return '—';
    return fmtBillingMoney(val);
}

export function billingStatusBadgeClass(status) {
    const s = String(status ?? '').toLowerCase();
    if (s === 'paid' || s === 'approved' || s.includes('auto-generated')) {
        return 'billing-status-paid';
    }
    if (s === 'partially paid' || s === 'partial') return 'billing-status-partial';
    if (s === 'unpaid' || s === 'unapproved') return 'billing-status-unpaid';
    return 'billing-status-neutral';
}

export function billingTypeBadgeClass(type) {
    return `billing-type-badge billing-type-${String(type ?? '').replace(/\s+/g, '-').toLowerCase()}`;
}
