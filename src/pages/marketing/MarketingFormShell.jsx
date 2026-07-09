import React from 'react';
import { ArrowLeft } from 'lucide-react';

export function MarketingFormShell({
  title,
  subtitle,
  backLabel = 'Back',
  onBack,
  children,
  className = 'mkp-page mkp-form-page',
}) {
  return (
    <div className={className}>
      <button type="button" className="mkp-back-btn" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={2} />
        {backLabel}
      </button>

      <header className="mkp-form-page-header">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>

      {children}
    </div>
  );
}
