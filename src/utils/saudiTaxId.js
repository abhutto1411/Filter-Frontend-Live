/**
 * ZATCA VAT registration number: 15 digits —
 * [1] GCC member state (3 = KSA) · [8] serial · [1] check digit · [3] subsidiary · [2] tax type.
 * The first and the last digit must be 3. Individuals use a 12-digit personal TIN
 * ([2] region of residence · [10] unique ID). Mirrors filter_backend corporate-identity.util.ts.
 */

const ARABIC_DIGITS = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

const MESSAGES = {
    en: {
        digits: 'VAT number must contain digits only.',
        length: 'VAT number must be exactly 15 digits (entered {n}).',
        start: 'Saudi VAT number must start with 3 (Kingdom of Saudi Arabia GCC code).',
        end: 'Saudi VAT number must end with 3 (ZATCA tax type).',
        tin: 'Tax ID must be a 15-digit VAT number or a 12-digit personal tax identification number (TIN).',
        vatHint: '15 digits, starts and ends with 3 — e.g. 310123456700003',
        legacy: 'The saved VAT number is not a valid Saudi VAT number. Please correct it.',
        nationalAddress: 'National Address / العنوان الوطني',
        nationalAddressPh: 'e.g. RRRD2929 — building no., street, district, city, postal code',
    },
    ar: {
        digits: 'يجب أن يحتوي الرقم الضريبي على أرقام فقط.',
        length: 'يجب أن يتكون الرقم الضريبي من 15 رقمًا (تم إدخال {n}).',
        start: 'يجب أن يبدأ الرقم الضريبي السعودي بالرقم 3 (رمز المملكة العربية السعودية الخليجي).',
        end: 'يجب أن ينتهي الرقم الضريبي السعودي بالرقم 3 (نوع الضريبة لدى هيئة الزكاة والضريبة والجمارك).',
        tin: 'يجب أن يكون الرقم الضريبي 15 رقمًا أو رقم تعريف ضريبي شخصي من 12 رقمًا.',
        vatHint: '15 رقمًا يبدأ وينتهي بالرقم 3 — مثال: 310123456700003',
        legacy: 'الرقم الضريبي المحفوظ غير صالح وفق نظام هيئة الزكاة والضريبة والجمارك. يرجى تصحيحه.',
        nationalAddress: 'العنوان الوطني',
        nationalAddressPh: 'مثال: RRRD2929 — رقم المبنى، الشارع، الحي، المدينة، الرمز البريدي',
    },
};

function msg(locale, key, n) {
    const table = String(locale || '').toLowerCase().startsWith('ar') ? MESSAGES.ar : MESSAGES.en;
    return (table[key] ?? MESSAGES.en[key]).replace('{n}', String(n ?? ''));
}

/** Label / placeholder / hint text shared by every VAT + National Address field. */
export function taxIdText(locale, key) {
    return msg(locale, key);
}

/** Arabic-Indic digits → ASCII, spaces and dashes removed. */
export function compactTaxId(value) {
    return String(value ?? '')
        .replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d] ?? d)
        .replace(/[\s-]+/g, '');
}

/** '' when empty or valid; otherwise the reason in the page language. */
export function corporateVatError(value, locale) {
    const vat = compactTaxId(value);
    if (!vat) return '';
    if (!/^\d+$/.test(vat)) return msg(locale, 'digits');
    if (vat.length !== 15) return msg(locale, 'length', vat.length);
    if (vat[0] !== '3') return msg(locale, 'start');
    if (vat[14] !== '3') return msg(locale, 'end');
    return '';
}

/** Individual (walk-in) customers: a 15-digit VAT number or a 12-digit personal TIN. */
export function individualTaxIdError(value, locale) {
    const id = compactTaxId(value);
    if (!id) return '';
    if (/^\d{12}$/.test(id)) return '';
    if (/^\d{15}$/.test(id)) return corporateVatError(id, locale);
    return msg(locale, 'tin');
}

/** True when the edited value differs from the saved one (spaces / dashes ignored). */
export function taxIdChanged(next, saved) {
    return compactTaxId(next) !== compactTaxId(saved);
}
