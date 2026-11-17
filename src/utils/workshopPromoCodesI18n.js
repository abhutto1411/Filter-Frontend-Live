/** Workshop Promo Codes UI — keyed by portal locale (`en` | `ar`). */
export const WPROMO_I18N = {
    en: {
        'page.title': 'Promo Codes',
        'page.subtitleLead': 'Create and manage promotional codes',

        'branch.all': 'All branches',
        'branch.fallback': 'Branch',
        'branch.one': '1 branch',
        'branch.n': '{count} branches',

        'scope.products.none': 'No products',
        'scope.products.selected': '{count} products',
        'scope.products.all': 'All products',
        'scope.services.none': 'No services',
        'scope.services.selected': '{count} services',
        'scope.services.all': 'All services',

        'emdash': '—',
        'money.sar': 'SAR {amount}',
        'discount.percent': '{value}%',
        'validity.range': '{from} to {to}',
        'usage.limited': '{used} / {limit}',
        'usage.unlimited': '{used} / ∞',

        'kpi.total': 'Total Promo Codes',
        'kpi.active': 'Active',
        'kpi.icon.pc': 'PC',
        'kpi.icon.on': 'ON',

        'btn.refresh': 'Refresh',
        'btn.refreshing': 'Refreshing...',
        'btn.create': 'Create Promo',
        'btn.edit': 'Edit',
        'btn.cancel': 'Cancel',
        'btn.saving': 'Saving...',
        'btn.loadingCatalog': 'Loading catalog...',
        'btn.updatePromo': 'Update Promo',
        'btn.createPromo': 'Create Promo',

        'modal.createTitle': 'Create Promo Code',
        'modal.editTitle': 'Edit Promo — {code}',
        'modal.subtitle': 'Discount rules, branch scope, and catalog eligibility.',
        'modal.back': 'Back to Promo Codes',

        'th.code': 'Code',
        'th.discount': 'Discount',
        'th.branches': 'Branches',
        'th.products': 'Products',
        'th.services': 'Services',
        'th.validity': 'Validity',
        'th.usage': 'Usage',
        'th.minOrder': 'Min Order',
        'th.status': 'Status',
        'th.actions': 'Actions',

        'status.active': 'active',
        'status.inactive': 'inactive',

        'empty': 'No promo codes found',

        'err.invalidResponse': 'Invalid promo codes response.',
        'err.load': 'Failed to load promo codes.',
        'err.codeRequired': 'Promo code is required.',
        'err.update': 'Failed to update promo code.',
        'err.create': 'Failed to create promo code.',

        'err.validate.requiredFields': 'Code, valid from, and valid to are required.',
        'err.validate.selectWorkshop': 'Select at least one workshop, or choose All workshops.',
        'err.validate.selectBranch': 'Select at least one branch, or choose All branches.',
        'err.validate.catalogLoading': 'Catalog is still loading for the selected branch(es). Please wait a moment.',
        'err.validate.selectProduct': 'Select at least one product/category, or change products to All / Does not apply.',
        'err.validate.selectService': 'Select at least one service/category, or change services to All / Does not apply.',
        'err.validate.mustApply': 'Promo must apply to products and/or services.',
        'err.validate.discountValue': 'Discount value must be greater than zero.',
        'err.validate.dateOrder': 'Valid To must be on or after Valid From.',
    },
    ar: {
        'page.title': 'رموز الخصم الترويجية',
        'page.subtitleLead': 'إنشاء وإدارة الرموز الترويجية',

        'branch.all': 'كل الفروع',
        'branch.fallback': 'فرع',
        'branch.one': 'فرع واحد',
        'branch.n': '{count} فروع',

        'scope.products.none': 'لا منتجات',
        'scope.products.selected': '{count} منتجات',
        'scope.products.all': 'كل المنتجات',
        'scope.services.none': 'لا خدمات',
        'scope.services.selected': '{count} خدمات',
        'scope.services.all': 'كل الخدمات',

        'emdash': '—',
        'money.sar': '{amount} ر.س',
        'discount.percent': '{value}%',
        'validity.range': '{from} إلى {to}',
        'usage.limited': '{used} / {limit}',
        'usage.unlimited': '{used} / ∞',

        'kpi.total': 'إجمالي الرموز الترويجية',
        'kpi.active': 'نشط',
        'kpi.icon.pc': 'رمز',
        'kpi.icon.on': 'مفعّل',

        'btn.refresh': 'تحديث',
        'btn.refreshing': 'جاري التحديث...',
        'btn.create': 'إنشاء رمز ترويجي',
        'btn.edit': 'تعديل',
        'btn.cancel': 'إلغاء',
        'btn.saving': 'جاري الحفظ...',
        'btn.loadingCatalog': 'جاري تحميل الكتالوج...',
        'btn.updatePromo': 'تحديث الرمز',
        'btn.createPromo': 'إنشاء الرمز',

        'modal.createTitle': 'إنشاء رمز ترويجي',
        'modal.editTitle': 'تعديل الرمز الترويجي — {code}',
        'modal.subtitle': 'قواعد الخصم ونطاق الفروع وأهلية الكتالوج.',
        'modal.back': 'العودة إلى الرموز الترويجية',

        'th.code': 'الرمز',
        'th.discount': 'الخصم',
        'th.branches': 'الفروع',
        'th.products': 'المنتجات',
        'th.services': 'الخدمات',
        'th.validity': 'الصلاحية',
        'th.usage': 'الاستخدام',
        'th.minOrder': 'الحد الأدنى للطلب',
        'th.status': 'الحالة',
        'th.actions': 'إجراءات',

        'status.active': 'نشط',
        'status.inactive': 'غير نشط',

        'empty': 'لا توجد رموز ترويجية',

        'err.invalidResponse': 'استجابة رموز ترويجية غير صالحة.',
        'err.load': 'تعذّر تحميل الرموز الترويجية.',
        'err.codeRequired': 'رمز الخصم الترويجي مطلوب.',
        'err.update': 'تعذّر تحديث الرمز الترويجي.',
        'err.create': 'تعذّر إنشاء الرمز الترويجي.',

        'err.validate.requiredFields': 'الرمز وتاريخ البداية وتاريخ النهاية مطلوبة.',
        'err.validate.selectWorkshop': 'حدّد ورشة واحدة على الأقل، أو اختر كل الورش.',
        'err.validate.selectBranch': 'حدّد فرعًا واحدًا على الأقل، أو اختر كل الفروع.',
        'err.validate.catalogLoading': 'لا يزال الكتالوج يُحمَّل للفروع المحددة. يُرجى الانتظار قليلًا.',
        'err.validate.selectProduct': 'حدّد منتجًا/فئة واحدة على الأقل، أو غيّر المنتجات إلى الكل / لا ينطبق.',
        'err.validate.selectService': 'حدّد خدمة/فئة واحدة على الأقل، أو غيّر الخدمات إلى الكل / لا ينطبق.',
        'err.validate.mustApply': 'يجب أن ينطبق الرمز الترويجي على المنتجات و/أو الخدمات.',
        'err.validate.discountValue': 'يجب أن تكون قيمة الخصم أكبر من صفر.',
        'err.validate.dateOrder': 'يجب أن يكون تاريخ النهاية في يوم تاريخ البداية أو بعده.',
    },
};

const VALIDATION_MSG_TO_KEY = {
    'Code, valid from, and valid to are required.': 'err.validate.requiredFields',
    'Select at least one workshop, or choose All workshops.': 'err.validate.selectWorkshop',
    'Select at least one branch, or choose All branches.': 'err.validate.selectBranch',
    'Catalog is still loading for the selected branch(es). Please wait a moment.': 'err.validate.catalogLoading',
    'Select at least one product/category, or change products to All / Does not apply.': 'err.validate.selectProduct',
    'Select at least one service/category, or change services to All / Does not apply.': 'err.validate.selectService',
    'Promo must apply to products and/or services.': 'err.validate.mustApply',
    'Discount value must be greater than zero.': 'err.validate.discountValue',
    'Valid To must be on or after Valid From.': 'err.validate.dateOrder',
};

/**
 * Map English validation messages from promoCodeFormUtils to locale strings.
 * @param {'en'|'ar'|string} locale
 * @param {string} message
 */
export function wpromoLocalizeValidation(locale, message) {
    if (!message) return '';
    const key = VALIDATION_MSG_TO_KEY[message];
    return key ? wpromoT(locale, key) : message;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wpromoT(locale, key, vars) {
    const pack = WPROMO_I18N[locale] || WPROMO_I18N.en;
    let text = pack[key] ?? WPROMO_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
