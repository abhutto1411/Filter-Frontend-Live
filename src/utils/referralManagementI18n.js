/** Referral Management / Marketing Wallet UI copy — keyed by portal locale (`en` | `ar`). */
const REF_MGT_I18N = {
  en: {
    'wallet.label': 'Marketing Wallet',
    'wallet.totalFunded': 'Total Funded: {amount}',
    'wallet.totalSpent': 'Total Spent: {amount}',
    'wallet.requestTopup': 'Request Budget Top-up',
    'wallet.currencySar': 'SAR',
    'format.sar': '{amount} SAR',

    'requests.title': 'Budget Requests',
    'requests.loading': 'Loading requests...',
    'requests.empty': 'No budget requests yet',

    'tx.title': 'Transaction History',
    'tx.loading': 'Loading transactions...',
    'tx.empty': 'No transactions yet',
    'tx.fallbackTitle': 'Wallet Transaction',

    'err.loadRequests': 'Failed to load budget requests.',
    'err.loadTransactions': 'Failed to load transactions.',
    'err.loadWallet': 'Failed to load marketing wallet.',

    'dash': '—',

    'status.pending': 'Pending',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.completed': 'Completed',
    'status.cancelled': 'Cancelled',

    'form.title': 'Request Budget Top-up',
    'form.subtitle':
      'Submit a wallet top-up request. Balance updates only after Super Admin approval.',
    'form.back': 'Back to Marketing Wallet',
    'form.amount': 'Amount (SAR)',
    'form.purpose': 'Purpose',
    'form.purposePlaceholder': 'e.g. Meta ads campaign budget',
    'form.sourceAccount': 'Source Cash Account',
    'form.loadingAccounts': 'Loading accounts...',
    'form.selectAccount': 'Select account...',
    'form.noAccounts':
      'No cash/bank accounts found. Add account from accounting module first.',
    'form.note':
      'This request will be sent to Super Admin Approvals. Wallet balance will update only after approval.',
    'form.cancel': 'Cancel',
    'form.submitting': 'Submitting...',
    'form.submit': 'Submit Request',
    'form.fallbackAccount': 'Account',

    'alert.amountInvalid': 'Enter valid amount.',
    'alert.purposeRequired': 'Purpose is required.',
    'alert.selectAccount': 'Select source cash account.',
    'alert.success':
      'Budget top-up request has been sent to Super Admin Approvals.',
    'err.loadAccounts': 'Failed to load cash accounts.',
    'err.submit': 'Failed to submit budget request.',
  },
  ar: {
    'wallet.label': 'محفظة التسويق',
    'wallet.totalFunded': 'إجمالي التمويل: {amount}',
    'wallet.totalSpent': 'إجمالي الإنفاق: {amount}',
    'wallet.requestTopup': 'طلب شحن الميزانية',
    'wallet.currencySar': 'ر.س',
    'format.sar': '{amount} ر.س',

    'requests.title': 'طلبات الميزانية',
    'requests.loading': 'جاري تحميل الطلبات...',
    'requests.empty': 'لا توجد طلبات ميزانية بعد',

    'tx.title': 'سجل المعاملات',
    'tx.loading': 'جاري تحميل المعاملات...',
    'tx.empty': 'لا توجد معاملات بعد',
    'tx.fallbackTitle': 'معاملة المحفظة',

    'err.loadRequests': 'تعذّر تحميل طلبات الميزانية.',
    'err.loadTransactions': 'تعذّر تحميل المعاملات.',
    'err.loadWallet': 'تعذّر تحميل محفظة التسويق.',

    'dash': '—',

    'status.pending': 'قيد الانتظار',
    'status.approved': 'موافق عليه',
    'status.rejected': 'مرفوض',
    'status.completed': 'مكتمل',
    'status.cancelled': 'ملغى',

    'form.title': 'طلب شحن الميزانية',
    'form.subtitle':
      'قدّم طلب شحن للمحفظة. يتم تحديث الرصيد فقط بعد موافقة المشرف العام.',
    'form.back': 'العودة إلى محفظة التسويق',
    'form.amount': 'المبلغ (ر.س)',
    'form.purpose': 'الغرض',
    'form.purposePlaceholder': 'مثال: ميزانية حملة إعلانات ميتا',
    'form.sourceAccount': 'حساب النقدية المصدر',
    'form.loadingAccounts': 'جاري تحميل الحسابات...',
    'form.selectAccount': 'اختر حساباً...',
    'form.noAccounts':
      'لم يتم العثور على حسابات نقدية/بنكية. أضف حساباً من وحدة المحاسبة أولاً.',
    'form.note':
      'سيُرسل هذا الطلب إلى موافقات المشرف العام. يتم تحديث رصيد المحفظة فقط بعد الموافقة.',
    'form.cancel': 'إلغاء',
    'form.submitting': 'جاري الإرسال...',
    'form.submit': 'إرسال الطلب',
    'form.fallbackAccount': 'حساب',

    'alert.amountInvalid': 'أدخل مبلغاً صالحاً.',
    'alert.purposeRequired': 'الغرض مطلوب.',
    'alert.selectAccount': 'اختر حساب النقدية المصدر.',
    'alert.success':
      'تم إرسال طلب شحن الميزانية إلى موافقات المشرف العام.',
    'err.loadAccounts': 'تعذّر تحميل الحسابات النقدية.',
    'err.submit': 'تعذّر إرسال طلب الميزانية.',
  },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function refMgtT(locale, key, vars) {
  const pack = REF_MGT_I18N[locale] || REF_MGT_I18N.en;
  let text = pack[key] ?? REF_MGT_I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} status
 */
export function refMgtStatusLabel(locale, status) {
  const value = String(status || 'pending')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const key = `status.${value}`;
  const label = refMgtT(locale, key);
  return label === key ? refMgtT(locale, 'status.pending') : label;
}
