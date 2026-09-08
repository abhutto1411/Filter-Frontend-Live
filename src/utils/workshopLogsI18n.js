/** Workshop Logs UI — keyed by portal locale (`en` | `ar`). */
export const WL_I18N = {
    en: {
        'page.title': 'Logs',
        'page.activity': 'Workshop activity',
        'page.eventsOne': ' · {count} event',
        'page.eventsMany': ' · {count} events',

        'branch.all': 'All branches',
        'branch.fallback': 'Branch',

        'cat.all': 'All',
        'cat.approvals': 'Approvals',
        'cat.inventory': 'Inventory',
        'cat.suppliers': 'Suppliers & Purchases',
        'cat.pos': 'POS',
        'cat.cash_bank': 'Cash & Bank',
        'cat.roster': 'Staff & Branches',

        'filter.category': 'Category',
        'filter.from': 'From',
        'filter.to': 'To',
        'filter.search': 'Search',
        'filter.searchPlaceholder': 'Actor, action, summary…',

        'aria.category': 'Log category',
        'aria.from': 'From date',
        'aria.to': 'To date',
        'aria.pages': 'Logs pages',
        'aria.pageNumbers': 'Page numbers',

        'btn.filter': 'Filter',
        'btn.loading': 'Loading…',
        'btn.previous': 'Previous',
        'btn.next': 'Next',

        'title.applyFilters': 'Apply filters',
        'title.changeFilterFirst': 'Change a filter first',

        'err.load': 'Failed to load logs.',

        'th.when': 'When',
        'th.category': 'Category',
        'th.action': 'Action',
        'th.summary': 'Summary',
        'th.performedBy': 'Performed by',
        'th.branch': 'Branch',

        'loading': 'Loading…',
        'empty': 'No logs in this period.',
        'actor.notRecorded': 'Not recorded',
        'emdash': '—',

        'pagination.showing': 'Showing',
        'pagination.of': 'of',
        'pagination.loadingSuffix': ' · Loading…',
        'pagination.perPage': '· {size} per page',
    },
    ar: {
        'page.title': 'السجلات',
        'page.activity': 'نشاط الورشة',
        'page.eventsOne': ' · {count} حدث',
        'page.eventsMany': ' · {count} أحداث',

        'branch.all': 'كل الفروع',
        'branch.fallback': 'فرع',

        'cat.all': 'الكل',
        'cat.approvals': 'الموافقات',
        'cat.inventory': 'المخزون',
        'cat.suppliers': 'الموردون والمشتريات',
        'cat.pos': 'نقاط البيع',
        'cat.cash_bank': 'النقد والبنك',
        'cat.roster': 'الموظفون والفروع',

        'filter.category': 'الفئة',
        'filter.from': 'من',
        'filter.to': 'إلى',
        'filter.search': 'بحث',
        'filter.searchPlaceholder': 'المنفّذ، الإجراء، الملخص…',

        'aria.category': 'فئة السجل',
        'aria.from': 'تاريخ البداية',
        'aria.to': 'تاريخ النهاية',
        'aria.pages': 'صفحات السجلات',
        'aria.pageNumbers': 'أرقام الصفحات',

        'btn.filter': 'تصفية',
        'btn.loading': 'جارٍ التحميل…',
        'btn.previous': 'السابق',
        'btn.next': 'التالي',

        'title.applyFilters': 'تطبيق عوامل التصفية',
        'title.changeFilterFirst': 'غيّر عامل تصفية أولاً',

        'err.load': 'تعذّر تحميل السجلات.',

        'th.when': 'الوقت',
        'th.category': 'الفئة',
        'th.action': 'الإجراء',
        'th.summary': 'الملخص',
        'th.performedBy': 'نفّذه',
        'th.branch': 'الفرع',

        'loading': 'جارٍ التحميل…',
        'empty': 'لا توجد سجلات في هذه الفترة.',
        'actor.notRecorded': 'غير مسجّل',
        'emdash': '—',

        'pagination.showing': 'عرض',
        'pagination.of': 'من',
        'pagination.loadingSuffix': ' · جارٍ التحميل…',
        'pagination.perPage': '· {size} لكل صفحة',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wlT(locale, key, vars) {
    const pack = WL_I18N[locale] || WL_I18N.en;
    let text = pack[key] ?? WL_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
