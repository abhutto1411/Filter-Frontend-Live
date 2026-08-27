/** Supplier Non-Affiliated Customers UI — keyed by portal locale (`en` | `ar`). */
export const SNAC_I18N = {
    en: {
        'money.sar': 'SAR {amount}',
        'balance.theyOwe': 'SAR {amount} — they owe you',
        'balance.youOwe': 'SAR {amount} — you owe them',
        'balance.settled': 'SAR 0.00 — settled',
        'emdash': '—',

        'page.title': 'Non-affiliated customers / workshops',
        'page.sub':
            'Manually track parties outside Filter: running balance from your ledger lines, with dated transaction history.',

        'btn.add': 'Add Non-Affiliated Customer',
        'btn.cancel': 'Cancel',
        'btn.close': 'Close',
        'btn.save': 'Save',
        'btn.update': 'Update',
        'btn.saving': 'Saving…',
        'btn.edit': 'Edit',
        'btn.deactivate': 'Deactivate',
        'btn.applyFilters': 'Apply filters',
        'btn.clearFilters': 'Clear filters',
        'btn.pdf': 'Download PDF',
        'btn.excel': 'Download Excel',
        'btn.addLedger': 'Add ledger line',
        'btn.loading': 'Loading…',

        'th.party': 'Party',
        'th.balance': 'Balance',
        'th.actions': 'Actions',
        'th.date': 'Date',
        'th.description': 'Description',
        'th.debit': 'Debit',
        'th.credit': 'Credit',
        'th.balanceCol': 'Balance',

        'loading': 'Loading…',
        'empty': 'No customers yet — use "Add Non-Affiliated Customer".',
        'aria.actions': 'Actions for {name}',
        'fallback.customer': 'customer',

        'err.load': 'Failed to load',
        'err.tx': 'Transaction load failed',
        'err.save': 'Save failed',
        'err.update': 'Update failed',
        'err.remove': 'Remove failed',
        'err.ledger': 'Ledger save failed',

        'confirm.deactivate':
            'Deactivate this party? They disappear from your list until re-added.',

        'modal.addTitle': 'Add Non-Affiliated Customer',
        'modal.editTitle': 'Edit — {name}',
        'modal.displayName': 'Display name',
        'modal.phone': 'Phone',
        'modal.email': 'Email',
        'modal.notes': 'Notes',

        'ledger.title': 'Customer Ledger — {name}',
        'ledger.account': 'Ledger account',
        'ledger.currentBalance': 'Current balance',
        'ledger.yourBusiness': 'Your business',
        'ledger.period': 'Statement period',
        'ledger.from': 'From',
        'ledger.to': 'To',
        'ledger.opening': 'Opening balance',
        'ledger.loading': 'Loading ledger…',
        'ledger.empty': 'No transactions in this period.',
        'ledger.closingSummary': 'Closing summary',
        'ledger.totalDebit': 'Total Debit',
        'ledger.totalCredit': 'Total Credit',
        'ledger.closingBalance': 'Closing Balance',
        'ledger.manual': 'Record manual payment / adjustment',
        'ledger.date': 'Date',
        'ledger.amount': 'Amount (+ charge / − payment)',
        'ledger.amountPh': 'e.g. 500 or -500',
        'ledger.type': 'Type',
        'ledger.type.charge': 'charge',
        'ledger.type.credit': 'credit',
        'ledger.type.payment': 'payment',
        'ledger.type.adjustment': 'adjustment',
        'ledger.lineTitle': 'Title',
        'ledger.desc': 'Description (optional)',
        'ledger.ref': 'Reference (optional)',
    },
    ar: {
        'money.sar': '{amount} ر.س',
        'balance.theyOwe': '{amount} ر.س — هم مدينون لك',
        'balance.youOwe': '{amount} ر.س — أنت مدين لهم',
        'balance.settled': '0.00 ر.س — مسوّى',
        'emdash': '—',

        'page.title': 'عملاء / ورش غير تابعة',
        'page.sub':
            'تتبّع يدويًا أطرافًا خارج Filter: رصيد جارٍ من بنود دفتر الأستاذ، مع سجل معاملات مؤرّخ.',

        'btn.add': 'إضافة عميل غير تابع',
        'btn.cancel': 'إلغاء',
        'btn.close': 'إغلاق',
        'btn.save': 'حفظ',
        'btn.update': 'تحديث',
        'btn.saving': 'جارٍ الحفظ…',
        'btn.edit': 'تعديل',
        'btn.deactivate': 'إلغاء التفعيل',
        'btn.applyFilters': 'تطبيق التصفية',
        'btn.clearFilters': 'مسح التصفية',
        'btn.pdf': 'تنزيل PDF',
        'btn.excel': 'تنزيل Excel',
        'btn.addLedger': 'إضافة بند دفتر',
        'btn.loading': 'جارٍ التحميل…',

        'th.party': 'الطرف',
        'th.balance': 'الرصيد',
        'th.actions': 'إجراءات',
        'th.date': 'التاريخ',
        'th.description': 'الوصف',
        'th.debit': 'مدين',
        'th.credit': 'دائن',
        'th.balanceCol': 'الرصيد',

        'loading': 'جارٍ التحميل…',
        'empty': 'لا عملاء بعد — استخدم «إضافة عميل غير تابع».',
        'aria.actions': 'إجراءات لـ {name}',
        'fallback.customer': 'عميل',

        'err.load': 'فشل التحميل',
        'err.tx': 'فشل تحميل المعاملات',
        'err.save': 'فشل الحفظ',
        'err.update': 'فشل التحديث',
        'err.remove': 'فشل الإزالة',
        'err.ledger': 'فشل حفظ دفتر الأستاذ',

        'confirm.deactivate':
            'إلغاء تفعيل هذا الطرف؟ سيختفي من قائمتك حتى تُعاد إضافته.',

        'modal.addTitle': 'إضافة عميل غير تابع',
        'modal.editTitle': 'تعديل — {name}',
        'modal.displayName': 'اسم العرض',
        'modal.phone': 'الهاتف',
        'modal.email': 'البريد الإلكتروني',
        'modal.notes': 'ملاحظات',

        'ledger.title': 'دفتر العميل — {name}',
        'ledger.account': 'حساب دفتر الأستاذ',
        'ledger.currentBalance': 'الرصيد الحالي',
        'ledger.yourBusiness': 'نشاطك',
        'ledger.period': 'فترة الكشف',
        'ledger.from': 'من',
        'ledger.to': 'إلى',
        'ledger.opening': 'الرصيد الافتتاحي',
        'ledger.loading': 'جارٍ تحميل دفتر الأستاذ…',
        'ledger.empty': 'لا معاملات في هذه الفترة.',
        'ledger.closingSummary': 'ملخص الإقفال',
        'ledger.totalDebit': 'إجمالي المدين',
        'ledger.totalCredit': 'إجمالي الدائن',
        'ledger.closingBalance': 'رصيد الإقفال',
        'ledger.manual': 'تسجيل دفعة / تسوية يدوية',
        'ledger.date': 'التاريخ',
        'ledger.amount': 'المبلغ (+ رسوم / − دفعة)',
        'ledger.amountPh': 'مثال: 500 أو -500',
        'ledger.type': 'النوع',
        'ledger.type.charge': 'رسوم',
        'ledger.type.credit': 'دائن',
        'ledger.type.payment': 'دفعة',
        'ledger.type.adjustment': 'تسوية',
        'ledger.lineTitle': 'العنوان',
        'ledger.desc': 'الوصف (اختياري)',
        'ledger.ref': 'المرجع (اختياري)',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function snacT(locale, key, vars) {
    const pack = SNAC_I18N[locale] || SNAC_I18N.en;
    let text = pack[key] ?? SNAC_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
