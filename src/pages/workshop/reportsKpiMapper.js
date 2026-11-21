/** RF-17B: map GET /workshop-staff/reports-analytics → KPI + stock-value table. No VAT multiply. */

function hasNum(obj, key) {
    if (!obj || typeof obj !== 'object') return false;
    const v = obj[key];
    if (v == null || v === '') return false;
    return Number.isFinite(Number(v));
}

function num(obj, key) {
    return hasNum(obj, key) ? Number(obj[key]) : null;
}

function firstFinite(...vals) {
    for (const v of vals) {
        if (v == null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

/** New-key only. Missing → null. Never copies a legacy Inc-VAT field. */
export function pickNewField(payload, newKey) {
    if (hasNum(payload, newKey)) {
        return { value: Number(payload[newKey]), missing: false };
    }
    return { value: null, missing: true };
}

function pickObj(payload, key) {
    const v = payload && typeof payload === 'object' ? payload[key] : null;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    return null;
}

function mapGrossProfitGl(raw) {
    if (!raw) return null;
    const status = raw.status || null;
    if (status === 'unavailable' || status === 'incomplete') {
        return {
            revenueExVat: hasNum(raw, 'revenue_ex_vat') ? Number(raw.revenue_ex_vat) : null,
            cogs: hasNum(raw, 'cogs') ? Number(raw.cogs) : null,
            grossProfit: hasNum(raw, 'gross_profit') ? Number(raw.gross_profit) : null,
            marginPct: null,
            source: raw.source || null,
            status,
            reason: raw.reason ? String(raw.reason) : null,
            certified: false,
        };
    }
    const grossProfit = hasNum(raw, 'gross_profit') ? Number(raw.gross_profit) : null;
    const revenueExVat = hasNum(raw, 'revenue_ex_vat') ? Number(raw.revenue_ex_vat) : null;
    const cogs = hasNum(raw, 'cogs') ? Number(raw.cogs) : null;
    if (grossProfit == null && revenueExVat == null && cogs == null) return null;
    let marginPct = null;
    if (raw.margin_pct != null && raw.margin_pct !== '' && Number.isFinite(Number(raw.margin_pct))) {
        marginPct = Number(raw.margin_pct);
    }
    return {
        revenueExVat,
        cogs,
        grossProfit,
        marginPct,
        source: raw.source || null,
        status,
        reason: raw.reason ? String(raw.reason) : null,
    };
}

function mapKpiWindow(raw) {
    if (!raw) return null;
    return {
        startDate: raw.start_date || null,
        endDate: raw.end_date || null,
        timeZone: raw.time_zone || null,
        stockAsOf: raw.stock_as_of || null,
        stockOpeningAsOf: raw.stock_opening_as_of || null,
        kind: raw.kind || null,
        plJournalAvailable: raw.pl_journal_available,
        rangeStart: raw.range_start || null,
        rangeEndExclusive: raw.range_end_exclusive || null,
    };
}

function mapStockMovement(raw) {
    if (!raw) return null;
    return {
        purchasesInCost: hasNum(raw, 'purchases_in_cost') ? Number(raw.purchases_in_cost) : null,
        purchaseReturnsCost: hasNum(raw, 'purchase_returns_cost') ? Number(raw.purchase_returns_cost) : null,
        soldCost: hasNum(raw, 'sold_cost') ? Number(raw.sold_cost) : null,
        soldAtSalePrice: hasNum(raw, 'sold_at_sale_price') ? Number(raw.sold_at_sale_price) : null,
        soldCostIsCogs: raw.sold_cost_is_cogs === true,
        soldCostNote: typeof raw.sold_cost_note === 'string' ? raw.sold_cost_note : null,
        returnRestockQty: hasNum(raw, 'return_restock_qty') ? Number(raw.return_restock_qty) : null,
        adjustmentsQty: hasNum(raw, 'adjustments_qty') ? Number(raw.adjustments_qty) : null,
        source: raw.source || null,
    };
}

function mapKpiReconciliation(raw) {
    if (!raw) return null;
    return {
        stockBridgeDiffExVat: hasNum(raw, 'stock_bridge_diff_ex_vat')
            ? Number(raw.stock_bridge_diff_ex_vat)
            : null,
        grossProfitVsPlDiff: hasNum(raw, 'gross_profit_vs_pl_diff')
            ? Number(raw.gross_profit_vs_pl_diff)
            : null,
        notes: Array.isArray(raw.notes) ? raw.notes.map((n) => String(n)) : [],
    };
}

export function formatReportsKpiAmount(amount, { decimals = 2 } = {}) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return null;
    return n.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export function formatReportsChangePercent(value) {
    if (value == null || !Number.isFinite(Number(value))) return null;
    const n = Number(value);
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
}

function round2(n) {
    return Math.round(Number(n) * 100) / 100;
}

export function mapReportsAnalyticsKpis(payload) {
    const r = payload && typeof payload === 'object' ? payload : {};
    const fo = r.financialOverview && typeof r.financialOverview === 'object' ? r.financialOverview : {};
    const inv = r.inventoryValuation && typeof r.inventoryValuation === 'object' ? r.inventoryValuation : {};
    const period = r.period && typeof r.period === 'object' ? r.period : {};
    const prev = period.previous_period && typeof period.previous_period === 'object'
        ? period.previous_period
        : {};

    const netEx = pickNewField(r, 'net_revenue_ex_vat');
    const netInc = pickNewField(r, 'net_revenue_inc_vat');
    const changeEx = pickNewField(r, 'net_revenue_ex_vat_change_percent');
    const zatcaCount = hasNum(r, 'zatca_not_reported_count')
        ? Number(r.zatca_not_reported_count)
        : null;

    const stockEx = pickNewField(r, 'inventory_value_ex_vat');
    const stockInc = pickNewField(r, 'inventory_value_inc_vat');
    const profitEx = pickNewField(r, 'potential_profit_ex_vat_by_basis');
    const profitInc = pickNewField(r, 'potential_profit_inc_vat_by_basis');
    const gl = pickNewField(r, 'gl_inventory_balance');
    const negEx = pickNewField(r, 'negative_stock_value_ex_vat');
    const negInc = pickNewField(r, 'negative_stock_value_inc_vat');
    const negRows = hasNum(r, 'negative_stock_rows') ? Number(r.negative_stock_rows) : null;

    const legacyNetRevenue = firstFinite(r.total_revenue, fo.totalRevenue);
    const legacyStockValue = firstFinite(r.stock_value_signed, r.stock_value_cost, inv.stockValueCost);
    const legacyPotentialProfit = firstFinite(r.potential_profit, inv.potentialProfit);
    const legacyNegativeStock = firstFinite(r.negative_stock_value);
    const legacyRevenueChangePercent = firstFinite(r.revenue_change_percent, fo.revenueChangePercent);

    const legacyMode = !hasNum(r, 'net_revenue_ex_vat') && !hasNum(r, 'inventory_value_ex_vat');
    const kpiWindowRaw = pickObj(r, 'kpi_window');
    const rangeMode = kpiWindowRaw != null;
    const kpiWindow = rangeMode ? mapKpiWindow(kpiWindowRaw) : null;
    const stockOpeningEx = pickNewField(r, 'stock_value_opening_ex_vat');
    const stockOpeningInc = pickNewField(r, 'stock_value_opening_inc_vat');
    const stockChangeEx = pickNewField(r, 'stock_value_change_ex_vat');
    const stockMovement = mapStockMovement(pickObj(r, 'stock_movement_in_range'));
    const grossProfitGl = mapGrossProfitGl(pickObj(r, 'gross_profit_gl'));
    const attributableRaw = pickObj(r, 'gross_profit_attributable');
    const grossProfitAttributable = attributableRaw
        ? {
            status: attributableRaw.status || null,
            certified: attributableRaw.certified === true,
            salesClock: attributableRaw.sales_clock || r.sales_clock || null,
            invoiceCount: hasNum(attributableRaw, 'invoice_count')
                ? Number(attributableRaw.invoice_count)
                : null,
            invoicesWithCogs: hasNum(attributableRaw, 'invoices_with_cogs')
                ? Number(attributableRaw.invoices_with_cogs)
                : null,
            invoicesMissingCogs: hasNum(attributableRaw, 'invoices_missing_cogs')
                ? Number(attributableRaw.invoices_missing_cogs)
                : null,
            coveredGrossProfit: hasNum(attributableRaw, 'covered_gross_profit_ex_vat')
                ? Number(attributableRaw.covered_gross_profit_ex_vat)
                : null,
            uncoveredRevenue: hasNum(attributableRaw, 'uncovered_revenue_ex_vat')
                ? Number(attributableRaw.uncovered_revenue_ex_vat)
                : null,
            arithmeticGrossProfit: hasNum(attributableRaw, 'arithmetic_gross_profit_ex_vat')
                ? Number(attributableRaw.arithmetic_gross_profit_ex_vat)
                : null,
            reason: attributableRaw.reason ? String(attributableRaw.reason) : null,
        }
        : null;
    const cogsMovementCost = pickNewField(r, 'cogs_movement_cost');
    const avgTicketEx = pickNewField(r, 'avg_ticket_ex_vat');
    const noteRaw = r.stock_value_as_of_note;
    const stockAsOfNote = typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : null;
    const kpiReconciliation = mapKpiReconciliation(pickObj(r, 'kpi_reconciliation'));
    const completedOrdersCount = hasNum(r, 'completed_orders_count')
        ? Number(r.completed_orders_count)
        : null;

    const missing = [
        netEx, netInc, changeEx, stockEx, stockInc, profitEx, profitInc, gl, negEx, negInc,
    ]
        .flatMap((p, i) => {
            const keys = [
                'net_revenue_ex_vat',
                'net_revenue_inc_vat',
                'net_revenue_ex_vat_change_percent',
                'inventory_value_ex_vat',
                'inventory_value_inc_vat',
                'potential_profit_ex_vat_by_basis',
                'potential_profit_inc_vat_by_basis',
                'gl_inventory_balance',
                'negative_stock_value_ex_vat',
                'negative_stock_value_inc_vat',
            ];
            return p.missing ? [keys[i]] : [];
        });
    if (zatcaCount == null) missing.push('zatca_not_reported_count');

    const positiveEx = stockEx.value != null && negEx.value != null
        ? round2(stockEx.value - negEx.value)
        : null;
    const positiveInc = stockInc.value != null && negInc.value != null
        ? round2(stockInc.value - negInc.value)
        : null;
    const diffEx = stockEx.value != null && gl.value != null
        ? round2(stockEx.value - gl.value)
        : num(r, 'stock_vs_gl_difference');

    const proof = r.kpi_proof && typeof r.kpi_proof === 'object' ? r.kpi_proof : (r.kpiProof || {});
    const invProof = proof.inventory_valuation || proof.inventoryValuation || {};
    const lines = Array.isArray(invProof.lines) ? invProof.lines : [];

    return {
        netRevenueExVat: netEx.value,
        netRevenueIncVat: netInc.value,
        netRevenueChangePercent: changeEx.value,
        zatcaNotReportedCount: zatcaCount,
        inventoryValueExVat: stockEx.value,
        inventoryValueIncVat: stockInc.value,
        potentialProfitExVat: profitEx.value,
        potentialProfitIncVat: profitInc.value,
        glInventoryBalance: gl.value,
        negativeStockValueExVat: negEx.value,
        negativeStockValueIncVat: negInc.value,
        negativeStockRows: negRows,
        positiveStockValueExVat: positiveEx,
        positiveStockValueIncVat: positiveInc,
        stockVsGlDifferenceExVat: diffEx,
        costBasis: r.cost_basis || r.costBasis || null,
        previousPeriodStart: r.previous_period_start || prev.start_date || null,
        previousPeriodEnd: r.previous_period_end || prev.end_date || null,
        missing,
        legacyMode,
        rangeMode,
        kpiWindow,
        stockOpeningEx: stockOpeningEx.value,
        stockOpeningInc: stockOpeningInc.value,
        stockChangeEx: stockChangeEx.value,
        stockMovement,
        grossProfitGl,
        grossProfitAttributable,
        cogsMovementCost: cogsMovementCost.value,
        avgTicketEx: avgTicketEx.value,
        stockAsOfNote,
        kpiReconciliation,
        completedOrdersCount,
        legacyNetRevenue,
        legacyStockValue,
        legacyPotentialProfit,
        legacyNegativeStock,
        legacyRevenueChangePercent,
        stockLines: lines,
        unsupportedRows: hasNum(r, 'unsupported_rows')
            ? Number(r.unsupported_rows)
            : (hasNum(invProof, 'unsupported_rows') ? Number(invProof.unsupported_rows) : null),
        coverageComplete: r.inventory_coverage && typeof r.inventory_coverage === 'object'
            ? r.inventory_coverage.coverage_complete === true
            : null,
    };
}
