import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBillSellerWith } from './billSeller.js';

const platform = (...sources) => {
    const pick = (k) => sources.map((s) => String(s?.[k] ?? '').trim()).find(Boolean) || '';
    const nameEn = pick('platformNameEn') || 'Filter Car Services';
    const nameAr = pick('platformNameAr') || 'فلتر لخدمات السيارات';
    return { nameEn, nameAr, qrName: nameAr || nameEn, vatNumber: pick('platformVatNumber') || '300000000000003' };
};

test('workshop self-billed bill prints the workshop name + taxId, not the platform', () => {
    const s = resolveBillSellerWith(
        platform,
        { collectionOwner: 'workshop' },
        { workshopName: 'Corp-snap name', platformNameEn: 'Filter Car Services', platformVatNumber: '300000000000003' },
        { name: 'مؤسسة خالد فهد الضويان', taxId: '310000000000003' },
    );
    assert.equal(s.kind, 'workshop');
    assert.equal(s.nameEn, 'مؤسسة خالد فهد الضويان');
    assert.equal(s.vatNumber, '310000000000003');
    assert.notEqual(s.vatNumber, '300000000000003');
});

test('workshop bill falls back to the corp snapshot workshop fields', () => {
    const s = resolveBillSellerWith(platform, { collectionOwner: 'workshop' }, { workshopName: 'W50', workshopTaxId: '311' }, null);
    assert.deepEqual([s.nameEn, s.vatNumber], ['W50', '311']);
});

test('HQ hq_principal bill → platform as principal', () => {
    const s = resolveBillSellerWith(platform, { collectionOwner: 'hq', vatModel: 'hq_principal' }, { platformVatNumber: '399' }, null);
    assert.deepEqual([s.kind, s.role, s.vatNumber], ['platform', 'principal', '399']);
});

test('HQ legacy bill → platform as collector', () => {
    const s = resolveBillSellerWith(platform, { collectionOwner: 'hq' }, {}, null);
    assert.deepEqual([s.kind, s.role], ['platform', 'collector']);
});

test('HQ bill: platform sources are read in order (first non-empty wins)', () => {
    // CLOSING F6: behaviour instead of a source-regex check on the exports.
    const s = resolveBillSellerWith(
        platform,
        { collectionOwner: 'hq', vatModel: 'hq_principal' },
        { platformNameEn: '', platformVatNumber: '' },
        null,
        { platformNameEn: 'Filter HQ', platformNameAr: 'فلتر', platformVatNumber: '301' },
    );
    assert.deepEqual([s.kind, s.role, s.nameEn, s.nameAr, s.vatNumber], ['platform', 'principal', 'Filter HQ', 'فلتر', '301']);
});

test('workshop bill never leaks the platform VAT even with platform sources', () => {
    const s = resolveBillSellerWith(
        platform,
        { collectionOwner: 'workshop' },
        { workshopName: 'W3', workshopTaxId: '' },
        { name: 'W3 Co', taxId: '312' },
        { platformVatNumber: '300000000000003' },
    );
    assert.equal(s.kind, 'workshop');
    assert.equal(s.vatNumber, '312');
});
