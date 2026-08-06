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
