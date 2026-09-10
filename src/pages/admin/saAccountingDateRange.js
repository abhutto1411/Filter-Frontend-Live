export const SA_ACCOUNTING_DATE_RANGE_KEY = 'sa-accounting-date-range-v1';

function pad(n) {
    return String(n).padStart(2, '0');
}

export function startOfMonthISO(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

export function todayISO(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toDateOnly(value) {
    const s = String(value ?? '').trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}

export function loadSaAccountingDateRange() {
    try {
        const raw = sessionStorage.getItem(SA_ACCOUNTING_DATE_RANGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            const dateFrom = toDateOnly(parsed?.dateFrom);
            const dateTo = toDateOnly(parsed?.dateTo);
            if (dateFrom && dateTo) return { dateFrom, dateTo };
        }
    } catch {
        /* ignore */
    }
    return { dateFrom: startOfMonthISO(), dateTo: todayISO() };
}

export function saveSaAccountingDateRange(range) {
    try {
        sessionStorage.setItem(
            SA_ACCOUNTING_DATE_RANGE_KEY,
            JSON.stringify({
                dateFrom: toDateOnly(range?.dateFrom) || startOfMonthISO(),
                dateTo: toDateOnly(range?.dateTo) || todayISO(),
            }),
        );
    } catch {
        /* ignore */
    }
}

export function dateParamsForApi(dateRange) {
    if (!dateRange) return {};
    const p = {};
    const from = toDateOnly(dateRange.dateFrom);
    const to = toDateOnly(dateRange.dateTo);
    if (from) p.dateFrom = from;
    if (to) p.dateTo = to;
    return p;
}

export function buildMonitorLedgerUrl(accountId, account, dateRange) {
    const params = new URLSearchParams();
    if (account?.code) params.set('code', account.code);
    if (account?.name) params.set('name', account.name);
    if (account?.type) params.set('type', account.type);
    if (dateRange?.dateFrom) params.set('dateFrom', dateRange.dateFrom);
    if (dateRange?.dateTo) params.set('dateTo', dateRange.dateTo);
    const qs = params.toString();
    return `/admin/accounting/ledger/${encodeURIComponent(accountId)}${qs ? `?${qs}` : ''}`;
}

/** HQ control account [1110] — corporate customers list. */
export function buildCorporateArControlUrl(dateRange) {
    const params = new URLSearchParams();
    if (dateRange?.dateFrom) params.set('dateFrom', dateRange.dateFrom);
    if (dateRange?.dateTo) params.set('dateTo', dateRange.dateTo);
    const qs = params.toString();
    return `/admin/accounting/corporate-ar${qs ? `?${qs}` : ''}`;
}

export function buildCorporateArLedgerUrl(corporateAccountId, dateRange) {
    const params = new URLSearchParams();
    if (dateRange?.dateFrom) params.set('dateFrom', dateRange.dateFrom);
    if (dateRange?.dateTo) params.set('dateTo', dateRange.dateTo);
    const qs = params.toString();
    return `/admin/accounting/corporate-ar/${encodeURIComponent(corporateAccountId)}${qs ? `?${qs}` : ''}`;
}

export function isCorporateArControlAccount(account) {
    return String(account?.code ?? '').trim() === '1110';
}

/** HQ control account [1300] — Tabby/Tamara BNPL settlement receivable. */
export function buildBnplSettlementControlUrl(dateRange) {
    const params = new URLSearchParams();
    if (dateRange?.dateFrom) params.set('dateFrom', dateRange.dateFrom);
    if (dateRange?.dateTo) params.set('dateTo', dateRange.dateTo);
    const qs = params.toString();
    return `/admin/accounting/bnpl-settlement${qs ? `?${qs}` : ''}`;
}

export function isBnplSettlementControlAccount(account) {
    return String(account?.code ?? '').trim() === '1300';
}
