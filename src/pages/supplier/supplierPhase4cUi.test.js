import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    INVENTORY_GL_CODE,
    money2,
    stockQtyTimesAvgSar,
    stockLineQtyTimesAvgSar,
    stockHasUnaveragedLines,
    inventoryGl1200Balance,
    stockGlTieOut,
} from './supplierStockGlTieOut.js';
import { spT } from '../../utils/supplierPortalI18n.js';

const here = dirname(fileURLToPath(import.meta.url));
const constants = readFileSync(join(here, 'constants.js'), 'utf8');
const accounting = readFileSync(join(here, 'SupplierAccountingPage.jsx'), 'utf8');
const layout = readFileSync(join(here, '../SupplierLayout.jsx'), 'utf8');
const dashboard = readFileSync(join(here, 'SupplierDashboard.jsx'), 'utf8');
const css = readFileSync(join(here, 'supplierPortal.css'), 'utf8');
const arAp = readFileSync(join(here, 'accounting/SupplierArApReconPage.jsx'), 'utf8');
const lazy = readFileSync(join(here, '../../lazyPortalPages.js'), 'utf8');
const debitNotes = readFileSync(join(here, 'SupplierPurchaseDebitNotes.jsx'), 'utf8');
const stock = readFileSync(join(here, 'SupplierStockInventory.jsx'), 'utf8');
const dateBar = readFileSync(join(here, 'SupplierReportsDateBar.jsx'), 'utf8');
const riyal = readFileSync(join(here, 'SupplierRiyalAmount.jsx'), 'utf8');

test('MOCK_STOCK / MOCK_STOCK_MOVEMENTS / MOCK_ORDERS / MOCK_ALERTS are gone from production constants', () => {
    assert.doesNotMatch(constants, /export const MOCK_STOCK\b/);
    assert.doesNotMatch(constants, /MOCK_STOCK_MOVEMENTS/);
    assert.doesNotMatch(constants, /export const MOCK_ORDERS\b/);
    assert.doesNotMatch(constants, /export const MOCK_ALERTS\b/);
});

test('operations nav keeps existing route ids as Inbound / Stock / Outbound / Counts', () => {
    assert.match(constants, /id: 'catalog'[\s\S]*Inbound/);
    assert.match(constants, /id: 'stock'[\s\S]*Stock/);
    assert.match(constants, /id: 'order_queue'[\s\S]*Outbound/);
    assert.match(constants, /id: 'stock_alerts'[\s\S]*Counts/);
    assert.equal(spT('en', 'nav.inbound'), 'Inbound');
    assert.equal(spT('ar', 'nav.inbound'), 'الوارد');
    assert.equal(spT('en', 'nav.counts'), 'Counts');
    assert.equal(spT('ar', 'nav.counts'), 'الجرد');
});

test('AR–AP is rendered from the lazyPortalPages binding only', () => {
    assert.doesNotMatch(accounting, /from '\.\/accounting\/SupplierArApReconPage'/);
    assert.match(accounting, /import \{ SupplierArApReconPage \} from '\.\.\/\.\.\/lazyPortalPages'/);
    assert.match(accounting, /<SupplierArApReconPage locale=\{locale\} \/>/);
    assert.match(accounting, /<Suspense /);
    assert.match(lazy, /SupplierArApReconPage = lazyWithRetry\(\(\) => import\('\.\/pages\/supplier\/accounting\/SupplierArApReconPage'\)\)/);
    assert.match(arAp, /export default function SupplierArApReconPage/);
});

test('Riyal icon, Arabic fonts, and no-hscroll shell are on pages we restyle', () => {
    assert.match(layout, /SupplierRiyalAmount/);
    assert.match(dashboard, /SupplierRiyalAmount/);
    assert.doesNotMatch(dashboard, /DollarSign/);
    assert.match(css, /Noto Naskh Arabic/);
    assert.match(css, /Cairo/);
    assert.match(css, /overflow-x:\s*hidden/);
    assert.match(css, /1280px/);
    assert.match(css, /1440px/);
    assert.match(riyal, /minimumFractionDigits: 2/);
    assert.match(riyal, /RiyalIcon/);
    assert.equal(money2(10.005), 10.01);
    assert.equal(money2(7000), 7000);
});

test('debit notes show a journal chip or not-posted; reports date bar has Riyadh presets', () => {
    assert.match(debitNotes, /SupplierJournalChip/);
    assert.match(stock, /SupplierReportsDateBar/);
    assert.match(dateBar, /last_7/);
    assert.match(dateBar, /inclusiveYmdForPreset/);
    assert.equal(spT('en', 'chip.notPosted'), 'not posted');
    assert.equal(spT('ar', 'chip.notPosted'), 'غير مرحّل');
});

test('stock GL tie-out: qty × avg vs account 1200 fails visibly when it breaks', () => {
    assert.equal(INVENTORY_GL_CODE, '1200');
    assert.equal(money2(10.005), 10.01);
    assert.equal(
        stockLineQtyTimesAvgSar({
            warehouseQty: 10,
            averageCostWarehouse: 10,
            valueWarehouseSar: 700,
            price: 70,
        }),
        100,
    );
    const stockValue = stockQtyTimesAvgSar([
        { warehouseQty: 10, averageCostWarehouse: 10, valueWarehouseSar: 700 },
        { warehouseQty: 2, averageCostWarehouse: 50, valueWarehouseSar: 900 },
    ]);
    assert.equal(stockValue, 200);
    const gl = inventoryGl1200Balance([
        { code: '1200', debitBalance: 200, creditBalance: 0 },
        { code: '2100', debitBalance: 0, creditBalance: 50 },
    ]);
    assert.equal(gl, 200);
    const ok = stockGlTieOut({ stockValue, glBalance: gl });
    assert.equal(ok.ok, true);
    const broken = stockGlTieOut({ stockValue: 200, glBalance: 190 });
    assert.equal(broken.ok, false);
    assert.equal(broken.delta, 10);
    const missing = stockGlTieOut({ stockValue: 200, glBalance: null });
    assert.equal(missing.ok, false);
    assert.equal(missing.missingGl, true);
    const unaveragedRows = [{ warehouseQty: 10, valueWarehouseSar: 700 }];
    assert.equal(stockHasUnaveragedLines(unaveragedRows), true);
    const unaveraged = stockGlTieOut({
        stockValue: stockQtyTimesAvgSar(unaveragedRows),
        glBalance: 100,
        unaveraged: true,
    });
    assert.equal(unaveraged.ok, false);
    assert.equal(unaveraged.unaveraged, true);
    assert.match(stock, /data-gl-tieout/);
});
