/** Marketing portal UI copy — keyed by portal locale (`en` | `ar`). */
const MARKETING_I18N = {
    en: {
        'tab.dashboard': 'Dashboard',
        'tab.promotions': 'Promotions',
        'tab.promoCodes': 'Promo Codes',
        'tab.referralManagement': 'Referral Management',
        'tab.marketingWallet': 'Marketing Wallet',
        'tab.budgetOptimizer': 'Budget Optimizer',
        'tab.expenses': 'Expenses',
        'tab.tierManagement': 'Tier Management',
        'tab.customerInsights': 'Customer Insights',
        'header.subtitle': 'Marketing and customer engagement control.',
        'header.workshopScope': 'Workshop scope',
        'header.allWorkshops': 'All workshops (system)',
        'header.workshopN': 'Workshop {id}',
        'header.add': 'Add {label}',
        'header.noPermission': "You don't have permission to view any Marketing sections.",
        'kpi.walletBalance': 'Wallet Balance',
        'kpi.activeCampaigns': 'Active Campaigns',
        'kpi.revenueGenerated': 'Revenue Generated',
        'kpi.totalLeads': 'Total Leads',
        'kpi.impressions': 'Impressions',
        'kpi.uniqueCustomers': 'Unique Customers',
        'kpi.conversions': 'Conversions',
        'kpi.overallRoi': 'Overall ROI',
        'roi.totalSpend': 'Total Spend',
        'roi.sub': 'ROAS {roas}x · Conversion rate {rate}%',
        'roi.pendingRequests': 'Pending Requests',
        'branch.all': 'All Branches',
        'branch.n': 'Branch {id}',
        'chart.conversionTrends': 'Conversion Trends',
        'chart.conversionTrendsSub': 'Leads vs conversions — last 6 months',
        'chart.revenueTrend': 'Revenue Trend',
        'chart.revenueTrendSub': 'Monthly invoiced revenue (SAR)',
        'chart.customerGrowth': 'Customer Growth',
        'chart.customerGrowthSub': 'Unique customers per month',
        'chart.reachByPlatform': 'Reach by Platform',
        'chart.reachByPlatformSub': 'Revenue share per ad platform',
        'chart.branchWise': 'Branch-wise Performance',
        'chart.branchWiseSub': 'Revenue, orders and customers per branch',
        'chart.workshopWise': 'Workshop-wise Performance',
        'chart.workshopWiseSub': 'Revenue per workshop',
        'chart.topCampaigns': 'Top Campaigns',
        'chart.topCampaignsSub': 'Highest revenue campaigns',
        'series.leads': 'Leads',
        'series.conversions': 'Conversions',
        'series.revenue': 'Revenue',
        'series.customers': 'Customers',
        'table.branch': 'Branch',
        'table.orders': 'Orders',
        'table.customers': 'Customers',
        'table.revenue': 'Revenue',
        'empty.platform': 'No platform data',
        'empty.branch': 'No branch data',
        'empty.workshop': 'No workshop data',
        'empty.campaigns': 'No campaigns found',
        'campaign.roi': 'ROI {pct}%',
        'error.load': 'Failed to load marketing dashboard.',
        'error.request': 'Dashboard request failed.',
        'month.jan': 'Jan',
        'month.feb': 'Feb',
        'month.mar': 'Mar',
        'month.apr': 'Apr',
        'month.may': 'May',
        'month.jun': 'Jun',
        'month.jul': 'Jul',
        'month.aug': 'Aug',
        'month.sep': 'Sep',
        'month.oct': 'Oct',
        'month.nov': 'Nov',
        'month.dec': 'Dec',
    },
    ar: {
        'tab.dashboard': 'لوحة التحكم',
        'tab.promotions': 'العروض',
        'tab.promoCodes': 'أكواد الخصم',
        'tab.referralManagement': 'إدارة الإحالات',
        'tab.marketingWallet': 'محفظة التسويق',
        'tab.budgetOptimizer': 'محسّن الميزانية',
        'tab.expenses': 'المصروفات',
        'tab.tierManagement': 'إدارة المستويات',
        'tab.customerInsights': 'رؤى العملاء',
        'header.subtitle': 'التحكم في التسويق وتفاعل العملاء.',
        'header.workshopScope': 'نطاق الورشة',
        'header.allWorkshops': 'جميع الورش (النظام)',
        'header.workshopN': 'ورشة {id}',
        'header.add': 'إضافة {label}',
        'header.noPermission': 'ليس لديك صلاحية لعرض أي أقسام من التسويق.',
        'kpi.walletBalance': 'رصيد المحفظة',
        'kpi.activeCampaigns': 'الحملات النشطة',
        'kpi.revenueGenerated': 'الإيرادات المحققة',
        'kpi.totalLeads': 'إجمالي العملاء المحتملين',
        'kpi.impressions': 'مرات الظهور',
        'kpi.uniqueCustomers': 'عملاء فريدون',
        'kpi.conversions': 'التحويلات',
        'kpi.overallRoi': 'العائد الإجمالي',
        'roi.totalSpend': 'إجمالي الإنفاق',
        'roi.sub': 'عائد الإنفاق {roas}x · معدل التحويل {rate}%',
        'roi.pendingRequests': 'الطلبات المعلقة',
        'branch.all': 'جميع الفروع',
        'branch.n': 'فرع {id}',
        'chart.conversionTrends': 'اتجاهات التحويل',
        'chart.conversionTrendsSub': 'العملاء المحتملون مقابل التحويلات — آخر 6 أشهر',
        'chart.revenueTrend': 'اتجاه الإيرادات',
        'chart.revenueTrendSub': 'الإيرادات الشهرية المفوترة (ر.س)',
        'chart.customerGrowth': 'نمو العملاء',
        'chart.customerGrowthSub': 'عملاء فريدون لكل شهر',
        'chart.reachByPlatform': 'الوصول حسب المنصة',
        'chart.reachByPlatformSub': 'حصة الإيرادات لكل منصة إعلانية',
        'chart.branchWise': 'الأداء حسب الفرع',
        'chart.branchWiseSub': 'الإيرادات والطلبات والعملاء لكل فرع',
        'chart.workshopWise': 'الأداء حسب الورشة',
        'chart.workshopWiseSub': 'الإيرادات لكل ورشة',
        'chart.topCampaigns': 'أفضل الحملات',
        'chart.topCampaignsSub': 'الحملات الأعلى إيراداً',
        'series.leads': 'عملاء محتملون',
        'series.conversions': 'تحويلات',
        'series.revenue': 'إيرادات',
        'series.customers': 'عملاء',
        'table.branch': 'الفرع',
        'table.orders': 'الطلبات',
        'table.customers': 'العملاء',
        'table.revenue': 'الإيرادات',
        'empty.platform': 'لا توجد بيانات للمنصات',
        'empty.branch': 'لا توجد بيانات للفروع',
        'empty.workshop': 'لا توجد بيانات للورش',
        'empty.campaigns': 'لم يتم العثور على حملات',
        'campaign.roi': 'العائد {pct}%',
        'error.load': 'فشل تحميل لوحة التسويق.',
        'error.request': 'فشل طلب لوحة التحكم.',
        'month.jan': 'يناير',
        'month.feb': 'فبراير',
        'month.mar': 'مارس',
        'month.apr': 'أبريل',
        'month.may': 'مايو',
        'month.jun': 'يونيو',
        'month.jul': 'يوليو',
        'month.aug': 'أغسطس',
        'month.sep': 'سبتمبر',
        'month.oct': 'أكتوبر',
        'month.nov': 'نوفمبر',
        'month.dec': 'ديسمبر',
    },
};

const MONTH_KEYS = [
    'month.jan', 'month.feb', 'month.mar', 'month.apr', 'month.may', 'month.jun',
    'month.jul', 'month.aug', 'month.sep', 'month.oct', 'month.nov', 'month.dec',
];

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function marketingT(locale, key, vars) {
    const pack = MARKETING_I18N[locale] || MARKETING_I18N.en;
    let text = pack[key] ?? MARKETING_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} month YYYY-MM
 */
export function formatMarketingMonthLabel(locale, month) {
    if (!month || typeof month !== 'string') return month || '';
    const [y, m] = month.split('-');
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return month;
    return `${marketingT(locale, MONTH_KEYS[idx])} ${String(y).slice(2)}`;
}
