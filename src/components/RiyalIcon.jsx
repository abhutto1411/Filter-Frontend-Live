import React from 'react';

export const SAMA_RIYAL_PATH_1 =
  'M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z';

export const SAMA_RIYAL_PATH_2 =
  'M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.250,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.140-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z';

/**
 * Official SAMA 2025 Saudi Riyal symbol (inline SVG — not a Unicode font glyph).
 * Does not mirror in RTL; the mark is direction-neutral.
 */
export default function RiyalIcon({
  size = 16,
  className = '',
  title,
  ...rest
}) {
  const px = Number(size) || 16;
  const label = title || 'Saudi Riyal / ريال سعودي';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1124.14 1256.39"
      width={px}
      height={px}
      className={className}
      role="img"
      aria-label={label}
      focusable="false"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        direction: 'ltr',
        transform: 'none',
      }}
      {...rest}
    >
      <title>{label}</title>
      <path fill="currentColor" d={SAMA_RIYAL_PATH_1} />
      <path fill="currentColor" d={SAMA_RIYAL_PATH_2} />
    </svg>
  );
}
