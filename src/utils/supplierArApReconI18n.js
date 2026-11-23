/** Supplier AR–AP reconciliation report — locale `en` | `ar`. */
const RECON_I18N = {
    en: {
        'title': 'AR – AP reconciliation',
        'sub': 'Supplier receivables (1100) vs workshop sidecar payables. Read-only.',
        'th.workshop': 'Workshop',
        'th.ar': 'Supplier AR (1100)',
        'th.ap': 'Workshop AP',
        'th.diff': 'AR − AP',
        'th.linkedSi': 'Linked SI',
        'th.unlinkedSi': 'Unlinked SI',
        'th.linkedWpi': 'Linked WPI',
        'th.unlinkedWpi': 'Unlinked WPI',
        'empty': 'No affiliated workshops to reconcile.',
        'loading': 'Loading reconciliation…',
        'err.load': 'Could not load the AR–AP report.',
        'readonly': 'Read-only. No repair.',
        'hint': 'Linked counts use source_supplier_invoice_id only.',
    },
    ar: {
        'title': 'مطابقة الذمم المدينة والدائنة',
        'sub': 'ذمم المورد المدينة (1100) مقابل دائنية الورشة. للعرض فقط.',
        'th.workshop': 'الورشة',
        'th.ar': 'ذمم المورد المدينة (1100)',
        'th.ap': 'دائن الورشة',
        'th.diff': 'المدينة − الدائنة',
        'th.linkedSi': 'فواتير مبيعات مربوطة',
        'th.unlinkedSi': 'فواتير مبيعات غير مربوطة',
        'th.linkedWpi': 'فواتير شراء مربوطة',
        'th.unlinkedWpi': 'فواتير شراء غير مربوطة',
        'empty': 'لا توجد ورش مرتبطة للمطابقة.',
        'loading': 'جارٍ تحميل المطابقة…',
        'err.load': 'تعذر تحميل تقرير الذمم.',
        'readonly': 'للعرض فقط. لا يوجد إصلاح.',
        'hint': 'أعداد الربط تعتمد على source_supplier_invoice_id فقط.',
    },
};

export function reconT(locale, key, vars) {
    const pack = RECON_I18N[locale] || RECON_I18N.en;
    let text = pack[key] ?? RECON_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
