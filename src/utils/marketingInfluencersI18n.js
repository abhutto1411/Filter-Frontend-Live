/** Marketing Influencer Referrers UI copy — keyed by portal locale (`en` | `ar`). */
const MKT_INF_I18N = {
  en: {
    'format.sar': '{amount} SAR',
    'dash': '—',
    'stat.influencers': 'Influencers',
    'stat.commissions': 'Total Commissions',
    'stat.campaigns': 'Active Campaigns w / Influencers',
    'card.title': 'Influencer Referrers',
    'search.placeholder': 'Search...',
    'btn.add': 'Add Influencer',
    'th.name': 'Name',
    'th.platform': 'Platform',
    'th.handle': 'Handle',
    'th.commission': 'Commission',
    'th.rate': 'Rate',
    'th.campaigns': 'Campaigns',
    'th.status': 'Status',
    'th.actions': 'Actions',
    'empty.loading': 'Loading influencer referrers...',
    'empty.none': 'No influencer referrers found',
    'action.edit': 'Edit',
    'action.delete': 'Delete',
    'confirm.delete': 'Delete {name}?',
    'err.load': 'Failed to load influencer referrers.',
    'err.delete': 'Failed to delete influencer referrer.',
    'fallback.name': 'Referrer',

    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.suspended': 'Suspended',
    'status.pending': 'Pending',

    'platform.instagram': 'Instagram',
    'platform.tiktok': 'TikTok',
    'platform.youtube': 'YouTube',
    'platform.snapchat': 'Snapchat',
    'platform.facebook': 'Facebook',
    'platform.x': 'X',
    'platform.blog': 'Blog',
    'platform.offline': 'Offline',
    'platform.other': 'Other',

    'form.titleEdit': 'Edit Influencer',
    'form.titleNew': 'Add Influencer',
    'form.subtitle': 'Manage influencer referrers and commission settings.',
    'form.back': 'Back to Influencer Referrers',
    'form.loading': 'Loading...',
    'form.name': 'Name',
    'form.status': 'Status',
    'form.email': 'Email',
    'form.phone': 'Phone',
    'form.platform': 'Platform',
    'form.handle': 'Handle / Username',
    'form.handlePh': '@username',
    'form.rate': 'Commission Rate (%)',
    'form.campaigns': 'Active Campaigns',
    'form.notes': 'Notes',
    'form.cancel': 'Cancel',
    'form.saving': 'Saving...',
    'form.save': 'Save Influencer',
    'err.notFound': 'Influencer not found.',
    'err.loadOne': 'Failed to load influencer.',
    'err.nameRequired': 'Influencer name is required.',
    'err.save': 'Failed to save influencer referrer.',
  },
  ar: {
    'format.sar': '{amount} ر.س',
    'dash': '—',
    'stat.influencers': 'المؤثرون',
    'stat.commissions': 'إجمالي العمولات',
    'stat.campaigns': 'حملات نشطة مع مؤثرين',
    'card.title': 'المؤثرون المُحيلون',
    'search.placeholder': 'بحث...',
    'btn.add': 'إضافة مؤثر',
    'th.name': 'الاسم',
    'th.platform': 'المنصة',
    'th.handle': 'المعرّف',
    'th.commission': 'العمولة',
    'th.rate': 'النسبة',
    'th.campaigns': 'الحملات',
    'th.status': 'الحالة',
    'th.actions': 'الإجراءات',
    'empty.loading': 'جارٍ تحميل المؤثرين المُحيلين...',
    'empty.none': 'لا يوجد مؤثرون مُحيلون',
    'action.edit': 'تعديل',
    'action.delete': 'حذف',
    'confirm.delete': 'حذف {name}؟',
    'err.load': 'تعذّر تحميل المؤثرين المُحيلين.',
    'err.delete': 'تعذّر حذف المؤثر المُحيل.',
    'fallback.name': 'مُحيل',

    'status.active': 'نشط',
    'status.inactive': 'غير نشط',
    'status.suspended': 'موقوف',
    'status.pending': 'قيد الانتظار',

    'platform.instagram': 'إنستغرام',
    'platform.tiktok': 'تيك توك',
    'platform.youtube': 'يوتيوب',
    'platform.snapchat': 'سناب شات',
    'platform.facebook': 'فيسبوك',
    'platform.x': 'إكس',
    'platform.blog': 'مدونة',
    'platform.offline': 'غير إلكتروني',
    'platform.other': 'أخرى',

    'form.titleEdit': 'تعديل مؤثر',
    'form.titleNew': 'إضافة مؤثر',
    'form.subtitle': 'إدارة المؤثرين المُحيلين وإعدادات العمولة.',
    'form.back': 'العودة إلى المؤثرين المُحيلين',
    'form.loading': 'جارٍ التحميل...',
    'form.name': 'الاسم',
    'form.status': 'الحالة',
    'form.email': 'البريد الإلكتروني',
    'form.phone': 'الهاتف',
    'form.platform': 'المنصة',
    'form.handle': 'المعرّف / اسم المستخدم',
    'form.handlePh': '@username',
    'form.rate': 'نسبة العمولة (%)',
    'form.campaigns': 'الحملات النشطة',
    'form.notes': 'ملاحظات',
    'form.cancel': 'إلغاء',
    'form.saving': 'جارٍ الحفظ...',
    'form.save': 'حفظ المؤثر',
    'err.notFound': 'المؤثر غير موجود.',
    'err.loadOne': 'تعذّر تحميل المؤثر.',
    'err.nameRequired': 'اسم المؤثر مطلوب.',
    'err.save': 'تعذّر حفظ المؤثر المُحيل.',
  },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function mktInfT(locale, key, vars) {
  const pack = MKT_INF_I18N[locale] || MKT_INF_I18N.en;
  let text = pack[key] ?? MKT_INF_I18N.en[key] ?? key;
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
export function mktInfStatusLabel(locale, status) {
  const value = String(status || 'active').trim().toLowerCase();
  const key = `status.${value}`;
  const label = mktInfT(locale, key);
  return label === key ? mktInfT(locale, 'status.active') : label;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} platform
 */
export function mktInfPlatformLabel(locale, platform) {
  const value = String(platform || 'other').trim().toLowerCase();
  const key = `platform.${value}`;
  const label = mktInfT(locale, key);
  return label === key ? mktInfT(locale, 'platform.other') : label;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {number|string} value
 */
export function mktInfFormatSar(locale, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return mktInfT(locale, 'format.sar', { amount: '0' });
  }
  return mktInfT(locale, 'format.sar', {
    amount: n.toLocaleString(locale === 'ar' ? 'ar-SA' : undefined, {
      maximumFractionDigits: 0,
    }),
  });
}
