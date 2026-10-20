/** Workshop Suppliers & purchase-history UI — keyed by portal locale (`en` | `ar`). */
const WSUP_I18N = {
    en: {
        'tab.suppliers': 'Suppliers',
        'tab.purchases': 'Purchase History',

        'page.title': 'Suppliers & Purchases',
        'page.subtitle': 'Manage vendors and purchase invoices',

        'branch.all': 'All branches',
        'branch.fallback': 'Branch',
        'branch.filterApplies': 'Branch filter applies',

        'category.workshopOnly': 'Workshop only',
        'status.inactive': 'Inactive',

        'search.placeholder': 'Search suppliers (name, phone, CR, VAT, category)…',

        'btn.refresh': 'Refresh',
        'btn.addSupplier': 'Add Supplier',
        'btn.addPurchase': 'Add Purchase',
        'btn.view': 'View',
        'btn.previous': 'Previous',
        'btn.next': 'Next',
        'btn.cancel': 'Cancel',
        'btn.submitPurchase': 'Submit Purchase Invoice',
        'btn.addItem': 'Add Item',

        'summary.countOf': '{shown} of {total} suppliers',
        'summary.countOne': '1 supplier',
        'summary.countMany': '{count} suppliers',
        'summary.outstanding': 'Outstanding: {amount}',
        'summary.outstandingCur': 'Outstanding: {amount} {currency}',

        'th.supplierName': 'Supplier Name',
        'th.contact': 'Contact',
        'th.crNo': 'CR No',
        'th.vatId': 'VAT ID',
        'th.category': 'Category',
        'th.actions': 'Actions',
        'th.invoiceNo': 'Invoice #',
        'th.vendor': 'Vendor',
        'th.grandTotal': 'Grand Total',
        'th.vat': 'VAT',
        'th.status': 'Status',
        'th.payment': 'Payment',

        'loading.suppliers': 'Loading suppliers…',
        'loading.history': 'Loading purchase history…',
        'loading.invoice': 'Loading full invoice…',

        'empty.none': 'No suppliers registered yet.',
        'empty.noMatch': 'No suppliers match your search.',
        'empty.loadFailed': 'Unable to load suppliers — see message above.',
        'empty.history':
            'No purchase invoices yet. Create them from the Purchases area or supplier actions.',
        'empty.historyError': 'Could not load rows — see message above.',
        'empty.invoiceDisplay': 'Unable to display this invoice.',

        'err.loadSuppliers': 'Could not load suppliers.',
        'err.loadHistory': 'Could not load purchase history.',
        'err.invoiceEmpty': 'Invoice response was empty.',
        'err.loadInvoice': 'Could not load invoice details.',
        'err.fallbackSchema':
            'Loaded via fallback: /workshop-staff/suppliers currently fails due backend schema (missing suppliers.workshop_id).',
        'err.fallbackAuth':
            'Loaded via fallback: /workshop-staff/suppliers is not authorized for this session/token.',
        'err.fallbackHint':
            'Showing only rows with isLinkedToWorkshop=true from GET /workshop-staff/suppliers/registered until backend query is migrated to workshop_suppliers.',
        'err.loadHint':
            'The workshop portal expects GET /workshop-staff/suppliers with the workshop JWT. Optional: q or search, limit (≤500), offset.',

        'history.hint': 'Workshop purchase invoices sent to suppliers',
        'history.rangeOf': '{start}–{end} of {total}',
        'history.rangePartial': '{start}–{end}',
        'history.rangeZero': '0',
        'history.pageOf': 'Page {page} of {total}',

        'view.title': 'Purchase invoice {num}',
        'view.back': 'Back to Purchase History',

        'purchase.title': 'Add Purchase Invoice — {name}',
        'purchase.back': 'Back to Suppliers',
        'purchase.items': 'Items',
        'purchase.product': 'Product',
        'purchase.qty': 'Qty',
        'purchase.unitPrice': 'Unit Price',
        'purchase.subtotal': 'Subtotal',
        'purchase.vat15': 'VAT 15%',
        'purchase.grandTotal': 'Grand Total',
        'purchase.notes': 'Notes',
        'purchase.notesPlaceholder': 'Optional notes…',

        'status.approved': 'approved',
        'status.received': 'received',
        'status.completed': 'completed',
        'status.stock_applied': 'stock_applied',
        'status.rejected': 'rejected',
        'status.cancelled': 'cancelled',
        'status.draft': 'draft',
        'status.pending': 'pending',

        'payment.paid': 'paid',
        'payment.unpaid': 'unpaid',
        'payment.partially_paid': 'partially_paid',
        'payment.partial': 'partial',

        'money.sar': 'SAR {amount}',
        'emdash': '—',

        // WorkshopAddSupplierScreen
        'add.title.browse': 'Add Supplier to Workshop',
        'add.title.register': 'Add workshop-only supplier',
        'add.subtitle.browse': 'Link registered suppliers or add a workshop-only vendor',
        'add.subtitle.register': 'Vendor for your workshop only — no supplier portal login',
        'add.back': 'Back to Suppliers',
        'add.footer.hint':
            'Pick on-platform suppliers (they can use the supplier portal), or add a workshop-only vendor with no login.',
        'add.btn.cancel': 'Cancel',
        'add.btn.adding': 'Adding…',
        'add.btn.addSelected': 'Add Selected ({count})',
        'add.btn.backToList': 'Back to list',
        'add.btn.saving': 'Saving…',
        'add.btn.addToWorkshop': 'Add to my workshop',
        'add.btn.workshopOnly': 'Workshop-only supplier',
        'add.btn.select': 'Select',
        'add.btn.selected': 'Selected',
        'add.err.loadRegistered': 'Could not load registered suppliers.',
        'add.err.linkFailed': 'Failed to add selected suppliers to workshop.',
        'add.err.nameRequired': 'Company name is required.',
        'add.err.register': 'Could not register supplier.',
        'add.label.name': 'Name',
        'add.label.vat': 'VAT number',
        'add.label.mobile': 'Mobile',
        'add.label.email': 'Email (optional)',
        'add.label.address': 'Address',
        'add.label.notes': 'Notes',
        'add.placeholder.company': 'Company name',
        'add.placeholder.email': 'Contact email — no portal login',
        'add.placeholder.search': 'Search all registered suppliers...',
        'add.hint.register':
            'This vendor is stored for your workshop only. They are not given a supplier portal account. To link an on-platform supplier that can log in, go back and use Add Selected.',
        'add.loading': 'Loading registered suppliers...',
        'add.empty':
            'No registered suppliers found. Use “Workshop-only supplier” to add a vendor for this workshop without a platform login.',
        'add.th.supplier': 'Supplier',
        'add.th.contact': 'Contact',
        'add.th.cr': 'CR',
        'add.th.vat': 'VAT',
        'add.th.action': 'Action',
    },
    ar: {
        'tab.suppliers': 'الموردون',
        'tab.purchases': 'سجل المشتريات',

        'page.title': 'الموردون والمشتريات',
        'page.subtitle': 'إدارة الموردين وفواتير الشراء',

        'branch.all': 'كل الفروع',
        'branch.fallback': 'فرع',
        'branch.filterApplies': 'يُطبَّق فلتر الفرع',

        'category.workshopOnly': 'ورشة فقط',
        'status.inactive': 'غير نشط',

        'search.placeholder': 'بحث عن الموردين (الاسم، الهاتف، السجل، الضريبة، الفئة)…',

        'btn.refresh': 'تحديث',
        'btn.addSupplier': 'إضافة مورد',
        'btn.addPurchase': 'إضافة شراء',
        'btn.view': 'عرض',
        'btn.previous': 'السابق',
        'btn.next': 'التالي',
        'btn.cancel': 'إلغاء',
        'btn.submitPurchase': 'إرسال فاتورة الشراء',
        'btn.addItem': 'إضافة بند',

        'summary.countOf': '{shown} من {total} موردين',
        'summary.countOne': 'مورد واحد',
        'summary.countMany': '{count} موردين',
        'summary.outstanding': 'المستحق: {amount}',
        'summary.outstandingCur': 'المستحق: {amount} {currency}',

        'th.supplierName': 'اسم المورد',
        'th.contact': 'جهة الاتصال',
        'th.crNo': 'رقم السجل',
        'th.vatId': 'الرقم الضريبي',
        'th.category': 'الفئة',
        'th.actions': 'إجراءات',
        'th.invoiceNo': 'رقم الفاتورة',
        'th.vendor': 'المورد',
        'th.grandTotal': 'الإجمالي',
        'th.vat': 'الضريبة',
        'th.status': 'الحالة',
        'th.payment': 'الدفع',

        'loading.suppliers': 'جاري تحميل الموردين…',
        'loading.history': 'جاري تحميل سجل المشتريات…',
        'loading.invoice': 'جاري تحميل الفاتورة كاملة…',

        'empty.none': 'لا يوجد موردون مسجّلون بعد.',
        'empty.noMatch': 'لا يوجد موردون مطابقون لبحثك.',
        'empty.loadFailed': 'تعذّر تحميل الموردين — راجع الرسالة أعلاه.',
        'empty.history':
            'لا توجد فواتير شراء بعد. أنشئها من قسم المشتريات أو من إجراءات المورد.',
        'empty.historyError': 'تعذّر تحميل الصفوف — راجع الرسالة أعلاه.',
        'empty.invoiceDisplay': 'تعذّر عرض هذه الفاتورة.',

        'err.loadSuppliers': 'تعذّر تحميل الموردين.',
        'err.loadHistory': 'تعذّر تحميل سجل المشتريات.',
        'err.invoiceEmpty': 'استجابة الفاتورة فارغة.',
        'err.loadInvoice': 'تعذّر تحميل تفاصيل الفاتورة.',
        'err.fallbackSchema':
            'تم التحميل عبر المسار الاحتياطي: واجهة /workshop-staff/suppliers تفشل بسبب مخطط الخلفية (عمود suppliers.workshop_id مفقود).',
        'err.fallbackAuth':
            'تم التحميل عبر المسار الاحتياطي: واجهة /workshop-staff/suppliers غير مصرّح بها لهذه الجلسة/الرمز.',
        'err.fallbackHint':
            'يُعرض فقط الصفوف ذات isLinkedToWorkshop=true من GET /workshop-staff/suppliers/registered إلى أن تُرحَّل استعلام الخلفية إلى workshop_suppliers.',
        'err.loadHint':
            'بوابة الورشة تتوقع GET /workshop-staff/suppliers مع رمز JWT للورشة. اختياري: q أو search، limit (≤500)، offset.',

        'history.hint': 'فواتير شراء الورشة المُرسلة إلى الموردين',
        'history.rangeOf': '{start}–{end} من {total}',
        'history.rangePartial': '{start}–{end}',
        'history.rangeZero': '0',
        'history.pageOf': 'صفحة {page} من {total}',

        'view.title': 'فاتورة شراء {num}',
        'view.back': 'العودة إلى سجل المشتريات',

        'purchase.title': 'إضافة فاتورة شراء — {name}',
        'purchase.back': 'العودة إلى الموردين',
        'purchase.items': 'البنود',
        'purchase.product': 'المنتج',
        'purchase.qty': 'الكمية',
        'purchase.unitPrice': 'سعر الوحدة',
        'purchase.subtotal': 'المجموع الفرعي',
        'purchase.vat15': 'ضريبة القيمة المضافة 15%',
        'purchase.grandTotal': 'الإجمالي',
        'purchase.notes': 'ملاحظات',
        'purchase.notesPlaceholder': 'ملاحظات اختيارية…',

        'status.approved': 'معتمدة',
        'status.received': 'مستلمة',
        'status.completed': 'مكتملة',
        'status.stock_applied': 'تم تطبيق المخزون',
        'status.rejected': 'مرفوضة',
        'status.cancelled': 'ملغاة',
        'status.draft': 'مسودة',
        'status.pending': 'قيد الانتظار',

        'payment.paid': 'مدفوع',
        'payment.unpaid': 'غير مدفوع',
        'payment.partially_paid': 'مدفوع جزئيًا',
        'payment.partial': 'جزئي',

        'money.sar': '{amount} ر.س',
        'emdash': '—',

        'add.title.browse': 'إضافة مورد إلى الورشة',
        'add.title.register': 'إضافة مورد للورشة فقط',
        'add.subtitle.browse': 'اربط موردين مسجّلين أو أضف مورّدًا للورشة فقط',
        'add.subtitle.register': 'مورد لورشتك فقط — بدون دخول إلى بوابة المورد',
        'add.back': 'العودة إلى الموردين',
        'add.footer.hint':
            'اختر موردين على المنصة (يمكنهم استخدام بوابة المورد)، أو أضف مورّدًا للورشة فقط بدون تسجيل دخول.',
        'add.btn.cancel': 'إلغاء',
        'add.btn.adding': 'جاري الإضافة…',
        'add.btn.addSelected': 'إضافة المحدد ({count})',
        'add.btn.backToList': 'العودة إلى القائمة',
        'add.btn.saving': 'جاري الحفظ…',
        'add.btn.addToWorkshop': 'إضافة إلى ورشتي',
        'add.btn.workshopOnly': 'مورد للورشة فقط',
        'add.btn.select': 'تحديد',
        'add.btn.selected': 'محدد',
        'add.err.loadRegistered': 'تعذّر تحميل الموردين المسجّلين.',
        'add.err.linkFailed': 'فشل إضافة الموردين المحددين إلى الورشة.',
        'add.err.nameRequired': 'اسم الشركة مطلوب.',
        'add.err.register': 'تعذّر تسجيل المورد.',
        'add.label.name': 'الاسم',
        'add.label.vat': 'الرقم الضريبي',
        'add.label.mobile': 'الجوال',
        'add.label.email': 'البريد (اختياري)',
        'add.label.address': 'العنوان',
        'add.label.notes': 'ملاحظات',
        'add.placeholder.company': 'اسم الشركة',
        'add.placeholder.email': 'بريد التواصل — بدون دخول للبوابة',
        'add.placeholder.search': 'بحث في جميع الموردين المسجّلين...',
        'add.hint.register':
            'يُحفظ هذا المورد لورشتك فقط. لا يُمنح حسابًا في بوابة المورد. لربط مورد على المنصة يمكنه تسجيل الدخول، ارجع واستخدم «إضافة المحدد».',
        'add.loading': 'جاري تحميل الموردين المسجّلين...',
        'add.empty':
            'لا يوجد موردون مسجّلون. استخدم «مورد للورشة فقط» لإضافة مورّد لهذه الورشة بدون حساب على المنصة.',
        'add.th.supplier': 'المورد',
        'add.th.contact': 'جهة الاتصال',
        'add.th.cr': 'السجل',
        'add.th.vat': 'الضريبة',
        'add.th.action': 'إجراء',
    },
};

export function wsupT(locale, key, vars) {
    const pack = WSUP_I18N[locale] || WSUP_I18N.en;
    let text = pack[key] ?? WSUP_I18N.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
    return text;
}
