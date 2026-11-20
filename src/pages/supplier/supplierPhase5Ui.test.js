import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stockLineQtyTimesAvgSar } from './supplierStockGlTieOut.js';
import { spT } from '../../utils/supplierPortalI18n.js';
import { sfT } from '../../utils/storageFacilityI18n.js';

const here = dirname(fileURLToPath(import.meta.url));
const sales = readFileSync(join(here, 'SupplierSalesInvoices.jsx'), 'utf8');
const accounting = readFileSync(join(here, 'SupplierAccountingPage.jsx'), 'utf8');
const constants = readFileSync(join(here, 'constants.js'), 'utf8');
const brands = readFileSync(join(here, 'storage-facility/SupplierStorageFacilityBrands.jsx'), 'utf8');
const hub = readFileSync(join(here, 'storage-facility/SupplierStorageFacilityBrandHub.jsx'), 'utf8');
const invoices = readFileSync(join(here, 'storage-facility/StorageFacilityInvoicesTab.jsx'), 'utf8');
const glUtil = readFileSync(join(here, 'supplierStockGlTieOut.js'), 'utf8');

test('P5-GL selling valueWarehouseSar does not win over moving average', () => {
    assert.equal(
        stockLineQtyTimesAvgSar({
            warehouseQty: 10,
            averageCostWarehouse: 10,
            valueWarehouseSar: 700,
        }),
        100,
    );
    assert.doesNotMatch(glUtil, /valueWarehouseSar[\s\S]{0,40}> 0/);
});

test('sales invoices render Riyal + journal chip (or not-posted)', () => {
    assert.match(sales, /SupplierRiyalAmount/);
    assert.match(sales, /SupplierJournalChip/);
    assert.match(sales, /journalEntryNumber/);
    assert.doesNotMatch(sales, /t\('money\.sar', \{ amount: salesInvoiceSarFmt\(inv\.amount\) \}\)/);
});

test('AR–AP still lazy-only; MOCK_STOCK family still gone; payments glyph is not a dollar', () => {
    assert.match(accounting, /from '\.\.\/\.\.\/lazyPortalPages'/);
    assert.doesNotMatch(constants, /export const MOCK_STOCK\b/);
    assert.doesNotMatch(constants, /BadgeDollarSign/);
    assert.equal(spT('en', 'nav.storageFacility').includes('not warehouse'), true);
});

test('storage facility labelled as not warehouse 1200; invoices have journal chip', () => {
    assert.match(brands, /data-storage-not-warehouse/);
    assert.match(hub, /data-storage-not-warehouse/);
    assert.match(invoices, /SupplierJournalChip/);
    assert.match(invoices, /journalEntryNumber/);
    assert.match(sfT('en', 'brands.notWarehouse'), /GL 1200|account 1200|not Operations/i);
    assert.match(sfT('ar', 'brands.notWarehouse'), /1200/);
    assert.doesNotMatch(brands, /supplier_stock/);
    assert.doesNotMatch(hub, /supplier_stock/);
});
