import React from 'react';

const COLORS = {
    draft: { bg: '#F1F5F9', fg: '#475569' },
    sent: { bg: '#DBEAFE', fg: '#1D4ED8' },
    accepted: { bg: '#DCFCE7', fg: '#15803D' },
    rejected: { bg: '#FEE2E2', fg: '#B91C1C' },
    invoiced: { bg: '#EDE9FE', fg: '#6D28D9' },
};

export default function QuoteStatusBadge({ status, label }) {
    const key = String(status || 'draft');
    const c = COLORS[key] || COLORS.draft;
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: c.bg,
                color: c.fg,
                whiteSpace: 'nowrap',
            }}
        >
            {label || key}
        </span>
    );
}
