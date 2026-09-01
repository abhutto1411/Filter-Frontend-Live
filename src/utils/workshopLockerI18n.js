/** Workshop Locker Management UI — keyed by portal locale (`en` | `ar`). */
export const WLOCK_I18N = {
    en: {
        'page.title': 'Locker Management',
        'page.subtitle':
            'Live view of the locker portal — cash collections from cashiers, bank deposits, petty-cash float, and locker staff accounts.',

        'btn.refresh': 'Refresh',
        'btn.openPortal': 'Open Locker Portal',

        'info.before': 'Locker supervisors and collectors are created from the',
        'info.employees': 'Employees',
        'info.mid': 'page (set role to',
        'info.or': 'or',
        'info.afterRoles': '). They appear here automatically and sign in at',

        'err.load': 'Failed to load locker overview',

        'kpi.pendingPickups': 'Pending pickups',
        'kpi.pendingPickupsHint': 'Cashier closings awaiting an officer',
        'kpi.assigned': 'Assigned to officer',
        'kpi.assignedHint': 'On-the-way collections',
        'kpi.overdue': 'Overdue (>24h)',
        'kpi.overdueHint': 'Open longer than 24h',
        'kpi.pendingApprovals': 'Pending approvals',
        'kpi.pendingApprovalsHint': 'Variance awaiting supervisor',
        'kpi.collectedToday': 'Collected today',
        'kpi.monthlyCollected': 'Monthly collected',
        'kpi.openShiftVariance': 'Open-shift variance',
        'kpi.openShiftVarianceHint': 'Sum of |cashDiff| on open shifts',
        'kpi.vaultBalance': 'Locker vault balance',
        'kpi.vaultHint': '1004 Cash in Transit — Locker',

        'section.supervisors': 'Locker supervisors',
        'section.collectors': 'Collection officers',
        'section.recentRequests': 'Recent collection requests',
        'section.recentCollections': 'Recent collections (cashier → locker)',
        'section.bankDeposits': 'Bank deposits (locker → bank)',
        'section.pettyCash': 'Petty cash issued from locker',

        'empty.supervisors': 'No supervisor created yet',
        'empty.collectors': 'No collectors created yet',
        'empty.requests': 'No collection requests yet',
        'empty.collections': 'No collections recorded yet',
        'empty.bankDeposits': 'No bank deposits yet',
        'empty.pettyCash': 'No petty cash float issued yet',

        'th.name': 'Name',
        'th.email': 'Email',
        'th.mobile': 'Mobile',
        'th.status': 'Status',
        'th.reference': 'Reference',
        'th.branch': 'Branch',
        'th.cashier': 'Cashier',
        'th.officer': 'Officer',
        'th.expected': 'Expected',
        'th.cashDiff': 'Cash Diff (closing)',
        'th.created': 'Created',
        'th.received': 'Received',
        'th.difference': 'Difference',
        'th.collected': 'Collected',
        'th.register': 'Register',
        'th.amount': 'Amount',
        'th.date': 'Date',
        'th.description': 'Description',

        'status.pending': 'Pending',
        'status.assigned': 'Assigned',
        'status.collected': 'Collected',
        'status.pendingApproval': 'Awaiting Approval',
        'status.approved': 'Approved',
        'status.rejected': 'Rejected',

        'emdash': '—',
        'money.sar': 'SAR {amount}',
    },
    ar: {
        'page.title': 'إدارة الخزنة',
        'page.subtitle':
            'عرض مباشر لبوابة الخزنة — تحصيل النقد من أمناء الصندوق، والإيداعات البنكية، وعهدة المصروفات النثرية، وحسابات موظفي الخزنة.',

        'btn.refresh': 'تحديث',
        'btn.openPortal': 'فتح بوابة الخزنة',

        'info.before': 'يتم إنشاء مشرفي ومحصّلي الخزنة من صفحة',
        'info.employees': 'الموظفون',
        'info.mid': '(اضبط الدور إلى',
        'info.or': 'أو',
        'info.afterRoles': '). يظهرون هنا تلقائياً ويسجّلون الدخول عبر',

        'err.load': 'فشل تحميل نظرة عامة على الخزنة',

        'kpi.pendingPickups': 'عمليات الاستلام المعلقة',
        'kpi.pendingPickupsHint': 'إغلاقات أمين الصندوق بانتظار موظف',
        'kpi.assigned': 'مُسندة إلى الموظف',
        'kpi.assignedHint': 'عمليات تحصيل في الطريق',
        'kpi.overdue': 'متأخرة (>24 ساعة)',
        'kpi.overdueHint': 'مفتوحة لأكثر من 24 ساعة',
        'kpi.pendingApprovals': 'الموافقات المعلقة',
        'kpi.pendingApprovalsHint': 'فروقات بانتظار المشرف',
        'kpi.collectedToday': 'تم التحصيل اليوم',
        'kpi.monthlyCollected': 'المحصّل شهرياً',
        'kpi.openShiftVariance': 'فرق الوردية المفتوحة',
        'kpi.openShiftVarianceHint': 'مجموع |فرق النقد| في الورديات المفتوحة',
        'kpi.vaultBalance': 'رصيد صندوق الخزنة',
        'kpi.vaultHint': '1004 نقد قيد النقل — الخزنة',

        'section.supervisors': 'مشرفو الخزنة',
        'section.collectors': 'موظفو التحصيل',
        'section.recentRequests': 'طلبات التحصيل الأخيرة',
        'section.recentCollections': 'التحصيلات الأخيرة (أمين الصندوق ← الخزنة)',
        'section.bankDeposits': 'الإيداعات البنكية (الخزنة ← البنك)',
        'section.pettyCash': 'المصروفات النثرية الصادرة من الخزنة',

        'empty.supervisors': 'لم يتم إنشاء مشرف بعد',
        'empty.collectors': 'لم يتم إنشاء محصّلين بعد',
        'empty.requests': 'لا توجد طلبات تحصيل بعد',
        'empty.collections': 'لم تُسجَّل تحصيلات بعد',
        'empty.bankDeposits': 'لا توجد إيداعات بنكية بعد',
        'empty.pettyCash': 'لم تُصدر عهدة مصروفات نثرية بعد',

        'th.name': 'الاسم',
        'th.email': 'البريد الإلكتروني',
        'th.mobile': 'الجوال',
        'th.status': 'الحالة',
        'th.reference': 'المرجع',
        'th.branch': 'الفرع',
        'th.cashier': 'أمين الصندوق',
        'th.officer': 'الموظف',
        'th.expected': 'المتوقع',
        'th.cashDiff': 'فرق النقد (الإغلاق)',
        'th.created': 'تاريخ الإنشاء',
        'th.received': 'المستلم',
        'th.difference': 'الفرق',
        'th.collected': 'تاريخ التحصيل',
        'th.register': 'السجل',
        'th.amount': 'المبلغ',
        'th.date': 'التاريخ',
        'th.description': 'الوصف',

        'status.pending': 'قيد الانتظار',
        'status.assigned': 'مُسند',
        'status.collected': 'تم التحصيل',
        'status.pendingApproval': 'بانتظار الموافقة',
        'status.approved': 'موافق عليه',
        'status.rejected': 'مرفوض',

        'emdash': '—',
        'money.sar': '{amount} ر.س',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wlockT(locale, key, vars) {
    const pack = WLOCK_I18N[locale] || WLOCK_I18N.en;
    let text = pack[key] ?? WLOCK_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
