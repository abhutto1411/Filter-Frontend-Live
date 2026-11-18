/**
 * Reports overview KPI card models + proof helpers.
 * No new financial formulas — maps existing GET /workshop-staff/reports-analytics fields.
 */
import { formatReportsChangePercent, formatReportsKpiAmount } from './reportsKpiMapper.js';
import { describeStockMeasureScope, reportsScopeLabel } from './reportsAnalyticsScope.js';

export const REPORTS_KPI_IDS = Object.freeze([
    'revenue',
    'gross_profit',
    'stock_value',
    'profit_in_stock',
]);

export const STOCK_PROOF_PAGE_SIZE = 25;
export const LEDGER_DIFF_EPSILON = 0.01;

export function stockTableShouldBeInline() {
    return false;
}

export function paginateRows(rows, page = 1, pageSize = STOCK_PROOF_PAGE_SIZE) {
    const list = Array.isArray(rows) ? rows : [];
    const size = Math.max(1, Number(pageSize) || STOCK_PROOF_PAGE_SIZE);
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / size));
    const safePage = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (safePage - 1) * size;
    return {
        page: safePage,
        pageSize: size,
        total,
        pages,
        rows: list.slice(start, start + size),
        isPartialPage: total > list.slice(start, start + size).length || start > 0,
    };
}

export function pageRowsAreNotFullProof(pageInfo) {
    if (!pageInfo) return true;
    return pageInfo.total !== pageInfo.rows.length;
}

export function ledgerCheckDiffers(stockEx, glBalance) {
    if (stockEx == null || glBalance == null) return false;
    const a = Number(stockEx);
    const b = Number(glBalance);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.abs(a - b) >= LEDGER_DIFF_EPSILON;
}

export function missingIsNotZero(value) {
    return value == null;
}

export function proofMatchesRequest(appliedKey, proofKey) {
    return Boolean(appliedKey) && appliedKey === proofKey;
}

function money(amount, t) {
    const formatted = formatReportsKpiAmount(amount);
    return formatted != null ? t('money.sar', { amount: formatted }) : t('emdash');
}

function signedMoney(n, t) {
    if (n == null || !Number.isFinite(Number(n))) return t('emdash');
    const v = Number(n);
    const body = money(Math.abs(v), t);
    if (v > 0) return `+${body}`;
    if (v < 0) return `−${body}`;
    return body;
}

/**
 * @returns {Array<{
 *   id: string,
 *   title: string,
 *   amount: string,
 *   pending: boolean,
 *   unavailable: boolean,
 *   basis: string,
 *   scopeLine: string,
 *   badge: string|null,
 *   badgeTone: 'ok'|'warn'|'info'|null,
 *   warnings: string[],
 *   whyTitle: string,
 *   whyLines: string[],
 *   secondary: string|null,
 *   detailsLabel: string,
 *   color: string,
 *   action: 'modal'|'none',
 *   href: string|null,
 * }>}
 */
export function buildReportsKpiCardModels({
    mapped,
    t,
    branchLabel,
    appliedScope,
    proofHref = null,
    loadState = 'ready',
} = {}) {
    const empty = REPORTS_KPI_IDS.map((id) => ({
        id,
        title: '',
        amount: t ? t('emdash') : '—',
        pending: loadState === 'loading',
        unavailable: loadState === 'error' || loadState === 'unauthorized',
        basis: '',
        scopeLine: '',
        badge: null,
        badgeTone: null,
        warnings: [],
        whyTitle: '',
        whyLines: [],
        secondary: null,
        detailsLabel: '',
        color: 'text-green',
        action: 'none',
        href: null,
    }));
    if (!mapped || !t) return empty;

    const scopeLine = reportsScopeLabel(appliedScope, { branchLabel });
    const stockScope = describeStockMeasureScope({
        requestedTimeMode: appliedScope?.timeMode,
        requestedRangeKind: appliedScope?.rangeKind,
        kpiWindow: mapped.kpiWindow,
    });
    const asOf = stockScope.asOf || t('emdash');
    const basisLabel = mapped.costBasis === 'weighted_average' ? t('costBasis.weighted') : t('costBasis.latest');
    const pendingSub = t('kpi.availableAfterUpdate');

    const gp = mapped.grossProfitGl;
    const attr = mapped.grossProfitAttributable;
    const gpUnavailable = gp?.status === 'unavailable' && !attr;
    const gpIncomplete = Boolean(attr && attr.certified === false);
    const gpOperational = attr?.coveredGrossProfit;
    const gpPending = gpIncomplete
        ? gpOperational == null
        : gp == null || gp.grossProfit == null || gpUnavailable;

    const revenuePending = mapped.legacyMode
        ? mapped.legacyNetRevenue == null
        : mapped.netRevenueExVat == null;
    const revenueAmount = mapped.legacyMode ? mapped.legacyNetRevenue : mapped.netRevenueExVat;
    const revenueWarnings = [];
    if (mapped.legacyMode && mapped.legacyNetRevenue != null) {
        revenueWarnings.push(t('kpi.legacySplitSoon'));
    }

    const revenue = {
        id: 'revenue',
        title: t('kpi.netRevenue'),
        amount: revenuePending ? t('emdash') : money(revenueAmount, t),
        pending: revenuePending,
        unavailable: false,
        basis: mapped.legacyMode ? t('kpi.legacyFigure') : t('kpi.exVat'),
        scopeLine,
        badge: revenuePending ? t('kpi.badgeUnavailable') : t('kpi.badgeInvoices'),
        badgeTone: revenuePending ? 'warn' : 'ok',
        warnings: revenueWarnings,
        whyTitle: t('kpi.why'),
        whyLines: [
            t('kpi.revenueWhy'),
            mapped.netRevenueIncVat != null
                ? t('kpi.incVat', { amount: money(mapped.netRevenueIncVat, t) })
                : null,
            mapped.zatcaNotReportedCount != null
                ? t('kpi.zatcaIncluded', { count: mapped.zatcaNotReportedCount })
                : null,
            formatReportsChangePercent(mapped.legacyMode ? mapped.legacyRevenueChangePercent : mapped.netRevenueChangePercent),
        ].filter(Boolean),
        secondary: mapped.legacyMode ? t('kpi.legacyFigure') : t('kpi.exVat'),
        detailsLabel: t('kpi.detailsProof'),
        color: 'text-green',
        action: revenuePending ? 'none' : 'modal',
        href: null,
    };

    const gpWarnings = [];
    if (gpIncomplete) gpWarnings.push(t('kpi.gpIncompleteHint'));
    if (gpUnavailable) gpWarnings.push(gp?.reason || t('kpi.gpUnavailable'));
    const gpAmount = gpIncomplete
        ? (gpOperational == null ? t('emdash') : money(gpOperational, t))
        : gpPending
          ? t('emdash')
          : money(gp.grossProfit, t);
    const contribution = {
        id: 'gross_profit',
        title: gpIncomplete ? t('kpi.grossProfitCovered') : t('kpi.grossProfitPl'),
        amount: gpAmount,
        pending: gpIncomplete ? false : gpPending,
        unavailable: gpUnavailable,
        basis: t('kpi.exVat'),
        scopeLine,
        badge: gpIncomplete
            ? t('kpi.gpIncomplete')
            : gpUnavailable
              ? t('kpi.badgeUnavailable')
              : gpPending
                ? null
                : t('kpi.provisional'),
        badgeTone: gpIncomplete || gpUnavailable ? 'warn' : 'info',
        warnings: gpWarnings,
        whyTitle: t('kpi.why'),
        whyLines: [
            t('kpi.contributionWhy'),
            !gpIncomplete && !gpPending && gp
                ? t('kpi.gpSub', {
                    revenue: money(gp.revenueExVat, t),
                    cogs: money(gp.cogs, t),
                })
                : null,
            appliedScope?.timeMode === 'full_day' ? t('kpi.salesClockCalendar') : t('kpi.salesClockExact'),
        ].filter(Boolean),
        secondary: !gpIncomplete && !gpPending && gp?.marginPct != null
            ? t('kpi.gpMargin', { pct: Number(gp.marginPct).toFixed(2) })
            : null,
        detailsLabel: t('kpi.detailsProof'),
        color: 'text-blue',
        action: 'modal',
        href: proofHref || null,
    };

    const stockPending = mapped.legacyMode
        ? mapped.legacyStockValue == null
        : mapped.inventoryValueExVat == null && mapped.inventoryValueIncVat == null;
    const stockHeadline = mapped.legacyMode ? mapped.legacyStockValue : mapped.inventoryValueExVat;
    const stockWarnings = [];
    if (stockScope.intradayUnsupported) {
        stockWarnings.push(t('kpi.stockIntradayUnsupported', { date: asOf }));
    }
    if (mapped.negativeStockRows || (mapped.negativeStockValueExVat != null && Number(mapped.negativeStockValueExVat) !== 0)) {
        stockWarnings.push(t('kpi.negativeStockWarn', {
            rows: mapped.negativeStockRows ?? t('emdash'),
            amount: money(mapped.negativeStockValueExVat, t),
        }));
    }
    if (mapped.unsupportedRows) {
        stockWarnings.push(t('kpi.coverageIncomplete', { count: mapped.unsupportedRows }));
    }
    if (ledgerCheckDiffers(mapped.inventoryValueExVat, mapped.glInventoryBalance)) {
        stockWarnings.push(t('kpi.ledgerDiffers'));
    }
    const stock = {
        id: 'stock_value',
        title: t('kpi.stockValue'),
        amount: stockPending ? t('emdash') : money(stockHeadline, t),
        pending: stockPending,
        unavailable: false,
        basis: mapped.legacyMode
            ? t('kpi.legacyFigure')
            : `${t('kpi.exVat')} · ${t('kpi.stockValueBasis', { basis: basisLabel })}`,
        scopeLine: t('kpi.stockAsOfScope', { date: asOf, tz: stockScope.timezone }),
        badge: stockScope.intradayUnsupported
            ? t('kpi.badgeAsOfDay')
            : t('kpi.badgeAsOfDay'),
        badgeTone: stockWarnings.length ? 'warn' : 'ok',
        warnings: stockWarnings,
        whyTitle: t('kpi.why'),
        whyLines: [
            t('kpi.stockWhy'),
            mapped.inventoryValueIncVat != null
                ? t('kpi.incVat', { amount: money(mapped.inventoryValueIncVat, t) })
                : null,
            mapped.stockOpeningEx != null
                ? t('kpi.stockOpeningChange', {
                    date: mapped.kpiWindow?.stockOpeningAsOf || t('emdash'),
                    opening: money(mapped.stockOpeningEx, t),
                    change: signedMoney(mapped.stockChangeEx, t),
                })
                : null,
        ].filter(Boolean),
        secondary: null,
        detailsLabel: t('kpi.detailsProof'),
        color: 'text-orange',
        action: stockPending ? 'none' : 'modal',
        href: null,
    };

    const profitPending = mapped.legacyMode
        ? mapped.legacyPotentialProfit == null
        : mapped.potentialProfitExVat == null;
    const profitHeadline = mapped.legacyMode ? mapped.legacyPotentialProfit : mapped.potentialProfitExVat;
    const profitWarnings = [];
    if (mapped.unsupportedRows) {
        profitWarnings.push(t('kpi.coverageIncomplete', { count: mapped.unsupportedRows }));
    }
    const profit = {
        id: 'profit_in_stock',
        title: t('kpi.profitInStockShort'),
        amount: profitPending ? t('emdash') : money(profitHeadline, t),
        pending: profitPending,
        unavailable: false,
        basis: t('kpi.exVat'),
        scopeLine: t('kpi.stockAsOfScope', { date: asOf, tz: stockScope.timezone }),
        badge: t('kpi.badgeProjected'),
        badgeTone: 'info',
        warnings: profitWarnings,
        whyTitle: t('kpi.why'),
        whyLines: [t('kpi.profitInStockTip'), t('kpi.profitWhy')].filter(Boolean),
        secondary: null,
        detailsLabel: t('kpi.detailsProof'),
        color: 'text-purple',
        action: profitPending ? 'none' : 'modal',
        href: null,
    };

    if (loadState === 'loading') {
        return [revenue, contribution, stock, profit].map((c) => ({
            ...c,
            amount: t('emdash'),
            pending: true,
            warnings: [],
            action: 'none',
        }));
    }
    if (loadState === 'error' || loadState === 'unauthorized') {
        return [revenue, contribution, stock, profit].map((c) => ({
            ...c,
            amount: t('emdash'),
            pending: false,
            unavailable: true,
            warnings: [loadState === 'unauthorized' ? t('kpi.unauthorized') : t('kpi.loadFailed')],
            action: 'none',
        }));
    }
    if (loadState === 'empty' || mapped.legacyMode === undefined) {
        return [revenue, contribution, stock, profit];
    }
    return [revenue, contribution, stock, profit];
}

export function stockProofSections(mapped, t) {
    if (!mapped) {
        return { summary: null, recon: null, lines: [], unavailableReason: t ? t('kpi.noBreakdown') : '' };
    }
    const differs = ledgerCheckDiffers(mapped.inventoryValueExVat, mapped.glInventoryBalance);
    return {
        summary: {
            net: mapped.inventoryValueExVat,
            positive: mapped.positiveStockValueExVat,
            negative: mapped.negativeStockValueExVat,
            negativeRows: mapped.negativeStockRows,
            unvalued: mapped.unsupportedRows,
            asOf: mapped.kpiWindow?.stockAsOf || null,
        },
        recon: {
            gl: mapped.glInventoryBalance,
            difference: mapped.stockVsGlDifferenceExVat,
            differs,
            label: t('kpi.glInventoryCheck'),
            notValuation: t('kpi.glIsReconNotValuation'),
        },
        lines: Array.isArray(mapped.stockLines) ? mapped.stockLines : [],
        unavailableReason: null,
    };
}
