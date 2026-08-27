/** Supplier Cash & Bank UI — keyed by portal locale (`en` | `ar`). */
export const SCB_I18N = {
    en: {
        'money.sar': 'SAR {amount}',
        'emdash': '—',

        'page.title': 'Cash & Bank',
        'page.sub': 'Manage cash and bank accounts',

        'type.cash': 'Cash',
        'type.bank': 'Bank',
        'type.receipt': 'Receipt',
        'type.payment': 'Payment',
        'fallback.account': 'Account',

        'warn.accounts': 'Accounts: {msg}',
        'warn.ledger': 'Ledger: {msg}',
        'warn.payments': 'Payments: {msg}',
        'warn.requestFailed': 'request failed',
        'warn.partial': 'Partial load:',

        'err.loadAccounts': 'Failed to load accounts',
        'err.loadData': 'Failed to load cash & bank data',
        'err.createAccount': 'Could not create account',
        'err.requiredFields': 'Account, amount, and date are required.',
        'err.validAmount': 'Enter a valid amount greater than zero.',
        'err.recordReceipt': 'Could not record receipt',
        'err.recordPayment': 'Could not record payment',
        'err.couldNotLoad': 'Could not load accounts:',

        'desc.defaultReceipt': 'Payment received from workshop',
        'desc.defaultPayment': 'Payment to vendor / expense',
        'desc.paymentFor': 'Payment for {ref}',

        'kpi.totalCash': 'Total Cash',
        'kpi.totalBank': 'Total Bank',
        'kpi.totalBalance': 'Total Balance',

        'btn.receive': 'Receive Payment',
        'btn.makePay': 'Make Payment',
        'btn.addAccount': 'Add Cash / Bank Account',
        'btn.cancel': 'Cancel',
        'btn.addAccountSubmit': 'Add Account',
        'btn.recordReceipt': 'Record Receipt',
        'btn.recordPayment': 'Record Payment',
        'btn.saving': 'Saving…',

        'tab.accounts': 'Accounts',
        'tab.ledger': 'Transaction Ledger',

        'empty.noAccounts': 'No accounts yet',
        'empty.couldNotLoad': 'Accounts could not be loaded.',
        'empty.hint':
            'Use "Add Cash / Bank Account" to create one. Totals stay at SAR 0 until accounts exist.',
        'empty.noLedger': 'No transactions recorded.',
        'empty.noLedgerData': 'No ledger data loaded.',

        'label.currentBalance': 'Current Balance',

        'th.date': 'Date',
        'th.account': 'Account',
        'th.type': 'Type',
        'th.description': 'Description',
        'th.reference': 'Reference',
        'th.debit': 'Debit',
        'th.credit': 'Credit',

        'modal.addTitle': 'Add Cash / Bank Account',
        'modal.accountName': 'Account Name *',
        'modal.accountNamePh': 'e.g. Petty Cash, Riyad Bank',
        'modal.accountType': 'Account Type',
        'modal.bankName': 'Bank Name',
        'modal.iban': 'IBAN',
        'modal.ibanPh': 'SA...',
        'modal.accountNumber': 'Account Number',
        'modal.openingBalance': 'Opening Balance (SAR)',

        'modal.receiveTitle': 'Receive Payment (from Workshop)',
        'modal.payTitle': 'Make Payment (to Vendor / Expense)',
        'modal.account': 'Account *',
        'modal.selectAccount': 'Select account',
        'modal.amount': 'Amount (SAR) *',
        'modal.date': 'Date *',
        'modal.description': 'Description',
        'modal.receiveDescPh': 'e.g. Payment received from Workshop A',
        'modal.payDescPh': 'e.g. Payment to Vendor',
        'modal.reference': 'Reference / TXN',
        'modal.refPh': 'Bank TXN or cheque #',
        'modal.needAccountReceipt':
            'Add a cash or bank account first, then record receipts against it.',
        'modal.needAccountPay': 'Add a cash or bank account first.',
        'modal.accountOption': '{name} ({type})',
    },
    ar: {
        'money.sar': '{amount} ر.س',
        'emdash': '—',

        'page.title': 'النقد والبنك',
        'page.sub': 'إدارة حسابات النقد والبنك',

        'type.cash': 'نقد',
        'type.bank': 'بنك',
        'type.receipt': 'إيصال',
        'type.payment': 'دفعة',
        'fallback.account': 'حساب',

        'warn.accounts': 'الحسابات: {msg}',
        'warn.ledger': 'دفتر الأستاذ: {msg}',
        'warn.payments': 'المدفوعات: {msg}',
        'warn.requestFailed': 'فشل الطلب',
        'warn.partial': 'تحميل جزئي:',

        'err.loadAccounts': 'فشل تحميل الحسابات',
        'err.loadData': 'فشل تحميل بيانات النقد والبنك',
        'err.createAccount': 'تعذّر إنشاء الحساب',
        'err.requiredFields': 'الحساب والمبلغ والتاريخ مطلوبة.',
        'err.validAmount': 'أدخل مبلغًا صالحًا أكبر من صفر.',
        'err.recordReceipt': 'تعذّر تسجيل الإيصال',
        'err.recordPayment': 'تعذّر تسجيل الدفعة',
        'err.couldNotLoad': 'تعذّر تحميل الحسابات:',

        'desc.defaultReceipt': 'دفعة مستلمة من ورشة',
        'desc.defaultPayment': 'دفعة لمورد / مصروف',
        'desc.paymentFor': 'دفعة لـ {ref}',

        'kpi.totalCash': 'إجمالي النقد',
        'kpi.totalBank': 'إجمالي البنك',
        'kpi.totalBalance': 'الإجمالي',

        'btn.receive': 'استلام دفعة',
        'btn.makePay': 'إجراء دفعة',
        'btn.addAccount': 'إضافة حساب نقد / بنك',
        'btn.cancel': 'إلغاء',
        'btn.addAccountSubmit': 'إضافة الحساب',
        'btn.recordReceipt': 'تسجيل الإيصال',
        'btn.recordPayment': 'تسجيل الدفعة',
        'btn.saving': 'جارٍ الحفظ…',

        'tab.accounts': 'الحسابات',
        'tab.ledger': 'سجل المعاملات',

        'empty.noAccounts': 'لا حسابات بعد',
        'empty.couldNotLoad': 'تعذّر تحميل الحسابات.',
        'empty.hint':
            'استخدم «إضافة حساب نقد / بنك» لإنشاء واحد. تبقى الإجماليات 0 ر.س حتى توجد حسابات.',
        'empty.noLedger': 'لا معاملات مسجّلة.',
        'empty.noLedgerData': 'لم تُحمَّل بيانات دفتر الأستاذ.',

        'label.currentBalance': 'الرصيد الحالي',

        'th.date': 'التاريخ',
        'th.account': 'الحساب',
        'th.type': 'النوع',
        'th.description': 'الوصف',
        'th.reference': 'المرجع',
        'th.debit': 'مدين',
        'th.credit': 'دائن',

        'modal.addTitle': 'إضافة حساب نقد / بنك',
        'modal.accountName': 'اسم الحساب *',
        'modal.accountNamePh': 'مثال: نثرية، بنك الرياض',
        'modal.accountType': 'نوع الحساب',
        'modal.bankName': 'اسم البنك',
        'modal.iban': 'الآيبان',
        'modal.ibanPh': 'SA...',
        'modal.accountNumber': 'رقم الحساب',
        'modal.openingBalance': 'الرصيد الافتتاحي (ر.س)',

        'modal.receiveTitle': 'استلام دفعة (من ورشة)',
        'modal.payTitle': 'إجراء دفعة (لمورد / مصروف)',
        'modal.account': 'الحساب *',
        'modal.selectAccount': 'اختر حسابًا',
        'modal.amount': 'المبلغ (ر.س) *',
        'modal.date': 'التاريخ *',
        'modal.description': 'الوصف',
        'modal.receiveDescPh': 'مثال: دفعة مستلمة من ورشة أ',
        'modal.payDescPh': 'مثال: دفعة لمورد',
        'modal.reference': 'المرجع / رقم العملية',
        'modal.refPh': 'رقم عملية بنكية أو شيك',
        'modal.needAccountReceipt':
            'أضف حساب نقد أو بنك أولاً، ثم سجّل الإيصالات عليه.',
        'modal.needAccountPay': 'أضف حساب نقد أو بنك أولاً.',
        'modal.accountOption': '{name} ({type})',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function scbT(locale, key, vars) {
    const pack = SCB_I18N[locale] || SCB_I18N.en;
    let text = pack[key] ?? SCB_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
