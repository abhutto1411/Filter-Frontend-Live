/** Super Admin Mobile App Menu UI copy — keyed by portal locale (`en` | `ar`). */
const MAM_I18N = {
    en: {
        'page.title': 'Mobile App Menu',
        'page.subtitle':
            'Control which portals appear on the Flutter app home screen (ALL Apps). Only toggled-on portals are visible to users.',
        'btn.create': 'Create Portal',
        'btn.save': 'Save menu',
        'btn.cancel': 'Cancel',
        'btn.createSubmit': 'Create',
        'summary.visible': '{enabled} of {total} portal(s) visible in the app',
        'badge.builtIn': 'Built-in',
        'toggle.visible': 'Visible',
        'toggle.hidden': 'Hidden',
        'toggle.aria': 'Toggle {title}',
        'loading.aria': 'Loading mobile app menu',
        'modal.title': 'Create Portal',
        'modal.close': 'Close',
        'label.key': 'Key (slug)',
        'label.titleEn': 'Title (English)',
        'label.titleAr': 'Title (Arabic)',
        'label.showInApp': 'Show in mobile app',
        'ph.key': 'e.g. corporate_portal',
        'ph.titleEn': 'Corporate Portal',
        'ph.titleAr': 'بوابة الشركات',
        'key.patternTitle': 'Lowercase letters, numbers, and underscores only',
        'err.load': 'Failed to load mobile app menu',
        'err.save': 'Failed to save',
        'err.create': 'Failed to create portal',
        'ok.saved': 'Saved — mobile app will show only enabled portals.',
        'ok.created': 'Portal created successfully.',
    },
    ar: {
        'page.title': 'قائمة تطبيق الجوال',
        'page.subtitle':
            'التحكم في البوابات التي تظهر على الشاشة الرئيسية لتطبيق Flutter (كل التطبيقات). تظهر للمستخدمين فقط البوابات المفعّلة.',
        'btn.create': 'إنشاء بوابة',
        'btn.save': 'حفظ القائمة',
        'btn.cancel': 'إلغاء',
        'btn.createSubmit': 'إنشاء',
        'summary.visible': '{enabled} من {total} بوابة ظاهرة في التطبيق',
        'badge.builtIn': 'مدمجة',
        'toggle.visible': 'ظاهرة',
        'toggle.hidden': 'مخفية',
        'toggle.aria': 'تبديل {title}',
        'loading.aria': 'جاري تحميل قائمة تطبيق الجوال',
        'modal.title': 'إنشاء بوابة',
        'modal.close': 'إغلاق',
        'label.key': 'المفتاح (slug)',
        'label.titleEn': 'العنوان (الإنجليزية)',
        'label.titleAr': 'العنوان (العربية)',
        'label.showInApp': 'إظهار في تطبيق الجوال',
        'ph.key': 'مثال: corporate_portal',
        'ph.titleEn': 'Corporate Portal',
        'ph.titleAr': 'بوابة الشركات',
        'key.patternTitle': 'أحرف إنجليزية صغيرة وأرقام وشرطات سفلية فقط',
        'err.load': 'تعذّر تحميل قائمة تطبيق الجوال',
        'err.save': 'تعذّر الحفظ',
        'err.create': 'تعذّر إنشاء البوابة',
        'ok.saved': 'تم الحفظ — سيظهر التطبيق فقط البوابات المفعّلة.',
        'ok.created': 'تم إنشاء البوابة بنجاح.',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function mamT(locale, key, vars) {
    const pack = MAM_I18N[locale] || MAM_I18N.en;
    let text = pack[key] ?? MAM_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
