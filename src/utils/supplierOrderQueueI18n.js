/** Supplier portal — Order Queue. Locale: `en` | `ar` (MSA). */
const SOQ_I18N = {
    en: {
        'title': 'Order Queue',
        'subtitle': 'Workshop branch stock requests',

        'error.load': 'Failed to load orders',
        'error.couldNotLoad': 'Could not load orders:',

        'seg.all': 'All',
        'seg.allCount': 'All ({count})',
        'seg.pendingApproval': 'Pending approval',
        'seg.approved': 'Approved',
        'seg.rejected': 'Rejected',
        'seg.stageCount': '{label} ({count})',

        'link.classicPo': 'Classic branch purchase orders (PO queue)',
        'link.classicPoHint': '— separate from workshop purchase invoices above.',

        'wpi.hint':
            'Approve or reject, then Prepare sales invoice (same AR/stock/GL as Sales Invoices). Same data as Finance → Workshop purchases.',
        'wpi.prepareSalesInvoice': 'Prepare sales invoice',
        'wpi.financeWorkshopPurchases': 'Finance → Workshop purchases',

        'stage.pendingAcceptance': 'Pending Acceptance',
        'stage.accepted': 'Accepted',
        'stage.processing': 'Processing',
        'stage.readyToDispatch': 'Ready to Dispatch',
        'stage.dispatched': 'Dispatched / On Way',
        'stage.delivered': 'Delivered',

        'empty.title': 'No orders in queue',
        'empty.body': 'Workshop requests will appear here when the backend returns purchase orders.',

        'items.one': '{count} item',
        'items.many': '{count} items',
        'card.totalItems': '{total} · {items}',

        'action.view': 'View',
        'action.accept': 'Accept',
        'action.reject': 'Reject',
        'action.startProcessing': 'Start processing',
        'action.readyToDispatch': 'Ready to dispatch',
        'action.dispatch': 'Dispatch',
        'action.markDelivered': 'Mark delivered',
        'action.aria': 'Actions for order {id}',

        'notes.processing': 'Processing started',
        'notes.ready': 'Packed and ready for dispatch',
        'notes.dispatched': 'Order dispatched',
        'notes.delivered': 'Order delivered successfully',
        'notes.rejectReason': 'Rejected by supplier',

        'modal.title': 'Order Detail — {id}',
        'modal.close': 'Close',
        'modal.branch': 'Branch:',
        'modal.requestedAt': 'Requested At:',
        'modal.status': 'Status:',
        'modal.total': 'Total:',
        'modal.notes': 'Notes:',
        'modal.rejection': 'Rejection:',
        'modal.items': 'Items',
        'modal.noItems': 'No line items available for this order.',
        'modal.th.product': 'Product',
        'modal.th.qty': 'Qty',
        'modal.th.unitPrice': 'Unit Price',
        'modal.th.total': 'Total',

        'money.sar': 'SAR {amount}',
        'emdash': '—',
    },
    ar: {
        'title': 'قائمة الطلبات',
        'subtitle': 'طلبات مخزون فروع الورش',

        'error.load': 'فشل تحميل الطلبات',
        'error.couldNotLoad': 'تعذر تحميل الطلبات:',

        'seg.all': 'الكل',
        'seg.allCount': 'الكل ({count})',
        'seg.pendingApproval': 'بانتظار الاعتماد',
        'seg.approved': 'معتمد',
        'seg.rejected': 'مرفوض',
        'seg.stageCount': '{label} ({count})',

        'link.classicPo': 'أوامر شراء الفروع الكلاسيكية (قائمة أوامر الشراء)',
        'link.classicPoHint': '— منفصلة عن فواتير مشتريات الورش أعلاه.',

        'wpi.hint':
            'اعتمد أو ارفض، ثم جهّز فاتورة مبيعات (نفس الذمم/المخزون/دفتر الأستاذ كفواتير المبيعات). نفس بيانات المالية ← مشتريات الورش.',
        'wpi.prepareSalesInvoice': 'جهّز فاتورة مبيعات',
        'wpi.financeWorkshopPurchases': 'المالية ← مشتريات الورش',

        'stage.pendingAcceptance': 'بانتظار القبول',
        'stage.accepted': 'مقبول',
        'stage.processing': 'قيد المعالجة',
        'stage.readyToDispatch': 'جاهز للإرسال',
        'stage.dispatched': 'تم الإرسال / في الطريق',
        'stage.delivered': 'تم التسليم',

        'empty.title': 'لا توجد طلبات في القائمة',
        'empty.body': 'ستظهر طلبات الورش هنا عندما يعيد الخادم أوامر الشراء.',

        'items.one': 'صنف واحد',
        'items.many': '{count} أصناف',
        'card.totalItems': '{total} · {items}',

        'action.view': 'عرض',
        'action.accept': 'قبول',
        'action.reject': 'رفض',
        'action.startProcessing': 'بدء المعالجة',
        'action.readyToDispatch': 'جاهز للإرسال',
        'action.dispatch': 'إرسال',
        'action.markDelivered': 'تأكيد التسليم',
        'action.aria': 'إجراءات الطلب {id}',

        'notes.processing': 'بدأت المعالجة',
        'notes.ready': 'تم التعبئة وجاهز للإرسال',
        'notes.dispatched': 'تم إرسال الطلب',
        'notes.delivered': 'تم تسليم الطلب بنجاح',
        'notes.rejectReason': 'مرفوض من المورد',

        'modal.title': 'تفاصيل الطلب — {id}',
        'modal.close': 'إغلاق',
        'modal.branch': 'الفرع:',
        'modal.requestedAt': 'تاريخ الطلب:',
        'modal.status': 'الحالة:',
        'modal.total': 'الإجمالي:',
        'modal.notes': 'ملاحظات:',
        'modal.rejection': 'سبب الرفض:',
        'modal.items': 'الأصناف',
        'modal.noItems': 'لا توجد بنود لهذا الطلب.',
        'modal.th.product': 'المنتج',
        'modal.th.qty': 'الكمية',
        'modal.th.unitPrice': 'سعر الوحدة',
        'modal.th.total': 'الإجمالي',

        'money.sar': '{amount} ر.س',
        'emdash': '—',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function soqT(locale, key, vars) {
    const pack = SOQ_I18N[locale] || SOQ_I18N.en;
    let text = pack[key] ?? SOQ_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
