/** Budget Optimizer UI copy — keyed by portal locale (`en` | `ar`). */
const BO_I18N = {
  en: {
    'title': 'AI Predictive Budget Optimizer',
    'subtitle':
      'Analyzes campaign history and recommends optimal budget allocation to maximize ROI.',
    'btn.manageAlerts': 'Manage Alerts',
    'btn.optimize': 'Optimize Budget',
    'btn.optimizing': 'Optimizing...',
    'btn.refresh': 'Refresh',
    'btn.generateInsights': 'Generate AI Insights',
    'btn.analyzing': 'Analyzing...',
    'btn.applyRecommendations': 'Apply Recommendations',
    'btn.applying': 'Applying...',
    'kpi.wallet': 'Wallet',
    'kpi.overallRoi': 'Overall ROI',
    'kpi.budgetUtilized': 'Budget Utilized',
    'kpi.costPerLead': 'Cost Per Lead',
    'currency.sar': 'SAR',
    'label.totalBudget': 'Total Budget to Optimize (SAR)',
    'hint.leaveBlank': 'Leave blank to use wallet balance',
    'placeholder.budget': 'e.g. {amount} (wallet balance)',
    'ai.title': 'AI Insights',
    'ai.titleLlm': 'AI Insights (LLM)',
    'ai.subtitle':
      'LLM-driven assessment, reallocation recommendations and alert rules.',
    'ai.performanceScore': 'Performance Score',
    'ai.empty': 'Click “Generate AI Insights” to analyze your campaigns.',
    'results.title': 'Recommended Allocation',
    'results.count': '{n} recommendations',
    'rec.recommended': 'Recommended',
    'rec.roi': 'ROI',
    'rec.leads': 'Leads',
    'rec.defaultCampaign': 'Campaign',
    'rec.defaultReason': 'Keep monitoring campaign performance.',
    'warn.walletLow': 'Current: {balance} (threshold: 5000)',
    'severity.critical': 'Critical',
    'severity.warning': 'Warning',
    'severity.high': 'High',
    'action.keep': 'Keep',
    'action.increase': 'Increase',
    'action.decrease': 'Decrease',
    'action.pause': 'Pause',
    'platform.unknown': 'Unknown',
    'error.load': 'Failed to load budget optimizer.',
    'error.optimize': 'Failed to optimize budget.',
    'error.insights': 'Failed to generate AI insights.',
    'error.apply': 'Failed to apply recommendations.',
    'error.invalidBudget':
      'Enter valid budget or fund marketing wallet first.',
    'error.noRecommendations': 'No applicable recommendations to apply.',
    'confirm.applyOne':
      'Apply 1 AI-recommended budget to campaigns?',
    'confirm.applyMany':
      'Apply {n} AI-recommended budgets to campaigns?',
    'success.applied': 'AI-recommended budgets applied.',
  },
  ar: {
    'title': 'محسّن الميزانية التنبؤي بالذكاء الاصطناعي',
    'subtitle':
      'يحلّل سجل الحملات ويوصي بالتوزيع الأمثل للميزانية لتعظيم العائد على الاستثمار.',
    'btn.manageAlerts': 'إدارة التنبيهات',
    'btn.optimize': 'تحسين الميزانية',
    'btn.optimizing': 'جارٍ التحسين...',
    'btn.refresh': 'تحديث',
    'btn.generateInsights': 'إنشاء رؤى الذكاء الاصطناعي',
    'btn.analyzing': 'جارٍ التحليل...',
    'btn.applyRecommendations': 'تطبيق التوصيات',
    'btn.applying': 'جارٍ التطبيق...',
    'kpi.wallet': 'المحفظة',
    'kpi.overallRoi': 'العائد الإجمالي',
    'kpi.budgetUtilized': 'الميزانية المستخدمة',
    'kpi.costPerLead': 'تكلفة العميل المحتمل',
    'currency.sar': 'ر.س',
    'label.totalBudget': 'إجمالي الميزانية للتحسين (ر.س)',
    'hint.leaveBlank': 'اتركه فارغاً لاستخدام رصيد المحفظة',
    'placeholder.budget': 'مثال: {amount} (رصيد المحفظة)',
    'ai.title': 'رؤى الذكاء الاصطناعي',
    'ai.titleLlm': 'رؤى الذكاء الاصطناعي (نموذج لغوي)',
    'ai.subtitle':
      'تقييم مدعوم بنموذج لغوي، وتوصيات إعادة التوزيع، وقواعد التنبيه.',
    'ai.performanceScore': 'درجة الأداء',
    'ai.empty':
      'انقر «إنشاء رؤى الذكاء الاصطناعي» لتحليل حملاتك.',
    'results.title': 'التوزيع الموصى به',
    'results.count': '{n} توصيات',
    'rec.recommended': 'الموصى به',
    'rec.roi': 'العائد',
    'rec.leads': 'عملاء محتملون',
    'rec.defaultCampaign': 'حملة',
    'rec.defaultReason': 'واصل مراقبة أداء الحملة.',
    'warn.walletLow': 'الحالي: {balance} (الحد الأدنى: 5000)',
    'severity.critical': 'حرج',
    'severity.warning': 'تحذير',
    'severity.high': 'مرتفع',
    'action.keep': 'الإبقاء',
    'action.increase': 'زيادة',
    'action.decrease': 'تخفيض',
    'action.pause': 'إيقاف مؤقت',
    'platform.unknown': 'غير معروف',
    'error.load': 'فشل تحميل محسّن الميزانية.',
    'error.optimize': 'فشل تحسين الميزانية.',
    'error.insights': 'فشل إنشاء رؤى الذكاء الاصطناعي.',
    'error.apply': 'فشل تطبيق التوصيات.',
    'error.invalidBudget':
      'أدخل ميزانية صالحة أو موّل محفظة التسويق أولاً.',
    'error.noRecommendations': 'لا توجد توصيات قابلة للتطبيق.',
    'confirm.applyOne':
      'هل تريد تطبيق ميزانية واحدة موصى بها بالذكاء الاصطناعي على الحملات؟',
    'confirm.applyMany':
      'هل تريد تطبيق {n} ميزانيات موصى بها بالذكاء الاصطناعي على الحملات؟',
    'success.applied': 'تم تطبيق الميزانيات الموصى بها بالذكاء الاصطناعي.',
  },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function boT(locale, key, vars) {
  const pack = BO_I18N[locale] || BO_I18N.en;
  let text = pack[key] ?? BO_I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
