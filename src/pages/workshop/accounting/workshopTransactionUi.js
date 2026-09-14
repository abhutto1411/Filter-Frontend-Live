/** Shared helpers for the workshop Transactions first-class hub. */

export function moneySar(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 'SAR 0.00';
    return `SAR ${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDateYmd(value) {
    if (!value) return '—';
    try {
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch {
        return String(value).slice(0, 10);
    }
}

export function classifyCashKind(type, name) {
    const t = String(type || '').toUpperCase();
    if (t === 'BANK') return 'bank';
    if (t === 'CASH' || t === 'PETTY_CASH') return 'cash';
    const hay = `${type || ''} ${name || ''}`.toLowerCase();
    if (/\bbank\b|بنك|مصرف/.test(hay)) return 'bank';
    return 'cash';
}

export function cashAccountLabel(a) {
    if (!a) return '';
    if (String(a.kind || '') === 'SYSTEM_LOCKER_VAULT') {
        return `Locker Cash (CASH) — ${moneySar(a.currentBalance)}`;
    }
    const type = a.type ? ` (${a.type})` : '';
    return `${a.name}${type} — ${moneySar(a.currentBalance)}`;
}

export function accountComboLabel(a) {
    if (!a) return '';
    if (a.label) return a.label;
    const code = String(a.code || '').trim();
    const name = String(a.name || '').trim();
    if (code && name) return `${code} — ${name}`;
    return name || code || String(a.id || '');
}

export const ALL_COMBO = '__all__';
export const MONEY_PAGE_SIZES = [25, 50, 100, 200];
export const DEFAULT_MONEY_PAGE_SIZE = 25;

export function sliceLogPage(rows, page, pageSize) {
    const list = Array.isArray(rows) ? rows : [];
    const size = Math.max(1, Number(pageSize) || DEFAULT_MONEY_PAGE_SIZE);
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / size) || 1);
    const safePage = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (safePage - 1) * size;
    return {
        rows: list.slice(start, start + size),
        page: safePage,
        pages,
        from: total === 0 ? 0 : start + 1,
        to: Math.min(start + size, total),
        total,
    };
}

export function summarizeMoneyKpis(rows) {
    let cash = 0;
    let bank = 0;
    let total = 0;
    for (const r of Array.isArray(rows) ? rows : []) {
        if (String(r?.status || '').toLowerCase() === 'rejected') continue;
        const amt = Number(r?.amount || r?.totalDebit || 0);
        if (!Number.isFinite(amt)) continue;
        total += amt;
        const kind = classifyCashKind(r.cashBankAccountType || r.method, r.cashBankAccountName);
        if (kind === 'bank') bank += amt;
        else cash += amt;
    }
    return {
        cash: Number(cash.toFixed(2)),
        bank: Number(bank.toFixed(2)),
        total: Number(total.toFixed(2)),
    };
}

export const MONEY_LOG_CSS = `
.ws-tx-kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 14px;
}
.ws-tx-kpi {
    min-height: 78px;
    padding: 12px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
}
.ws-tx-kpi span {
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #64748b;
}
.ws-tx-kpi strong {
    font-size: 1.25rem;
    color: #0f172a;
}
.ws-tx-kpi--total {
    background: #fff7ed;
    border-color: #fdba74;
}
.ws-tx-filters {
    --ml-h: 44px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: flex-end;
    margin-bottom: 12px;
}
.ws-tx-filters label,
.ws-tx-field {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 700;
    color: #334155;
}
.ws-tx-field--combo {
    min-width: 240px;
    flex: 1 1 240px;
    max-width: 360px;
}
.ws-tx-filters input,
.ws-tx-filters .btn-portal,
.ws-tx-filters .btn-portal-outline,
.ws-tx-filters .ws-tx-combo .pi-search-box {
    height: var(--ml-h);
    min-height: var(--ml-h);
    box-sizing: border-box;
    border-radius: 10px;
}
.ws-tx-filters .btn-portal,
.ws-tx-filters .btn-portal-outline {
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}
.ws-tx-pager {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 12px 16px;
    margin-top: 16px;
    padding: 10px 12px 8px;
    font-size: 0.8125rem;
    color: #64748b;
    text-align: center;
}
.ws-tx-pager label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
.ws-tx-pager select {
    height: 36px;
    min-width: 72px;
    padding: 0 8px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    font-weight: 600;
}
.ws-tx-pager .btn-portal-outline {
    height: 36px;
    min-height: 36px;
    padding: 0 12px;
}
.ws-tx-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
}
@media (max-width: 720px) {
    .ws-tx-kpis { grid-template-columns: 1fr; }
}
`;
