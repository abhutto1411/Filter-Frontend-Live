import React from 'react';
import { Link } from 'react-router-dom';
import { formatAccountingNumber } from '../../../utils/plBranchTableDisplay';

/**
 * Formatted amount as a full-page proof <Link>. Zero still links. No modals.
 */
export default function ProofAmount({
  value,
  href,
  text,
  title = 'View proof',
  'aria-label': ariaLabel,
}) {
  const display =
    text != null
      ? text
      : value == null || value === ''
        ? ''
        : formatAccountingNumber(value);
  if (display === '') return null;
  if (!href) return display;
  return (
    <Link
      to={href}
      title={title}
      aria-label={ariaLabel || title}
      className="proof-amount-link"
      style={{
        color: 'inherit',
        textDecoration: 'none',
        borderBottom: '1px dotted transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderBottomColor = 'currentColor';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderBottomColor = 'transparent';
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderBottomColor = 'currentColor';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderBottomColor = 'transparent';
      }}
    >
      {display}
    </Link>
  );
}
