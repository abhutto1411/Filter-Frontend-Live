/** Customer Insights UI copy — keyed by portal locale (`en` | `ar`). */
const CI_I18N = {
  en: {
    'kpi.totalCustomers': 'Total Customers',
    'kpi.returningCustomers': 'Returning Customers',
    'kpi.newThisMonth': 'New This Month',
    'kpi.avgSpend': 'Avg. Spend / Customer',
    'kpi.thisMonth': '+{count} this month',
    'kpi.retention': '{pct}% retention',
    'kpi.vsLastMonth': 'vs last month',
    'kpi.allTime': 'All time',
    'chart.growthTitle': 'New Customer Growth — Last 6 Months',
    'empty.customers': 'No customers found',
    'empty.data': 'No data',
    'empty.loading': 'Loading customers...',
    'error.load': 'Failed to load customer insights.',
    'section.newVsReturning': 'New vs Returning',
    'section.walkInVsCorporate': 'Walk-in vs Corporate',
    'section.branchDistribution': 'Branch Distribution',
    'section.allCustomers': 'All Customers',
    'nvr.new': 'New',
    'nvr.returning': 'Returning',
    'nvr.newTitle': 'New {pct}%',
    'nvr.returningTitle': 'Returning {pct}%',
    'ltv.perCustomer': 'Lifetime Value / Customer:',
    'meta.custRevenue': '{count} cust · {revenue}',
    'meta.revenueCust': '{revenue} · {count} cust',
    'search.placeholder': 'Search...',
    'sort.newest': 'Newest First',
    'sort.oldest': 'Oldest First',
    'sort.highestSpend': 'Highest Spend',
    'sort.mostOrders': 'Most Orders',
    'sort.name': 'Name A-Z',
    'action.refresh': 'Refresh',
    'table.customer': 'Customer',
    'table.contact': 'Contact',
    'table.orders': 'Orders',
    'table.totalSpend': 'Total Spend',
    'table.segment': 'Segment',
    'customer.default': 'Customer',
    'type.regular': 'Regular',
    'type.walk_in': 'Walk In',
    'type.walkin': 'Walk In',
    'type.corporate': 'Corporate',
    'type.customer': 'Customer',
  },
  ar: {
    'kpi.totalCustomers': 'إجمالي العملاء',
    'kpi.returningCustomers': 'العملاء العائدون',
    'kpi.newThisMonth': 'الجدد هذا الشهر',
    'kpi.avgSpend': 'متوسط الإنفاق / عميل',
    'kpi.thisMonth': '+{count} هذا الشهر',
    'kpi.retention': 'نسبة الاحتفاظ {pct}%',
    'kpi.vsLastMonth': 'مقارنة بالشهر الماضي',
    'kpi.allTime': 'طوال الفترة',
    'chart.growthTitle': 'نمو العملاء الجدد — آخر 6 أشهر',
    'empty.customers': 'لم يتم العثور على عملاء',
    'empty.data': 'لا توجد بيانات',
    'empty.loading': 'جاري تحميل العملاء...',
    'error.load': 'فشل تحميل رؤى العملاء.',
    'section.newVsReturning': 'الجدد مقابل العائدين',
    'section.walkInVsCorporate': 'زيارة مباشرة مقابل شركات',
    'section.branchDistribution': 'التوزيع حسب الفرع',
    'section.allCustomers': 'جميع العملاء',
    'nvr.new': 'جديد',
    'nvr.returning': 'عائد',
    'nvr.newTitle': 'جديد {pct}%',
    'nvr.returningTitle': 'عائد {pct}%',
    'ltv.perCustomer': 'القيمة مدى الحياة / عميل:',
    'meta.custRevenue': '{count} عميل · {revenue}',
    'meta.revenueCust': '{revenue} · {count} عميل',
    'search.placeholder': 'بحث...',
    'sort.newest': 'الأحدث أولاً',
    'sort.oldest': 'الأقدم أولاً',
    'sort.highestSpend': 'الأعلى إنفاقاً',
    'sort.mostOrders': 'الأكثر طلبات',
    'sort.name': 'الاسم أ–ي',
    'action.refresh': 'تحديث',
    'table.customer': 'العميل',
    'table.contact': 'التواصل',
    'table.orders': 'الطلبات',
    'table.totalSpend': 'إجمالي الإنفاق',
    'table.segment': 'الشريحة',
    'customer.default': 'عميل',
    'type.regular': 'عادي',
    'type.walk_in': 'زيارة مباشرة',
    'type.walkin': 'زيارة مباشرة',
    'type.corporate': 'شركات',
    'type.customer': 'عميل',
  },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function ciT(locale, key, vars) {
  const pack = CI_I18N[locale] || CI_I18N.en;
  let text = pack[key] ?? CI_I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
