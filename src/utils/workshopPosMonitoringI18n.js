/** Workshop POS Monitoring UI — keyed by portal locale (`en` | `ar`). */
export const WPM_I18N = {
    en: {
        'page.title': 'POS Monitoring',
        'page.subtitleLead': 'Live counters and recent closing reports ·',

        'branch.all': 'All branches',
        'branch.fallback': 'Branch',

        'btn.refresh': 'Refresh',
        'btn.refreshing': 'Refreshing...',
        'btn.forceLogout': 'Force logout',

        'kpi.liveCounters': 'Live Counters',
        'kpi.openOrders': 'Open Orders',
        'kpi.todaySales': 'Today Sales',
        'kpi.clickBreakdown': 'Click for breakdown',
        'kpi.ariaBreakdown': '{label}: view breakdown',

        'section.liveCounters': 'Live Counters',
        'section.closingReports': 'Recent Closing Reports',
        'section.closingHint': 'Click a row for full details',

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
        'page.subtitleLead': 'العدادات المباشرة وتقارير الإغلاق الأخيرة ·',

        'branch.all': 'كل الفروع',
        'branch.fallback': 'فرع',

        'btn.refresh': 'تحديث',
        'btn.refreshing': 'جاري التحديث...',
        'btn.forceLogout': 'فرض تسجيل الخروج',

        'kpi.liveCounters': 'العدادات المباشرة',
        'kpi.openOrders': 'الطلبات المفتوحة',
        'kpi.todaySales': 'مبيعات اليوم',
        'kpi.clickBreakdown': 'انقر للتفصيل',
        'kpi.ariaBreakdown': '{label}: عرض التفصيل',

        'section.liveCounters': 'العدادات المباشرة',
        'section.closingReports': 'تقارير الإغلاق الأخيرة',
        'section.closingHint': 'انقر على صف لعرض التفاصيل الكاملة',

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
