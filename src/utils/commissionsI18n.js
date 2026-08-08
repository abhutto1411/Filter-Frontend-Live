/** HQ Referral Commissions UI copy — keyed by portal locale (`en` | `ar`). */
const COMM_I18N = {
    en: {
        'title': 'Referral Commission',
        'subtitle.before': 'Platform HQ referrer payouts — posts to Chart of Accounts (',
        'subtitle.mid': ' / ',
        'subtitle.after':
            '). Aligned with Referrer Portal APIs for future self-service.',
        'subtitle.expense': '6610 Referral Commission Expense',
        'subtitle.payable': '2210 Referral Commission Payable',
        'btn.referrerMgmt': 'Referrer Management',
        'btn.referralPortal': 'Referral Portal',
        'btn.refresh': 'Refresh',
        'hint.books':
            'Mature pending commissions to accrue expense & payable on HQ books. Pay clears payable against HQ cash/bank. Same records power the Referrer Portal when launched.',
        'stat.pending': 'Pending',
        'stat.available': 'Available to pay',
        'stat.paid': 'Paid',
        'filter.all': 'All statuses',
        'filter.pending': 'Pending',
        'filter.matured': 'Matured / available',
        'filter.paid': 'Paid',
        'th.date': 'Date',
        'th.referrer': 'Referrer',
        'th.description': 'Description',
        'th.amount': 'Amount',
        'th.status': 'Status',
        'th.actions': 'Actions',
        'loading': 'Loading…',
        'empty': 'No referral commission records yet.',
        'btn.mature': 'Mature',
        'btn.pay': 'Pay',
        'status.pending': 'pending',
        'status.matured': 'matured',
        'status.approved': 'approved',
        'status.available': 'available',
        'status.paid': 'paid',
        'err.load': 'Failed to load referral commissions',
        'err.mature': 'Could not mature commission',
        'err.pay': 'Could not pay commission',
        'emdash': '—',
    },
    ar: {
        'title': 'عمولة الإحالة',
        'subtitle.before': 'مدفوعات المُحيل في المقر الرئيسي — تُرحَّل إلى دليل الحسابات (',
        'subtitle.mid': ' / ',
        'subtitle.after': '). متوافقة مع واجهات بوابة المُحيل للخدمة الذاتية لاحقًا.',
        'subtitle.expense': '6610 مصروف عمولة الإحالة',
        'subtitle.payable': '2210 عمولة الإحالة المستحقة',
        'btn.referrerMgmt': 'إدارة المُحيلين',
        'btn.referralPortal': 'بوابة الإحالة',
        'btn.refresh': 'تحديث',
        'hint.books':
            'قم بإنضاج العمولات المعلقة لاستحقاق المصروف والمستحقات في دفاتر المقر. الدفع يُصفّي المستحقات مقابل نقد/بنك المقر. نفس السجلات تغذي بوابة المُحيل عند إطلاقها.',
        'stat.pending': 'معلق',
        'stat.available': 'متاح للدفع',
        'stat.paid': 'مدفوع',
        'filter.all': 'كل الحالات',
        'filter.pending': 'معلق',
        'filter.matured': 'ناضج / متاح',
        'filter.paid': 'مدفوع',
        'th.date': 'التاريخ',
        'th.referrer': 'المُحيل',
        'th.description': 'الوصف',
        'th.amount': 'المبلغ',
        'th.status': 'الحالة',
        'th.actions': 'إجراءات',
        'loading': 'جاري التحميل…',
        'empty': 'لا توجد سجلات عمولة إحالة بعد.',
        'btn.mature': 'إنضاج',
        'btn.pay': 'دفع',
        'status.pending': 'معلق',
        'status.matured': 'ناضج',
        'status.approved': 'معتمد',
        'status.available': 'متاح',
        'status.paid': 'مدفوع',
        'err.load': 'تعذر تحميل عمولات الإحالة',
        'err.mature': 'تعذر إنضاج العمولة',
        'err.pay': 'تعذر دفع العمولة',
        'emdash': '—',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function commT(locale, key, vars) {
    const pack = COMM_I18N[locale] || COMM_I18N.en;
    let text = pack[key] ?? COMM_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
