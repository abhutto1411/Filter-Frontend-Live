import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoMapHeader,
  buildInitialColumnMap,
  excelSerialToYmd,
  findDuplicateRowIndexes,
  mappingSample,
  pageSlice,
  parseCsvText,
  parseImportDate,
  parseImportNumber,
  toWesternDigits,
} from './bulkCsvImport.js';

describe('bulkCsvImport digits + numbers', () => {
  it('toWesternDigits converts Arabic-Indic', () => {
    assert.equal(toWesternDigits('١٢٥٠.٥'), '1250.5');
  });

  it('parseImportNumber accepts commas and rejects bad', () => {
    assert.equal(parseImportNumber('1,250.50'), '1250.50');
    assert.equal(parseImportNumber('1250.5'), '1250.50');
    assert.equal(parseImportNumber('١٢٥٠.٥'), '1250.50');
    assert.equal(parseImportNumber('1.250,50'), null);
    assert.equal(parseImportNumber(''), null);
  });
});

describe('bulkCsvImport dates', () => {
  it('parses YYYY-MM-DD and DD/MM/YYYY', () => {
    assert.equal(parseImportDate('2026-10-28').ymd, '2026-10-28');
    assert.equal(parseImportDate('28/10/2026').ymd, '2026-10-28');
    assert.equal(parseImportDate('28.10.2026').ymd, '2026-10-28');
  });

  it('parses Excel serial', () => {
    // 2026-10-28 ≈ serial 45993 (verify round-trip via helper)
    const ymd = excelSerialToYmd(45993);
    assert.match(ymd, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(parseImportDate(45993).ymd, ymd);
  });
});

describe('bulkCsvImport header map', () => {
  it('autoMapHeader EN + AR', () => {
    assert.equal(autoMapHeader('Date'), 'date');
    assert.equal(autoMapHeader('التاريخ / Date'), 'date');
    assert.equal(autoMapHeader('Supplier'), 'party');
    assert.equal(autoMapHeader('GL'), 'account_code');
    assert.equal(autoMapHeader('Amount'), 'amount');
    assert.equal(autoMapHeader('Paid from'), 'pay_from');
  });

  it('buildInitialColumnMap remembers + avoids duplicate targets', () => {
    const headers = ['Date', 'Amount', 'Foo'];
    const map = buildInitialColumnMap(headers, { Foo: 'reference' });
    assert.equal(map.Date, 'date');
    assert.equal(map.Amount, 'amount');
    assert.equal(map.Foo, 'reference');
  });

  it('mappingSample shows date transform', () => {
    assert.equal(
      mappingSample('Date', 'date', '28/10/2026'),
      '28/10/2026 → 2026-10-28',
    );
  });
});

describe('bulkCsvImport csv + dups + page', () => {
  it('parseCsvText handles quotes', () => {
    const { headers, rows } = parseCsvText(
      'type,party,amount\n"payment","Oils, Co.",1150.50\n',
    );
    assert.deepEqual(headers, ['type', 'party', 'amount']);
    assert.equal(rows.length, 1);
    assert.equal(rows[0][1], 'Oils, Co.');
  });

  it('findDuplicateRowIndexes', () => {
    const rows = [
      { type: 'payment', date: '2026-10-01', party: 'A', amount: '10.00', account_code: '1' },
      { type: 'payment', date: '2026-10-01', party: 'A', amount: '10.00', account_code: '1' },
      { type: 'payment', date: '2026-10-02', party: 'B', amount: '5.00', account_code: '1' },
    ];
    const d = findDuplicateRowIndexes(rows);
    assert.equal(d.has(1), true);
    assert.equal(d.has(0), false);
    assert.equal(d.has(2), false);
  });

  it('pageSlice 25', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ i }));
    const s = pageSlice(rows, 2, 25);
    assert.equal(s.from, 26);
    assert.equal(s.to, 30);
    assert.equal(s.pages, 2);
    assert.equal(s.rows.length, 5);
  });
});
