import React from 'react';
import { BASE_URL } from '../services/api';
import { shouldShowDevApiBadge } from './devApiBadgeUtil';

export { shouldShowDevApiBadge };

/**
 * Dev-only footer badge so Asif can see which backend the UI is hitting.
 * Hidden in production builds (import.meta.env.PROD).
 */
export default function DevApiBadge({ locale = 'en' }) {
  if (!shouldShowDevApiBadge(import.meta.env.PROD)) return null;
  const ar = String(locale || '').toLowerCase().startsWith('ar');
  let origin = String(BASE_URL || '');
  try {
    origin = new URL(BASE_URL).origin;
  } catch {
    /* keep raw */
  }
  const label = ar ? `الخادم: ${origin}` : `API: ${origin}`;
  return (
    <div
      data-testid="dev-api-badge"
      style={{
        position: 'fixed',
        right: 8,
        bottom: 8,
        zIndex: 9999,
        fontSize: 11,
        lineHeight: 1.3,
        padding: '4px 8px',
        borderRadius: 6,
        background: 'rgba(15, 23, 42, 0.82)',
        color: '#F8FAFC',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        pointerEvents: 'none',
      }}
    >
      {label}
    </div>
  );
}
