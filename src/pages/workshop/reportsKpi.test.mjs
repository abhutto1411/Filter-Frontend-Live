import test from 'node:test';
import assert from 'node:assert/strict';
import { mapReportsAnalyticsKpis, formatReportsChangePercent } from './reportsKpiMapper.js';

const LATEST = {
    net_revenue_ex_vat: 705094.44,
    net_revenue_inc_vat: 811135.92,
    net_revenue_ex_vat_change_percent: -31.79,
    zatca_not_reported_count: 355,
    inventory_value_ex_vat: 628394.1,
    inventory_value_inc_vat: 722654.01,
    potential_profit_ex_vat_by_basis: 201985.67,
    potential_profit_inc_vat_by_basis: 250000,
    negative_stock_value_ex_vat: -15051.07,
    negative_stock_value_inc_vat: -17308.73,
    negative_stock_rows: 22,
    gl_inventory_balance: -253075.73,
    cost_basis: 'latest_purchase',
    previous_period_start: '2026-08-01',
    previous_period_end: '2026-08-31',
};

const WEIGHTED = {
    ...LATEST,
    cost_basis: 'weighted_average',
    inventory_value_ex_vat: 573339.27,
    inventory_value_inc_vat: 659340.9,
};

const OLD_ONLY = {
    total_revenue: 818173.96,
    revenue_change_percent: -20,
    stock_value_cost: 651512.82,
    potential_profit: 332582.38,
    financialOverview: { totalRevenue: '818173.96', revenueChangePercent: -20 },
    inventoryValuation: { stockValueCost: '651512.82', potentialProfit: '332582.38' },
};

const EQUAL_FROM_API = {
    net_revenue_ex_vat: 100,
    net_revenue_inc_vat: 100,
    inventory_value_ex_vat: 50,
    inventory_value_inc_vat: 50,
};

test('RF-17: latest fixture → 705,094.44 / 811,135.92, -31.79%, ZATCA 355 included', () => {
    const m = mapReportsAnalyticsKpis(LATEST);
    assert.equal(m.netRevenueExVat, 705094.44);
    assert.equal(m.netRevenueIncVat, 811135.92);
    assert.equal(m.netRevenueChangePercent, -31.79);
    assert.equal(formatReportsChangePercent(m.netRevenueChangePercent), '-31.79%');
    assert.equal(m.zatcaNotReportedCount, 355);
    assert.equal(m.inventoryValueExVat, 628394.1);
    assert.equal(m.inventoryValueIncVat, 722654.01);
    assert.equal(m.potentialProfitExVat, 201985.67);
    assert.equal(m.legacyMode, false);
});

test('RF-17: weighted fixture → 573,339.27 / 659,340.90', () => {
    const m = mapReportsAnalyticsKpis(WEIGHTED);
    assert.equal(m.inventoryValueExVat, 573339.27);
    assert.equal(m.inventoryValueIncVat, 659340.9);
    assert.equal(m.costBasis, 'weighted_average');
});

test('RF-17B: legacy payload → Ex/Inc null, legacy values set, legacyMode true', () => {
    const m = mapReportsAnalyticsKpis(OLD_ONLY);
    assert.equal(m.legacyMode, true);
    assert.equal(m.netRevenueExVat, null);
    assert.equal(m.netRevenueIncVat, null);
    assert.equal(m.inventoryValueExVat, null);
    assert.equal(m.inventoryValueIncVat, null);
    assert.equal(m.potentialProfitExVat, null);
    assert.equal(m.potentialProfitIncVat, null);
    assert.equal(m.negativeStockValueExVat, null);
    assert.equal(m.negativeStockValueIncVat, null);
    assert.equal(m.legacyNetRevenue, 818173.96);
    assert.equal(m.legacyStockValue, 651512.82);
    assert.equal(m.legacyPotentialProfit, 332582.38);
    assert.ok(m.missing.includes('zatca_not_reported_count'));
    assert.ok(m.missing.includes('gl_inventory_balance'));
    assert.equal(m.costBasis, null);
});

test('RF-17B: new payload 100 / 115 maps Ex and Inc separately', () => {
    const m = mapReportsAnalyticsKpis({
        net_revenue_ex_vat: 100,
        net_revenue_inc_vat: 115,
        inventory_value_ex_vat: 100,
        inventory_value_inc_vat: 115,
    });
    assert.equal(m.netRevenueExVat, 100);
    assert.equal(m.netRevenueIncVat, 115);
    assert.equal(m.inventoryValueExVat, 100);
    assert.equal(m.inventoryValueIncVat, 115);
    assert.equal(m.legacyMode, false);
    assert.notEqual(m.netRevenueExVat, m.netRevenueIncVat);
});

test('RF-17B: Ex and Inc are never equal unless the API sent them equal', () => {
    const fresh = mapReportsAnalyticsKpis(LATEST);
    assert.notEqual(fresh.netRevenueExVat, fresh.netRevenueIncVat);
    assert.notEqual(fresh.inventoryValueExVat, fresh.inventoryValueIncVat);
    const legacy = mapReportsAnalyticsKpis(OLD_ONLY);
    assert.equal(legacy.netRevenueExVat, null);
    assert.equal(legacy.netRevenueIncVat, null);
    const same = mapReportsAnalyticsKpis(EQUAL_FROM_API);
    assert.equal(same.netRevenueExVat, same.netRevenueIncVat);
    assert.equal(same.netRevenueExVat, 100);
});

const RANGE = {
    ...LATEST,
    inventory_value_ex_vat: 652317.54,
    inventory_value_inc_vat: 750165.17,
    stock_value_opening_ex_vat: 912807.14,
    stock_value_opening_inc_vat: 1049728.21,
    stock_value_change_ex_vat: -260489.6,
    completed_orders_count: 10,
    avg_ticket_ex_vat: 70509.44,
    kpi_window: {
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        time_zone: 'Asia/Riyadh',
        stock_as_of: '2026-10-31',
        stock_opening_as_of: '2026-09-30',
    },
    gross_profit_gl: {
        revenue_ex_vat: 705094.06,
        cogs: 122595.32,
        gross_profit: 582498.74,
        margin_pct: 82.61,
        source: 'journal',
        status: 'provisional',
    },
    stock_movement_in_range: {
        purchases_in_cost: 100,
        purchase_returns_cost: 20,
        sold_cost: 50,
        return_restock_qty: 1,
        adjustments_qty: -2,
        source: 'inventory_movements',
    },
    cogs_movement_cost: 50,
    stock_value_as_of_note: 'Quantity is historical; unit cost is the current cost basis.',
    kpi_reconciliation: {
        stock_bridge_diff_ex_vat: 0,
        gross_profit_vs_pl_diff: 0,
        notes: ['Quantity is historical; unit cost is the current cost basis.'],
    },
};

test('RF-21: legacy payload → every new value null, rangeMode false', () => {
    const m = mapReportsAnalyticsKpis(OLD_ONLY);
    assert.equal(m.rangeMode, false);
    assert.equal(m.kpiWindow, null);
    assert.equal(m.stockOpeningEx, null);
    assert.equal(m.stockOpeningInc, null);
    assert.equal(m.stockChangeEx, null);
    assert.equal(m.stockMovement, null);
    assert.equal(m.grossProfitGl, null);
    assert.equal(m.cogsMovementCost, null);
    assert.equal(m.avgTicketEx, null);
    assert.equal(m.stockAsOfNote, null);
    assert.equal(m.kpiReconciliation, null);
});

test('RF-21: new payload maps GP, opening/closing stock, avg ticket', () => {
    const m = mapReportsAnalyticsKpis(RANGE);
    assert.equal(m.rangeMode, true);
    assert.equal(m.kpiWindow.stockAsOf, '2026-10-31');
    assert.equal(m.kpiWindow.stockOpeningAsOf, '2026-09-30');
    assert.equal(m.grossProfitGl.grossProfit, 582498.74);
    assert.equal(m.grossProfitGl.revenueExVat, 705094.06);
    assert.equal(m.grossProfitGl.cogs, 122595.32);
    assert.equal(m.grossProfitGl.marginPct, 82.61);
    assert.equal(m.grossProfitGl.status, 'provisional');
    assert.equal(m.inventoryValueExVat, 652317.54);
    assert.equal(m.stockOpeningEx, 912807.14);
    assert.equal(m.stockChangeEx, -260489.6);
    assert.equal(m.avgTicketEx, 70509.44);
    assert.equal(m.completedOrdersCount, 10);
    assert.equal(m.cogsMovementCost, 50);
    assert.equal(m.stockMovement.soldCost, 50);
    assert.notEqual(m.inventoryValueExVat, m.inventoryValueIncVat);
    assert.notEqual(m.stockOpeningEx, m.stockOpeningInc);
    assert.equal(m.stockAsOfNote, 'Quantity is historical; unit cost is the current cost basis.');
    assert.equal(m.kpiReconciliation.stockBridgeDiffExVat, 0);
});

test('RF-21: missing gross_profit_gl → pending (null), not 0', () => {
    const { gross_profit_gl, ...rest } = RANGE;
    void gross_profit_gl;
    const m = mapReportsAnalyticsKpis(rest);
    assert.equal(m.rangeMode, true);
    assert.equal(m.grossProfitGl, null);
    assert.notEqual(m.grossProfitGl, 0);
});

test('RF-21: Ex and Inc are never equal unless the API sent them equal', () => {
    const m = mapReportsAnalyticsKpis(RANGE);
    assert.notEqual(m.netRevenueExVat, m.netRevenueIncVat);
    assert.notEqual(m.inventoryValueExVat, m.inventoryValueIncVat);
    assert.notEqual(m.stockOpeningEx, m.stockOpeningInc);
});

test('gross profit unavailable is mapped, not treated as zero', () => {
    const m = mapReportsAnalyticsKpis({
        ...RANGE,
        gross_profit_gl: {
            revenue_ex_vat: null,
            cogs: null,
            gross_profit: null,
            margin_pct: null,
            source: 'journal',
            status: 'unavailable',
            reason: 'DATE-only journals cannot prove selected-hour P&L.',
        },
    });
    assert.equal(m.grossProfitGl.status, 'unavailable');
    assert.equal(m.grossProfitGl.grossProfit, null);
    assert.match(m.grossProfitGl.reason, /DATE-only/);
});

test('sold_at_sale_price is not treated as COGS', () => {
    const m = mapReportsAnalyticsKpis({
        ...RANGE,
        stock_movement_in_range: {
            ...RANGE.stock_movement_in_range,
            sold_at_sale_price: 50,
            sold_cost_is_cogs: false,
            sold_cost_note: 'Sold-at-sale-price uses invoice_sale movement unitCost',
        },
        unsupported_rows: 2,
        inventory_coverage: { coverage_complete: false, unsupported_rows: 2 },
    });
    assert.equal(m.stockMovement.soldAtSalePrice, 50);
    assert.equal(m.stockMovement.soldCostIsCogs, false);
    assert.match(m.stockMovement.soldCostNote, /sale-price/i);
    assert.equal(m.unsupportedRows, 2);
    assert.equal(m.coverageComplete, false);
});
