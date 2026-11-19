import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validatedUnitCostString } from './supplierUnitCost.js';

describe('validatedUnitCostString', () => {
  it('sends a 2-dp string and rejects negative or invalid amounts', () => {
    assert.deepEqual(validatedUnitCostString(''), { ok: true, blank: true, value: '' });
    assert.deepEqual(validatedUnitCostString('12.5'), { ok: true, blank: false, value: '12.50' });
    assert.deepEqual(validatedUnitCostString('0'), { ok: true, blank: false, value: '0.00' });
    assert.equal(validatedUnitCostString('-1').ok, false);
    assert.equal(validatedUnitCostString('foo').ok, false);
    assert.equal(validatedUnitCostString('1.234').ok, false);
  });
});
