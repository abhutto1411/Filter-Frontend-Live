import React from 'react';
import './Shimmer.css';

/**
 * Shared shimmer primitives for the Supplier Portal.
 * Import CSS once via SupplierLayout, or rely on this file’s side-effect import.
 */

export function Shimmer({ className = '', style, children, as: Tag = 'div', ...rest }) {
    return (
        <Tag className={`sp-shimmer ${className}`.trim()} style={style} {...rest}>
            {children}
        </Tag>
    );
}

export function ShimmerLine({ width = '100%', height = 12, style, className = '', rounded }) {
    return (
        <Shimmer
            className={`${rounded ? 'sp-shimmer--pill' : ''} ${className}`.trim()}
            style={{ width, height, display: 'block', maxWidth: '100%', ...style }}
        />
    );
}

export function ShimmerKpiGrid({ cards = 4 }) {
    return (
        <div className="sp-shimmer-kpi-grid">
            {Array.from({ length: cards }).map((_, i) => (
                <div key={i} className="sp-shimmer-kpi-card">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <ShimmerLine height={12} width="58%" style={{ marginBottom: 12 }} />
                        <ShimmerLine height={28} width="42%" style={{ marginBottom: 8 }} />
                        <ShimmerLine height={10} width="68%" />
                    </div>
                    <Shimmer style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
                </div>
            ))}
        </div>
    );
}

export function ShimmerOrderStatusBar({ pillCount = 6 }) {
    return (
        <div className="ws-section" style={{ marginBottom: 16 }}>
            <div className="sp-shimmer-status-bar">
                <Shimmer style={{ height: 14, width: 200, flexShrink: 0 }} />
                <div className="sp-shimmer-status-pills">
                    {Array.from({ length: pillCount }).map((_, j) => (
                        <Shimmer
                            key={j}
                            className="sp-shimmer--pill"
                            style={{ height: 28, width: 88 + (j % 3) * 12 }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ShimmerListRows({ rows = 6 }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="sp-shimmer-list-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <ShimmerLine height={14} width="36%" style={{ maxWidth: 140, marginBottom: 8 }} />
                        <ShimmerLine height={10} width="78%" />
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <ShimmerLine height={14} width={72} style={{ marginBottom: 8, marginLeft: 'auto' }} />
                        <Shimmer className="sp-shimmer--pill" style={{ height: 22, width: 72, marginLeft: 'auto' }} />
                    </div>
                </div>
            ))}
        </>
    );
}

export function ShimmerStatStrip({ cards = 7 }) {
    return (
        <div className="sp-shimmer-stat-strip">
            {Array.from({ length: cards }).map((_, i) => (
                <div key={i} className="sp-shimmer-stat-card">
                    <ShimmerLine height={9} width="45%" style={{ marginBottom: 6 }} />
                    <ShimmerLine height={9} width="75%" style={{ marginBottom: 10 }} />
                    <ShimmerLine height={20} width="35%" />
                </div>
            ))}
        </div>
    );
}

export function ShimmerTable({ rows = 8, columns = 5, className = '' }) {
    return (
        <div
            className={`sp-shimmer-table-wrap sp-shimmer-busy ${className}`.trim()}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="sp-shimmer-table-header">
                {Array.from({ length: columns }).map((_, i) => (
                    <Shimmer key={i} style={{ height: 14, flex: 1, minWidth: 48 }} />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="sp-shimmer-table-row">
                    {Array.from({ length: columns }).map((_, c) => (
                        <Shimmer key={c} style={{ height: 12, flex: 1, minWidth: 36 }} />
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Dense table for premium-table / ws-table layouts */
export function ShimmerTableDense({ rows = 6, columns = 6 }) {
    return (
        <div className="ws-section sp-shimmer-busy" role="status" aria-live="polite" aria-busy="true">
            <ShimmerTable rows={rows} columns={columns} />
        </div>
    );
}

export function ShimmerCatalogGrid({ cards = 8 }) {
    return (
        <div
            className="sp-shimmer-catalog-grid sp-shimmer-busy"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            {Array.from({ length: cards }).map((_, i) => (
                <div key={i} className="sp-shimmer-catalog-card">
                    <Shimmer style={{ height: 120, width: '100%', marginBottom: 12, borderRadius: 10 }} />
                    <ShimmerLine height={14} width="70%" style={{ marginBottom: 8 }} />
                    <ShimmerLine height={10} width="90%" style={{ marginBottom: 12 }} />
                    <ShimmerLine height={36} width="100%" rounded />
                </div>
            ))}
        </div>
    );
}

export function ShimmerOrderQueueCards({ count = 4 }) {
    return (
        <div className="sp-shimmer-busy" role="status" aria-live="polite" aria-busy="true">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="sp-shimmer-order-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <ShimmerLine height={16} width={120} style={{ marginBottom: 8 }} />
                            <ShimmerLine height={12} width="60%" style={{ marginBottom: 12 }} />
                            <ShimmerLine height={14} width="40%" />
                        </div>
                        <Shimmer className="sp-shimmer--pill" style={{ height: 26, width: 100 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                        <Shimmer className="sp-shimmer--pill" style={{ height: 32, width: 72 }} />
                        <Shimmer className="sp-shimmer--pill" style={{ height: 32, width: 88 }} />
                        <Shimmer className="sp-shimmer--pill" style={{ height: 32, width: 76 }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ShimmerPanel({ children, style, className = '' }) {
    return (
        <div
            className={`ws-section sp-shimmer-busy ${className}`.trim()}
            style={style}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            {children}
        </div>
    );
}

/**
 * Shimmer rows that drop into an existing `<tbody>` element. Use this to
 * replace `<tr><td colSpan={N}>Loading…</td></tr>` placeholder rows with a
 * skeleton that matches the visible column count exactly.
 */
export function ShimmerTableBodyRows({ rows = 6, columns = 6 }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, r) => (
                <tr key={`s-row-${r}`} aria-hidden="true">
                    {Array.from({ length: columns }).map((__, c) => (
                        <td
                            key={`s-cell-${r}-${c}`}
                            style={{ padding: '12px 10px' }}
                        >
                            <Shimmer
                                style={{
                                    height: 12,
                                    width: c === 0 ? '70%' : c === columns - 1 ? '40%' : '85%',
                                    display: 'block',
                                }}
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

export function ShimmerTextBlock({ lines = 4 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            {Array.from({ length: lines }).map((_, i) => (
                <ShimmerLine key={i} height={12} width={i === lines - 1 ? '55%' : `${85 - i * 8}%`} />
            ))}
        </div>
    );
}
