/** Promo Codes UI copy — keyed by portal locale (`en` | `ar`). */
const PROMO_CODES_I18N = {
  en: {
    'page.title': 'Promo Codes',
    'page.subtitle':
      'Generate and validate promo codes — codes appear on POS and invoices',
    'btn.generate': 'Generate Code',
    'search.placeholder': 'Search by code or promotion...',
    'empty.loading': 'Loading promo codes...',
    'empty.none': 'No promo codes yet',
    'err.load': 'Could not load promo codes.',
    'msg.copied': 'Code "{value}" copied.',
    'err.copy': 'Could not copy code',
    'confirm.delete': 'Are you sure you want to delete this promo code?',
    'msg.deleted': 'Promo code deleted.',
    'err.delete': 'Could not delete promo code.',
    'msg.activated': 'Promo code is active and available on POS.',
    'msg.deactivated': 'Promo code is inactive and will not apply on POS.',
    'err.activation': 'Could not update promo code activation.',
    'label.standalone': 'Standalone code',
    'label.value': 'Value:',
    'label.allWorkshops': 'All workshops',
    'label.allBranches': 'All branches',
    'label.oneWorkshop': '1 workshop',
    'label.nWorkshops': '{n} workshops',
    'label.nBranches': '{n} branches',
    'btn.autoReport': 'Auto Report',
    'date.noEnd': 'No end date',
    'date.ends': 'Ends {date} ({days}d)',
    'stat.usage': 'Usage',
    'stat.discountGiven': 'Discount given',
    'stat.revenue': 'Revenue',
    'activation.posStatus': 'POS status',
    'activation.hint.pending':
      'Waiting for Super Admin approval before POS use.',
    'activation.hint.rejected': 'Rejected promo codes cannot be activated.',
    'activation.hint.expired': 'Expired promo codes cannot be activated.',
    'activation.hint.active':
      'Available on POS when customers apply this code.',
    'activation.hint.inactive':
      'Disabled — will not apply on POS invoices.',
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.expired': 'Expired',
    'status.pending_approval': 'Pending Approval',
    'status.rejected': 'Rejected',
    'discount.percentage': 'Percentage (%)',
    'discount.fixed': 'Fixed Amount (SAR)',
    'usage.unlimited': '{used} (unlimited)',
    'usage.limited': '{used} / {max}',
    'money.sar': '{amount} SAR',
    'btn.view': 'View',
    'btn.report': 'Report',
    'btn.edit': 'Edit',
    'btn.copy': 'Copy',
    'btn.delete': 'Delete',
  },
  ar: {
    'page.title': 'أكواد الخصم',
    'page.subtitle':
      'أنشئ وأدر أكواد الخصم — تظهر على نقطة البيع والفواتير',
    'btn.generate': 'إنشاء كود',
    'search.placeholder': 'البحث بالكود أو العرض...',
    'empty.loading': 'جارٍ تحميل أكواد الخصم...',
    'empty.none': 'لا توجد أكواد خصم بعد',
    'err.load': 'تعذّر تحميل أكواد الخصم.',
    'msg.copied': 'تم نسخ الكود "{value}".',
    'err.copy': 'تعذّر نسخ الكود',
    'confirm.delete': 'هل أنت متأكد من حذف كود الخصم هذا؟',
    'msg.deleted': 'تم حذف كود الخصم.',
    'err.delete': 'تعذّر حذف كود الخصم.',
    'msg.activated': 'كود الخصم نشط ومتاح في نقطة البيع.',
    'msg.deactivated': 'كود الخصم غير نشط ولن يُطبَّق في نقطة البيع.',
    'err.activation': 'تعذّر تحديث تفعيل كود الخصم.',
    'label.standalone': 'كود مستقل',
    'label.value': 'القيمة:',
    'label.allWorkshops': 'جميع الورش',
    'label.allBranches': 'جميع الفروع',
    'label.oneWorkshop': 'ورشة واحدة',
    'label.nWorkshops': '{n} ورش',
    'label.nBranches': '{n} فروع',
    'btn.autoReport': 'تقرير تلقائي',
    'date.noEnd': 'بلا تاريخ انتهاء',
    'date.ends': 'ينتهي {date} ({days}ي)',
    'stat.usage': 'الاستخدام',
    'stat.discountGiven': 'الخصم الممنوح',
    'stat.revenue': 'الإيرادات',
    'activation.posStatus': 'حالة نقطة البيع',
    'activation.hint.pending':
      'بانتظار موافقة المشرف الأعلى قبل الاستخدام في نقطة البيع.',
    'activation.hint.rejected': 'لا يمكن تفعيل أكواد الخصم المرفوضة.',
    'activation.hint.expired': 'لا يمكن تفعيل أكواد الخصم المنتهية.',
    'activation.hint.active':
      'متاح في نقطة البيع عند تطبيق العملاء لهذا الكود.',
    'activation.hint.inactive':
      'معطّل — لن يُطبَّق على فواتير نقطة البيع.',
    'status.active': 'نشط',
    'status.inactive': 'غير نشط',
    'status.expired': 'منتهٍ',
    'status.pending_approval': 'بانتظار الموافقة',
    'status.rejected': 'مرفوض',
    'discount.percentage': 'نسبة مئوية (%)',
    'discount.fixed': 'مبلغ ثابت (ر.س)',
    'usage.unlimited': '{used} (غير محدود)',
    'usage.limited': '{used} / {max}',
    'money.sar': '{amount} ر.س',
    'btn.view': 'عرض',
    'btn.report': 'تقرير',
    'btn.edit': 'تعديل',
    'btn.copy': 'نسخ',
    'btn.delete': 'حذف',
  },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function promoT(locale, key, vars) {
  const pack = PROMO_CODES_I18N[locale] || PROMO_CODES_I18N.en;
  let text = pack[key] ?? PROMO_CODES_I18N.en[key] ?? key;
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
export function promoStatusLabel(locale, status) {
  const value = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const key = `status.${value}`;
  const label = promoT(locale, key);
  return label === key ? String(status || '') : label;
}
