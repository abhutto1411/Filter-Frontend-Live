/** Supplier portal — Staff & Roles. Locale: `en` | `ar` (MSA). */
const SEMP_I18N = {
    en: {
        'title': 'Staff & Roles',
        'subtitle': 'Supplier & Warehouse Portal',

        'btn.add': 'Add Employee / Worker',
        'btn.cancel': 'Cancel',
        'btn.saving': 'Saving…',
        'btn.saveChanges': 'Save changes',
        'btn.addEmployee': 'Add Employee',
        'btn.edit': 'Edit',
        'btn.markBusy': 'Mark busy',
        'btn.markAvailable': 'Mark available',

        'kpi.warehouse': 'WAREHOUSE INCHARGE',
        'kpi.order': 'ORDER PROCESSOR',
        'kpi.driver': 'DRIVER',
        'kpi.accountant': 'ACCOUNTANT',
        'kpi.supervisor': 'SUPERVISOR',

        'error.couldNotLoad': 'Could not load staff:',
        'error.supplierScope': 'Supplier scope:',
        'error.noSupplierId':
            'Supplier ID not found in login session. Please login again as supplier.',
        'error.unauthorized': 'Unauthorized (401). Please sign in again.',
        'error.load': 'Failed to load staff',
        'error.namePhone': 'Enter full name and mobile number.',
        'error.selectRole': 'Select a role.',
        'error.missingSupplierId': 'Supplier ID missing. Please re-login.',
        'error.save': 'Could not save employee',
        'error.duty': 'Could not update duty status',
        'error.inactiveDuty': 'Inactive employees cannot change duty status.',

        'toast.updated': 'Employee updated.',
        'toast.added': 'Employee added.',
        'toast.busy': 'Marked busy.',
        'toast.available': 'Marked available.',

        'empty.title': 'No employees yet',
        'empty.body': 'Add your first warehouse or office worker using the button above.',

        'th.name': 'Name',
        'th.role': 'Role',
        'th.mobile': 'Mobile',
        'th.vehicle': 'Vehicle plate',
        'th.availability': 'Availability',
        'th.status': 'Status',
        'th.created': 'Created',
        'th.actions': 'Actions',

        'status.active': 'active',
        'status.inactive': 'inactive',
        'avail.busy': 'Busy',
        'avail.offline': 'Offline',
        'avail.available': 'Available',

        'action.aria': 'Actions for {name}',
        'fallback.employee': 'employee',

        'modal.editTitle': 'Edit Employee / Worker',
        'modal.addTitle': 'Add Employee / Worker',
        'field.fullName': 'Full Name *',
        'field.fullNamePh': 'Full Name',
        'field.mobile': 'Mobile *',
        'field.mobilePh': '05XXXXXXXX',
        'field.email': 'Email',
        'field.emailPh': 'Email',
        'field.role': 'Role *',
        'field.selectRole': 'Select role',
        'field.salary': 'Basic Salary (SAR)',
        'field.status': 'Status',
        'statusOpt.active': 'Active',
        'statusOpt.inactive': 'Inactive',

        'role.warehouseIncharge': 'Warehouse Incharge',
        'role.orderProcessor': 'Order Processor',
        'role.driver': 'Driver',
        'role.accountant': 'Accountant',
        'role.supervisor': 'Supervisor',
        'role.finance': 'Finance',
        'role.warehouseManager': 'Warehouse Manager',
        'role.pickerPacker': 'Picker / Packer',
        'role.admin': 'Admin',

        'money.sar': 'SAR {amount}',
        'emdash': '—',
    },
    ar: {
        'title': 'الموظفون والأدوار',
        'subtitle': 'بوابة المورد والمستودع',

        'btn.add': 'إضافة موظف / عامل',
        'btn.cancel': 'إلغاء',
        'btn.saving': 'جاري الحفظ…',
        'btn.saveChanges': 'حفظ التغييرات',
        'btn.addEmployee': 'إضافة موظف',
        'btn.edit': 'تعديل',
        'btn.markBusy': 'تعيين مشغول',
        'btn.markAvailable': 'تعيين متاح',

        'kpi.warehouse': 'مسؤول المستودع',
        'kpi.order': 'معالج الطلبات',
        'kpi.driver': 'سائق',
        'kpi.accountant': 'محاسب',
        'kpi.supervisor': 'مشرف',

        'error.couldNotLoad': 'تعذر تحميل الموظفين:',
        'error.supplierScope': 'نطاق المورد:',
        'error.noSupplierId':
            'معرف المورد غير موجود في جلسة الدخول. يرجى تسجيل الدخول مجدداً كمورد.',
        'error.unauthorized': 'غير مصرح (401). يرجى تسجيل الدخول مجدداً.',
        'error.load': 'فشل تحميل الموظفين',
        'error.namePhone': 'أدخل الاسم الكامل ورقم الجوال.',
        'error.selectRole': 'اختر دوراً.',
        'error.missingSupplierId': 'معرف المورد مفقود. يرجى إعادة تسجيل الدخول.',
        'error.save': 'تعذر حفظ الموظف',
        'error.duty': 'تعذر تحديث حالة الواجب',
        'error.inactiveDuty': 'لا يمكن للموظفين غير النشطين تغيير حالة الواجب.',

        'toast.updated': 'تم تحديث الموظف.',
        'toast.added': 'تمت إضافة الموظف.',
        'toast.busy': 'تم تعيينه مشغولاً.',
        'toast.available': 'تم تعيينه متاحاً.',

        'empty.title': 'لا يوجد موظفون بعد',
        'empty.body': 'أضف أول عامل مستودع أو مكتب باستخدام الزر أعلاه.',

        'th.name': 'الاسم',
        'th.role': 'الدور',
        'th.mobile': 'الجوال',
        'th.vehicle': 'لوحة المركبة',
        'th.availability': 'التوافر',
        'th.status': 'الحالة',
        'th.created': 'تاريخ الإنشاء',
        'th.actions': 'الإجراءات',

        'status.active': 'نشط',
        'status.inactive': 'غير نشط',
        'avail.busy': 'مشغول',
        'avail.offline': 'غير متصل',
        'avail.available': 'متاح',

        'action.aria': 'إجراءات {name}',
        'fallback.employee': 'موظف',

        'modal.editTitle': 'تعديل موظف / عامل',
        'modal.addTitle': 'إضافة موظف / عامل',
        'field.fullName': 'الاسم الكامل *',
        'field.fullNamePh': 'الاسم الكامل',
        'field.mobile': 'الجوال *',
        'field.mobilePh': '05XXXXXXXX',
        'field.email': 'البريد الإلكتروني',
        'field.emailPh': 'البريد الإلكتروني',
        'field.role': 'الدور *',
        'field.selectRole': 'اختر الدور',
        'field.salary': 'الراتب الأساسي (ر.س)',
        'field.status': 'الحالة',
        'statusOpt.active': 'نشط',
        'statusOpt.inactive': 'غير نشط',

        'role.warehouseIncharge': 'مسؤول المستودع',
        'role.orderProcessor': 'معالج الطلبات',
        'role.driver': 'سائق',
        'role.accountant': 'محاسب',
        'role.supervisor': 'مشرف',
        'role.finance': 'المالية',
        'role.warehouseManager': 'مدير المستودع',
        'role.pickerPacker': 'ملتقط / معبئ',
        'role.admin': 'مسؤول',

        'money.sar': '{amount} ر.س',
        'emdash': '—',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function sempT(locale, key, vars) {
    const pack = SEMP_I18N[locale] || SEMP_I18N.en;
    let text = pack[key] ?? SEMP_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
