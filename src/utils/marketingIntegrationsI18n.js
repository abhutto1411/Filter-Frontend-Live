/** Marketing Integrations UI copy — keyed by portal locale (`en` | `ar`). */
const MKT_INT_I18N = {
  en: {
    'title': 'Integrations & API Keys',
    'subtitle':
      'Add your API keys and credentials here. They are encrypted, applied instantly (no restart), and never shown again.',
    'btn.saveAll': 'Save All',
    'btn.saving': 'Saving...',
    'btn.test': 'Save & Test',
    'btn.testing': 'Testing...',
    'banner.aiActive': 'AI engine active via {provider}. AI reports and the optimizer are enabled.',
    'banner.aiInactive':
      'AI engine not configured yet. Add an OpenAI or Anthropic key below and click Save.',
    'loading': 'Loading integrations...',
    'badge.configured': 'Configured',
    'badge.notSet': 'Not set',
    'tag.secret': 'secret',
    'tag.fromEnv': 'from env',
    'tag.saved': 'saved',
    'ph.enterValue': 'Enter value',
    'hint.secretSaved':
      'A key is saved. Leave blank to keep it, type to replace, or clear & save to remove.',
    'msg.saved': 'Saved & applied {n} setting(s). Changes are live immediately.',
    'err.load': 'Failed to load integrations.',
    'err.save': 'Failed to save integrations.',
    'test.llmOk': 'Connected to {provider}. Test reply: "{sample}"',
    'test.platformOk': '{label} credentials are configured.',
    'test.providerFallback': 'Provider',
    'test.sampleOk': 'OK',
    'test.failed': 'Test failed.',

    'label.pending': '{n} unsaved',
    'notice.dismiss': 'Dismiss',
    'empty.none': 'No integrations are offered yet.',
    'ph.masked': 'Saved — ends in {last4}',
    'ph.MARKETING_LLM_PROVIDER': 'openai or anthropic (optional, auto-detected)',
    'hint.changedBy': 'Last changed by {name}, {when}.',
    'hint.changedAt': 'Last changed {when}.',

    'grp.llm.title': 'AI Engine (LLM)',
    'grp.llm.desc': 'Powers the AI campaign report and the budget optimizer. Add ONE provider key to enable AI analysis.',
    'grp.meta.title': 'Meta Ads (Facebook / Instagram)',
    'grp.meta.desc': 'OAuth credentials for connecting Meta ad accounts.',
    'grp.google_ads.title': 'Google Ads',
    'grp.google_ads.desc': 'OAuth credentials for connecting Google Ads accounts.',
    'grp.tiktok.title': 'TikTok Ads',
    'grp.tiktok.desc': 'OAuth credentials for connecting TikTok ad accounts.',
    'grp.snapchat.title': 'Snapchat Ads',
    'grp.snapchat.desc': 'OAuth credentials for connecting Snapchat ad accounts.',

    'fld.MARKETING_LLM_PROVIDER': 'Preferred Provider',
    'fld.OPENAI_API_KEY': 'OpenAI API Key',
    'fld.OPENAI_MODEL': 'OpenAI Model',
    'fld.ANTHROPIC_API_KEY': 'Anthropic API Key',
    'fld.ANTHROPIC_MODEL': 'Anthropic Model',
    'fld.META_APP_ID': 'Meta App ID',
    'fld.META_APP_SECRET': 'Meta App Secret',
    'fld.GOOGLE_ADS_CLIENT_ID': 'Client ID',
    'fld.GOOGLE_ADS_CLIENT_SECRET': 'Client Secret',
    'fld.TIKTOK_APP_ID': 'App ID',
    'fld.TIKTOK_APP_SECRET': 'App Secret',
    'fld.SNAPCHAT_CLIENT_ID': 'Client ID',
    'fld.SNAPCHAT_CLIENT_SECRET': 'Client Secret',
  },
  ar: {
    'title': 'التكاملات ومفاتيح واجهة البرمجة',
    'subtitle':
      'أضف مفاتيح وبيانات الاعتماد هنا. تُشفَّر وتُطبَّق فوراً (دون إعادة تشغيل) ولا تُعرض مرة أخرى.',
    'btn.saveAll': 'حفظ الكل',
    'btn.saving': 'جارٍ الحفظ...',
    'btn.test': 'حفظ واختبار',
    'btn.testing': 'جارٍ الاختبار...',
    'banner.aiActive': 'محرك الذكاء الاصطناعي نشط عبر {provider}. تقارير ومُحسّن الذكاء الاصطناعي مفعّلة.',
    'banner.aiInactive':
      'محرك الذكاء الاصطناعي غير مُهيأ بعد. أضف مفتاح OpenAI أو Anthropic أدناه ثم احفظ.',
    'loading': 'جارٍ تحميل التكاملات...',
    'badge.configured': 'مُهيأ',
    'badge.notSet': 'غير مضبوط',
    'tag.secret': 'سرّي',
    'tag.fromEnv': 'من البيئة',
    'tag.saved': 'محفوظ',
    'ph.enterValue': 'أدخل القيمة',
    'hint.secretSaved':
      'يوجد مفتاح محفوظ. اتركه فارغاً للإبقاء، أو اكتب للاستبدال، أو امسحه واحفظ للإزالة.',
    'msg.saved': 'تم حفظ وتطبيق {n} إعداد(ات). التغييرات فورية.',
    'err.load': 'تعذّر تحميل التكاملات.',
    'err.save': 'تعذّر حفظ التكاملات.',
    'test.llmOk': 'تم الاتصال بـ {provider}. رد الاختبار: "{sample}"',
    'test.platformOk': 'بيانات اعتماد {label} مُهيأة.',
    'test.providerFallback': 'المزوّد',
    'test.sampleOk': 'موافق',
    'test.failed': 'فشل الاختبار.',

    'label.pending': '{n} غير محفوظ',
    'notice.dismiss': 'إخفاء',
    'empty.none': 'لا توجد تكاملات متاحة بعد.',
    'ph.masked': 'محفوظ — ينتهي بـ {last4}',
    'ph.MARKETING_LLM_PROVIDER': 'openai أو anthropic (اختياري، يُكتشف تلقائياً)',
    'hint.changedBy': 'آخر تغيير بواسطة {name}، {when}.',
    'hint.changedAt': 'آخر تغيير {when}.',

    'grp.llm.title': 'محرك الذكاء الاصطناعي (LLM)',
    'grp.llm.desc': 'يُشغل تقرير الحملات بالذكاء الاصطناعي ومحسن الميزانية. أضف مفتاح مزود واحد لتفعيل التحليل.',
    'grp.meta.title': 'إعلانات ميتا (فيسبوك / انستغرام)',
    'grp.meta.desc': 'بيانات اعتماد OAuth لربط حسابات إعلانات ميتا.',
    'grp.google_ads.title': 'إعلانات جوجل',
    'grp.google_ads.desc': 'بيانات اعتماد OAuth لربط حسابات إعلانات جوجل.',
    'grp.tiktok.title': 'إعلانات تيك توك',
    'grp.tiktok.desc': 'بيانات اعتماد OAuth لربط حسابات إعلانات تيك توك.',
    'grp.snapchat.title': 'إعلانات سناب شات',
    'grp.snapchat.desc': 'بيانات اعتماد OAuth لربط حسابات إعلانات سناب شات.',

    'fld.MARKETING_LLM_PROVIDER': 'المزود المفضل',
    'fld.OPENAI_API_KEY': 'مفتاح OpenAI',
    'fld.OPENAI_MODEL': 'موديل OpenAI',
    'fld.ANTHROPIC_API_KEY': 'مفتاح Anthropic',
    'fld.ANTHROPIC_MODEL': 'موديل Anthropic',
    'fld.META_APP_ID': 'معرف تطبيق ميتا',
    'fld.META_APP_SECRET': 'سر تطبيق ميتا',
    'fld.GOOGLE_ADS_CLIENT_ID': 'معرف العميل',
    'fld.GOOGLE_ADS_CLIENT_SECRET': 'سر العميل',
    'fld.TIKTOK_APP_ID': 'معرف التطبيق',
    'fld.TIKTOK_APP_SECRET': 'سر التطبيق',
    'fld.SNAPCHAT_CLIENT_ID': 'معرف العميل',
    'fld.SNAPCHAT_CLIENT_SECRET': 'سر العميل',
  },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function mktIntT(locale, key, vars) {
  const pack = MKT_INT_I18N[locale] || MKT_INT_I18N.en;
  let text = pack[key] ?? MKT_INT_I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
