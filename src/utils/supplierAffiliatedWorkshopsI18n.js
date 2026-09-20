/** Supplier Affiliated Workshops UI — keyed by portal locale (`en` | `ar`). */
export const SAW_I18N = {
    en: {
        'money.sar': 'SAR {amount}',
        'money.theyOwe': '{currency} {amount} (they owe you)',
        'money.youOwe': '−{currency} {amount} (you owe them)',
        'money.zero': '{currency} 0.00',
        'emdash': '—',

        'page.title': 'Affiliated Filter workshops',
        'page.sub':
            'Pin specific branches (or a whole workshop when it has no branches). Use Deactivate to soft-hide a row without losing history; Activate to show it again. Click a row to open the full AR statement.',
        'page.sub.deactivate': 'Deactivate',
        'page.sub.activate': 'Activate',
        'page.sub2':
            'The statement is the same AR Affiliated ledger as Accounting → Chart of Accounts: sales invoices, receipts, and payments for that workshop or branch.',
        'page.sub2.coa': 'Accounting → Chart of Accounts',
        'page.sub2.ledger': 'AR statement',
        'page.sub2.workshop': 'workshop',

        'btn.statement': 'Statement',
        'btn.add': 'Add workshops / branches',
        'btn.cancel': 'Cancel',
        'btn.close': 'Close',
        'btn.adding': 'Adding…',
        'btn.addCount': 'Add ({n})',
        'btn.applyRange': 'Apply range',
        'btn.clearFilter': 'Clear filter',
        'btn.coaLedger': 'Chart of Accounts (ledger)',
        'btn.pdf': 'PDF',
        'btn.excel': 'Excel',
        'btn.loading': 'Loading…',

        'th.workshop': 'Workshop',
        'th.branch': 'Branch',
        'th.balance': 'Balance',
        'th.actions': 'Actions',

        'loading': 'Loading…',
        'empty': 'No rows yet — use “Add workshops / branches”.',
        'workshopId': 'Workshop {id}',
        'branchId': 'Branch {id}',
        'inactive': 'INACTIVE',
        'inactive.short': 'inactive',
        'workshopOnly': 'Workshop only (no branches)',
        'toggle.inactive': 'Inactive',
        'toggle.active': 'Active',
        'toggle.titleOn': 'Listed on this page; logs and AR unchanged',
        'toggle.titleOff': 'Soft-hidden; balance and transaction log still reflect real AR',
        'aria.turnOff': 'Turn off listing (inactive)',
        'aria.turnOn': 'Turn on listing (active)',

        'err.load': 'Failed to load list',
        'err.loadWorkshops': 'Failed to load workshops',
        'err.add': 'Could not add selections',
        'err.status': 'Could not update status',
        'err.tx': 'Failed to load transactions',
        'err.filter': 'Failed to filter',
        'err.ledger': 'Could not open the AR statement',
        'err.ledgerAccount': 'Affiliated receivables account was not found in the chart of accounts.',
        'row.openStatement': 'Open AR statement',

        'picker.title': 'Add workshops / branches',
        'picker.hint':
            'Only approved workshops. Select branches individually or use the workshop checkbox to select all branches at once. Workshops with no branches can be pinned as a whole. Search matches names or IDs.',
        'picker.hint.approved': 'approved',
        'picker.hint.branches': 'branches',
        'picker.hint.allBranches': 'all branches',
        'picker.hint.noBranches': 'no branches',
        'picker.searchPh': 'Search name or ID…',
        'picker.alreadyListed': 'Already listed',
        'picker.noBranchesPin': 'No branches — pin whole workshop',
        'picker.allBranchesListed': 'All branches listed',
        'picker.selectAllBranches': 'Select all branches',
        'picker.listed': 'Listed',

        'log.title': 'Transaction log — {name}',
        'log.from': 'From',
        'log.to': 'To',
        'log.coaTitle': 'Opens Chart of Accounts with AR Affiliated ledger filtered to this customer',
        'log.exportNothing': 'Nothing to export',
        'log.exportPdf': 'Download PDF',
        'log.exportNothingRange': 'Nothing to export for the current range',
        'log.exportExcel': 'Download spreadsheet (.xlsx)',
        'log.hint':
            'Sorted oldest → newest for running balance. Debt (Dr) increases collectible AR (sales invoices). Credit (Cr) lowers it (payments, returns). Other activity (e.g. stock) stays in Title with no Debt/Credit. Balance is cumulative for rows in this date range only.',
        'log.hint.oldest': 'oldest → newest',
        'log.hint.debt': 'Debt (Dr)',
        'log.hint.credit': 'Credit (Cr)',
        'log.th.when': 'When',
        'log.th.type': 'Type',
        'log.th.title': 'Title',
        'log.th.debt': 'Debt (Dr)',
        'log.th.credit': 'Credit (Cr)',
        'log.th.balance': 'Balance',
        'log.empty': 'No rows in this range.',

        'export.allDates': 'All dates',
        'export.from': 'From {date}',
        'export.to': 'To {date}',
        'export.rows': '{n} row(s)',
    },
    ar: {
        'money.sar': '{amount} ر.س',
        'money.theyOwe': '{amount} {currency} (هم مدينون لك)',
        'money.youOwe': '−{amount} {currency} (أنت مدين لهم)',
        'money.zero': '0.00 {currency}',
        'emdash': '—',

        'page.title': 'ورش Filter التابعة',
        'page.sub':
            'ثبّت فروعًا محددة (أو ورشة كاملة عندما لا تحتوي على فروع). استخدم إلغاء التفعيل لإخفاء صف دون فقدان السجل؛ والتفعيل لإظهاره مجددًا. انقر صفًا لفتح كشف الذمم الكامل.',
        'page.sub.deactivate': 'إلغاء التفعيل',
        'page.sub.activate': 'تفعيل',
        'page.sub2':
            'الكشف هو نفس دفتر ذمم الورش التابعة في المحاسبة ← دليل الحسابات: فواتير المبيعات والإيصالات والمدفوعات لتلك الورشة أو الفرع.',
        'page.sub2.coa': 'المحاسبة ← دليل الحسابات',
        'page.sub2.ledger': 'كشف الذمم',
        'page.sub2.workshop': 'ورشة',

        'btn.statement': 'كشف الحساب',
        'btn.add': 'إضافة ورش / فروع',
        'btn.cancel': 'إلغاء',
        'btn.close': 'إغلاق',
        'btn.adding': 'جارٍ الإضافة…',
        'btn.addCount': 'إضافة ({n})',
        'btn.applyRange': 'تطبيق النطاق',
        'btn.clearFilter': 'مسح التصفية',
        'btn.coaLedger': 'دليل الحسابات (دفتر الأستاذ)',
        'btn.pdf': 'PDF',
        'btn.excel': 'Excel',
        'btn.loading': 'جارٍ التحميل…',

        'th.workshop': 'الورشة',
        'th.branch': 'الفرع',
        'th.balance': 'الرصيد',
        'th.actions': 'إجراءات',

        'loading': 'جارٍ التحميل…',
        'empty': 'لا صفوف بعد — استخدم «إضافة ورش / فروع».',
        'workshopId': 'ورشة {id}',
        'branchId': 'فرع {id}',
        'inactive': 'غير نشط',
        'inactive.short': 'غير نشط',
        'workshopOnly': 'ورشة فقط (بدون فروع)',
        'toggle.inactive': 'غير نشط',
        'toggle.active': 'نشط',
        'toggle.titleOn': 'ظاهر في هذه الصفحة؛ السجلات والذمم دون تغيير',
        'toggle.titleOff': 'مخفي مؤقتًا؛ الرصيد وسجل المعاملات ما زالا يعكسان الذمم الفعلية',
        'aria.turnOff': 'إيقاف الإدراج (غير نشط)',
        'aria.turnOn': 'تفعيل الإدراج (نشط)',

        'err.load': 'فشل تحميل القائمة',
        'err.loadWorkshops': 'فشل تحميل الورش',
        'err.add': 'تعذّرت إضافة الاختيارات',
        'err.status': 'تعذّر تحديث الحالة',
        'err.tx': 'فشل تحميل المعاملات',
        'err.filter': 'فشلت التصفية',
        'err.ledger': 'تعذّر فتح كشف الذمم',
        'err.ledgerAccount': 'حساب ذمم الورش التابعة غير موجود في دليل الحسابات.',
        'row.openStatement': 'فتح كشف الذمم',

        'picker.title': 'إضافة ورش / فروع',
        'picker.hint':
            'الورش المعتمدة فقط. اختر الفروع فرديًا أو استخدم مربع اختيار الورشة لتحديد كل الفروع دفعة واحدة. الورش بلا فروع يمكن تثبيتها ككل. البحث يطابق الأسماء أو المعرّفات.',
        'picker.hint.approved': 'المعتمدة',
        'picker.hint.branches': 'الفروع',
        'picker.hint.allBranches': 'كل الفروع',
        'picker.hint.noBranches': 'بلا فروع',
        'picker.searchPh': 'بحث بالاسم أو المعرّف…',
        'picker.alreadyListed': 'مدرج مسبقًا',
        'picker.noBranchesPin': 'بلا فروع — ثبّت الورشة كاملة',
        'picker.allBranchesListed': 'كل الفروع مدرجة',
        'picker.selectAllBranches': 'تحديد كل الفروع',
        'picker.listed': 'مدرج',

        'log.title': 'سجل المعاملات — {name}',
        'log.from': 'من',
        'log.to': 'إلى',
        'log.coaTitle': 'يفتح دليل الحسابات مع دفتر ذمم تابعة مُصفّى لهذا العميل',
        'log.exportNothing': 'لا شيء للتصدير',
        'log.exportPdf': 'تنزيل PDF',
        'log.exportNothingRange': 'لا شيء للتصدير في النطاق الحالي',
        'log.exportExcel': 'تنزيل جدول بيانات (.xlsx)',
        'log.hint':
            'مرتّب من الأقدم ← الأحدث لرصيد جارٍ. المدين (Dr) يزيد الذمم القابلة للتحصيل (فواتير المبيعات). الدائن (Cr) يخفضها (مدفوعات، مرتجعات). نشاط آخر (مثل المخزون) يبقى في العنوان بلا مدين/دائن. الرصيد تراكمي لصفوف هذا النطاق فقط.',
        'log.hint.oldest': 'الأقدم ← الأحدث',
        'log.hint.debt': 'المدين (Dr)',
        'log.hint.credit': 'الدائن (Cr)',
        'log.th.when': 'الوقت',
        'log.th.type': 'النوع',
        'log.th.title': 'العنوان',
        'log.th.debt': 'مدين (Dr)',
        'log.th.credit': 'دائن (Cr)',
        'log.th.balance': 'الرصيد',
        'log.empty': 'لا صفوف في هذا النطاق.',

        'export.allDates': 'كل التواريخ',
        'export.from': 'من {date}',
        'export.to': 'إلى {date}',
        'export.rows': '{n} صف',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function sawT(locale, key, vars) {
    const pack = SAW_I18N[locale] || SAW_I18N.en;
    let text = pack[key] ?? SAW_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
