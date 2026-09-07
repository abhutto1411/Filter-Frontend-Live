/** Marketing Expenses UI copy — keyed by portal locale (`en` | `ar`). */
const MKT_EXP_I18N = {
  en: {
    'search.placeholder': 'Search expenses...',
    'btn.newExpense': 'New Expense',
    'err.loadList': 'Failed to load expenses.',
    'th.expenseNumber': 'Expense #',
    'th.campaign': 'Campaign',
    'th.category': 'Category',
    'th.vendor': 'Vendor',
    'th.amount': 'Amount',
    'th.date': 'Date',
    'th.status': 'Status',
    'th.actions': 'Actions',
    'empty.loading': 'Loading expenses...',
    'empty.none': 'No expenses found',
    'action.edit': 'Edit',
    'dash': '—',

    'form.titleEdit': 'Edit Marketing Expense',
    'form.titleNew': 'New Marketing Expense',
    'form.subtitle':
      'Record a marketing spend and send it through Super Admin approval.',
    'form.back': 'Back to Expenses',
    'err.notFound': 'Expense not found.',
    'err.load': 'Failed to load expense.',
    'err.categoryRequired': 'Please select an expense category.',
    'err.amountInvalid': 'Enter a valid amount greater than zero.',
    'err.dateRequired': 'Expense date is required.',
    'err.save': 'Failed to save expense.',
    'loading.expense': 'Loading expense...',
    'banner.title': 'Approval workflow',
    'banner.body':
      'Submitting sends this expense to Super Admin Approvals. After approval, finance can pay it from the same queue — that posts to HQ Chart of Accounts and debits the marketing wallet.',
    'section.details': 'Expense details',
    'label.category': 'Category',
    'hint.category': 'Type of marketing spend (ads, events, tools, etc.)',
    'label.vendor': 'Vendor name',
    'placeholder.vendor': 'e.g. Meta, Google Ads, agency name',
    'label.description': 'Description',
    'placeholder.description': 'Briefly describe what this expense covers...',
    'section.amountDate': 'Amount & date',
    'label.amount': 'Amount',
    'label.date': 'Expense date',
    'section.optional': 'Optional links',
    'label.campaign': 'Linked campaign',
    'placeholder.campaignLoading': 'Loading campaigns...',
    'placeholder.campaign': 'Select campaign (optional)',
    'hint.campaign': 'Tie spend to a campaign for budget tracking and reports',
    'label.receiptUrl': 'Receipt URL',
    'placeholder.receiptUrl': 'https://drive.google.com/... or invoice link',
    'label.notes': 'Notes for approvers',
    'placeholder.notes': 'Any context Super Admin should see when reviewing...',
    'btn.cancel': 'Cancel',
    'btn.submitting': 'Submitting...',
    'btn.save': 'Save changes',
    'btn.submit': 'Submit for approval',

    'category.social_media_ads': 'Social Media Ads',
    'category.influencer_payment': 'Influencer Payment',
    'category.seo': 'Seo',
    'category.content_creation': 'Content Creation',
    'category.offline_marketing': 'Offline Marketing',
    'category.events': 'Events',
    'category.tools_software': 'Tools Software',
    'category.other': 'Other',

    'status.draft': 'Draft',
    'status.pending_approval': 'Pending Approval',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.paid': 'Paid',

    'campaign.untitled': 'Untitled Campaign',
  },
  ar: {
    'search.placeholder': 'البحث في المصروفات...',
    'btn.newExpense': 'مصروف جديد',
    'err.loadList': 'تعذّر تحميل المصروفات.',
    'th.expenseNumber': 'رقم المصروف',
    'th.campaign': 'الحملة',
    'th.category': 'الفئة',
    'th.vendor': 'المورّد',
    'th.amount': 'المبلغ',
    'th.date': 'التاريخ',
    'th.status': 'الحالة',
    'th.actions': 'الإجراءات',
    'empty.loading': 'جارٍ تحميل المصروفات...',
    'empty.none': 'لا توجد مصروفات',
    'action.edit': 'تعديل',
    'dash': '—',

    'form.titleEdit': 'تعديل مصروف تسويقي',
    'form.titleNew': 'مصروف تسويقي جديد',
    'form.subtitle': 'سجّل إنفاقاً تسويقياً وأرسله لاعتماد المشرف الأعلى.',
    'form.back': 'العودة إلى المصروفات',
    'err.notFound': 'المصروف غير موجود.',
    'err.load': 'تعذّر تحميل المصروف.',
    'err.categoryRequired': 'يرجى اختيار فئة المصروف.',
    'err.amountInvalid': 'أدخل مبلغاً صالحاً أكبر من صفر.',
    'err.dateRequired': 'تاريخ المصروف مطلوب.',
    'err.save': 'تعذّر حفظ المصروف.',
    'loading.expense': 'جارٍ تحميل المصروف...',
    'banner.title': 'سير عمل الاعتماد',
    'banner.body':
      'عند الإرسال يُحوَّل هذا المصروف إلى اعتمادات المشرف الأعلى. بعد الاعتماد يمكن للمالية دفعه من نفس قائمة الانتظار — فيُقيَّد في دليل حسابات المركز ويُخصم من محفظة التسويق.',
    'section.details': 'تفاصيل المصروف',
    'label.category': 'الفئة',
    'hint.category': 'نوع الإنفاق التسويقي (إعلانات، فعاليات، أدوات، إلخ)',
    'label.vendor': 'اسم المورّد',
    'placeholder.vendor': 'مثال: Meta، Google Ads، اسم الوكالة',
    'label.description': 'الوصف',
    'placeholder.description': 'صف باختصار ما يغطيه هذا المصروف...',
    'section.amountDate': 'المبلغ والتاريخ',
    'label.amount': 'المبلغ',
    'label.date': 'تاريخ المصروف',
    'section.optional': 'روابط اختيارية',
    'label.campaign': 'الحملة المرتبطة',
    'placeholder.campaignLoading': 'جارٍ تحميل الحملات...',
    'placeholder.campaign': 'اختر حملة (اختياري)',
    'hint.campaign': 'اربط الإنفاق بحملة لتتبع الميزانية والتقارير',
    'label.receiptUrl': 'رابط الإيصال',
    'placeholder.receiptUrl': 'https://drive.google.com/... أو رابط الفاتورة',
    'label.notes': 'ملاحظات للمعتمدين',
    'placeholder.notes': 'أي سياق يجب أن يراه المشرف الأعلى عند المراجعة...',
    'btn.cancel': 'إلغاء',
    'btn.submitting': 'جارٍ الإرسال...',
    'btn.save': 'حفظ التغييرات',
    'btn.submit': 'إرسال للاعتماد',

    'category.social_media_ads': 'إعلانات وسائل التواصل',
    'category.influencer_payment': 'دفع المؤثرين',
    'category.seo': 'تحسين محركات البحث',
    'category.content_creation': 'إنشاء المحتوى',
    'category.offline_marketing': 'التسويق غير الإلكتروني',
    'category.events': 'الفعاليات',
    'category.tools_software': 'الأدوات والبرمجيات',
    'category.other': 'أخرى',

    'status.draft': 'مسودة',
    'status.pending_approval': 'بانتظار الاعتماد',
    'status.approved': 'معتمد',
    'status.rejected': 'مرفوض',
    'status.paid': 'مدفوع',

    'campaign.untitled': 'حملة بدون عنوان',
  },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function mktExpT(locale, key, vars) {
  const pack = MKT_EXP_I18N[locale] || MKT_EXP_I18N.en;
  let text = pack[key] ?? MKT_EXP_I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} category
 */
export function mktExpCategoryLabel(locale, category) {
  const key = `category.${String(category || 'other').trim().toLowerCase()}`;
  const label = mktExpT(locale, key);
  return label === key ? mktExpT(locale, 'category.other') : label;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} status
 */
export function mktExpStatusLabel(locale, status) {
  const value = String(status || 'pending_approval').trim().toLowerCase();
  const key = `status.${value}`;
  const label = mktExpT(locale, key);
  return label === key ? mktExpT(locale, 'status.pending_approval') : label;
}
