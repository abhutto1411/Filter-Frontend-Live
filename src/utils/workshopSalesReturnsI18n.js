/** Workshop Sales Returns UI — keyed by portal locale (`en` | `ar`). */
export const WSR_I18N = {
    en: {
        'page.title': 'Sales Returns',
        'page.subtitle': '{branch} · filter by date, invoice, branch, and cashier.',
        'branch.all': 'All branches',
        'branch.named': 'Branch {id}',

        'kpi.shownReturns': 'Shown returns',
        'kpi.shownAmount': 'Shown amount',

        'btn.refresh': 'Refresh',
        'btn.apply': 'Apply',
        'btn.loading': 'Loading…',
        'btn.view': 'View',
        'btn.close': 'Close',
        'btn.print': 'Print',
        'btn.viewDigitalInvoice': 'View digital invoice',
        'btn.viewCreditNote': 'View credit note / Print',

        'label.from': 'From',
        'label.to': 'To',
        'label.status': 'Status',
        'label.invoiceNo': 'Invoice #',
        'search.invoicePlaceholder': 'Search invoice number…',

        'opt.approved': 'Approved',
        'opt.pending': 'Pending',
        'opt.rejected': 'Rejected',
        'opt.all': 'All',

        'th.datetime': 'Date / time',
        'th.creditNote': 'Credit note #',
        'th.invoice': 'Invoice #',
        'th.customer': 'Customer',
        'th.vehicle': 'Vehicle',
        'th.cashier': 'Cashier',
        'th.branch': 'Branch',
        'th.type': 'Type',
        'th.amount': 'Amount',
        'th.status': 'Status',

        'empty.title': 'No returns found',
        'empty.hintBefore': 'Try widening the date range or switching status to',
        'empty.hintAfter': '.',
        'showing': 'Showing {shown} of {total}',

        'status.approved': 'Approved',
        'status.pending': 'Pending',
        'status.rejected': 'Rejected',

        'scope.full': 'FULL',
        'scope.partial': 'PARTIAL',

        'perm.denied': 'You do not have permission to view sales returns.',
        'err.load': 'Failed to load sales returns.',

        'detail.title': 'Sales return {no}',
        'detail.subtitle': 'Invoice {invoice} · {customer}',
        'detail.back': 'Back to Sales Returns',
        'detail.loading': 'Loading…',
        'detail.creditNote': 'Credit note:',
        'detail.invoice': 'Invoice:',
        'detail.customer': 'Customer:',
        'detail.vehicle': 'Vehicle:',
        'detail.cashier': 'Cashier:',
        'detail.branch': 'Branch:',
        'detail.returnType': 'Return type:',
        'detail.fullReturn': 'Full return',
        'detail.partialReturn': 'Partial return',
        'detail.date': 'Date:',
        'detail.th.product': 'Product / service',
        'detail.th.returnQty': 'Return qty',
        'detail.th.lineTotal': 'Line total',
        'detail.th.reason': 'Reason',
        'fallback.customer': 'Customer',

        'print.title': 'Credit note {no}',
        'print.subtitle': 'Invoice {invoice} · {customer}',
        'print.back': 'Back to return detail',
        'print.windowTitle': 'Credit Note',

        'money.sar': 'SAR {amount}',
        'emdash': '—',
    },
    ar: {
        'page.title': 'مرتجعات المبيعات',
        'page.subtitle': '{branch} · صفّ حسب التاريخ والفاتورة والفرع والكاشير.',
        'branch.all': 'كل الفروع',
        'branch.named': 'فرع {id}',

        'kpi.shownReturns': 'المرتجعات المعروضة',
        'kpi.shownAmount': 'المبلغ المعروض',

        'btn.refresh': 'تحديث',
        'btn.apply': 'تطبيق',
        'btn.loading': 'جارٍ التحميل…',
        'btn.view': 'عرض',
        'btn.close': 'إغلاق',
        'btn.print': 'طباعة',
        'btn.viewDigitalInvoice': 'عرض الفاتورة الرقمية',
        'btn.viewCreditNote': 'عرض إشعار الدائن / طباعة',

        'label.from': 'من',
        'label.to': 'إلى',
        'label.status': 'الحالة',
        'label.invoiceNo': 'رقم الفاتورة',
        'search.invoicePlaceholder': 'ابحث برقم الفاتورة…',

        'opt.approved': 'معتمد',
        'opt.pending': 'قيد الانتظار',
        'opt.rejected': 'مرفوض',
        'opt.all': 'الكل',

        'th.datetime': 'التاريخ / الوقت',
        'th.creditNote': 'رقم إشعار الدائن',
        'th.invoice': 'رقم الفاتورة',
        'th.customer': 'العميل',
        'th.vehicle': 'المركبة',
        'th.cashier': 'الكاشير',
        'th.branch': 'الفرع',
        'th.type': 'النوع',
        'th.amount': 'المبلغ',
        'th.status': 'الحالة',

        'empty.title': 'لا توجد مرتجعات',
        'empty.hintBefore': 'جرّب توسيع نطاق التاريخ أو تغيير الحالة إلى',
        'empty.hintAfter': '.',
        'showing': 'عرض {shown} من {total}',

        'status.approved': 'معتمد',
        'status.pending': 'قيد الانتظار',
        'status.rejected': 'مرفوض',

        'scope.full': 'كامل',
        'scope.partial': 'جزئي',

        'perm.denied': 'ليس لديك صلاحية لعرض مرتجعات المبيعات.',
        'err.load': 'تعذّر تحميل مرتجعات المبيعات.',

        'detail.title': 'مرتجع مبيعات {no}',
        'detail.subtitle': 'فاتورة {invoice} · {customer}',
        'detail.back': 'العودة إلى مرتجعات المبيعات',
        'detail.loading': 'جارٍ التحميل…',
        'detail.creditNote': 'إشعار الدائن:',
        'detail.invoice': 'الفاتورة:',
        'detail.customer': 'العميل:',
        'detail.vehicle': 'المركبة:',
        'detail.cashier': 'الكاشير:',
        'detail.branch': 'الفرع:',
        'detail.returnType': 'نوع المرتجع:',
        'detail.fullReturn': 'مرتجع كامل',
        'detail.partialReturn': 'مرتجع جزئي',
        'detail.date': 'التاريخ:',
        'detail.th.product': 'المنتج / الخدمة',
        'detail.th.returnQty': 'كمية المرتجع',
        'detail.th.lineTotal': 'إجمالي السطر',
        'detail.th.reason': 'السبب',
        'fallback.customer': 'عميل',

        'print.title': 'إشعار دائن {no}',
        'print.subtitle': 'فاتورة {invoice} · {customer}',
        'print.back': 'العودة إلى تفاصيل المرتجع',
        'print.windowTitle': 'إشعار دائن',

        'money.sar': '{amount} ر.س',
        'emdash': '—',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wsrT(locale, key, vars) {
    const pack = WSR_I18N[locale] || WSR_I18N.en;
    let text = pack[key] ?? WSR_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
