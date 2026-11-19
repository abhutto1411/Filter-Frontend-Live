import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    JOURNAL_PAGE_SIZE,
    auditActionCounts,
    auditDiffRows,
    canShowDelete,
    canShowReverse,
    canShowUnvoid,
    canShowVoid,
    formatWesternMoney,
    fmtBusinessYmd,
    isAccountingAdminActor,
    isForbiddenError,
    isReversalJournal,
    journalCardsFromSummary,
    journalTags,
    messageFromJournalError,
    resolveJournalIdForReverse,
    showingRange,
    slicePage,
    statusChipKind,
    validateReverseReason,
} from './journalAuditDisplay.js';

describe('journalCardsFromSummary', () => {
    it('maps Entries and Total debits when those fields exist', () => {
        const cards = journalCardsFromSummary({
            totalEntries: 1204,
            postedCount: 10,
            balancedCount: 9,
            totalDebit: 412900,
        });
        assert.deepEqual(cards.map((c) => c.id), ['entries', 'debits']);
        assert.equal(cards[0].value, 1204);
        assert.equal(cards[1].money, true);
    });

    it('hides Manual and Voided cards when API omits those counts', () => {
        const cards = journalCardsFromSummary({ totalEntries: 3, totalDebit: 10 });
        assert.equal(cards.some((c) => c.id === 'manual'), false);
        assert.equal(cards.some((c) => c.id === 'voided'), false);
    });

    it('shows Manual / Voided only when the fields exist', () => {
        const cards = journalCardsFromSummary({
            totalEntries: 4,
            manualCount: 38,
            voidedCount: 2,
            reversedCount: 3,
            totalDebit: 1,
        });
        assert.equal(cards.find((c) => c.id === 'manual').value, 38);
        assert.equal(cards.find((c) => c.id === 'voided').value, 5);
    });
});

describe('showingRange / slicePage', () => {
    it('uses 25-per-page offsets', () => {
        assert.equal(JOURNAL_PAGE_SIZE, 25);
        assert.deepEqual(showingRange(1204, 25, 0), { from: 1, to: 25, total: 1204 });
        assert.deepEqual(showingRange(4, 25, 0), { from: 1, to: 4, total: 4 });
        assert.deepEqual(showingRange(0, 25, 0), { from: 0, to: 0, total: 0 });
        assert.deepEqual(slicePage(['a', 'b', 'c', 'd'], 2, 2), ['c', 'd']);
    });
});

describe('statusChipKind', () => {
    it('maps posted / void / draft / reversed to chip kinds', () => {
        assert.equal(statusChipKind('posted'), 'ok');
        assert.equal(statusChipKind('void'), 'bad');
        assert.equal(statusChipKind('draft'), 'warn');
        assert.equal(statusChipKind('reversed'), 'info');
    });
});

describe('validateReverseReason', () => {
    it('requires 3–500 trimmed characters', () => {
        assert.equal(validateReverseReason('ab').ok, false);
        assert.equal(validateReverseReason('  ab  ').ok, false);
        assert.equal(validateReverseReason('abc').ok, true);
        assert.equal(validateReverseReason('x'.repeat(500)).ok, true);
        assert.equal(validateReverseReason('x'.repeat(501)).ok, false);
        assert.equal(validateReverseReason('  why  ').value, 'why');
    });
});

describe('reverse / void / delete visibility', () => {
    it('shows Reverse for posted originals only', () => {
        assert.equal(canShowReverse({ status: 'posted', source: 'MANUAL_JE' }), true);
        assert.equal(canShowReverse({ status: 'posted', source: 'reversal' }), false);
        assert.equal(canShowReverse({ status: 'void', source: 'PAYMENT' }), false);
        assert.equal(canShowReverse({ status: 'posted', source: 'PERIOD_CLOSE' }), false);
        assert.equal(canShowReverse({ status: 'draft', source: 'MANUAL_JE' }), false);
    });

    it('hides Unvoid always and Delete except drafts', () => {
        assert.equal(canShowUnvoid(), false);
        assert.equal(canShowDelete({ status: 'posted' }), false);
        assert.equal(canShowDelete({ status: 'draft' }), true);
        assert.equal(canShowVoid({ status: 'posted', source: 'PAYMENT' }), true);
        assert.equal(canShowVoid({ status: 'void' }), false);
    });
});

describe('journalTags / isReversalJournal', () => {
    it('tags Reversal of JE from source + description', () => {
        const tags = journalTags({
            source: 'reversal',
            description: 'Reversal of JE-1042 — typo',
            sourceId: '99',
        });
        assert.equal(isReversalJournal({ type: 'reversal' }), true);
        assert.equal(tags[0].kind, 'reversalOf');
        assert.equal(tags[0].entryNumber, 'JE-1042');
    });

    it('hides Reversed by unless reversedById is present', () => {
        assert.deepEqual(journalTags({ status: 'posted', source: 'POS' }), []);
        assert.equal(journalTags({ reversedById: '12', reversedByEntryNumber: 'JE-9' })[0].kind, 'reversedBy');
    });
});

describe('audit helpers', () => {
    it('counts actions and diffs before/after keys', () => {
        assert.deepEqual(
            auditActionCounts([{ action: 'void' }, { action: 'reverse' }, { action: 'void' }]),
            [
                { action: 'void', count: 2 },
                { action: 'reverse', count: 1 },
            ],
        );
        const rows = auditDiffRows({ status: 'posted', n: 1 }, { status: 'void', extra: true });
        assert.equal(rows.find((r) => r.key === 'status').changed, true);
        assert.equal(rows.find((r) => r.key === 'extra').before, null);
        assert.equal(rows.find((r) => r.key === 'n').after, null);
    });
});

describe('error / actor / date / money', () => {
    it('detects 403 and maps known reverse codes', () => {
        assert.equal(isForbiddenError({ status: 403 }), true);
        assert.equal(messageFromJournalError({ code: 'USE_REVERSE' }).key, 'gj.err.useReverse');
        assert.equal(messageFromJournalError({ status: 403 }).key, 'gj.noPermission');
    });

    it('recognises owner / accountant and pay-receipt journalId', () => {
        assert.equal(isAccountingAdminActor({ userType: 'workshop_owner' }), true);
        assert.equal(isAccountingAdminActor({ role: { name: 'accountant' } }), true);
        assert.equal(isAccountingAdminActor({ role: { name: 'cashier' } }), false);
        assert.equal(resolveJournalIdForReverse({ journalId: 44 }, false), '44');
        assert.equal(resolveJournalIdForReverse({ id: 7 }, true), '7');
    });

    it('formats business dates and western money', () => {
        assert.equal(fmtBusinessYmd('2027-04-15T00:00:00.000Z'), '2027-04-15');
        assert.equal(formatWesternMoney(412900), '412,900.00');
    });
});
