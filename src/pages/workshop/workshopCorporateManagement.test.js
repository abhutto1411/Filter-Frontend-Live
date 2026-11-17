import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'WorkshopCorporateManagement.jsx'), 'utf8');
const i18n = readFileSync(join(here, '../../utils/workshopCorporateI18n.js'), 'utf8');
const exportSrc = readFileSync(join(here, '../../utils/corporateReceivableSheetExport.js'), 'utf8');

test('WorkshopCorporateManagement keeps export default', () => {
    assert.match(page, /export default function WorkshopCorporateManagement/);
});

test('approved is a live green badge', () => {
    assert.match(page, /normalized === 'active' \|\| normalized === 'approved'/);
    assert.match(i18n, /'status\.approved': 'Approved'/);
    assert.match(i18n, /'status\.approved': 'معتمد'/);
});

test('money is two decimal places with RiyalIcon, no dollar', () => {
    assert.match(page, /import RiyalIcon from/);
    assert.match(page, /minimumFractionDigits: 2/);
    assert.doesNotMatch(page, /DollarSign/);
});

test('VAT 409 opens modal This VAT number is already added', () => {
    assert.match(page, /VAT_ALREADY_REGISTERED/);
    assert.match(page, /function VatAlreadyModal/);
    assert.match(i18n, /This VAT number is already added/);
    assert.match(i18n, /هذا الرقم الضريبي مضاف مسبقاً/);
});

test('date-range KPIs, statement, download, branch chips, credit limit', () => {
    assert.match(page, /kpi\.receivable/);
    assert.match(page, /dateFrom/);
    assert.match(page, /CorporateDateRangeBar/);
    assert.match(page, /openStatement/);
    assert.match(page, /\/workshop\/corporate-management\/\$\{/);
    assert.match(page, /getWorkshopCorporateReceivableSheet/);
    assert.match(page, /function BranchChips/);
    assert.match(page, /edit\.creditLimit/);
    assert.match(page, /err\.vatRequired/);
    assert.doesNotMatch(page, /function StatementModal/);
    assert.doesNotMatch(page, /WsTableScroll/);
    assert.match(page, /wcorp-table/);
    assert.match(page, /BilingualName/);
    assert.match(i18n, /date\.preset\.today/);
    assert.match(i18n, /اليوم/);
});

test('list GET aborts the previous in-flight request and keeps painted KPIs', () => {
    assert.match(page, /AbortController/);
    assert.match(page, /listAbortRef/);
    assert.match(page, /signal: ac\.signal/);
    assert.match(page, /AbortError/);
    assert.match(page, /listAbortRef\.current\?\.abort\(\)/);
    assert.doesNotMatch(page, /setKpis\(null\);\s*setIsLoading/);
});

test('receivable sheet PDF embeds Noto Naskh Arabic + Cairo and xlsx SUM formulas', () => {
    assert.match(exportSrc, /Noto Naskh Arabic/);
    assert.match(exportSrc, /Cairo/);
    assert.match(exportSrc, /SUM\(K/);
    assert.match(exportSrc, /#,##0\.00/);
    assert.match(exportSrc, /Corporate-Receivable_/);
    assert.match(exportSrc, /Asia\/Riyadh/);
});
