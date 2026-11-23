/**
 * Feature flag for workshop period close UI (P-A2A/P-A2B).
 * P-A16A/B: re-enabled — month lock + year-end close.
 */
export const PERIOD_CLOSE_ENABLED = true;

/**
 * Map a failed period-close API error to a user-facing string.
 * Prefer backend `message` on HTTP 423 / PERIOD_CLOSE_DISABLED; else fallback.
 */
export function messageFromPeriodCloseError(err, fallbackMessage = '') {
    const status = Number(err?.status);
    const code = String(err?.code || '').trim();
    const isDisabled =
        status === 423 || code === 'PERIOD_CLOSE_DISABLED';
    const raw = typeof err?.message === 'string' ? err.message.trim() : '';
    if (isDisabled) {
        return raw || String(fallbackMessage || '').trim() || raw;
    }
    return raw || String(fallbackMessage || '').trim();
}

export function isPeriodCloseDisabledError(err) {
    const status = Number(err?.status);
    const code = String(err?.code || '').trim();
    return status === 423 || code === 'PERIOD_CLOSE_DISABLED';
}
