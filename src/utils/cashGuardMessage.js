/**
 * Bilingual cash-guard / vault-negative error text for CoA adjust and posters.
 */

function fmtSar(n, locale) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n ?? '');
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(num);
}

/**
 * @param {Error|object} err
 * @param {'en'|'ar'} lang
 */
export function formatCashGuardMessage(err, lang = 'en') {
  if (!err) return '';
  const code = err.code || err?.details?.code;
  const accountCode = err.accountCode ?? '';
  const accountName = err.accountName ?? '';
  const available = err.available;
  const required = err.required;
  const label = [accountCode && `[${accountCode}]`, accountName]
    .filter(Boolean)
    .join(' ');

  if (code === 'LOCKER_VAULT_NEGATIVE_FORBIDDEN') {
    if (lang === 'ar') {
      return (
        err.messageAr ||
        err.branchViewNoteAr ||
        'لا يمكن أن يصبح رصيد خزنة اللوكر سالبًا. أرقام الفرع هي توزيع فقط؛ الرصيد القابل للترحيل هو رصيد الورشة (كل الفروع).'
      );
    }
    return (
      err.messageEn ||
      err.message ||
      err.branchViewNote ||
      'Locker Vault Cash cannot go negative. Branch figures are allocation views; the postable balance is the workshop GL (All branches).'
    );
  }

  if (code === 'INSUFFICIENT_CASH_BALANCE') {
    if (lang === 'ar') {
      const avail = fmtSar(available, 'ar-SA-u-nu-latn');
      const req = fmtSar(required, 'ar-SA-u-nu-latn');
      return `رصيد غير كافٍ على ${label || 'الحساب'}: المتاح ${avail} ر.س (رصيد الورشة، كل الفروع)، المطلوب ${req} ر.س`;
    }
    const avail = fmtSar(available, 'en-US');
    const req = fmtSar(required, 'en-US');
    return `Insufficient balance on ${label || 'account'}: available SAR ${avail} (workshop GL, all branches), required SAR ${req}`;
  }

  if (lang === 'ar' && typeof err.messageAr === 'string' && err.messageAr.trim()) {
    return err.messageAr.trim();
  }
  if (typeof err.messageEn === 'string' && err.messageEn.trim()) {
    return err.messageEn.trim();
  }
  return err.message || String(err);
}
