/** Workshop Branches & Access Control UI — keyed by portal locale (`en` | `ar`). */
export const WBR_I18N = {
    en: {
        'page.title': 'Branches & Access Control',
        'page.subtitle': 'Manage branch portals and grant Branch Admin permissions',
        'page.subtitleFiltered': ' · filtered to one branch',

        'tab.branches': 'Branch Portals',
        'tab.access': 'Access Permissions',

        'btn.refresh': 'Refresh',
        'btn.refreshing': 'Refreshing...',
        'btn.grantAccess': 'Grant Access',
        'btn.newBranch': 'New Branch',
        'btn.creating': 'Creating...',
        'btn.cancel': 'Cancel',
        'btn.edit': 'Edit',
        'btn.setAccess': 'Set Access',
        'btn.updateBranch': 'Update Branch',
        'btn.createBranch': 'Create Branch',
        'btn.updating': 'Updating...',
        'btn.grantBranchAccess': 'Grant Branch Access',

        'form.editTitle': 'Edit Branch',
        'form.newTitle': 'New Branch Portal',
        'form.intro.before': 'Each branch gets its own ',
        'form.intro.portal': 'Branch Portal',
        'form.intro.mid': ' and ',
        'form.intro.pos': 'POS',
        'form.intro.after':
            '. ZATCA seller identity (VAT, CR, address, EGS) is stored on the branch.',
        'form.branchName': 'Branch Name *',
        'form.branchNamePh': 'e.g. Riyadh Main Branch',
        'form.branchCode': 'Branch Code',
        'form.branchCodePh': 'e.g. RYD-001',
        'form.status': 'Status',
        'form.phone': 'Phone',
        'form.phonePh': '+966...',
        'form.email': 'Email',
        'form.gpsLat': 'GPS Latitude',
        'form.gpsLng': 'GPS Longitude',
        'form.gpsLatPh': 'e.g. 24.7136',
        'form.gpsLngPh': 'e.g. 46.6753',
        'form.contactPerson': 'Contact Person',
        'form.zatcaSection': 'ZATCA / tax identity',
        'form.vatId': 'VAT ID *',
        'form.vatIdPh': '15-digit VAT (3…3)',
        'form.crNumber': 'CR Number *',
        'form.crNumberPh': 'Commercial registration',
        'form.egsSerial': 'EGS Serial *',
        'form.egsSerialPh': '1-Filter|2-EGS|3-device-id',
        'form.egsHelp.before': 'Device serial for ZATCA CSR. Example: ',
        'form.address': 'Address *',
        'form.addressPh': 'Street, district, city',

        'status.active': 'Active',
        'status.inactive': 'Inactive',

        'access.title': 'Grant Branch Admin Access',
        'access.branch': 'Branch *',
        'access.selectBranch': 'Select branch',
        'access.noApproved':
            'No approved branches yet. Super admin must approve a branch before you can assign branch admin access here.',
        'access.adminName': 'Admin Name',
        'access.adminEmail': 'Admin Email',
        'access.adminNamePh': 'Full name',
        'access.adminEmailPh': 'admin@branch.com',
        'access.permittedSections': 'Permitted Sections',
        'access.desc': 'Branch Admin: {name} ({email}) — {branch}',

        'perm.pos': 'POS / Sales',
        'perm.employees': 'Employee Management',
        'perm.departments': 'Dept & Products',
        'perm.approvals': 'Approvals Queue',
        'perm.suppliers': 'Suppliers & Purchases',
        'perm.reports': 'Reports & Analytics',

        'badge.pendingApproval': 'Pending approval',
        'tip.pendingApproval':
            'Super admin must approve this branch before it is fully active.',
        'tip.portalActive': 'Branch portal is active',
        'tip.portalInactive': 'Branch portal is inactive',
        'note.pending':
            'Awaiting super admin approval. Cashiers and technicians require an approved branch.',
        'employees.count': '{count} employees',
        'admin.set': 'Admin set',
        'admin.none': 'No admin',

        'empty.noBranches': 'No branches yet. Create your first branch portal.',
        'empty.noMatch': 'No branch matches the current sidebar filter.',
        'empty.noAccess': 'No branch admin access configured yet.',

        'th.branch': 'Branch',
        'th.permittedSections': 'Permitted Sections',
        'th.description': 'Description',

        'err.invalidResponse': 'Invalid branches response.',
        'err.loadFailed': 'Failed to load branches.',
        'err.updateStatus': 'Failed to update branch status.',
        'err.nameRequired': 'Branch name is required.',
        'err.updateFailed': 'Failed to update branch.',
        'err.createFailed': 'Failed to create branch.',

        'fallback.branch': 'Branch',
        'emdash': '—',
    },
    ar: {
        'page.title': 'الفروع والتحكم بالوصول',
        'page.subtitle': 'إدارة بوابات الفروع ومنح صلاحيات مسؤول الفرع',
        'page.subtitleFiltered': ' · مُصفّى لفرع واحد',

        'tab.branches': 'بوابات الفروع',
        'tab.access': 'صلاحيات الوصول',

        'btn.refresh': 'تحديث',
        'btn.refreshing': 'جاري التحديث...',
        'btn.grantAccess': 'منح الوصول',
        'btn.newBranch': 'فرع جديد',
        'btn.creating': 'جاري الإنشاء...',
        'btn.cancel': 'إلغاء',
        'btn.edit': 'تعديل',
        'btn.setAccess': 'تعيين الوصول',
        'btn.updateBranch': 'تحديث الفرع',
        'btn.createBranch': 'إنشاء فرع',
        'btn.updating': 'جاري التحديث...',
        'btn.grantBranchAccess': 'منح وصول الفرع',

        'form.editTitle': 'تعديل الفرع',
        'form.newTitle': 'بوابة فرع جديدة',
        'form.intro.before': 'يحصل كل فرع على ',
        'form.intro.portal': 'بوابة فرع',
        'form.intro.mid': ' و',
        'form.intro.pos': 'نقطة بيع',
        'form.intro.after':
            ' خاصة به. تُخزَّن هوية البائع لدى زاتكا (الرقم الضريبي، السجل التجاري، العنوان، والجهاز الإلكتروني) على الفرع.',
        'form.branchName': 'اسم الفرع *',
        'form.branchNamePh': 'مثال: فرع الرياض الرئيسي',
        'form.branchCode': 'رمز الفرع',
        'form.branchCodePh': 'مثال: RYD-001',
        'form.status': 'الحالة',
        'form.phone': 'الهاتف',
        'form.phonePh': '+966...',
        'form.email': 'البريد الإلكتروني',
        'form.gpsLat': 'خط العرض GPS',
        'form.gpsLng': 'خط الطول GPS',
        'form.gpsLatPh': 'مثال: 24.7136',
        'form.gpsLngPh': 'مثال: 46.6753',
        'form.contactPerson': 'شخص التواصل',
        'form.zatcaSection': 'هوية زاتكا / الضريبة',
        'form.vatId': 'الرقم الضريبي *',
        'form.vatIdPh': 'رقم ضريبي من 15 خانة (3…3)',
        'form.crNumber': 'رقم السجل التجاري *',
        'form.crNumberPh': 'السجل التجاري',
        'form.egsSerial': 'الرقم التسلسلي لـ EGS *',
        'form.egsSerialPh': '1-Filter|2-EGS|3-device-id',
        'form.egsHelp.before': 'الرقم التسلسلي للجهاز لشهادة زاتكا CSR. مثال: ',
        'form.address': 'العنوان *',
        'form.addressPh': 'الشارع، الحي، المدينة',

        'status.active': 'نشط',
        'status.inactive': 'غير نشط',

        'access.title': 'منح وصول مسؤول الفرع',
        'access.branch': 'الفرع *',
        'access.selectBranch': 'اختر الفرع',
        'access.noApproved':
            'لا توجد فروع معتمدة بعد. يجب أن يعتمد المسؤول الأعلى الفرع قبل أن تتمكن من تعيين وصول مسؤول الفرع هنا.',
        'access.adminName': 'اسم المسؤول',
        'access.adminEmail': 'بريد المسؤول',
        'access.adminNamePh': 'الاسم الكامل',
        'access.adminEmailPh': 'admin@branch.com',
        'access.permittedSections': 'الأقسام المسموح بها',
        'access.desc': 'مسؤول الفرع: {name} ({email}) — {branch}',

        'perm.pos': 'نقاط البيع / المبيعات',
        'perm.employees': 'إدارة الموظفين',
        'perm.departments': 'الأقسام والمنتجات',
        'perm.approvals': 'قائمة الاعتمادات',
        'perm.suppliers': 'الموردون والمشتريات',
        'perm.reports': 'التقارير والتحليلات',

        'badge.pendingApproval': 'بانتظار الاعتماد',
        'tip.pendingApproval':
            'يجب أن يعتمد المسؤول الأعلى هذا الفرع قبل أن يصبح نشطاً بالكامل.',
        'tip.portalActive': 'بوابة الفرع نشطة',
        'tip.portalInactive': 'بوابة الفرع غير نشطة',
        'note.pending':
            'بانتظار اعتماد المسؤول الأعلى. يحتاج أمناء الصندوق والفنيون إلى فرع معتمد.',
        'employees.count': '{count} موظفون',
        'admin.set': 'تم تعيين مسؤول',
        'admin.none': 'لا يوجد مسؤول',

        'empty.noBranches': 'لا توجد فروع بعد. أنشئ بوابة فرعك الأولى.',
        'empty.noMatch': 'لا يوجد فرع يطابق عامل التصفية الحالي في الشريط الجانبي.',
        'empty.noAccess': 'لم يُهيأ وصول مسؤول فرع بعد.',

        'th.branch': 'الفرع',
        'th.permittedSections': 'الأقسام المسموح بها',
        'th.description': 'الوصف',

        'err.invalidResponse': 'استجابة فروع غير صالحة.',
        'err.loadFailed': 'فشل تحميل الفروع.',
        'err.updateStatus': 'فشل تحديث حالة الفرع.',
        'err.nameRequired': 'اسم الفرع مطلوب.',
        'err.updateFailed': 'فشل تحديث الفرع.',
        'err.createFailed': 'فشل إنشاء الفرع.',

        'fallback.branch': 'فرع',
        'emdash': '—',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wbrT(locale, key, vars) {
    const pack = WBR_I18N[locale] || WBR_I18N.en;
    let text = pack[key] ?? WBR_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
