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
    'banner.aiActive': 'AI engine active via',
    'banner.aiActiveSuffix': '. AI reports & optimizer are enabled.',
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
    'msg.nothingChanged': 'Nothing changed.',
    'msg.saved': 'Saved & applied {n} setting(s). Changes are live immediately.',
    'err.load': 'Failed to load integrations.',
    'err.save': 'Failed to save integrations.',
    'test.llmOk': 'Connected to {provider}. Test reply: "{sample}"',
    'test.platformOk': '{label} credentials are configured.',
    'test.providerFallback': 'Provider',
    'test.sampleOk': 'OK',
    'test.failed': 'Test failed.',
  },
  ar: {
    'title': 'التكاملات ومفاتيح واجهة البرمجة',
    'subtitle':
      'أضف مفاتيح وبيانات الاعتماد هنا. تُشفَّر وتُطبَّق فوراً (دون إعادة تشغيل) ولا تُعرض مرة أخرى.',
    'btn.saveAll': 'حفظ الكل',
    'btn.saving': 'جارٍ الحفظ...',
    'btn.test': 'حفظ واختبار',
    'btn.testing': 'جارٍ الاختبار...',
    'banner.aiActive': 'محرك الذكاء الاصطناعي نشط عبر',
    'banner.aiActiveSuffix': '. تقارير ومُحسّن الذكاء الاصطناعي مفعّلة.',
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
    'msg.nothingChanged': 'لم يُغيَّر شيء.',
    'msg.saved': 'تم حفظ وتطبيق {n} إعداد(ات). التغييرات فورية.',
    'err.load': 'تعذّر تحميل التكاملات.',
    'err.save': 'تعذّر حفظ التكاملات.',
    'test.llmOk': 'تم الاتصال بـ {provider}. رد الاختبار: "{sample}"',
    'test.platformOk': 'بيانات اعتماد {label} مُهيأة.',
    'test.providerFallback': 'المزوّد',
    'test.sampleOk': 'موافق',
    'test.failed': 'فشل الاختبار.',
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
