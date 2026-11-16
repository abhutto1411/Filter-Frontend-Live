import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeCollectionRequestDetail,
  normalizeCollectionRequestList,
  normalizeLockerTeam,
  nullableMoney,
} from './lockerCollectionNormalize.js';

describe('lockerCollectionApi normalizer', () => {
  it('always returns an items array from list payloads', () => {
    assert.deepEqual(normalizeCollectionRequestList([{ id: '1' }]).items, [
      { id: '1' },
    ]);
    const withTotal = normalizeCollectionRequestList({
      items: [{ id: 'a' }],
      total: 9,
    });
    assert.equal(withTotal.items.length, 1);
    assert.equal(withTotal.total, 9);
    assert.deepEqual(normalizeCollectionRequestList({ rows: [{ id: 'r' }] }).items, [
      { id: 'r' },
    ]);
    assert.deepEqual(normalizeCollectionRequestList({ data: [{ id: 'd' }] }).items, [
      { id: 'd' },
    ]);
    assert.deepEqual(normalizeCollectionRequestList(null).items, []);
    assert.deepEqual(normalizeCollectionRequestList('nope').items, []);
    assert.equal(normalizeCollectionRequestList('nope').total, null);
  });

  it('team response is always an array of users', () => {
    assert.deepEqual(normalizeLockerTeam({ users: [{ id: '1' }] }).users, [
      { id: '1' },
    ]);
    assert.deepEqual(normalizeLockerTeam([{ id: '2' }]).users, [{ id: '2' }]);
    assert.deepEqual(normalizeLockerTeam(null).users, []);
    assert.deepEqual(normalizeLockerTeam('x').users, []);
  });

  it('missing money stays null (never 0)', () => {
    assert.equal(nullableMoney(undefined), null);
    assert.equal(nullableMoney(null), null);
    assert.equal(nullableMoney(''), null);
    assert.equal(nullableMoney('not-a-number'), null);
    assert.equal(nullableMoney('9'), 9);
    assert.equal(nullableMoney(0), 0);
  });

  it('detail rejects empty or non-object responses', () => {
    assert.throws(() => normalizeCollectionRequestDetail(null));
    assert.throws(() => normalizeCollectionRequestDetail('x'));
    assert.throws(() => normalizeCollectionRequestDetail([]));
    assert.equal(normalizeCollectionRequestDetail({ id: '7' }).id, '7');
  });
});
