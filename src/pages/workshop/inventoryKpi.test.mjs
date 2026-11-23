import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    INV_COST_BASIS_LATEST,
    INV_COST_BASIS_WEIGHTED,
    countActiveInventoryRows,
    inventoryKpiFromSummary,
    parseInventoryCostBasisParam,
    pickLowStockApiCount,
} from '../../utils/workshopInventoryI18n.js';

const LATEST_FIXTURE = {
    costBasis: 'latest_purchase',
    totalProductsActive: 941,
    inventoryValueExVat: 628394.1,
    inventoryValueIncVat: 722654.01,
    negativeRows: 22,
    negativeValueExVat: -15051.07,
    negativeValueIncVat: -17308.73,
    fallbackRows: 900,
    definitions: {
        latest_purchase: 'Latest purchase cost per product.',
        weighted_average: 'Moving average cost per product.',
    },
};

const WEIGHTED_FIXTURE = {
    ...LATEST_FIXTURE,
    costBasis: 'weighted_average',
    inventoryValueExVat: 573339.27,
    inventoryValueIncVat: 659340.9,
};

test('RF-16: latest purchase fixture → Ex 628,394.10 / Inc 722,654.01', () => {
    const kpi = inventoryKpiFromSummary(LATEST_FIXTURE, { lowStockCount: 10 });
    assert.equal(kpi.costBasis, INV_COST_BASIS_LATEST);
    assert.equal(kpi.inventoryValueExVat, 628394.1);
    assert.equal(kpi.inventoryValueIncVat, 722654.01);
    assert.equal(kpi.totalProducts, 941);
    assert.equal(kpi.lowStockCount, 10);
    assert.equal(kpi.fallbackRows, 900);
});

test('RF-16: switching to weighted → Ex 573,339.27 / Inc 659,340.90', () => {
    assert.equal(parseInventoryCostBasisParam('weighted_average'), INV_COST_BASIS_WEIGHTED);
    assert.equal(parseInventoryCostBasisParam(''), INV_COST_BASIS_LATEST);
    assert.equal(parseInventoryCostBasisParam('', INV_COST_BASIS_WEIGHTED), INV_COST_BASIS_WEIGHTED);
    const kpi = inventoryKpiFromSummary(WEIGHTED_FIXTURE);
    assert.equal(kpi.costBasis, INV_COST_BASIS_WEIGHTED);
    assert.equal(kpi.inventoryValueExVat, 573339.27);
    assert.equal(kpi.inventoryValueIncVat, 659340.9);
});

test('RF-16: 973 rows with 32 inactive → 941 active', () => {
    const rows = Array.from({ length: 973 }, (_, i) => ({ isActive: i >= 32 }));
    assert.equal(countActiveInventoryRows(rows), 941);
    const kpi = inventoryKpiFromSummary({}, { productRows: rows, lowStockCount: 10 });
    assert.equal(kpi.totalProducts, 941);
});

test('RF-16: low-stock card uses API value 10', () => {
    assert.equal(pickLowStockApiCount({ lowStockActiveCount: 10 }), 10);
    assert.equal(pickLowStockApiCount({ lowStockAlertsCount: 10 }), 10);
    assert.equal(pickLowStockApiCount({}), null);
});

test('RF-16: helper source has no × 1.15', () => {
    const helperPath = join(dirname(fileURLToPath(import.meta.url)), '../../utils/workshopInventoryI18n.js');
    const src = readFileSync(helperPath, 'utf8');
    const start = src.indexOf('export const INV_COST_BASIS_LATEST');
    assert.ok(start >= 0, 'helper export missing');
    const helperSrc = src.slice(start);
    assert.equal(helperSrc.includes('1.15'), false);
    assert.equal(/\*\s*1\.15|1\.15\s*\*/.test(helperSrc), false);
});
