import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitBilingualName } from '../../utils/bilingualName.js';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'WorkshopCorporateStatementPage.jsx'), 'utf8');
const layout = readFileSync(join(here, '../WorkshopLayout.jsx'), 'utf8');
const i18n = readFileSync(join(here, '../../utils/workshopCorporateI18n.js'), 'utf8');
const exportSrc = readFileSync(join(here, '../../utils/corporateWorkshopStatementExport.js'), 'utf8');
const listPage = readFileSync(join(here, 'WorkshopCorporateManagement.jsx'), 'utf8');

test('statement page export default and receive control', () => {
    assert.match(page, /export default function WorkshopCorporateStatementPage/);
    assert.match(page, /data-testid="wcorp-receive"/);
    assert.match(page, /data-testid="wcorp-stmt-back"/);
    assert.match(page, /postWorkshopCorporateReceipt/);
    assert.match(page, /CorporateDateRangeBar/);
});

test('layout lazyPage route and Back contract', () => {
    assert.match(layout, /lazyPage\(\(\) => import\('\.\/workshop\/WorkshopCorporateStatementPage'\)\)/);
    assert.match(layout, /corporate-statement/);
    assert.match(page, /\/workshop\/corporate-management\?dateFrom=/);
});

test('list does not use overflow-x as the layout', () => {
    assert.match(listPage, /wcorp-table-wrap/);
    assert.doesNotMatch(listPage, /overflow-x:\s*auto/);
    assert.doesNotMatch(listPage, /WsTableScroll/);
});

test('EN then AR name wrap', () => {
    const mixed = 'Abour Delivery Logistics Servicesمؤسسة عبور للتوصيل للخدمات اللوجستية';
    assert.deepEqual(splitBilingualName(mixed), {
        en: 'Abour Delivery Logistics Services',
        ar: 'مؤسسة عبور للتوصيل للخدمات اللوجستية',
    });
    assert.match(listPage, /wcorp-bilingual__ar/);
    assert.match(page, /wcorp-bilingual__en/);
});

test('statement PDF/Excel fail-closed and bilingual fonts', () => {
    assert.match(exportSrc, /Noto Naskh Arabic/);
    assert.match(exportSrc, /Cairo/);
    assert.match(exportSrc, /STATEMENT_CLOSE_MISMATCH/);
    assert.match(exportSrc, /SUM\(E/);
    assert.match(i18n, /stmt\.receive/);
    assert.match(i18n, /قبض دفعة/);
    assert.match(page, /data-testid="wcorp-hq-owned"/);
    assert.match(page, /kpi\.dueFromHq/);
    assert.match(page, /btn\.generateBill/);
});

test('mismatch keeps payload and generated-bills tab is on this page', () => {
    assert.match(page, /setData\(res\)/);
    assert.match(page, /res\?\.mismatch/);
    assert.match(page, /STATEMENT_CLOSE_MISMATCH/);
    assert.doesNotMatch(page, /setData\(null\);\s*\} finally/);
    assert.match(page, /data-testid="wcorp-stmt-tabs"/);
    assert.match(page, /className="wcorp-tabs"/);
    assert.match(page, /ws-tab-btn/);
    assert.match(page, /data-testid="wcorp-bills"/);
    assert.doesNotMatch(page, /className="ui-tabs"/);
    assert.doesNotMatch(page, /className="ui-tab"/);
    assert.match(page, /getWorkshopCorporateMonthlyBills/);
    assert.match(page, /getWorkshopCorporateMonthlyBill/);
    assert.match(page, /exportCorporateGeneratedBillPdf/);
    assert.match(page, /window\.print\(\)/);
    assert.match(page, /wcorp-print-sheet/);
    assert.match(page, /wcorp-screen/);
    assert.match(page, /printSelectedBill/);
    assert.match(page, /Noto Naskh Arabic/);
    assert.match(page, /family=Cairo/);
    assert.match(page, /RiyalIcon/);
    assert.doesNotMatch(page, /onPrint=\{\(\) => window\.print\(\)\}/);
    assert.doesNotMatch(page, /listCorporateGeneratedBills/);
    assert.doesNotMatch(page, /getCorporateGeneratedBill/);
    assert.doesNotMatch(page, /markPaid|btn\.markPaid|btn\.removeBill|cb-intercompany/);
    assert.match(i18n, /btn\.generatedBills/);
    assert.match(i18n, /الفواتير المُنشأة/);
    assert.match(i18n, /btn\.downloadPdf/);
});
