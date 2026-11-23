import { WORKSHOP_ACC_TAB_SLUG } from '../../utils/workshopAccTabSlug.js';
import {
    BS_SNAPSHOT_KPI_KEYS,
    PL_BASIS_KPI_KEYS,
    parseAccountingBasis,
} from './workshopDashboardScope.js';

export const DASHBOARD_KPI_ORDER = [
    'sales',
    'income',
    'expenses',
    'netProfit',
    'grossMargin',
    'cashAndBank',
    'accountsReceivable',
    'inventoryValue',
    'lowStock',
    'pendingOrders',
];

/** KPI cards with a single as-of snapshot (not period totals). */
export const DASHBOARD_POINT_IN_TIME_KPI_IDS = [
    'inventoryValue',
    'lowStock',
    'pendingOrders',
    'cashAndBank',
    'accountsReceivable',
];

const FORBIDDEN_KPI_CAPTIONS = ['as of now', 'not filtered by date'];

export const LEDGER_KPI_KEYS = [
    'income',
    'expenses',
    'netProfit',
    'grossMargin',
    'cashAndBank',
    'accountsReceivable',
];

const LEDGER_TAB = {
    income: 'acc-profit-loss',
    expenses: 'acc-profit-loss',
    netProfit: 'acc-profit-loss',
    grossMargin: 'acc-profit-loss',
    cashAndBank: 'acc-balance-sheet',
    accountsReceivable: 'acc-balance-sheet',
};

const EX_VAT_NOTE = 'Ex-VAT is the accounting value; Inc-VAT is shown for reference.';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function finite(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export function formatBooksDate(ymd) {
    const s = String(ymd || '').slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return s;
    return `${m[3]}/${m[2]}/${m[1]}`;
}

function pickKpiAsOfRaw(dashboard, kpiSummary, valuation, dateTo) {
    for (const obj of [dashboard, kpiSummary, valuation]) {
        if (!obj || typeof obj !== 'object') continue;
        const v = obj.kpiAsOf ?? obj.kpi_as_of;
        if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    const valAsOf = valuation?.asOf ?? valuation?.as_of;
    if (valAsOf != null && String(valAsOf).trim() !== '') return String(valAsOf).trim();
    return dateTo ? String(dateTo).slice(0, 10) : '';
}

/** Display caption date for point-in-time dashboard KPI cards (dd/mm/yyyy). */
export function resolveDashboardKpiAsOf({ dashboard, kpiSummary, valuation, dateTo } = {}) {
    const raw = pickKpiAsOfRaw(dashboard, kpiSummary, valuation, dateTo);
    return raw ? formatBooksDate(raw) : '';
}

export function pickDashboardArBreakdown(...sources) {
    for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        const arTrade = finite(src.arTrade ?? src.ar_trade);
        const arDueFromHq = finite(src.arDueFromHq ?? src.ar_due_from_hq);
        const arCorporate = finite(src.arCorporate ?? src.ar_corporate);
        if (arTrade != null || arDueFromHq != null || arCorporate != null) {
            return {
                arTrade,
                arDueFromHq: arDueFromHq ?? arCorporate,
            };
        }
        const arCard = Array.isArray(src.cards)
            ? src.cards.find((c) => c.key === 'accountsReceivable')
            : null;
        if (arCard) {
            const trade = finite(arCard.arTrade ?? arCard.ar_trade);
            const hq = finite(arCard.arDueFromHq ?? arCard.ar_due_from_hq ?? arCard.arCorporate ?? arCard.ar_corporate);
            if (trade != null || hq != null) {
                return { arTrade: trade, arDueFromHq: hq };
            }
        }
    }
    return { arTrade: null, arDueFromHq: null };
}

export function assertNoForbiddenKpiCaptions(cards) {
    const blob = JSON.stringify(cards || []).toLowerCase();
    return FORBIDDEN_KPI_CAPTIONS.every((phrase) => !blob.includes(phrase));
}

export function formatDashKpiAmount(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return null;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Change % on Ex-VAT of two shown values (2 dp). */
export function changePercentExVat(current, previous) {
    const cur = finite(current);
    const prev = finite(previous);
    if (cur == null || prev == null) return null;
    if (prev === 0 && cur === 0) return null;
    if (prev === 0) return null;
    return Math.round(((cur - prev) / Math.abs(prev)) * 10000) / 100;
}

export function formatDashChangePercent(n) {
    if (n == null || !Number.isFinite(n)) return null;
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

export function riyadhYmd(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}

function lastDayOfMonth(year, month1to12) {
    return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** Riyadh calendar window for K-1 presets. */
export function dashboardPeriodRange(preset, now = new Date()) {
    const today = riyadhYmd(now);
    const [ys, ms, ds] = today.split('-');
    const y = Number(ys);
    const m = Number(ms);
    if (preset === 'today') {
        return { dateFrom: today, dateTo: today };
    }
    if (preset === 'this_week') {
        const day = Number(ds);
        const utc = new Date(Date.UTC(y, m - 1, day));
        const dow = utc.getUTCDay();
        const mondayOffset = dow === 0 ? 6 : dow - 1;
        utc.setUTCDate(utc.getUTCDate() - mondayOffset);
        const from = `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
        return { dateFrom: from, dateTo: today };
    }
    if (preset === 'last_month') {
        const lm = m === 1 ? 12 : m - 1;
        const ly = m === 1 ? y - 1 : y;
        const last = lastDayOfMonth(ly, lm);
        return { dateFrom: `${ly}-${pad2(lm)}-01`, dateTo: `${ly}-${pad2(lm)}-${pad2(last)}` };
    }
    if (preset === 'quarter') {
        const qStart = m <= 3 ? 1 : m <= 6 ? 4 : m <= 9 ? 7 : 10;
        return { dateFrom: `${y}-${pad2(qStart)}-01`, dateTo: today };
    }
    if (preset === 'year') {
        return { dateFrom: `${y}-01-01`, dateTo: today };
    }
    return { dateFrom: `${y}-${pad2(m)}-01`, dateTo: today || `${ys}-${ms}-${ds}` };
}

/** RF-08 previous window on Riyadh YYYY-MM-DD (full month → prior full month). */
export function previousRiyadhYmdWindow(fromYmd, toYmd) {
    if (!fromYmd || !toYmd) return { from: '', to: '' };
    const [fy, fm, fd] = String(fromYmd).split('-').map(Number);
    const [ty, tm, td] = String(toYmd).split('-').map(Number);
    if (![fy, fm, fd, ty, tm, td].every(Number.isFinite)) return { from: '', to: '' };
    const from = new Date(Date.UTC(fy, fm - 1, fd));
    const to = new Date(Date.UTC(ty, tm - 1, td));
    const startDay = from.getUTCDate();
    const endDay = to.getUTCDate();
    const sameMonth =
        from.getUTCFullYear() === to.getUTCFullYear() &&
        from.getUTCMonth() === to.getUTCMonth();
    const last = new Date(Date.UTC(fy, fm, 0)).getUTCDate();
    const isFullMonth = sameMonth && startDay === 1 && endDay === last;
    const fmt = (d) => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    if (isFullMonth) {
        const prevEnd = new Date(Date.UTC(fy, fm - 1, 0));
        const prevStart = new Date(
            Date.UTC(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth(), 1),
        );
        return { from: fmt(prevStart), to: fmt(prevEnd) };
    }
    const n = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    const prevEnd = new Date(from.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (n - 1) * 86400000);
    return { from: fmt(prevStart), to: fmt(prevEnd) };
}

export function previousPeriodLabel(fromYmd, toYmd) {
    if (!fromYmd || !toYmd) return '';
    const [fy, fm] = String(fromYmd).split('-').map(Number);
    const [ty, tm, td] = String(toYmd).split('-').map(Number);
    if (![fy, fm, ty, tm, td].every(Number.isFinite)) return `${fromYmd}–${toYmd}`;
    const last = lastDayOfMonth(fy, fm);
    const fullMonth = fy === ty && fm === tm && String(fromYmd).endsWith('-01') && td === last;
    if (fullMonth) return MONTHS[fm - 1] || fromYmd;
    return `${fromYmd}–${toYmd}`;
}

function pickDash(obj, ...keys) {
    if (!obj || typeof obj !== 'object') return null;
    for (const k of keys) {
        const n = finite(obj[k]);
        if (n != null) return n;
    }
    return null;
}

function baseCard(id, extras = {}) {
    return {
        id,
        status: extras.status || 'pending',
        value: extras.value ?? null,
        valueIncVat: extras.valueIncVat ?? null,
        previousValue: extras.previousValue ?? null,
        changePercent: extras.changePercent ?? null,
        definition: extras.definition || '',
        tooltip: extras.tooltip || [extras.definition, extras.isCount ? '' : EX_VAT_NOTE].filter(Boolean).join(' '),
        drillDownTab: extras.drillDownTab || null,
        hideIncVat: extras.hideIncVat ?? extras.valueIncVat == null,
        isCount: Boolean(extras.isCount),
        previousLabel: extras.previousLabel || '',
        oldFigure: extras.oldFigure ?? null,
        ...extras,
    };
}

function applyCompare(card, compare) {
    if (compare === 'none') return { ...card, changePercent: null };
    return card;
}

function ledgerCard(src, key, extras = {}) {
    const tab = LEDGER_TAB[key];
    const change = src.changePercent != null
        ? Number(src.changePercent)
        : changePercentExVat(src.value, src.previousValue);
    return baseCard(key, {
        status: 'ok',
        value: finite(src.value),
        valueIncVat: src.valueIncVat == null ? null : finite(src.valueIncVat),
        previousValue: finite(src.previousValue),
        changePercent: Number.isFinite(change) ? change : null,
        definition: src.definition || '',
        tooltip: [src.definition, EX_VAT_NOTE].filter(Boolean).join(' '),
        drillDownTab: tab,
        hideIncVat: key === 'expenses' || src.valueIncVat == null,
        marginPercent: finite(src.marginPercent ?? src.netMarginPercent ?? src.profitMarginPercent),
        ...extras,
    });
}

function finiteOrZeroSum(a, b) {
    const x = finite(a);
    const y = finite(b);
    if (x == null && y == null) return null;
    return (x || 0) + (y || 0);
}

/** Map GET /accounts/reports/pl (incl. cash basis) onto RF-12 ledger card keys. */
export function ledgerCardsFromPlReport(pl) {
    if (!pl || typeof pl !== 'object') return null;
    const cmp = pl.comparison && typeof pl.comparison === 'object' ? pl.comparison : {};
    const income = finite(pl.netRevenue);
    const expenses = finiteOrZeroSum(pl.totalOperatingExpenses, pl.totalOtherExpenses);
    const netProfit = finite(pl.netIncome);
    const grossMargin = finite(pl.grossProfit);
    const incomeInc = finite(pl.incVatView?.netRevenueIncVat);
    const gmInc = finite(pl.incVatView?.grossProfitIncVat);
    const prevExp = finiteOrZeroSum(cmp.totalOperatingExpenses, cmp.totalOtherExpenses);
    return {
        income: {
            value: income,
            valueIncVat: incomeInc,
            previousValue: finite(cmp.netRevenue),
            definition: 'P&L net revenue for the selected basis.',
        },
        expenses: {
            value: expenses,
            valueIncVat: null,
            previousValue: prevExp,
            definition: 'P&L operating + other expenses for the selected basis.',
        },
        netProfit: {
            value: netProfit,
            valueIncVat: null,
            previousValue: finite(cmp.netIncome),
            definition: 'P&L net income for the selected basis.',
        },
        grossMargin: {
            value: grossMargin,
            valueIncVat: gmInc,
            previousValue: finite(cmp.grossProfit),
            definition: 'P&L gross profit for the selected basis.',
        },
        basis: parseAccountingBasis(pl.basis),
        basisNote: pl.basisNote || '',
    };
}

// B7: Web KPI cards do not read dashboard purchaseCost*, grossMarginProfit,
// grossMarginIncVat*, or cogsOmitted — gross margin uses kpi-summary / P&L fields only.

export function mapDashboardKpiCards({
    dashboard,
    kpiSummary,
    valuation,
    canReadLedger = true,
    compare = 'previous',
    dateTo = '',
    branchName = '',
    basis = 'accrual',
    plLedger = null,
    kpiError = '',
    plError = '',
} = {}) {
    const dash = dashboard && typeof dashboard === 'object' ? dashboard : {};
    const kpiAsOf = resolveDashboardKpiAsOf({ dashboard: dash, kpiSummary, valuation, dateTo });
    const arParts = pickDashboardArBreakdown(dash, kpiSummary);
    const plNetRev = finite(plLedger?.netRevenue);
    const plGross = finite(plLedger?.grossProfit);
    const plGmPercent = plNetRev != null && plNetRev > 0 && plGross != null
        ? Math.round((plGross / plNetRev) * 10000) / 100
        : null;
    const byId = {};

    const salesEx = pickDash(dash, 'netRevenueExVatInRange', 'net_revenue_ex_vat');
    const salesInc = pickDash(dash, 'netRevenueIncVatInRange', 'net_revenue_inc_vat');
    const salesPrev = pickDash(
        dash,
        'netRevenueExVatPreviousPeriod',
        'netRevenueExVatPrevious',
        'previous_net_revenue_ex_vat',
    );
    const salesChangeApi = pickDash(dash, 'netRevenueChangePercentExVat');
    const zatcaInRange = pickDash(dash.zatcaNotReportedInRange, 'count');
    const legacySales = pickDash(dash, 'totalSalesInRange');
    const prevStart = dash.previousRangeStart || dash.previous_range_start || '';
    const prevEnd = dash.previousRangeEnd || dash.previous_range_end || '';
    const salesPrevLabel = previousPeriodLabel(prevStart, prevEnd);
    const salesClock = String(dash.salesClock || dash.revenue_date_basis || '').trim();
    const calendarNet = pickDash(dash, 'calendarNetRevenueExVat');
    const issuedAtNet = pickDash(dash, 'issuedAtNetRevenueExVat');
    const clockGap = pickDash(dash, 'clockBridgeGapExVat');

    if (salesEx != null || salesInc != null) {
        byId.sales = baseCard('sales', {
            status: 'ok',
            value: salesEx,
            valueIncVat: salesInc,
            previousValue: salesPrev,
            changePercent: salesChangeApi != null
                ? salesChangeApi
                : changePercentExVat(salesEx, salesPrev),
            definition: 'Net sales revenue: every generated invoice (any ZATCA state) minus completed returns.',
            drillDownTab: 'acc-profit-loss',
            hideIncVat: salesInc == null,
            zatcaIncluded: zatcaInRange,
            previousLabel: salesPrevLabel,
            salesClock,
            calendarNetExVat: calendarNet,
            issuedAtNetExVat: issuedAtNet,
            clockBridgeGapExVat: clockGap,
        });
    } else {
        byId.sales = baseCard('sales', {
            status: 'pending',
            definition: 'Net sales revenue: every generated invoice (any ZATCA state) minus completed returns.',
            drillDownTab: 'acc-profit-loss',
            oldFigure: legacySales,
            previousLabel: salesPrevLabel,
        });
    }

    if (canReadLedger) {
        const accountingBasis = parseAccountingBasis(basis);
        const fromPlReport = ledgerCardsFromPlReport(plLedger);
        const list = Array.isArray(kpiSummary?.cards) ? kpiSummary.cards : [];
        const kpiFailed = Boolean(String(kpiError || '').trim());
        const plFailed = Boolean(String(plError || '').trim());
        for (const key of LEDGER_KPI_KEYS) {
            const isPlKey = PL_BASIS_KPI_KEYS.includes(key);
            const fromPl = fromPlReport && isPlKey ? fromPlReport[key] : null;
            const src = (fromPl && finite(fromPl.value) != null ? fromPl : null)
                || list.find((c) => c.key === key);
            const usePl = Boolean(fromPl && finite(fromPl.value) != null);
            const snapshotOnly = BS_SNAPSHOT_KPI_KEYS.includes(key);
            if (accountingBasis === 'cash' && isPlKey && !usePl && !plFailed) {
                byId[key] = baseCard(key, {
                    status: 'pending',
                    definition: 'Cash-basis P&L figure is unavailable.',
                    drillDownTab: LEDGER_TAB[key],
                    hideIncVat: key === 'expenses',
                    asOf: kpiAsOf,
                    kpiAsOf,
                    branchName: key === 'income' ? branchName : '',
                    accountingBasis: 'cash',
                });
                continue;
            }
            const shownBasis = usePl && accountingBasis === 'cash'
                ? 'cash'
                : accountingBasis === 'cash' && snapshotOnly
                    ? 'snapshot'
                    : undefined;
            if (src?.warning === 'bs.beforeBooksStart') {
                byId[key] = baseCard(key, {
                    status: 'notApplicable',
                    warningKey: 'kpi.bsBeforeBooksStart',
                    warningVars: {
                        date: formatBooksDate(src.booksStartDate),
                    },
                    drillDownTab: LEDGER_TAB[key],
                    asOf: kpiAsOf,
                    kpiAsOf,
                    hideIncVat: true,
                });
            } else if (src && finite(src.value) != null) {
                const extras = {
                    branchName: key === 'income' ? branchName : '',
                    asOf: kpiAsOf,
                    kpiAsOf,
                    grossMarginPercent: key === 'grossMargin' && accountingBasis !== 'cash'
                        ? (finite(src.grossMarginPercent ?? src.grossMarginExVatPercent) ?? plGmPercent)
                        : null,
                    arTrade: key === 'accountsReceivable' ? arParts.arTrade : null,
                    arDueFromHq: key === 'accountsReceivable' ? arParts.arDueFromHq : null,
                    previousLabel: salesPrevLabel,
                    accountingBasis: shownBasis,
                };
                if (src.warning === 'bs.noOpeningBalance') {
                    extras.warningKey = 'kpi.bsNoOpeningBalance';
                    extras.warningVars = { date: formatBooksDate(src.booksStartDate) };
                }
                if (src.previousValue == null) {
                    extras.changePercent = null;
                }
                byId[key] = ledgerCard(src, key, extras);
            } else {
                const failed = isPlKey ? (plFailed || (!usePl && kpiFailed)) : kpiFailed;
                byId[key] = baseCard(key, {
                    status: failed ? 'error' : 'pending',
                    errorMessage: failed ? String(plFailed && isPlKey ? plError : kpiError) : '',
                    definition: '',
                    drillDownTab: LEDGER_TAB[key],
                    hideIncVat: key === 'expenses',
                    asOf: kpiAsOf,
                    kpiAsOf,
                    branchName: key === 'income' ? branchName : '',
                    accountingBasis: shownBasis,
                });
            }
        }
    }

    const invEx = pickDash(valuation, 'inventoryValueExVat', 'inventory_value_ex_vat');
    const invInc = pickDash(valuation, 'inventoryValueIncVat', 'inventory_value_inc_vat');
    const cov = valuation?.inventory_coverage || valuation?.inventoryCoverage || null;
    const coverageComplete = cov ? cov.coverage_complete === true || cov.coverageComplete === true : null;
    const valCostBasis = valuation?.costBasis || valuation?.cost_basis || '';
    const valDefs = valuation?.definitions && typeof valuation.definitions === 'object'
        ? valuation.definitions
        : {};
    const invDefinition = valDefs[valCostBasis] || valDefs[valuation?.costBasis] || '';
    if (invEx != null || invInc != null) {
        byId.inventoryValue = baseCard('inventoryValue', {
            status: 'ok',
            value: invEx,
            valueIncVat: invInc,
            definition: invDefinition || 'Inventory value (signed). Supported subtotal only.',
            drillDownTab: 'inventory',
            hideIncVat: invInc == null,
            coverageComplete,
            unsupportedRows: cov?.unsupported_rows ?? cov?.unsupportedRows ?? null,
            kpiAsOf,
        });
    } else {
        byId.inventoryValue = baseCard('inventoryValue', {
            status: 'pending',
            definition: invDefinition || 'Inventory value (signed).',
            drillDownTab: 'inventory',
            kpiAsOf,
        });
    }

    const low = pickDash(dash, 'lowStockActiveCount', 'lowStockAlertsCount');
    if (low != null) {
        byId.lowStock = baseCard('lowStock', {
            status: 'ok',
            value: low,
            definition: 'Active SKUs at or below critical (backend rule).',
            tooltip: 'Active SKUs at or below critical (backend rule).',
            drillDownTab: 'inventory',
            hideIncVat: true,
            isCount: true,
            kpiAsOf,
        });
    } else {
        byId.lowStock = baseCard('lowStock', {
            status: 'pending',
            definition: 'Active SKUs at or below critical (backend rule).',
            tooltip: 'Active SKUs at or below critical (backend rule).',
            drillDownTab: 'inventory',
            hideIncVat: true,
            isCount: true,
            kpiAsOf,
        });
    }

    const pending = pickDash(dash, 'pendingOrdersCount');
    const unpaid = pickDash(dash, 'unpaidInvoicesCount');
    const zatcaNow = pickDash(dash, 'zatcaNotReportedCount');
    if (pending != null) {
        byId.pendingOrders = baseCard('pendingOrders', {
            status: 'ok',
            value: pending,
            definition: 'Sales orders not yet invoiced.',
            tooltip: 'Sales orders not yet invoiced.',
            drillDownTab: 'reports',
            hideIncVat: true,
            isCount: true,
            unpaidInvoices: unpaid,
            zatcaNotReported: zatcaNow,
            kpiAsOf,
        });
    } else {
        byId.pendingOrders = baseCard('pendingOrders', {
            status: 'pending',
            definition: 'Sales orders not yet invoiced.',
            tooltip: 'Sales orders not yet invoiced.',
            drillDownTab: 'reports',
            hideIncVat: true,
            isCount: true,
            unpaidInvoices: unpaid,
            zatcaNotReported: zatcaNow,
            kpiAsOf,
        });
    }

    const order = canReadLedger
        ? DASHBOARD_KPI_ORDER
        : DASHBOARD_KPI_ORDER.filter((id) => !LEDGER_KPI_KEYS.includes(id));
    const cards = order.map((id) => applyCompare(byId[id], compare));
    return { cards, exVatNote: EX_VAT_NOTE };
}

export function assertAccDrillDownTabs(cards) {
    return (cards || [])
        .map((c) => c.drillDownTab)
        .filter((tab) => tab && String(tab).startsWith('acc-'))
        .every((tab) => Boolean(WORKSHOP_ACC_TAB_SLUG[tab]));
}
