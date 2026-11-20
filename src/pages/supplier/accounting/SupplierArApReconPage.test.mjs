import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'SupplierArApReconPage.jsx'), 'utf8');
const lazy = readFileSync(join(here, '../../../lazyPortalPages.js'), 'utf8');
const i18n = readFileSync(join(here, '../../../utils/supplierArApReconI18n.js'), 'utf8');
const salesI18n = readFileSync(join(here, '../../../utils/supplierSalesInvoicesI18n.js'), 'utf8');
const salesPage = readFileSync(join(here, '../SupplierSalesInvoices.jsx'), 'utf8');
const stockI18n = readFileSync(join(here, '../../../utils/supplierStockI18n.js'), 'utf8');
const stockPage = readFileSync(join(here, '../SupplierStockInventory.jsx'), 'utf8');

test('AR-AP recon page has export default, Riyal icon, 2 dp, read-only', () => {
    assert.match(page, /export default function SupplierArApReconPage/);
    assert.match(page, /import RiyalIcon from/);
    assert.match(page, /toFixed\(2\)/);
    assert.match(page, /Read-only|readonly/);
    assert.doesNotMatch(page, /repair/i);
    assert.match(lazy, /SupplierArApReconPage = lazyWithRetry/);
    assert.match(i18n, /'title': 'AR – AP reconciliation'/);
    assert.match(i18n, /'title': 'مطابقة الذمم المدينة والدائنة'/);
});

test('sales invoice shortfall does not offer continue anyway', () => {
    assert.match(salesPage, /err\.insufficientStock/);
    assert.doesNotMatch(salesPage, /err\.stockConfirm/);
    assert.doesNotMatch(salesPage, /allowInsufficientStockProductIds/);
    assert.doesNotMatch(salesI18n, /Continue anyway/i);
    assert.doesNotMatch(salesI18n, /المتابعة على أي حال/);
});

test('stock-set dialog has unit-cost field EN/AR prefilled with average', () => {
    assert.match(stockPage, /adjust\.unitCost/);
    assert.match(stockPage, /averageCostWarehouse/);
    assert.match(stockPage, /unitCost:/);
    assert.doesNotMatch(stockPage, /setAdjustUnitCost\(\s*Number\(s\?\.price\)/);
    assert.match(stockI18n, /'adjust.unitCost': 'Unit cost/);
    assert.match(stockI18n, /'adjust.unitCost': 'تكلفة الوحدة/);
});

test('qty.exceedsTitle no longer says confirm on save', () => {
    assert.doesNotMatch(salesI18n, /confirm on save/i);
    assert.doesNotMatch(salesI18n, /أكّد عند الحفظ/);
    assert.match(salesI18n, /this line cannot be saved/);
});
