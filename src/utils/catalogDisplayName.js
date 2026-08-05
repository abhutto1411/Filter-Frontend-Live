/**
 * Master catalog display name for the admin portal locale.
 * When Arabic is selected, prefer backend `arabicName` (fallback to English `name`).
 */
export function catalogDisplayName(item, locale = 'en') {
    if (!item) return '';
    const en = String(item.name ?? '').trim();
    if (locale === 'ar') {
        const ar = String(item.arabicName ?? item.arabic_name ?? '').trim();
        if (ar) return ar;
    }
    return en;
}
