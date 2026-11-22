import React from 'react';

const SAR = '⃁';

function fmt2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return `${SAR}0.00`;
  return `${SAR}${v.toFixed(2)}`;
}

/**
 * H6 live balance hint.
 * - insufficient + OFF ⇒ red, blocks Post/Approve
 * - ON ⇒ amber warning, Post enabled
 */
export default function CashBalanceHint({
  locale = 'en',
  available,
  required,
  allowNegative = false,
  loading = false,
  className = '',
}) {
  const isAr = String(locale).toLowerCase().startsWith('ar');
  if (loading || available == null) {
    return (
      <div className={className} style={{ fontSize: 12, color: '#64748B' }}>
        {isAr ? 'جاري تحميل الرصيد…' : 'Loading balance…'}
      </div>
    );
  }

  const avail = Number(available) || 0;
  const need = Number(required) || 0;
  const shortBy = Math.max(0, Number((need - avail).toFixed(2)));
  const insufficient = shortBy > 0.0000001;

  if (!insufficient) {
    return (
      <div className={className} style={{ fontSize: 12, color: '#475569' }}>
        {isAr ? 'الرصيد المتاح: ' : 'Available: '}
        {fmt2(avail)}
      </div>
    );
  }

  if (allowNegative) {
    return (
      <div
        className={className}
        role="status"
        style={{
          fontSize: 12,
          color: '#92400E',
          border: '1px solid #F59E0B',
          background: '#FFFBEB',
          borderRadius: 6,
          padding: '6px 8px',
        }}
      >
        {isAr ? 'سيصبح الرصيد سالباً' : 'Balance will go negative'}
        {' · '}
        {fmt2(avail)} → −{fmt2(shortBy)}
      </div>
    );
  }

  return (
    <div
      className={className}
      role="alert"
      data-blocked="true"
      style={{
        fontSize: 12,
        color: '#991B1B',
        border: '1px solid #EF4444',
        background: '#FEF2F2',
        borderRadius: 6,
        padding: '6px 8px',
      }}
    >
      {isAr
        ? 'الرصيد غير كافٍ — يمكن الحفظ كمسودة فقط ولا يمكن الترحيل'
        : 'Insufficient balance — can be saved as draft only, cannot be posted'}
      {' · '}
      {isAr ? 'المتاح ' : 'Available '}
      {fmt2(avail)}
      {isAr ? ' · المطلوب ' : ' · Required '}
      {fmt2(need)}
    </div>
  );
}

export function cashHintBlocksPost({ available, required, allowNegative }) {
  if (allowNegative) return false;
  if (available == null || required == null) return false;
  return Number(required) - Number(available) > 0.0000001;
}
