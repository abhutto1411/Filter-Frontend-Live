/** Super Admin Legal Pages UI copy — keyed by portal locale (`en` | `ar`). */
const LP_I18N = {
    en: {
        'page.title': 'Legal Pages',
        'page.subtitle':
            'Manage public legal pages for Play Store and app store listings. Privacy Policy and Terms are editable; Account Deletion is a fixed page.',
        'tab.privacy': 'Privacy Policy',
        'tab.terms': 'Terms & Conditions',
        'tab.accountDeletion': 'Account Deletion',
        'public.label': 'Public URL',
        'public.draft': 'Draft — publish to make this URL visible publicly.',
        'public.staticBadge': 'Static — always live',
        'btn.copy': 'Copy link',
        'btn.copied': 'Copied',
        'btn.save': 'Save {label}',
        'btn.preview': 'Preview {label}',
        'loading': 'Loading…',
        'published': 'Published (visible on public URL)',
        'label.titleEn': 'Title (English)',
        'label.titleAr': 'Title (Arabic)',
        'label.bodyEn': 'Content (English)',
        'label.bodyAr': 'Content (Arabic)',
        'ph.titleEn': 'Privacy Policy',
        'ph.titleAr': 'سياسة الخصوصية',
        'ph.bodyEn':
            'Write your privacy policy or terms here. Basic HTML is supported (e.g. <p>, <ul>, <strong>).',
        'ph.bodyAr': 'اكتب المحتوى بالعربية. يدعم HTML البسيط.',
        'updated': 'Last updated: {date}',
        'static.title': 'Fixed Play Store page',
        'static.lead':
            'This page cannot be edited here. Use the public link above for Play Store and store listings.',
        'static.p1':
            'Content is built into the app and follows Google Play account deletion requirements.',
        'static.p2': 'Always published — no draft or save needed.',
        'static.p3':
            'Covers in-app deletion steps, email requests, deleted vs retained data, and processing time.',
        'static.p4': 'Available in English and Arabic on the public URL.',
        'err.load': 'Failed to load legal page',
        'err.save': 'Failed to save',
        'err.copy': 'Could not copy link',
        'ok.saved': 'Saved successfully',
    },
    ar: {
        'page.title': 'الصفحات القانونية',
        'page.subtitle':
            'إدارة الصفحات القانونية العامة لمتجر Play ومتاجر التطبيقات. سياسة الخصوصية والشروط قابلة للتعديل؛ حذف الحساب صفحة ثابتة.',
        'tab.privacy': 'سياسة الخصوصية',
        'tab.terms': 'الشروط والأحكام',
        'tab.accountDeletion': 'حذف الحساب',
        'public.label': 'الرابط العام',
        'public.draft': 'مسودة — انشر الصفحة ليظهر هذا الرابط للعامة.',
        'public.staticBadge': 'ثابتة — دائماً منشورة',
        'btn.copy': 'نسخ الرابط',
        'btn.copied': 'تم النسخ',
        'btn.save': 'حفظ {label}',
        'btn.preview': 'معاينة {label}',
        'loading': 'جاري التحميل…',
        'published': 'منشورة (ظاهرة على الرابط العام)',
        'label.titleEn': 'العنوان (الإنجليزية)',
        'label.titleAr': 'العنوان (العربية)',
        'label.bodyEn': 'المحتوى (الإنجليزية)',
        'label.bodyAr': 'المحتوى (العربية)',
        'ph.titleEn': 'Privacy Policy',
        'ph.titleAr': 'سياسة الخصوصية',
        'ph.bodyEn':
            'Write your privacy policy or terms here. Basic HTML is supported (e.g. <p>, <ul>, <strong>).',
        'ph.bodyAr': 'اكتب المحتوى بالعربية. يدعم HTML البسيط.',
        'updated': 'آخر تحديث: {date}',
        'static.title': 'صفحة ثابتة لمتجر Play',
        'static.lead':
            'لا يمكن تعديل هذه الصفحة من هنا. استخدم الرابط العام أعلاه لمتجر Play وقوائم المتاجر.',
        'static.p1':
            'المحتوى مدمج في التطبيق ويتوافق مع متطلبات حذف الحساب في Google Play.',
        'static.p2': 'منشورة دائماً — لا حاجة لمسودة أو حفظ.',
        'static.p3':
            'تغطي خطوات الحذف داخل التطبيق، وطلبات البريد، والبيانات المحذوفة مقابل المحتفظ بها، ومدة المعالجة.',
        'static.p4': 'متاحة بالإنجليزية والعربية على الرابط العام.',
        'err.load': 'تعذّر تحميل الصفحة القانونية',
        'err.save': 'تعذّر الحفظ',
        'err.copy': 'تعذّر نسخ الرابط',
        'ok.saved': 'تم الحفظ بنجاح',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function lpT(locale, key, vars) {
    const pack = LP_I18N[locale] || LP_I18N.en;
    let text = pack[key] ?? LP_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}

export const LP_TAB_DEFS = [
    { slug: 'privacy-policy', labelKey: 'tab.privacy', publicPath: '/privacy-policy' },
    { slug: 'terms-and-conditions', labelKey: 'tab.terms', publicPath: '/terms-and-conditions' },
    {
        slug: 'account-deletion',
        labelKey: 'tab.accountDeletion',
        publicPath: '/account-deletion',
        static: true,
    },
];
