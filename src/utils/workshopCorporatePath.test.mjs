import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseWorkshopCorporateAccountId } from './workshopCorporatePath.js';

describe('parseWorkshopCorporateAccountId', () => {
  it('extracts 15 from statement and generate-bill paths', () => {
    assert.equal(
      parseWorkshopCorporateAccountId('/workshop/corporate-management/15'),
      '15',
    );
    assert.equal(
      parseWorkshopCorporateAccountId(
        '/workshop/corporate-management/15/generate-bill',
      ),
      '15',
    );
    assert.equal(
      parseWorkshopCorporateAccountId(
        '/workshop/corporate-management/15?dateFrom=2026-11-01&dateTo=2026-11-11',
      ),
      '15',
    );
  });

  it('returns null when the id is missing', () => {
    assert.equal(parseWorkshopCorporateAccountId('/workshop/corporate-management'), null);
    assert.equal(parseWorkshopCorporateAccountId('/workshop/dashboard'), null);
    assert.equal(parseWorkshopCorporateAccountId(''), null);
  });
});
