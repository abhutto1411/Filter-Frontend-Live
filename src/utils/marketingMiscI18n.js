/** Marketing FormShell / misc chrome — keyed by portal locale (`en` | `ar`). */
const MKT_MISC_I18N = {
  en: {
    'back': 'Back',
    'salesReports.title': 'Sales Reports',
    'salesOrders.title': 'Sales Orders',
  },
  ar: {
    'back': 'رجوع',
    'salesReports.title': 'تقارير المبيعات',
    'salesOrders.title': 'أوامر المبيعات',
  },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function mktMiscT(locale, key, vars) {
  const pack = MKT_MISC_I18N[locale] || MKT_MISC_I18N.en;
  let text = pack[key] ?? MKT_MISC_I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
