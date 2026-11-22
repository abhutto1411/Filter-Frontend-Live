import test from 'node:test';
import assert from 'node:assert/strict';
import { wrT } from '../../utils/workshopReportsI18n.js';
import { mapReportsAnalyticsKpis } from './reportsKpiMapper.js';
import { defaultReportsTodayScope } from './reportsAnalyticsScope.js';
import {
    REPORTS_KPI_IDS,
    buildReportsKpiCardModels,
    ledgerCheckDiffers,
    missingIsNotZero,
    pageRowsAreNotFullProof,
    paginateRows,
    proofMatchesRequest,
    stockProofSections,
    stockTableShouldBeInline,
} from './reportsKpiCards.js';

const tEn = (key, vars) => wrT('en', key, vars);
const tAr = (key, vars) => wrT('ar', key, vars);
const NOW = new Date('2026-11-09T09:00:00Z');

const PAYLOAD = {
    net_revenue_ex_vat: 100.5,
    net_revenue_inc_vat: 115.58,
    net_revenue_ex_vat_change_percent: -10,
    zatca_not_reported_count: 2,
    inventory_value_ex_vat: 80,
    inventory_value_inc_vat: 92,
    potential_profit_ex_vat_by_basis: 12,
    potential_profit_inc_vat_by_basis: 13,
    negative_stock_value_ex_vat: -4,
    negative_stock_value_inc_vat: -4.6,
    negative_stock_rows: 3,
    gl_inventory_balance: -20,
    stock_vs_gl_difference: 100,
    cost_basis: 'latest_purchase',
    unsupported_rows: 2,
    inventory_coverage: { coverage_complete: false, unsupported_rows: 2 },
    kpi_window: {
        start_date: '2026-11-09',
        end_date: '2026-11-09',
        time_zone: 'Asia/Riyadh',
        stock_as_of: '2026-11-09',
        kind: 'calendar_day',
    },
    gross_profit_gl: {
        revenue_ex_vat: 100.5,
        cogs: 40,
        gross_profit: 60.5,
        margin_pct: 60.2,
        source: 'journal',
        status: 'provisional',
    },
    gross_profit_attributable: {
        status: 'incomplete',
        certified: false,
        covered_gross_profit_ex_vat: 55,
        invoices_with_cogs: 8,
        invoices_missing_cogs: 2,
        reason: 'Missing COGS on 2 invoices',
    },
    kpi_proof: { revenue: { formula: 'net invoices − returns', total: 100.5 } },
};

test('four KPI ids retained; stock table hidden by default', () => {
    assert.deepEqual([...REPORTS_KPI_IDS], ['revenue', 'gross_profit', 'stock_value', 'profit_in_stock']);
    assert.equal(stockTableShouldBeInline(), false);
});

test('cards keep server amounts, visible warnings, and do not hardcode screenshot figures', () => {
    const mapped = mapReportsAnalyticsKpis(PAYLOAD);
    const cards = buildReportsKpiCardModels({
        mapped,
        t: tEn,
        branchLabel: 'All branches',
        appliedScope: defaultReportsTodayScope(NOW),
        loadState: 'ready',
    });
    assert.equal(cards.length, 4);
    assert.equal(cards[0].id, 'revenue');
    assert.match(cards[0].amount, /100\.50/);
    assert.match(cards[0].whyLines.join(' '), /invoice|return|VAT/i);
    assert.equal(cards[1].id, 'gross_profit');
    assert.match(cards[1].title, /Covered contribution/i);
    assert.ok(cards[1].warnings.some((w) => /Missing COGS|coverage|certified/i.test(w)));
    assert.equal(cards[2].id, 'stock_value');
    assert.ok(cards[2].warnings.some((w) => /Ledger check differs/i.test(w)));
    assert.ok(cards[2].warnings.some((w) => /Negative/i.test(w)));
    assert.equal(cards[3].id, 'profit_in_stock');
    assert.match(cards[3].title, /if sold|projected|stock/i);
    assert.match(cards[3].whyLines.join(' '), /Not profit earned|estimated/i);
    const blob = JSON.stringify(cards);
    assert.ok(!blob.includes('418872.03'));
    assert.ok(!blob.includes('1366531.54'));
    assert.ok(!blob.includes('818622.85'));
});

test('same-response proof key; page rows are not full KPI proof', () => {
    assert.equal(proofMatchesRequest('w1|all|k', 'w1|all|k'), true);
    assert.equal(proofMatchesRequest('w1|all|k', 'w1|all|k2'), false);
    const page = paginateRows(Array.from({ length: 40 }, (_, i) => i), 1, 25);
    assert.equal(page.rows.length, 25);
    assert.equal(page.total, 40);
    assert.equal(pageRowsAreNotFullProof(page), true);
    assert.equal(pageRowsAreNotFullProof({ total: 3, rows: [1, 2, 3] }), false);
});

test('missing/error is not verified zero; unauthorized/error cards stay unavailable', () => {
    assert.equal(missingIsNotZero(null), true);
    assert.equal(missingIsNotZero(0), false);
    const mapped = mapReportsAnalyticsKpis(PAYLOAD);
    const err = buildReportsKpiCardModels({
        mapped,
        t: tEn,
        appliedScope: defaultReportsTodayScope(NOW),
        loadState: 'error',
    });
    for (const c of err) {
        assert.equal(c.unavailable, true);
        assert.equal(c.amount, tEn('emdash'));
        assert.ok(c.warnings.length);
    }
});

test('stock proof keeps GL as reconciliation, not a second valuation', () => {
    const mapped = mapReportsAnalyticsKpis(PAYLOAD);
    const sections = stockProofSections(mapped, tEn);
    assert.equal(sections.recon.differs, true);
    assert.equal(sections.recon.gl, -20);
    assert.match(sections.recon.notValuation, /reconcil/i);
    assert.equal(ledgerCheckDiffers(80, -20), true);
    assert.equal(ledgerCheckDiffers(80, 80), false);
});

test('EN/AR new labels exist and RTL pack does not drop Details/Proof', () => {
    for (const key of [
        'kpi.detailsProof',
        'kpi.why',
        'kpi.ledgerDiffers',
        'kpi.stockValue',
        'kpi.profitInStockShort',
        'kpi.stockIntradayUnsupported',
        'filter.preset.today',
        'filter.time.fullDay',
        'btn.cancel',
        'btn.reset',
        'filter.timezone',
    ]) {
        const en = tEn(key);
        const ar = tAr(key);
        assert.notEqual(en, key, key);
        assert.notEqual(ar, key, key);
        assert.notEqual(en, ar, key);
    }
});

test('intraday request shows stock as-of warning on the card', () => {
    const mapped = mapReportsAnalyticsKpis(PAYLOAD);
    const cards = buildReportsKpiCardModels({
        mapped,
        t: tEn,
        appliedScope: {
            preset: 'custom',
            timeMode: 'custom_time',
            rangeKind: 'precise',
            dateFrom: '2026-11-09',
            dateTo: '2026-11-09',
            fromLocal: '2026-11-09T08:00',
            toLocal: '2026-11-09T12:00',
            timezone: 'Asia/Riyadh',
        },
        loadState: 'ready',
    });
    const stock = cards.find((c) => c.id === 'stock_value');
    assert.ok(stock.warnings.some((w) => /end of day|as of|intraday/i.test(w)));
});
