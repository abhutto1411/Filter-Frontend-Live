/**
 * Catalog / product display name for portal locale.
 * When Arabic is selected, prefer backend arabic fields (fallback to English `name`).
 */
export function catalogDisplayName(item, locale = 'en') {
    if (!item) return '';
    const en = String(item.name ?? item.productName ?? item.product_name ?? '').trim();
    if (locale === 'ar') {
        const ar = String(
            item.arabicName
                ?? item.arabic_name
                ?? item.productNameArabic
                ?? item.product_name_arabic
                ?? item.serviceNameArabic
                ?? item.service_name_arabic
                ?? '',
        ).trim();
        if (ar) return ar;
    }
    return en;
}
