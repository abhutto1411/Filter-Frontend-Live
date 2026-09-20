/** Workshop POS Monitoring UI — keyed by portal locale (`en` | `ar`). */
export const WPM_I18N = {
    en: {
        'page.title': 'POS Monitoring',
        'page.subtitleLead': 'Live counters and closing reports ·',

        'branch.all': 'All branches',
        'branch.fallback': 'Branch',

        'btn.refresh': 'Refresh',
        'btn.refreshing': 'Refreshing...',
        'btn.forceLogout': 'Force logout',
        'btn.apply': 'Apply',
        'btn.loading': 'Loading…',
        'btn.clearRange': 'Clear dates',
        'btn.previous': 'Previous',
        'btn.next': 'Next',

        'kpi.liveCounters': 'Live Counters',
        'kpi.openOrders': 'Open Orders',
        'kpi.todaySales': 'Today Sales',
        'kpi.clickBreakdown': 'Click for breakdown',
        'kpi.ariaBreakdown': '{label}: view breakdown',

        'section.liveCounters': 'Live Counters',
        'section.closingReports': 'Closing Reports',
        'section.closingHint': 'Click a row for full details',

        'label.fromDatetime': 'From (date & time)',
        'label.toDatetime': 'To (date & time)',
        'label.to': 'to',
        'label.closingPages': 'Closing reports pages',
        'label.pageNumbers': 'Page numbers',

        'hint.riyadhDatetime': 'Date & time filter uses Asia/Riyadh. Leave empty to list all closing reports for this branch.',

        'error.rangeBoth': 'Select both From and To, or clear both.',
        'error.rangeInvalid': 'Invalid date/time range.',

        'pagination.showing': 'Showing',
        'pagination.of': 'of',
        'pagination.loadingSuffix': ' · loading…',

        'th.cashier': 'Cashier',
        'th.branch': 'Branch',
        'th.openedAt': 'Opened At',
        'th.status': 'Status',
        'th.shiftSales': 'Shift Sales',
        'th.openOrders': 'Open Orders',
        'th.elapsed': 'Elapsed',
        'th.actions': 'Actions',
        'th.closedAt': 'Closed At',
        'th.systemTotalSales': 'System Total Sales',
        'th.physicalTotal': 'Physical Total',
        'th.totalDifference': 'Total Difference',

        'empty.liveCounters': 'No live counters',
        'empty.closingReports': 'No closing reports',

        'row.viewClosing': 'View closing details',

        'status.open': 'OPEN',
        'status.closed': 'CLOSED',

        'err.invalid': 'Invalid POS monitoring response.',
        'err.load': 'Failed to load POS monitoring.',

        'money.sar': 'SAR {amount}',
        'emdash': '—',
    },
    ar: {
        'page.title': 'مراقبة نقاط البيع',
        'page.subtitleLead': 'العدادات المباشرة وتقارير الإغلاق ·',

        'branch.all': 'كل الفروع',
        'branch.fallback': 'فرع',

        'btn.refresh': 'تحديث',
        'btn.refreshing': 'جاري التحديث...',
        'btn.forceLogout': 'فرض تسجيل الخروج',
        'btn.apply': 'تطبيق',
        'btn.loading': 'جاري التحميل…',
        'btn.clearRange': 'مسح التواريخ',
        'btn.previous': 'السابق',
        'btn.next': 'التالي',

        'kpi.liveCounters': 'العدادات المباشرة',
        'kpi.openOrders': 'الطلبات المفتوحة',
        'kpi.todaySales': 'مبيعات اليوم',
        'kpi.clickBreakdown': 'انقر للتفصيل',
        'kpi.ariaBreakdown': '{label}: عرض التفصيل',

        'section.liveCounters': 'العدادات المباشرة',
        'section.closingReports': 'تقارير الإغلاق',
        'section.closingHint': 'انقر على صف لعرض التفاصيل الكاملة',

        'label.fromDatetime': 'من (تاريخ ووقت)',
        'label.toDatetime': 'إلى (تاريخ ووقت)',
        'label.to': 'إلى',
        'label.closingPages': 'صفحات تقارير الإغلاق',
        'label.pageNumbers': 'أرقام الصفحات',

        'hint.riyadhDatetime': 'فلتر التاريخ والوقت حسب توقيت الرياض. اتركه فارغًا لعرض كل تقارير الإغلاق لهذا الفرع.',

        'error.rangeBoth': 'حدد من وإلى معًا، أو امسح الاثنين.',
        'error.rangeInvalid': 'نطاق التاريخ/الوقت غير صالح.',

        'pagination.showing': 'عرض',
        'pagination.of': 'من',
        'pagination.loadingSuffix': ' · جاري التحميل…',

        'th.cashier': 'الكاشير',
        'th.branch': 'الفرع',
        'th.openedAt': 'وقت الفتح',
        'th.status': 'الحالة',
        'th.shiftSales': 'مبيعات الوردية',
        'th.openOrders': 'الطلبات المفتوحة',
        'th.elapsed': 'المدة المنقضية',
        'th.actions': 'إجراءات',
        'th.closedAt': 'وقت الإغلاق',
        'th.systemTotalSales': 'إجمالي مبيعات النظام',
        'th.physicalTotal': 'الإجمالي الفعلي',
        'th.totalDifference': 'إجمالي الفرق',

        'empty.liveCounters': 'لا توجد عدادات مباشرة',
        'empty.closingReports': 'لا توجد تقارير إغلاق',

        'row.viewClosing': 'عرض تفاصيل الإغلاق',

        'status.open': 'مفتوح',
        'status.closed': 'مغلق',

        'err.invalid': 'استجابة مراقبة نقاط البيع غير صالحة.',
        'err.load': 'فشل تحميل مراقبة نقاط البيع.',

        'money.sar': '{amount} ر.س',
        'emdash': '—',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wpmT(locale, key, vars) {
    const pack = WPM_I18N[locale] || WPM_I18N.en;
    let text = pack[key] ?? WPM_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
