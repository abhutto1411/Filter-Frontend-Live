/** Workshop Approvals Queue UI — keyed by portal locale (`en` | `ar`). */
export const WA_I18N = {
    en: {
        'page.title': 'Approvals Queue',
        'page.subtitle': 'Review and act on pending requests',
        'page.branchAll': 'All branches',
        'page.branchNamed': 'Branch {id}',

        'emdash': '—',
        'money.sar': 'SAR {amount}',

        'kind.lockerVault': 'Locker vault',
        'kind.cashierTill': 'Cashier till',
        'kind.pettyCashWallet': 'Petty cash wallet',
        'kind.bank': 'Bank',
        'kind.pettyCash': 'Petty cash',
        'kind.cash': 'Cash',
        'account.fallback': 'Account',
        'account.label': '{name} ({kindLabel}) — {money}',

        'btn.cancel': 'Cancel',
        'btn.approveExpense': 'Approve Expense',
        'btn.approvePostJournal': 'Approve & Post Journal',
        'btn.reject': 'Reject',
        'btn.rejecting': 'Rejecting...',
        'btn.approve': 'Approve',
        'btn.approving': 'Approving…',
        'btn.refresh': 'Refresh',
        'btn.refreshing': 'Refreshing...',
        'btn.viewInvoice': 'View Invoice',
        'btn.details': 'Details',
        'btn.downloadPdf': 'Download PDF',
        'btn.okApproveInventory': 'OK — approve & update inventory',

        'modal.approveExpenseTitle': 'Approve Platform Admin Expense',
        'modal.approveFundTitle': 'Approve Platform Admin Fund Request',
        'modal.approveExpenseLead': 'Approve expense for',
        'modal.approveFundLead': 'Approve fund request for',
        'modal.atBranch': 'at branch',
        'modal.amount': 'Amount',
        'modal.expenseTail': 'will be drawn from the selected budget account.',
        'modal.fundTail': 'will be credited to their wallet from the selected payment account.',
        'modal.details': 'Details',
        'modal.purpose': 'Purpose',
        'modal.remarks': 'Remarks',
        'modal.optional': '(optional)',
        'modal.remarksPlaceholder': 'e.g. Approved for branch petty cash float.',
        'fallback.thisBranch': 'this branch',
        'fallback.platformAdmin': 'Platform admin',
        'fallback.supplier': 'Supplier',
        'fallback.cashier': 'Cashier',

        'approver.superAdmin': 'Super Admin: {name}',
        'approver.workshopAdmin': 'Workshop Admin: {name}',

        'type.supplierInvoice': 'Supplier invoice',
        'type.purchaseReturn': 'Purchase return',
        'type.salesReturn': 'Sales return',
        'type.platformAdminFund': 'Platform admin fund',
        'type.platformAdminExpense': 'Platform admin expense',
        'type.lockerExpense': 'Locker expense',
        'type.topUp': 'Top up',
        'type.expense': 'Expense',

        'reason.lines': 'Lines: {label}',
        'reason.linkedSupplierReturn': 'Linked supplier return {no}',

        'err.invalidResponse': 'Invalid approvals response.',
        'err.load': 'Failed to load approvals queue.',
        'err.approveSalesReturn': 'Failed to approve sales return.',
        'err.approvePurchaseReturn': 'Failed to approve purchase return.',
        'err.approveSupplierInvoice': 'Failed to approve supplier invoice.',
        'err.approveRequest': 'Failed to approve request.',
        'err.rejectSalesReturn': 'Failed to reject sales return.',
        'err.rejectSupplierInvoice': 'Failed to reject supplier invoice.',
        'err.rejectAdminWallet': 'Failed to reject platform admin wallet request.',
        'err.rejectRequest': 'Failed to reject request.',
        'err.approveFund': 'Failed to approve fund request.',
        'err.approveExpense': 'Failed to approve expense request.',
        'err.loadInvoice': 'Could not load invoice details.',
        'err.loadPurchaseReturn': 'Could not load purchase return details.',

        'confirm.approvePurchaseReturn':
            'Approve purchase return {no}?\n\nBranch stock will decrease and the linked supplier return will be finalized.\n\nThis action cannot be undone.',

        'reject.titleSupplier': 'Reject supplier invoice',
        'reject.title': 'Reject approval',
        'reject.subtitle': 'Provide a reason — this is stored on the request.',
        'reject.back': 'Back to Approvals',
        'reject.placeholder': 'Reason for rejection...',

        'siApprove.title': 'Approve supplier invoice & receive stock',
        'siApprove.subtitle':
            'Confirm received quantities, set critical stock for new branch products, then approve.',
        'siApprove.back': 'Back to Approvals',
        'siApprove.newProductsIntro':
            "The following products are not on {branch}'s inventory yet. If you approve, the system will add them to this branch and set opening stock to the quantities on this sales invoice (per product, summed across lines). Set critical stock (low-stock alert level) for each new branch product below, then confirm.",
        'siApprove.unresolvedIntro':
            'Some invoice lines could not be matched to a product in your workshop catalog. You can still approve the invoice for accounting, but inventory may not update for those lines until they are linked to master products.',
        'siApprove.reviewIntro':
            'Review the details below before approving. Inventory will be updated for this branch according to the invoice lines.',
        'siApprove.unmatched':
            'Could not match to catalog: {names}. Stock may not apply for these lines until they are linked to a master product.',
        'siApprove.th.product': 'Product',
        'siApprove.th.qtyOpening': 'Qty (opening)',
        'siApprove.th.criticalStock': 'Critical stock',
        'siApprove.noNewUnresolved':
            'No new branch catalog products will be created from this invoice; only matched lines can receive stock.',
        'siApprove.noNewMatched':
            'No new branch products; approving will increase stock only for products you already carry on this branch.',
        'siApprove.receiveTitle': 'Invoice lines — received quantity',
        'siApprove.receiveHint':
            'Leave Received qty empty when the physical count matches the invoiced branch amount. Enter a value in workshop UOM only when different.',
        'siApprove.th.supplierShipped': 'Supplier shipped',
        'siApprove.th.branchStock': 'Branch stock +',
        'siApprove.th.receivedQty': 'Received qty',
        'siApprove.receivedAria': 'Received qty for {name}',
        'unit.liter': 'Liter',
        'unit.box': 'Box',

        'view.titleSupplierInvoice': 'Supplier Invoice {no}',
        'view.titlePurchaseReturn': 'Purchase Return {no}',
        'view.titleDetails': 'Approval Details',
        'view.subtitleSupplierInvoice': 'Supplier invoice',
        'view.subtitleAffiliatedReturn': 'Affiliated supplier return',
        'view.back': 'Back to Approvals',
        'view.type': 'Type',
        'view.amount': 'Amount',
        'view.requestedBy': 'Requested by',
        'view.category': 'Category',
        'view.branch': 'Branch',
        'view.details': 'Details',
        'view.reason': 'Reason',
        'view.approvedBy': 'Approved by',
        'view.requestedAt': 'Requested at',
        'view.approvedAt': 'Approved at',
        'view.rejectionReason': 'Rejection Reason',

        'filter.allQueue': 'All Queue',
        'filter.pending': 'Pending',
        'filter.approved': 'Approved',
        'filter.rejected': 'Rejected',
        'filter.allTypes': 'All types',
        'filter.topUp': 'Top up',
        'filter.expenses': 'Expenses',
        'filter.supplierInvoices': 'Supplier invoices',
        'filter.purchaseReturns': 'Purchase returns',
        'filter.salesReturns': 'Sales returns',
        'filter.requestType': 'Request type',
        'filter.requestsCount': '{count} requests',

        'th.type': 'Type',
        'th.amount': 'Amount',
        'th.requestedBy': 'Requested By',
        'th.date': 'Date',
        'th.status': 'Status',
        'th.actions': 'Actions',

        'empty': 'No approvals found',

        'status.pending': 'Pending',
        'status.approved': 'Approved',
        'status.rejected': 'Rejected',
        'status.unknown': 'unknown',

        'label.pi': ' · PI {no}',
        'label.inv': 'Inv {no}',
        'label.outstanding': 'Outstanding · {amount} of {total}',

        'title.approve': 'Approve',
        'title.acceptInvoice': 'Accept invoice (workshop)',
        'title.reject': 'Reject',
        'title.rejectSupplier': 'Reject supplier invoice',
        'title.viewInvoice': 'Open the printable supplier invoice',
        'title.viewDetails': 'View request details',
    },
    ar: {
        'page.title': 'قائمة الموافقات',
        'page.subtitle': 'مراجعة الطلبات المعلّقة واتخاذ إجراء بشأنها',
        'page.branchAll': 'كل الفروع',
        'page.branchNamed': 'فرع {id}',

        'emdash': '—',
        'money.sar': '{amount} ر.س',

        'kind.lockerVault': 'خزنة الخزائن',
        'kind.cashierTill': 'صندوق أمين الصندوق',
        'kind.pettyCashWallet': 'محفظة المصروفات النثرية',
        'kind.bank': 'بنك',
        'kind.pettyCash': 'مصروفات نثرية',
        'kind.cash': 'نقد',
        'account.fallback': 'حساب',
        'account.label': '{name} ({kindLabel}) — {money}',

        'btn.cancel': 'إلغاء',
        'btn.approveExpense': 'الموافقة على المصروف',
        'btn.approvePostJournal': 'الموافقة وترحيل القيد',
        'btn.reject': 'رفض',
        'btn.rejecting': 'جاري الرفض...',
        'btn.approve': 'موافقة',
        'btn.approving': 'جاري الموافقة…',
        'btn.refresh': 'تحديث',
        'btn.refreshing': 'جاري التحديث...',
        'btn.viewInvoice': 'عرض الفاتورة',
        'btn.details': 'التفاصيل',
        'btn.downloadPdf': 'تنزيل PDF',
        'btn.okApproveInventory': 'موافق — الموافقة وتحديث المخزون',

        'modal.approveExpenseTitle': 'الموافقة على مصروف مسؤول المنصة',
        'modal.approveFundTitle': 'الموافقة على طلب تمويل مسؤول المنصة',
        'modal.approveExpenseLead': 'الموافقة على مصروف لـ',
        'modal.approveFundLead': 'الموافقة على طلب تمويل لـ',
        'modal.atBranch': 'في فرع',
        'modal.amount': 'المبلغ',
        'modal.expenseTail': 'سيُسحب من حساب الميزانية المحدد.',
        'modal.fundTail': 'سيُضاف إلى محفظتهم من حساب الدفع المحدد.',
        'modal.details': 'التفاصيل',
        'modal.purpose': 'الغرض',
        'modal.remarks': 'ملاحظات',
        'modal.optional': '(اختياري)',
        'modal.remarksPlaceholder': 'مثال: تمت الموافقة لتعويم نقد الفرع النثري.',
        'fallback.thisBranch': 'هذا الفرع',
        'fallback.platformAdmin': 'مسؤول المنصة',
        'fallback.supplier': 'المورّد',
        'fallback.cashier': 'أمين الصندوق',

        'approver.superAdmin': 'المسؤول الأعلى: {name}',
        'approver.workshopAdmin': 'مسؤول الورشة: {name}',

        'type.supplierInvoice': 'فاتورة مورّد',
        'type.purchaseReturn': 'مرتجع مشتريات',
        'type.salesReturn': 'مرتجع مبيعات',
        'type.platformAdminFund': 'تمويل مسؤول المنصة',
        'type.platformAdminExpense': 'مصروف مسؤول المنصة',
        'type.lockerExpense': 'مصروف الخزنة',
        'type.topUp': 'تعبئة رصيد',
        'type.expense': 'مصروف',

        'reason.lines': 'البنود: {label}',
        'reason.linkedSupplierReturn': 'مرتجع مورّد مرتبط {no}',

        'err.invalidResponse': 'استجابة موافقات غير صالحة.',
        'err.load': 'فشل تحميل قائمة الموافقات.',
        'err.approveSalesReturn': 'فشلت الموافقة على مرتجع المبيعات.',
        'err.approvePurchaseReturn': 'فشلت الموافقة على مرتجع المشتريات.',
        'err.approveSupplierInvoice': 'فشلت الموافقة على فاتورة المورّد.',
        'err.approveRequest': 'فشلت الموافقة على الطلب.',
        'err.rejectSalesReturn': 'فشل رفض مرتجع المبيعات.',
        'err.rejectSupplierInvoice': 'فشل رفض فاتورة المورّد.',
        'err.rejectAdminWallet': 'فشل رفض طلب محفظة مسؤول المنصة.',
        'err.rejectRequest': 'فشل رفض الطلب.',
        'err.approveFund': 'فشلت الموافقة على طلب التمويل.',
        'err.approveExpense': 'فشلت الموافقة على طلب المصروف.',
        'err.loadInvoice': 'تعذّر تحميل تفاصيل الفاتورة.',
        'err.loadPurchaseReturn': 'تعذّر تحميل تفاصيل مرتجع المشتريات.',

        'confirm.approvePurchaseReturn':
            'الموافقة على مرتجع المشتريات {no}؟\n\nسينخفض مخزون الفرع وسيُستكمل مرتجع المورّد المرتبط.\n\nلا يمكن التراجع عن هذا الإجراء.',

        'reject.titleSupplier': 'رفض فاتورة المورّد',
        'reject.title': 'رفض الموافقة',
        'reject.subtitle': 'أدخل سببًا — يُحفظ على الطلب.',
        'reject.back': 'العودة إلى الموافقات',
        'reject.placeholder': 'سبب الرفض...',

        'siApprove.title': 'الموافقة على فاتورة المورّد واستلام المخزون',
        'siApprove.subtitle':
            'أكّد كميات الاستلام، وحدّد المخزون الحرج للمنتجات الجديدة في الفرع، ثم وافق.',
        'siApprove.back': 'العودة إلى الموافقات',
        'siApprove.newProductsIntro':
            'المنتجات التالية غير موجودة في مخزون {branch} بعد. إذا وافقت، سيضيفها النظام إلى هذا الفرع ويضبط المخزون الافتتاحي وفق كميات فاتورة المبيعات هذه (لكل منتج، مجموع البنود). حدّد المخزون الحرج (مستوى تنبيه انخفاض المخزون) لكل منتج فرع جديد أدناه، ثم أكّد.',
        'siApprove.unresolvedIntro':
            'تعذّر مطابقة بعض بنود الفاتورة مع منتج في كتالوج الورشة. يمكنك الموافقة على الفاتورة محاسبيًا، لكن قد لا يتحدّث المخزون لتلك البنود حتى تُربط بالمنتجات الرئيسية.',
        'siApprove.reviewIntro':
            'راجع التفاصيل أدناه قبل الموافقة. سيُحدَّث المخزون لهذا الفرع وفق بنود الفاتورة.',
        'siApprove.unmatched':
            'تعذّرت المطابقة مع الكتالوج: {names}. قد لا يُطبَّق المخزون لهذه البنود حتى تُربط بمنتج رئيسي.',
        'siApprove.th.product': 'المنتج',
        'siApprove.th.qtyOpening': 'الكمية (افتتاحي)',
        'siApprove.th.criticalStock': 'المخزون الحرج',
        'siApprove.noNewUnresolved':
            'لن تُنشأ منتجات كتالوج فرع جديدة من هذه الفاتورة؛ يمكن استلام المخزون للبنود المطابقة فقط.',
        'siApprove.noNewMatched':
            'لا منتجات فرع جديدة؛ ستزيد الموافقة المخزون فقط للمنتجات الموجودة أصلًا في هذا الفرع.',
        'siApprove.receiveTitle': 'بنود الفاتورة — الكمية المستلمة',
        'siApprove.receiveHint':
            'اترك «الكمية المستلمة» فارغة عندما يطابق العدّ الفعلي مبلغ الفرع في الفاتورة. أدخل قيمة بوحدة الورشة فقط عند الاختلاف.',
        'siApprove.th.supplierShipped': 'شحنة المورّد',
        'siApprove.th.branchStock': 'مخزون الفرع +',
        'siApprove.th.receivedQty': 'الكمية المستلمة',
        'siApprove.receivedAria': 'الكمية المستلمة لـ {name}',
        'unit.liter': 'لتر',
        'unit.box': 'صندوق',

        'view.titleSupplierInvoice': 'فاتورة مورّد {no}',
        'view.titlePurchaseReturn': 'مرتجع مشتريات {no}',
        'view.titleDetails': 'تفاصيل الموافقة',
        'view.subtitleSupplierInvoice': 'فاتورة مورّد',
        'view.subtitleAffiliatedReturn': 'مرتجع مورّد منتسب',
        'view.back': 'العودة إلى الموافقات',
        'view.type': 'النوع',
        'view.amount': 'المبلغ',
        'view.requestedBy': 'مقدّم الطلب',
        'view.category': 'الفئة',
        'view.branch': 'الفرع',
        'view.details': 'التفاصيل',
        'view.reason': 'السبب',
        'view.approvedBy': 'وُوفق عليه بواسطة',
        'view.requestedAt': 'تاريخ الطلب',
        'view.approvedAt': 'تاريخ الموافقة',
        'view.rejectionReason': 'سبب الرفض',

        'filter.allQueue': 'كل القائمة',
        'filter.pending': 'معلّق',
        'filter.approved': 'موافق عليه',
        'filter.rejected': 'مرفوض',
        'filter.allTypes': 'كل الأنواع',
        'filter.topUp': 'تعبئة رصيد',
        'filter.expenses': 'المصروفات',
        'filter.supplierInvoices': 'فواتير المورّدين',
        'filter.purchaseReturns': 'مرتجعات المشتريات',
        'filter.salesReturns': 'مرتجعات المبيعات',
        'filter.requestType': 'نوع الطلب',
        'filter.requestsCount': '{count} طلبات',

        'th.type': 'النوع',
        'th.amount': 'المبلغ',
        'th.requestedBy': 'مقدّم الطلب',
        'th.date': 'التاريخ',
        'th.status': 'الحالة',
        'th.actions': 'الإجراءات',

        'empty': 'لا توجد موافقات',

        'status.pending': 'معلّق',
        'status.approved': 'موافق عليه',
        'status.rejected': 'مرفوض',
        'status.unknown': 'غير معروف',

        'label.pi': ' · فاتورة شراء {no}',
        'label.inv': 'فاتورة {no}',
        'label.outstanding': 'المتبقي · {amount} من {total}',

        'title.approve': 'موافقة',
        'title.acceptInvoice': 'قبول الفاتورة (الورشة)',
        'title.reject': 'رفض',
        'title.rejectSupplier': 'رفض فاتورة المورّد',
        'title.viewInvoice': 'فتح فاتورة المورّد القابلة للطباعة',
        'title.viewDetails': 'عرض تفاصيل الطلب',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function waT(locale, key, vars) {
    const pack = WA_I18N[locale] || WA_I18N.en;
    let text = pack[key] ?? WA_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
