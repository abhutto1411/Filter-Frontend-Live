import React from 'react';

/**
 * Shared summary strip for accounting reports (mockup cards).
 * @param {{ items: Array<{ key: string, label: string, value: React.ReactNode, tone?: 'ok'|'bad'|'muted' }> }} props
 */
export default function ReportSummaryCards({ items = [] }) {
    return (
        <div className="acct-kpi-grid">
            {items.map((item) => {
                const title =
                    typeof item.value === 'string' || typeof item.value === 'number'
                        ? String(item.value)
                        : undefined;
                const toneClass =
                    item.tone === 'ok'
                        ? ' acct-kpi-value--ok'
                        : item.tone === 'bad'
                          ? ' acct-kpi-value--bad'
                          : item.tone === 'muted'
                            ? ' acct-kpi-value--muted'
                            : '';
                return (
                    <div key={item.key} className="acct-kpi-card">
                        <div className="acct-kpi-label" title={item.label}>
                            {item.label}
                        </div>
                        <div className={`acct-kpi-value${toneClass}`} title={title}>
                            {item.value}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
