/** Loyalty Programs (legacy tier) UI copy — keyed by portal locale (`en` | `ar`). */
const LOY_I18N = {
  en: {
    'money.sar': '{amount} SAR',
    'page.title': 'Loyalty Programs',
    'page.subtitle':
      'Configure points earn/redeem rules and tier discounts. Programs require Super Admin approval.',
    'btn.new': 'New Program',
    'empty.loading': 'Loading loyalty programs...',
    'empty.none': 'No loyalty programs yet',
    'empty.hint': 'Create a program to define points rules and Bronze–Platinum tiers.',
    'err.load': 'Could not load loyalty programs.',
    'err.delete': 'Could not delete loyalty program.',
    'confirm.delete': 'Delete this loyalty program?',
    'msg.deleted': 'Loyalty program deleted.',
    'btn.simulate': 'Simulate',
    'btn.edit': 'Edit',
    'btn.delete': 'Delete',
    'rule.earn': 'Points / SAR spent',
    'rule.redeem': 'Points / SAR discount',
    'rule.minRedeem': 'Min points to redeem',
    'tier.minPoints': '{n} pts',
    'tier.discount': '{n}% off',
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'tier.bronze': 'Bronze',
    'tier.silver': 'Silver',
    'tier.gold': 'Gold',
    'tier.platinum': 'Platinum',
    'sim.title': 'Points simulator',
    'sim.close': 'Close',
    'sim.spend': 'Spend amount (SAR)',
    'sim.existing': 'Existing points',
    'sim.calculate': 'Calculate',
    'sim.calculating': 'Calculating...',
    'sim.pointsEarned': 'Points earned',
    'sim.totalPoints': 'Total points',
    'sim.tier': 'Tier',
    'sim.tierDiscount': 'Tier discount',
    'sim.redeemable': 'Redeemable value',
    'sim.canRedeem': 'Can redeem',
    'sim.yes': 'Yes',
    'sim.no': 'No',
    'sim.next': 'Next tier at {points} points',
    'untitled': 'Untitled Program',

    'form.titleEdit': 'Edit Loyalty Program',
    'form.titleNew': 'New Loyalty Program',
    'form.subtitle':
      'Configure points rules and tiers. Sent to Super Admin for approval before activation.',
    'form.back': 'Back to Loyalty Programs',
    'form.name': 'Program Name *',
    'form.placeholder.name': 'e.g. FILTER Rewards',
    'form.description': 'Description',
    'form.section.points': 'Points Rules',
    'form.pointsPerSar': 'Points earned per SAR spent',
    'form.pointsForDiscount': 'Points needed per SAR discount',
    'form.minRedeem': 'Minimum points to redeem',
    'form.section.tiers': 'Tier Configuration',
    'form.tierTitle': '{name} Tier',
    'form.minPoints': 'Minimum Points',
    'form.discountPct': 'Discount %',
    'form.status': 'Status',
    'form.approvalNote':
      'This program will be sent to Super Admin for approval before activation.',
    'form.cancel': 'Cancel',
    'form.saving': 'Saving...',
    'form.save': 'Save Changes',
    'form.submit': 'Submit for Approval',
    'err.nameRequired': 'Program Name is required.',
    'err.loadOne': 'Could not load loyalty program.',
    'err.save': 'Could not save loyalty program.',
  },
  ar: {
    'money.sar': '{amount} ر.س',
    'page.title': 'برامج الولاء',
    'page.subtitle':
      'اضبط قواعد كسب/استبدال النقاط وخصومات المستويات. تتطلب البرامج موافقة المشرف الأعلى.',
    'btn.new': 'برنامج جديد',
    'empty.loading': 'جارٍ تحميل برامج الولاء...',
    'empty.none': 'لا توجد برامج ولاء بعد',
    'empty.hint': 'أنشئ برنامجاً لتعريف قواعد النقاط ومستويات البرونز–البلاتين.',
    'err.load': 'تعذّر تحميل برامج الولاء.',
    'err.delete': 'تعذّر حذف برنامج الولاء.',
    'confirm.delete': 'حذف برنامج الولاء هذا؟',
    'msg.deleted': 'تم حذف برنامج الولاء.',
    'btn.simulate': 'محاكاة',
    'btn.edit': 'تعديل',
    'btn.delete': 'حذف',
    'rule.earn': 'نقاط / ر.س مصروف',
    'rule.redeem': 'نقاط / ر.س خصم',
    'rule.minRedeem': 'الحد الأدنى للاستبدال',
    'tier.minPoints': '{n} نقطة',
    'tier.discount': 'خصم {n}%',
    'status.active': 'نشط',
    'status.inactive': 'غير نشط',
    'tier.bronze': 'برونزي',
    'tier.silver': 'فضي',
    'tier.gold': 'ذهبي',
    'tier.platinum': 'بلاتيني',
    'sim.title': 'محاكي النقاط',
    'sim.close': 'إغلاق',
    'sim.spend': 'مبلغ الإنفاق (ر.س)',
    'sim.existing': 'النقاط الحالية',
    'sim.calculate': 'احسب',
    'sim.calculating': 'جارٍ الحساب...',
    'sim.pointsEarned': 'النقاط المكتسبة',
    'sim.totalPoints': 'إجمالي النقاط',
    'sim.tier': 'المستوى',
    'sim.tierDiscount': 'خصم المستوى',
    'sim.redeemable': 'القيمة القابلة للاستبدال',
    'sim.canRedeem': 'يمكن الاستبدال',
    'sim.yes': 'نعم',
    'sim.no': 'لا',
    'sim.next': 'المستوى التالي عند {points} نقطة',
    'untitled': 'برنامج بلا عنوان',

    'form.titleEdit': 'تعديل برنامج الولاء',
    'form.titleNew': 'برنامج ولاء جديد',
    'form.subtitle':
      'اضبط قواعد النقاط والمستويات. يُرسل للمشرف الأعلى للموافقة قبل التفعيل.',
    'form.back': 'العودة إلى برامج الولاء',
    'form.name': 'اسم البرنامج *',
    'form.placeholder.name': 'مثال: مكافآت FILTER',
    'form.description': 'الوصف',
    'form.section.points': 'قواعد النقاط',
    'form.pointsPerSar': 'النقاط المكتسبة لكل ر.س مصروف',
    'form.pointsForDiscount': 'النقاط المطلوبة لكل ر.س خصم',
    'form.minRedeem': 'الحد الأدنى من النقاط للاستبدال',
    'form.section.tiers': 'إعداد المستويات',
    'form.tierTitle': 'مستوى {name}',
    'form.minPoints': 'الحد الأدنى للنقاط',
    'form.discountPct': 'نسبة الخصم %',
    'form.status': 'الحالة',
    'form.approvalNote':
      'سيُرسل هذا البرنامج إلى المشرف الأعلى للموافقة قبل التفعيل.',
    'form.cancel': 'إلغاء',
    'form.saving': 'جارٍ الحفظ...',
    'form.save': 'حفظ التغييرات',
    'form.submit': 'إرسال للموافقة',
    'err.nameRequired': 'اسم البرنامج مطلوب.',
    'err.loadOne': 'تعذّر تحميل برنامج الولاء.',
    'err.save': 'تعذّر حفظ برنامج الولاء.',
  },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function loyT(locale, key, vars) {
  const pack = LOY_I18N[locale] || LOY_I18N.en;
  let text = pack[key] ?? LOY_I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} tierKey bronze|silver|gold|platinum
 */
export function loyTierName(locale, tierKey) {
  const key = `tier.${String(tierKey || '').toLowerCase()}`;
  const label = loyT(locale, key);
  return label === key ? String(tierKey || '') : label;
}
