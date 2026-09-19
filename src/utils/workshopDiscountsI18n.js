/** Workshop Discounts report UI — keyed by portal locale (`en` | `ar`). */
export const WDSC_I18N = {
    en: {
        'page.title': 'Discounts',
        'page.subtitle': '{branch} · POS sales invoice discounts by department and date.',

        'perm.denied': 'You do not have permission to view discount reports.',

        'branch.all': 'All branches',
        'branch.withId': 'Branch {id}',
        'dept.all': 'All departments',
        'dept.fallback': 'Department',

        'emdash': '—',
        'money.sar': 'SAR {amount}',
        'money.sarDash': 'SAR —',

        'kpi.discountedInvoices': 'Discounted invoices',
        'kpi.discountedInvoicesTitle': 'Invoices with discounts in this period',
        'kpi.line': 'Line / item discount',
        'kpi.lineTitle': 'View line discount timeline',
        'kpi.invoice': 'Invoice discount',
        'kpi.invoiceTitle': 'View invoice discount timeline',
        'kpi.promo': 'Promo code',
        'kpi.promoTitle': 'View promo code discount timeline',
        'kpi.total': 'Total discount',
        'kpi.totalTitle': 'View total discount timeline',

        'timeline.line': 'Line / item discount timeline',
        'timeline.invoice': 'Invoice discount timeline',
        'timeline.promo': 'Promo code discount timeline',
        'timeline.total': 'Total discount timeline',

        'btn.refresh': 'Refresh',
        'btn.apply': 'Apply',
        'btn.loading': 'Loading…',
        'btn.view': 'View',

        'filter.from': 'From',
        'filter.to': 'To',
        'filter.department': 'Department',
        'filter.branchHint': 'Branch filter uses the branch selector in the workshop header ({branch}).',

        'err.load': 'Failed to load discounts.',

        'th.dateTime': 'Date / time',
        'th.invoiceNo': 'Invoice #',
        'th.customer': 'Customer',
        'th.vehicle': 'Vehicle',
        'th.cashier': 'Cashier',
        'th.branch': 'Branch',
        'th.lineDiscount': 'Line discount',
        'th.invoiceDiscount': 'Invoice discount',
        'th.promoCode': 'Promo code',
        'th.totalDiscount': 'Total discount',
        'th.invoiceTotal': 'Invoice total',

        'empty.title': 'No discounted invoices found',
        'empty.hint': 'Try widening the date range or clearing the department filter.',
        'footer.showing': 'Showing {shown} of {total} discounted invoices',

        'detail.invoiceTitle': 'Invoice {no}',
        'detail.date': 'Date',
        'detail.branch': 'Branch',
        'detail.customer': 'Customer',
        'detail.cashier': 'Cashier',
        'detail.invoiceTotal': 'Invoice total',
        'detail.lineDiscount': 'Line discount',
        'detail.invoiceDiscount': 'Invoice discount',
        'detail.promoCode': 'Promo code',
        'detail.totalDiscount': 'Total discount',
        'detail.lineSection': 'Line / item discounts',
        'detail.jobSection': 'Invoice / job discounts',
        'detail.th.item': 'Item',
        'detail.th.department': 'Department',
        'detail.th.discount': 'Discount',
        'detail.th.jobDiscount': 'Job discount',
        'detail.th.promo': 'Promo',
        'detail.th.total': 'Total',
    },
    ar: {
        'page.title': 'الخصومات',
        'page.subtitle': '{branch} · خصومات فواتير مبيعات نقاط البيع حسب القسم والتاريخ.',

        'perm.denied': 'ليس لديك صلاحية لعرض تقارير الخصومات.',

        'branch.all': 'كل الفروع',
        'branch.withId': 'فرع {id}',
        'dept.all': 'كل الأقسام',
        'dept.fallback': 'قسم',

        'emdash': '—',
        'money.sar': '{amount} ر.س',
        'money.sarDash': '— ر.س',

        'kpi.discountedInvoices': 'الفواتير المخفّضة',
        'kpi.discountedInvoicesTitle': 'الفواتير التي تتضمن خصومات في هذه الفترة',
        'kpi.line': 'خصم البند / الصنف',
        'kpi.lineTitle': 'عرض الجدول الزمني لخصم البند',
        'kpi.invoice': 'خصم الفاتورة',
        'kpi.invoiceTitle': 'عرض الجدول الزمني لخصم الفاتورة',
        'kpi.promo': 'رمز ترويجي',
        'kpi.promoTitle': 'عرض الجدول الزمني لخصم الرمز الترويجي',
        'kpi.total': 'إجمالي الخصم',
        'kpi.totalTitle': 'عرض الجدول الزمني لإجمالي الخصم',

        'timeline.line': 'الجدول الزمني لخصم البند / الصنف',
        'timeline.invoice': 'الجدول الزمني لخصم الفاتورة',
        'timeline.promo': 'الجدول الزمني لخصم الرمز الترويجي',
        'timeline.total': 'الجدول الزمني لإجمالي الخصم',

        'btn.refresh': 'تحديث',
        'btn.apply': 'تطبيق',
        'btn.loading': 'جاري التحميل…',
        'btn.view': 'عرض',

        'filter.from': 'من',
        'filter.to': 'إلى',
        'filter.department': 'القسم',
        'filter.branchHint': 'فلتر الفرع يستخدم محدّد الفرع في رأس الورشة ({branch}).',

        'err.load': 'فشل تحميل الخصومات.',

        'th.dateTime': 'التاريخ / الوقت',
        'th.invoiceNo': 'رقم الفاتورة',
        'th.customer': 'العميل',
        'th.vehicle': 'المركبة',
        'th.cashier': 'أمين الصندوق',
        'th.branch': 'الفرع',
        'th.lineDiscount': 'خصم البند',
        'th.invoiceDiscount': 'خصم الفاتورة',
        'th.promoCode': 'رمز ترويجي',
        'th.totalDiscount': 'إجمالي الخصم',
        'th.invoiceTotal': 'إجمالي الفاتورة',

        'empty.title': 'لا توجد فواتير مخفّضة',
        'empty.hint': 'جرّب توسيع نطاق التاريخ أو مسح فلتر القسم.',
        'footer.showing': 'عرض {shown} من {total} فاتورة مخفّضة',

        'detail.invoiceTitle': 'فاتورة {no}',
        'detail.date': 'التاريخ',
        'detail.branch': 'الفرع',
        'detail.customer': 'العميل',
        'detail.cashier': 'أمين الصندوق',
        'detail.invoiceTotal': 'إجمالي الفاتورة',
        'detail.lineDiscount': 'خصم البند',
        'detail.invoiceDiscount': 'خصم الفاتورة',
        'detail.promoCode': 'رمز ترويجي',
        'detail.totalDiscount': 'إجمالي الخصم',
        'detail.lineSection': 'خصومات البند / الصنف',
        'detail.jobSection': 'خصومات الفاتورة / المهمة',
        'detail.th.item': 'الصنف',
        'detail.th.department': 'القسم',
        'detail.th.discount': 'الخصم',
        'detail.th.jobDiscount': 'خصم المهمة',
        'detail.th.promo': 'ترويجي',
        'detail.th.total': 'الإجمالي',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wdscT(locale, key, vars) {
    const pack = WDSC_I18N[locale] || WDSC_I18N.en;
    let text = pack[key] ?? WDSC_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
