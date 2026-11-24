import test from 'node:test';
import assert from 'node:assert/strict';
import { productMatchesPickerQuery } from './productPickerSearch.js';

const oil = { name: 'TOYOTA Oil 20W50', sku: 'OIL-549', arabicName: 'زيت تويوتا', brandName: 'Toyota' };

test('every word matches on its own, in any order', () => {
    assert.equal(productMatchesPickerQuery(oil, 'toyota 20w50'), true);
    assert.equal(productMatchesPickerQuery(oil, '20w50 toyota'), true);
    assert.equal(productMatchesPickerQuery(oil, 'toyota 10w40'), false);
});

test('matches SKU, Arabic name and brand', () => {
    assert.equal(productMatchesPickerQuery(oil, 'oil-549'), true);
    assert.equal(productMatchesPickerQuery(oil, 'زيت'), true);
    assert.equal(productMatchesPickerQuery({ name: 'Filter', brandName: 'Denso' }, 'denso'), true);
});

test('empty query matches everything', () => {
    assert.equal(productMatchesPickerQuery(oil, '  '), true);
});
