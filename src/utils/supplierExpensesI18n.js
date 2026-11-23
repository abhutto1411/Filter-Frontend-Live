/** Supplier portal — Expenses. Locale: `en` | `ar` (MSA). */
const SEXP_I18N = {
    en: {
        'title': 'Expenses ({count})',
        'subtitle': 'Operational expenses',

        'btn.add': 'Add Expense',
        'btn.addFirst': 'Add First Expense',
        'btn.cancel': 'Cancel',
        'btn.saving': 'Saving...',
        'btn.update': 'Update Expense',
        'btn.submit': 'Submit Expense',
        'btn.edit': 'Edit',
        'btn.delete': 'Delete',
        'btn.deleting': 'Deleting…',
        'btn.deleteConfirm': 'Delete expense',

        'stat.records': 'Records',
        'stat.total': 'Total Expenses',
        'stat.paid': 'Paid',
        'stat.pending': 'Pending Approval',

        'error.api': 'API error: {error}',
        'error.load': 'Failed to load expenses data.',
        'error.save': 'Failed to save expense.',
        'error.delete': 'Failed to delete expense.',
        'error.categoryRequired': 'Category is required.',

        'empty': 'No expenses yet',
        // SP-22 — role permissions
        'perm.denied': 'Your role does not allow this action. Ask an admin to grant it.',
        'fallback.expense': 'Expense',

        'th.date': 'Date',
        'th.description': 'Description',
        'th.category': 'Category',
        'th.amount': 'Amount',
        'th.status': 'Status',
        'th.actions': 'Actions',

        'status.approved': 'approved',
        'status.paid': 'paid',
        'status.pending': 'pending',
        'status.rejected': 'rejected',

        'action.aria': 'Actions for {name}',
        'action.deleteDisabled': 'Only pending expenses can be deleted',

        'modal.addTitle': 'Add Expense',
        'modal.editTitle': 'Edit Expense',
        'modal.readOnly': 'Only pending expenses can be updated or deleted.',
        'modal.category': 'Category *',
        'modal.selectCategory': 'Select category',
        'modal.amount': 'Amount (SAR) *',
        'modal.vat': 'VAT Amount',
        'modal.date': 'Date',
        'modal.proofUrl': 'Proof URL',
        'modal.proofPlaceholder': 'https://example.com/receipt.jpg',
        'modal.description': 'Description',

        'delete.title': 'Delete expense?',
        'delete.body':
            'This will permanently remove this expense request. This action cannot be undone.',
        'delete.description': 'Description:',
        'delete.category': 'Category:',
        'delete.date': 'Date:',
        'delete.amount': 'Amount:',

        'money.sar': 'SAR {amount}',
        'emdash': '—',

        // SP-04 — supplier-ledger expenses
        'subtitle.ledger':
            'Posted expenses debit 6000 (or the category account) and VAT 1300, and credit cash, bank or accounts payable.',
        'stat.posted': 'Posted expenses',
        'stat.paidCashBank': 'Paid (cash / bank)',
        'stat.drafts': 'Drafts',
        'th.number': 'No.',
        'th.payFrom': 'Paid from',
        'th.total': 'Total (incl. VAT)',
        'th.journal': 'Journal',
        'status.draft': 'Draft',
        'status.posted': 'Posted',
        'status.void': 'Void',
        'payFrom.cash': 'Cash',
        'payFrom.bank': 'Bank',
        'payFrom.payable': 'On account (payable)',
        'modal.total': 'Total (incl. VAT)',
        'modal.payFrom': 'Paid from *',
        'modal.paidFromAccount': 'Cash / bank account',
        'modal.defaultAccount': 'Default ({code})',
        'modal.vendor': 'Vendor (owed to) *',
        'modal.selectVendor': 'Select vendor',
        'modal.payee': 'Payee',
        'modal.reference': 'Reference / bill no.',
        'modal.postingPreview': 'On post: Dr {debit} · Dr 1300 VAT · Cr {credit}',
        'modal.draftOnly': 'Only draft expenses can be edited. Void a posted expense and record it again.',
        'btn.saveDraft': 'Save draft',
        'btn.post': 'Post expense',
        'btn.posting': 'Posting…',
        'btn.void': 'Void',
        'btn.voiding': 'Voiding…',
        'btn.voidConfirm': 'Void expense',
        'btn.openJournal': 'Open journal {number}',
        'action.deleteDisabled.ledger': 'Only drafts can be deleted. Void a posted expense instead.',
        'void.title': 'Void expense?',
        'void.body':
            'The journal for this expense will be voided, so 6000, VAT and the paid-from account move back. The expense stays on the list as void.',
        'void.reason': 'Reason (optional)',
        'delete.body.draft': 'This draft has no journal. It will be removed permanently.',
        'error.post': 'Failed to post expense.',
        'error.void': 'Failed to void expense.',
        'error.vendorRequired': 'Choose the vendor this expense is owed to.',
        'error.amountRequired': 'Enter an amount greater than 0.',
    },
    ar: {
        'title': 'المصروفات ({count})',
        'subtitle': 'المصروفات التشغيلية',

        'btn.add': 'إضافة مصروف',
        'btn.addFirst': 'إضافة أول مصروف',
        'btn.cancel': 'إلغاء',
        'btn.saving': 'جاري الحفظ...',
        'btn.update': 'تحديث المصروف',
        'btn.submit': 'إرسال المصروف',
        'btn.edit': 'تعديل',
        'btn.delete': 'حذف',
        'btn.deleting': 'جاري الحذف…',
        'btn.deleteConfirm': 'حذف المصروف',

        'stat.records': 'السجلات',
        'stat.total': 'إجمالي المصروفات',
        'stat.paid': 'مدفوع',
        'stat.pending': 'بانتظار الاعتماد',

        'error.api': 'خطأ في الواجهة: {error}',
        'error.load': 'فشل تحميل بيانات المصروفات.',
        'error.save': 'فشل حفظ المصروف.',
        'error.delete': 'فشل حذف المصروف.',
        'error.categoryRequired': 'الفئة مطلوبة.',

        'empty': 'لا توجد مصروفات بعد',
        // SP-22 — role permissions
        'perm.denied': 'دورك لا يسمح بهذا الإجراء. اطلب من المسؤول منحه.',
        'fallback.expense': 'مصروف',

        'th.date': 'التاريخ',
        'th.description': 'الوصف',
        'th.category': 'الفئة',
        'th.amount': 'المبلغ',
        'th.status': 'الحالة',
        'th.actions': 'الإجراءات',

        'status.approved': 'معتمد',
        'status.paid': 'مدفوع',
        'status.pending': 'قيد الانتظار',
        'status.rejected': 'مرفوض',

        'action.aria': 'إجراءات {name}',
        'action.deleteDisabled': 'يمكن حذف المصروفات قيد الانتظار فقط',

        'modal.addTitle': 'إضافة مصروف',
        'modal.editTitle': 'تعديل مصروف',
        'modal.readOnly': 'يمكن تحديث أو حذف المصروفات قيد الانتظار فقط.',
        'modal.category': 'الفئة *',
        'modal.selectCategory': 'اختر الفئة',
        'modal.amount': 'المبلغ (ر.س) *',
        'modal.vat': 'مبلغ الضريبة',
        'modal.date': 'التاريخ',
        'modal.proofUrl': 'رابط الإثبات',
        'modal.proofPlaceholder': 'https://example.com/receipt.jpg',
        'modal.description': 'الوصف',

        'delete.title': 'حذف المصروف؟',
        'delete.body': 'سيُحذف طلب المصروف نهائياً. لا يمكن التراجع عن هذا الإجراء.',
        'delete.description': 'الوصف:',
        'delete.category': 'الفئة:',
        'delete.date': 'التاريخ:',
        'delete.amount': 'المبلغ:',

        'money.sar': '{amount} ر.س',
        'emdash': '—',

        // SP-04 — مصروفات دفتر المورد
        'subtitle.ledger':
            'المصروفات المرحّلة تُقيَّد مدينة على 6000 (أو حساب الفئة) وضريبة المدخلات 1300، ودائنة على النقدية أو البنك أو الذمم الدائنة.',
        'stat.posted': 'المصروفات المرحّلة',
        'stat.paidCashBank': 'مدفوع (نقدية / بنك)',
        'stat.drafts': 'المسودات',
        'th.number': 'الرقم',
        'th.payFrom': 'الدفع من',
        'th.total': 'الإجمالي (شامل الضريبة)',
        'th.journal': 'القيد',
        'status.draft': 'مسودة',
        'status.posted': 'مرحّل',
        'status.void': 'ملغى',
        'payFrom.cash': 'نقدية',
        'payFrom.bank': 'بنك',
        'payFrom.payable': 'على الحساب (ذمم دائنة)',
        'modal.total': 'الإجمالي (شامل الضريبة)',
        'modal.payFrom': 'الدفع من *',
        'modal.paidFromAccount': 'حساب النقدية / البنك',
        'modal.defaultAccount': 'الافتراضي ({code})',
        'modal.vendor': 'المورد (المستحق له) *',
        'modal.selectVendor': 'اختر المورد',
        'modal.payee': 'المستفيد',
        'modal.reference': 'المرجع / رقم الفاتورة',
        'modal.postingPreview': 'عند الترحيل: مدين {debit} · مدين 1300 ضريبة · دائن {credit}',
        'modal.draftOnly': 'يمكن تعديل المسودات فقط. ألغِ المصروف المرحّل وسجّله من جديد.',
        'btn.saveDraft': 'حفظ كمسودة',
        'btn.post': 'ترحيل المصروف',
        'btn.posting': 'جاري الترحيل…',
        'btn.void': 'إلغاء',
        'btn.voiding': 'جاري الإلغاء…',
        'btn.voidConfirm': 'إلغاء المصروف',
        'btn.openJournal': 'فتح القيد {number}',
        'action.deleteDisabled.ledger': 'يمكن حذف المسودات فقط. ألغِ المصروف المرحّل بدلاً من ذلك.',
        'void.title': 'إلغاء المصروف؟',
        'void.body':
            'سيُلغى قيد هذا المصروف فتعود أرصدة 6000 والضريبة وحساب الدفع. يبقى المصروف في القائمة بحالة ملغى.',
        'void.reason': 'السبب (اختياري)',
        'delete.body.draft': 'هذه المسودة بلا قيد، وستُحذف نهائياً.',
        'error.post': 'فشل ترحيل المصروف.',
        'error.void': 'فشل إلغاء المصروف.',
        'error.vendorRequired': 'اختر المورد المستحق له هذا المصروف.',
        'error.amountRequired': 'أدخل مبلغاً أكبر من صفر.',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function sexpT(locale, key, vars) {
    const pack = SEXP_I18N[locale] || SEXP_I18N.en;
    let text = pack[key] ?? SEXP_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
