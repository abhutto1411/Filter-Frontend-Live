import React from 'react';

/** Money formatter — defaults to SAR for the supplier portal. */
export function money(value, currency = 'SAR', { showSymbol = true } = {}) {
    const n = Number(value || 0);
    const formatted = n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    if (!showSymbol) return formatted;
    return `${currency} ${formatted}`;
}

/**
 * Signed net balance for a COA row from its closing debit/credit columns
 * (trial-balance style: only one side is non-zero per account).
 */
export function coaNetBalance(accountType, debit, credit) {
    const rd = Number(debit) || 0;
    const rc = Number(credit) || 0;
    const normalDebit = accountType === 'ASSET' || accountType === 'EXPENSE';
    return normalDebit ? rd - rc : rc - rd;
}

/** Format COA balance column — zero nets render as em dash. */
export function formatCoaBalance(accountType, debit, credit, currency = 'SAR') {
    const net = coaNetBalance(accountType, debit, credit);
    if (Math.abs(net) < 0.005) return '—';
    return money(net, currency);
}

/** Format a date or ISO string as `YYYY-MM-DD`. */
export function fmtDate(value) {
    if (!value) return '—';
    try {
        const d = value instanceof Date ? value : new Date(value);
        if (isNaN(d.getTime())) return String(value).slice(0, 10);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch {
        return String(value).slice(0, 10);
    }
}

/** ISO date for today (yyyy-mm-dd). */
export function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO date for the first day of the current month. */
export function startOfMonthISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

export const ACCOUNT_SUBTYPES_BY_TYPE = {
    ASSET: ['CURRENT', 'FIXED', 'OTHER'],
    LIABILITY: ['CURRENT', 'LONG_TERM', 'OTHER'],
    EQUITY: ['OWNERS_EQUITY', 'RETAINED_EARNINGS', 'OTHER_EQUITY'],
    INCOME: ['OPERATING_REVENUE', 'OTHER_INCOME'],
    EXPENSE: ['COST_OF_GOODS_SOLD', 'OPERATING_EXPENSE', 'OTHER_EXPENSE'],
};

export const CASH_FLOW_CATEGORIES = ['', 'OPERATING', 'INVESTING', 'FINANCING'];

/** Sectioned card layout. */
export function AcctCard({ title, action, children, style }) {
    return (
        <section
            style={{
                background: '#ffffff',
                borderRadius: 14,
                border: '1px solid rgba(0,0,0,0.08)',
                padding: 18,
                marginBottom: 14,
                ...style,
            }}
        >
            {(title || action) && (
                <header
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                        gap: 10,
                    }}
                >
                    {title ? (
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                            {title}
                        </h3>
                    ) : <span />}
                    {action || null}
                </header>
            )}
            {children}
        </section>
    );
}

export function AcctError({ message }) {
    if (!message) return null;
    return (
        <div
            style={{
                padding: 12,
                background: '#FEF2F2',
                color: '#B91C1C',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 12,
            }}
        >
            {message}
        </div>
    );
}

export function AcctEmpty({ message }) {
    return (
        <div style={{ padding: 28, textAlign: 'center', color: '#64748B', fontSize: 14 }}>
            {message}
        </div>
    );
}

export function AcctLoading({ label = 'Loading…' }) {
    return (
        <div style={{ padding: 24, color: '#64748B', fontSize: 13 }}>{label}</div>
    );
}

/** Compact form input. */
export function Field({ label, children, hint, required = false }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#334155' }}>
            <span>
                {label}
                {required ? <span style={{ color: '#DC2626' }}> *</span> : null}
            </span>
            {children}
            {hint ? <span style={{ fontWeight: 500, color: '#64748B' }}>{hint}</span> : null}
        </label>
    );
}

export const inputStyle = {
    border: '1px solid #CBD5E1',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    width: '100%',
    background: '#fff',
    color: '#0F172A',
};

export const primaryBtnStyle = {
    background: '#0F172A',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
};

export const outlineBtnStyle = {
    background: '#ffffff',
    color: '#0F172A',
    border: '1px solid #CBD5E1',
    borderRadius: 8,
    padding: '8px 14px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
};

export const dangerBtnStyle = {
    background: '#ffffff',
    color: '#B91C1C',
    border: '1px solid #FCA5A5',
    borderRadius: 8,
    padding: '8px 14px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
};

/** Simple paginator. */
export function Pager({ total, limit, offset, onChange }) {
    const totalNum = Number(total || 0);
    const limitNum = Math.max(1, Number(limit || 50));
    const page = Math.floor(Number(offset || 0) / limitNum) + 1;
    const pages = Math.max(1, Math.ceil(totalNum / limitNum));
    if (totalNum <= limitNum) return null;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', padding: 8 }}>
            <button
                type="button"
                style={outlineBtnStyle}
                disabled={page <= 1}
                onClick={() => onChange(Math.max(0, offset - limitNum))}
            >
                Prev
            </button>
            <span style={{ fontSize: 12, color: '#475569' }}>
                Page {page} of {pages} · {totalNum.toLocaleString()} total
            </span>
            <button
                type="button"
                style={outlineBtnStyle}
                disabled={page >= pages}
                onClick={() => onChange(offset + limitNum)}
            >
                Next
            </button>
        </div>
    );
}
