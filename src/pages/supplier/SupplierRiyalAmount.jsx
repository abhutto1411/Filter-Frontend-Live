import React from 'react';
import RiyalIcon from '../../components/RiyalIcon';

/** 2 dp HALF_UP display amount (no currency word — SAMA mark sits beside it). */
export function formatRiyal2(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '0.00';
    const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
    return rounded.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function SupplierRiyalAmount({ amount, size = 16, className = '' }) {
    return (
        <span
            className={`sp-riyal-amount ${className}`.trim()}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontVariantNumeric: 'tabular-nums',
            }}
        >
            <RiyalIcon size={size} />
            <span>{formatRiyal2(amount)}</span>
        </span>
    );
}
