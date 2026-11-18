import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCollectionRecordJournalPreview,
  citRelocateDryRunView,
  isRelocateReasonValid,
} from './lockerCitDisplay.js';

test('isRelocateReasonValid needs 5+ trimmed chars', () => {
  assert.equal(isRelocateReasonValid(''), false);
  assert.equal(isRelocateReasonValid('   abcd  '), false);
  assert.equal(isRelocateReasonValid('abcde'), true);
  assert.equal(isRelocateReasonValid(null), false);
});

test('citRelocateDryRunView maps the full dry-run result', () => {
  const v = citRelocateDryRunView({
    dryRun: true,
    idempotent: false,
    proposedHeadingCode: '1006',
    colliding: { id: 55, code: '1005', name: 'Employee Advances', type: 'ASSET', postedLineCount: 3, glBalance: -12.345 },
    officersWouldGetLeaves: [{ officerUserId: 9, code: '1006-O9', name: 'Omar' }],
  });
  assert.equal(v.proposedCode, '1006');
  assert.equal(v.idempotent, false);
  assert.deepEqual(v.colliding, { id: '55', code: '1005', name: 'Employee Advances', type: 'ASSET', postedLineCount: 3, glBalance: '-12.35' });
  assert.deepEqual(v.officers, [{ officerUserId: '9', code: '1006-O9', name: 'Omar' }]);
});

test('citRelocateDryRunView idempotent replay exposes the current heading', () => {
  const v = citRelocateDryRunView({ idempotent: true, heading: { id: '77', code: '1007' }, colliding: null });
  assert.equal(v.idempotent, true);
  assert.equal(v.headingCode, '1007');
  assert.equal(v.colliding, null);
  assert.deepEqual(v.officers, []);
});

test('blocked CIT preview carries the relocate action but no navigation href', () => {
  const p = buildCollectionRecordJournalPreview({ blocked: true, officerLeafStatus: 'conflict' });
  assert.equal(p.blocked.reasonKey, 'LOCKER_CIT_NAMESPACE_COLLISION');
  assert.equal(p.blocked.actionKey, 'relocateCit');
  assert.equal('actionHref' in p.blocked, false);
});

test('not-provisioned (no 1005 at all) does not offer relocate', () => {
  const p = buildCollectionRecordJournalPreview({ blocked: true, officerLeafStatus: 'missing' });
  assert.equal(p.blocked.reasonKey, 'LOCKER_CIT_NOT_PROVISIONED');
  assert.equal(p.blocked.actionKey, null);
});
