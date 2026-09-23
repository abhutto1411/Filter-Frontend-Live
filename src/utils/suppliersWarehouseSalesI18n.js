/** Admin Suppliers & Warehouse Sales UI copy — keyed by portal locale (`en` | `ar`). */
const SWS_I18N = {
    en: {
        'page.title': 'Suppliers & Warehouse Sales',
        'page.sub': 'Sales invoices issued by suppliers / warehouses to workshops',
        'page.count': '{n} invoices',

        'export.pdf': 'PDF',
        'export.excel': 'Excel',
        'export.pdfTitle': 'Open print dialog → Save as PDF',
        'export.excelTitle': 'Download Excel of the current view',
        'export.title': 'Suppliers & Warehouse Sales',
        'export.sheet': 'Supplier Sales',
        'export.subtitle': '{n} invoice(s)',
        'export.statusPart': ' · status: {status}',

        'kpi.total': 'Total Invoices (matching)',
        'kpi.issued': 'Issued (this page)',
        'kpi.collected': 'Collected (this page)',
        'kpi.outstanding': 'Outstanding (this page)',

        'search.placeholder': 'Search invoice no, supplier, mobile, workshop, branch…',
        'filter.workshop': 'Workshop filter',
        'filter.branch': 'Branch filter',
        'filter.supplier': 'Supplier filter',
        'filter.status': 'Status filter',
        'filter.review': 'Workshop review status filter',
        'date.from': 'From date and time',
        'date.to': 'To date and time',

        'opt.allWorkshops': 'All Workshops',
        'opt.loadingWorkshops': 'Loading workshops…',
        'opt.allBranches': 'All Branches',
        'opt.selectWorkshopFirst': 'Select workshop first',
        'opt.allSuppliers': 'All Suppliers',
        'opt.loadingSuppliers': 'Loading suppliers…',

        'status.all': 'All Status',
        'status.pending_payment': 'Pending payment',
        'status.partially_paid': 'Partially paid',
        'status.paid': 'Paid',
        'status.cancelled': 'Cancelled',

        'review.all': 'All Review Status',
        'review.pending': 'Pending review',
        'review.accepted': 'Accepted',
        'review.rejected': 'Rejected',
        'review.pendingShort': 'Pending',

        'pay.paid': 'Paid',
        'pay.unpaid': 'Unpaid',
        'pay.partial': 'Partial',

        'aff.yes': 'Affiliated',
        'aff.no': 'Non-affiliated',
        'aff.titleYes': 'Supplier is linked to this workshop via WorkshopSupplier.',
        'aff.titleNo': 'No active WorkshopSupplier link between this supplier and workshop.',

        'th.invoice': 'Invoice #',
        'th.invoiceDate': 'Invoice Date',
        'th.dueDate': 'Due Date',
        'th.supplier': 'Supplier',
        'th.affiliation': 'Affiliation',
        'th.workshop': 'Workshop',
        'th.branch': 'Branch',
        'th.items': 'Items',
        'th.total': 'Total (SAR)',
        'th.paid': 'Paid (SAR)',
        'th.balance': 'Balance (SAR)',
        'th.payment': 'Payment',
        'th.review': 'Review',

        'row.status': 'Status: {status}',
        'loading': 'Loading…',
        'empty': 'No supplier sales invoices match these filters.',

        'page.showing': 'Showing {from}–{to} of {total}',
        'page.prev': 'Previous',
        'page.next': 'Next',
        'page.aria': 'Supplier invoices pages',
        'page.nums': 'Page numbers',

        'err.load': 'Failed to load supplier sales invoices.',
        'err.export': 'Export failed',
        'err.detail': 'Failed to load invoice details.',

        'exp.invNo': 'Invoice No',
        'exp.status': 'Status',
        'exp.invoiceDate': 'Invoice Date',
        'exp.dueDate': 'Due Date',
        'exp.supplier': 'Supplier',
        'exp.supplierMobile': 'Supplier Mobile',
        'exp.affiliation': 'Affiliation',
        'exp.workshop': 'Workshop',
        'exp.branch': 'Branch',
        'exp.items': 'Items',
        'exp.total': 'Total (SAR)',
        'exp.paid': 'Paid (SAR)',
        'exp.balance': 'Balance (SAR)',
        'exp.payment': 'Payment',
        'exp.review': 'Review',

        'detail.titleLocal': 'Local Supplier Purchase Invoice',
        'detail.titleSupplier': 'Supplier Invoice',
        'detail.titleDetails': 'Details',
        'detail.titleWithNo': '{kind} - {no}',
        'detail.titleFallback': '{kind} Details',

        'd.invoiceNo': 'INVOICE NO',
        'd.invoiceDate': 'INVOICE DATE',
        'd.dueDate': 'DUE DATE',
        'd.paymentTerms': 'PAYMENT TERMS',
        'd.status': 'STATUS',
        'd.workshopReview': 'WORKSHOP REVIEW',
        'd.rejectionReason': 'REJECTION REASON',
        'd.supplier': 'SUPPLIER',
        'd.workshop': 'WORKSHOP',
        'd.branch': 'BRANCH',
        'd.po': 'PURCHASE ORDER',
        'd.subtotal': 'SUBTOTAL',
        'd.invoiceDiscount': 'INVOICE DISCOUNT',
        'd.freightIn': 'FREIGHT IN',
        'd.vat': 'VAT',
        'd.grandTotal': 'GRAND TOTAL',
        'd.paid': 'PAID',
        'd.balance': 'BALANCE',
        'd.payment': 'PAYMENT',
        'd.vatId': 'VAT: {id}',
        'd.poLine': '#{id} · {status}',

        'd.lineItems': 'Line items',
        'd.th.item': 'Item',
        'd.th.description': 'Description',
        'd.th.qty': 'Qty',
        'd.th.unit': 'Unit (SAR)',
        'd.th.discount': 'Discount',
        'd.th.vat': 'VAT',
        'd.th.line': 'Line (SAR)',

        'd.payments': 'Payments',
        'd.th.method': 'Method',
        'd.th.amount': 'Amount (SAR)',
        'd.th.paidOn': 'Paid on',
        'd.th.reference': 'Reference',
        'd.th.recordedBy': 'Recorded by',

        'd.returns': 'Returns',
        'd.th.returnNo': 'Return #',
        'd.th.date': 'Date',
        'd.th.status': 'Status',
        'd.th.total': 'Total (SAR)',

        'money.sar': 'SAR {amount}',
    },
    ar: {
        'page.title': 'الموردون ومبيعات المستودع',
        'page.sub': 'فواتير المبيعات الصادرة من الموردين / المستودعات إلى الورش',
        'page.count': '{n} فاتورة',

        'export.pdf': 'PDF',
        'export.excel': 'Excel',
        'export.pdfTitle': 'افتح نافذة الطباعة ← احفظ كـ PDF',
        'export.excelTitle': 'تنزيل Excel للعرض الحالي',
        'export.title': 'الموردون ومبيعات المستودع',
        'export.sheet': 'مبيعات الموردين',
        'export.subtitle': '{n} فاتورة',
        'export.statusPart': ' · الحالة: {status}',

        'kpi.total': 'إجمالي الفواتير (المطابقة)',
        'kpi.issued': 'المُصدَرة (هذه الصفحة)',
        'kpi.collected': 'المحصّل (هذه الصفحة)',
        'kpi.outstanding': 'المستحق (هذه الصفحة)',

        'search.placeholder': 'البحث برقم الفاتورة أو المورد أو الجوال أو الورشة أو الفرع…',
        'filter.workshop': 'تصفية الورشة',
        'filter.branch': 'تصفية الفرع',
        'filter.supplier': 'تصفية المورد',
        'filter.status': 'تصفية الحالة',
        'filter.review': 'تصفية حالة مراجعة الورشة',
        'date.from': 'من تاريخ ووقت',
        'date.to': 'إلى تاريخ ووقت',

        'opt.allWorkshops': 'كل الورش',
        'opt.loadingWorkshops': 'جارٍ تحميل الورش…',
        'opt.allBranches': 'كل الفروع',
        'opt.selectWorkshopFirst': 'اختر الورشة أولاً',
        'opt.allSuppliers': 'كل الموردين',
        'opt.loadingSuppliers': 'جارٍ تحميل الموردين…',

        'status.all': 'كل الحالات',
        'status.pending_payment': 'بانتظار الدفع',
        'status.partially_paid': 'مدفوع جزئياً',
        'status.paid': 'مدفوع',
        'status.cancelled': 'ملغى',

        'review.all': 'كل حالات المراجعة',
        'review.pending': 'بانتظار المراجعة',
        'review.accepted': 'مقبول',
        'review.rejected': 'مرفوض',
        'review.pendingShort': 'معلّق',

        'pay.paid': 'مدفوع',
        'pay.unpaid': 'غير مدفوع',
        'pay.partial': 'جزئي',

        'aff.yes': 'مرتبط',
        'aff.no': 'غير مرتبط',
        'aff.titleYes': 'المورد مرتبط بهذه الورشة عبر WorkshopSupplier.',
        'aff.titleNo': 'لا يوجد رابط WorkshopSupplier نشط بين هذا المورد والورشة.',

        'th.invoice': 'رقم الفاتورة',
        'th.invoiceDate': 'تاريخ الفاتورة',
        'th.dueDate': 'تاريخ الاستحقاق',
        'th.supplier': 'المورد',
        'th.affiliation': 'الارتباط',
        'th.workshop': 'الورشة',
        'th.branch': 'الفرع',
        'th.items': 'البنود',
        'th.total': 'الإجمالي (ر.س)',
        'th.paid': 'المدفوع (ر.س)',
        'th.balance': 'الرصيد (ر.س)',
        'th.payment': 'الدفع',
        'th.review': 'المراجعة',

        'row.status': 'الحالة: {status}',
        'loading': 'جارٍ التحميل…',
        'empty': 'لا توجد فواتير مبيعات موردين مطابقة لهذه الفلاتر.',

        'page.showing': 'عرض {from}–{to} من {total}',
        'page.prev': 'السابق',
        'page.next': 'التالي',
        'page.aria': 'صفحات فواتير الموردين',
        'page.nums': 'أرقام الصفحات',

        'err.load': 'فشل تحميل فواتير مبيعات الموردين.',
        'err.export': 'فشل التصدير',
        'err.detail': 'فشل تحميل تفاصيل الفاتورة.',

        'exp.invNo': 'رقم الفاتورة',
        'exp.status': 'الحالة',
        'exp.invoiceDate': 'تاريخ الفاتورة',
        'exp.dueDate': 'تاريخ الاستحقاق',
        'exp.supplier': 'المورد',
        'exp.supplierMobile': 'جوال المورد',
        'exp.affiliation': 'الارتباط',
        'exp.workshop': 'الورشة',
        'exp.branch': 'الفرع',
        'exp.items': 'البنود',
        'exp.total': 'الإجمالي (ر.س)',
        'exp.paid': 'المدفوع (ر.س)',
        'exp.balance': 'الرصيد (ر.س)',
        'exp.payment': 'الدفع',
        'exp.review': 'المراجعة',

        'detail.titleLocal': 'فاتورة شراء مورد محلي',
        'detail.titleSupplier': 'فاتورة مورد',
        'detail.titleDetails': 'التفاصيل',
        'detail.titleWithNo': '{kind} - {no}',
        'detail.titleFallback': '{kind} — التفاصيل',

        'd.invoiceNo': 'رقم الفاتورة',
        'd.invoiceDate': 'تاريخ الفاتورة',
        'd.dueDate': 'تاريخ الاستحقاق',
        'd.paymentTerms': 'شروط الدفع',
        'd.status': 'الحالة',
        'd.workshopReview': 'مراجعة الورشة',
        'd.rejectionReason': 'سبب الرفض',
        'd.supplier': 'المورد',
        'd.workshop': 'الورشة',
        'd.branch': 'الفرع',
        'd.po': 'أمر الشراء',
        'd.subtotal': 'المجموع الفرعي',
        'd.invoiceDiscount': 'خصم الفاتورة',
        'd.freightIn': 'الشحن الوارد',
        'd.vat': 'الضريبة',
        'd.grandTotal': 'الإجمالي الكلي',
        'd.paid': 'المدفوع',
        'd.balance': 'الرصيد',
        'd.payment': 'الدفع',
        'd.vatId': 'الرقم الضريبي: {id}',
        'd.poLine': '#{id} · {status}',

        'd.lineItems': 'بنود السطر',
        'd.th.item': 'البند',
        'd.th.description': 'الوصف',
        'd.th.qty': 'الكمية',
        'd.th.unit': 'الوحدة (ر.س)',
        'd.th.discount': 'الخصم',
        'd.th.vat': 'الضريبة',
        'd.th.line': 'السطر (ر.س)',

        'd.payments': 'المدفوعات',
        'd.th.method': 'الطريقة',
        'd.th.amount': 'المبلغ (ر.س)',
        'd.th.paidOn': 'تاريخ الدفع',
        'd.th.reference': 'المرجع',
        'd.th.recordedBy': 'سجّل بواسطة',

        'd.returns': 'المرتجعات',
        'd.th.returnNo': 'رقم المرتجع',
        'd.th.date': 'التاريخ',
        'd.th.status': 'الحالة',
        'd.th.total': 'الإجمالي (ر.س)',

        'money.sar': '{amount} ر.س',
    },
};

const STATUS_LABEL_KEYS = {
    pending_payment: 'status.pending_payment',
    partially_paid: 'status.partially_paid',
    paid: 'status.paid',
    cancelled: 'status.cancelled',
};

const PAY_LABEL_KEYS = {
    paid: 'pay.paid',
    unpaid: 'pay.unpaid',
    partial: 'pay.partial',
};

const REVIEW_LABEL_KEYS = {
    pending: 'review.pendingShort',
    accepted: 'review.accepted',
    rejected: 'review.rejected',
};

export function swsT(locale, key, vars) {
    const pack = SWS_I18N[locale] || SWS_I18N.en;
    let text = pack[key] ?? SWS_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}

export function formatSwsStatusLabel(status, t) {
    if (status == null || String(status).trim() === '') return '—';
    const key = String(status).trim().toLowerCase();
    const labelKey = STATUS_LABEL_KEYS[key] || PAY_LABEL_KEYS[key] || REVIEW_LABEL_KEYS[key];
    if (labelKey) return t(labelKey);
    return String(status)
        .trim()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const SWS_STATUS_FILTER_VALUES = ['', 'pending_payment', 'partially_paid', 'paid', 'cancelled'];
export const SWS_REVIEW_FILTER_VALUES = ['', 'pending', 'accepted', 'rejected'];

export const SWS_STATUS_FILTER_KEYS = {
    '': 'status.all',
    pending_payment: 'status.pending_payment',
    partially_paid: 'status.partially_paid',
    paid: 'status.paid',
    cancelled: 'status.cancelled',
};

export const SWS_REVIEW_FILTER_KEYS = {
    '': 'review.all',
    pending: 'review.pending',
    accepted: 'review.accepted',
    rejected: 'review.rejected',
};
