import React from 'react';

function sar(n) {
    return `SAR ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ConnectAdherenceList({ categories }) {
    const rows = Array.isArray(categories) ? categories : [];
    if (!rows.length) {
        return (
            <p className="cn-panel-empty">
                Task budget progress appears after you assign a task and set its budget.
            </p>
        );
    }

    return (
        <div className="cn-adhere">
            {rows.map((c, i) => {
                const hasBudget = c.budget > 0;
                const pct = hasBudget ? Math.min(140, (c.spent / c.budget) * 100) : 0;
                const tone =
                    hasBudget && c.spent > c.budget
                        ? 'over'
                        : hasBudget && c.spent > c.budget * 0.8
                          ? 'warn'
                          : 'ok';
                return (
                    <div className="cn-adhere-row" key={`${c.label || c.department}-${i}`}>
                        <div className="cn-adhere-label">
                            <strong>{c.label || c.department}</strong>
                            <span>{hasBudget ? `${Math.round((c.spent / c.budget) * 100)}%` : '—'}</span>
                        </div>
                        <div className="cn-adhere-track">
                            <span
                                className={`cn-adhere-fill is-${tone}`}
                                style={{ width: `${hasBudget ? Math.min(100, pct) : 0}%` }}
                            />
                        </div>
                        <p>
                            {sar(c.spent)}
                            {hasBudget ? ` / ${sar(c.budget)}` : ' · no budget set'}
                            {c.pending ? ` · ${sar(c.pending)} pending` : ''}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
