import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { mktMiscT } from '../../utils/marketingMiscI18n';

export function MarketingFormShell({
  title,
  subtitle,
  backLabel,
  onBack,
  children,
  className = 'mkp-page mkp-form-page',
}) {
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const resolvedBack = backLabel ?? mktMiscT(locale, 'back');

  return (
    <div className={className} dir={locale === 'ar' ? 'rtl' : undefined}>
      <button type="button" className="mkp-back-btn" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={2} />
        {resolvedBack}
      </button>

      <header className="mkp-form-page-header">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>

      {children}
    </div>
  );
}
