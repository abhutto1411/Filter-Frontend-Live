/** Supplier portal Settings (business details) — EN / AR */
export const SS_I18N = {
    en: {
        'page.breadcrumb': 'Settings › Business details',
        'page.title': 'Business details',
        'page.subtitle':
            'These details appear on the header of your sales quotes, invoices, returns, purchases, debit notes, and other business documents.',
        'field.name': 'Name',
        'field.address': 'Address',
        'field.country': 'Country',
        'field.tax': 'Tax information',
        'field.vatLabel': 'VAT number',
        'field.image': 'Image',
        'field.imageHint': 'PNG, JPG or WEBP. Shown on document headers.',
        'field.imageRemove': 'Remove image',
        'field.imageChoose': 'Choose image',
        'ph.name': 'Legal business name',
        'ph.address': 'Street, district, city…',
        'ph.country': 'Country',
        'ph.vat': 'Tax / VAT registration number',
        'btn.update': 'Update',
        'btn.reset': 'Reset',
        'btn.saving': 'Saving…',
        'err.load': 'Failed to load business details.',
        'err.save': 'Failed to save business details.',
        'err.imageType': 'Please choose a PNG, JPG, or WEBP image.',
        'err.imageSize': 'Image must be 1.5 MB or smaller.',
        'success.saved': 'Business details updated. Documents will use the new header.',
    },
    ar: {
        'page.breadcrumb': 'الإعدادات › بيانات المنشأة',
        'page.title': 'بيانات المنشأة',
        'page.subtitle':
            'تظهر هذه البيانات في ترويسة عروض الأسعار والفواتير والمرتجعات والمشتريات وإشعارات المدين وباقي مستندات العمل.',
        'field.name': 'الاسم',
        'field.address': 'العنوان',
        'field.country': 'الدولة',
        'field.tax': 'البيانات الضريبية',
        'field.vatLabel': 'الرقم الضريبي',
        'field.image': 'الصورة',
        'field.imageHint': 'PNG أو JPG أو WEBP. تظهر في ترويسة المستندات.',
        'field.imageRemove': 'إزالة الصورة',
        'field.imageChoose': 'اختيار صورة',
        'ph.name': 'الاسم القانوني للمنشأة',
        'ph.address': 'الشارع، الحي، المدينة…',
        'ph.country': 'الدولة',
        'ph.vat': 'الرقم الضريبي / رقم التسجيل',
        'btn.update': 'تحديث',
        'btn.reset': 'إعادة تعيين',
        'btn.saving': 'جارٍ الحفظ…',
        'err.load': 'فشل تحميل بيانات المنشأة.',
        'err.save': 'فشل حفظ بيانات المنشأة.',
        'err.imageType': 'اختر صورة PNG أو JPG أو WEBP.',
        'err.imageSize': 'يجب ألا يتجاوز حجم الصورة 1.5 ميغابايت.',
        'success.saved': 'تم تحديث بيانات المنشأة. ستستخدم المستندات الترويسة الجديدة.',
    },
};

export function ssT(locale, key, vars) {
    const pack = SS_I18N[locale] || SS_I18N.en;
    let s = pack[key] ?? SS_I18N.en[key] ?? key;
    if (vars && typeof vars === 'object') {
        Object.entries(vars).forEach(([k, v]) => {
            s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? ''));
        });
    }
    return s;
}
