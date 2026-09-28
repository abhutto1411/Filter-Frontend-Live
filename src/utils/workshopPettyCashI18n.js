/** Workshop My Petty Cash UI — keyed by portal locale (`en` | `ar`). */
export const WPC_I18N = {
    en: {
        'page.title': 'My Petty Cash',
        'page.desc':
            'Request a fund top-up or submit an expense for approval. GL posts to branch-level [1280] and [6100] under the workshop you select.',
        'page.mgmtTitle': 'Petty Cash Management',
        'page.mgmtDesc':
            'Manage petty-cash floats for all workshop staff — issue cash, review requests, and monitor balances.',

        'forms.glHint':
            'Fund top-ups post DR [1280] Employee Petty Cash Fund (branch account); expenses post DR [6100] Employee Petty Cash Expense and CR [1280] for the selected workshop and branch.',

        'money.sar': 'SAR {amount}',
        'money.signedSar': '{sign} SAR {amount}',
        'emDash': '—',

        'stat.walletBalance': 'Wallet Balance',
        'stat.walletDefaultName': 'Petty Cash Wallet',
        'stat.walletMeta': '{code} · {name}',
        'stat.pendingRequests': 'Pending Requests',
        'stat.awaitingApproval': '{count} awaiting approval',
        'stat.totalStaffFloat': 'Total Staff Float',
        'stat.staffWallets': '{count} staff wallets',
        'stat.awaitingAction': '{count} awaiting action',
        'stat.currentBalance': 'Current Balance',

        'btn.refresh': 'Refresh',
        'btn.requestFund': 'Request Fund Top-Up',
        'btn.submitExpense': 'Submit Expense',
        'btn.submitRequest': 'Submit Request',
        'btn.cancel': 'Cancel',
        'btn.submitting': 'Submitting…',
        'btn.issuePettyCash': 'Issue Petty Cash',
        'btn.issuing': 'Issuing…',
        'btn.issueNow': 'Issue Now',
        'btn.approve': 'Approve',
        'btn.reject': 'Reject',
        'btn.messages': 'Messages',
        'btn.messagesCount': 'Messages ({count})',
        'btn.close': 'Close',
        'btn.send': 'Send',
        'btn.sending': 'Sending…',

        'section.myRequests': 'My Requests',
        'section.walletTransactions': 'Wallet Transactions',
        'section.staffWallets': 'Staff Wallets',
        'section.staffWalletsHint': 'Click a staff row to open their petty cash wallet register.',
        'section.walletRegister': 'Wallet Register — Top-ups & Expenses',
        'section.allStaffRequests': 'All Staff Requests',

        'th.date': 'Date',
        'th.type': 'Type',
        'th.category': 'Category',
        'th.branch': 'Branch',
        'th.amount': 'Amount',
        'th.status': 'Status',
        'th.proof': 'Proof',
        'th.notes': 'Notes',
        'th.actions': 'Actions',
        'th.description': 'Description',
        'th.source': 'Source',
        'th.reference': 'Reference',
        'th.staff': 'Staff',
        'th.role': 'Role',
        'th.balance': 'Balance',
        'th.payFrom': 'Pay from',

        'kind.fundTopUp': 'Fund top-up',
        'kind.expense': 'Expense',

        'source.petty_cash_replenishment': 'Fund top-up',
        'source.petty_cash_expense': 'Expense',
        'source.petty_cash_issue': 'Direct issue',
        'source.internal_transfer': 'Transfer',
        'source.payment': 'Payment',
        'source.receipt': 'Receipt',

        'tx.in': 'In',
        'tx.out': 'Out',

        'status.pending': 'Pending',
        'status.approved': 'Approved',
        'status.rejected': 'Rejected',

        'loading': 'Loading…',
        'loading.register': 'Loading register…',

        'empty.requests': 'No requests yet.',
        'empty.noRequests': 'No requests.',
        'empty.transactions': 'No transactions yet.',
        'empty.messages': 'No messages yet.',
        'empty.wallets': 'No staff wallets yet. Issue petty cash to create one.',
        'empty.noWalletRegister':
            'No wallet register yet. Issue petty cash or approve a fund top-up to create one.',

        'thread.conversation': 'Conversation',
        'thread.placeholder': 'Write a message…',
        'user.fallback': 'User',
        'staff.fallback': 'Staff',
        'staff.member': 'Staff member',

        'workshop.current': 'Current workshop',
        'form.workshop': 'Workshop',
        'form.workshopRequired': 'Workshop *',
        'form.selectWorkshop': 'Select workshop',
        'form.branch': 'Branch',
        'form.branchRequired': 'Branch *',
        'form.selectBranch': 'Select branch',
        'form.allBranches': 'All branches',
        'form.amountSar': 'Amount (SAR) *',
        'form.reasonNote': 'Reason / Note',
        'form.note': 'Note',
        'form.description': 'Description',
        'form.expenseCategory': 'Expense category *',
        'form.selectCategory': 'Select category',
        'form.expenseDate': 'Expense date',
        'form.expenseProof': 'Expense proof *',
        'form.requestFundTitle': 'Request Fund Top-Up',
        'form.submitExpenseTitle': 'Submit Expense',
        'form.issueTitle': 'Issue Petty Cash to Staff',
        'form.staffMember': 'Staff member *',
        'form.selectStaff': 'Select staff',
        'form.payFrom': 'Pay from (cash/bank) *',
        'form.selectAccount': 'Select account',
        'form.categoryOption': '{code} · {name}',

        'modal.registerTitle': 'Petty Cash Wallet Register',
        'title.openRegister': 'Open wallet register',
        'aria.openRegister': 'Open register',

        'prompt.rejectReason': 'Rejection reason (required):',

        'err.load': 'Could not load petty cash data.',
        'err.loadMgmt': 'Could not load petty cash management data.',
        'err.loadRegister': 'Could not load wallet register.',
        'err.selectWorkshop': 'Select a workshop.',
        'err.validAmount': 'Enter a valid amount.',
        'err.selectBranch': 'Select a branch.',
        'err.selectCategory': 'Select an expense category.',
        'err.proofRequired': 'Expense proof image is required.',
        'err.submitFailed': 'Submit failed.',
        'err.selectStaff': 'Select a staff member.',
        'err.selectPayFrom': 'Select the cash/bank account to pay from.',
        'err.issueFailed': 'Could not issue petty cash.',
        'err.approvePayFrom': 'Select a pay-from cash/bank account before approving a fund top-up.',
        'err.approveFailed': 'Approve failed.',
        'err.rejectFailed': 'Reject failed.',
    },
    ar: {
        'page.title': 'عهدتي النقدية',
        'page.desc':
            'اطلب تعبئة رصيد أو قدّم مصروفاً للموافقة. تُرحَّل القيود إلى مستوى الفرع [1280] و[6100] ضمن الورشة التي تختارها.',
        'page.mgmtTitle': 'إدارة العهدة النقدية',
        'page.mgmtDesc':
            'إدارة أرصدة العهدة النقدية لجميع موظفي الورشة — صرف النقد، ومراجعة الطلبات، ومراقبة الأرصدة.',

        'forms.glHint':
            'تعبئة الرصيد تُرحَّل مدين [1280] صندوق عهدة الموظف (حساب الفرع)؛ والمصروفات تُرحَّل مدين [6100] مصروف عهدة الموظف ودائن [1280] للورشة والفرع المحددين.',

        'money.sar': '{amount} ر.س',
        'money.signedSar': '{sign} {amount} ر.س',
        'emDash': '—',

        'stat.walletBalance': 'رصيد المحفظة',
        'stat.walletDefaultName': 'محفظة العهدة النقدية',
        'stat.walletMeta': '{code} · {name}',
        'stat.pendingRequests': 'الطلبات المعلّقة',
        'stat.awaitingApproval': '{count} بانتظار الموافقة',
        'stat.totalStaffFloat': 'إجمالي عهدة الموظفين',
        'stat.staffWallets': '{count} محفظة موظف',
        'stat.awaitingAction': '{count} بانتظار الإجراء',
        'stat.currentBalance': 'الرصيد الحالي',

        'btn.refresh': 'تحديث',
        'btn.requestFund': 'طلب تعبئة رصيد',
        'btn.submitExpense': 'تقديم مصروف',
        'btn.submitRequest': 'إرسال الطلب',
        'btn.cancel': 'إلغاء',
        'btn.submitting': 'جارٍ الإرسال…',
        'btn.issuePettyCash': 'صرف عهدة نقدية',
        'btn.issuing': 'جارٍ الصرف…',
        'btn.issueNow': 'صرف الآن',
        'btn.approve': 'موافقة',
        'btn.reject': 'رفض',
        'btn.messages': 'الرسائل',
        'btn.messagesCount': 'الرسائل ({count})',
        'btn.close': 'إغلاق',
        'btn.send': 'إرسال',
        'btn.sending': 'جارٍ الإرسال…',

        'section.myRequests': 'طلباتي',
        'section.walletTransactions': 'حركات المحفظة',
        'section.staffWallets': 'محافظ الموظفين',
        'section.staffWalletsHint': 'انقر صف الموظف لفتح سجل محفظة العهدة النقدية.',
        'section.walletRegister': 'سجل المحفظة — التعبئة والمصروفات',
        'section.allStaffRequests': 'كل طلبات الموظفين',

        'th.date': 'التاريخ',
        'th.type': 'النوع',
        'th.category': 'الفئة',
        'th.branch': 'الفرع',
        'th.amount': 'المبلغ',
        'th.status': 'الحالة',
        'th.proof': 'الإثبات',
        'th.notes': 'ملاحظات',
        'th.actions': 'الإجراءات',
        'th.description': 'الوصف',
        'th.source': 'المصدر',
        'th.reference': 'المرجع',
        'th.staff': 'الموظف',
        'th.role': 'الدور',
        'th.balance': 'الرصيد',
        'th.payFrom': 'الدفع من',

        'kind.fundTopUp': 'تعبئة رصيد',
        'kind.expense': 'مصروف',

        'source.petty_cash_replenishment': 'تعبئة رصيد',
        'source.petty_cash_expense': 'مصروف',
        'source.petty_cash_issue': 'صرف مباشر',
        'source.internal_transfer': 'تحويل',
        'source.payment': 'دفع',
        'source.receipt': 'قبض',

        'tx.in': 'وارد',
        'tx.out': 'صادر',

        'status.pending': 'معلّق',
        'status.approved': 'موافق عليه',
        'status.rejected': 'مرفوض',

        'loading': 'جارٍ التحميل…',
        'loading.register': 'جارٍ تحميل السجل…',

        'empty.requests': 'لا توجد طلبات بعد.',
        'empty.noRequests': 'لا توجد طلبات.',
        'empty.transactions': 'لا توجد حركات بعد.',
        'empty.messages': 'لا توجد رسائل بعد.',
        'empty.wallets': 'لا توجد محافظ موظفين بعد. اصرف عهدة نقدية لإنشاء واحدة.',
        'empty.noWalletRegister':
            'لا يوجد سجل محفظة بعد. اصرف عهدة نقدية أو وافق على تعبئة رصيد لإنشاء واحد.',

        'thread.conversation': 'المحادثة',
        'thread.placeholder': 'اكتب رسالة…',
        'user.fallback': 'مستخدم',
        'staff.fallback': 'موظف',
        'staff.member': 'موظف',

        'workshop.current': 'الورشة الحالية',
        'form.workshop': 'الورشة',
        'form.workshopRequired': 'الورشة *',
        'form.selectWorkshop': 'اختر الورشة',
        'form.branch': 'الفرع',
        'form.branchRequired': 'الفرع *',
        'form.selectBranch': 'اختر الفرع',
        'form.allBranches': 'كل الفروع',
        'form.amountSar': 'المبلغ (ر.س) *',
        'form.reasonNote': 'السبب / ملاحظة',
        'form.note': 'ملاحظة',
        'form.description': 'الوصف',
        'form.expenseCategory': 'فئة المصروف *',
        'form.selectCategory': 'اختر الفئة',
        'form.expenseDate': 'تاريخ المصروف',
        'form.expenseProof': 'إثبات المصروف *',
        'form.requestFundTitle': 'طلب تعبئة رصيد',
        'form.submitExpenseTitle': 'تقديم مصروف',
        'form.issueTitle': 'صرف عهدة نقدية للموظف',
        'form.staffMember': 'الموظف *',
        'form.selectStaff': 'اختر الموظف',
        'form.payFrom': 'الدفع من (نقد/بنك) *',
        'form.selectAccount': 'اختر الحساب',
        'form.categoryOption': '{code} · {name}',

        'modal.registerTitle': 'سجل محفظة العهدة النقدية',
        'title.openRegister': 'فتح سجل المحفظة',
        'aria.openRegister': 'فتح السجل',

        'prompt.rejectReason': 'سبب الرفض (مطلوب):',

        'err.load': 'تعذّر تحميل بيانات العهدة النقدية.',
        'err.loadMgmt': 'تعذّر تحميل بيانات إدارة العهدة النقدية.',
        'err.loadRegister': 'تعذّر تحميل سجل المحفظة.',
        'err.selectWorkshop': 'اختر ورشة.',
        'err.validAmount': 'أدخل مبلغاً صالحاً.',
        'err.selectBranch': 'اختر فرعاً.',
        'err.selectCategory': 'اختر فئة مصروف.',
        'err.proofRequired': 'صورة إثبات المصروف مطلوبة.',
        'err.submitFailed': 'فشل الإرسال.',
        'err.selectStaff': 'اختر موظفاً.',
        'err.selectPayFrom': 'اختر حساب النقد/البنك للصرف منه.',
        'err.issueFailed': 'تعذّر صرف العهدة النقدية.',
        'err.approvePayFrom': 'اختر حساب نقد/بنك للصرف منه قبل الموافقة على تعبئة الرصيد.',
        'err.approveFailed': 'فشلت الموافقة.',
        'err.rejectFailed': 'فشل الرفض.',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wpcT(locale, key, vars) {
    const pack = WPC_I18N[locale] || WPC_I18N.en;
    let text = pack[key] ?? WPC_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
