/**
 * Normalize corporate wallet history API payloads to a transaction array.
 */
export function normalizeWalletHistoryResponse(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.transactions)) return data.transactions;
    if (Array.isArray(data.history)) return data.history;
    if (Array.isArray(data.data)) return data.data;
    const inner = data.data;
    if (inner && typeof inner === 'object' && Array.isArray(inner.transactions)) return inner.transactions;
    return [];
}

/**
 * Coerce values that may be JSON / composite objects into a safe React string.
 */
export function coerceWalletFieldText(value, fallback = '—') {
    if (value == null || value === '') return fallback;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
        if (typeof value.description === 'string') return value.description;
        if (typeof value.title === 'string') return value.title;
        if (typeof value.message === 'string') return value.message;
        if (typeof value.label === 'string') return value.label;
        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    }
    return fallback;
}

export function formatWalletTxDate(row) {
    const raw = row?.date ?? row?.createdAt;
    if (raw == null || raw === '') return '—';
    if (typeof raw === 'object' && typeof raw.date === 'string') return formatWalletTxDate({ date: raw.date });
    if (typeof raw === 'string' || typeof raw === 'number') {
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-SA');
    }
    return '—';
}

/** Vehicle report (and similar) APIs return last touch as `{ date, description }`. */
export function formatDateDescriptionBlob(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
        const dateStr = val.date != null ? String(val.date) : '';
        let desc = '';
        if (typeof val.description === 'string') desc = val.description;
        else if (val.description != null) desc = coerceWalletFieldText(val.description, '');
        const parts = [dateStr, desc].filter(Boolean);
        return parts.length ? parts.join(' · ') : null;
    }
    return String(val);
}
