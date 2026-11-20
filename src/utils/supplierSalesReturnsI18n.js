/** Supplier Affiliated Sales Returns UI — keyed by portal locale (`en` | `ar`). */
export const SSR_I18N = {
    en: {
        'money.sar': 'SAR {amount}',
        'emdash': '—',

        'page.breadcrumb': 'Sales Returns',
        'page.title': 'Affiliated sales returns',
        'page.subtitle':
            'Credit goods back to customers. Link a sales invoice when you have one, or return any products without an invoice. Affiliated returns still need workshop approval or QR confirmation before stock and accounting finalize on both sides.',
        'page.subtitle.strong': 'workshop purchase return',

        'btn.newReturn': 'New return',
        'btn.search': 'Search',
        'btn.cancel': 'Cancel',
        'btn.backList': 'Back to list',
        'btn.backReturns': 'Back to Sales Returns',
        'btn.createLinked': 'Create linked return',
        'btn.createUnlinked': 'Create sales return',
        'btn.creating': 'Creating…',
        'btn.saving': 'Saving…',
        'btn.saveUpdate': 'Save changes',
        'btn.addLine': 'Add product line',
        'btn.removeLine': 'Remove line',
        'btn.approveTitle': 'Approve and receive stock',
        'btn.viewTitle': 'View credit note',
        'btn.editTitle': 'Edit return',

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
            'Create a return for a customer — with or without a sales invoice. Affiliated returns send a purchase return to the workshop automatically.',

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
        'err.update': 'Failed to update sales return.',
        'err.editRejected': 'Rejected returns cannot be edited.',
        'err.needCustomer': 'Select a customer before creating the return.',
        'err.inactiveCustomer': 'This customer is inactive and cannot be used for a new return.',
        'err.needInvoice':
            'Sales invoice is optional. To submit a linked return, pick an invoice and enter at least one return quantity.',
        'err.needQty': 'Enter at least one return quantity.',
        'err.needManualLines':
            'Add at least one product with a return quantity, or select a sales invoice.',
        'err.loadCustomers': 'Failed to load customers.',

        'confirm.approve':
            'Approve return {no}?\n\nWorkshop branch stock will decrease and your supplier warehouse stock will increase.\n\nThis action cannot be undone.',
        'success.approved': 'Approved {no}',
        'success.created':
            'Return {returnNo} created — linked workshop purchase return {purchaseReturnNo}.',
        'success.createdUnlinked': 'Return {returnNo} created without a sales invoice.',
        'success.updated': 'Return {returnNo} updated — stock and ledgers refreshed.',

        'form.breadcrumbNew': 'Sales Returns › New',
        'form.breadcrumbParent': 'Sales Returns',
        'form.breadcrumbNewLeaf': 'New',
        'form.breadcrumbEditLeaf': 'Edit',
        'form.title': 'Affiliated sales return',
        'form.titleEdit': 'Edit sales return',
        'form.alert':
            'This return is sent to the affiliated workshop as a purchase return. Stock and GL on both sides update only after the workshop approves or scans the QR — not immediately on submit.',
        'form.alert.purchaseReturn': 'purchase return',
        'form.alert.approves': 'approves',
        'form.alert.scansQr': 'scans the QR',

        'form.customerRequired': 'Customer',
        'form.customerPlaceholder':
            'Search affiliated workshops or non-affiliated customers… (↑↓ Enter)',
        'form.loadingCustomers': 'Loading customers…',
        'form.noCustomers': 'No customers yet — add affiliated workshops or non-affiliated customers first',
        'form.noCustomerMatches': 'No matches — try workshop, branch, or customer name',
        'form.customerHint':
            'Affiliated Filter workshops and non-affiliated customers. Inactive customers are highlighted and cannot be selected.',
        'form.inactiveTag': 'Inactive',
        'form.salesInvoice': 'Sales invoice',
        'form.optional': '(optional)',
        'form.invoicePlaceholder': 'Type invoice # or product… (↑↓ Enter)',
        'form.invoiceNeedCustomer': 'Select a customer first to see their invoices',
        'form.loadingInvoices': 'Loading sales invoices…',
        'form.noInvoices': 'No sales invoices yet — create one under Sales Invoices (AR)',
        'form.noInvoicesForCustomer': 'No sales invoices for this customer — you can still add products below',
        'form.noMatches': 'No matches — try invoice # or product',
        'form.invoiceHint':
            '{n} sales invoice{s} — type to search, ↑↓ to navigate, Enter to select (optional)',
        'form.invoiceHintFiltered':
            '{n} invoice{s} for this customer — optional; leave empty to return any products',

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
        'form.col.uom': 'UOM',
        'form.col.unitPrice': 'Unit price',
        'form.col.vat': 'VAT %',
        'form.col.reason': 'Reason',
        'hint.uomWhToWs':
            '{qty} {wu} = {wsQty} {wsu} at workshop · {price}/{wu} → {wsPrice}/{wsu}',
        'hint.uomWsToWh':
            '{qty} {wsu} = {whQty} {wu} warehouse · {price}/{wsu} → {whPrice}/{wu}',
        'form.reasonPh': 'Optional',
        'form.pickCustomerFirst': 'Select a customer above, then either pick an invoice or add product lines here.',
        'form.manualLinesHint':
            'No invoice selected — add any products for this return. Linked workshop approval still applies for affiliated customers.',
        'form.productPlaceholder': 'Search product / SKU…',
        'form.noProductMatches': 'No matching products',
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
            'أرجع البضائع إلى العملاء. اربط فاتورة مبيعات عند توفرها، أو أرجع أي منتجات بدون فاتورة. مرتجعات الورش التابعة ما زالت تحتاج اعتماد الورشة أو تأكيد QR قبل اكتمال المخزون والمحاسبة على الجانبين.',
        'page.subtitle.strong': 'مرتجع شراء الورشة',

        'btn.newReturn': 'مرتجع جديد',
        'btn.search': 'بحث',
        'btn.cancel': 'إلغاء',
        'btn.backList': 'العودة إلى القائمة',
        'btn.backReturns': 'العودة إلى مرتجعات المبيعات',
        'btn.createLinked': 'إنشاء مرتجع مرتبط',
        'btn.createUnlinked': 'إنشاء مرتجع مبيعات',
        'btn.creating': 'جارٍ الإنشاء…',
        'btn.saving': 'جارٍ الحفظ…',
        'btn.saveUpdate': 'حفظ التغييرات',
        'btn.addLine': 'إضافة بند منتج',
        'btn.removeLine': 'إزالة البند',
        'btn.approveTitle': 'اعتماد واستلام المخزون',
        'btn.viewTitle': 'عرض إشعار الدائن',
        'btn.editTitle': 'تعديل المرتجع',

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
            'أنشئ مرتجعًا لعميل — مع فاتورة مبيعات أو بدونها. المرتجعات التابعة ترسل مرتجع شراء إلى الورشة تلقائيًا.',

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
        'err.update': 'فشل تحديث مرتجع المبيعات.',
        'err.editRejected': 'لا يمكن تعديل المرتجعات المرفوضة.',
        'err.needCustomer': 'اختر عميلاً قبل إنشاء المرتجع.',
        'err.inactiveCustomer': 'هذا العميل غير نشط ولا يمكن استخدامه لمرتجع جديد.',
        'err.needInvoice':
            'فاتورة المبيعات اختيارية. لمرتجع مرتبط، اختر فاتورة وأدخل كمية مرتجع واحدة على الأقل.',
        'err.needQty': 'أدخل كمية مرتجع واحدة على الأقل.',
        'err.needManualLines':
            'أضف منتجًا واحدًا على الأقل بكمية مرتجع، أو اختر فاتورة مبيعات.',
        'err.loadCustomers': 'فشل تحميل العملاء.',

        'confirm.approve':
            'اعتماد المرتجع {no}؟\n\nسينخفض مخزون فرع الورشة ويزيد مخزون مستودع المورد.\n\nلا يمكن التراجع عن هذا الإجراء.',
        'success.approved': 'تم اعتماد {no}',
        'success.created':
            'تم إنشاء المرتجع {returnNo} — مرتجع شراء الورشة المرتبط {purchaseReturnNo}.',
        'success.createdUnlinked': 'تم إنشاء المرتجع {returnNo} بدون فاتورة مبيعات.',
        'success.updated': 'تم تحديث المرتجع {returnNo} — تم تحديث المخزون والدفاتر.',

        'form.breadcrumbNew': 'مرتجعات المبيعات › جديد',
        'form.breadcrumbParent': 'مرتجعات المبيعات',
        'form.breadcrumbNewLeaf': 'جديد',
        'form.breadcrumbEditLeaf': 'تعديل',
        'form.title': 'مرتجع مبيعات تابع',
        'form.titleEdit': 'تعديل مرتجع المبيعات',
        'form.alert':
            'يُرسل هذا المرتجع إلى الورشة التابعة كمرتجع شراء. يتحدّث المخزون ودفتر الأستاذ على الجانبين فقط بعد أن تعتمد الورشة أو تمسح رمز QR — وليس فور الإرسال.',
        'form.alert.purchaseReturn': 'مرتجع شراء',
        'form.alert.approves': 'تعتمد',
        'form.alert.scansQr': 'تمسح رمز QR',

        'form.customerRequired': 'العميل',
        'form.customerPlaceholder':
            'ابحث عن الورش التابعة أو العملاء غير التابعين… (↑↓ Enter)',
        'form.loadingCustomers': 'جارٍ تحميل العملاء…',
        'form.noCustomers': 'لا يوجد عملاء بعد — أضف ورشًا تابعة أو عملاء غير تابعين أولاً',
        'form.noCustomerMatches': 'لا نتائج — جرّب اسم الورشة أو الفرع أو العميل',
        'form.customerHint':
            'ورش Filter التابعة والعملاء غير التابعين. العملاء غير النشطين مميّزون ولا يمكن اختيارهم.',
        'form.inactiveTag': 'غير نشط',
        'form.salesInvoice': 'فاتورة المبيعات',
        'form.optional': '(اختياري)',
        'form.invoicePlaceholder': 'اكتب رقم الفاتورة أو المنتج… (↑↓ Enter)',
        'form.invoiceNeedCustomer': 'اختر عميلاً أولاً لعرض فواتيره',
        'form.loadingInvoices': 'جارٍ تحميل فواتير المبيعات…',
        'form.noInvoices': 'لا توجد فواتير مبيعات بعد — أنشئ واحدة ضمن فواتير المبيعات (ذمم مدينة)',
        'form.noInvoicesForCustomer': 'لا فواتير لهذا العميل — يمكنك إضافة المنتجات أدناه',
        'form.noMatches': 'لا نتائج — جرّب رقم الفاتورة أو المنتج',
        'form.invoiceHint':
            '{n} فاتورة مبيعات — اكتب للبحث، ↑↓ للتنقل، Enter للاختيار (اختياري)',
        'form.invoiceHintFiltered':
            '{n} فاتورة لهذا العميل — اختيارية؛ اتركها فارغة لإرجاع أي منتجات',

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
        'form.col.uom': 'وحدة القياس',
        'form.col.unitPrice': 'سعر الوحدة',
        'form.col.vat': 'ضريبة %',
        'form.col.reason': 'السبب',
        'hint.uomWhToWs':
            '{qty} {wu} = {wsQty} {wsu} لدى الورشة · {price}/{wu} ← {wsPrice}/{wsu}',
        'hint.uomWsToWh':
            '{qty} {wsu} = {whQty} {wu} مستودع · {price}/{wsu} ← {whPrice}/{wu}',
        'form.reasonPh': 'اختياري',
        'form.pickCustomerFirst': 'اختر عميلاً أعلاه، ثم اختر فاتورة أو أضف بنود منتجات هنا.',
        'form.manualLinesHint':
            'لم تُختر فاتورة — أضف أي منتجات لهذا المرتجع. اعتماد الورشة يبقى مطلوبًا للعملاء التابعين.',
        'form.productPlaceholder': 'ابحث عن منتج / رمز SKU…',
        'form.noProductMatches': 'لا منتجات مطابقة',
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
