/** Formatting shared by the storage-facility screens. */

/**
 * Two decimals, always. Several of these screens put amounts in a column, and
 * a plain `toLocaleString()` prints "1,234" next to "1,234.5" — neither of
 * which reads as money, and which never line up.
 */
export function money2(value) {
    return Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/** The amount with its currency, in the reading locale. */
export function sfMoney(t, value) {
    return t('money.sar', { amount: money2(value) });
}

/**
 * An ISO timestamp as a plain `YYYY-MM-DD HH:MM`. These come off the API as
 * strings already in the business timezone, so they are cut rather than parsed
 * — `new Date()` would shift them into the reader's zone.
 */
export function sfStamp(value) {
    return String(value || '').slice(0, 16).replace('T', ' ') || '—';
}

/** Just the date part of such a timestamp. */
export function sfDate(value) {
    return String(value || '').slice(0, 10) || '—';
}
