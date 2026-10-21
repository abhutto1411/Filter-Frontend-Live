/** Supplier portal — Dashboard. Locale: `en` | `ar` (MSA). */
const SDASH_I18N = {
    en: {
        'title': 'Supplier & Warehouse Dashboard',
        'subtitle': 'Overview of orders, AR, outstanding invoices & cash',

        'error.backend': 'Backend error:',
        'error.load': 'Failed to load dashboard.',
        'error.reportsPartial': 'Reports summary unavailable.',
        'error.reportsHint': 'Some totals may show “—” until this succeeds.',
        'error.workshopOrders': 'Unable to load workshop orders ({error})',

        'kpi.newPos': 'NEW POS',
        'kpi.newPosSub': 'Pending acceptance',
        'kpi.ar': 'ACCOUNTS RECEIVABLE',
        'kpi.arSub': 'From workshops',
        'kpi.ap': 'ACCOUNTS PAYABLE',
        'kpi.apSub': 'To vendors',
        'kpi.cash': 'CASH & BANK',
        'kpi.cashSub': 'Total balance',

        'stage.pending': 'Pending',
        'stage.accepted': 'Accepted',
        'stage.processing': 'Processing',
        'stage.readyToDeliver': 'Ready to Deliver',
        'stage.onTheWay': 'On the Way',
        'stage.delivered': 'Delivered',

        'status.onTheWay': 'On the way',
        'status.pending': 'pending',
        'status.approved': 'approved',
        'status.rejected': 'rejected',
        'status.processing': 'processing',
        'status.ready_to_dispatch': 'ready to dispatch',
        'status.on_the_way': 'on the way',
        'status.delivered': 'delivered',

        'storage.title': 'Storage Facility',
        'storage.brandsAr': '{count} brand · AR {amount}',
        'storage.brandsArPlural': '{count} brands · AR {amount}',
        'storage.manage': 'Manage storage brands',

        'critical.title': 'Critical stock alerts ({count})',
        'critical.viewInventory': 'View inventory',
        'critical.detail': '{qty} {unit} on hand · reorder at {critical} {unit}',

        'quick.title': 'Quick actions',
        'quick.orderQueue': 'Order Queue',
        'quick.stock': 'Stock Inventory',
        'quick.salesInvoices': 'Sales Invoices (AR)',
        'quick.purchaseInvoices': 'Purchase Invoices (AP)',
        'quick.staff': 'Staff & Roles',
        'quick.accounting': 'Accounting',
        'quick.storage': 'Storage Facility',

        'recent.title': 'Recent workshop orders',
        'recent.viewAll': 'View all',
        'recent.empty':
            'No workshop purchase invoices yet. Workshops send these from Purchase Invoices after they raise stock requests.',

        'th.invoice': 'Invoice #',
        'th.vendorRef': 'Vendor ref',
        'th.issueDate': 'Issue date',
        'th.product': 'Product name',
        'th.qty': 'Quantity',
        'th.unit': 'Unit',
        'th.unitPrice': 'Unit price',
        'th.total': 'Total',
        'th.status': 'Status',

        'money.sar': 'SAR {amount}',
        'emdash': '—',
        'ellipsis': '…',
    },
    ar: {
        'title': 'لوحة تحكم المورد والمستودع',
        'subtitle': 'نظرة عامة على الطلبات والذمم والفواتير المستحقة والنقد',

        'error.backend': 'خطأ في الخادم:',
        'error.load': 'فشل تحميل لوحة التحكم.',
        'error.reportsPartial': 'ملخص التقارير غير متاح.',
        'error.reportsHint': 'قد تظهر بعض الإجماليات «—» حتى ينجح التحميل.',
        'error.workshopOrders': 'تعذر تحميل طلبات الورش ({error})',

        'kpi.newPos': 'طلبات جديدة',
        'kpi.newPosSub': 'بانتظار القبول',
        'kpi.ar': 'الذمم المدينة',
        'kpi.arSub': 'من الورش',
        'kpi.ap': 'الذمم الدائنة',
        'kpi.apSub': 'للموردين',
        'kpi.cash': 'النقد والبنك',
        'kpi.cashSub': 'إجمالي الرصيد',

        'stage.pending': 'قيد الانتظار',
        'stage.accepted': 'مقبول',
        'stage.processing': 'قيد المعالجة',
        'stage.readyToDeliver': 'جاهز للتسليم',
        'stage.onTheWay': 'في الطريق',
        'stage.delivered': 'تم التسليم',

        'status.onTheWay': 'في الطريق',
        'status.pending': 'قيد الانتظار',
        'status.approved': 'معتمد',
        'status.rejected': 'مرفوض',
        'status.processing': 'قيد المعالجة',
        'status.ready_to_dispatch': 'جاهز للإرسال',
        'status.on_the_way': 'في الطريق',
        'status.delivered': 'تم التسليم',

        'storage.title': 'منشأة التخزين',
        'storage.brandsAr': 'علامة واحدة · ذمم {amount}',
        'storage.brandsArPlural': '{count} علامات · ذمم {amount}',
        'storage.manage': 'إدارة علامات التخزين',

        'critical.title': 'تنبيهات مخزون حرجة ({count})',
        'critical.viewInventory': 'عرض المخزون',
        'critical.detail': '{qty} {unit} متوفر · إعادة الطلب عند {critical} {unit}',

        'quick.title': 'إجراءات سريعة',
        'quick.orderQueue': 'قائمة الطلبات',
        'quick.stock': 'مخزون المستودع',
        'quick.salesInvoices': 'فواتير المبيعات (ذمم)',
        'quick.purchaseInvoices': 'فواتير المشتريات (دائن)',
        'quick.staff': 'الموظفون والأدوار',
        'quick.accounting': 'المحاسبة',
        'quick.storage': 'منشأة التخزين',

        'recent.title': 'أحدث طلبات الورش',
        'recent.viewAll': 'عرض الكل',
        'recent.empty':
            'لا توجد فواتير مشتريات ورش بعد. ترسلها الورش من فواتير المشتريات بعد رفع طلبات المخزون.',

        'th.invoice': 'رقم الفاتورة',
        'th.vendorRef': 'مرجع المورد',
        'th.issueDate': 'تاريخ الإصدار',
        'th.product': 'اسم المنتج',
        'th.qty': 'الكمية',
        'th.unit': 'الوحدة',
        'th.unitPrice': 'سعر الوحدة',
        'th.total': 'الإجمالي',
        'th.status': 'الحالة',

        'money.sar': '{amount} ر.س',
        'emdash': '—',
        'ellipsis': '…',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function sdashT(locale, key, vars) {
    const pack = SDASH_I18N[locale] || SDASH_I18N.en;
    let text = pack[key] ?? SDASH_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
