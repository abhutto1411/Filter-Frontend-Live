/** Supplier Affiliated Sales Returns UI — keyed by portal locale (`en` | `ar`). */
export const SSR_I18N = {
    en: {
        'money.sar': 'SAR {amount}',
        'emdash': '—',

        'page.breadcrumb': 'Sales Returns',
        'page.title': 'Affiliated sales returns',
        'page.subtitle':
            'Credit goods back to affiliated workshops. Each return creates a linked workshop purchase return that the workshop must approve or confirm via QR before stock and accounting finalize on both sides.',
        'page.subtitle.strong': 'workshop purchase return',

        'btn.newReturn': 'New return',
        'btn.search': 'Search',
        'btn.cancel': 'Cancel',
        'btn.backList': 'Back to list',
        'btn.backReturns': 'Back to Sales Returns',
        'btn.createLinked': 'Create linked return',
        'btn.creating': 'Creating…',
        'btn.approveTitle': 'Approve and receive stock',
        'btn.viewTitle': 'View credit note',

        'label.status': 'Status',
        'aria.filterStatus': 'Filter by status',
        'aria.searchReturns': 'Search returns',
        'search.placeholder': 'Search return #, invoice, workshop…',

        'opt.allReturns': 'All returns',
        'opt.pendingWorkshop': 'Pending workshop',
        'opt.approved': 'Approved',
        'opt.posted': 'Posted',

        'th.returnDate': 'Return date',
        'th.returnNo': 'Return #',
        'th.salesInvoice': 'Sales invoice',
        'th.workshopBranch': 'Workshop / branch',
        'th.amount': 'Amount',
        'th.supplierStatus': 'Supplier status',
        'th.workshopReturn': 'Workshop return',
        'th.workshopStatus': 'Workshop status',

        'empty.title': 'No affiliated returns yet',
        'empty.hint':
            'Create a return against an affiliated sales invoice — a linked purchase return is sent to the workshop automatically.',

        'status.posted': 'Posted',
        'status.approved': 'Approved',
        'status.rejected': 'Rejected',
        'status.pendingSupplier': 'Pending supplier',
        'status.pendingWorkshop': 'Pending workshop',

        'fallback.customer': 'Customer',
        'fallback.return': 'Return',
        'issued': 'Issued {date}',

        'err.load': 'Failed to load sales returns.',
        'err.loadInvoices': 'Failed to load sales invoices.',
        'err.loadInvoice': 'Failed to load invoice detail.',
        'err.loadDetail': 'Failed to load return details.',
        'err.approve': 'Failed to approve return.',
        'err.create': 'Failed to create linked return.',
        'err.needInvoice':
            'Sales invoice is optional while filling the form. To submit, pick an invoice and enter at least one return quantity.',
        'err.needQty': 'Enter at least one return quantity.',

        'confirm.approve':
            'Approve return {no}?\n\nWorkshop branch stock will decrease and your supplier warehouse stock will increase.\n\nThis action cannot be undone.',
        'success.approved': 'Approved {no}',
        'success.created':
            'Return {returnNo} created — linked workshop purchase return {purchaseReturnNo}.',

        'form.breadcrumbNew': 'Sales Returns › New',
        'form.breadcrumbParent': 'Sales Returns',
        'form.breadcrumbNewLeaf': 'New',
        'form.title': 'Affiliated sales return',
        'form.alert':
            'This return is sent to the affiliated workshop as a purchase return. Stock and GL on both sides update only after the workshop approves or scans the QR — not immediately on submit.',
        'form.alert.purchaseReturn': 'purchase return',
        'form.alert.approves': 'approves',
        'form.alert.scansQr': 'scans the QR',

        'form.salesInvoice': 'Sales invoice',
        'form.optional': '(optional)',
        'form.invoicePlaceholder': 'Type invoice #, customer, product… (↑↓ Enter)',
        'form.loadingInvoices': 'Loading sales invoices…',
        'form.noInvoices': 'No sales invoices yet — create one under Sales Invoices (AR)',
        'form.noMatches': 'No matches — try invoice #, customer, or product',
        'form.invoiceHint':
            '{n} sales invoice{s} — type to search, ↑↓ to navigate, Enter to select (optional)',

        'form.invoiceNo': 'Invoice #',
        'form.issueDate': 'Issue date',
        'form.dueDate': 'Due date',
        'form.customer': 'Workshop / branch (customer)',
        'form.grandTotal': 'Grand total',
        'form.paid': 'Paid',
        'form.balanceDue': 'Balance due',
        'form.returnDate': 'Return date',
        'form.reference': 'Reference',
        'form.referencePh': 'Optional reference',
        'form.description': 'Description',
        'form.descriptionPh': 'Short description for the workshop',
        'form.prevReturns': 'Previous returns on this invoice ({n})',
        'form.col.item': 'Item',
        'form.col.invoiced': 'Invoiced',
        'form.col.returned': 'Returned',
        'form.col.left': 'Left',
        'form.col.returnQty': 'Return qty',
        'form.col.reason': 'Reason',
        'form.reasonPh': 'Optional',
        'form.noInvoiceLines':
            'Optionally select a sales invoice above to load its lines. You can still fill return date, reference, and notes without one.',
        'form.noLineItems': 'This invoice has no line items to return.',
        'form.notes': 'Notes (optional)',
        'form.notesPh': 'Internal note for this return',
        'form.returnTotal': 'Return total:',
        'form.footerAlert':
            'A linked workshop purchase return is created automatically and stays pending until the workshop approves it.',
        'form.footerAlert.strong': 'workshop purchase return',

        'view.creditNote': 'Credit Note',
        'view.loadFailed': 'Could not load return details.',
    },
    ar: {
        'money.sar': '{amount} ر.س',
        'emdash': '—',

        'page.breadcrumb': 'مرتجعات المبيعات',
        'page.title': 'مرتجعات المبيعات التابعة',
        'page.subtitle':
            'أرجع البضائع إلى الورش التابعة. كل مرتجع ينشئ مرتجع شراء ورشة مرتبطًا يجب أن تعتمدَه الورشة أو تؤكده عبر رمز QR قبل اكتمال المخزون والمحاسبة على الجانبين.',
        'page.subtitle.strong': 'مرتجع شراء الورشة',

        'btn.newReturn': 'مرتجع جديد',
        'btn.search': 'بحث',
        'btn.cancel': 'إلغاء',
        'btn.backList': 'العودة إلى القائمة',
        'btn.backReturns': 'العودة إلى مرتجعات المبيعات',
        'btn.createLinked': 'إنشاء مرتجع مرتبط',
        'btn.creating': 'جارٍ الإنشاء…',
        'btn.approveTitle': 'اعتماد واستلام المخزون',
        'btn.viewTitle': 'عرض إشعار الدائن',

        'label.status': 'الحالة',
        'aria.filterStatus': 'تصفية حسب الحالة',
        'aria.searchReturns': 'بحث المرتجعات',
        'search.placeholder': 'بحث برقم المرتجع أو الفاتورة أو الورشة…',

        'opt.allReturns': 'كل المرتجعات',
        'opt.pendingWorkshop': 'بانتظار الورشة',
        'opt.approved': 'معتمد',
        'opt.posted': 'مرحّل',

        'th.returnDate': 'تاريخ المرتجع',
        'th.returnNo': 'رقم المرتجع',
        'th.salesInvoice': 'فاتورة المبيعات',
        'th.workshopBranch': 'الورشة / الفرع',
        'th.amount': 'المبلغ',
        'th.supplierStatus': 'حالة المورد',
        'th.workshopReturn': 'مرتجع الورشة',
        'th.workshopStatus': 'حالة الورشة',

        'empty.title': 'لا توجد مرتجعات تابعة بعد',
        'empty.hint':
            'أنشئ مرتجعًا مقابل فاتورة مبيعات تابعة — يُرسل مرتجع شراء مرتبط إلى الورشة تلقائيًا.',

        'status.posted': 'مرحّل',
        'status.approved': 'معتمد',
        'status.rejected': 'مرفوض',
        'status.pendingSupplier': 'بانتظار المورد',
        'status.pendingWorkshop': 'بانتظار الورشة',

        'fallback.customer': 'عميل',
        'fallback.return': 'مرتجع',
        'issued': 'صدرت {date}',

        'err.load': 'فشل تحميل مرتجعات المبيعات.',
        'err.loadInvoices': 'فشل تحميل فواتير المبيعات.',
        'err.loadInvoice': 'فشل تحميل تفاصيل الفاتورة.',
        'err.loadDetail': 'فشل تحميل تفاصيل المرتجع.',
        'err.approve': 'فشل اعتماد المرتجع.',
        'err.create': 'فشل إنشاء المرتجع المرتبط.',
        'err.needInvoice':
            'فاتورة المبيعات اختيارية أثناء التعبئة. للإرسال، اختر فاتورة وأدخل كمية مرتجع واحدة على الأقل.',
        'err.needQty': 'أدخل كمية مرتجع واحدة على الأقل.',

        'confirm.approve':
            'اعتماد المرتجع {no}؟\n\nسينخفض مخزون فرع الورشة ويزيد مخزون مستودع المورد.\n\nلا يمكن التراجع عن هذا الإجراء.',
        'success.approved': 'تم اعتماد {no}',
        'success.created':
            'تم إنشاء المرتجع {returnNo} — مرتجع شراء الورشة المرتبط {purchaseReturnNo}.',

        'form.breadcrumbNew': 'مرتجعات المبيعات › جديد',
        'form.breadcrumbParent': 'مرتجعات المبيعات',
        'form.breadcrumbNewLeaf': 'جديد',
        'form.title': 'مرتجع مبيعات تابع',
        'form.alert':
            'يُرسل هذا المرتجع إلى الورشة التابعة كمرتجع شراء. يتحدّث المخزون ودفتر الأستاذ على الجانبين فقط بعد أن تعتمد الورشة أو تمسح رمز QR — وليس فور الإرسال.',
        'form.alert.purchaseReturn': 'مرتجع شراء',
        'form.alert.approves': 'تعتمد',
        'form.alert.scansQr': 'تمسح رمز QR',

        'form.salesInvoice': 'فاتورة المبيعات',
        'form.optional': '(اختياري)',
        'form.invoicePlaceholder': 'اكتب رقم الفاتورة أو العميل أو المنتج… (↑↓ Enter)',
        'form.loadingInvoices': 'جارٍ تحميل فواتير المبيعات…',
        'form.noInvoices': 'لا توجد فواتير مبيعات بعد — أنشئ واحدة ضمن فواتير المبيعات (ذمم مدينة)',
        'form.noMatches': 'لا نتائج — جرّب رقم الفاتورة أو العميل أو المنتج',
        'form.invoiceHint':
            '{n} فاتورة مبيعات — اكتب للبحث، ↑↓ للتنقل، Enter للاختيار (اختياري)',

        'form.invoiceNo': 'رقم الفاتورة',
        'form.issueDate': 'تاريخ الإصدار',
        'form.dueDate': 'تاريخ الاستحقاق',
        'form.customer': 'الورشة / الفرع (العميل)',
        'form.grandTotal': 'الإجمالي الكلي',
        'form.paid': 'المدفوع',
        'form.balanceDue': 'الرصيد المستحق',
        'form.returnDate': 'تاريخ المرتجع',
        'form.reference': 'المرجع',
        'form.referencePh': 'مرجع اختياري',
        'form.description': 'الوصف',
        'form.descriptionPh': 'وصف مختصر للورشة',
        'form.prevReturns': 'مرتجعات سابقة على هذه الفاتورة ({n})',
        'form.col.item': 'البند',
        'form.col.invoiced': 'المفوتر',
        'form.col.returned': 'المرتجع',
        'form.col.left': 'المتبقي',
        'form.col.returnQty': 'كمية المرتجع',
        'form.col.reason': 'السبب',
        'form.reasonPh': 'اختياري',
        'form.noInvoiceLines':
            'يمكنك اختيار فاتورة مبيعات أعلاه لتحميل بنودها. يمكنك تعبئة تاريخ المرتجع والمرجع والملاحظات بدون فاتورة.',
        'form.noLineItems': 'لا تحتوي هذه الفاتورة على بنود للإرجاع.',
        'form.notes': 'ملاحظات (اختياري)',
        'form.notesPh': 'ملاحظة داخلية لهذا المرتجع',
        'form.returnTotal': 'إجمالي المرتجع:',
        'form.footerAlert':
            'يُنشأ مرتجع شراء ورشة مرتبط تلقائيًا ويبقى معلّقًا حتى تعتمدَه الورشة.',
        'form.footerAlert.strong': 'مرتجع شراء الورشة',

        'view.creditNote': 'إشعار دائن',
        'view.loadFailed': 'تعذّر تحميل تفاصيل المرتجع.',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function ssrT(locale, key, vars) {
    const pack = SSR_I18N[locale] || SSR_I18N.en;
    let text = pack[key] ?? SSR_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
