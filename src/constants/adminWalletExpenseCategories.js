/** Keep in sync with backend admin-wallet-expense-categories.const.ts */
export const ADMIN_WALLET_EXPENSE_CATEGORY_SEED = [
    { key: 'Advertising and promotion', labelEn: 'Advertising and promotion', labelAr: 'مصاريف الطباعة والإعلان' },
    { key: 'Bank charges', labelEn: 'Bank charges', labelAr: 'رسوم خدمة البنك' },
    { key: 'Charity / Donations / Reward Expenses', labelEn: 'Charity / Donations / Reward Expenses', labelAr: 'الأعمال الخيرية / التبرعات / مصاريف المكافآت' },
    { key: 'Customer Compensation Expenses', labelEn: 'Customer Compensation Expenses', labelAr: 'مصاريف تعويضات العملاء' },
    { key: 'customer services expenses', labelEn: 'customer services expenses', labelAr: 'مصاريف خدمات العملاء' },
    { key: 'Development & Renovation Expenses', labelEn: 'Development & Renovation Expenses', labelAr: 'مصاريف التطوير والتجديد' },
    { key: 'Food & Entertainment', labelEn: 'Food & Entertainment', labelAr: 'نفقات الطعام والترفيه' },
    { key: 'Fuel Allowance Expenses', labelEn: 'Fuel Allowance Expenses', labelAr: 'مصاريف بدل البنزين' },
    { key: 'Information Technology Expenses', labelEn: 'Information Technology Expenses', labelAr: 'تكنولوجيا المعلومات مصروفات' },
    { key: 'labour uniform & shoes Expenses', labelEn: 'labour uniform & shoes Expenses', labelAr: 'مصاريف زي العمل والأحذية' },
    { key: 'Medical Expenses', labelEn: 'Medical Expenses', labelAr: 'النفقات الطبية' },
    { key: 'Misc Accommodation Expenses', labelEn: 'Misc Accommodation Expenses', labelAr: 'مصاريف التدبير المنزلي' },
    { key: 'Misc Expenses', labelEn: 'Misc Expenses', labelAr: 'مصاريف متنوعة' },
    { key: 'Misc Government Expenses', labelEn: 'Misc Government Expenses', labelAr: 'مصاريف حكومية متنوعة' },
    { key: 'Motor vehicle Repair Expenses', labelEn: 'Motor vehicle Repair Expenses', labelAr: 'مصاريف إصلاح المركبات' },
    { key: 'Municipal / Garbage Expenses - شركة الهلب للتجارية و المقاولات', labelEn: 'Municipal / Garbage Expenses - شركة الهلب للتجارية و المقاولات', labelAr: 'Municipal / Garbage Expenses - شركة الهلب للتجارية و المقاولات' },
    { key: 'POL Expenses', labelEn: 'POL Expenses', labelAr: 'مصاريف البنزين' },
    { key: 'Printing and stationery', labelEn: 'Printing and stationery', labelAr: 'الطباعة والقرطاسية' },
    { key: 'Repair & maintenance Expenses - Accomodation', labelEn: 'Repair & maintenance Expenses - Accomodation', labelAr: 'مصاريف الإصلاح والصيانة - سكن' },
    { key: 'Repair & maintenance Expenses - Car Wash', labelEn: 'Repair & maintenance Expenses - Car Wash', labelAr: 'مصاريف الإصلاح والصيانة - غسيل' },
    { key: 'Repair & maintenance Expenses', labelEn: 'Repair & maintenance Expenses', labelAr: 'مصاريف الإصلاح والصيانة' },
    { key: 'Telephone & Internet Expenses', labelEn: 'Telephone & Internet Expenses', labelAr: 'مصاريف الهاتف والإنترنت' },
    { key: 'Tools & Equipment Expenses', labelEn: 'Tools & Equipment Expenses', labelAr: 'مصاريف الأدوات والمعدات' },
    { key: 'Transportation Expenses', labelEn: 'Transportation Expenses', labelAr: 'مصاريف النقل' },
    { key: 'Traveling Expenses', labelEn: 'Traveling Expenses', labelAr: 'مصاريف السفر' },
];

export const ADMIN_WALLET_EXPENSE_CATEGORIES = ADMIN_WALLET_EXPENSE_CATEGORY_SEED.map(
    (row) => row.key,
);

export function formatAdminWalletExpenseCategoryLabel(key) {
    const row = ADMIN_WALLET_EXPENSE_CATEGORY_SEED.find(
        (c) => c.key.toLowerCase() === String(key || '').toLowerCase(),
    );
    if (!row) return key || '';
    return `${row.labelEn} — ${row.labelAr}`;
}

/** Options for SearchableEntityCombobox ({ id, label, subtitle, searchText }). */
export function adminWalletExpenseComboboxOptions() {
    return ADMIN_WALLET_EXPENSE_CATEGORY_SEED.map((row) => ({
        id: row.key,
        label: `${row.labelEn} — ${row.labelAr}`,
        subtitle: row.labelAr,
        searchText: `${row.labelEn} ${row.labelAr}`,
    }));
}

export function adminWalletExpenseLedgerFilterOptions() {
    return [
        { id: '', label: 'All categories', searchText: 'all' },
        ...adminWalletExpenseComboboxOptions(),
        { id: 'Uncategorized', label: 'Uncategorized', searchText: 'uncategorized' },
    ];
}
