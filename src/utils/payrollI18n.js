/** Workshop Payroll Run UI copy — keyed by portal locale (`en` | `ar`). */
const PAYROLL_I18N = {
    en: {
        'title': 'Payroll Run',
        'subtitle':
            'Process a payroll period in one shot. Each row posts a balanced journal entry to 6300 Salary Expense, credits the selected pay-from account, and FIFO-settles outstanding advances for that employee.',
        'label.period': 'Period',
        'label.paymentDate': 'Payment Date',
        'btn.refreshLookups': 'Refresh lookups',
        'btn.addRow': 'Add row',
        'btn.submit': 'Submit Payroll Run',
        'btn.submitting': 'Submitting…',
        'th.employee': 'Employee *',
        'th.gross': 'Gross (SAR) *',
        'th.deduction': 'Advance Deduction',
        'th.netAuto': 'Net (auto)',
        'th.payFrom': 'Pay From *',
        'th.notes': 'Notes',
        'opt.select': 'Select…',
        'opt.selectAccount': 'Select account…',
        'ph.notes': 'Optional note',
        'totals.gross': 'Gross:',
        'totals.deductions': 'Deductions:',
        'totals.net': 'Net:',
        'recent.title': 'Recent Salary Payments',
        'recent.th.date': 'Date',
        'recent.th.employee': 'Employee',
        'recent.th.period': 'Period',
        'recent.th.gross': 'Gross',
        'recent.th.deduction': 'Deduction',
        'recent.th.net': 'Net',
        'recent.th.payFrom': 'Pay From',
        'recent.empty': 'No salary payments yet.',
        'err.load': 'Could not load payroll data.',
        'err.needRow': 'Add at least one row with an employee and a gross amount.',
        'err.needPayFrom': 'Every row must have a Pay From account.',
        'err.submit': 'Could not submit payroll.',
        'msg.saved': 'Saved {n} salary payment(s). Total SAR {total}.',
    },
    ar: {
        'title': 'تشغيل الرواتب',
        'subtitle':
            'معالجة فترة رواتب دفعة واحدة. كل صف يرحّل قيداً متوازناً إلى حساب 6300 مصروف الرواتب، ويقيد لحساب الصرف المحدد، ويسوّي السلف المستحقة للموظف بأسلوب FIFO.',
        'label.period': 'الفترة',
        'label.paymentDate': 'تاريخ الدفع',
        'btn.refreshLookups': 'تحديث القوائم',
        'btn.addRow': 'إضافة صف',
        'btn.submit': 'إرسال تشغيل الرواتب',
        'btn.submitting': 'جارٍ الإرسال…',
        'th.employee': 'الموظف *',
        'th.gross': 'الإجمالي (ر.س) *',
        'th.deduction': 'خصم السلفة',
        'th.netAuto': 'الصافي (تلقائي)',
        'th.payFrom': 'الدفع من *',
        'th.notes': 'ملاحظات',
        'opt.select': 'اختر…',
        'opt.selectAccount': 'اختر الحساب…',
        'ph.notes': 'ملاحظة اختيارية',
        'totals.gross': 'الإجمالي:',
        'totals.deductions': 'الخصومات:',
        'totals.net': 'الصافي:',
        'recent.title': 'مدفوعات الرواتب الأخيرة',
        'recent.th.date': 'التاريخ',
        'recent.th.employee': 'الموظف',
        'recent.th.period': 'الفترة',
        'recent.th.gross': 'الإجمالي',
        'recent.th.deduction': 'الخصم',
        'recent.th.net': 'الصافي',
        'recent.th.payFrom': 'الدفع من',
        'recent.empty': 'لا مدفوعات رواتب بعد.',
        'err.load': 'تعذّر تحميل بيانات الرواتب.',
        'err.needRow': 'أضف صفاً واحداً على الأقل بموظف ومبلغ إجمالي.',
        'err.needPayFrom': 'يجب أن يكون لكل صف حساب «الدفع من».',
        'err.submit': 'تعذّر إرسال الرواتب.',
        'msg.saved': 'تم حفظ {n} دفعة راتب. الإجمالي ر.س {total}.',
    },
};

export function payrollT(locale, key, vars) {
    const pack = PAYROLL_I18N[locale] || PAYROLL_I18N.en;
    let text = pack[key] ?? PAYROLL_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
