/** Supplier portal — Workshop Alerts. Locale: `en` | `ar` (MSA). */
const SWA_I18N = {
    en: {
        'title': 'Workshop Alerts',
        'subtitle': 'Low stock alerts from workshop branches',

        'banner.title': 'Workshop Stock Alerts',
        'banner.body':
            '— when a linked workshop branch’s on-hand quantity is at or below the critical threshold, it appears below. Issue a Sales Invoice to send them stock.',
        'banner.salesInvoice': 'Sales Invoice',

        'error.load': 'Failed to load alerts',
        'error.couldNotLoad': 'Could not load alerts:',

        'search.aria': 'Search alerts',
        'search.placeholder': 'Search workshop, branch, product, SKU…',
        'filter.branch': 'Branch',
        'filter.allBranches': 'All branches',
        'filter.clear': 'Clear filters',
        'filter.showing': 'Showing {filtered} of {total} line',
        'filter.showingPlural': 'Showing {filtered} of {total} lines',

        'empty.none': 'No active alerts',
        'empty.noMatch': 'No alerts match your filters',
        'empty.hint':
            'Try another branch or clear the search. You still have {count} active line in total.',
        'empty.hintPlural':
            'Try another branch or clear the search. You still have {count} active lines in total.',

        'group.criticalLine': '{count} critical line',
        'group.criticalLines': '{count} critical lines',
        'fallback.branch': 'Branch',
        'fallback.workshop': 'Workshop',

        'th.branch': 'Branch',
        'th.product': 'Product',
        'th.sku': 'SKU',
        'th.current': 'Current',
        'th.critical': 'Critical',
        'th.threshold': 'Threshold',
        'th.action': 'Action',

        'threshold.branch': 'Branch setting',
        'threshold.catalog': 'Catalog',
        'action.salesInvoice': 'Sales invoice',

        'emdash': '—',
    },
    ar: {
        'title': 'تنبيهات الورش',
        'subtitle': 'تنبيهات انخفاض المخزون من فروع الورش',

        'banner.title': 'تنبيهات مخزون الورش',
        'banner.body':
            '— عندما تصل كمية المخزون المتوفر في فرع ورشة مرتبط إلى الحد الحرج أو أقل، تظهر أدناه. أصدر فاتورة مبيعات لإرسال المخزون لهم.',
        'banner.salesInvoice': 'فاتورة مبيعات',

        'error.load': 'فشل تحميل التنبيهات',
        'error.couldNotLoad': 'تعذر تحميل التنبيهات:',

        'search.aria': 'بحث في التنبيهات',
        'search.placeholder': 'ابحث عن ورشة، فرع، منتج، رمز…',
        'filter.branch': 'الفرع',
        'filter.allBranches': 'كل الفروع',
        'filter.clear': 'مسح الفلاتر',
        'filter.showing': 'عرض {filtered} من {total} سطر',
        'filter.showingPlural': 'عرض {filtered} من {total} أسطر',

        'empty.none': 'لا توجد تنبيهات نشطة',
        'empty.noMatch': 'لا توجد تنبيهات تطابق الفلاتر',
        'empty.hint': 'جرّب فرعاً آخر أو امسح البحث. لديك سطر نشط واحد ({count}) إجمالاً.',
        'empty.hintPlural':
            'جرّب فرعاً آخر أو امسح البحث. لديك {count} أسطر نشطة إجمالاً.',

        'group.criticalLine': 'سطر حرج واحد',
        'group.criticalLines': '{count} أسطر حرجة',
        'fallback.branch': 'فرع',
        'fallback.workshop': 'ورشة',

        'th.branch': 'الفرع',
        'th.product': 'المنتج',
        'th.sku': 'الرمز',
        'th.current': 'الحالي',
        'th.critical': 'الحد الحرج',
        'th.threshold': 'المصدر',
        'th.action': 'إجراء',

        'threshold.branch': 'إعداد الفرع',
        'threshold.catalog': 'الكتالوج',
        'action.salesInvoice': 'فاتورة مبيعات',

        'emdash': '—',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function swaT(locale, key, vars) {
    const pack = SWA_I18N[locale] || SWA_I18N.en;
    let text = pack[key] ?? SWA_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
