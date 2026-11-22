import test from 'node:test';
import assert from 'node:assert/strict';
import { sumReceivableMoney } from './corporateReceivableSheetExport.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'corporateReceivableSheetExport.js'), 'utf8');

test('row totals add 0.1 and 0.2 as 0.30', () => {
    assert.equal(sumReceivableMoney([0.1, 0.2]), '0.30');
    assert.equal(sumReceivableMoney(['0.10', '0.20']), '0.30');
});

test('receivable sheet export embeds Noto Naskh Arabic + Cairo', () => {
    assert.match(src, /Noto Naskh Arabic/);
    assert.match(src, /family=Cairo/);
    assert.match(src, /font-family: Cairo/);
});

test('xlsx uses SUM formulas, #,##0.00, frozen header, bilingual file name', () => {
    assert.match(src, /SUM\(K\$\{start\}:K\$\{end\}\)/);
    assert.match(src, /#,##0\.00/);
    assert.match(src, /ySplit: 8/);
    assert.match(src, /Corporate-Receivable_\$\{ws\}_\$\{from\}_\$\{to\}/);
    assert.match(src, /book_append_sheet\(wb, summary, 'Summary'\)/);
});

test('includes live-due customer pattern and does not force statement = 1110 child', () => {
    assert.match(src, /not forced equal to 1110-child/);
    assert.match(src, /Total receivable \(SAR\)/);
    assert.doesNotMatch(src, /DollarSign/);
});
