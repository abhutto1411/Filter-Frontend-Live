/** Workshop Affiliated Suppliers UI — keyed by portal locale (`en` | `ar`). */
export const WAS_I18N = {
    en: {
        'emdash': '—',
        'money.sar': 'SAR {amount}',

        'page.title': 'Filter Affiliated Suppliers',

        'stat.totalSuppliers': 'Total suppliers:',
        'stat.aggregateBalance': 'Aggregate payable balance:',

        'btn.refresh': 'Refresh',
        'btn.addNew': 'Add new supplier',
        'btn.cancel': 'Cancel',
        'btn.adding': 'Adding...',
        'btn.addCount': 'Add {count} supplier(s)',
        'btn.openLedger': 'Open ledger',
        'btn.adjust': 'Adjust',
        'coa.adjust.title': 'Adjust',
        'coa.adjust.desc': 'Post a signed +/− payable journal. Pick the contra account. + increases what the workshop owes.',
        'coa.adjust.current': 'Current payable',
        'coa.adjust.preview': 'After adjust',
        'coa.adjust.amount': 'Amount (+/−)',
        'coa.adjust.amountPh': 'e.g. 1440 or -1440',
        'coa.adjust.date': 'Date',
        'coa.adjust.contra': 'Contra account',
        'coa.adjust.contraPh': 'Search account…',
        'coa.adjust.contraEmpty': 'No matching accounts',
        'coa.adjust.reason': 'Reason',
        'coa.adjust.reasonPh': 'Why is this balance changing?',
        'coa.adjust.cancel': 'Cancel',
        'coa.adjust.submit': 'Post adjustment',
        'coa.adjust.submitting': 'Posting…',
        'coa.adjust.err.amount': 'Enter a non-zero amount.',
        'coa.adjust.err.contra': 'Select a contra account.',
        'coa.adjust.err.reason': 'Reason is required.',
        'coa.adjust.err.failed': 'Could not post the adjustment.',

        'err.loadRegistered': 'Failed to load registered suppliers',
        'err.pickOne': 'Pick at least one supplier from the list',
        'err.add': 'Failed to add suppliers',
        'err.loadList': 'Failed to load suppliers',
        'err.update': 'Failed to update supplier',
        'err.noEditPerm': 'No edit permission',

        'modal.title': 'Add Affiliated Supplier(s)',
        'modal.defaultBranch': 'Default branch',
        'modal.branchNone': '— None (workshop-wide) —',
        'modal.searchLabel': 'Search registered suppliers',
        'modal.searchPlaceholder': 'Name, phone, email, VAT, CR...',
        'modal.showingPrefix': 'Showing',
        'modal.showingOf': 'of {total} registered',
        'modal.bulletLinked': '• {count} already linked',
        'modal.bulletSelected': '• {count} selected',
        'modal.hideLinked': 'Hide already linked',
        'modal.loading': 'Loading registered suppliers...',
        'modal.emptyNone': 'No suppliers are registered with the platform yet. Ask the super-admin to register suppliers first.',
        'modal.emptyFilter': 'No registered suppliers match your filter.',
        'modal.selectAllTitle': 'Select all visible',
        'modal.th.supplier': 'Supplier',
        'modal.th.mobile': 'Mobile',
        'modal.th.vatId': 'VAT ID',
        'modal.th.openingBalance': 'Opening balance (SAR)',
        'modal.th.asOfDate': 'As of date',
        'modal.badge.linked': 'Already linked',
        'modal.badge.inactive': 'Inactive',
        'modal.placeholder.balance': '0.00',

        'th.sno': 'S.No.',
        'th.supplierName': 'Supplier name',
        'th.branch': 'Branch',
        'th.opening': 'Opening',
        'th.finalBalance': 'Final balance (SAR)',
        'th.active': 'Active',
        'th.statement': 'Statement',

        'loading.list': 'Loading suppliers...',
        'empty.list': 'No affiliated suppliers yet. Click "Add new supplier" to link one.',
    },
    ar: {
        'emdash': '—',
        'money.sar': '{amount} ر.س',

        'page.title': 'الموردون التابعون عبر Filter',

        'stat.totalSuppliers': 'إجمالي الموردين:',
        'stat.aggregateBalance': 'إجمالي الرصيد المستحق:',

        'btn.refresh': 'تحديث',
        'btn.addNew': 'إضافة مورد جديد',
        'btn.cancel': 'إلغاء',
        'btn.adding': 'جاري الإضافة...',
        'btn.addCount': 'إضافة {count} من الموردين',
        'btn.openLedger': 'فتح دفتر الحساب',
        'btn.adjust': 'تسوية',
        'coa.adjust.title': 'تسوية',
        'coa.adjust.desc': 'ترحيل قيد مستحقات بعلامة +/−. اختر الحساب المقابل. + يزيد ما تدين به الورشة.',
        'coa.adjust.current': 'المستحق الحالي',
        'coa.adjust.preview': 'بعد التسوية',
        'coa.adjust.amount': 'المبلغ (+/−)',
        'coa.adjust.amountPh': 'مثال: 1440 أو -1440',
        'coa.adjust.date': 'التاريخ',
        'coa.adjust.contra': 'الحساب المقابل',
        'coa.adjust.contraPh': 'ابحث عن حساب…',
        'coa.adjust.contraEmpty': 'لا توجد حسابات مطابقة',
        'coa.adjust.reason': 'السبب',
        'coa.adjust.reasonPh': 'لماذا يتغير هذا الرصيد؟',
        'coa.adjust.cancel': 'إلغاء',
        'coa.adjust.submit': 'ترحيل التسوية',
        'coa.adjust.submitting': 'جارٍ الترحيل…',
        'coa.adjust.err.amount': 'أدخل مبلغاً غير صفر.',
        'coa.adjust.err.contra': 'اختر الحساب المقابل.',
        'coa.adjust.err.reason': 'السبب مطلوب.',
        'coa.adjust.err.failed': 'تعذّر ترحيل التسوية.',

        'err.loadRegistered': 'تعذّر تحميل الموردين المسجّلين',
        'err.pickOne': 'اختر مورداً واحداً على الأقل من القائمة',
        'err.add': 'تعذّر إضافة الموردين',
        'err.loadList': 'تعذّر تحميل الموردين',
        'err.update': 'تعذّر تحديث المورد',
        'err.noEditPerm': 'لا توجد صلاحية تعديل',

        'modal.title': 'إضافة مورد(ين) تابع(ين)',
        'modal.defaultBranch': 'الفرع الافتراضي',
        'modal.branchNone': '— لا يوجد (على مستوى الورشة) —',
        'modal.searchLabel': 'البحث في الموردين المسجّلين',
        'modal.searchPlaceholder': 'الاسم، الهاتف، البريد، الضريبة، السجل...',
        'modal.showingPrefix': 'عرض',
        'modal.showingOf': 'من أصل {total} مسجّل',
        'modal.bulletLinked': '• {count} مرتبط مسبقاً',
        'modal.bulletSelected': '• {count} محدّد',
        'modal.hideLinked': 'إخفاء المرتبطين مسبقاً',
        'modal.loading': 'جاري تحميل الموردين المسجّلين...',
        'modal.emptyNone': 'لا يوجد موردون مسجّلون في المنصة بعد. اطلب من المسؤول الأعلى تسجيل الموردين أولاً.',
        'modal.emptyFilter': 'لا يوجد موردون مسجّلون يطابقون عامل التصفية.',
        'modal.selectAllTitle': 'تحديد الكل الظاهر',
        'modal.th.supplier': 'المورد',
        'modal.th.mobile': 'الجوال',
        'modal.th.vatId': 'الرقم الضريبي',
        'modal.th.openingBalance': 'الرصيد الافتتاحي (ر.س)',
        'modal.th.asOfDate': 'اعتباراً من',
        'modal.badge.linked': 'مرتبط مسبقاً',
        'modal.badge.inactive': 'غير نشط',
        'modal.placeholder.balance': '0.00',

        'th.sno': 'ت.',
        'th.supplierName': 'اسم المورد',
        'th.branch': 'الفرع',
        'th.opening': 'الافتتاحي',
        'th.finalBalance': 'الرصيد النهائي (ر.س)',
        'th.active': 'نشط',
        'th.statement': 'كشف الحساب',

        'loading.list': 'جاري تحميل الموردين...',
        'empty.list': 'لا يوجد موردون تابعون بعد. انقر على "إضافة مورد جديد" لربط أحدهم.',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wasT(locale, key, vars) {
    const pack = WAS_I18N[locale] || WAS_I18N.en;
    let text = pack[key] ?? WAS_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
