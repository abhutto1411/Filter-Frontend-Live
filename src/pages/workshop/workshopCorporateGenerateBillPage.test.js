import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'WorkshopCorporateGenerateBillPage.jsx'), 'utf8');
const layout = readFileSync(join(here, '../WorkshopLayout.jsx'), 'utf8');
const i18n = readFileSync(join(here, '../../utils/workshopCorporateI18n.js'), 'utf8');
const billing = readFileSync(join(here, '../../components/admin/CorporateBillingSection.jsx'), 'utf8');
const billingI18n = readFileSync(join(here, '../../utils/corporateBillingI18n.js'), 'utf8');
const stmt = readFileSync(join(here, 'WorkshopCorporateStatementPage.jsx'), 'utf8');

test('generate page export default and lazyPage', () => {
    assert.match(page, /export default function WorkshopCorporateGenerateBillPage/);
    assert.match(page, /data-testid="wcorp-generate-page"/);
    assert.match(page, /postWorkshopMonthlyBill/);
    assert.match(page, /tab: 'generated-bills'/);
    assert.match(page, /includeOpeningBalance !== false/);
    assert.match(layout, /lazyPage\(\(\) => import\('\.\/workshop\/WorkshopCorporateGenerateBillPage'\)\)/);
    assert.match(layout, /corporate-generate-bill/);
});

test('collection-owner chips, remit, and blocked receive copy', () => {
    assert.match(billing, /data-testid="cb-owner-chip"/);
    assert.match(billing, /data-testid="cb-remit"/);
    assert.match(billing, /data-testid="cb-intercompany"/);
    assert.match(billing, /collectionOwner !== 'workshop'/);
    assert.match(stmt, /data-testid="wcorp-hq-owned"/);
    assert.match(stmt, /stmt\.hqOwned/);
    assert.match(i18n, /kpi\.dueFromHq/);
    assert.match(i18n, /مستحق من المقر/);
    assert.match(billingI18n, /btn\.remit/);
    assert.match(billingI18n, /تحويل إلى الورشة/);
    assert.match(i18n, /Noto Naskh Arabic|Cairo|btn\.generateBill/);
});
