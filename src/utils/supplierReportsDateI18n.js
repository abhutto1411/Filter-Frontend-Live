/** Reports-style date bar — Today / Yesterday / Last 7 / MTD / Custom (Riyadh inclusive). */
const SRD_I18N = {
    en: {
        'date.range': 'Date range',
        'date.from': 'From',
        'date.to': 'To',
        'date.apply': 'Apply',
        'date.preset.today': 'Today',
        'date.preset.yesterday': 'Yesterday',
        'date.preset.last_7': 'Last 7',
        'date.preset.mtd': 'MTD',
        'date.preset.custom': 'Custom',
    },
    ar: {
        'date.range': 'نطاق التاريخ',
        'date.from': 'من',
        'date.to': 'إلى',
        'date.apply': 'تطبيق',
        'date.preset.today': 'اليوم',
        'date.preset.yesterday': 'أمس',
        'date.preset.last_7': 'آخر 7 أيام',
        'date.preset.mtd': 'منذ بداية الشهر',
        'date.preset.custom': 'مخصص',
    },
};

export function srdT(locale, key, vars) {
    const pack = SRD_I18N[locale] || SRD_I18N.en;
    let text = pack[key] ?? SRD_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
