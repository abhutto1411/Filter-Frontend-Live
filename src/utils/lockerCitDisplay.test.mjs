import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LOCKER_CIT_PAGE_SIZE,
  agingBucketLabel,
  buildChargeToOptions,
  buildCollectionRecordJournalPreview,
  collectionRecordDebitFromContext,
  emptyPreview,
  buildReceiveJournalPreview,
  citApprovalKindBadge,
  collectionRecordBannerKind,
  citResponseMatchesApplied,
  daysHeldTone,
  lockerCitErrorI18nKey,
  defaultChargeToForApproval,
  fifoSelectCollections,
  fifoToggleThroughIndex,
  formatCitMoneyLatn,
  formatCitStamp,
  mapCitOverviewCards,
  mapOfficerWalletCards,
  mapVarianceApprovalRows,
  matchesAgingFilter,
  sliceCitPage,
} from './lockerCitDisplay.js';

describe('lockerCitDisplay money/stamp', () => {
  it('formats western digits with 2 dp', () => {
    assert.equal(formatCitMoneyLatn(3820), '3,820.00');
    assert.equal(formatCitMoneyLatn(null), '');
  });

  it('slices ISO stamps without TZ convert', () => {
    assert.equal(formatCitStamp('2026-10-27T18:40:00.000Z', true), '2026-10-27 18:40');
    assert.equal(formatCitStamp('2026-10-27T18:40:00.000Z', false), '2026-10-27');
  });
});

describe('aging buckets', () => {
  it('maps days to buckets and filter match', () => {
    assert.equal(agingBucketLabel(0), '0-1');
    assert.equal(agingBucketLabel(1), '0-1');
    assert.equal(agingBucketLabel(3), '2-3');
    assert.equal(agingBucketLabel(5), '4-7');
    assert.equal(agingBucketLabel(9), '>7');
    assert.equal(matchesAgingFilter(5, '4-7'), true);
    assert.equal(matchesAgingFilter(5, '0-1'), false);
    assert.equal(matchesAgingFilter(5, 'any'), true);
  });

  it('tones oldest days red over 3', () => {
    assert.equal(daysHeldTone(1), 'ok');
    assert.equal(daysHeldTone(3), 'warn');
    assert.equal(daysHeldTone(5), 'bad');
  });
});

describe('map cards', () => {
  it('hides missing vault/pending fields', () => {
    const cards = mapCitOverviewCards({
      totalInTransit: 7320,
      officers: 3,
      over3Days: 1,
    });
    assert.equal(cards.vaultCash, null);
    assert.equal(cards.pendingVariances, null);
    assert.equal(cards.totalInTransit, '7320');
    assert.equal(cards.officers, '3');
    assert.equal(cards.over3Days, '1');
  });

  it('maps officer wallet cards from open collections', () => {
    const cards = mapOfficerWalletCards({
      officer: { name: 'Ali' },
      accountCode: '1005-O41',
      balance: 3820,
      openCollections: [
        { id: '1', daysHeld: 1 },
        { id: '2', daysHeld: 5 },
      ],
      handovers: [{ receivedAt: '2099-01-01T00:00:00.000Z' }],
      handoversThisMonth: 11,
    });
    assert.equal(cards.officerName, 'Ali');
    assert.equal(cards.accountCode, '1005-O41');
    assert.equal(cards.balance, '3820');
    assert.equal(cards.openCount, 2);
    assert.equal(cards.oldestDays, 5);
    assert.equal(cards.handoversThisMonth, 11);
  });
});

describe('FIFO selection', () => {
  const open = [
    { id: 'a', collectedAt: '2026-10-27T21:10:00.000Z', amount: 1250 },
    { id: 'b', collectedAt: '2026-10-27T22:30:00.000Z', amount: 970 },
    { id: 'c', collectedAt: '2026-10-28T08:05:00.000Z', amount: 900 },
  ];

  it('selects contiguous prefix and sums expected', () => {
    const r = fifoSelectCollections(open, ['a', 'b']);
    assert.equal(r.fifoValid, true);
    assert.deepEqual(r.selectedIds, ['a', 'b']);
    assert.equal(r.expectedAmount, 2220);
  });

  it('rejects gap selection', () => {
    const r = fifoSelectCollections(open, ['a', 'c']);
    assert.equal(r.fifoValid, false);
  });

  it('toggle through index selects 0..i', () => {
    assert.deepEqual(fifoToggleThroughIndex(open, 1), ['a', 'b']);
    assert.deepEqual(fifoToggleThroughIndex(open, 0), ['a']);
  });
});

describe('journal preview + slice + charge-to', () => {
  it('builds balanced vault shortage preview', () => {
    const p = buildReceiveJournalPreview({
      destination: 'vault',
      countedAmount: 3100,
      expectedAmount: 3120,
      officerCode: '1005-O41',
      officerName: 'Ali',
    });
    assert.equal(p.difference, -20);
    assert.equal(p.balanced, true);
    assert.equal(p.lines.length, 3);
  });

  it('slices pages of 25', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: String(i) }));
    const page1 = sliceCitPage(rows, 1);
    assert.equal(page1.pageSize, LOCKER_CIT_PAGE_SIZE);
    assert.equal(page1.rows.length, 25);
    assert.equal(page1.from, 1);
    assert.equal(page1.to, 25);
    const page2 = sliceCitPage(rows, 2);
    assert.equal(page2.rows.length, 5);
  });

  it('defaults charge-to by kind', () => {
    assert.equal(
      defaultChargeToForApproval({ kind: 'collection', difference: '-10' }),
      'cashier',
    );
    assert.equal(
      defaultChargeToForApproval({ kind: 'handover', difference: '-20' }),
      'officer',
    );
    assert.equal(
      defaultChargeToForApproval({ kind: 'collection', difference: '5' }),
      'none',
    );
    assert.equal(citApprovalKindBadge('handover').key, 'handover');
    assert.equal(citApprovalKindBadge('collection').key, 'pickup');
  });
});

describe('collection record journal preview (mockup 33)', () => {
  it('returns empty flatLines when amount is missing or zero (record page first paint)', () => {
    const cases = [
      buildCollectionRecordJournalPreview({ receivedAmount: '' }),
      buildCollectionRecordJournalPreview({ receivedAmount: '0' }),
      buildCollectionRecordJournalPreview({ receivedAmount: undefined }),
      buildCollectionRecordJournalPreview(),
    ];
    for (const p of cases) {
      assert.ok(Array.isArray(p.flatLines));
      assert.equal(p.flatLines.length, 0);
      assert.deepEqual(p.journals, []);
      assert.equal(p.lineCount, 0);
      assert.equal(p.balanced, false);
    }
    assert.deepEqual(emptyPreview().flatLines, []);
  });

  it('posts two lines for amount 10 and four balanced vault-now lines', () => {
    const one = buildCollectionRecordJournalPreview({
      receivedAmount: '10',
      officerCode: '1005-O12',
    });
    assert.equal(one.flatLines.length, 2);
    const vaultNow = buildCollectionRecordJournalPreview({
      receivedAmount: '10',
      officerCode: '1005-O12',
      receiveIntoVaultNow: true,
    });
    assert.equal(vaultNow.flatLines.length, 4);
    assert.equal(vaultNow.balanced, true);
  });

  it('preview debit follows posting context (1004 / 1005-O / missing leaf)', () => {
    const off = collectionRecordDebitFromContext({
      citEnabled: false,
      debitAccount: { code: '1004', name: 'Locker Vault Cash' },
      officerLeafStatus: null,
    });
    assert.equal(off.debitCode, '1004');
    assert.equal(off.blocked, false);
    const offPreview = buildCollectionRecordJournalPreview({
      receivedAmount: '10',
      debitCode: off.debitCode,
      debitName: off.debitName,
    });
    assert.match(offPreview.flatLines[0].account, /^1004 /);

    const on = collectionRecordDebitFromContext({
      citEnabled: true,
      debitAccount: { code: '1005-O41', name: 'Cash in Transit — Ali' },
      officerLeafStatus: 'ok',
    });
    assert.equal(on.debitCode, '1005-O41');
    assert.equal(on.blocked, false);

    const missing = collectionRecordDebitFromContext({
      citEnabled: true,
      debitAccount: null,
      officerLeafStatus: 'missing',
    });
    assert.equal(missing.blocked, true);
    assert.equal(missing.debitCode, null);
    const blockedPreview = buildCollectionRecordJournalPreview({
      receivedAmount: '10',
      debitCode: missing.debitCode,
      blocked: missing.blocked,
    });
    assert.equal(blockedPreview.flatLines.length, 0);
    assert.equal(blockedPreview.previewError, 'LOCKER_CIT_NOT_PROVISIONED');
  });

  it('flag OFF 9 vs expected 10: Dr 1004 9 / Dr 1153 1 / Cr till 10', () => {
    const p = buildCollectionRecordJournalPreview({
      receivedAmount: '9',
      expectedAmount: '10',
      debitCode: '1004',
      debitName: 'Locker Vault Cash',
      tillCode: '1001-C1751',
    });
    assert.equal(p.previewError, null);
    assert.equal(p.flatLines.length, 3);
    assert.equal(p.flatLines[0].account.startsWith('1004'), true);
    assert.equal(p.flatLines[0].dr, 9);
    assert.equal(p.flatLines[1].account.includes('1153'), true);
    assert.equal(p.flatLines[1].dr, 1);
    assert.equal(p.flatLines[2].cr, 10);
    assert.equal(p.balanced, true);
  });

  it('posts one journal when receive-now is off', () => {
    const p = buildCollectionRecordJournalPreview({
      receivedAmount: 2150,
      officerCode: '1005-O12',
      officerName: 'Nadia',
      tillCode: '1001-C77',
      tillName: 'Cashier 7',
      receiveIntoVaultNow: false,
    });
    assert.equal(p.journals.length, 1);
    assert.equal(p.balanced, true);
    assert.equal(p.flatLines.length, 2);
  });

  it('posts two journals when receive-now is on', () => {
    const p = buildCollectionRecordJournalPreview({
      receivedAmount: 2150,
      officerCode: '1005-O12',
      officerName: 'Nadia',
      tillCode: '1001-C77',
      tillName: 'Cashier 7',
      receiveIntoVaultNow: true,
    });
    assert.equal(p.journals.length, 2);
    assert.equal(p.lineCount, 4);
    assert.equal(p.balanced, true);
    assert.equal(p.flatLines[2].account.includes('1004'), true);
  });

  it('maps variance approval rows and charge-to options', () => {
    const rows = mapVarianceApprovalRows([
      {
        id: '9',
        kind: 'handover',
        handoverId: '91',
        officerName: 'Omar',
        difference: '-20',
        cashierName: 'C1',
      },
    ]);
    assert.equal(rows[0].kindBadge.key, 'handover');
    assert.equal(rows[0].ref, 'HO-91');
    assert.equal(rows[0].defaultChargeTo, 'officer');
    const opts = buildChargeToOptions(rows[0]);
    assert.equal(opts.length, 3);
    assert.equal(opts[1].id, 'officer');
  });
});

describe('citResponseMatchesApplied', () => {
  it('suppresses stale generation and mixed from/to', () => {
    const scope = {
      fromYmd: '2026-11-01',
      toYmd: '2026-11-08',
      generation: 'g1',
      branchId: '5',
      officerUserId: '',
    };
    assert.equal(
      citResponseMatchesApplied(scope, {
        from: '2026-11-01',
        to: '2026-11-08',
        generation: 'g1',
        branchId: '5',
      }),
      true,
    );
    assert.equal(
      citResponseMatchesApplied(scope, {
        from: '2026-11-01',
        to: '2026-11-08',
        generation: 'g2',
        branchId: '5',
      }),
      false,
    );
    assert.equal(
      citResponseMatchesApplied(scope, {
        from: '2026-10-01',
        to: '2026-11-08',
        generation: 'g1',
      }),
      false,
    );
  });
});

describe('lockerCitErrorI18nKey', () => {
  it('distinguishes identity, cap, idempotency, busy, policy, receipt, not-provisioned', () => {
    assert.equal(
      lockerCitErrorI18nKey({ code: 'LOCKER_CIT_IDENTITY_REQUIRED' }),
      'cit.err.identity',
    );
    assert.equal(
      lockerCitErrorI18nKey({ code: 'LOCKER_CIT_POPULATION_CAP' }),
      'cit.err.populationCap',
    );
    assert.equal(
      lockerCitErrorI18nKey({ code: 'LOCKER_CIT_IDEMPOTENCY_CONFLICT' }),
      'cit.err.idempotency',
    );
    assert.equal(
      lockerCitErrorI18nKey({ code: 'LOCKER_COLLECTION_IDEMPOTENCY_CONFLICT' }),
      'cit.err.idempotency',
    );
    assert.equal(
      lockerCitErrorI18nKey({ code: 'LOCKER_CIT_CLAIM_CONFLICT' }),
      'cit.err.busy',
    );
    assert.equal(
      lockerCitErrorI18nKey({ code: 'LOCKER_CIT_FORBIDDEN' }),
      'cit.err.policy',
    );
    assert.equal(
      lockerCitErrorI18nKey({ code: 'ACCOUNT_ROLE_INSUFFICIENT' }),
      'cit.err.receipt',
    );
    assert.equal(
      lockerCitErrorI18nKey({ code: 'LOCKER_CIT_NOT_PROVISIONED' }),
      'cit.err.notProvisioned',
    );
    assert.equal(
      lockerCitErrorI18nKey({ code: 'LOCKER_CIT_NAMESPACE_COLLISION' }),
      'cit.err.collision',
    );
    assert.equal(
      lockerCitErrorI18nKey({
        message:
          'Invalid `db.cashBankAccount.findMany()` invocation in src/accounts/internal/account-role.util.ts:526:43 Transaction API error: Transaction not found.',
      }),
      'cit.err.unavailable',
    );
    assert.equal(lockerCitErrorI18nKey({ code: 'SOME_OTHER' }), null);
    assert.equal(lockerCitErrorI18nKey({ message: '409 posting' }), null);
  });
});

describe('collectionRecordBannerKind', () => {
  it('does not treat failed receipt as full success', () => {
    assert.equal(
      collectionRecordBannerKind({
        success: true,
        collection: { status: 'approved', id: '9' },
        receipt: { status: 'failed', nextAction: 'retry_receipt' },
      }),
      'receipt_failed',
    );
  });

  it('omitted receipt is CIT held, not vault confirmation', () => {
    assert.equal(
      collectionRecordBannerKind({
        success: true,
        collection: { status: 'approved', receiptStatus: 'not_requested' },
        receipt: { status: 'not_requested' },
      }),
      'pickup_cit',
    );
  });
});
