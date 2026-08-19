/** Workshop Debit Notes (purchase returns) UI — keyed by portal locale (`en` | `ar`). */
const WPR_I18N = {
    en: {
        'page.breadcrumb': 'Purchases › Debit Notes',
        'page.title': 'Debit Notes',
        'page.subtitle.before':
            'Purchase returns against affiliated supplier invoices. Each debit note is sent to the supplier as a ',
        'page.subtitle.strong': 'sales return',
        'page.subtitle.after':
            ' for approval or QR confirmation before stock updates on both sides.',

        'btn.new': 'New Debit Note',
        'btn.search': 'Search',
        'btn.cancel': 'Cancel',
        'btn.create': 'Create debit note',
        'btn.creating': 'Creating…',
        'btn.addLine': 'Add another line',
        'btn.back': 'Back to list',

        'filter.status': 'Status',
        'filter.ariaStatus': 'Filter by status',
        'filter.all': 'All',
        'filter.pending': 'Pending',
        'filter.approved': 'Approved',

        'search.placeholder': 'Search debit note #, supplier, invoice…',
        'search.aria': 'Search debit notes',

        'th.date': 'Date',
        'th.debitNote': 'Debit note #',
        'th.supplier': 'Supplier',
        'th.description': 'Description',
        'th.amount': 'Amount',
        'th.status': 'Status',
        'th.item': 'Item',
        'th.invQty': 'Inv. qty',
        'th.uom': 'UOM',
        'th.returnQty': 'Return qty',
        'th.unitPrice': 'Unit price',
        'th.total': 'Total',
        'th.reason': 'Reason',
        'th.product': 'Product',
        'th.remove': 'Remove',

        'empty.title': 'No debit notes yet',
        'empty.text':
            'Create a debit note from an affiliated purchase invoice — the linked supplier receives it as a sales return for approval.',

        'fallback.purchaseReturn': 'Purchase Return',
        'fallback.supplier': 'Supplier',
        'fallback.product': 'Product',
        'fallback.line': 'line',
        'fallback.view': 'View',

        'status.approved': 'Approved',
        'status.pendingSupplier': 'Pending supplier',
        'status.pendingWorkshop': 'Pending workshop',

        'view.title': 'View debit note',
        'view.loadError': 'Could not load debit note.',

        'form.breadcrumb': 'Debit Notes › ',
        'form.breadcrumbNew': 'New',
        'form.title': 'Debit Note',
        'form.total': 'Total',

        'callout.instant.title': 'Instant return — no supplier approval',
        'callout.approval.title': 'Supplier approval required',
        'callout.instant.before': 'Stock and accounts payable update ',
        'callout.instant.strong': 'immediately',
        'callout.instant.after':
            ' when you create this debit note. Nothing is sent to a supplier portal.',
        'callout.approval.before': 'This debit note is sent to the supplier as a ',
        'callout.approval.strong1': 'sales return',
        'callout.approval.mid':
            '. Stock and GL update on both sides only after the supplier ',
        'callout.approval.strong2': 'approves',
        'callout.approval.or': ' or ',
        'callout.approval.strong3': 'scans the QR once',
        'callout.approval.after': ' with their password.',

        'panel.doc.title': 'Document details',
        'panel.doc.subtitle': 'Date, reference & description',
        'panel.supplier.title': 'Supplier & invoice',
        'panel.supplier.subtitle':
            'Pick a supplier, then optionally link a purchase invoice',
        'panel.lines.title': 'Return lines',
        'panel.lines.subtitleInvoice':
            'Enter quantities to return from the linked invoice',
        'panel.lines.subtitleManual': 'Add products and quantities to return',

        'label.issueDate': 'Issue date',
        'label.reference': 'Reference',
        'label.referenceAuto': 'Automatic from invoice',
        'label.description': 'Description',
        'label.optional': 'optional',
        'label.supplier': 'Supplier',
        'label.purchaseInvoice': 'Purchase invoice',
        'ref.placeholder': 'Auto or custom reference',
        'desc.placeholder': 'e.g. Purchase Return, damaged goods…',

        'supplier.placeholder': 'Type to search supplier…',
        'supplier.loading': 'Loading suppliers…',
        'supplier.empty': 'No suppliers found',
        'supplier.noMatch': 'No matches — try another name',
        'supplier.badgeLocal': 'Non-affiliated',
        'supplier.badgeAffiliated': 'Affiliated',
        'supplier.subtitleLocal': 'Non-affiliated supplier',
        'supplier.subtitleAffiliated': 'Affiliated supplier',
        'supplier.nameLocal': '{name} (Non-affiliated)',

        'invoice.placeholder': 'Type to search purchase invoice…',
        'invoice.loading': 'Loading invoices…',
        'invoice.empty': 'No purchase invoices found',
        'invoice.noMatch': 'No matches — try invoice # or supplier',
        'invoice.prefilled':
            'Lines prefilled from invoice — adjust return quantities below',
        'invoice.hint':
            'Pick any invoice to prefill lines, or skip and add products manually',
        'invoice.issued': 'Issued {date}',

        'lines.badgeOne': '{count} line with qty',
        'lines.badgeMany': '{count} lines with qty',
        'lines.loading': 'Loading invoice lines…',
        'lines.selectSupplierTitle': 'Select a supplier',
        'lines.selectSupplierText':
            'Choose a supplier above, then link an invoice or add return lines manually.',
        'lines.summary': 'Estimated return total',

        'qty.max': 'Max {n}',
        'qty.ariaNamed': 'Return qty ({uom}) for {name}',
        'qty.ariaUnit': 'Return qty ({uom})',
        'reason.placeholder': 'Optional reason',
        'reason.optional': 'Optional',
        'unit': 'unit',
        'currency.sar': 'SAR',
        'money.sar': 'SAR {amount}',
        'emdash': '—',
        'product.placeholder': 'Search product…',
        'product.selectBranch': 'Select branch first',
        'product.loading': 'Loading products…',
        'product.empty': 'No products in branch catalog',
        'product.noMatch': 'No matches',
        'product.sku': 'SKU {sku}',
        'conversion.received': '= {qty} {uom} received in stock',
        'remove.line': 'Remove line',
        'entity.supplier': 'supplier',
        'entity.invoice': 'invoice',
        'entity.product': 'product',

        'err.loadList': 'Failed to load debit notes.',
        'err.loadSuppliers': 'Could not load workshop suppliers.',
        'err.loadInvoices': 'Failed to load purchase invoices.',
        'err.noProducts':
            'No branch products found. Adopt products in Inventory or select a specific branch.',
        'err.loadProducts': 'Could not load branch products.',
        'err.loadInvoice': 'Failed to load purchase invoice.',
        'err.selectSupplier': 'Select a supplier.',
        'err.selectBranch':
            'Select a branch from the sidebar before creating a debit note.',
        'err.needReturnQty': 'Enter at least one return quantity.',
        'err.needProductLine': 'Add at least one product line with quantity.',
        'err.qtyExceeds':
            'Return qty for "{label}" exceeds invoice qty (max {qty} {uom}).',
        'err.create': 'Failed to create debit note.',

        'success.local':
            'Debit note completed: {no}. Stock and payables updated immediately.',
        'success.affiliated':
            'Debit note created: {no}. Sent to supplier for approval.',
    },
    ar: {
        'page.breadcrumb': 'المشتريات › إشعارات المدين',
        'page.title': 'إشعارات المدين',
        'page.subtitle.before':
            'مرتجعات مشتريات مقابل فواتير الموردين المنتسبين. يُرسل كل إشعار مدين إلى المورد كـ',
        'page.subtitle.strong': 'مرتجع مبيعات',
        'page.subtitle.after':
            ' للاعتماد أو تأكيد رمز QR قبل تحديث المخزون لدى الطرفين.',

        'btn.new': 'إشعار مدين جديد',
        'btn.search': 'بحث',
        'btn.cancel': 'إلغاء',
        'btn.create': 'إنشاء إشعار مدين',
        'btn.creating': 'جارٍ الإنشاء…',
        'btn.addLine': 'إضافة بند آخر',
        'btn.back': 'العودة إلى القائمة',

        'filter.status': 'الحالة',
        'filter.ariaStatus': 'تصفية حسب الحالة',
        'filter.all': 'الكل',
        'filter.pending': 'قيد الانتظار',
        'filter.approved': 'معتمد',

        'search.placeholder': 'بحث برقم إشعار المدين أو المورد أو الفاتورة…',
        'search.aria': 'بحث في إشعارات المدين',

        'th.date': 'التاريخ',
        'th.debitNote': 'رقم إشعار المدين',
        'th.supplier': 'المورد',
        'th.description': 'الوصف',
        'th.amount': 'المبلغ',
        'th.status': 'الحالة',
        'th.item': 'الصنف',
        'th.invQty': 'كمية الفاتورة',
        'th.uom': 'وحدة القياس',
        'th.returnQty': 'كمية المرتجع',
        'th.unitPrice': 'سعر الوحدة',
        'th.total': 'الإجمالي',
        'th.reason': 'السبب',
        'th.product': 'المنتج',
        'th.remove': 'إزالة',

        'empty.title': 'لا توجد إشعارات مدين بعد',
        'empty.text':
            'أنشئ إشعار مدين من فاتورة شراء لمورد منتسب — يستلمه المورد المرتبط كمرتجع مبيعات للاعتماد.',

        'fallback.purchaseReturn': 'مرتجع شراء',
        'fallback.supplier': 'المورد',
        'fallback.product': 'منتج',
        'fallback.line': 'بند',
        'fallback.view': 'عرض',

        'status.approved': 'معتمد',
        'status.pendingSupplier': 'بانتظار المورد',
        'status.pendingWorkshop': 'بانتظار الورشة',

        'view.title': 'عرض إشعار المدين',
        'view.loadError': 'تعذّر تحميل إشعار المدين.',

        'form.breadcrumb': 'إشعارات المدين › ',
        'form.breadcrumbNew': 'جديد',
        'form.title': 'إشعار مدين',
        'form.total': 'الإجمالي',

        'callout.instant.title': 'مرتجع فوري — بدون موافقة المورد',
        'callout.approval.title': 'يلزم موافقة المورد',
        'callout.instant.before': 'يُحدَّث المخزون والذمم الدائنة ',
        'callout.instant.strong': 'فورًا',
        'callout.instant.after':
            ' عند إنشاء إشعار المدين. لا يُرسل شيء إلى بوابة المورد.',
        'callout.approval.before': 'يُرسل إشعار المدين هذا إلى المورد كـ',
        'callout.approval.strong1': 'مرتجع مبيعات',
        'callout.approval.mid':
            '. يُحدَّث المخزون والقيود لدى الطرفين فقط بعد أن يقوم المورد بـ',
        'callout.approval.strong2': 'الاعتماد',
        'callout.approval.or': ' أو ',
        'callout.approval.strong3': 'مسح رمز QR مرة واحدة',
        'callout.approval.after': ' بكلمة المرور.',

        'panel.doc.title': 'تفاصيل المستند',
        'panel.doc.subtitle': 'التاريخ والمرجع والوصف',
        'panel.supplier.title': 'المورد والفاتورة',
        'panel.supplier.subtitle':
            'اختر موردًا، ثم اربط فاتورة شراء اختياريًا',
        'panel.lines.title': 'بنود المرتجع',
        'panel.lines.subtitleInvoice':
            'أدخل الكميات المراد إرجاعها من الفاتورة المرتبطة',
        'panel.lines.subtitleManual': 'أضف المنتجات والكميات المراد إرجاعها',

        'label.issueDate': 'تاريخ الإصدار',
        'label.reference': 'المرجع',
        'label.referenceAuto': 'تلقائي من الفاتورة',
        'label.description': 'الوصف',
        'label.optional': 'اختياري',
        'label.supplier': 'المورد',
        'label.purchaseInvoice': 'فاتورة الشراء',
        'ref.placeholder': 'مرجع تلقائي أو مخصص',
        'desc.placeholder': 'مثال: مرتجع شراء، بضاعة تالفة…',

        'supplier.placeholder': 'اكتب للبحث عن مورد…',
        'supplier.loading': 'جارٍ تحميل الموردين…',
        'supplier.empty': 'لا يوجد موردون',
        'supplier.noMatch': 'لا توجد نتائج — جرّب اسمًا آخر',
        'supplier.badgeLocal': 'غير منتسب',
        'supplier.badgeAffiliated': 'منتسب',
        'supplier.subtitleLocal': 'مورد غير منتسب',
        'supplier.subtitleAffiliated': 'مورد منتسب',
        'supplier.nameLocal': '{name} (غير منتسب)',

        'invoice.placeholder': 'اكتب للبحث عن فاتورة شراء…',
        'invoice.loading': 'جارٍ تحميل الفواتير…',
        'invoice.empty': 'لا توجد فواتير شراء',
        'invoice.noMatch': 'لا توجد نتائج — جرّب رقم الفاتورة أو المورد',
        'invoice.prefilled':
            'تم تعبئة البنود من الفاتورة — عدّل كميات المرتجع أدناه',
        'invoice.hint':
            'اختر أي فاتورة لتعبئة البنود، أو تخطَّ وأضف المنتجات يدويًا',
        'invoice.issued': 'صدرت {date}',

        'lines.badgeOne': 'بند واحد ({count}) بكمية',
        'lines.badgeMany': '{count} بنود بكمية',
        'lines.loading': 'جارٍ تحميل بنود الفاتورة…',
        'lines.selectSupplierTitle': 'اختر موردًا',
        'lines.selectSupplierText':
            'اختر موردًا أعلاه، ثم اربط فاتورة أو أضف بنود المرتجع يدويًا.',
        'lines.summary': 'إجمالي المرتجع التقديري',

        'qty.max': 'الحد الأقصى {n}',
        'qty.ariaNamed': 'كمية المرتجع ({uom}) لـ {name}',
        'qty.ariaUnit': 'كمية المرتجع ({uom})',
        'reason.placeholder': 'سبب اختياري',
        'reason.optional': 'اختياري',
        'unit': 'وحدة',
        'currency.sar': 'ر.س',
        'money.sar': '{amount} ر.س',
        'emdash': '—',
        'product.placeholder': 'بحث عن منتج…',
        'product.selectBranch': 'اختر الفرع أولًا',
        'product.loading': 'جارٍ تحميل المنتجات…',
        'product.empty': 'لا توجد منتجات في كتالوج الفرع',
        'product.noMatch': 'لا توجد نتائج',
        'product.sku': 'رمز المخزون {sku}',
        'conversion.received': '= {qty} {uom} مستلمة في المخزون',
        'remove.line': 'إزالة البند',
        'entity.supplier': 'مورد',
        'entity.invoice': 'فاتورة',
        'entity.product': 'منتج',

        'err.loadList': 'تعذّر تحميل إشعارات المدين.',
        'err.loadSuppliers': 'تعذّر تحميل موردي الورشة.',
        'err.loadInvoices': 'تعذّر تحميل فواتير الشراء.',
        'err.noProducts':
            'لم يُعثر على منتجات للفرع. اعتمد منتجات في المخزون أو اختر فرعًا محددًا.',
        'err.loadProducts': 'تعذّر تحميل منتجات الفرع.',
        'err.loadInvoice': 'تعذّر تحميل فاتورة الشراء.',
        'err.selectSupplier': 'اختر موردًا.',
        'err.selectBranch':
            'اختر فرعًا من الشريط الجانبي قبل إنشاء إشعار مدين.',
        'err.needReturnQty': 'أدخل كمية مرتجع واحدة على الأقل.',
        'err.needProductLine': 'أضف بند منتج واحدًا على الأقل بكمية.',
        'err.qtyExceeds':
            'كمية المرتجع لـ "{label}" تتجاوز كمية الفاتورة (الحد الأقصى {qty} {uom}).',
        'err.create': 'تعذّر إنشاء إشعار المدين.',

        'success.local':
            'اكتمل إشعار المدين: {no}. تم تحديث المخزون والذمم فورًا.',
        'success.affiliated':
            'تم إنشاء إشعار المدين: {no}. أُرسل إلى المورد للاعتماد.',
    },
};

export function wprT(locale, key, vars) {
    const pack = WPR_I18N[locale] || WPR_I18N.en;
    let text = pack[key] ?? WPR_I18N.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
    return text;
}
