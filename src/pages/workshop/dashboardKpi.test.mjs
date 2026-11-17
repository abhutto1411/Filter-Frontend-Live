import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKSHOP_ACC_TAB_SLUG } from '../../utils/workshopAccTabSlug.js';
import {
    DASHBOARD_KPI_ORDER,
    assertAccDrillDownTabs,
    changePercentExVat,
    dashboardPeriodRange,
    ledgerCardsFromPlReport,
    mapDashboardKpiCards,
} from './dashboardKpiMapper.js';

const kpiSummaryBr5 = {
    cards: [
        { key: 'income', value: 274805.1, valueIncVat: 316025.19, previousValue: 250000, changePercent: 9.92, definition: 'Income' },
        { key: 'expenses', value: 54500, valueIncVat: null, previousValue: 48000, changePercent: 13.54, definition: 'Expenses' },
        { key: 'netProfit', value: 63377.83, valueIncVat: null, previousValue: 62000, changePercent: 2.22, definition: 'Net profit' },
        { key: 'grossMargin', value: 117927.55, valueIncVat: 135615.59, previousValue: 110000, changePercent: 7.21, definition: 'Gross margin' },
        { key: 'cashAndBank', value: 40000, valueIncVat: null, previousValue: 40000, changePercent: 0, definition: 'Cash' },
        { key: 'accountsReceivable', value: 8000, valueIncVat: null, previousValue: 8000, changePercent: 0, definition: 'AR' },
        { key: 'accountsPayable', value: 3000, valueIncVat: null, previousValue: 3000, changePercent: 0, definition: 'AP' },
    ],
};

const dashboardWs3 = {
    netRevenueExVatInRange: 705094.44,
    netRevenueIncVatInRange: 811135.92,
    netRevenueExVatPreviousPeriod: 1033689.17,
    netRevenueChangePercentExVat: -31.79,
    previousRangeStart: '2026-08-01',
    previousRangeEnd: '2026-08-31',
    pendingOrdersCount: 11,
    unpaidInvoicesCount: 1508,
    zatcaNotReportedInRange: { count: 355 },
    zatcaNotReportedCount: 355,
    lowStockActiveCount: 10,
    grossMarginExVatPercent: 28.68,
};

const valuationLatest = {
    inventoryValueExVat: 628394.1,
    inventoryValueIncVat: 722654.01,
    definitions: { latest_purchase: 'Latest purchase cost per product.' },
};

const oldStaging = {
    totalSalesInRange: 134935.38,
    grossMarginProfit: 81987.07,
    pendingInvoicesCount: 99,
    lowStockAlertsCount: 10,
};

test('DB-FIX-FE: old staging fixture → 10 cards, 9 pending, lowStock 10, no field names', () => {
    const { cards, missing } = mapDashboardKpiCards({
        dashboard: oldStaging,
        kpiSummary: null,
        valuation: null,
        canReadLedger: true,
    });
    assert.equal(cards.length, 10);
    assert.equal(missing, undefined);
    assert.deepEqual(cards.map((c) => c.id), DASHBOARD_KPI_ORDER);
    const low = cards.find((c) => c.id === 'lowStock');
    assert.equal(low.status, 'ok');
    assert.equal(low.value, 10);
    const pendingIds = cards.filter((c) => c.status === 'pending').map((c) => c.id);
    assert.equal(pendingIds.length, 9);
    const sales = cards.find((c) => c.id === 'sales');
    assert.equal(sales.status, 'pending');
    assert.equal(sales.value, null);
    assert.equal(sales.oldFigure, 134935.38);
    const blob = JSON.stringify({ cards });
    assert.equal(blob.includes('netRevenueExVatInRange'), false);
    assert.equal(blob.includes('Needs backend'), false);
    assert.equal(cards.some((c) => c.id === 'accountsPayable'), false);
});

test('DB-FIX-FE: ws3 Sep new fixture → 10 K-1 cards, sales 705094.44 / 811135.92, change -31.79', () => {
    const { cards } = mapDashboardKpiCards({
        dashboard: dashboardWs3,
        kpiSummary: kpiSummaryBr5,
        valuation: valuationLatest,
        canReadLedger: true,
    });
    assert.equal(cards.length, 10);
    assert.deepEqual(cards.map((c) => c.id), DASHBOARD_KPI_ORDER);
    const sales = cards.find((c) => c.id === 'sales');
    assert.equal(sales.status, 'ok');
    assert.equal(sales.value, 705094.44);
    assert.equal(sales.valueIncVat, 811135.92);
    assert.equal(sales.previousValue, 1033689.17);
    assert.equal(sales.changePercent, -31.79);
    const income = cards.find((c) => c.id === 'income');
    assert.equal(income.value, 274805.1);
    assert.equal(income.valueIncVat, 316025.19);
    const expenses = cards.find((c) => c.id === 'expenses');
    assert.equal(expenses.valueIncVat, null);
    assert.equal(expenses.hideIncVat, true);
    const inv = cards.find((c) => c.id === 'inventoryValue');
    assert.equal(inv.value, 628394.1);
    assert.equal(inv.valueIncVat, 722654.01);
    const pending = cards.find((c) => c.id === 'pendingOrders');
    assert.equal(pending.value, 11);
    assert.equal(pending.unpaidInvoices, 1508);
    assert.equal(pending.zatcaNotReported, 355);
    assert.equal(cards.some((c) => c.id === 'accountsPayable'), false);
});

test('DB-FIX-FE: no ledger permission → 4 cards', () => {
    const { cards } = mapDashboardKpiCards({
        dashboard: dashboardWs3,
        kpiSummary: kpiSummaryBr5,
        valuation: valuationLatest,
        canReadLedger: false,
    });
    assert.deepEqual(cards.map((c) => c.id), ['sales', 'inventoryValue', 'lowStock', 'pendingOrders']);
    assert.equal(cards.length, 4);
    assert.equal(cards.some((c) => c.id === 'income'), false);
});

test('growth from previous zero is undefined, not 100%', () => {
    assert.equal(changePercentExVat(50, 0), null);
    assert.equal(changePercentExVat(0, 0), null);
    assert.equal(changePercentExVat(110, 100), 10);
});

test('DB-FIX-FE: compare none → every changePercent is null', () => {
    const { cards } = mapDashboardKpiCards({
        dashboard: dashboardWs3,
        kpiSummary: kpiSummaryBr5,
        valuation: valuationLatest,
        canReadLedger: true,
        compare: 'none',
    });
    for (const c of cards) {
        assert.equal(c.changePercent, null, c.id);
    }
});

test('cash basis overlays P&L cards only; sales and stock stay operational', () => {
    const plCash = {
        basis: 'cash',
        netRevenue: 1000,
        totalOperatingExpenses: 200,
        totalOtherExpenses: 50,
        netIncome: 400,
        grossProfit: 700,
        incVatView: { netRevenueIncVat: 1150, grossProfitIncVat: 805 },
        comparison: {
            netRevenue: 800,
            totalOperatingExpenses: 180,
            totalOtherExpenses: 20,
            netIncome: 300,
            grossProfit: 600,
        },
    };
    const { cards } = mapDashboardKpiCards({
        dashboard: dashboardWs3,
        kpiSummary: kpiSummaryBr5,
        valuation: valuationLatest,
        canReadLedger: true,
        basis: 'cash',
        plLedger: plCash,
    });
    const sales = cards.find((c) => c.id === 'sales');
    assert.equal(sales.value, 705094.44);
    assert.equal(sales.accountingBasis, undefined);
    const income = cards.find((c) => c.id === 'income');
    assert.equal(income.value, 1000);
    assert.equal(income.accountingBasis, 'cash');
    const expenses = cards.find((c) => c.id === 'expenses');
    assert.equal(expenses.value, 250);
    const cash = cards.find((c) => c.id === 'cashAndBank');
    assert.equal(cash.value, 40000);
    assert.equal(cash.accountingBasis, 'snapshot');
    const inv = cards.find((c) => c.id === 'inventoryValue');
    assert.equal(inv.value, 628394.1);
});

test('cash basis without P&L payload does not keep accrual P&L numbers', () => {
    const { cards } = mapDashboardKpiCards({
        dashboard: dashboardWs3,
        kpiSummary: kpiSummaryBr5,
        valuation: valuationLatest,
        canReadLedger: true,
        basis: 'cash',
        plLedger: null,
    });
    const income = cards.find((c) => c.id === 'income');
    assert.equal(income.status, 'pending');
    assert.equal(income.value, null);
    assert.notEqual(income.value, 274805.1);
    const sales = cards.find((c) => c.id === 'sales');
    assert.equal(sales.value, 705094.44);
    const cash = cards.find((c) => c.id === 'cashAndBank');
    assert.equal(cash.value, 40000);
});

test('DB-FIX-FE: acc-* drill-down ids exist in workshopAccTabSlug.js', () => {
    const { cards } = mapDashboardKpiCards({
        dashboard: dashboardWs3,
        kpiSummary: kpiSummaryBr5,
        valuation: valuationLatest,
        canReadLedger: true,
    });
    assert.equal(assertAccDrillDownTabs(cards), true);
    for (const c of cards) {
        if (c.drillDownTab && String(c.drillDownTab).startsWith('acc-')) {
            assert.ok(WORKSHOP_ACC_TAB_SLUG[c.drillDownTab], c.drillDownTab);
        }
    }
});

test('failed kpi-summary with P&L payload is error/retry on BS, income from books', () => {
    const { cards } = mapDashboardKpiCards({
        dashboard: dashboardWs3,
        kpiSummary: null,
        kpiError: 'timeout',
        valuation: valuationLatest,
        canReadLedger: true,
        plLedger: {
            netRevenue: 669112.62,
            totalOperatingExpenses: 1,
            totalOtherExpenses: 0,
            netIncome: 1,
            grossProfit: 248119.7,
        },
    });
    const income = cards.find((c) => c.id === 'income');
    assert.equal(income.status, 'ok');
    assert.equal(income.value, 669112.62);
    assert.notEqual(income.status, 'pending');
    const cash = cards.find((c) => c.id === 'cashAndBank');
    assert.equal(cash.status, 'error');
    assert.notEqual(cash.status, 'pending');
    assert.equal(cash.errorMessage, 'timeout');
});

test('failed kpi-summary without P&L is error, not Available after update pending', () => {
    const { cards } = mapDashboardKpiCards({
        dashboard: dashboardWs3,
        kpiSummary: null,
        kpiError: 'timeout',
        plError: 'timeout',
        canReadLedger: true,
        plLedger: null,
    });
    for (const id of ['income', 'expenses', 'netProfit', 'grossMargin', 'cashAndBank', 'accountsReceivable']) {
        const c = cards.find((x) => x.id === id);
        assert.equal(c.status, 'error', id);
        assert.notEqual(c.status, 'pending', id);
    }
});

test('June cashAndBank with bs.beforeBooksStart is notApplicable not pending', () => {
    const { cards } = mapDashboardKpiCards({
        dashboard: dashboardWs3,
        kpiSummary: {
            cards: [
                { key: 'income', value: 351993.96, previousValue: 0, definition: 'Income' },
                { key: 'expenses', value: 37202.47, previousValue: 0, definition: 'Exp' },
                { key: 'netProfit', value: 95153.59, previousValue: 0, definition: 'NP' },
                { key: 'grossMargin', value: 126364.93, previousValue: 0, definition: 'GM' },
                {
                    key: 'cashAndBank',
                    value: null,
                    previousValue: null,
                    changePercent: null,
                    warning: 'bs.beforeBooksStart',
                    booksStartDate: '2026-11-08',
                    definition: 'Cash',
                },
                {
                    key: 'accountsReceivable',
                    value: null,
                    previousValue: null,
                    warning: 'bs.beforeBooksStart',
                    booksStartDate: '2026-11-08',
                    definition: 'AR',
                },
            ],
        },
        valuation: valuationLatest,
        canReadLedger: true,
        dateTo: '2026-06-30',
    });
    const cash = cards.find((c) => c.id === 'cashAndBank');
    assert.equal(cash.status, 'notApplicable');
    assert.notEqual(cash.status, 'pending');
    assert.equal(cash.warningKey, 'kpi.bsBeforeBooksStart');
    const ar = cards.find((c) => c.id === 'accountsReceivable');
    assert.equal(ar.status, 'notApplicable');
});

test('F2-B1 dashboard netProfit is API netIncome 67.09 including cash +4', () => {
    const cards = ledgerCardsFromPlReport({
        netRevenue: 220.86,
        totalOperatingExpenses: 24.13,
        totalOtherExpenses: 0,
        grossProfit: 87.22,
        netIncome: 67.09,
        cashOverShort: { net: 4 },
    });
    assert.equal(cards.netProfit.value, 67.09);
    assert.equal(cards.expenses.value, 24.13);
});

test('dashboard period presets: today and this week use Riyadh calendar days', () => {
    const now = new Date('2026-11-07T12:00:00.000+03:00');
    assert.deepEqual(dashboardPeriodRange('today', now), {
        dateFrom: '2026-11-07',
        dateTo: '2026-11-07',
    });
    const week = dashboardPeriodRange('this_week', now);
    assert.equal(week.dateTo, '2026-11-07');
    assert.equal(week.dateFrom, '2026-11-02');
});
