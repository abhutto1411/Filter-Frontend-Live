/** Workshop Corporate Management UI — keyed by portal locale (`en` | `ar`). */
export const WCORP_I18N = {
    en: {
        'page.title': 'Corporate Management',
        'page.subtitleBefore': 'Corporate customers linked to your workshop ·',

        'branch.all': 'All branches',
        'branch.fallback': 'Branch',

        'btn.register': 'Register corporate',
        'btn.refresh': 'Refresh',
        'btn.refreshing': 'Refreshing...',
        'btn.cancel': 'Cancel',
        'btn.saveChanges': 'Save Changes',
        'btn.saving': 'Saving...',
        'btn.edit': 'Edit',
        'btn.addUser': 'Add user',
        'btn.createUser': 'Create user',
        'btn.creating': 'Creating...',
        'btn.submitApproval': 'Submit for approval',
        'btn.submitting': 'Submitting...',

        'kpi.total': 'Total Corporate Customers',
        'kpi.badge': 'CORP',

        'th.company': 'Company',
        'th.contact': 'Contact',
        'th.mobile': 'Mobile',
        'th.vat': 'VAT',
        'th.creditLimit': 'Credit Limit',
        'th.dueBalance': 'Due Balance',
        'th.branches': 'Branches',
        'th.status': 'Status',
        'th.actions': 'Actions',

        'empty.none': 'No corporate customers found',
        'emdash': '—',
        'money.sar': 'SAR {amount}',

        'err.load': 'Failed to load corporate customers.',
        'err.save': 'Failed to save.',
        'err.noChanges': 'No changes to save.',
        'err.register': 'Registration failed.',
        'err.createUser': 'Failed to create user.',
        'err.requiredRegister': 'Company, contact, mobile, email, and password are required.',
        'err.passwordLen': 'Password must be at least 8 characters.',
        'err.selectBranch': 'Select at least one branch to link this corporate account.',
        'err.requiredUser': 'Name, email, and password are required.',

        'status.active': 'Active',
        'status.pending': 'Pending',
        'status.rejected': 'Rejected',
        'status.unknown': 'unknown',

        'title.editPending': 'Edit after super admin approval',
        'title.addUserPending': 'Available after super admin approves registration',

        'edit.title': 'Edit Corporate Account',
        'edit.hint': 'Update the details below. Only changed fields will be sent.',
        'edit.companyName': 'Company Name',
        'edit.customerName': 'Customer Name',
        'edit.mobile': 'Mobile',
        'edit.taxId': 'Tax ID (VAT)',
        'edit.crNumber': 'CR number',
        'edit.status': 'Status',
        'edit.selectBranches': 'Select Branches',
        'edit.selectedCount': '{count} selected',
        'edit.noBranches': 'No branches loaded. Refresh the page or add branches first.',

        'register.title': 'Register corporate customer',
        'register.subtitle': 'Signup request for super-admin approval — link branches in your workshop.',
        'register.back': 'Back to Corporate Management',
        'register.hint':
            'Sends a signup request for super-admin approval. You can link only branches in your workshop here; the administrator can attach additional branches when approving.',
        'register.companyName': 'Company name *',
        'register.contactPerson': 'Contact person *',
        'register.mobile': 'Mobile *',
        'register.email': 'Portal email *',
        'register.password': 'Portal password *',
        'register.vat': 'VAT number',
        'register.crNumber': 'CR number',
        'register.referral': 'Referral ID (optional)',
        'register.referralPlaceholder': 'Referral row ID',
        'register.linkedBranches': 'Linked branches *',
        'register.selectedCount': '{count} selected',
        'register.noBranches': 'No branches loaded. Refresh the page or open again after branches load.',

        'addUser.title': 'Add corporate portal user',
        'addUser.accountLabel': 'Account:',
        'addUser.hint': 'Creates a corporate user linked to this corporate account ({id}).',
        'addUser.name': 'Name',
        'addUser.email': 'Email',
        'addUser.password': 'Password',
    },
    ar: {
        'page.title': 'إدارة الشركات',
        'page.subtitleBefore': 'عملاء الشركات المرتبطون بورشتك ·',

        'branch.all': 'جميع الفروع',
        'branch.fallback': 'فرع',

        'btn.register': 'تسجيل شركة',
        'btn.refresh': 'تحديث',
        'btn.refreshing': 'جاري التحديث...',
        'btn.cancel': 'إلغاء',
        'btn.saveChanges': 'حفظ التغييرات',
        'btn.saving': 'جاري الحفظ...',
        'btn.edit': 'تعديل',
        'btn.addUser': 'إضافة مستخدم',
        'btn.createUser': 'إنشاء مستخدم',
        'btn.creating': 'جاري الإنشاء...',
        'btn.submitApproval': 'إرسال للموافقة',
        'btn.submitting': 'جاري الإرسال...',

        'kpi.total': 'إجمالي عملاء الشركات',
        'kpi.badge': 'شركة',

        'th.company': 'الشركة',
        'th.contact': 'جهة الاتصال',
        'th.mobile': 'الجوال',
        'th.vat': 'الضريبة',
        'th.creditLimit': 'حد الائتمان',
        'th.dueBalance': 'الرصيد المستحق',
        'th.branches': 'الفروع',
        'th.status': 'الحالة',
        'th.actions': 'إجراءات',

        'empty.none': 'لا يوجد عملاء شركات',
        'emdash': '—',
        'money.sar': '{amount} ر.س',

        'err.load': 'فشل تحميل عملاء الشركات.',
        'err.save': 'فشل الحفظ.',
        'err.noChanges': 'لا توجد تغييرات للحفظ.',
        'err.register': 'فشل التسجيل.',
        'err.createUser': 'فشل إنشاء المستخدم.',
        'err.requiredRegister': 'اسم الشركة وجهة الاتصال والجوال والبريد وكلمة المرور مطلوبة.',
        'err.passwordLen': 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
        'err.selectBranch': 'اختر فرعًا واحدًا على الأقل لربط حساب الشركة هذا.',
        'err.requiredUser': 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة.',

        'status.active': 'نشط',
        'status.pending': 'قيد الانتظار',
        'status.rejected': 'مرفوض',
        'status.unknown': 'غير معروف',

        'title.editPending': 'التعديل بعد موافقة المسؤول الأعلى',
        'title.addUserPending': 'متاح بعد موافقة المسؤول الأعلى على التسجيل',

        'edit.title': 'تعديل حساب الشركة',
        'edit.hint': 'حدّث التفاصيل أدناه. سيتم إرسال الحقول المتغيرة فقط.',
        'edit.companyName': 'اسم الشركة',
        'edit.customerName': 'اسم العميل',
        'edit.mobile': 'الجوال',
        'edit.taxId': 'الرقم الضريبي (ضريبة القيمة المضافة)',
        'edit.crNumber': 'رقم السجل التجاري',
        'edit.status': 'الحالة',
        'edit.selectBranches': 'اختيار الفروع',
        'edit.selectedCount': '{count} محدد',
        'edit.noBranches': 'لم يتم تحميل الفروع. حدّث الصفحة أو أضف فروعًا أولاً.',

        'register.title': 'تسجيل عميل شركة',
        'register.subtitle': 'طلب تسجيل لموافقة المسؤول الأعلى — اربط الفروع في ورشتك.',
        'register.back': 'العودة إلى إدارة الشركات',
        'register.hint':
            'يرسل طلب تسجيل لموافقة المسؤول الأعلى. يمكنك ربط فروع ورشتك فقط هنا؛ ويمكن للمسؤول إرفاق فروع إضافية عند الموافقة.',
        'register.companyName': 'اسم الشركة *',
        'register.contactPerson': 'جهة الاتصال *',
        'register.mobile': 'الجوال *',
        'register.email': 'بريد البوابة *',
        'register.password': 'كلمة مرور البوابة *',
        'register.vat': 'الرقم الضريبي',
        'register.crNumber': 'رقم السجل التجاري',
        'register.referral': 'معرّف الإحالة (اختياري)',
        'register.referralPlaceholder': 'معرّف صف الإحالة',
        'register.linkedBranches': 'الفروع المرتبطة *',
        'register.selectedCount': '{count} محدد',
        'register.noBranches': 'لم يتم تحميل الفروع. حدّث الصفحة أو افتحها مجددًا بعد تحميل الفروع.',

        'addUser.title': 'إضافة مستخدم بوابة الشركة',
        'addUser.accountLabel': 'الحساب:',
        'addUser.hint': 'ينشئ مستخدم شركة مرتبطًا بحساب الشركة هذا ({id}).',
        'addUser.name': 'الاسم',
        'addUser.email': 'البريد الإلكتروني',
        'addUser.password': 'كلمة المرور',
    },
};

export function wcorpT(locale, key, vars) {
    const pack = WCORP_I18N[locale] || WCORP_I18N.en;
    let text = pack[key] ?? WCORP_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
