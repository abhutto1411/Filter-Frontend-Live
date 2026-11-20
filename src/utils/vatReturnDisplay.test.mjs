import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildVatReturnViewModel,
  defaultVatQuarterValue,
  formatVatSar,
  listVatQuarterOptions,
  splitVatDetailRows,
} from './vatReturnDisplay.js';

describe('vatReturnDisplay (P-A26B)', () => {
  it('listVatQuarterOptions / default', () => {
    const opts = listVatQuarterOptions('2027-02-15');
    assert.ok(opts.some((o) => o.value === '2027-Q1'));
    assert.equal(defaultVatQuarterValue('2027-02-15'), '2027-Q1');
    assert.ok(!opts.some((o) => o.value.startsWith('2028-')));
  });

  it('defaultVatQuarterValue is the current quarter of asOf', () => {
    assert.equal(defaultVatQuarterValue('2026-11-04'), '2026-Q4');
    assert.equal(defaultVatQuarterValue('2026-01-15'), '2026-Q1');
    assert.equal(defaultVatQuarterValue('2026-12-31'), '2026-Q4');
  });

  it('listVatQuarterOptions on 2026-11-04 skips future 2027-Q4', () => {
    const opts = listVatQuarterOptions('2026-11-04');
    assert.ok(opts.some((o) => o.value === '2026-Q4'));
    assert.ok(!opts.some((o) => o.value === '2027-Q4'));
    assert.equal(opts[0]?.value, '2026-Q4');
  });

  it('formatVatSar uses western digits', () => {
    assert.equal(formatVatSar(27360), 'SAR 27,360.00');
  });

  it('buildVatReturnViewModel from vat-return summary + row totals', () => {
    const model = buildVatReturnViewModel({
      summary: {
        outputVat: 27360,
        inputVat: 5710,
        netPayable: 21650,
        accounts: {
          outputVat: { code: '2100' },
          inputVat: { code: '1310' },
        },
      },
      rowReport: {
        totals: {
          totalSaleInclVat: 182400,
          totalPurchaseInclVat: 38066.67,
          totalVatOutput: 27360,
          totalVatInput: 5710,
        },
        rows: [],
      },
    });
    assert.equal(model.cards.outputVat, 27360);
    assert.equal(model.cards.netPayable, 21650);
    assert.equal(model.cards.billsWithoutVatNo, null);
    assert.equal(model.boxes[0].vat, 27360);
    assert.equal(model.boxes[3].isTotal, true);
    assert.equal(model.glTieOut.outputCode, '2100');
    assert.equal(model.boxMappingNote, true);
  });

  it('derives cards from rows when no summary', () => {
    const model = buildVatReturnViewModel({
      rowReport: {
        rows: [
          { vatOutput: 15, vatInput: 0, saleInclVat: 115, purchaseInclVat: 0 },
          { vatOutput: 0, vatInput: 7.5, saleInclVat: 0, purchaseInclVat: 57.5 },
        ],
      },
    });
    assert.equal(model.cards.outputVat, 15);
    assert.equal(model.cards.inputVat, 7.5);
    assert.equal(model.cards.netPayable, 7.5);
    assert.equal(model.source, 'rows');
  });

  it('splitVatDetailRows', () => {
    const { output, input } = splitVatDetailRows([
      { id: 1, vatOutput: 10, saleInclVat: 100 },
      { id: 2, vatInput: 5, purchaseInclVat: 50 },
    ]);
    assert.equal(output.length, 1);
    assert.equal(input.length, 1);
  });
});
