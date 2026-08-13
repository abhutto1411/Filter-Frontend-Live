/** Supplier portal — Workshop purchase invoices panel. Locale: `en` | `ar` (MSA). */
const SWPI_I18N = {
    en: {
        'title.embedded': 'Workshop purchase invoices',
        'title.filters': 'Filters',
        'subtitle.embedded':
            'Approve or reject the order, then use Prepare sales invoice (same AR/stock/GL as Sales Invoices).',

        'filter.allStatuses': 'All statuses',
        'filter.pending': 'Pending approval',
        'filter.approved': 'Approved — awaiting sales invoice',
        'filter.rejected': 'Rejected',
        'filter.label': 'Filter: {status}',
        'filter.all': 'All',

        'btn.loading': 'Loading…',
        'btn.refresh': 'Refresh',

        'th.invoice': 'Invoice #',
        'th.vendorRef': 'Vendor ref',
        'th.issueDate': 'Issue date',
        'th.productName': 'Product name',
        'th.quantity': 'Quantity',
        'th.unit': 'Unit',
        'th.unitPrice': 'Unit price',
        'th.total': 'Total',
        'th.status': 'Status',
        'th.actions': 'Actions',

        'empty': 'No workshop purchase invoices',

        'tip.unitPrice': 'Unit price (ex VAT)',
        'tip.unitPriceFirst': 'Unit price (ex VAT) — first line',
        'unitPrice.firstLine': '(1st line)',

        'status.pending': 'pending',
        'status.approved': 'approved',
        'status.rejected': 'rejected',
        'status.delivered': 'delivered',
        'status.on_the_way': 'On the way',

        'action.aria': 'Actions for {id}',
        'action.invoiceFallback': 'invoice',
        'action.view': 'View',
        'action.openSalesInvoice': 'Open sales invoice (AR)',
        'action.edit': 'Edit purchase invoice',
        'action.approve': 'Approve',
        'action.reject': 'Reject',
        'action.prepareSalesInvoice': 'Prepare sales invoice',

        'modal.viewTitle': 'Workshop purchase invoice',
        'modal.linkedSiBefore': 'Linked',
        'modal.linkedSiStrong': 'sales invoice (AR)',
        'modal.linkedSiAfter': '— same accounting as Sales Invoices.',
        'modal.openSalesInvoice': 'Open sales invoice',
        'modal.rejectTitle': 'Reject invoice',
        'modal.cancel': 'Cancel',
        'modal.rejecting': 'Rejecting…',
        'modal.reject': 'Reject',
        'modal.rejectPlaceholder': 'Reason for rejection…',

        'error.load': 'Failed to load workshop purchase invoices.',
        'error.editLoad': 'Could not load invoice for editing.',
        'error.approve': 'Approve failed.',
        'error.prefill': 'Could not build sales invoice prefill.',
        'error.prepareSi': 'Prepare sales invoice failed.',
        'error.reject': 'Reject failed.',

        'money.sar': 'SAR {amount}',
        'emdash': '—',
    },
    ar: {
        'title.embedded': 'فواتير مشتريات الورش',
        'title.filters': 'عوامل التصفية',
        'subtitle.embedded':
            'اعتمد أو ارفض الطلب، ثم استخدم جهّز فاتورة مبيعات (نفس الذمم/المخزون/دفتر الأستاذ كفواتير المبيعات).',

        'filter.allStatuses': 'كل الحالات',
        'filter.pending': 'بانتظار الاعتماد',
        'filter.approved': 'معتمد — بانتظار فاتورة المبيعات',
        'filter.rejected': 'مرفوض',
        'filter.label': 'التصفية: {status}',
        'filter.all': 'الكل',

        'btn.loading': 'جاري التحميل…',
        'btn.refresh': 'تحديث',

        'th.invoice': 'رقم الفاتورة',
        'th.vendorRef': 'مرجع المورد',
        'th.issueDate': 'تاريخ الإصدار',
        'th.productName': 'اسم المنتج',
        'th.quantity': 'الكمية',
        'th.unit': 'الوحدة',
        'th.unitPrice': 'سعر الوحدة',
        'th.total': 'الإجمالي',
        'th.status': 'الحالة',
        'th.actions': 'إجراءات',

        'empty': 'لا توجد فواتير مشتريات ورش',

        'tip.unitPrice': 'سعر الوحدة (بدون ضريبة)',
        'tip.unitPriceFirst': 'سعر الوحدة (بدون ضريبة) — البند الأول',
        'unitPrice.firstLine': '(البند الأول)',

        'status.pending': 'بانتظار',
        'status.approved': 'معتمد',
        'status.rejected': 'مرفوض',
        'status.delivered': 'تم التسليم',
        'status.on_the_way': 'في الطريق',

        'action.aria': 'إجراءات لـ {id}',
        'action.invoiceFallback': 'فاتورة',
        'action.view': 'عرض',
        'action.openSalesInvoice': 'فتح فاتورة المبيعات (ذمم)',
        'action.edit': 'تعديل فاتورة المشتريات',
        'action.approve': 'اعتماد',
        'action.reject': 'رفض',
        'action.prepareSalesInvoice': 'جهّز فاتورة مبيعات',

        'modal.viewTitle': 'فاتورة مشتريات ورشة',
        'modal.linkedSiBefore': 'مرتبطة بـ',
        'modal.linkedSiStrong': 'فاتورة مبيعات (ذمم)',
        'modal.linkedSiAfter': '— نفس المحاسبة كفواتير المبيعات.',
        'modal.openSalesInvoice': 'فتح فاتورة المبيعات',
        'modal.rejectTitle': 'رفض الفاتورة',
        'modal.cancel': 'إلغاء',
        'modal.rejecting': 'جاري الرفض…',
        'modal.reject': 'رفض',
        'modal.rejectPlaceholder': 'سبب الرفض…',

        'error.load': 'فشل تحميل فواتير مشتريات الورش.',
        'error.editLoad': 'تعذر تحميل الفاتورة للتعديل.',
        'error.approve': 'فشل الاعتماد.',
        'error.prefill': 'تعذر بناء بيانات فاتورة المبيعات المسبقة.',
        'error.prepareSi': 'فشل تجهيز فاتورة المبيعات.',
        'error.reject': 'فشل الرفض.',

        'money.sar': '{amount} ر.س',
        'emdash': '—',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function swpiT(locale, key, vars) {
    const pack = SWPI_I18N[locale] || SWPI_I18N.en;
    let text = pack[key] ?? SWPI_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string|null|undefined} status
 */
export function swpiStatusLabel(locale, status) {
    const raw = String(status ?? '').trim();
    if (!raw) return swpiT(locale, 'emdash');
    const key = `status.${raw}`;
    const pack = SWPI_I18N[locale] || SWPI_I18N.en;
    if (pack[key] || SWPI_I18N.en[key]) return swpiT(locale, key);
    return raw.replace(/_/g, ' ');
}
