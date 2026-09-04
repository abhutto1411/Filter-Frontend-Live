/** Workshop Non-Affiliated Suppliers UI — keyed by portal locale (`en` | `ar`). */
export const WNAS_I18N = {
    en: {
        'page.title': 'Non-Affiliated Suppliers',

        'btn.refresh': 'Refresh',
        'btn.add': 'Add new non-affiliated supplier',
        'btn.ledger': 'Ledger',
        'btn.edit': 'Edit',
        'btn.cancel': 'Cancel',
        'btn.saving': 'Saving...',
        'btn.update': 'Update',
        'btn.addSupplier': 'Add supplier',

        'stat.total': 'Total:',
        'stat.aggregate': 'Aggregate payable balance:',

        'money.sar': 'SAR {amount}',
        'emdash': '—',

        'th.sno': 'S.No.',
        'th.name': 'Supplier name',
        'th.branch': 'Branch',
        'th.opening': 'Opening',
        'th.finalBalance': 'Final balance (SAR)',
        'th.active': 'Active',

        'loading': 'Loading suppliers...',
        'empty': 'No non-affiliated suppliers yet. Click "Add new non-affiliated supplier" to create one.',

        'toggle.noEditPerm': 'No edit permission',

        'err.load': 'Failed to load suppliers',
        'err.save': 'Failed to save supplier',
        'err.update': 'Failed to update supplier',

        'modal.editTitle': 'Edit Non-Affiliated Supplier',
        'modal.addTitle': 'Add Non-Affiliated Supplier',
        'modal.name': 'Supplier name *',
        'modal.namePlaceholder': 'e.g. Local Trading Co.',
        'modal.branch': 'Branch (optional)',
        'modal.branchNone': '— None (workshop-wide) —',
        'modal.contactPerson': 'Contact person',
        'modal.phone': 'Phone',
        'modal.email': 'Email',
        'modal.vatId': 'VAT ID',
        'modal.crNumber': 'CR Number',
        'modal.address': 'Address',
        'modal.openingBalance': 'Opening balance (SAR)',
        'modal.openingBalancePlaceholder': '0.00',
        'modal.asOfDate': 'As of date',
    },
    ar: {
        'page.title': 'الموردون غير التابعين',

        'btn.refresh': 'تحديث',
        'btn.add': 'إضافة مورد غير تابع جديد',
        'btn.ledger': 'دفتر الأستاذ',
        'btn.edit': 'تعديل',
        'btn.cancel': 'إلغاء',
        'btn.saving': 'جارٍ الحفظ...',
        'btn.update': 'تحديث',
        'btn.addSupplier': 'إضافة مورد',

        'stat.total': 'الإجمالي:',
        'stat.aggregate': 'إجمالي الرصيد المستحق:',

        'money.sar': '{amount} ر.س',
        'emdash': '—',

        'th.sno': 'تسلسل',
        'th.name': 'اسم المورد',
        'th.branch': 'الفرع',
        'th.opening': 'الرصيد الافتتاحي',
        'th.finalBalance': 'الرصيد النهائي (ر.س)',
        'th.active': 'نشط',

        'loading': 'جارٍ تحميل الموردين...',
        'empty': 'لا يوجد موردون غير تابعين بعد. انقر على «إضافة مورد غير تابع جديد» لإنشاء واحد.',

        'toggle.noEditPerm': 'لا توجد صلاحية تعديل',

        'err.load': 'فشل تحميل الموردين',
        'err.save': 'فشل حفظ المورد',
        'err.update': 'فشل تحديث المورد',

        'modal.editTitle': 'تعديل مورد غير تابع',
        'modal.addTitle': 'إضافة مورد غير تابع',
        'modal.name': 'اسم المورد *',
        'modal.namePlaceholder': 'مثال: شركة تجارة محلية',
        'modal.branch': 'الفرع (اختياري)',
        'modal.branchNone': '— بلا (على مستوى الورشة) —',
        'modal.contactPerson': 'شخص الاتصال',
        'modal.phone': 'الهاتف',
        'modal.email': 'البريد الإلكتروني',
        'modal.vatId': 'الرقم الضريبي',
        'modal.crNumber': 'رقم السجل التجاري',
        'modal.address': 'العنوان',
        'modal.openingBalance': 'الرصيد الافتتاحي (ر.س)',
        'modal.openingBalancePlaceholder': '0.00',
        'modal.asOfDate': 'اعتبارًا من تاريخ',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wnasT(locale, key, vars) {
    const pack = WNAS_I18N[locale] || WNAS_I18N.en;
    let text = pack[key] ?? WNAS_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
